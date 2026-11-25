-- ════════════════════════════════════════════════════════════════════════════
-- 050 — SANS ABONNEMENT, L'EXTENSION RANGE QUAND MÊME SES LECTURES
--       (25 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien,
--       docs/passation/2026-11-25-lecture-sans-abonnement.md).
-- ════════════════════════════════════════════════════════════════════════════
-- Décision de Julien (25 nov. soir) : « Tu peux directement faire la lecture et
-- tu floutes tant que la personne n'a pas d'abonnement. Sauf si il est en essai
-- gratuit. » Elle remplace, sur ce point, celle du 8 novembre (027 : « lire oui,
-- écrire non » — l'extension ne pouvait donc RIEN ranger : chaque capture
-- recevait un 403 de la restrictive `abonnement_requis`, et le vendeur qui
-- s'abonnait repartait de zéro).
--
-- CE QUI CHANGE (le plus petit changement qui suffit) :
--   1. `vrm_ligne_capture(id)` : la liste des lignes de CAPTURE de l'extension,
--      écrite UNE fois — `harvest_*` (dressing, ventes, achats, boîte, porte-
--      monnaie, transactions, suivis, bordereaux déjà générés…), et les lignes
--      de lecture Leboncoin / Vestiaire (`lbc_listings`, `lbc_ventes`,
--      `lbc_messages`, `lbc_accounts`, `vc_listings`, `vc_ventes`, `vc_achats`,
--      `vc_messages`, `vc_session`, `vc_label_*`).
--   2. `app_data` : le WITH CHECK de `abonnement_requis` devient
--      « accès OU ligne de capture ». Une écriture de l'APP (main, réglages,
--      journaux, commandes à l'extension `cmd_*`, coffre…) exige toujours
--      l'accès. La SUPPRESSION exige toujours l'accès (`abonnement_requis_effacer`,
--      027, inchangée).
--   3. `vinted_accounts` : le WITH CHECK de `abonnement_requis` devient `true` —
--      la LIAISON d'un compte Vinted (ses jetons, rangés à son nom) est le début
--      de la lecture. Les règles d'owner (021) et d'unicité (023) décident
--      toujours. La suppression exige toujours l'accès.
-- CE QUI NE CHANGE PAS :
--   · qui lit quoi (owner, 021, 016) ; la lecture était déjà libre (027) ;
--   · notifications, widget, IA, eBay, relais : coupés (`vrm_acces_pour`) ;
--   · AUCUNE action de plateforme sans abonnement : l'extension (5.453.0) refuse
--     toute action (offres, messages, republication, baisses…) à un compte coupé
--     — son compteur d'actions est fermé (`compterActionUn`, code 'abonnement') ;
--   · la garde d'écriture de l'app (`vrm-lecture-seule`) ; aucune donnée touchée.
-- AUCUN DROP sur une politique : on RETOUCHE `abonnement_requis` (ALTER POLICY).
--
-- MODE D'EMPLOI (éditeur SQL de Supabase) : coller TOUT le fichier, Run.
--   Le contrôle en fin de transaction relit les deux politiques : si l'une ne
--   porte pas ce qui est attendu, TOUT est annulé et le message dit pourquoi.
-- ANNULER : le bloc « ANNULER » en bas (commenté) remet le WITH CHECK de la 027.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 0. La 027 doit être passée (lecture libre, écriture fermée) ───────────────
do $$
declare t text; q text; c text;
begin
  foreach t in array array['app_data', 'vinted_accounts'] loop
    select p.qual, p.with_check into q, c from pg_catalog.pg_policies p
     where p.schemaname = 'public' and p.tablename = t and p.policyname = 'abonnement_requis';
    if not found then raise exception 'vrm_050 : abonnement_requis absente sur % (006 pas passée ?) — rien n''est changé', t; end if;
    if coalesce(q, '') <> 'true' then raise exception 'vrm_050 : abonnement_requis sur % ne laisse pas encore lire (USING = %) — passer la 027 d''abord ; rien n''est changé', t, q; end if;
  end loop;
end $$;

-- ── 1. Les lignes de capture de l'extension (UNE liste) ──────────────────────
create or replace function public.vrm_ligne_capture(p_id text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
       p_id ~ '^harvest_[A-Za-z0-9:.-]{1,40}_[A-Za-z0-9_:.-]{1,160}$'
    or p_id in ('lbc_listings', 'lbc_ventes', 'lbc_messages', 'lbc_accounts',
                'vc_listings', 'vc_ventes', 'vc_achats', 'vc_messages', 'vc_session')
    or p_id ~ '^vc_label_[A-Za-z0-9_-]{1,80}$',
    false)
$$;
revoke all on function public.vrm_ligne_capture(text) from public, anon;
grant execute on function public.vrm_ligne_capture(text) to authenticated, service_role;

-- ── 2. app_data : écrire une ligne de capture sans abonnement ────────────────
alter policy abonnement_requis on public.app_data
  with check ((select public.vrm_acces_ok()) or public.vrm_ligne_capture(id));

-- ── 3. vinted_accounts : la liaison d'un compte sans abonnement ──────────────
alter policy abonnement_requis on public.vinted_accounts
  with check (true);

-- ── 4. Le contrôle (dans la transaction : un écart annule tout) ──────────────
do $$
declare c text;
begin
  select p.with_check into c from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = 'app_data' and p.policyname = 'abonnement_requis';
  if c is null or position('vrm_acces_ok' in c) = 0 or position('vrm_ligne_capture' in c) = 0 then
    raise exception 'vrm_050 : contrôle — app_data.abonnement_requis porte « % » — tout est annulé', c;
  end if;
  select p.with_check into c from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = 'vinted_accounts' and p.policyname = 'abonnement_requis';
  if coalesce(c, '') <> 'true' then raise exception 'vrm_050 : contrôle — vinted_accounts.abonnement_requis porte « % » — tout est annulé', c; end if;
  -- La suppression reste fermée sans abonnement (027).
  if not exists (select 1 from pg_catalog.pg_policies p where p.schemaname = 'public' and p.tablename = 'app_data' and p.policyname = 'abonnement_requis_effacer') then
    raise exception 'vrm_050 : contrôle — abonnement_requis_effacer absente sur app_data — tout est annulé';
  end if;
  -- La liste : ce qui DOIT passer, ce qui ne doit JAMAIS passer.
  if not (public.vrm_ligne_capture('harvest_12345_orders_sold') and public.vrm_ligne_capture('harvest_12345_txn_987')
          and public.vrm_ligne_capture('lbc_listings') and public.vrm_ligne_capture('vc_label_ab12')) then
    raise exception 'vrm_050 : contrôle — une ligne de capture est refusée — tout est annulé';
  end if;
  if public.vrm_ligne_capture('main') or public.vrm_ligne_capture('cmd_dist_1') or public.vrm_ligne_capture('vinted_cadence')
     or public.vrm_ligne_capture('harvest_') or public.vrm_ligne_capture('coffre_123') or public.vrm_ligne_capture(null) then
    raise exception 'vrm_050 : contrôle — une ligne de l''app passerait sans abonnement — tout est annulé';
  end if;
  raise notice 'vrm_050 : OK — l''extension range ses lectures sans abonnement ; l''app n''écrit toujours rien.';
end $$;
commit;

-- Vérification (structure seulement, ne lit aucune donnée vendeur).
select tablename, policyname, cmd, qual, with_check
  from pg_catalog.pg_policies
 where schemaname = 'public' and tablename in ('app_data', 'vinted_accounts') and policyname like 'abonnement_requis%'
 order by tablename, policyname;

-- ── ANNULER (à coller seul si besoin) ───────────────────────────────────────
-- begin;
-- alter policy abonnement_requis on public.app_data with check ((select public.vrm_acces_ok()));
-- alter policy abonnement_requis on public.vinted_accounts with check ((select public.vrm_acces_ok()));
-- drop function if exists public.vrm_ligne_capture(text);
-- commit;
