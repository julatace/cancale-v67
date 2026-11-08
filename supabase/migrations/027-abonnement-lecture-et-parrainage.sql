-- ════════════════════════════════════════════════════════════════════════════
-- 027 — ABONNEMENT : À L'EXPIRATION, LES DONNÉES RESTENT LISIBLES · PARRAINAGE
--       (8 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien,
--       docs/passation/2026-11-08-abonnement-propre.md).
-- ════════════════════════════════════════════════════════════════════════════
-- 1. LECTURE SEULE À L'EXPIRATION.
--    Avant (006, 4 octobre) : qui ne paie plus ne LIT plus rien non plus — la
--    restrictive `abonnement_requis` porte `for all`, et l'app remplace tout par
--    la porte d'abonnement. Décision du 8 novembre (chantier « abonnement
--    propre ») : un essai fini ou un abonnement arrêté laisse ses données
--    LISIBLES (ventes, compta, factures, numéros : sa compta lui appartient) ;
--    seules les ÉCRITURES (et donc les actions, qui passent toutes par une
--    écriture : commandes à l'extension, publications, réglages) demandent
--    l'abonnement. Rien n'est supprimé, comme avant.
--    ⚠️ Sans DROP (l'outil SQL attend une confirmation humaine, et 016 retouche
--       déjà cette politique) : on RETOUCHE `abonnement_requis` —
--         · USING devient `true`  ⇒ SELECT libre (les règles d'owner, de
--           confidentialité 021 et d'équipe 016 décident toujours QUI lit quoi) ;
--         · WITH CHECK reste `vrm_acces_ok()` ⇒ INSERT et UPDATE refusés ;
--       et on AJOUTE une restrictive pour DELETE (que USING seul gardait).
--    Notifications et widget restent coupés (`vrm_acces_pour`, inchangé).
-- 2. `vrm_acces()` rend aussi `lecture: true` : l'app sait que la base laisse
--    lire, et passe en lecture seule au lieu de fermer la porte. Sans la 027,
--    `lecture` est absent ⇒ l'app garde l'ancienne porte (cohérente avec RLS).
-- 3. PARRAINAGE : un code par vendeur, une ligne par filleul (une seule fois),
--    clé de service seule (comme `essais_gratuits`, 022). Éteint par défaut :
--    `vrm_reglages.parrainage` = '0' — Julien le passe à '1'.
-- Additif : aucune donnée existante n'est touchée.

-- ── 1. La restrictive : lire oui, écrire non ─────────────────────────────────
do $$
declare t text;
begin
  -- app_data : 016 a posé `vrm_acces_ok() or owner = vrm_equipe_vendeur()` en USING.
  foreach t in array array['app_data', 'vinted_accounts', 'vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal'] loop
    if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = t and policyname = 'abonnement_requis') then
      execute format('alter policy abonnement_requis on public.%I using (true)', t);
      if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = t and policyname = 'abonnement_requis_effacer') then
        execute format('create policy abonnement_requis_effacer on public.%I as restrictive for delete to authenticated '
                       'using ((select public.vrm_acces_ok()))', t);
      end if;
    end if;
  end loop;
end $$;

-- ── 2. Ce que l'app lit ──────────────────────────────────────────────────────
create or replace function public.vrm_acces()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'obligatoire', coalesce((select r.valeur from public.vrm_reglages r where r.cle = 'abonnement_obligatoire'), '0') = '1',
    'proprietaire', auth.uid() is not null and auth.uid()::text = coalesce((select r.valeur from public.vrm_reglages r where r.cle = 'proprietaire'), ''),
    'acces', public.vrm_acces_pour(auth.uid()),
    'lecture', true)
$$;
revoke all on function public.vrm_acces() from public, anon;
grant execute on function public.vrm_acces() to authenticated, service_role;

-- ── 3. Parrainage ────────────────────────────────────────────────────────────
insert into public.vrm_reglages (cle, valeur) values ('parrainage', '0') on conflict (cle) do nothing;

create table if not exists public.parrainage_codes (
  owner  uuid primary key,
  code   text not null unique,              -- 8 signes, sans 0/O/1/I
  cree   timestamptz not null default now()
);
create table if not exists public.parrainages (
  filleul            uuid primary key,      -- UNE fois par filleul
  parrain            uuid not null,
  code               text not null,
  inscrit            timestamptz not null default now(),
  paye_le            timestamptz,           -- premier paiement réel (> 0 €) du filleul
  credit_filleul_le  timestamptz,           -- son mois offert, crédité chez Stripe
  credit_parrain_le  timestamptz,           -- celui du parrain (en attente s'il n'a pas de client Stripe)
  check (filleul <> parrain)
);
create index if not exists parrainages_parrain on public.parrainages (parrain);

alter table public.parrainage_codes enable row level security;
alter table public.parrainages enable row level security;
-- Aucune policy : un vendeur ne voit ni les codes des autres, ni qui il a parrainé
-- (l'écran reçoit des NOMBRES de la route serveur, jamais un nom ni un e-mail).
revoke all on public.parrainage_codes from anon, authenticated;
revoke all on public.parrainages from anon, authenticated;
grant select, insert on public.parrainage_codes to service_role;
grant select, insert, update on public.parrainages to service_role;
