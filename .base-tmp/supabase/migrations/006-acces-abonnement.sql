-- ════════════════════════════════════════════════════════════════════════════
-- 006 — QUI NE PAIE PLUS NE VOIT PLUS RIEN, ET NE REÇOIT PLUS RIEN (4 octobre 2026)
-- ════════════════════════════════════════════════════════════════════════════
-- Julien : « la personne ne doit plus recevoir de notifications, voir ses
-- données, etc. lorsqu'elle ne paye plus ».
--
-- ⚠️ POURQUOI DANS LA BASE, ET PAS SEULEMENT À L'ÉCRAN : l'écran de l'app ne
--    protège que l'app. L'extension, le widget et un simple appel à l'API avec
--    la session lisent la base directement. Le verrou vit donc ICI, en UNE
--    règle (`vrm_regle_acces`), lue par la base (RLS), par l'app (`vrm_acces`)
--    et par le serveur (`vrm_acces_pour`, notifications et widget) — §11.
--
-- ⚠️ RIEN NE CHANGE TANT QUE L'ABONNEMENT N'EST PAS OBLIGATOIRE : le réglage
--    `abonnement_obligatoire` vaut '0', et la règle laisse alors tout passer.
--    Julien le passe à '1' le jour où Stripe est en mode réel.
--
-- ⚠️ On ne SUPPRIME rien : les données de quelqu'un qui ne paie plus restent en
--    base, intactes, et réapparaissent dès qu'il reprend l'abonnement.
--
-- Additif uniquement : une table de réglages, une colonne, des fonctions et des
-- politiques RESTRICTIVES (elles s'ajoutent en « ET » aux règles existantes ;
-- aucune politique existante n'est modifiée ni supprimée).

-- Réglages de l'installation, lisibles par le serveur et les fonctions seulement.
create table if not exists public.vrm_reglages (cle text primary key, valeur text not null);
alter table public.vrm_reglages enable row level security;
alter table public.vrm_reglages force row level security;
revoke all on public.vrm_reglages from anon, authenticated;
insert into public.vrm_reglages (cle, valeur) values
  ('abonnement_obligatoire', '0'),
  ('proprietaire', '74eea6e7-f060-46b6-b9c7-d500cedf4738')   -- = VRM_OWNER_UID (Vercel) : Julien ne paie pas
on conflict (cle) do nothing;

-- Depuis quand le prélèvement échoue (Stripe réessaie pendant ce temps).
alter table public.abonnements add column if not exists impaye_depuis timestamptz;

-- ── LA règle, pure : aucune lecture de table, donc testable par un simple SELECT.
-- Accès si : abonnement pas obligatoire · ou propriétaire · ou abonnement vivant
-- (actif, essai) · ou impayé depuis MOINS de 14 jours (Stripe réessaie ; on ne
-- coupe pas quelqu'un dont la carte a refusé un matin).
create or replace function public.vrm_regle_acces(obligatoire boolean, est_proprietaire boolean, statut text, impaye_depuis timestamptz)
returns boolean language sql stable set search_path = '' as $$
  -- ⚠️ coalesce(…, false) : sans lui, « obligatoire, aucun abonnement » rendait
  --    NULL (false OR NULL = NULL). RLS le refusait bien, mais l'app recevait un
  --    « pas su » là où la réponse est NON. Mesuré au premier essai.
  select coalesce(
       (not coalesce(obligatoire, false))
    or coalesce(est_proprietaire, false)
    or coalesce(statut, '') in ('active', 'trialing')
    or (coalesce(statut, '') = 'past_due' and coalesce(impaye_depuis, now()) > now() - interval '14 days'),
    false)
$$;

-- La règle appliquée à un vendeur (serveur : notifications, widget).
create or replace function public.vrm_acces_pour(u uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.vrm_regle_acces(
    coalesce((select r.valeur from public.vrm_reglages r where r.cle = 'abonnement_obligatoire'), '0') = '1',
    u is not null and u::text = coalesce((select r.valeur from public.vrm_reglages r where r.cle = 'proprietaire'), ''),
    (select a.statut from public.abonnements a where a.owner = u),
    (select a.impaye_depuis from public.abonnements a where a.owner = u))
$$;
-- Le vendeur connecté (RLS).
create or replace function public.vrm_acces_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.vrm_acces_pour(auth.uid())
$$;
-- Ce que l'app doit afficher (porte, carte d'abonnement) — la MÊME règle.
create or replace function public.vrm_acces()
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'obligatoire', coalesce((select r.valeur from public.vrm_reglages r where r.cle = 'abonnement_obligatoire'), '0') = '1',
    'proprietaire', auth.uid() is not null and auth.uid()::text = coalesce((select r.valeur from public.vrm_reglages r where r.cle = 'proprietaire'), ''),
    'acces', public.vrm_acces_pour(auth.uid()))
$$;

-- Droits : `vrm_acces_pour(u)` dirait d'un AUTRE vendeur s'il paie — serveur seul.
revoke all on function public.vrm_acces_pour(uuid) from public, anon, authenticated;
grant execute on function public.vrm_acces_pour(uuid) to service_role;
revoke all on function public.vrm_acces_ok() from public, anon;
grant execute on function public.vrm_acces_ok() to authenticated, service_role;
revoke all on function public.vrm_acces() from public, anon;
grant execute on function public.vrm_acces() to authenticated, service_role;

-- ── LE VERROU : politiques RESTRICTIVES (en « ET » avec les règles d'owner).
-- La clé de service (le serveur) n'est pas concernée : les emails continuent
-- d'être rangés, rien n'est perdu pendant une interruption de paiement.
create policy abonnement_requis on public.app_data as restrictive for all to authenticated
  using ((select public.vrm_acces_ok())) with check ((select public.vrm_acces_ok()));
create policy abonnement_requis on public.vinted_accounts as restrictive for all to authenticated
  using ((select public.vrm_acces_ok())) with check ((select public.vrm_acces_ok()));
