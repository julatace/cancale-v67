-- ════════════════════════════════════════════════════════════════════════════
-- 037 — DE VRAIES TABLES, REMPLIES À CÔTÉ D'app_data (étape 1 sur 4)
--       (11 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien, guidé :
--       docs/passation/2026-11-11-base-tables.md §6).
-- ════════════════════════════════════════════════════════════════════════════
-- POURQUOI : tout VRM vit dans `app_data` (clé-valeur JSONB). Une liste de
-- 2 000 ventes est UNE ligne d'un mégaoctet ; compter, trier, retrouver une
-- vente par son n° de transaction demande de relire la ligne entière. Pour des
-- milliers de vendeurs il faut de vraies tables, une ligne par vente.
--
-- CE QUE FAIT CETTE MIGRATION (et rien d'autre) :
--   · crée 9 tables typées : annonces, ventes, achats, transactions, colis,
--     emails, numeros, numeros_fiches, comptes (+ 3 tables de suivi) ;
--   · pose un déclencheur APRÈS écriture sur `app_data` (et `vinted_accounts`)
--     qui RECOPIE chaque écriture d'une forme connue dans la table typée ;
--   · fournit `vrm_tables_remplir(lot)` : le remplissage initial, par lots,
--     avec reprise (un curseur), rejouable sans effet.
--
-- CE QU'ELLE NE FAIT PAS :
--   · elle ne modifie, ne retire, ne déplace AUCUNE ligne d'`app_data` ni de
--     `vinted_accounts` (le déclencheur est APRÈS : il lit, il n'écrit pas
--     la ligne) ; l'app, l'extension et le serveur lisent exactement comme
--     avant. La bascule des lectures est l'étape 2, plus tard, derrière un
--     réglage.
--   · une ERREUR de recopie ne fait JAMAIS échouer l'écriture d'app_data :
--     elle est rattrapée, notée dans `vrm_projection_ecarts` (raison
--     « erreur »), et la ligne d'app_data est écrite comme avant.
--   · une forme INCONNUE n'écrit rien (la copie précédente reste) et est
--     comptée (`vrm_projection_ecarts`, raison « forme » / « meta_absente »).
--   · un élément SANS IDENTITÉ (annonce sans id, commande sans n° de
--     transaction) n'est jamais rangé par ressemblance : il est sauté et
--     compté (raison « sans_identite »). §5 : jamais par titre.
--
-- LES IDENTITÉS (clés primaires, §5) :
--   annonces       (owner, plateforme, compte, annonce_id)      id d'annonce Vinted
--   ventes/achats  (owner, plateforme, compte, transaction_id)  n° de transaction
--   transactions   (owner, compte, transaction_id)
--   colis          (owner, source) + index n° de transaction, n° de suivi
--                  (un fait par ligne d'origine ; JAMAIS fondus entre eux ici :
--                  le rapprochement se fera par ces identités, étape 2)
--   emails         (owner, source)  la ligne `email_*` d'origine
--   numeros        (owner, cle_num) APPEND-ONLY : un N° n'est jamais modifié
--                  ni retiré (écrit sur un carton) ; `cle_num` = la même clé
--                  que l'app (`vrm_cle_num`, migration 013).
--   numeros_fiches (owner, cle_fiche) miroir de `vinted_annonce_numeros`
--   comptes        (owner, plateforme, compte_id) — JAMAIS un jeton.
--
-- DROITS : chaque table a la RLS, UNE politique permissive (lecture,
-- owner = (select auth.uid()), comme la 036) ; aucune écriture permise aux
-- rôles anon / authenticated (seul le déclencheur écrit). Les fonctions de
-- recopie et de remplissage ne sont exécutables ni par anon ni par
-- authenticated (elles prennent un `owner` : un vendeur ne doit jamais
-- pouvoir écrire chez un autre).
--
-- COUPER LA RECOPIE (sans rien perdre) :
--   alter table public.app_data disable trigger vrm_projection_ecrit;
--   alter table public.app_data disable trigger vrm_projection_renomme;
--   alter table public.app_data disable trigger vrm_projection_efface;
--   alter table public.vinted_accounts disable trigger vrm_comptes_projection;
-- TOUT RETIRER : bloc « Annuler la 037 » à la fin du pas-à-pas (§6 du récit).
-- Prouvé sur PostgreSQL jetable : scripts/audit-tables-typees-sql.cjs.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';

-- 0. Prérequis : la 004 (colonne meta) et la 013 (clé des N°).
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'app_data' and column_name = 'meta') then
    raise exception 'vrm_tables_037 : app_data.meta absente (appliquer la 004 d''abord) — rien n''est changé';
  end if;
  if to_regprocedure('public.vrm_cle_num(jsonb)') is null then
    raise exception 'vrm_tables_037 : vrm_cle_num absente (appliquer la 013 d''abord) — rien n''est changé';
  end if;
  if to_regclass('public.vinted_accounts') is null then
    raise exception 'vrm_tables_037 : vinted_accounts absente — rien n''est changé';
  end if;
end $$;

