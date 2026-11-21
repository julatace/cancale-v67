-- ESSAI ANNULÉ de la migration 042 (écritures atomiques) : tout se fait dans une transaction ANNULÉE.
-- Aucune donnée de vendeur lue ni écrite (les appels visent un id qui n'existe pas). Coller d'un bloc
-- dans l'éditeur SQL de Supabase (jamais pas à pas).
-- Attendu : une ligne `essai` = {"fn":3,"relier":"invalide","lire":null,"ecrire":0,"service":true,"anon":false},
-- puis fn_reste = 0.
-- Le corps est celui de supabase/migrations/042-ecritures-atomiques.sql (vérifié par scripts/audit-serveur-migrations.cjs).
begin;
set local lock_timeout = '3s';

create or replace function public.vrm_vinted_relier(p_owner uuid, p_ligne jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_id text := p_ligne->>'vinted_user_id';
begin
  if p_owner is null or v_id is null or v_id !~ '^[0-9]{1,20}$' then return 'invalide'; end if;
  perform pg_advisory_xact_lock(hashtextextended('vrm_vinted_relier:' || v_id, 0));
  if exists (select 1 from public.vinted_accounts where vinted_user_id = v_id and owner <> p_owner) then
    return 'deja_relie';
  end if;
  insert into public.vinted_accounts as a (owner, vinted_user_id, access_token, refresh_token, domain, updated_at, login, anon_id, csrf_token)
  values (p_owner, v_id, p_ligne->>'access_token', p_ligne->>'refresh_token', p_ligne->>'domain',
          coalesce((p_ligne->>'updated_at')::timestamptz, now()), p_ligne->>'login', p_ligne->>'anon_id', p_ligne->>'csrf_token')
  on conflict (owner, vinted_user_id) do update set
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    domain = excluded.domain,
    updated_at = excluded.updated_at,
    login = case when p_ligne ? 'login' then excluded.login else a.login end,
    anon_id = case when p_ligne ? 'anon_id' then excluded.anon_id else a.anon_id end,
    csrf_token = case when p_ligne ? 'csrf_token' then excluded.csrf_token else a.csrf_token end;
  return 'ok';
exception when unique_violation then
  return 'deja_relie';
end $$;
revoke all on function public.vrm_vinted_relier(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.vrm_vinted_relier(uuid, jsonb) to service_role;

create or replace function public.vrm_commandes_lire(p_id text, p_owner uuid, p_tx text[]) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'cap', a.data->>'capturedAt',
    'rev', a.data->>'rev',
    'pg', a.data->'payload'->'pagination',
    'resume', a.data->'resume',
    'sq', coalesce((select jsonb_agg(jsonb_build_array(
                       o.v->>'transaction_id',
                       case when jsonb_typeof(o.v->'date') = 'string' then o.v->>'date' end) order by o.i)
                    from jsonb_array_elements(m.mo) with ordinality o(v, i)), '[]'::jsonb),
    'mo', coalesce((select jsonb_object_agg(x.k, x.v) from (
                      select distinct on (o.v->>'transaction_id') o.v->>'transaction_id' as k, o.v as v
                      from jsonb_array_elements(m.mo) with ordinality o(v, i)
                      where o.v->>'transaction_id' = any(p_tx)
                      order by o.v->>'transaction_id', o.i) x), '{}'::jsonb))
  from public.app_data a
  cross join lateral (select case when jsonb_typeof(a.data->'payload'->'my_orders') = 'array'
                                  then a.data->'payload'->'my_orders' else '[]'::jsonb end as mo) m
  where a.id = p_id and (p_owner is null or a.owner = p_owner)
  limit 1
$$;
revoke all on function public.vrm_commandes_lire(text, uuid, text[]) from public, anon;
grant execute on function public.vrm_commandes_lire(text, uuid, text[]) to authenticated, service_role;

create or replace function public.vrm_commandes_ecrire(p_id text, p_owner uuid, p_rev text, p_cap text, p_ordre jsonb, p_commandes jsonb, p_data jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  v_avant jsonb;
  v_liste jsonb;
  v_trou boolean;
  n integer;
begin
  if jsonb_typeof(p_ordre) <> 'array' or jsonb_typeof(p_commandes) <> 'object' or jsonb_typeof(p_data->'payload') <> 'object' then
    raise exception 'vrm_commandes_forme';
  end if;
  select a.data into v_avant from public.app_data a
   where a.id = p_id and (p_owner is null or a.owner = p_owner)
     and (a.data->>'rev') is not distinct from p_rev
     and (a.data->>'capturedAt') is not distinct from p_cap
   limit 1
   for update;
  if not found then return 0; end if;
  select jsonb_agg(x.c order by x.i), coalesce(bool_or(x.c is null), false) into v_liste, v_trou
  from (select e.i,
               case when jsonb_typeof(e.v) = 'number' then v_avant->'payload'->'my_orders'->((e.v #>> '{}')::int)
                    when jsonb_typeof(e.v) = 'string' then p_commandes->(e.v #>> '{}')
               end as c
        from jsonb_array_elements(p_ordre) with ordinality e(v, i)) x;
  if v_trou then raise exception 'vrm_commandes_ordre'; end if;
  update public.app_data a
     set data = jsonb_set(p_data, '{payload,my_orders}', coalesce(v_liste, '[]'::jsonb)), updated_at = now()
   where a.id = p_id and (p_owner is null or a.owner = p_owner)
     and (a.data->>'rev') is not distinct from p_rev
     and (a.data->>'capturedAt') is not distinct from p_cap;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vrm_commandes_ecrire(text, uuid, text, text, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.vrm_commandes_ecrire(text, uuid, text, text, jsonb, jsonb, jsonb) to authenticated, service_role;
select json_build_object(
  'fn', (select count(*) from pg_proc where proname in ('vrm_vinted_relier', 'vrm_commandes_lire', 'vrm_commandes_ecrire')),
  'relier', (select public.vrm_vinted_relier('00000000-0000-0000-0000-000000000000'::uuid, '{"vinted_user_id":"pas-un-numero"}'::jsonb)),
  'lire', (select public.vrm_commandes_lire('vrm_essai_042_inexistant', null, array['1'])),
  'ecrire', (select public.vrm_commandes_ecrire('vrm_essai_042_inexistant', null, null, null, '[]'::jsonb, '{}'::jsonb, '{"payload":{}}'::jsonb)),
  'service', (select has_function_privilege('service_role', 'public.vrm_vinted_relier(uuid, jsonb)', 'execute')),
  'anon', (select has_function_privilege('anon', 'public.vrm_vinted_relier(uuid, jsonb)', 'execute'))) as essai;
rollback;

select (select count(*) from pg_proc where proname in ('vrm_vinted_relier', 'vrm_commandes_lire', 'vrm_commandes_ecrire')) as fn_reste;
