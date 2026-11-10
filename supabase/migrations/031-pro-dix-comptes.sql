-- ════════════════════════════════════════════════════════════════════════════
-- 031 — PRO : 10 COMPTES VENDEURS AU TOTAL (10 novembre 2026)
--       PAS ENCORE APPLIQUÉE (geste de Julien, docs/passation/2026-11-10-pro-10-comptes.md).
--       À passer APRÈS la 030 (elle pose la colonne `comptes_vendeurs`).
-- ════════════════════════════════════════════════════════════════════════════
-- Julien (10 nov.) : « Solo = un compte vendeur par plateforme : oui, et 19,99
-- pour 10 comptes vendeurs ». Pro = 10 comptes vendeurs AU TOTAL, toutes
-- plateformes confondues, choisis par LUI (feuille « Quels 10 comptes vendent ? »).
--
-- Rien de nouveau à ranger : la liste vit dans la colonne de la 030,
-- `abonnements.comptes_vendeurs`, sous la clé `pro` :
--   { "pro": ["vinted:1007", "leboncoin:8442001", "ebay:principal", …] }
-- écrite par le SEUL webhook Stripe (clé de service, api/compte.js) depuis les
-- métadonnées que VRM pose sur SON clic (route `compte-vendeur`, plateforme `pro`).
-- Cette migration n'ajoute qu'un GARDE-FOU : `pro` absent, ou un tableau de 1 à
-- 10 chaînes. Sans elle, tout marche (le serveur relit la liste sans confiance :
-- plus de 10 ⇒ « pas su » ⇒ rien bridé).
-- Additif : aucune donnée existante n'est touchée, aucun DROP.
--
-- ── ESSAI (rien n'est gardé) ─────────────────────────────────────────────────
--   Coller dans l'éditeur SQL de Supabase, d'un bloc :
--     begin;
--     <le contenu de ce fichier ENTRE `begin;` et `commit;` ci-dessous>
--     do $e$ begin
--       if not exists (select 1 from pg_catalog.pg_constraint
--                      where conname = 'abonnements_comptes_pro_valide')
--       then raise exception 'ESSAI RATÉ : contrainte absente'; end if;
--       raise notice 'ESSAI OK : contrainte abonnements_comptes_pro_valide posée';
--     end $e$;
--     rollback;
--   Attendu : « ESSAI OK … » puis ROLLBACK (rien gardé). Une erreur « column
--   comptes_vendeurs does not exist » veut dire : la 030 n'est pas passée — la
--   passer d'abord.
--   Puis, pour de bon : coller le fichier entier (il porte son begin/commit).
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.vrm_comptes_pro_valide(cv jsonb) returns boolean
language sql immutable as $f$
  select cv is null
      or jsonb_typeof(cv) <> 'object'
      or not (cv ? 'pro')
      or (jsonb_typeof(cv->'pro') = 'array'
          and jsonb_array_length(cv->'pro') between 1 and 10
          and not exists (select 1 from jsonb_array_elements(cv->'pro') e where jsonb_typeof(e) <> 'string'))
$f$;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint where conname = 'abonnements_comptes_pro_valide') then
    alter table public.abonnements add constraint abonnements_comptes_pro_valide
      check (public.vrm_comptes_pro_valide(comptes_vendeurs));
  end if;
end $$;

commit;

-- PostgREST relit le schéma.
notify pgrst, 'reload schema';