-- ── 1. Lecture sûre d'une valeur JSON (jamais d'erreur : illisible ⇒ null) ──
create or replace function public.vrm_t_texte(v jsonb) returns text
language sql immutable set search_path = '' as $$
  select case when v is null or jsonb_typeof(v) in ('null', 'object', 'array') then null
              else nullif(btrim(v #>> '{}'), '') end
$$;
-- Le prix Vinted est un OBJET {amount, currency_code} ; accepté aussi : nombre, texte « 25,50 ».
create or replace function public.vrm_t_montant(v jsonb) returns numeric
language sql immutable set search_path = '' as $$
  select case when s ~ '^-?[0-9]{1,9}([.,][0-9]{1,6})?$' then replace(s, ',', '.')::numeric end
    from (select public.vrm_t_texte(case when jsonb_typeof(v) = 'object' then v -> 'amount' else v end) s) z
$$;
create or replace function public.vrm_t_devise(v jsonb) returns text
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'object'
              then upper(public.vrm_t_texte(coalesce(v -> 'currency_code', v -> 'currency'))) end
$$;
create or replace function public.vrm_t_entier(v jsonb) returns integer
language sql immutable set search_path = '' as $$
  select case when s ~ '^-?[0-9]{1,9}$' then s::integer end from (select public.vrm_t_texte(v) s) z
$$;
create or replace function public.vrm_t_bool(v jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(v) = 'boolean' then (v #>> '{}')::boolean end
$$;
-- Date : secondes ou millisecondes depuis 1970, ou texte ISO 8601. Autre chose ⇒ null
-- (une date française « 14 novembre » n'est PAS devinée : elle reste dans la colonne *_texte).
create or replace function public.vrm_t_date(v jsonb) returns timestamptz
language plpgsql stable set search_path = '' as $$
declare s text; x numeric;
begin
  if v is null then return null; end if;
  if jsonb_typeof(v) = 'number' then
    x := (v #>> '{}')::numeric;
    if x between 946684800 and 4102444800 then return to_timestamp(x::double precision); end if;
    if x between 946684800000 and 4102444800000 then return to_timestamp((x / 1000)::double precision); end if;
    return null;
  end if;
  s := public.vrm_t_texte(v);
  if s is null or s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([T ][0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]+)?)?)?(Z|[+-][0-9]{2}(:?[0-9]{2})?)?$' then
    return null;
  end if;
  begin return s::timestamptz; exception when others then return null; end;
end $$;

-- ── 2. Les familles d'app_data recopiées (le reste : « hors périmètre ») ──
create or replace function public.vrm_t_famille(p_id text) returns text
language sql immutable set search_path = '' as $$
  select case
    when p_id = 'main' then 'main'
    when p_id ~ '^harvest_[0-9]+_listings$' then 'annonces_vinted'
    when p_id ~ '^harvest_[0-9]+_orders_sold$' then 'ventes_vinted'
    when p_id ~ '^harvest_[0-9]+_orders_purchased$' then 'achats_vinted'
    when p_id ~ '^harvest_[0-9]+_txn_.+$' then 'transactions_vinted'
    when p_id ~ '^harvest_[0-9]+_label_latest$' then null      -- « le dernier capté » : pas une identité
    when p_id ~ '^harvest_[0-9]+_label_.+$' then 'bordereaux_vinted'
    when p_id ~ '^email_bord_.+$' then 'email_bordereau'
    when p_id ~ '^email_track_[a-z0-9]+_.+$' then 'email_suivi'
    when p_id ~ '^email_(invoice|achat|texte|sale|reception|offer|inconnu|final)_.+$' then 'email'
  end
$$;
-- Les familles dont la recopie lit `data` (les autres lisent `meta`, jamais le PDF : §4.4).
create or replace function public.vrm_t_lit_data(p_famille text) returns boolean
language sql immutable set search_path = '' as $$
  select p_famille in ('main', 'annonces_vinted', 'ventes_vinted', 'achats_vinted')
$$;

-- ── 3. Les tables ──
create table if not exists public.annonces (
  owner uuid not null,
  plateforme text not null check (plateforme in ('vinted')),
  compte text not null,
  annonce_id text not null,
  titre text, prix numeric, devise text, marque text, taille text, etat text,
  url text, photo text, n_photos integer, vues integer, favoris integer,
  masquee boolean, fermee boolean, brouillon boolean, reservee boolean,
  cree_le timestamptz, num_ecrit jsonb,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, plateforme, compte, annonce_id));
create index if not exists annonces_owner_annonce on public.annonces (owner, annonce_id);

create table if not exists public.ventes (
  owner uuid not null,
  plateforme text not null check (plateforme in ('vinted')),
  compte text not null,
  transaction_id text not null,
  item_id text, titre text, prix numeric, devise text,
  statut text, statut_utilisateur text,
  date_commande timestamptz, date_texte text,
  conversation_id text, photo text,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, plateforme, compte, transaction_id));
create index if not exists ventes_owner_item on public.ventes (owner, item_id);
create index if not exists ventes_owner_date on public.ventes (owner, date_commande desc);

-- Même forme, mêmes index (owner, item_id) et (owner, date_commande desc).
create table if not exists public.achats (like public.ventes including all);

create table if not exists public.transactions (
  owner uuid not null,
  compte text not null,
  transaction_id text not null,
  item_id text, statut_code integer, statut_titre text,
  statut_maj_le timestamptz, envoi_statut text,
  lu_le timestamptz,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, compte, transaction_id));
create index if not exists transactions_owner_statut on public.transactions (owner, statut_code);
create index if not exists transactions_owner_item on public.transactions (owner, item_id);

create table if not exists public.colis (
  owner uuid not null,
  source text not null,                    -- l'id de la ligne app_data d'origine
  origine text not null check (origine in ('vinted_bordereau', 'email_bordereau', 'email_suivi')),
  compte text, transaction_id text, suivi text, transporteur text,
  statut text, statut_libelle text, sens text,
  code_retrait text, code_retrait2 text, lieu text, limite_texte text,
  numero_lu text, article text,
  a_pdf boolean not null default false,    -- la ligne porte un PDF ; le PDF lui-même reste dans app_data
  recu_le timestamptz, retire_le timestamptz, lu_le timestamptz,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, source));
create index if not exists colis_owner_tx on public.colis (owner, transaction_id) where transaction_id is not null;
create index if not exists colis_owner_suivi on public.colis (owner, suivi) where suivi is not null;

create table if not exists public.emails (
  owner uuid not null,
  source text not null,
  famille text not null,
  type text, transaction_id text, suivi text, transporteur text,
  sujet text, a_pdf boolean not null default false,
  recu_le timestamptz,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, source));
create index if not exists emails_owner_recu on public.emails (owner, recu_le desc);
create index if not exists emails_owner_tx on public.emails (owner, transaction_id) where transaction_id is not null;

create table if not exists public.numeros (
  owner uuid not null,
  cle_num text not null,
  valeur text not null,                    -- la première écriture vue (« 007 », « B125 »)
  vu_le timestamptz not null default now(),
  primary key (owner, cle_num));

create table if not exists public.numeros_fiches (
  owner uuid not null,
  cle_fiche text not null,                 -- la clé de `vinted_annonce_numeros`, telle quelle
  cle_num text not null,
  numero text,
  manuel_le text,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, cle_fiche));
create index if not exists numeros_fiches_owner_num on public.numeros_fiches (owner, cle_num);

create table if not exists public.comptes (
  owner uuid not null,
  plateforme text not null check (plateforme in ('vinted')),
  compte_id text not null,
  login text, domaine text,
  empreinte text not null,
  projete_le timestamptz not null default now(),
  primary key (owner, plateforme, compte_id));

