-- ════════════════════════════════════════════════════════════════════════════
-- 030 — SOLO : UN COMPTE VENDEUR PAR PLATEFORME (Leboncoin, eBay, Vestiaire)
--       (9 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien,
--       docs/passation/2026-11-09-solo-plateformes.md). À passer APRÈS la 028.
-- ════════════════════════════════════════════════════════════════════════════
-- Julien (9 nov., « fais absolument tout ») : l'offre Solo s'étend à Leboncoin,
-- eBay et Vestiaire. Interprétation retenue (à confirmer par lui) : UN compte
-- vendeur PAR plateforme ; ses autres comptes de chaque plateforme sont des
-- comptes d'achat. Pro = tous.
--
-- Une colonne sur `abonnements`, écrite par le SEUL webhook Stripe (clé de
-- service, api/compte.js `ecrireStatut`) depuis les métadonnées que VRM pose sur
-- SON clic (route `compte-vendeur`, `{ plateforme, id }`) :
--   · `comptes_vendeurs` jsonb — { "leboncoin": "<id>", "ebay": "principal"|"<clé>",
--     "vestiaire": "<id>" }, seulement les plateformes CHOISIES ; `{}` ou null =
--     rien choisi ⇒ rien n'est bridé sur ces plateformes.
-- Elle sert au SERVEUR (bilans de la semaine et du mois : api/_lib/plan-vendeur.js).
-- L'app lit le choix en direct chez Stripe (`mode=abonnement`). Sans la 030 :
-- tout marche, le webhook range le statut, le plan et le compte Vinted sans
-- elle, et les bilans comptent tous les comptes Leboncoin / eBay / Vestiaire
-- (« pas su » ne bride rien).
-- Additif : aucune donnée existante n'est touchée, aucun DROP. Le vendeur LIT
-- sa ligne (politique `abonnements_lecture_soi`, 005) et n'y écrit jamais.
--
-- ── ESSAI (rien n'est gardé) ─────────────────────────────────────────────────
--   Coller dans l'éditeur SQL de Supabase, d'un bloc :
--     begin;
--     <le contenu de ce fichier ENTRE `begin;` et `commit;` ci-dessous>
--     do $e$ begin
--       if not exists (select 1 from information_schema.columns
--                      where table_schema = 'public' and table_name = 'abonnements'
--                        and column_name = 'comptes_vendeurs' and data_type = 'jsonb')
--       then raise exception 'ESSAI RATÉ : colonne comptes_vendeurs absente'; end if;
--       if not exists (select 1 from pg_catalog.pg_constraint
--                      where conname = 'abonnements_comptes_vendeurs_valide')
--       then raise exception 'ESSAI RATÉ : contrainte absente'; end if;
--       raise notice 'ESSAI OK : colonne comptes_vendeurs (jsonb) et contrainte posées';
--     end $e$;
--     rollback;
--   Attendu : « ESSAI OK … » puis ROLLBACK (aucune colonne gardée).
--   Puis, pour de bon : coller le fichier entier (il porte son begin/commit).
-- ════════════════════════════════════════════════════════════════════════════

begin;

alter table public.abonnements add column if not exists comptes_vendeurs jsonb;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'abonnements_comptes_vendeurs_valide') then
    alter table public.abonnements add constraint abonnements_comptes_vendeurs_valide
      check (comptes_vendeurs is null or jsonb_typeof(comptes_vendeurs) = 'object');
  end if;
end $$;

commit;

-- PostgREST relit le schéma (sinon la colonne reste « inconnue » quelques minutes).
notify pgrst, 'reload schema';
