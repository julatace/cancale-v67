-- ESSAI ANNULÉ de la migration 016 (scripts/equipe-sql/essai-annule.cjs) : RIEN ne reste après.
begin;
set local lock_timeout = '3s';
do $$ begin
  if not pg_catalog.has_table_privilege(current_user, 'auth.users', 'select') then
    raise exception 'vrm_equipe_auth : % ne peut pas lire auth.users (adresse confirmée) — rien n''est installé', current_user;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then
    raise exception 'vrm_equipe_auth : auth.users.email_confirmed_at absente — rien n''est installé';
  end if;
end $$;
create table if not exists public.vrm_equipe (
  id uuid primary key default gen_random_uuid(),
  vendeur uuid not null,
  email text not null,
  membre uuid,
  role text not null default 'colis',
  statut text not null default 'invitee',
  invite_le timestamptz not null default now(),
  accepte_le timestamptz,
  revoque_le timestamptz,
  constraint vrm_equipe_role check (role in ('colis')),
  constraint vrm_equipe_statut check (statut in ('invitee', 'actif', 'revoquee')),
  constraint vrm_equipe_email check (email = lower(btrim(email)) and email ~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$'),
  constraint vrm_equipe_actif check (statut <> 'actif' or (membre is not null and accepte_le is not null)),
  constraint vrm_equipe_revoque check (statut <> 'revoquee' or revoque_le is not null),
  constraint vrm_equipe_soi check (membre is null or membre <> vendeur)
);
do $$ declare v text; begin
  select pg_catalog.md5(
      (select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = 'public.vrm_equipe'::regclass and a.attnum > 0 and not a.attisdropped)
      || '|' ||
      (select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = 'public.vrm_equipe'::regclass and k.contype <> 'n'))
    into v;
  if v is distinct from '948f3ab6286e46db9db58b0041275a79' then
    raise exception 'vrm_equipe_forme : la table public.vrm_equipe existe sous une autre forme (empreinte %) — rien n''est installé', v;
  end if;
end $$;
create unique index if not exists vrm_equipe_une_invitation on public.vrm_equipe (vendeur, email) where statut <> 'revoquee';
create index if not exists vrm_equipe_par_membre on public.vrm_equipe (membre) where statut = 'actif';
alter table public.vrm_equipe enable row level security;
alter table public.vrm_equipe force row level security;
revoke all on public.vrm_equipe from public, anon, authenticated, service_role;
create or replace function public.vrm_equipe_id_permis(p_id text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_id ~ '^(email_bord_[A-Za-z0-9]{1,40}|harvest_[0-9]{1,20}_label_[A-Za-z0-9]{1,40}|panel_colis_relais|email_track_[a-z0-9]{1,30}_[A-Za-z0-9-]{1,80})$', false)
$$;
create or replace function public.vrm_equipe_actif(p_vendeur uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and p_vendeur is not null
     and exists (select 1 from public.vrm_equipe e
                  where e.membre = auth.uid() and e.vendeur = p_vendeur
                    and e.statut = 'actif')
     and public.vrm_acces_pour(p_vendeur)
$$;
create or replace function public.vrm_equipe_vendeur()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin
    v := (nullif(pg_catalog.current_setting('request.headers', true), '')::json ->> 'x-vrm-equipe')::uuid;
  exception when others then return null;
  end;
  if v is null or not public.vrm_equipe_actif(v) then return null; end if;
  return v;
end $$;
create or replace function public.vrm_equipe_inviter(p_email text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  e text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  r public.vrm_equipe;
  n integer;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if e !~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$' then return jsonb_build_object('ok', false, 'raison', 'email'); end if;
  if exists (select 1 from auth.users u where u.id = moi and pg_catalog.lower(u.email) = e) then
    return jsonb_build_object('ok', false, 'raison', 'soi');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_equipe'), pg_catalog.hashtext(moi::text));
  select * into r from public.vrm_equipe x where x.vendeur = moi and x.email = e and x.statut <> 'revoquee';
  if found then return jsonb_build_object('ok', true, 'id', r.id, 'statut', r.statut, 'deja', true); end if;
  select count(*) into n from public.vrm_equipe x where x.vendeur = moi and x.statut <> 'revoquee';
  if n >= 5 then return jsonb_build_object('ok', false, 'raison', 'plafond'); end if;
  insert into public.vrm_equipe (vendeur, email) values (moi, e) returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id, 'statut', r.statut, 'deja', false);
end $$;
create or replace function public.vrm_equipe_accepter(p_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); e text;
begin
  if moi is null then return false; end if;
  select pg_catalog.lower(u.email) into e from auth.users u where u.id = moi and u.email_confirmed_at is not null;
  if e is null or e = '' then return false; end if;
  update public.vrm_equipe x set membre = moi, statut = 'actif', accepte_le = pg_catalog.now()
   where x.id = p_id and x.statut = 'invitee' and x.email = e and x.vendeur <> moi;
  return found;
end $$;
create or replace function public.vrm_equipe_revoquer(p_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return false; end if;
  update public.vrm_equipe x set statut = 'revoquee', revoque_le = pg_catalog.now()
   where x.id = p_id and x.statut <> 'revoquee' and (x.vendeur = moi or x.membre = moi);
  return found;
end $$;
create or replace function public.vrm_equipe_lister()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'email', x.email, 'statut', x.statut, 'role', x.role,
                         'invite_le', x.invite_le, 'accepte_le', x.accepte_le, 'revoque_le', x.revoque_le) order by x.invite_le)
                         from public.vrm_equipe x where x.vendeur = auth.uid()), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'de', v.email, 'role', x.role, 'invite_le', x.invite_le) order by x.invite_le)
                         from public.vrm_equipe x
                         join auth.users u on u.id = auth.uid() and u.email_confirmed_at is not null and pg_catalog.lower(u.email) = x.email
                         left join auth.users v on v.id = x.vendeur
                        where x.statut = 'invitee' and x.vendeur <> auth.uid()), '[]'::jsonb),
    'membre_de', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'vendeur', x.vendeur, 'de', v.email, 'role', x.role,
                         'acces', public.vrm_acces_pour(x.vendeur)) order by x.accepte_le)
                         from public.vrm_equipe x left join auth.users v on v.id = x.vendeur
                        where x.membre = auth.uid() and x.statut = 'actif'), '[]'::jsonb)) end
