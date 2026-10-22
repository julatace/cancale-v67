-- ════════════════════════════════════════════════════════════════════════════
-- 016 — LE MODE ÉQUIPE (fonction n°37 retenue le 11 octobre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- Le vendeur invite un MEMBRE (un aide, un proche) qui prépare les colis. Le
-- membre a un accès LIMITÉ, tenu PAR LA BASE (RLS), pas par l'écran :
--   • il LIT les colis du vendeur : bordereaux (email et capturés), suivis
--     transporteur, codes de retrait ;
--   • il obtient, par UNE fonction de projection (`vrm_equipe_colis`), la liste
--     des ventes à expédier et des achats à retirer SANS AUCUN MONTANT, sans
--     acheteur, sans message ;
--   • et RIEN d'autre : ni l'argent (ventes, transactions, porte-monnaie,
--     reçus, compta), ni les réglages (`main` jamais en entier), ni les comptes
--     Vinted et leurs jetons (`vinted_accounts` : aucune règle pour lui), ni
--     `ebay_tokens*`, ni les messages des acheteurs.
--   • AUCUNE ÉCRITURE. « Coché posté » n'est pas indispensable : Vinted fait
--     sortir le colis d'« à expédier » dès qu'il est scanné au relais
--     (`transaction_user_status`), et une écriture du membre dans les lignes du
--     vendeur ouvrirait une porte qu'aucun écran ne justifie.
--
-- Numéro : 016. La 015 est RÉSERVÉE (l'horloge de l'agent eBay, pg_cron /
-- pg_net, sur le oui de Julien — docs/passation/README.md).
--
-- LES FAMILLES LUES PAR LE MEMBRE (liste blanche, `vrm_equipe_id_permis`) :
--   email_bord_{tx}             le bordereau reçu par email : son PDF (il porte
--                               l'adresse de l'acheteur — c'est ce qu'on colle
--                               sur le carton, donc nécessaire), N°, modèle,
--                               date limite. Aucun montant.
--   harvest_{uid}_label_{tx}    le bordereau capté par l'extension (PDF, tx,
--   harvest_{uid}_label_latest  annonce, date). Aucun montant. `meta` suit la
--                               ligne (c'est la même ligne).
--   panel_colis_relais          les codes de retrait lus dans les conversations
--                               (code, lieu, QR) — pas le texte des messages.
--   email_track_{carrier}_{n}   les emails des transporteurs : n° de suivi,
--                               code de retrait, lieu, date limite.
-- ÉCARTÉES, et pourquoi : harvest_*_orders_sold / _purchased (prix ⇒ passent
-- par la projection sans montant) · harvest_*_txn_* (prix, acheteur) ·
-- harvest_*_billing, _releve_* (argent) · harvest_*_inbox, _conv_* (messages) ·
-- email_sale_*, email_final_*, email_offer_*, email_invoice_*, email_achat_*
-- (montants) · email_inconnu_*, email_quarantaine_* (emails entiers) · main
-- (réglages, prix d'achat) · ebay_*, lbc_*, vc_* · push_subs, plantage_*.
--
-- LE VENDEUR DOIT AVOIR ACCÈS (règle du 4 octobre, `vrm_acces_pour`) : un
-- vendeur qui ne paie plus ne voit plus rien, son équipe non plus. L'abonnement
-- du MEMBRE n'entre pas en compte (un aide ne paie pas). D'où les DEUX seules
-- modifications d'objets existants, toutes deux sur `app_data` :
--   • la restrictive `abonnement_requis` (006) laisse aussi passer les lignes
--     d'un vendeur dont l'appelant est membre ACTIF, DEMANDÉ par l'en-tête de
--     la requête (et dont l'accès est ouvert) ;
--   • la restrictive `vrm_lecture_privee` (021, si elle existe — elle existe en
--     production depuis le 21 octobre) reçoit la clause de l'équipe que la 021
--     prévoit elle-même, mot pour mot (§11 bis).
-- La permissive `equipe_lit` borne ensuite ces lignes à la liste blanche.
-- Textes d'avant, pour un retour arrière (sans DROP) :
--   alter policy abonnement_requis on public.app_data
--     using ((select public.vrm_acces_ok()));
--   alter policy vrm_lecture_privee on public.app_data
--     using (owner = (select auth.uid()));
-- `vinted_accounts` n'est PAS touchée.
--
-- LA DEMANDE EXPLICITE : les lignes du vendeur ne sont visibles au membre que
-- dans une requête qui porte l'en-tête `x-vrm-equipe: <vendeur>` (voir §3 bis) —
-- sinon un membre qui est aussi vendeur verrait les colis de l'autre mêlés aux
-- siens dans ses propres écrans.
--
-- L'INVITATION : par l'EMAIL. Elle ne devient effective qu'à l'ACCEPTATION, par
-- une personne connectée dont l'adresse est CONFIRMÉE (`auth.users.
-- email_confirmed_at`) et égale à celle de l'invitation — une identité, jamais
-- une ressemblance. Sans confirmation obligatoire dans Supabase, quelqu'un
-- pourrait sinon créer un compte à l'adresse invitée. Révocation : par le
-- vendeur, ou par le membre lui-même (« quitter ») ; immédiate (relue à chaque
-- requête, aucun cache).
--
-- QUI LIT, QUI ÉCRIT LA TABLE `vrm_equipe` : PERSONNE en direct (RLS activé et
-- forcé, aucune règle, tous les droits retirés à anon, authenticated et
-- service_role). Tout passe par les fonctions, qui prennent l'identité dans
-- le jeton (`auth.uid()`), jamais dans un paramètre.
--
-- Additif et rejouable : `create … if not exists`, `create or replace`, une
-- EMPREINTE de forme (une table d'une forme différente fait tout refuser), et
-- `alter policy` (idempotent). Aucun DROP.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 0. Les fonctions SECURITY DEFINER lisent auth.users : on le vérifie AVANT
--    de créer quoi que ce soit (non mesuré en production : il faut que le
--    propriétaire des fonctions puisse lire l'adresse confirmée).
do $$ begin
  if not pg_catalog.has_table_privilege(current_user, 'auth.users', 'select') then
    raise exception 'vrm_equipe_auth : % ne peut pas lire auth.users (adresse confirmée) — rien n''est installé', current_user;
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at') then
    raise exception 'vrm_equipe_auth : auth.users.email_confirmed_at absente — rien n''est installé';
  end if;
end $$;

-- ── 1. LA TABLE ───────────────────────────────────────────────────────────────
create table if not exists public.vrm_equipe (
  id uuid primary key default gen_random_uuid(),
  vendeur uuid not null,
  email text not null,
  membre uuid,
  role text not null default 'colis',
  statut text not null default 'invitee',
  invite_le timestamptz not null default now(),
  accepte_le timestamptz,
  revoque_le timestamptz,
  constraint vrm_equipe_role check (role in ('colis')),
  constraint vrm_equipe_statut check (statut in ('invitee', 'actif', 'revoquee')),
  constraint vrm_equipe_email check (email = lower(btrim(email)) and email ~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$'),
  constraint vrm_equipe_actif check (statut <> 'actif' or (membre is not null and accepte_le is not null)),
  constraint vrm_equipe_revoque check (statut <> 'revoquee' or revoque_le is not null),
  constraint vrm_equipe_soi check (membre is null or membre <> vendeur)
);

-- L'empreinte de la forme : une table d'une version différente fait TOUT
-- refuser (create if not exists la sauterait en silence).
do $$ declare v text; begin
  select pg_catalog.md5(
      (select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = 'public.vrm_equipe'::regclass and a.attnum > 0 and not a.attisdropped)
      || '|' ||
      (select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = 'public.vrm_equipe'::regclass))
    into v;
  if v is distinct from '948f3ab6286e46db9db58b0041275a79' then
    raise exception 'vrm_equipe_forme : la table public.vrm_equipe existe sous une autre forme (empreinte %) — rien n''est installé', v;
  end if;
end $$;

create unique index if not exists vrm_equipe_une_invitation on public.vrm_equipe (vendeur, email) where statut <> 'revoquee';
create index if not exists vrm_equipe_par_membre on public.vrm_equipe (membre) where statut = 'actif';

alter table public.vrm_equipe enable row level security;
alter table public.vrm_equipe force row level security;
revoke all on public.vrm_equipe from public, anon, authenticated, service_role;

-- ── 2. LA LISTE BLANCHE (pure, aucune lecture) ────────────────────────────────
create or replace function public.vrm_equipe_id_permis(p_id text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_id ~ '^(email_bord_[A-Za-z0-9]{1,40}|harvest_[0-9]{1,20}_label_[A-Za-z0-9]{1,40}|panel_colis_relais|email_track_[a-z0-9]{1,30}_[A-Za-z0-9-]{1,80})$', false)
$$;

-- ── 3. L'APPELANT EST-IL MEMBRE ACTIF DE CE VENDEUR (dont l'accès est ouvert) ?
--    Interne : exécutable par PERSONNE d'autre que le propriétaire (les
--    fonctions ci-dessous l'appellent).
create or replace function public.vrm_equipe_actif(p_vendeur uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and p_vendeur is not null
     and exists (select 1 from public.vrm_equipe e
                  where e.membre = auth.uid() and e.vendeur = p_vendeur
                    and e.statut = 'actif')
     and public.vrm_acces_pour(p_vendeur)
$$;

-- ── 3 bis. LE VENDEUR DEMANDÉ PAR CETTE REQUÊTE — lu par RLS.
--    ⚠️ POURQUOI UN EN-TÊTE ET PAS « TOUS MES VENDEURS » : l'app lit ses lignes
--    SANS filtre de propriétaire (`id=like.email_bord_*`), elle compte sur RLS.
--    Si un membre qui est AUSSI vendeur voyait d'office les colis de l'autre,
--    son propre écran Colis afficherait les bordereaux d'un autre comme les
--    siens — exactement le mélange que Julien craint. Les lignes du vendeur ne
--    sont donc visibles que dans une requête qui le DEMANDE (en-tête
--    `x-vrm-equipe: <vendeur>`, que PostgREST expose dans `request.headers`),
--    et seulement si l'appelant en est membre actif. Sans en-tête : rien ne
--    change pour personne. En-tête illisible ou pas membre : NULL (rien).
create or replace function public.vrm_equipe_vendeur()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v uuid;
begin
  begin
    v := (nullif(pg_catalog.current_setting('request.headers', true), '')::json ->> 'x-vrm-equipe')::uuid;
  exception when others then return null;
  end;
  if v is null or not public.vrm_equipe_actif(v) then return null; end if;
  return v;
end $$;

-- ── 4. INVITER (le vendeur connecté) ─────────────────────────────────────────
create or replace function public.vrm_equipe_inviter(p_email text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  e text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  r public.vrm_equipe;
  n integer;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if e !~ '^[^@\s]{1,64}@[^@\s]{1,190}\.[a-z]{2,24}$' then return jsonb_build_object('ok', false, 'raison', 'email'); end if;
  if exists (select 1 from auth.users u where u.id = moi and pg_catalog.lower(u.email) = e) then
    return jsonb_build_object('ok', false, 'raison', 'soi');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_equipe'), pg_catalog.hashtext(moi::text));
  select * into r from public.vrm_equipe x where x.vendeur = moi and x.email = e and x.statut <> 'revoquee';
  if found then return jsonb_build_object('ok', true, 'id', r.id, 'statut', r.statut, 'deja', true); end if;
  select count(*) into n from public.vrm_equipe x where x.vendeur = moi and x.statut <> 'revoquee';
  if n >= 5 then return jsonb_build_object('ok', false, 'raison', 'plafond'); end if;
  insert into public.vrm_equipe (vendeur, email) values (moi, e) returning * into r;
  return jsonb_build_object('ok', true, 'id', r.id, 'statut', r.statut, 'deja', false);
end $$;

-- ── 5. ACCEPTER (la personne invitée, adresse CONFIRMÉE) ─────────────────────
create or replace function public.vrm_equipe_accepter(p_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); e text;
begin
  if moi is null then return false; end if;
  select pg_catalog.lower(u.email) into e from auth.users u where u.id = moi and u.email_confirmed_at is not null;
  if e is null or e = '' then return false; end if;
  update public.vrm_equipe x set membre = moi, statut = 'actif', accepte_le = pg_catalog.now()
   where x.id = p_id and x.statut = 'invitee' and x.email = e and x.vendeur <> moi;
  return found;
end $$;

-- ── 6. RÉVOQUER (le vendeur) ou QUITTER (le membre) ─────────────────────────
create or replace function public.vrm_equipe_revoquer(p_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return false; end if;
  update public.vrm_equipe x set statut = 'revoquee', revoque_le = pg_catalog.now()
   where x.id = p_id and x.statut <> 'revoquee' and (x.vendeur = moi or x.membre = moi);
  return found;
end $$;

-- ── 7. LISTER : mon équipe (vendeur), mes invitations et mes vendeurs (membre).
create or replace function public.vrm_equipe_lister()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'email', x.email, 'statut', x.statut, 'role', x.role,
                         'invite_le', x.invite_le, 'accepte_le', x.accepte_le, 'revoque_le', x.revoque_le) order by x.invite_le)
                         from public.vrm_equipe x where x.vendeur = auth.uid()), '[]'::jsonb),
    'invitations', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'de', v.email, 'role', x.role, 'invite_le', x.invite_le) order by x.invite_le)
                         from public.vrm_equipe x
                         join auth.users u on u.id = auth.uid() and u.email_confirmed_at is not null and pg_catalog.lower(u.email) = x.email
                         left join auth.users v on v.id = x.vendeur
                        where x.statut = 'invitee' and x.vendeur <> auth.uid()), '[]'::jsonb),
    'membre_de', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'vendeur', x.vendeur, 'de', v.email, 'role', x.role,
                         'acces', public.vrm_acces_pour(x.vendeur)) order by x.accepte_le)
                         from public.vrm_equipe x left join auth.users v on v.id = x.vendeur
                        where x.membre = auth.uid() and x.statut = 'actif'), '[]'::jsonb)) end
$$;

-- ── 8. LA PROJECTION DES COLIS : ventes à expédier et achats à retirer, SANS
--    montant. Une liste LARGE (tout ce qui n'est ni finalisé, ni annulé, ni
--    remboursé, ni « completed ») : la règle « à expédier » reste celle de
--    l'app (`aExpedier`, §11) — ici on ne fait qu'écarter ce qui ne peut pas
--    être un colis à faire. Seules ces clés partent : transaction_id, item_id,
--    title, status, transaction_user_status, date, photo (son adresse) ; plus
--    les identifiants de comptes (login seul, jamais un jeton) et les ventes
--    déjà cochées « posté » / achats « retirés » (les clés, pas les valeurs).
--    NULL = pas membre actif de ce vendeur (ou son accès est coupé).
create or replace function public.vrm_equipe_colis(p_vendeur uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with ok as (select 1 where public.vrm_equipe_actif(p_vendeur)),
  lignes as (
    select (pg_catalog.regexp_match(a.id, '^harvest_([0-9]+)_orders_(sold|purchased)$')) as m, a.data
      from public.app_data a, ok
     where a.owner = p_vendeur and a.id ~ '^harvest_[0-9]+_orders_(sold|purchased)$'),
  ordres as (
    select l.m[1] as uid, l.m[2] as sens, o
      from lignes l, jsonb_array_elements(case when jsonb_typeof(l.data #> '{payload,my_orders}') = 'array'
                                               then l.data #> '{payload,my_orders}' else '[]'::jsonb end) o
     where coalesce(o->>'status', '') !~* '(finalis|annul|rembours)'
       and coalesce(o->>'transaction_user_status', '') <> 'completed'),
  projetes as (
    select r.sens, jsonb_strip_nulls(jsonb_build_object(
             'uid', r.uid,
             'transaction_id', r.o->'transaction_id', 'item_id', r.o->'item_id',
             'title', r.o->'title', 'status', r.o->'status',
             'transaction_user_status', r.o->'transaction_user_status', 'date', r.o->'date',
             'photo', case when jsonb_typeof(r.o->'photo') = 'object' then r.o #> '{photo,url}' end)) as j
      from ordres r)
  select case when not exists (select 1 from ok) then null else jsonb_build_object(
    'ventes', coalesce((select jsonb_agg(p.j) from projetes p where p.sens = 'sold'), '[]'::jsonb),
    'achats', coalesce((select jsonb_agg(p.j) from projetes p where p.sens = 'purchased'), '[]'::jsonb),
    'comptes', coalesce((select jsonb_object_agg(v.vinted_user_id, v.login) from public.vinted_accounts v
                          where v.owner = p_vendeur and v.vinted_user_id is not null), '{}'::jsonb),
    'postes', coalesce((select jsonb_agg(k) from public.app_data a, jsonb_object_keys(
                          case when jsonb_typeof(a.data->'vinted_ship_done') = 'object' then a.data->'vinted_ship_done' else '{}'::jsonb end) k
                          where a.owner = p_vendeur and a.id = 'main'), '[]'::jsonb),
    'retires', coalesce((select jsonb_agg(k) from public.app_data a, jsonb_object_keys(
                          case when jsonb_typeof(a.data->'vinted_pickup_done') = 'object' then a.data->'vinted_pickup_done' else '{}'::jsonb end) k
                          where a.owner = p_vendeur and a.id = 'main'), '[]'::jsonb)) end
$$;

-- ── 9. « Fermer mon compte » (serveur) : ses invitations, comme vendeur ET comme
--    membre. À brancher dans api/compte.js (mode fermer) avant d'ouvrir l'équipe.
create or replace function public.vrm_equipe_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  delete from public.vrm_equipe x where x.vendeur = p_owner or x.membre = p_owner;
  get diagnostics n = row_count;
  return n;
end $$;

-- ── 10. LES DROITS DES FONCTIONS ──────────────────────────────────────────────
revoke all on function public.vrm_equipe_id_permis(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_actif(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_vendeur() from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_inviter(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_accepter(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_revoquer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_lister() from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_colis(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_equipe_effacer(uuid) from public, anon, authenticated, service_role;
-- Lues par RLS sous le rôle de l'appelant : il faut pouvoir les exécuter.
grant execute on function public.vrm_equipe_id_permis(text) to authenticated;
grant execute on function public.vrm_equipe_vendeur() to authenticated;
grant execute on function public.vrm_equipe_inviter(text) to authenticated;
grant execute on function public.vrm_equipe_accepter(uuid) to authenticated;
grant execute on function public.vrm_equipe_revoquer(uuid) to authenticated;
grant execute on function public.vrm_equipe_lister() to authenticated;
grant execute on function public.vrm_equipe_colis(uuid) to authenticated;
grant execute on function public.vrm_equipe_effacer(uuid) to service_role;

-- ── 11. LES RÈGLES SUR app_data ───────────────────────────────────────────────
-- La permissive : LECTURE seule, liste blanche, vendeurs dont il est membre
-- actif. Aucune règle d'écriture n'est ajoutée.
do $$ begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'equipe_lit') then
    create policy equipe_lit on public.app_data for select to authenticated
      using (owner = (select public.vrm_equipe_vendeur()) and public.vrm_equipe_id_permis(id));
  end if;
end $$;
-- La restrictive (006) : le vendeur paie OU l'appelant est membre actif d'un
-- vendeur qui paie, DEMANDÉ par l'en-tête (`vrm_equipe_vendeur` vérifie
-- l'adhésion et l'accès du VENDEUR). Le
-- `with check` ne change pas : une écriture exige toujours l'accès de l'appelant.
alter policy abonnement_requis on public.app_data
  using ((select public.vrm_acces_ok()) or owner = (select public.vrm_equipe_vendeur()));

-- ── 11 bis. LA RESTRICTIVE DE LECTURE DE LA 021 (22 octobre) ─────────────────
-- La 021 (confidentialité) a été appliquée en production le 21 octobre, AVANT
-- celle-ci. Elle a posé `vrm_lecture_privee` : RESTRICTIVE, SELECT, réduite à
-- `owner = auth.uid()` parce que les fonctions de l'équipe n'existaient pas
-- encore (lu sur la vraie base le 22 octobre). Une restrictive s'ajoute (ET) à
-- `equipe_lit` : sans la retoucher, le membre ne lirait RIEN (rejoué le 22
-- octobre sur un Postgres jetable dans l'ordre de la production : 0 ligne au
-- lieu des colis, `audit-equipe-sql.cjs`). La 021 prévoit elle-même la clause de l'équipe
-- quand ces fonctions existent ; on pose ICI LA MÊME EXPRESSION (§11), sans
-- DROP. Sans la 021 : rien à faire (la 021, appliquée après, l'écrira).
do $$ begin
  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'vrm_lecture_privee') then
    alter policy vrm_lecture_privee on public.app_data
      using (owner = (select auth.uid()) or (owner = (select public.vrm_equipe_vendeur()) and public.vrm_equipe_id_permis(id)));
  end if;
end $$;

-- ── 11 ter. AUCUNE AUTRE RESTRICTIVE NE DOIT FERMER LA LECTURE DU MEMBRE ─────
-- Une restrictive de lecture (SELECT ou ALL) qui vise `authenticated` (ou tout
-- le monde) et ne connaît pas l'équipe rendrait la fonction MORTE en silence :
-- l'écran de l'aide dirait « aucun colis ». Plutôt que d'installer une fonction
-- morte, on refuse tout (« rien lu ne vaut pas rien »).
do $$ declare b text; begin
  select pg_catalog.string_agg(p.policyname, ', ' order by p.policyname) into b
    from pg_catalog.pg_policies p
   where p.schemaname = 'public' and p.tablename = 'app_data' and p.permissive = 'RESTRICTIVE'
     and p.cmd in ('SELECT', 'ALL')
     and (p.roles @> array['authenticated']::name[] or p.roles @> array['public']::name[])
     and coalesce(p.qual, '') not like '%vrm_equipe_vendeur%';
  if b is not null then
    raise exception 'vrm_equipe_lecture_bloquee : la restrictive % fermerait la lecture du membre — rien n''est installé', b;
  end if;
end $$;

commit;
