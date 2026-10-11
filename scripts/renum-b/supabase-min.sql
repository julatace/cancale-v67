-- Imitation MINIMALE de la base Supabase de production, pour l'audit de la
-- migration 013 (scripts/audit-renum-b.cjs). Forme mesurée en lecture seule le
-- 10 octobre 2026 : la table `app_data` (clé (owner, id), colonne `meta`
-- calculée par `vrm_meta_maj`), le journal des écritures (`vrm_noter_ecriture`),
-- RLS « chacun ses lignes », la clé publique en lecture seule (007), et les
-- fonctions de `public` exécutables par les rôles du navigateur (droits par
-- défaut de Supabase). AUCUNE DONNÉE ici.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select current_user::text $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant usage on schema public, auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table public.app_data (
  id text not null, data jsonb default '{}'::jsonb, updated_at timestamptz default now(),
  owner uuid not null default auth.uid(), meta jsonb, primary key (owner, id));
alter table public.app_data enable row level security;
create policy "chacun ses lignes" on public.app_data for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy anon_lit on public.app_data for select to anon using (false);
grant select, insert, update, delete on public.app_data to authenticated, service_role;
grant select on public.app_data to anon;
create table public.vrm_reglages (cle text primary key, valeur text);
-- Les comptes Vinted liés (colonnes lues par la migration : identifiant, login,
-- propriétaire — jamais les jetons, qui n'existent pas ici).
create table public.vinted_accounts (vinted_user_id bigint, login text, owner uuid not null default auth.uid());
alter table public.vinted_accounts enable row level security;
alter table public.vrm_reglages enable row level security;

-- Les deux déclencheurs de la vraie base (définitions recopiées de 004 / 007).
create or replace function public.vrm_meta(p_id text, d jsonb) returns jsonb language sql immutable set search_path to '' as $function$
  select case when d is null or jsonb_typeof(d) <> 'object' then null else
    coalesce((select jsonb_object_agg(k, v) from jsonb_each(d) e(k, v)
               where jsonb_typeof(v) in ('string','number','boolean') and octet_length(v::text) <= 600), '{}'::jsonb)
    || case when coalesce(d->>'pdfB64','') <> '' then '{"_pdf":true}'::jsonb else '{}'::jsonb end
    || case when p_id ~ '^harvest_[0-9]+_txn_' then jsonb_strip_nulls(jsonb_build_object(
         'id', d->'payload'->'transaction'->'id',
         'item_id', d->'payload'->'transaction'->'item_id',
         'status', d->'payload'->'transaction'->'status',
         'status_title', d->'payload'->'transaction'->'status_title',
         'status_updated_at', d->'payload'->'transaction'->'status_updated_at',
         'ship_status_title', d->'payload'->'transaction'->'shipment'->'status_title'))
       else '{}'::jsonb end
  end
$function$;
create or replace function public.vrm_meta_trigger() returns trigger language plpgsql set search_path to '' as $function$
begin
  new.meta := public.vrm_meta(new.id, new.data);
  return new;
end $function$;
create trigger vrm_meta_maj before insert or update of data, id on public.app_data for each row execute function public.vrm_meta_trigger();

create schema if not exists sauvegarde;
create table sauvegarde.journal_ecritures (role text, uid uuid, tbl text, row_id text, op text, agent text, at timestamptz default now());
create or replace function sauvegarde.noter_ecriture() returns trigger language plpgsql security definer set search_path to '' as $function$
declare j jsonb := to_jsonb(new);
begin
  insert into sauvegarde.journal_ecritures(role, uid, tbl, row_id, op, agent)
  values (coalesce(auth.role(), current_user), auth.uid(), tg_table_name, coalesce(j->>'id', ''), tg_op, '');
  return new;
exception when others then return new;
end $function$;
create trigger vrm_noter_ecriture after insert or update on public.app_data for each row execute function sauvegarde.noter_ecriture();