-- Suivi : chaque ligne d'origine recopiée (avec sa date de lecture), les écarts, le curseur.
create table if not exists public.vrm_projection_sources (
  owner uuid not null,
  source text not null,
  famille text not null,
  lu_le timestamptz,
  n integer,
  projete_le timestamptz not null default now(),
  primary key (owner, source));
create table if not exists public.vrm_projection_ecarts (
  owner uuid not null,
  source text not null,
  famille text not null,
  raison text not null,                    -- forme · meta_absente · sans_identite · erreur
  n integer not null default 1,
  detail text,
  vu_le timestamptz not null default now(),
  primary key (owner, source, raison));
create table if not exists public.vrm_projection_remplissage (
  cle integer primary key default 1 check (cle = 1),
  dernier_owner uuid, dernier_id text,
  lignes bigint not null default 0,
  commence_le timestamptz, fini_le timestamptz);

-- ── 4. Droits : lecture de SES lignes, rien d'autre ──
do $$
declare t text;
begin
  foreach t in array array['annonces', 'ventes', 'achats', 'transactions', 'colis', 'emails', 'numeros',
                           'numeros_fiches', 'comptes', 'vrm_projection_sources', 'vrm_projection_ecarts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select on public.%I to service_role', t);
    end if;
    execute format('drop policy if exists vrm_proprietaire_lit on public.%I', t);
    execute format('create policy vrm_proprietaire_lit on public.%I as permissive for select to authenticated using (owner = (select auth.uid()))', t);
  end loop;
  alter table public.vrm_projection_remplissage enable row level security;
  revoke all on public.vrm_projection_remplissage from public, anon, authenticated;
end $$;

-- ── 5. Un N° n'est jamais modifié ni retiré (seul l'effacement d'un vendeur, par sa fonction) ──
create or replace function public.vrm_numeros_immuable() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and current_setting('vrm.effacer_vendeur', true) = old.owner::text then return old; end if;
  raise exception using errcode = 'P0001', message = 'vrm_numero_immuable',
    detail = 'un numéro est écrit sur un carton : il n''est jamais modifié ni retiré';
end $$;
create or replace function public.vrm_numeros_immuable_tout() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception using errcode = 'P0001', message = 'vrm_numero_immuable', detail = 'truncate refusé sur numeros';
end $$;
drop trigger if exists vrm_numeros_immuable on public.numeros;
create trigger vrm_numeros_immuable before update or delete on public.numeros
  for each row execute function public.vrm_numeros_immuable();
drop trigger if exists vrm_numeros_immuable_tout on public.numeros;
create trigger vrm_numeros_immuable_tout before truncate on public.numeros
  for each statement execute function public.vrm_numeros_immuable_tout();

