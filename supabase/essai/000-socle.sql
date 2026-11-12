-- 000 — LE SOCLE DE LA BASE D'ESSAI « vrm-essai » (12 nov. 2026, agent2-fiabilite-prod)
-- Les deux tables que la migration 001 suppose DÉJÀ là (elles ont été créées à la
-- main dans le tableau de bord en mai 2026, avant toute migration). Forme relevée
-- sur la vraie base le 12 nov. (catalogue, lecture seule — AUCUNE donnée) :
--   app_data(id, data, updated_at)            + owner, meta ajoutés par 001/004
--   vinted_accounts(id, vinted_user_id, login, domain, access_token,
--                   refresh_token, updated_at, created_at, anon_id, csrf_token) + owner (001)
-- Rejoué UNIQUEMENT sur la base d'essai par scripts/essai/appliquer-migrations.mjs
-- (jamais sur la vraie base, qui a déjà tout cela). Aucune ligne n'est insérée.
create table if not exists public.app_data (
  id text not null primary key,
  data jsonb default '{}'::jsonb,
  updated_at timestamptz default now()
);
create table if not exists public.vinted_accounts (
  id bigserial primary key,
  vinted_user_id text not null unique,   -- `vinted_accounts_vinted_user_id_key`, retirée par 002
  login text,
  domain text,
  access_token text,
  refresh_token text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  anon_id text,
  csrf_token text
);
