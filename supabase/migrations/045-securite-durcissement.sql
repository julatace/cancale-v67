-- ════════════════════════════════════════════════════════════════════════════
-- 045 — SÉCURITÉ DE LA BASE : DEUX RETOUCHES DE DURCISSEMENT (15 novembre 2026)
--       PAS ENCORE APPLIQUÉE (geste de Julien, ou du coordinateur avec son
--       accord). Récit : docs/passation/2026-11-15-securite-base.md.
-- ════════════════════════════════════════════════════════════════════════════
-- POURQUOI : revue des conseils Supabase du 15 nov. avant l'arrivée de nouveaux
-- vendeurs. Les 31 fonctions SECURITY DEFINER appelables par un utilisateur
-- connecté ont été relues une à une (code de PRODUCTION, pg_get_functiondef) :
-- aucune ne laisse un vendeur lire ou écrire ce qui appartient à un autre
-- (preuve : scripts/audit-securite-base.cjs). Il ne reste que deux durcissements
-- SANS effet sur l'app, réunis ici :
--
--   1. `detourage_usage` : `authenticated` garde des droits REFERENCES et
--      TRIGGER (droits par défaut du schéma public ; la 008 n'a retiré
--      qu'insert, update, delete, truncate). PostgREST ne s'en sert jamais
--      (ni l'app : elle LIT seulement son compteur, politique
--      `detourage_usage_lecture`). Un rôle qui n'a pas à poser de déclencheur
--      ni de clé étrangère sur une table ne doit pas pouvoir le faire. On les
--      retire ; SELECT (et la politique) restent.
--   2. `vrm_usage_vendeurs` (041, clé de service seulement) : `search_path =
--      public` sans `pg_temp`. Sans `pg_temp` écrit en DERNIER, Postgres cherche
--      les tables du schéma temporaire de la session AVANT `public` — la
--      recommandation de Postgres pour toute fonction SECURITY DEFINER est
--      `public, pg_temp`. Aucun rôle de l'API ne peut créer de table temporaire
--      par PostgREST (risque théorique), mais la retouche ne coûte rien : le
--      corps de la fonction n'est pas touché, seuls ses réglages.
--
-- CE QUI N'EST PAS TOUCHÉ : aucune donnée, aucune table, aucune politique,
-- aucun corps de fonction ; aucun droit d'exécution des 31 fonctions (elles
-- DOIVENT rester appelables avec le jeton du vendeur : le serveur les appelle
-- sous SA session, `api/_lib/communaute.js`, `api/_lib/accompagnement.js`,
-- `api/compte.js` ; `vrm_acces_ok` est lue par les politiques RLS elles-mêmes).
--
-- MODE D'EMPLOI (éditeur SQL de Supabase) : coller TOUT le fichier, Run. Aucun
-- DROP ni DELETE (aucune confirmation demandée). Rejouable : la 2e fois, rien
-- ne change. La dernière requête montre le résultat attendu :
--   detourage_usage | authenticated | SELECT          (une seule ligne)
--   vrm_usage_vendeurs | {"search_path=public, pg_temp"}
-- ANNULER : `grant references, trigger on public.detourage_usage to authenticated;`
--   et `alter function public.vrm_usage_vendeurs(integer) set search_path = public;`
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';
do $$
begin
  if pg_catalog.to_regclass('public.detourage_usage') is not null then
    revoke references, trigger, truncate on public.detourage_usage from anon, authenticated;
  end if;
  if pg_catalog.to_regprocedure('public.vrm_usage_vendeurs(integer)') is not null then
    alter function public.vrm_usage_vendeurs(integer) set search_path = public, pg_temp;
  end if;
end $$;
commit;

-- Vérification (structure seulement, ne lit aucune donnée vendeur).
select g.table_name, g.grantee, g.privilege_type
  from information_schema.role_table_grants g
 where g.table_schema = 'public' and g.table_name = 'detourage_usage' and g.grantee in ('anon', 'authenticated')
union all
select p.proname, '', pg_catalog.array_to_string(p.proconfig, ',')
  from pg_catalog.pg_proc p
 where p.pronamespace = 'public'::regnamespace and p.proname = 'vrm_usage_vendeurs';
