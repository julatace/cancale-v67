-- ============================================================================
-- VRM — Socle multi-utilisateurs : isolation des données par compte + sécurité
-- À exécuter dans Supabase → SQL Editor (APRÈS une sauvegarde, déjà faite).
-- Rien n'est destructif : on ajoute des colonnes, une table, et on active RLS.
-- ============================================================================

-- 1) Colonne "propriétaire" (= l'utilisateur Supabase Auth) sur les données.
alter table public.app_data        add column if not exists owner uuid;
alter table public.vinted_accounts add column if not exists owner uuid;

-- 2) Table des abonnements = source de vérité du "qui a payé" (gating).
create table if not exists public.subscriptions (
  owner              uuid primary key references auth.users(id) on delete cascade,
  status             text not null default 'trial',   -- trial | active | past_due | canceled
  plan               text,
  current_period_end timestamptz,
  stripe_customer    text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- 3) MIGRATION des données existantes de Julien vers son compte.
--    (À faire APRÈS avoir créé son compte via l'écran de connexion VRM, puis
--     remplacer <UID_JULIEN> par son id auth — visible dans Supabase → Auth.)
-- update public.app_data        set owner = '<UID_JULIEN>' where owner is null;
-- update public.vinted_accounts set owner = '<UID_JULIEN>' where owner is null;

-- 4) Activer la sécurité au niveau des lignes (Row Level Security).
alter table public.app_data        enable row level security;
alter table public.vinted_accounts enable row level security;
alter table public.subscriptions   enable row level security;

-- 5) Politiques : chacun ne lit/écrit QUE ses propres lignes.
drop policy if exists "own app_data" on public.app_data;
create policy "own app_data" on public.app_data
  for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own vinted_accounts" on public.vinted_accounts;
create policy "own vinted_accounts" on public.vinted_accounts
  for all using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own subscription" on public.subscriptions;
create policy "own subscription" on public.subscriptions
  for select using (owner = auth.uid());   -- écrit uniquement par le webhook Stripe (service role)

-- ============================================================================
-- NOTE EXTENSION : une fois RLS activé, l'extension Chrome ne peut plus écrire
-- avec la clé anonyme. Elle devra s'authentifier au compte de l'utilisateur
-- (session Supabase) pour taguer ses écritures avec `owner`. Modif de l'extension
-- prévue dans une étape dédiée. Tant que ce n'est pas fait, NE PAS activer RLS
-- en production (sinon la capture de comptes casse).
-- ============================================================================