-- ── 6. Écarts et sources ──
create or replace function public.vrm_t_ecart(p_owner uuid, p_source text, p_famille text, p_raison text, p_n integer, p_detail text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.vrm_projection_ecarts (owner, source, famille, raison, n, detail, vu_le)
  values (p_owner, p_source, p_famille, p_raison, p_n, left(p_detail, 300), now())
  on conflict (owner, source, raison) do update
    set n = excluded.n, detail = excluded.detail, famille = excluded.famille, vu_le = now()
$$;
-- La ligne a été lue dans une forme connue : ses écarts de forme / erreur tombent,
-- « sans identité » est remis au compte du moment (0 ⇒ retiré).
create or replace function public.vrm_t_lue(p_owner uuid, p_source text, p_famille text, p_lu timestamptz, p_n integer, p_sans integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.vrm_projection_ecarts
   where owner = p_owner and source = p_source and raison in ('forme', 'meta_absente', 'erreur');
  if p_sans is not null then
    if p_sans > 0 then perform public.vrm_t_ecart(p_owner, p_source, p_famille, 'sans_identite', p_sans);
    else delete from public.vrm_projection_ecarts where owner = p_owner and source = p_source and raison = 'sans_identite';
    end if;
  end if;
  insert into public.vrm_projection_sources (owner, source, famille, lu_le, n, projete_le)
  values (p_owner, p_source, p_famille, p_lu, p_n, now())
  on conflict (owner, source) do update
    set famille = excluded.famille, lu_le = coalesce(excluded.lu_le, vrm_projection_sources.lu_le),
        n = coalesce(excluded.n, vrm_projection_sources.n), projete_le = now();
end $$;

-- ── 7. Ventes / achats : une liste `my_orders` ⇒ une ligne par n° de transaction ──
create or replace function public.vrm_t_commandes(p_table text, p_owner uuid, p_compte text, liste jsonb, out n integer, out sans integer)
language plpgsql security definer set search_path = '' as $$
begin
  -- Une passe : l'identité et l'empreinte de chaque commande. Seules les commandes
  -- NEUVES ou CHANGÉES sont relues champ par champ (une ligne de 2 000 ventes dont
  -- une seule change ne recalcule qu'une ligne).
  select count(distinct tx), count(*) filter (where tx is null) into n, sans
    from (select public.vrm_t_texte(o -> 'transaction_id') tx from jsonb_array_elements(liste) e(o)) z;
  execute format('delete from public.%I c where c.owner = $1 and c.plateforme = ''vinted'' and c.compte = $2
                   and not exists (select 1 from jsonb_array_elements($3) e(o)
                                   where public.vrm_t_texte(o -> ''transaction_id'') = c.transaction_id)', p_table)
    using p_owner, p_compte, liste;
  execute format($f$
    insert into public.%1$I as c (owner, plateforme, compte, transaction_id, item_id, titre, prix, devise, statut,
                                  statut_utilisateur, date_commande, date_texte, conversation_id, photo, empreinte)
    select $1, 'vinted', $2, tx,
           coalesce(public.vrm_t_texte(o -> 'item_id'), public.vrm_t_texte(o -> 'item' -> 'id')),
           public.vrm_t_texte(o -> 'title'), public.vrm_t_montant(o -> 'price'), public.vrm_t_devise(o -> 'price'),
           public.vrm_t_texte(o -> 'status'), public.vrm_t_texte(o -> 'transaction_user_status'),
           public.vrm_t_date(o -> 'date'), left(public.vrm_t_texte(o -> 'date'), 80),
           public.vrm_t_texte(o -> 'conversation_id'),
           coalesce(public.vrm_t_texte(o -> 'photo' -> 'url'), public.vrm_t_texte(o -> 'photo')),
           emp
      from (select distinct on (l.tx) l.tx, l.o, l.emp from (select public.vrm_t_texte(o -> 'transaction_id') tx, o, md5(o::text) emp, i from jsonb_array_elements($3) with ordinality e(o, i)) l where l.tx is not null order by l.tx, l.i) z
     where not exists (select 1 from public.%1$I x where x.owner = $1 and x.plateforme = 'vinted' and x.compte = $2
                          and x.transaction_id = z.tx and x.empreinte = z.emp)
    on conflict (owner, plateforme, compte, transaction_id) do update set
      item_id = excluded.item_id, titre = excluded.titre, prix = excluded.prix, devise = excluded.devise,
      statut = excluded.statut, statut_utilisateur = excluded.statut_utilisateur,
      date_commande = excluded.date_commande, date_texte = excluded.date_texte,
      conversation_id = excluded.conversation_id, photo = excluded.photo,
      empreinte = excluded.empreinte, projete_le = now()
  $f$, p_table) using p_owner, p_compte, liste;
end $$;

-- ── 8. LA RECOPIE d'une ligne d'app_data (déclencheur ET remplissage : la même) ──
-- Rend : ok · inconnu · hors · efface.
create or replace function public.vrm_projeter(p_owner uuid, p_id text, p_data jsonb, p_meta jsonb, p_avant jsonb, p_supprime boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare
  fam text := public.vrm_t_famille(p_id);
  v_compte text := substring(p_id from '^harvest_([0-9]+)_');
  v_cle text;
  liste jsonb;
  v_sans integer;
  v_n integer;
  v_lu timestamptz;
  v_mal text := '';
  v_propre boolean;
  r record;
begin
  if fam is null then return 'hors'; end if;

  -- La ligne d'origine disparaît : sa copie aussi (sauf les N°, jamais retirés).
  if p_supprime then
    if fam = 'annonces_vinted' then delete from public.annonces where owner = p_owner and plateforme = 'vinted' and compte = v_compte;
    elsif fam = 'ventes_vinted' then delete from public.ventes where owner = p_owner and plateforme = 'vinted' and compte = v_compte;
    elsif fam = 'achats_vinted' then delete from public.achats where owner = p_owner and plateforme = 'vinted' and compte = v_compte;
    elsif fam = 'transactions_vinted' then
      delete from public.transactions where owner = p_owner and compte = v_compte
         and transaction_id = substring(p_id from '^harvest_[0-9]+_txn_(.+)$');
    elsif fam in ('bordereaux_vinted', 'email_bordereau', 'email_suivi', 'email') then
      delete from public.colis where owner = p_owner and source = p_id;
      delete from public.emails where owner = p_owner and source = p_id;
    elsif fam = 'main' then delete from public.numeros_fiches where owner = p_owner;
    end if;
    delete from public.vrm_projection_sources where owner = p_owner and source = p_id;
    delete from public.vrm_projection_ecarts where owner = p_owner and source = p_id;
    return 'efface';
  end if;

  -- « Liste inchangée ⇒ rien à recopier » n'est permis que si la copie d'avant est
  -- PROPRE (déjà recopiée, ni erreur ni forme inconnue en cours) : sinon une recopie
  -- ratée ne se rattraperait jamais par une réécriture à l'identique.
  v_propre := p_avant is not null
    and exists (select 1 from public.vrm_projection_sources s where s.owner = p_owner and s.source = p_id)
    and not exists (select 1 from public.vrm_projection_ecarts e where e.owner = p_owner and e.source = p_id
                     and e.raison in ('forme', 'meta_absente', 'erreur'));

  -- Familles lues par `meta` (004) : sans meta, rien n'est deviné.
  if not public.vrm_t_lit_data(fam) and (p_meta is null or jsonb_typeof(p_meta) <> 'object') then
    perform public.vrm_t_ecart(p_owner, p_id, fam, 'meta_absente', 1);
    return 'inconnu';
  end if;
  if public.vrm_t_lit_data(fam) and (p_data is null or jsonb_typeof(p_data) <> 'object') then
    perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'data n''est pas un objet');
    return 'inconnu';
  end if;

  -- ANNONCES (harvest_{uid}_listings, payload.items) — identité : l'id d'annonce.
  if fam = 'annonces_vinted' then
    liste := p_data -> 'payload' -> 'items';
    if jsonb_typeof(liste) is distinct from 'array' then
      perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'payload.items absent');
      return 'inconnu';
    end if;
    v_lu := public.vrm_t_date(p_data -> 'capturedAt');
    if v_propre and (p_avant -> 'payload' -> 'items') = liste then
      perform public.vrm_t_lue(p_owner, p_id, fam, v_lu, null, null);
      return 'ok';
    end if;
    select count(distinct aid), count(*) filter (where aid is null) into v_n, v_sans
      from (select public.vrm_t_texte(it -> 'id') aid from jsonb_array_elements(liste) e(it)) z;
    delete from public.annonces a where a.owner = p_owner and a.plateforme = 'vinted' and a.compte = v_compte
       and not exists (select 1 from jsonb_array_elements(liste) e(it) where public.vrm_t_texte(it -> 'id') = a.annonce_id);
    insert into public.annonces as a (owner, plateforme, compte, annonce_id, titre, prix, devise, marque, taille, etat,
                                      url, photo, n_photos, vues, favoris, masquee, fermee, brouillon, reservee,
                                      cree_le, num_ecrit, empreinte)
    select p_owner, 'vinted', v_compte, aid,
           public.vrm_t_texte(it -> 'title'), public.vrm_t_montant(it -> 'price'), public.vrm_t_devise(it -> 'price'),
           coalesce(public.vrm_t_texte(it -> 'brand_title'), public.vrm_t_texte(it -> 'brand')),
           coalesce(public.vrm_t_texte(it -> 'size_title'), public.vrm_t_texte(it -> 'size')),
           public.vrm_t_texte(it -> 'status'), public.vrm_t_texte(it -> 'url'),
           coalesce(public.vrm_t_texte(it -> 'photo' -> 'url'), public.vrm_t_texte(it -> 'photo')),
           public.vrm_t_entier(it -> 'nPhotos'), public.vrm_t_entier(it -> 'view_count'),
           coalesce(public.vrm_t_entier(it -> 'favourite_count'), public.vrm_t_entier(it -> 'favourites_count')),
           public.vrm_t_bool(it -> 'is_hidden'), public.vrm_t_bool(it -> 'is_closed'),
           public.vrm_t_bool(it -> 'is_draft'), public.vrm_t_bool(it -> 'is_reserved'),
           public.vrm_t_date(it -> 'created_at_ts'),
           case when jsonb_typeof(it -> 'numEcrit') in ('object', 'string', 'number') then it -> 'numEcrit' end,
           emp
      from (select distinct on (l.aid) l.aid, l.it, l.emp from (select public.vrm_t_texte(it -> 'id') aid, it, md5(it::text) emp, i from jsonb_array_elements(liste) with ordinality e(it, i)) l where l.aid is not null order by l.aid, l.i) z
     where not exists (select 1 from public.annonces x where x.owner = p_owner and x.plateforme = 'vinted'
                          and x.compte = v_compte and x.annonce_id = z.aid and x.empreinte = z.emp)
    on conflict (owner, plateforme, compte, annonce_id) do update set
      titre = excluded.titre, prix = excluded.prix, devise = excluded.devise, marque = excluded.marque,
      taille = excluded.taille, etat = excluded.etat, url = excluded.url, photo = excluded.photo,
      n_photos = excluded.n_photos, vues = excluded.vues, favoris = excluded.favoris,
      masquee = excluded.masquee, fermee = excluded.fermee, brouillon = excluded.brouillon,
      reservee = excluded.reservee, cree_le = excluded.cree_le, num_ecrit = excluded.num_ecrit,
      empreinte = excluded.empreinte, projete_le = now();
    perform public.vrm_t_lue(p_owner, p_id, fam, v_lu, v_n, v_sans);
    return 'ok';
  end if;

  -- VENTES / ACHATS (payload.my_orders) — identité : le n° de transaction.
  if fam in ('ventes_vinted', 'achats_vinted') then
    liste := p_data -> 'payload' -> 'my_orders';
    if jsonb_typeof(liste) is distinct from 'array' then
      perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'payload.my_orders absent');
      return 'inconnu';
    end if;
    v_lu := public.vrm_t_date(p_data -> 'capturedAt');
    if v_propre and (p_avant -> 'payload' -> 'my_orders') = liste then
      perform public.vrm_t_lue(p_owner, p_id, fam, v_lu, null, null);
      return 'ok';
    end if;
    select * into r from public.vrm_t_commandes(case fam when 'ventes_vinted' then 'ventes' else 'achats' end, p_owner, v_compte, liste);
    perform public.vrm_t_lue(p_owner, p_id, fam, v_lu, r.n, r.sans);
    return 'ok';
  end if;

  -- TRANSACTIONS (harvest_{uid}_txn_{tx}, par meta : 004 y recopie payload.transaction).
  if fam = 'transactions_vinted' then
    v_cle := substring(p_id from '^harvest_[0-9]+_txn_(.+)$');
    if public.vrm_t_texte(p_meta -> 'id') is distinct from v_cle then
      perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'payload.transaction.id absent ou autre que l''id de la ligne');
      return 'inconnu';
    end if;
    insert into public.transactions as t (owner, compte, transaction_id, item_id, statut_code, statut_titre,
                                          statut_maj_le, envoi_statut, lu_le, empreinte)
    values (p_owner, v_compte, v_cle, public.vrm_t_texte(p_meta -> 'item_id'), public.vrm_t_entier(p_meta -> 'status'),
            public.vrm_t_texte(p_meta -> 'status_title'), public.vrm_t_date(p_meta -> 'status_updated_at'),
            public.vrm_t_texte(p_meta -> 'ship_status_title'), public.vrm_t_date(p_meta -> 'capturedAt'), md5(p_meta::text))
    on conflict (owner, compte, transaction_id) do update set
      item_id = excluded.item_id, statut_code = excluded.statut_code, statut_titre = excluded.statut_titre,
      statut_maj_le = excluded.statut_maj_le, envoi_statut = excluded.envoi_statut, lu_le = excluded.lu_le,
      empreinte = excluded.empreinte, projete_le = now()
     where t.empreinte is distinct from excluded.empreinte;
    perform public.vrm_t_lue(p_owner, p_id, fam, public.vrm_t_date(p_meta -> 'capturedAt'), 1, null);
    return 'ok';
  end if;

  -- BORDEREAU VINTED (harvest_{uid}_label_{tx}) : le PDF n'est jamais lu, seulement `_pdf`.
  if fam = 'bordereaux_vinted' then
    v_cle := substring(p_id from '^harvest_[0-9]+_label_(.+)$');
    if public.vrm_t_texte(p_meta -> 'tx') is not null and public.vrm_t_texte(p_meta -> 'tx') <> v_cle then
      perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, 'tx de la ligne différent de son id');
      return 'inconnu';
    end if;
    insert into public.colis as c (owner, source, origine, compte, transaction_id, a_pdf, lu_le, empreinte)
    values (p_owner, p_id, 'vinted_bordereau', v_compte, v_cle, coalesce(public.vrm_t_bool(p_meta -> '_pdf'), false),
            public.vrm_t_date(p_meta -> 'capturedAt'), md5(p_meta::text))
    on conflict (owner, source) do update set
      origine = excluded.origine, compte = excluded.compte, transaction_id = excluded.transaction_id,
      a_pdf = excluded.a_pdf, lu_le = excluded.lu_le, empreinte = excluded.empreinte, projete_le = now()
     where c.empreinte is distinct from excluded.empreinte;
    perform public.vrm_t_lue(p_owner, p_id, fam, public.vrm_t_date(p_meta -> 'capturedAt'), 1, null);
    return 'ok';
  end if;

  -- E-MAILS (email_*) : un e-mail rangé = une ligne ; bordereau et suivi sont aussi des colis.
  if fam in ('email_bordereau', 'email_suivi', 'email') then
    insert into public.emails as m (owner, source, famille, type, transaction_id, suivi, transporteur, sujet, a_pdf, recu_le, empreinte)
    values (p_owner, p_id, substring(p_id from '^email_([a-z]+)_'), public.vrm_t_texte(p_meta -> 'type'),
            public.vrm_t_texte(p_meta -> 'transaction'), public.vrm_t_texte(p_meta -> 'suivi'),
            coalesce(public.vrm_t_texte(p_meta -> 'carrier'), public.vrm_t_texte(p_meta -> 'transporteur')),
            left(public.vrm_t_texte(p_meta -> 'subject'), 300), coalesce(public.vrm_t_bool(p_meta -> '_pdf'), false),
            coalesce(public.vrm_t_date(p_meta -> 'emailAt'), public.vrm_t_date(p_meta -> 'receivedAt')), md5(p_meta::text))
    on conflict (owner, source) do update set
      famille = excluded.famille, type = excluded.type, transaction_id = excluded.transaction_id, suivi = excluded.suivi,
      transporteur = excluded.transporteur, sujet = excluded.sujet, a_pdf = excluded.a_pdf, recu_le = excluded.recu_le,
      empreinte = excluded.empreinte, projete_le = now()
     where m.empreinte is distinct from excluded.empreinte;
    if fam = 'email_bordereau' then
      if public.vrm_t_texte(p_meta -> 'transaction') is null then
        v_mal := 'bordereau sans n° de transaction';
      else
        insert into public.colis as c (owner, source, origine, compte, transaction_id, suivi, transporteur, numero_lu,
                                       article, limite_texte, a_pdf, recu_le, empreinte)
        values (p_owner, p_id, 'email_bordereau', coalesce(public.vrm_t_texte(p_meta -> 'uid'), public.vrm_t_texte(p_meta -> 'account')),
                public.vrm_t_texte(p_meta -> 'transaction'), public.vrm_t_texte(p_meta -> 'suivi'),
                public.vrm_t_texte(p_meta -> 'transporteur'), public.vrm_t_texte(p_meta -> 'numero'),
                left(public.vrm_t_texte(p_meta -> 'article'), 300), public.vrm_t_texte(p_meta -> 'dateLimite'),
                coalesce(public.vrm_t_bool(p_meta -> '_pdf'), false), public.vrm_t_date(p_meta -> 'receivedAt'), md5(p_meta::text))
        on conflict (owner, source) do update set
          compte = excluded.compte, transaction_id = excluded.transaction_id, suivi = excluded.suivi,
          transporteur = excluded.transporteur, numero_lu = excluded.numero_lu, article = excluded.article,
          limite_texte = excluded.limite_texte, a_pdf = excluded.a_pdf, recu_le = excluded.recu_le,
          empreinte = excluded.empreinte, projete_le = now()
         where c.empreinte is distinct from excluded.empreinte;
      end if;
    elsif fam = 'email_suivi' then
      if public.vrm_t_texte(p_meta -> 'suivi') is null then
        v_mal := 'suivi sans n° de suivi';
      else
        insert into public.colis as c (owner, source, origine, suivi, transporteur, statut, statut_libelle, sens,
                                       code_retrait, code_retrait2, lieu, limite_texte, recu_le, retire_le, empreinte)
        values (p_owner, p_id, 'email_suivi', public.vrm_t_texte(p_meta -> 'suivi'),
                coalesce(public.vrm_t_texte(p_meta -> 'carrier'), substring(p_id from '^email_track_([a-z0-9]+)_')),
                public.vrm_t_texte(p_meta -> 'status'), public.vrm_t_texte(p_meta -> 'statusLabel'), public.vrm_t_texte(p_meta -> 'sens'),
                public.vrm_t_texte(p_meta -> 'code'), public.vrm_t_texte(p_meta -> 'code2'), left(public.vrm_t_texte(p_meta -> 'lieu'), 300),
                public.vrm_t_texte(p_meta -> 'limite'),
                coalesce(public.vrm_t_date(p_meta -> 'emailAt'), public.vrm_t_date(p_meta -> 'receivedAt')),
                public.vrm_t_date(p_meta -> 'retireLe'), md5(p_meta::text))
        on conflict (owner, source) do update set
          suivi = excluded.suivi, transporteur = excluded.transporteur, statut = excluded.statut,
          statut_libelle = excluded.statut_libelle, sens = excluded.sens, code_retrait = excluded.code_retrait,
          code_retrait2 = excluded.code_retrait2, lieu = excluded.lieu, limite_texte = excluded.limite_texte,
          recu_le = excluded.recu_le, retire_le = excluded.retire_le, empreinte = excluded.empreinte, projete_le = now()
         where c.empreinte is distinct from excluded.empreinte;
      end if;
    end if;
    perform public.vrm_t_lue(p_owner, p_id, fam, public.vrm_t_date(p_meta -> 'receivedAt'), 1, null);
    if v_mal <> '' then
      -- L'e-mail est rangé ; le colis, sans identité, ne l'est pas (et la copie d'avant tombe).
      delete from public.colis where owner = p_owner and source = p_id;
      perform public.vrm_t_ecart(p_owner, p_id, fam, 'sans_identite', 1, v_mal);
    end if;
    return 'ok';
  end if;

  -- MAIN : le pool des N° (append-only) et les fiches (miroir).
  if fam = 'main' then
    if p_data ? 'vinted_used_numeros' and jsonb_typeof(p_data -> 'vinted_used_numeros') is distinct from 'array' then
      v_mal := 'vinted_used_numeros n''est pas une liste';
    elsif not v_propre or (p_avant -> 'vinted_used_numeros') is distinct from (p_data -> 'vinted_used_numeros') then
      insert into public.numeros (owner, cle_num, valeur)
      select distinct on (c) p_owner, c, v
        from (select public.vrm_cle_num(e) c, btrim(e #>> '{}') v, i
                from jsonb_array_elements(case when jsonb_typeof(p_data -> 'vinted_used_numeros') = 'array'
                                               then p_data -> 'vinted_used_numeros' else '[]'::jsonb end) with ordinality x(e, i)) z
       where c is not null and c <> ''
       order by c, i
      on conflict (owner, cle_num) do nothing;
    end if;
    if p_data ? 'vinted_annonce_numeros' and jsonb_typeof(p_data -> 'vinted_annonce_numeros') is distinct from 'object' then
      v_mal := ltrim(v_mal || ' · vinted_annonce_numeros n''est pas un objet', ' ·');
    elsif not v_propre or (p_avant -> 'vinted_annonce_numeros') is distinct from (p_data -> 'vinted_annonce_numeros') then
      delete from public.numeros_fiches f
       where f.owner = p_owner
         and not exists (select 1 from jsonb_each(case when jsonb_typeof(p_data -> 'vinted_annonce_numeros') = 'object'
                                                       then p_data -> 'vinted_annonce_numeros' else '{}'::jsonb end) e(k, ov)
                          where e.k = f.cle_fiche and jsonb_typeof(ov) = 'object'
                            and coalesce(public.vrm_cle_num(ov -> 'numero'), '') <> '');
      insert into public.numeros_fiches as f (owner, cle_fiche, cle_num, numero, manuel_le, empreinte)
      select p_owner, k, public.vrm_cle_num(ov -> 'numero'), btrim(ov ->> 'numero'), public.vrm_t_texte(ov -> 'manuelAt'), md5(ov::text)
        from jsonb_each(case when jsonb_typeof(p_data -> 'vinted_annonce_numeros') = 'object'
                             then p_data -> 'vinted_annonce_numeros' else '{}'::jsonb end) e(k, ov)
       where jsonb_typeof(ov) = 'object' and coalesce(public.vrm_cle_num(ov -> 'numero'), '') <> ''
      on conflict (owner, cle_fiche) do update set
        cle_num = excluded.cle_num, numero = excluded.numero, manuel_le = excluded.manuel_le,
        empreinte = excluded.empreinte, projete_le = now()
       where f.empreinte is distinct from excluded.empreinte;
    end if;
    perform public.vrm_t_lue(p_owner, p_id, fam, null, null, null);
    if v_mal <> '' then
      perform public.vrm_t_ecart(p_owner, p_id, fam, 'forme', 1, v_mal);
      return 'inconnu';
    end if;
    return 'ok';
  end if;
  return 'hors';
end $$;

-- L'enveloppe : une erreur de recopie est NOTÉE, jamais renvoyée à l'écriture d'app_data.
create or replace function public.vrm_projeter_sur(p_owner uuid, p_id text, p_data jsonb, p_meta jsonb, p_avant jsonb, p_supprime boolean)
returns text language plpgsql security definer set search_path = '' as $$
declare v_etat text; v_msg text;
begin
  begin
    return public.vrm_projeter(p_owner, p_id, p_data, p_meta, p_avant, p_supprime);
  exception when others then
    get stacked diagnostics v_etat = returned_sqlstate, v_msg = message_text;
    begin
      perform public.vrm_t_ecart(p_owner, p_id, coalesce(public.vrm_t_famille(p_id), '?'), 'erreur', 1, v_etat || ' ' || v_msg);
    exception when others then null;
    end;
    return 'erreur';
  end;
end $$;

-- ── 9. Les déclencheurs sur app_data (APRÈS : la ligne est déjà écrite telle quelle) ──
create or replace function public.vrm_projection_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare f text;
begin
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (old.id is distinct from new.id or old.owner is distinct from new.owner)) then
    perform public.vrm_projeter_sur(old.owner, old.id, null, null, null, true);
    if tg_op = 'DELETE' then return null; end if;
  end if;
  f := public.vrm_t_famille(new.id);
  if f is null then return null; end if;
  perform public.vrm_projeter_sur(new.owner, new.id,
    case when public.vrm_t_lit_data(f) then new.data end, new.meta,
    case when tg_op = 'UPDATE' and old.id = new.id and old.owner = new.owner and public.vrm_t_lit_data(f) then old.data end,
    false);
  return null;
end $$;
drop trigger if exists vrm_projection_ecrit on public.app_data;
create trigger vrm_projection_ecrit after insert or update on public.app_data
  for each row when (public.vrm_t_famille(new.id) is not null)
  execute function public.vrm_projection_trigger();
drop trigger if exists vrm_projection_renomme on public.app_data;
create trigger vrm_projection_renomme after update on public.app_data
  for each row when (public.vrm_t_famille(old.id) is not null and public.vrm_t_famille(new.id) is null
                     and (old.id is distinct from new.id or old.owner is distinct from new.owner))
  execute function public.vrm_projection_trigger();
drop trigger if exists vrm_projection_efface on public.app_data;
create trigger vrm_projection_efface after delete on public.app_data
  for each row when (public.vrm_t_famille(old.id) is not null)
  execute function public.vrm_projection_trigger();

-- ── 10. Les comptes (vinted_accounts) : login et domaine, JAMAIS un jeton ──
create or replace function public.vrm_t_compte(p_owner uuid, j jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.comptes as c (owner, plateforme, compte_id, login, domaine, empreinte)
  select p_owner, 'vinted', public.vrm_t_texte(j -> 'vinted_user_id'), public.vrm_t_texte(j -> 'login'),
         public.vrm_t_texte(j -> 'domain'),
         md5(coalesce(j ->> 'login', '') || '|' || coalesce(j ->> 'domain', ''))
   where public.vrm_t_texte(j -> 'vinted_user_id') is not null
  on conflict (owner, plateforme, compte_id) do update set
    login = excluded.login, domaine = excluded.domaine, empreinte = excluded.empreinte, projete_le = now()
   where c.empreinte is distinct from excluded.empreinte
$$;
create or replace function public.vrm_comptes_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb; n jsonb;
begin
  begin
    if tg_op in ('UPDATE', 'DELETE') then a := to_jsonb(old); end if;
    if tg_op in ('INSERT', 'UPDATE') then n := to_jsonb(new); end if;
    if a is not null and (n is null or (a -> 'vinted_user_id') is distinct from (n -> 'vinted_user_id') or old.owner is distinct from new.owner) then
      delete from public.comptes where owner = old.owner and plateforme = 'vinted' and compte_id = public.vrm_t_texte(a -> 'vinted_user_id');
    end if;
    if n is not null then perform public.vrm_t_compte(new.owner, n); end if;
  exception when others then
    begin
      perform public.vrm_t_ecart(coalesce(new.owner, old.owner), 'vinted_accounts', 'comptes', 'erreur', 1, sqlstate || ' ' || sqlerrm);
    exception when others then null;
    end;
  end;
  return null;
end $$;
drop trigger if exists vrm_comptes_projection on public.vinted_accounts;
create trigger vrm_comptes_projection after insert or update or delete on public.vinted_accounts
  for each row execute function public.vrm_comptes_trigger();

-- ── 11. Remplissage initial : par lots, reprise par curseur, rejouable ──
-- À lancer dans l'éditeur SQL : `select * from public.vrm_tables_remplir(1000);`
-- autant de fois qu'il faut, jusqu'à `fini = true`. Chaque lot verrouille en
-- partage (FOR SHARE) les lignes qu'il recopie : une écriture de l'extension sur
-- la même ligne attend la fin du lot (≤ 1-2 s) puis se recopie elle-même — la
-- copie ne peut donc jamais être plus vieille que la ligne.
create or replace function public.vrm_tables_remplir(p_lot integer default 1000)
returns table (traitees integer, recopiees integer, inconnues integer, erreurs integer, fini boolean)
language plpgsql security definer set search_path = '' as $$
declare
  cur record;
  r record;
  n integer := 0; ok integer := 0; inc integer := 0; err integer := 0;
  res text;
  d_owner uuid; d_id text;
begin
  insert into public.vrm_projection_remplissage (cle) values (1) on conflict (cle) do nothing;
  select * into cur from public.vrm_projection_remplissage where cle = 1 for update;
  if cur.fini_le is not null then
    return query select 0, 0, 0, 0, true; return;
  end if;
  if cur.dernier_id is null then
    -- Premier lot : les comptes (petite table, d'un coup).
    perform public.vrm_t_compte(v.owner, to_jsonb(v)) from public.vinted_accounts v;
    update public.vrm_projection_remplissage set commence_le = now() where cle = 1;
  end if;
  d_owner := cur.dernier_owner; d_id := cur.dernier_id;
  for r in
    select a.owner, a.id,
           case when public.vrm_t_lit_data(public.vrm_t_famille(a.id)) then a.data end as d,
           a.meta
      from public.app_data a
     where (cur.dernier_id is null or (a.owner, a.id) > (cur.dernier_owner, cur.dernier_id))
       and public.vrm_t_famille(a.id) is not null
     order by a.owner, a.id
     limit greatest(1, least(p_lot, 20000))
       for share of a
  loop
    n := n + 1;
    res := public.vrm_projeter_sur(r.owner, r.id, r.d, r.meta, null, false);
    if res = 'ok' then ok := ok + 1; elsif res = 'erreur' then err := err + 1; else inc := inc + 1; end if;
    d_owner := r.owner; d_id := r.id;
  end loop;
  update public.vrm_projection_remplissage
     set dernier_owner = d_owner, dernier_id = d_id, lignes = lignes + n,
         fini_le = case when n < greatest(1, least(p_lot, 20000)) then now() end
   where cle = 1;
  return query select n, ok, inc, err, n < greatest(1, least(p_lot, 20000));
end $$;
-- Repartir du début (rien n'est effacé : la recopie est rejouable).
create or replace function public.vrm_tables_remplir_recommencer() returns void
language sql security definer set search_path = '' as $$
  insert into public.vrm_projection_remplissage (cle) values (1) on conflict (cle) do nothing;
  update public.vrm_projection_remplissage
     set dernier_owner = null, dernier_id = null, lignes = 0, commence_le = null, fini_le = null where cle = 1;
$$;
-- Couverture : par famille, combien de lignes dans app_data, combien recopiées, combien en écart.
-- (Lit les `id` seulement, jamais `data`.)
create or replace function public.vrm_tables_couverture()
returns table (famille text, lignes bigint, recopiees bigint, en_ecart bigint, sans_identite bigint)
language sql stable security definer set search_path = '' as $$
  with a as (select coalesce(public.vrm_t_famille(id), 'hors périmètre') f, count(*) n from public.app_data group by 1),
       s as (select famille f, count(*) n from public.vrm_projection_sources group by 1),
       e as (select famille f, count(distinct (owner, source)) filter (where raison <> 'sans_identite') n,
                    coalesce(sum(n) filter (where raison = 'sans_identite'), 0) si
               from public.vrm_projection_ecarts group by 1)
  select a.f, a.n, coalesce(s.n, 0), coalesce(e.n, 0), coalesce(e.si, 0)
    from a left join s using (f) left join e using (f)
   order by 1
$$;
-- Effacement d'un vendeur (RGPD) : le seul chemin qui retire ses N°. Appelé par la
-- route d'effacement de compte à l'étape 2 (aujourd'hui : à la main, avec son accord).
create or replace function public.vrm_tables_effacer_vendeur(p_owner uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_owner is null then raise exception 'vrm_tables : owner requis'; end if;
  perform set_config('vrm.effacer_vendeur', p_owner::text, true);
  delete from public.annonces where owner = p_owner;
  delete from public.ventes where owner = p_owner;
  delete from public.achats where owner = p_owner;
  delete from public.transactions where owner = p_owner;
  delete from public.colis where owner = p_owner;
  delete from public.emails where owner = p_owner;
  delete from public.numeros where owner = p_owner;
  delete from public.numeros_fiches where owner = p_owner;
  delete from public.comptes where owner = p_owner;
  delete from public.vrm_projection_sources where owner = p_owner;
  delete from public.vrm_projection_ecarts where owner = p_owner;
  perform set_config('vrm.effacer_vendeur', '', true);
end $$;

-- Aucune de ces fonctions n'est appelable par un vendeur (elles prennent un owner).
do $$
declare f text;
begin
  foreach f in array array[
    'public.vrm_projeter(uuid,text,jsonb,jsonb,jsonb,boolean)',
    'public.vrm_projeter_sur(uuid,text,jsonb,jsonb,jsonb,boolean)',
    'public.vrm_t_commandes(text,uuid,text,jsonb)',
    'public.vrm_t_ecart(uuid,text,text,text,integer,text)',
    'public.vrm_t_lue(uuid,text,text,timestamptz,integer,integer)',
    'public.vrm_t_compte(uuid,jsonb)',
    'public.vrm_projection_trigger()',
    'public.vrm_comptes_trigger()',
    'public.vrm_numeros_immuable()',
    'public.vrm_numeros_immuable_tout()',
    'public.vrm_tables_remplir(integer)',
    'public.vrm_tables_remplir_recommencer()',
    'public.vrm_tables_couverture()',
    'public.vrm_tables_effacer_vendeur(uuid)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

commit;

-- Vérification (à lire après le Run) : les tables, et 0 partout avant le remplissage.
select * from public.vrm_tables_couverture();