$$;
create or replace function public.vrm_equipe_colis(p_vendeur uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with ok as (select 1 where public.vrm_equipe_actif(p_vendeur)),
  lignes as (
    select (pg_catalog.regexp_match(a.id, '^harvest_([0-9]+)_orders_(sold|purchased)$')) as m, a.data
      from public.app_data a, ok
     where a.owner = p_vendeur and a.id ~ '^harvest_[0-9]+_orders_(sold|purchased)$'),
  ordres as (
    select l.m[1] as uid, l.m[2] as sens, o
      from lignes l, jsonb_array_elements(case when jsonb_typeof(l.data #> '{payload,my_orders}') = 'array'
                                               then l.data #> '{payload,my_orders}' else '[]'::jsonb end) o
     where coalesce(o->>'status', '') !~* '(finalis|annul|rembours)'
       and coalesce(o->>'transaction_user_status', '') <> 'completed'),
  projetes as (
    select r.sens, jsonb_strip_nulls(jsonb_build_object(
             'uid', r.uid,
             'transaction_id', r.o->'transaction_id', 'item_id', r.o->'item_id',
             'title', r.o->'title', 'status', r.o->'status',
             'transaction_user_status', r.o->'transaction_user_status', 'date', r.o->'date',
             'photo', case when jsonb_typeof(r.o->'photo') = 'object' then r.o #> '{photo,url}' end)) as j
      from ordres r)
  select case when not exists (select 1 from ok) then null else jsonb_build_object(
    'ventes', coalesce((select jsonb_agg(p.j) from projetes p where p.sens = 'sold'), '[]'::jsonb),
    'achats', coalesce((select jsonb_agg(p.j) from projetes p where p.sens = 'purchased'), '[]'::jsonb),
    'comptes', coalesce((select jsonb_object_agg(v.vinted_user_id, v.login) from public.vinted_accounts v
                          where v.owner = p_vendeur and v.vinted_user_id is not null), '{}'::jsonb),
    'postes', coalesce((select jsonb_agg(k) from public.app_data a, jsonb_object_keys(
                          case when jsonb_typeof(a.data->'vinted_ship_done') = 'object' then a.data->'vinted_ship_done' else '{}'::jsonb end) k
                          where a.owner = p_vendeur and a.id = 'main'), '[]'::jsonb),
    'retires', coalesce((select jsonb_agg(k) from public.app_data a, jsonb_object_keys(
                          case when jsonb_typeof(a.data->'vinted_pickup_done') = 'object' then a.data->'vinted_pickup_done' else '{}'::jsonb end) k
                          where a.owner = p_vendeur and a.id = 'main'), '[]'::jsonb)) end
$$;
create or replace function public.vrm_equipe_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.vrm_equipe x where x.vendeur = p_owner or x.membre = p_owner;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vrm_equipe_id_permis(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_actif(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_vendeur() from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_inviter(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_accepter(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_revoquer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_lister() from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_colis(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_effacer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_equipe_id_permis(text) to authenticated;
grant execute on function public.vrm_equipe_vendeur() to authenticated;
grant execute on function public.vrm_equipe_inviter(text) to authenticated;
grant execute on function public.vrm_equipe_accepter(uuid) to authenticated;
grant execute on function public.vrm_equipe_revoquer(uuid) to authenticated;
grant execute on function public.vrm_equipe_lister() to authenticated;
grant execute on function public.vrm_equipe_colis(uuid) to authenticated;
grant execute on function public.vrm_equipe_effacer(uuid) to service_role;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'equipe_lit') then
    create policy equipe_lit on public.app_data for select to authenticated
      using (owner = (select public.vrm_equipe_vendeur()) and public.vrm_equipe_id_permis(id));
  end if;
end $$;
do $$ begin
  if coalesce((select p.qual from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = 'app_data' and p.policyname = 'abonnement_requis'), '') <> 'true' then
    alter policy abonnement_requis on public.app_data
  using ((select public.vrm_acces_ok()) or owner = (select public.vrm_equipe_vendeur()));
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'vrm_lecture_privee') then
    alter policy vrm_lecture_privee on public.app_data
      using (owner = (select auth.uid()) or (owner = (select public.vrm_equipe_vendeur()) and public.vrm_equipe_id_permis(id)));
  end if;
end $$;
do $$ declare b text; begin
  select pg_catalog.string_agg(p.policyname, ', ' order by p.policyname) into b
    from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = 'app_data' and p.permissive = 'RESTRICTIVE'
     and p.cmd in ('SELECT', 'ALL')
     and (p.roles @> array['authenticated']::name[] or p.roles @> array['public']::name[])
     and coalesce(p.qual, '') not like '%vrm_equipe_vendeur%'
     and coalesce(p.qual, '') <> 'true';  -- une restrictive `true` (027) ne ferme rien
  if b is not null then
    raise exception 'vrm_equipe_lecture_bloquee : la restrictive % fermerait la lecture du membre — rien n''est installé', b;
  end if;
end $$;
select json_build_object(
  'table', to_regclass('public.vrm_equipe') is not null,
  'rls', (select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass('public.vrm_equipe')),
  'forme', (select pg_catalog.md5(
      (select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = 'public.vrm_equipe'::regclass and a.attnum > 0 and not a.attisdropped)
      || '|' ||
      (select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = 'public.vrm_equipe'::regclass and k.contype <> 'n')) where to_regclass('public.vrm_equipe') is not null),
  'droits', (select coalesce(json_agg(r || ':' || p order by r, p), '[]') from unnest(array['anon','authenticated','service_role','public']) r,
             unnest(case when current_setting('server_version_num')::int >= 170000
                         then array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']
                         else array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] end) p
             where to_regclass('public.vrm_equipe') is not null and has_table_privilege(r, 'public.vrm_equipe', p)),
  'droits_colonnes', (select json_agg(a.attname) from pg_attribute a where a.attrelid = to_regclass('public.vrm_equipe') and a.attnum > 0 and a.attacl is not null),
  'regles_table', (select json_agg(policyname) from pg_policies where schemaname = 'public' and tablename = 'vrm_equipe'),
  'regles', (select coalesce(json_agg(s order by s collate "C"), '[]') from (select tablename || ':' || policyname || ':' || permissive || ':' || cmd || ':' || array_to_string(roles, ',') || ':' || regexp_replace(regexp_replace(regexp_replace(lower(coalesce(qual, '')), '\s+', '', 'g'), 'public\.', '', 'g'), 'as[a-z_]+\)', ')', 'g') || ':' || regexp_replace(regexp_replace(regexp_replace(lower(coalesce(with_check, '')), '\s+', '', 'g'), 'public\.', '', 'g'), 'as[a-z_]+\)', ')', 'g') s
             from pg_policies where schemaname = 'public' and tablename = 'app_data' and (policyname in ('equipe_lit', 'abonnement_requis')
               or coalesce(qual, '') like '%vrm_equipe%' or coalesce(with_check, '') like '%vrm_equipe%')) z),
  'restrictives_bloquantes', (select json_agg(policyname order by policyname) from pg_policies where schemaname = 'public' and tablename = 'app_data'
             and permissive = 'RESTRICTIVE' and cmd in ('SELECT', 'ALL') and (roles @> array['authenticated']::name[] or roles @> array['public']::name[])
             and coalesce(qual, '') not like '%vrm_equipe_vendeur%' and coalesce(qual, '') <> 'true'),
  'fonctions', (select json_object_agg(q, (select json_build_object('n', count(*), 'def', bool_and(p.prosecdef), 'cfg', (array_agg(to_jsonb(p.proconfig)))[1], 'vol', (array_agg(p.provolatile::text))[1], 'md5', (array_agg(md5(p.prosrc)))[1],
                                            'auth', bool_and(has_function_privilege('authenticated', p.oid, 'execute')),
                                            'sr', bool_and(has_function_privilege('service_role', p.oid, 'execute')),
                                            'anon', bool_or(has_function_privilege('anon', p.oid, 'execute')))
                                         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = q))
                from unnest(array['vrm_equipe_id_permis','vrm_equipe_actif','vrm_equipe_vendeur','vrm_equipe_inviter','vrm_equipe_accepter','vrm_equipe_revoquer','vrm_equipe_lister','vrm_equipe_colis','vrm_equipe_effacer']::text[]) q)
) as essai;
rollback;
