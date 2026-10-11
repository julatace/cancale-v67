-- ════════════════════════════════════════════════════════════════════════════
-- Imitation MINIMALE de la base Supabase de production, pour l'audit de la
-- migration 014 (scripts/audit-agent-sql.cjs) — et, plus tard, pour le banc de
-- vie de l'agent (K5). AUCUNE DONNÉE ici.
--
-- Forme MESURÉE en lecture seule le 11 octobre 2026 (projet de production) :
--   • les rôles : `postgres` n'est PAS superutilisateur, il contourne RLS
--     (bypassrls) et il est membre d'anon, authenticated et service_role ;
--     `service_role` contourne RLS ; anon et authenticated, non ;
--   • les DROITS PAR DÉFAUT du schéma public : toute table neuve est ouverte en
--     entier (arwdDxtm) à anon, authenticated et service_role, toute fonction
--     neuve exécutable par eux. ⇒ Une migration qui ne retire pas ces droits
--     laisse sa table écrite par n'importe quel navigateur. C'est ce que l'audit
--     doit pouvoir voir : on les reproduit ici ;
--   • `auth.uid()` et `auth.role()` lisent les revendications du jeton
--     (`request.jwt.claim.*` ou `request.jwt.claims`), comme en production ;
--   • `app_data` (clé (owner, id), `meta` calculé, les deux politiques d'owner
--     et les trois `tout_*` en double), `vinted_accounts`, le journal des
--     écritures (`sauvegarde.noter_ecriture`, définition de production).
-- Les migrations 005 (abonnements), 006 (la règle d'accès, `vrm_reglages`,
-- `abonnement_requis`) et 007 (droits minimaux) sont ensuite appliquées TELLES
-- QUELLES depuis supabase/migrations/ par l'audit : on teste 014 sur le vrai
-- socle, pas sur une recopie.
--
-- Ce fichier est exécuté par le SUPERUTILISATEUR du Postgres jetable
-- (`supabase_admin`, comme en production) ; les objets de `public` sont créés
-- au nom de `postgres`, qui en est propriétaire en production.
-- ════════════════════════════════════════════════════════════════════════════
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres login nosuperuser bypassrls inherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
grant anon, authenticated, service_role to postgres;

-- Le schéma public appartient au propriétaire de la base (pg_database_owner),
-- dont `postgres` est membre : il y crée ses objets.
grant usage on schema public to anon, authenticated, service_role;

-- ── auth (définitions de production, recopiées le 11 octobre) ────────────────
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role, postgres;
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
create or replace function auth.role() returns text language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$$;
grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role, postgres;
create table if not exists auth.users (id uuid primary key);
grant select, references on auth.users to postgres;

-- ── les droits par défaut du schéma public (mesurés en production) ───────────
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant execute on functions to anon, authenticated, service_role;

-- ── sauvegarde (le schéma privé, propriété de postgres) ──────────────────────
create schema if not exists sauvegarde authorization postgres;

set role postgres;

create table public.app_data (
  id text not null, data jsonb default '{}'::jsonb, updated_at timestamptz default now(),
  owner uuid not null default auth.uid(), meta jsonb, primary key (owner, id));
alter table public.app_data enable row level security;
create policy "chacun ses lignes" on public.app_data for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy tout_select on public.app_data for select to authenticated using (owner = (select auth.uid()));
create policy tout_insert on public.app_data for insert to authenticated with check (owner = (select auth.uid()));
create policy tout_update on public.app_data for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

create table public.vinted_accounts (vinted_user_id text, login text, owner uuid not null default auth.uid());
alter table public.vinted_accounts enable row level security;
create policy "chacun ses comptes" on public.vinted_accounts for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- `meta` (004), forme de production.
create or replace function public.vrm_meta(p_id text, d jsonb) returns jsonb language sql immutable as $function$
  select case when d is null or jsonb_typeof(d) <> 'object' then null else
    coalesce((select jsonb_object_agg(k, v) from jsonb_each(d) e(k, v)
               where jsonb_typeof(v) in ('string','number','boolean') and octet_length(v::text) <= 600), '{}'::jsonb)
    || case when coalesce(d->>'pdfB64','') <> '' then '{"_pdf":true}'::jsonb else '{}'::jsonb end
  end
$function$;
create or replace function public.vrm_meta_trigger() returns trigger language plpgsql as $function$
begin
  new.meta := public.vrm_meta(new.id, new.data);
  return new;
end $function$;
create trigger vrm_meta_maj before insert or update of data, id on public.app_data for each row execute function public.vrm_meta_trigger();

-- Le journal des écritures (définition de production, lue le 11 octobre).
create table sauvegarde.journal_ecritures (role text, uid uuid, tbl text, row_id text, op text, agent text, at timestamptz default now());
create or replace function sauvegarde.noter_ecriture() returns trigger language plpgsql security definer set search_path to '' as $function$
declare j jsonb := to_jsonb(new);
begin
  insert into sauvegarde.journal_ecritures(role, uid, tbl, row_id, op, agent)
  values (coalesce(auth.role(), current_user), auth.uid(), tg_table_name,
          coalesce(j->>'id', '') || case when tg_table_name = 'vinted_accounts' then ':' || coalesce(j->>'vinted_user_id','') else '' end,
          tg_op, left(coalesce(current_setting('request.headers', true)::json->>'user-agent',''), 80));
  return new;
exception when others then return new;  -- une mesure ne doit JAMAIS bloquer une écriture
end $function$;
revoke all on function sauvegarde.noter_ecriture() from public, anon, authenticated, service_role;
create trigger vrm_noter_ecriture after insert or update on public.app_data for each row execute function sauvegarde.noter_ecriture();
create trigger vrm_noter_ecriture after insert or update on public.vinted_accounts for each row execute function sauvegarde.noter_ecriture();

reset role;
