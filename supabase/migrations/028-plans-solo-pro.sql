-- ════════════════════════════════════════════════════════════════════════════
-- 028 — SOLO ET PRO : LE PLAN ET LE COMPTE VENDEUR, RANGÉS PAR LE WEBHOOK
--       (9 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien,
--       docs/passation/2026-11-09-plans-solo-pro.md).
-- ════════════════════════════════════════════════════════════════════════════
-- Julien (9 nov.) : « Ça peut être 1 compte vendeur et plein de comptes achat,
-- donc sur ces comptes on prend que les achats ; pour avoir toutes ses ventes de
-- tous ses comptes il prend l'abonnement du dessus. »
--
-- Deux colonnes sur `abonnements`, écrites par le SEUL webhook Stripe (clé de
-- service, api/compte.js `ecrireStatut`) depuis le PRIX réel de l'abonnement et
-- les métadonnées que VRM pose sur SON clic (route `compte-vendeur`) :
--   · `plan`           'solo' | 'pro' | null (null = pas su ⇒ rien n'est bridé) ;
--   · `compte_vendeur` le `vinted_user_id` du compte qui vend en Solo.
-- Elles servent au SERVEUR (une vente d'un compte hors offre ne sonne pas,
-- api/_lib/plan-vendeur.js). L'app, elle, lit le plan en direct chez Stripe
-- (`mode=abonnement`) : sans la 028, tout marche, seules les notifications des
-- comptes hors offre continuent de sonner (« pas su » ne coupe rien).
-- Additif : aucune donnée existante n'est touchée, aucun DROP. Le vendeur LIT
-- sa ligne (politique `abonnements_lecture_soi`, 005) et n'y écrit jamais.

alter table public.abonnements add column if not exists plan text;
alter table public.abonnements add column if not exists compte_vendeur text;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'abonnements_plan_valide') then
    alter table public.abonnements add constraint abonnements_plan_valide check (plan is null or plan in ('solo', 'pro'));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'abonnements_compte_vendeur_valide') then
    alter table public.abonnements add constraint abonnements_compte_vendeur_valide check (compte_vendeur is null or compte_vendeur ~ '^[0-9]{1,20}$');
  end if;
end $$;

-- PostgREST relit le schéma (sinon la colonne reste « inconnue » quelques minutes).
notify pgrst, 'reload schema';
