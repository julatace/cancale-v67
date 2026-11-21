-- Ce qu'une base Postgres NUE doit avoir pour recevoir le schéma public de
-- Supabase : les rôles cités par les politiques (TO authenticated, TO anon), le
-- schéma auth et ses fonctions (auth.uid() est la valeur par défaut de la
-- colonne owner), et la table auth.users visée par une clé étrangère.
-- Ne sert QUE dans la base jetable de l'essai de restauration (jamais sur
-- Supabase, qui a déjà tout cela).
\set ON_ERROR_STOP 1
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create schema if not exists extensions;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create or replace function auth.role() returns text language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.role', true), '') $$;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
-- Des déclencheurs du schéma public appellent des fonctions du schéma
-- « sauvegarde » (mesuré le 6 nov. 2026 : noter_ecriture sur app_data et
-- vinted_accounts, noter_ecriture_agent sur vrm_agent_commandes, _journal,
-- _vendeurs), qui ne sont pas dans la copie : ici elles ne font rien. Un
-- nouveau déclencheur vers un autre schéma fera échouer l'essai (« function …
-- does not exist ») : c'est ici qu'on ajoute son remplaçant.
create schema if not exists sauvegarde;
create or replace function sauvegarde.noter_ecriture() returns trigger language plpgsql as
  $$ begin return new; end $$;
create or replace function sauvegarde.noter_ecriture_agent() returns trigger language plpgsql as
  $$ begin return new; end $$;
-- (12 nov., intégration 12nov-b) Le schéma `realtime` de Supabase, que la migration 040 (temps réel) suppose :
-- imité au plus juste, comme scripts/audit-temps-reel-sql.cjs (messages, topic(), send). Base jetable seulement.
create schema if not exists realtime;
grant usage on schema realtime to anon, authenticated;
create table if not exists realtime.messages (id bigserial primary key, topic text not null, extension text not null, payload jsonb, event text, private boolean, inserted_at timestamptz default now());
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$
begin insert into realtime.messages(topic, extension, payload, event, private) values (topic, 'broadcast', payload, event, private); end $$;
