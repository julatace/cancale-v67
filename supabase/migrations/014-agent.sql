-- ════════════════════════════════════════════════════════════════════════════
-- 014 — LA MÉMOIRE DE L'AGENT eBAY (chantier K3, 11 octobre 2026)
--        PAS ENCORE APPLIQUÉE. Aucune horloge ici : ni pg_cron, ni pg_net
--        (c'est la 015, sur le oui de Julien).
-- ════════════════════════════════════════════════════════════════════════════
-- Julien : un agent eBay « 100 % autonome, qui ne dépend de personne ». Il
-- tournera VRM fermé, côté serveur, pour chaque vendeur et chaque compte eBay
-- (spécification : agent-ebay-autonome/spec-finale.md §5.1-5.2 ; synthèse §5).
-- Ce fichier lui donne une MÉMOIRE où les garanties vivent DANS LA BASE, pas
-- dans le code qui l'appelle :
--
--   • une FILE de tâches à BAIL (deux battements ne prennent jamais la même
--     tâche ; un compte eBay n'a jamais deux appels en vol, y compris d'un
--     battement à l'autre [S24, D15]) ;
--   • l'état des commandes écrit SOUS VERSION ET SOUS BAIL (une écriture
--     périmée rend 0 ligne : on relit, on n'écrase jamais) ;
--   • un JOURNAL de ce qui est fait en son nom, où l'on ajoute — sa seule
--     réécriture possible est l'effacement d'un texte à la demande d'eBay [S26] ;
--   • des MÉMOS « déjà fait » gardés au moins 100 jours [S25] ; ceux des gestes
--     qui engagent sont GLOBAUX par commande eBay, sous le propriétaire neutre :
--     deux vendeurs VRM qui verraient la même commande ne font le geste qu'une
--     fois [S5] ;
--   • des RÉSERVATIONS d'argent en une instruction, à 115 % du devis TTC [S9],
--     rendues une seule fois ;
--   • un REGISTRE DES TITULAIRES : un compte eBay n'est actif que chez UN
--     vendeur VRM [S5] ;
--   • l'HORLOGE à « -infinity » : jamais un NULL qui ferait ignorer chaque
--     battement pour toujours [D14] ;
--   • la GARDE d'écriture sur `ebay_tokens*` : plus aucun navigateur ne peut
--     écrire, réécrire ni effacer un jeton eBay (§5.1).
--
-- QUI LIT, QUI ÉCRIT :
--   • lisibles par LEUR vendeur (RLS `owner = auth.uid()` + la restrictive
--     `abonnement_requis` : qui ne paie plus ne voit plus rien, règle du
--     4 octobre) : vrm_agent_vendeurs, vrm_agent_commandes, vrm_agent_journal ;
--     AUCUNE règle d'écriture, AUCUN droit d'écriture ;
--   • tout le reste : SERVEUR SEULEMENT (RLS activé, aucune règle — le modèle de
--     `vrm_reglages`), et `anon` ne lit rien du tout ;
--   • même le serveur (`service_role`, qui contourne RLS) n'écrit les tables à
--     garantie QUE par les fonctions ci-dessous : file, commandes, journal,
--     compteurs, mémos, titulaires, index des annonces, preuves, horloge. Un
--     droit de table ne se « contourne » pas comme RLS : c'est ce qui rend les
--     garanties vraies même face à un bogue de route.
--
-- TOUTES les fonctions : SECURITY DEFINER, search_path vide, exécutables par
-- `service_role` SEULEMENT, et LE TEMPS EN PARAMÈTRE (`p_maintenant`, défaut
-- now()) : c'est ce qui permet le banc de vie sur horloge simulée (K5).
--
-- ⚠️ AUCUN `DROP` dans ce fichier (l'outil SQL attend une confirmation humaine
--    pour un DROP, et il n'y a rien à retirer : tout est neuf). Réinstaller le
--    fichier une seconde fois ne lève rien et ne touche aucune donnée.
-- ⚠️ « Fermer mon compte » (api/compte.js) devra appeler
--    `vrm_agent_effacer_vendeur(owner)` dès que l'agent écrit quelque chose :
--    le journal refuse toute autre suppression (voir §6).
--
-- APPLICATION (par la session principale, jamais en tâche de fond) : un essai
-- dans une transaction ANNULÉE d'abord (la méthode de la 013), puis
-- l'application, puis la vérification (`scripts/agent-sql/essai-annule.cjs`,
-- `--verifier`). Rien ne tourne après : des tables vides, un réglage à '0'.
-- Si l'outil SQL refuse le bloc entier, `--morceaux` le découpe en TROIS
-- transactions (tables et leurs droits · fonctions et leurs droits · gardes,
-- trace, réglage) : chaque objet naît FERMÉ dans la transaction qui le crée.
-- Preuve : scripts/audit-agent-sql.cjs (cette migration EXÉCUTÉE sur un Postgres
-- jetable qui imite la production : rôles, droits par défaut, RLS, 005-007).
-- ════════════════════════════════════════════════════════════════════════════

begin;
-- Une installation qui ATTEND un verrou (le déclencheur posé sur app_data en
-- prend un) bloquerait l'app et les emails derrière elle : échouer vite.
set local lock_timeout = '3s';
set local statement_timeout = '60s';

-- Le propriétaire NEUTRE (aucune session ne le porte, RLS ne le montre à
-- personne) — le même que celui de la quarantaine des emails.
--   00000000-0000-0000-0000-000000000000

-- ── 1. LES TABLES ───────────────────────────────────────────────────────────

-- 1a. Lisibles par LEUR vendeur.
create table if not exists public.vrm_agent_vendeurs (     -- une ligne par vendeur
  owner uuid primary key,
  actif boolean not null default false,                    -- SON interrupteur (arrêt d'urgence)
  reglages jsonb not null default '{}'::jsonb,             -- écrits par la route, bornés par le serveur
  reglages_version integer not null default 0,
  repetition jsonb not null default '{}'::jsonb,           -- par famille : {depuis, decisions, valide_le}
  pouls jsonb not null default '{}'::jsonb,                -- dernier passage, dernier succès, dernière erreur (un CODE)
  reverif_jusqua timestamptz,                              -- R17 : re-vérification valable 10 min
  maj timestamptz not null default now(),
  constraint vrm_agent_vendeurs_formes check (
    jsonb_typeof(reglages) = 'object' and jsonb_typeof(repetition) = 'object' and jsonb_typeof(pouls) = 'object'
    and reglages_version >= 0));

create table if not exists public.vrm_agent_commandes (    -- ce que l'AGENT ajoute au miroir eBay, rien de plus
  owner uuid not null,
  plateforme text not null default 'ebay',
  compte text not null,
  commande text not null,
  etape text not null,
  rang integer not null,
  branche text,
  numero text,                                             -- le N° lu par numeroExterne (R2), jamais deviné
  voie text,
  limite timestamptz,                                      -- shipByDate
  transporteur text,
  suivi text,
  etape_colis text,
  colis_le timestamptz,
  en_cours jsonb,                                          -- {geste, cle, depuis} : écrit AVANT d'agir (R5)
  politique_etiquette text,                                -- 'EBAY_ONLY' · 'aucune' · NULL (pas lue) [D5]
  pays text,                                               -- ISO 2 SEULEMENT (R18)
  pickup boolean,
  reference_programme boolean,
  cles_shipto text[],                                      -- des NOMS de clés, jamais les valeurs (R18)
  version integer not null default 0,
  maj timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,                 -- ≤ 2 Ko prévus ; 4 Ko refusés (une commande eBay
                                                           --   recopiée entière, adresse comprise, ne passe pas)
  primary key (owner, plateforme, compte, commande),
  constraint vrm_agent_commandes_rang check (rang between 0 and 10),
  constraint vrm_agent_commandes_politique check (politique_etiquette is null or politique_etiquette in ('EBAY_ONLY', 'aucune')),
  constraint vrm_agent_commandes_pays check (pays is null or pays ~ '^[A-Z]{2}$'),
  constraint vrm_agent_commandes_data check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4096),
  -- Un nom de clé commence par une lettre et n'a ni espace, ni @, ni chiffre en
  -- tête : « Jean Dupont », « 12 rue … », « 35260 », « a@b.fr » sont refusés.
  constraint vrm_agent_commandes_shipto check (cles_shipto is null or cardinality(cles_shipto) = 0
    or (cardinality(cles_shipto) <= 30
        and array_to_string(cles_shipto, '|') ~ '^[A-Za-z][A-Za-z0-9_.]{0,63}(\|[A-Za-z][A-Za-z0-9_.]{0,63})*$')));

create table if not exists public.vrm_agent_journal (      -- une ligne par geste fait EN SON NOM
  id bigint generated always as identity primary key,
  owner uuid not null,
  compte text,
  at timestamptz not null default now(),
  geste text not null,          -- retrait | bordereau | declaration | message | evaluation | prix | offre | annulation-bordereau …
  cible text,                   -- orderId ou itemId
  numero text,                  -- le N°
  resultat text not null,
  centimes integer,
  texte text,
  ref text,
  source text,
  defaire jsonb,
  texte_retire_le timestamptz,  -- R19 : « texte retiré à la demande d'eBay »
  constraint vrm_agent_journal_resultat check (resultat in ('fait', 'refuse', 'incertain', 'aurait-fait', 'ecarte')),
  constraint vrm_agent_journal_texte check (texte is null or octet_length(texte) <= 4000));
create index if not exists vrm_agent_journal_owner_at on public.vrm_agent_journal (owner, at desc);
create index if not exists vrm_agent_journal_owner_cible on public.vrm_agent_journal (owner, cible);

-- 1b. Serveur seulement.
create table if not exists public.vrm_agent_file (
  owner uuid not null,
  cle text not null,                                       -- ebay:{s}:veille · ebay:{s}:cmd:{orderId} · vendeur:doubles …
  groupe text not null,                                    -- le compte eBay : un appel en vol par groupe
  prochain timestamptz not null,
  bail_jeton uuid,
  bail_jusqua timestamptz,
  essais integer not null default 0,
  raison text,
  reveil timestamptz,                                      -- une sonnette arrivée PENDANT le bail : jamais perdue
  primary key (owner, cle),
  constraint vrm_agent_file_bail check ((bail_jeton is null) = (bail_jusqua is null)),
  constraint vrm_agent_file_essais check (essais >= 0));
create index if not exists vrm_agent_file_prochain on public.vrm_agent_file (prochain);
create index if not exists vrm_agent_file_en_vol on public.vrm_agent_file (owner, groupe) where bail_jusqua is not null;

create table if not exists public.vrm_agent_compteurs (     -- owner neutre = quotas globaux
  owner uuid not null,
  cle text not null,
  n integer not null default 0,
  centimes bigint not null default 0,
  maj timestamptz not null default now(),
  primary key (owner, cle),
  constraint vrm_agent_compteurs_positifs check (n >= 0 and centimes >= 0));

create table if not exists public.vrm_agent_vus (           -- notifications et évènements ENTRANTS, 14 jours
  owner uuid not null,
  cle text not null,
  at timestamptz not null default now(),
  primary key (owner, cle));
create index if not exists vrm_agent_vus_at on public.vrm_agent_vus (at);

create table if not exists public.vrm_agent_memos (         -- « déjà fait » des GESTES, ≥ 100 jours [S25]
  owner uuid not null,
  cle text not null,
  at timestamptz not null default now(),
  expire timestamptz not null,
  primary key (owner, cle),
  constraint vrm_agent_memos_cent_jours check (expire >= at + interval '100 days'));
create index if not exists vrm_agent_memos_expire on public.vrm_agent_memos (expire);

create table if not exists public.vrm_agent_routes (        -- adresses opaques de PRESTATAIRE (une par vendeur) [D13]
  k text primary key,
  owner uuid not null,
  compte text,
  fournisseur text not null,
  cree timestamptz not null default now(),
  revoque timestamptz,
  constraint vrm_agent_routes_opaque check (k ~ '^[A-Za-z0-9_-]{32,128}$'));

create table if not exists public.vrm_agent_horloge (
  id integer primary key check (id = 1),
  dernier_tic timestamptz not null default '-infinity',
  dernier_battement timestamptz not null default '-infinity',
  dernier_succes timestamptz not null default '-infinity');

create table if not exists public.vrm_ebay_cles_publiques (  -- clés de signature d'eBay, par kid
  kid text primary key,
  pem text not null,
  lu timestamptz not null default now());

create table if not exists public.vrm_coffre (               -- AES-256-GCM (K4) : jamais une valeur en clair
  owner uuid not null,
  compte text not null,
  fournisseur text not null,
  v integer not null,
  nonce bytea not null,
  chiffre bytea not null,
  tag bytea not null,
  etat text,
  teste_le timestamptz,
  maj timestamptz not null default now(),
  primary key (owner, compte, fournisseur),
  constraint vrm_coffre_gcm check (octet_length(nonce) = 12 and octet_length(tag) = 16 and v >= 1));

create table if not exists public.vrm_ebay_titulaires (      -- un compte eBay, UN vendeur VRM [S5]
  cle_ebay text primary key,                               -- cleCompteDe(EIASToken) : 16 hexadécimaux
  owner uuid not null,
  compte text not null default '',
  depuis timestamptz not null default now(),
  constraint vrm_ebay_titulaires_cle check (cle_ebay ~ '^[0-9a-f]{16}$'));
create index if not exists vrm_ebay_titulaires_owner on public.vrm_ebay_titulaires (owner);

create table if not exists public.vrm_ebay_annonces_index (  -- listingId → vendeur : routage des sonnettes [D13]
  listing_id text primary key,
  owner uuid not null,
  compte text not null,
  maj timestamptz not null default now(),
  constraint vrm_ebay_annonces_index_id check (listing_id ~ '^[0-9]{6,20}$'));
create index if not exists vrm_ebay_annonces_index_compte on public.vrm_ebay_annonces_index (owner, compte);

create table if not exists public.vrm_agent_preuves (        -- la PREMIÈRE fois qu'une preuve de vente a été vue [S13]
  owner uuid not null,
  numero_cle text not null,
  source text not null,
  ref text not null,
  vue_le timestamptz not null default now(),
  primary key (owner, numero_cle, source, ref),
  constraint vrm_agent_preuves_non_vides check (numero_cle <> '' and source <> '' and ref <> ''));

-- ── 2. RLS ET DROITS ────────────────────────────────────────────────────────
-- ⚠️ Les droits PAR DÉFAUT du schéma public (mesurés le 11 octobre) ouvrent
--    TOUTE table neuve en entier à anon, authenticated et service_role. On
--    les retire tous, puis on rend exactement ce qui sert.
do $$
declare t text;
begin
  foreach t in array array['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal',
                           'vrm_agent_file', 'vrm_agent_compteurs', 'vrm_agent_vus', 'vrm_agent_memos',
                           'vrm_agent_routes', 'vrm_agent_horloge', 'vrm_ebay_cles_publiques', 'vrm_coffre',
                           'vrm_ebay_titulaires', 'vrm_ebay_annonces_index', 'vrm_agent_preuves'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on public.%I to service_role', t);
  end loop;

  -- Le vendeur LIT ses lignes, et seulement s'il a accès (abonnement) : aucune
  -- règle d'écriture, aucun droit d'écriture.
  foreach t in array array['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal'] loop
    execute format('grant select on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'agent_lecture_soi') then
      execute format('create policy agent_lecture_soi on public.%I for select to authenticated using (owner = (select auth.uid()))', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'abonnement_requis') then
      execute format('create policy abonnement_requis on public.%I as restrictive for all to authenticated '
                     'using ((select public.vrm_acces_ok())) with check ((select public.vrm_acces_ok()))', t);
    end if;
  end loop;
end $$;

-- Ce que le serveur écrit DIRECTEMENT (aucune garantie à tenir au-delà de RLS) :
grant insert, update on public.vrm_agent_vendeurs to service_role;      -- réglages versionnés, pouls (K5, K6)
grant insert on public.vrm_agent_vus to service_role;                    -- dédoublonnage par insertion
grant insert, update on public.vrm_agent_routes to service_role;         -- K14
grant insert, update, delete on public.vrm_ebay_cles_publiques to service_role; -- cache des clés d'eBay (K10)
grant insert, update, delete on public.vrm_coffre to service_role;       -- K4
-- Tout le reste ne s'écrit que par les fonctions du §3 (file, commandes,
-- journal, compteurs, mémos, titulaires, index, preuves, horloge).
revoke all on sequence public.vrm_agent_journal_id_seq from public, anon, authenticated, service_role;

-- ── 3. LES FONCTIONS ────────────────────────────────────────────────────────

-- 3a. PRENDRE des tâches dues. ≤ 2 par vendeur, ≤ 1 par groupe (compte eBay),
--     et JAMAIS un groupe qui a déjà une tâche en vol, y compris dans un AUTRE
--     battement [S24, D15] : un bail vivant l'exclut, et un verrou consultatif
--     par groupe ferme la course entre deux battements simultanés (le bail que
--     l'autre vient de poser n'est pas encore visible).
--     Seule la ligne PRISE est verrouillée, et `skip locked` : un battement ne
--     bloque JAMAIS derrière un autre (ni derrière un clic qui tient sa tâche).
create or replace function public.vrm_agent_prendre(p_lim integer, p_jeton uuid, p_bail_s integer, p_maintenant timestamptz default now())
returns table (owner uuid, cle text, groupe text, essais integer, raison text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c record;
  pris integer := 0;
  par_vendeur jsonb := '{}'::jsonb;
  groupes text[] := '{}';
  k text;
begin
  if p_jeton is null or p_lim is null or p_lim < 1 or p_bail_s is null or p_bail_s < 1 or p_maintenant is null then
    return;
  end if;
  for c in
    select f.owner, f.cle, f.groupe
      from public.vrm_agent_file f
     where f.prochain <= p_maintenant
       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < p_maintenant
     order by f.prochain, f.owner, f.cle
     limit least(p_lim, 100) * 25
  loop
    exit when pris >= p_lim;
    k := c.owner::text || '|' || c.groupe;
    continue when k = any (groupes);
    continue when coalesce((par_vendeur ->> c.owner::text)::integer, 0) >= 2;
    continue when not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_groupe'), pg_catalog.hashtext(k));
    continue when exists (select 1 from public.vrm_agent_file g
                           where g.owner = c.owner and g.groupe = c.groupe and g.cle <> c.cle
                             and g.bail_jusqua >= p_maintenant);
    -- La ligne elle-même : verrouillée sans attendre (tenue ailleurs ⇒ on passe)
    -- et revérifiée sur sa DERNIÈRE version.
    perform 1 from public.vrm_agent_file f
     where f.owner = c.owner and f.cle = c.cle and f.prochain <= p_maintenant
       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < p_maintenant
       for update of f skip locked;
    continue when not found;
    update public.vrm_agent_file f
       set bail_jeton = p_jeton,
           bail_jusqua = p_maintenant + pg_catalog.make_interval(secs => p_bail_s),
           reveil = null
     where f.owner = c.owner and f.cle = c.cle
    returning f.owner, f.cle, f.groupe, f.essais, f.raison
         into owner, cle, groupe, essais, raison;
    groupes := groupes || k;
    par_vendeur := par_vendeur || jsonb_build_object(c.owner::text, coalesce((par_vendeur ->> c.owner::text)::integer, 0) + 1);
    pris := pris + 1;
    return next;
  end loop;
end
$$;

-- 3b. Le chemin « CLIC » (un geste fait depuis l'app) prend LE MÊME bail [S15,
--     R8]. Tâche tenue (par un battement ou un autre clic) ⇒ false : la route
--     répond 409 « l'agent travaille sur cette commande ». Tâche absente : elle
--     est créée tenue si l'appelant donne son groupe.
create or replace function public.vrm_agent_prendre_cle(p_owner uuid, p_cle text, p_jeton uuid, p_bail_s integer,
                                                        p_maintenant timestamptz default now(), p_groupe text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_owner is null or p_cle is null or p_jeton is null or p_bail_s is null or p_bail_s < 1 or p_maintenant is null then
    return false;
  end if;
  update public.vrm_agent_file f
     set bail_jeton = p_jeton, bail_jusqua = p_maintenant + pg_catalog.make_interval(secs => p_bail_s), reveil = null
   where f.owner = p_owner and f.cle = p_cle
     and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < p_maintenant;
  if found then return true; end if;
  if p_groupe is null or exists (select 1 from public.vrm_agent_file f where f.owner = p_owner and f.cle = p_cle) then
    return false;
  end if;
  insert into public.vrm_agent_file (owner, cle, groupe, prochain, bail_jeton, bail_jusqua)
  values (p_owner, p_cle, p_groupe, p_maintenant, p_jeton, p_maintenant + pg_catalog.make_interval(secs => p_bail_s))
  on conflict (owner, cle) do nothing;
  return found;
end
$$;

-- 3c. RENDRE une tâche : seulement si le bail porte CE jeton. `p_prochain`
--     NULL = tâche finie (retirée) — sauf si une sonnette est arrivée pendant le
--     bail (`reveil`) : elle n'est jamais perdue.
create or replace function public.vrm_agent_rendre(p_owner uuid, p_cle text, p_jeton uuid, p_prochain timestamptz,
                                                   p_echec boolean default false, p_raison text default null,
                                                   p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare r public.vrm_agent_file%rowtype;
begin
  if p_owner is null or p_cle is null or p_jeton is null then return false; end if;
  select * into r from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton
     for update;
  if not found then return false; end if;
  if p_prochain is null and r.reveil is null then
    delete from public.vrm_agent_file f where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton;
    return true;
  end if;
  update public.vrm_agent_file f
     set bail_jeton = null,
         bail_jusqua = null,
         prochain = least(coalesce(p_prochain, 'infinity'::timestamptz), coalesce(r.reveil, 'infinity'::timestamptz)),
         reveil = null,
         essais = case when coalesce(p_echec, false) then f.essais + 1 else 0 end,
         raison = left(p_raison, 200)
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton;
  return true;
end
$$;

-- 3d. PLANIFIER « au plus tard à `p_quand` » : ne recule jamais une échéance,
--     ne vole jamais un bail. Si la tâche est tenue, la sonnette est gardée
--     dans `reveil` et `rendre` la respecte.
create or replace function public.vrm_agent_planifier(p_owner uuid, p_cle text, p_groupe text, p_quand timestamptz,
                                                      p_maintenant timestamptz default now())
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare p timestamptz;
begin
  if p_owner is null or p_cle is null or p_groupe is null or p_quand is null then return null; end if;
  insert into public.vrm_agent_file as f (owner, cle, groupe, prochain)
  values (p_owner, p_cle, p_groupe, p_quand)
  on conflict (owner, cle) do update
     set prochain = least(f.prochain, excluded.prochain),
         reveil = case when f.bail_jusqua is not null and f.bail_jusqua >= p_maintenant
                       then least(coalesce(f.reveil, 'infinity'::timestamptz), excluded.prochain)
                       else f.reveil end
  returning f.prochain into p;
  return p;
end
$$;

-- 3e. ÉCRIRE l'état d'une commande : 0 ligne (NULL) si la version a bougé OU si
--     le bail de la tâche `p_cle` n'est plus tenu par ce jeton ⇒ on relit, on
--     n'écrase jamais. `p_version_lue` NULL = création (seulement si absente).
--     Rend la NOUVELLE version. Le bail est verrouillé (FOR SHARE) le temps de
--     l'écriture : un autre battement ne peut pas le reprendre entre la
--     vérification et l'écriture (son `skip locked` saute la ligne).
create or replace function public.vrm_agent_ecrire_commande(p_owner uuid, p_cle text, p_jeton uuid, p_compte text, p_commande text,
                                                            p_version_lue integer, p_colonnes jsonb,
                                                            p_plateforme text default 'ebay', p_maintenant timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v integer;
begin
  if p_owner is null or p_cle is null or p_jeton is null or p_compte is null or p_commande is null
     or p_colonnes is null or jsonb_typeof(p_colonnes) <> 'object' then
    return null;
  end if;
  perform 1 from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton and f.bail_jusqua > p_maintenant
     for share of f;
  if not found then return null; end if;
  if p_version_lue is null then
    insert into public.vrm_agent_commandes as c
           (owner, plateforme, compte, commande, etape, rang, branche, numero, voie, limite, transporteur, suivi,
            etape_colis, colis_le, en_cours, politique_etiquette, pays, pickup, reference_programme, cles_shipto,
            data, version, maj)
    select p_owner, coalesce(p_plateforme, 'ebay'), p_compte, p_commande, x.etape, x.rang, x.branche, x.numero, x.voie,
           x.limite, x.transporteur, x.suivi, x.etape_colis, x.colis_le, x.en_cours, x.politique_etiquette, x.pays,
           x.pickup, x.reference_programme, x.cles_shipto, coalesce(x.data, '{}'::jsonb), 1, p_maintenant
      from jsonb_populate_record(null::public.vrm_agent_commandes, p_colonnes) x
    on conflict (owner, plateforme, compte, commande) do nothing
    returning c.version into v;
    return v;
  end if;
  update public.vrm_agent_commandes c
     set (etape, rang, branche, numero, voie, limite, transporteur, suivi, etape_colis, colis_le, en_cours,
          politique_etiquette, pays, pickup, reference_programme, cles_shipto, data)
       = (select x.etape, x.rang, x.branche, x.numero, x.voie, x.limite, x.transporteur, x.suivi, x.etape_colis,
                 x.colis_le, x.en_cours, x.politique_etiquette, x.pays, x.pickup, x.reference_programme,
                 x.cles_shipto, x.data
            from jsonb_populate_record(c, p_colonnes) x),
         version = c.version + 1,
         maj = p_maintenant
   where c.owner = p_owner and c.plateforme = coalesce(p_plateforme, 'ebay')
     and c.compte = p_compte and c.commande = p_commande
     and c.version = p_version_lue
  returning c.version into v;
  return v;
end
$$;

-- 3f. « PREMIÈRE FOIS » d'un geste : true UNE seule fois, le mémo est écrit
--     AVANT le geste (R5). Gardé au moins 100 jours [S25]. Les clés des gestes
--     qui engagent (achat:, msg:, eval:, offre:) sont GLOBALES : rangées sous le
--     propriétaire neutre QUEL QUE SOIT l'appelant [S5, R10] — deux vendeurs VRM
--     qui verraient la même commande eBay n'enverraient pas deux « merci ».
create or replace function public.vrm_agent_premiere_fois(p_owner uuid, p_cle text, p_expire timestamptz default null,
                                                          p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  o uuid := p_owner;
  ok boolean;
begin
  if p_owner is null or p_cle is null or p_cle = '' or p_maintenant is null then return false; end if;
  if p_cle ~ '^(achat|msg|eval|offre):' then o := '00000000-0000-0000-0000-000000000000'; end if;
  insert into public.vrm_agent_memos (owner, cle, at, expire)
  values (o, p_cle, p_maintenant, greatest(coalesce(p_expire, p_maintenant), p_maintenant + interval '100 days'))
  on conflict (owner, cle) do nothing
  returning true into ok;
  return coalesce(ok, false);
end
$$;

-- 3g. « DÉJÀ VU » d'une notification ou d'un évènement ENTRANT (14 jours).
create or replace function public.vrm_agent_vu(p_owner uuid, p_cle text, p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare ok boolean;
begin
  if p_owner is null or p_cle is null or p_cle = '' then return false; end if;
  insert into public.vrm_agent_vus (owner, cle, at) values (p_owner, p_cle, p_maintenant)
  on conflict (owner, cle) do nothing
  returning true into ok;
  return coalesce(ok, false);
end
$$;

-- 3h. RÉSERVER de l'argent, en une instruction, tout ou rien (modèle
--     `vrm_detourage_reserver`) : `ceil(TTC × 1,15)` [S9, R15] contre le plafond
--     du geste, du jour (nombre et montant, par compte eBay, jour de PARIS) et
--     du mois (par vendeur). Un plafond NULL ⇒ refusé (« pas su » n'agit
--     jamais). Les deux compteurs sont verrouillés dans un ordre fixe : 50
--     réservations simultanées ne dépassent jamais un plafond.
--     Rend {ok, reservation, centimes, jour, mois} ou {ok:false, raison}.
create or replace function public.vrm_agent_reserver(p_owner uuid, p_compte text, p_centimes_ttc integer,
                                                     p_plafond_geste integer, p_plafond_jour_n integer,
                                                     p_plafond_jour_centimes integer, p_plafond_mois_centimes integer,
                                                     p_maintenant timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  montant integer;
  jour text;
  mois text;
  cj text;
  cm text;
  j record;
  m record;
  id uuid := gen_random_uuid();
begin
  if p_owner is null or p_compte is null or p_compte !~ '^[0-9A-Za-z_-]{0,64}$' or p_maintenant is null
     or p_centimes_ttc is null or p_centimes_ttc <= 0
     or p_plafond_geste is null or p_plafond_jour_n is null or p_plafond_jour_centimes is null or p_plafond_mois_centimes is null then
    return jsonb_build_object('ok', false, 'raison', 'pas-su');
  end if;
  montant := (p_centimes_ttc::bigint * 115 + 99) / 100;   -- ceil(× 1,15), en entiers
  if montant > p_plafond_geste then
    return jsonb_build_object('ok', false, 'raison', 'geste', 'centimes', montant);
  end if;
  jour := to_char(p_maintenant at time zone 'Europe/Paris', 'YYYY-MM-DD');
  mois := to_char(p_maintenant at time zone 'Europe/Paris', 'YYYY-MM');
  cj := 'argent:jour:' || p_compte || ':' || jour;
  cm := 'argent:mois:' || mois;
  insert into public.vrm_agent_compteurs (owner, cle, maj) values (p_owner, cj, p_maintenant), (p_owner, cm, p_maintenant)
  on conflict (owner, cle) do nothing;
  perform 1 from public.vrm_agent_compteurs k where k.owner = p_owner and k.cle in (cj, cm) order by k.cle for update;
  select k.n, k.centimes into j from public.vrm_agent_compteurs k where k.owner = p_owner and k.cle = cj;
  select k.n, k.centimes into m from public.vrm_agent_compteurs k where k.owner = p_owner and k.cle = cm;
  if j.n + 1 > p_plafond_jour_n then
    return jsonb_build_object('ok', false, 'raison', 'jour-nombre', 'centimes', montant);
  end if;
  if j.centimes + montant > p_plafond_jour_centimes then
    return jsonb_build_object('ok', false, 'raison', 'jour', 'centimes', montant);
  end if;
  if m.centimes + montant > p_plafond_mois_centimes then
    return jsonb_build_object('ok', false, 'raison', 'mois', 'centimes', montant);
  end if;
  update public.vrm_agent_compteurs k set n = k.n + 1, centimes = k.centimes + montant, maj = p_maintenant
   where k.owner = p_owner and k.cle in (cj, cm);
  insert into public.vrm_agent_compteurs (owner, cle, n, centimes, maj)
  values (p_owner, 'resa:' || id::text || '|' || cj || '|' || cm, 1, montant, p_maintenant);
  return jsonb_build_object('ok', true, 'reservation', id, 'centimes', montant, 'jour', jour, 'mois', mois);
end
$$;

-- 3i. RENDRE une réservation — seulement sur un REFUS PROUVÉ (c'est l'appelant
--     qui en juge, R15 ; jamais sur un incertain). Une seule fois : la ligne de
--     réservation est retirée, un second appel ne rend rien.
create or replace function public.vrm_agent_rendre_reservation(p_owner uuid, p_reservation uuid,
                                                               p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  k text;
  c bigint;
begin
  if p_owner is null or p_reservation is null then return false; end if;
  delete from public.vrm_agent_compteurs x
   where x.owner = p_owner and x.cle like 'resa:' || p_reservation::text || '|%'
  returning x.cle, x.centimes into k, c;
  if not found then return false; end if;
  update public.vrm_agent_compteurs x
     set n = greatest(x.n - 1, 0), centimes = greatest(x.centimes - c, 0), maj = p_maintenant
   where x.owner = p_owner and x.cle in (split_part(k, '|', 2), split_part(k, '|', 3));
  return true;
end
$$;

-- 3j. Le QUOTA d'appels (Trading : 5 000 par jour pour TOUTE l'application),
--     réservé AVANT l'appel, sous le propriétaire neutre : `obligation` jusqu'à
--     100 % (20 % lui sont gardés), `detection` jusqu'à 80 %, `confort` jusqu'à
--     60 % ; hors obligation, au plus 1 % par compte et par jour (§4.8).
--     `p_cle` porte le jour (« trading:2026-10-11 »). Priorité inconnue ⇒ refusé.
create or replace function public.vrm_agent_quota(p_cle text, p_priorite text, p_n integer default 1, p_plafond integer default 5000,
                                                  p_owner uuid default null, p_compte text default null,
                                                  p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  neutre constant uuid := '00000000-0000-0000-0000-000000000000';
  seuil numeric;
  lim integer;
  par_compte integer;
  cc text;
  g integer;
  c integer;
begin
  seuil := case p_priorite when 'obligation' then 1.0 when 'detection' then 0.8 when 'confort' then 0.6 else null end;
  if seuil is null or p_cle is null or p_cle = '' or p_n is null or p_n < 1 or p_plafond is null or p_plafond < 1 then
    return false;
  end if;
  lim := floor(p_plafond * seuil)::integer;
  if p_priorite <> 'obligation' and p_owner is not null then
    cc := p_cle || '|' || p_owner::text || '|' || coalesce(p_compte, '');
    par_compte := greatest(1, ceil(p_plafond * 0.01)::integer);
  end if;
  insert into public.vrm_agent_compteurs (owner, cle, maj) values (neutre, p_cle, p_maintenant) on conflict (owner, cle) do nothing;
  if cc is not null then
    insert into public.vrm_agent_compteurs (owner, cle, maj) values (neutre, cc, p_maintenant) on conflict (owner, cle) do nothing;
  end if;
  perform 1 from public.vrm_agent_compteurs k where k.owner = neutre and k.cle in (p_cle, cc) order by k.cle for update;
  select k.n into g from public.vrm_agent_compteurs k where k.owner = neutre and k.cle = p_cle;
  if g + p_n > lim then return false; end if;
  if cc is not null then
    select k.n into c from public.vrm_agent_compteurs k where k.owner = neutre and k.cle = cc;
    if c + p_n > par_compte then return false; end if;
  end if;
  update public.vrm_agent_compteurs k set n = k.n + p_n, maj = p_maintenant
   where k.owner = neutre and k.cle in (p_cle, cc);
  return true;
end
$$;

-- 3k. Recaler le compteur du jour sur ce qu'eBay dit avoir compté
--     (`getRateLimits`, chaque heure) : il ne fait que MONTER.
create or replace function public.vrm_agent_quota_recaler(p_cle text, p_utilises integer, p_maintenant timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare r integer;
begin
  if p_cle is null or p_cle = '' or p_utilises is null or p_utilises < 0 then return null; end if;
  insert into public.vrm_agent_compteurs as k (owner, cle, n, maj)
  values ('00000000-0000-0000-0000-000000000000', p_cle, p_utilises, p_maintenant)
  on conflict (owner, cle) do update set n = greatest(k.n, excluded.n), maj = excluded.maj
  returning k.n into r;
  return r;
end
$$;

-- 3l. NOTER une ligne au journal (ajout seulement). L'heure est celle du
--     serveur (`p_maintenant`), jamais une heure reçue.
create or replace function public.vrm_agent_noter(p_owner uuid, p_entree jsonb, p_maintenant timestamptz default now())
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare i bigint;
begin
  if p_owner is null or p_entree is null or jsonb_typeof(p_entree) <> 'object' then return null; end if;
  insert into public.vrm_agent_journal (owner, compte, at, geste, cible, numero, resultat, centimes, texte, ref, source, defaire)
  select p_owner, x.compte, p_maintenant, x.geste, x.cible, x.numero, x.resultat, x.centimes, x.texte, x.ref, x.source, x.defaire
    from jsonb_populate_record(null::public.vrm_agent_journal, p_entree) x
  returning id into i;
  return i;
end
$$;

-- 3m. La SEULE réécriture du journal (R19, [S26]) : effacer le texte des
--     entrées qui visent un acheteur supprimé (« texte retiré à la demande
--     d'eBay »). Rend le nombre d'entrées touchées.
create or replace function public.vrm_agent_anonymiser_journal(p_owner uuid, p_cible text, p_maintenant timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare n integer;
begin
  if p_owner is null or p_cible is null or p_cible = '' then return 0; end if;
  update public.vrm_agent_journal j set texte = null, texte_retire_le = p_maintenant
   where j.owner = p_owner and j.cible = p_cible and j.texte is not null;
  get diagnostics n = row_count;
  return n;
end
$$;

-- 3n. L'HORLOGE. L'anti-rafale en UNE instruction : rend true si le battement
--     peut travailler (le précédent date de plus de `p_ecart_s` secondes). La
--     ligne existe dès l'installation, à « -infinity » [D14] : jamais un NULL
--     qui ferait ignorer chaque battement pour toujours.
create or replace function public.vrm_agent_horloge_battre(p_maintenant timestamptz default now(), p_ecart_s integer default 20)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare ok boolean;
begin
  if p_maintenant is null then return false; end if;
  update public.vrm_agent_horloge h set dernier_battement = p_maintenant
   where h.id = 1
     and coalesce(h.dernier_battement, '-infinity'::timestamptz) < p_maintenant - pg_catalog.make_interval(secs => greatest(coalesce(p_ecart_s, 20), 1))
  returning true into ok;
  return coalesce(ok, false);
end
$$;
-- Le dernier battement qui a RÉUSSI (l'alarme du secours de 08:00 le lit, pas
-- `dernier_tic`, qui avance même quand la route refuse [D4]).
create or replace function public.vrm_agent_horloge_succes(p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare ok boolean;
begin
  if p_maintenant is null then return false; end if;
  update public.vrm_agent_horloge h set dernier_succes = greatest(h.dernier_succes, p_maintenant)
   where h.id = 1
  returning true into ok;
  return coalesce(ok, false);
end
$$;

-- 3o. Les TITULAIRES [S5, R10] : `true` si ce compte eBay est (ou devient) à
--     ce vendeur ; `false` s'il est déjà à un AUTRE vendeur VRM (« ce compte
--     eBay est déjà relié à un autre compte VRM »). Jamais le propriétaire neutre.
create or replace function public.vrm_agent_titulaire(p_cle_ebay text, p_owner uuid, p_compte text,
                                                      p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  ok boolean;
  o uuid;
begin
  if p_cle_ebay is null or p_cle_ebay !~ '^[0-9a-f]{16}$' or p_owner is null
     or p_owner = '00000000-0000-0000-0000-000000000000' then
    return false;
  end if;
  insert into public.vrm_ebay_titulaires (cle_ebay, owner, compte, depuis)
  values (p_cle_ebay, p_owner, coalesce(p_compte, ''), p_maintenant)
  on conflict (cle_ebay) do nothing
  returning true into ok;
  if ok then return true; end if;
  select t.owner into o from public.vrm_ebay_titulaires t where t.cle_ebay = p_cle_ebay for update;
  if o is distinct from p_owner then return false; end if;
  if p_compte is not null then
    update public.vrm_ebay_titulaires t set compte = p_compte where t.cle_ebay = p_cle_ebay and t.owner = p_owner;
  end if;
  return true;
end
$$;
-- Libérer un compte eBay (déconnexion, fermeture) : seulement par SON titulaire.
-- Son index d'annonces part avec lui (une sonnette n'est plus routée vers lui).
create or replace function public.vrm_agent_titulaire_liberer(p_cle_ebay text, p_owner uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare c text;
begin
  if p_cle_ebay is null or p_owner is null then return false; end if;
  delete from public.vrm_ebay_titulaires t where t.cle_ebay = p_cle_ebay and t.owner = p_owner
  returning t.compte into c;
  if not found then return false; end if;
  delete from public.vrm_ebay_annonces_index i
   where i.owner = p_owner and i.compte = c
     and not exists (select 1 from public.vrm_ebay_titulaires t where t.owner = p_owner and t.compte = c);
  return true;
end
$$;

-- 3p. L'INDEX des annonces (listingId → vendeur, compte) d'UN compte, réécrit à
--     chaque relecture COMPLÈTE de ses annonces [D13]. `p_listings` NULL = pas
--     su : rien ne bouge. Une annonce déjà indexée chez un AUTRE vendeur n'est
--     jamais prise (comptée « refusée »). Rend {indexees, retirees, refusees}.
create or replace function public.vrm_ebay_indexer_annonces(p_owner uuid, p_compte text, p_listings text[],
                                                            p_maintenant timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  valides text[];
  n_ret integer;
  n_ind integer;
  n_brut integer;
begin
  if p_owner is null or p_compte is null or p_listings is null then return null; end if;
  select coalesce(array_agg(distinct x), '{}'), count(distinct x) into valides, n_brut
    from unnest(p_listings) x where x is not null;
  select coalesce(array_agg(x), '{}') into valides from unnest(valides) x where x ~ '^[0-9]{6,20}$';
  delete from public.vrm_ebay_annonces_index i
   where i.owner = p_owner and i.compte = p_compte and not (i.listing_id = any (valides));
  get diagnostics n_ret = row_count;
  insert into public.vrm_ebay_annonces_index as i (listing_id, owner, compte, maj)
  select x, p_owner, p_compte, p_maintenant from unnest(valides) x
  on conflict (listing_id) do update set compte = excluded.compte, maj = excluded.maj
   where i.owner = excluded.owner;
  get diagnostics n_ind = row_count;
  return jsonb_build_object('indexees', n_ind, 'retirees', n_ret, 'refusees', n_brut - n_ind);
end
$$;

-- 3q. La PREMIÈRE fois qu'une preuve de vente a été vue (§5.4, décision 2) :
--     l'heure n'est jamais déplacée. Rend `vue_le` de CETTE preuve.
create or replace function public.vrm_agent_preuve_vue(p_owner uuid, p_numero_cle text, p_source text, p_ref text,
                                                       p_maintenant timestamptz default now())
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v timestamptz;
begin
  if p_owner is null or coalesce(p_numero_cle, '') = '' or coalesce(p_source, '') = '' or coalesce(p_ref, '') = '' then
    return null;
  end if;
  insert into public.vrm_agent_preuves (owner, numero_cle, source, ref, vue_le)
  values (p_owner, p_numero_cle, p_source, p_ref, p_maintenant)
  on conflict (owner, numero_cle, source, ref) do nothing;
  select p.vue_le into v from public.vrm_agent_preuves p
   where p.owner = p_owner and p.numero_cle = p_numero_cle and p.source = p_source and p.ref = p_ref;
  return v;
end
$$;

-- 3r. EFFACER tout ce que l'agent garde d'un vendeur (« Fermer mon compte ») :
--     ses tâches, commandes, journal, compteurs, mémos à son nom, vus, routes,
--     coffre, titulaires (son compte eBay redevient libre), index, preuves. Les
--     mémos GLOBAUX (sous le neutre) restent : ils ne disent que « ce geste a
--     été fait pour cette commande eBay ». Rend le nombre de lignes par table.
create or replace function public.vrm_agent_effacer_vendeur(p_owner uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r jsonb := '{}'::jsonb;
  n integer;
begin
  if p_owner is null or p_owner = '00000000-0000-0000-0000-000000000000' then return null; end if;
  perform set_config('vrm.agent_effacer', p_owner::text, true);
  delete from public.vrm_agent_file x where x.owner = p_owner;            get diagnostics n = row_count; r := r || jsonb_build_object('file', n);
  delete from public.vrm_agent_commandes x where x.owner = p_owner;       get diagnostics n = row_count; r := r || jsonb_build_object('commandes', n);
  delete from public.vrm_agent_journal x where x.owner = p_owner;         get diagnostics n = row_count; r := r || jsonb_build_object('journal', n);
  delete from public.vrm_agent_compteurs x where x.owner = p_owner;       get diagnostics n = row_count; r := r || jsonb_build_object('compteurs', n);
  delete from public.vrm_agent_memos x where x.owner = p_owner;           get diagnostics n = row_count; r := r || jsonb_build_object('memos', n);
  delete from public.vrm_agent_vus x where x.owner = p_owner;             get diagnostics n = row_count; r := r || jsonb_build_object('vus', n);
  delete from public.vrm_agent_routes x where x.owner = p_owner;          get diagnostics n = row_count; r := r || jsonb_build_object('routes', n);
  delete from public.vrm_coffre x where x.owner = p_owner;                get diagnostics n = row_count; r := r || jsonb_build_object('coffre', n);
  delete from public.vrm_ebay_titulaires x where x.owner = p_owner;       get diagnostics n = row_count; r := r || jsonb_build_object('titulaires', n);
  delete from public.vrm_ebay_annonces_index x where x.owner = p_owner;   get diagnostics n = row_count; r := r || jsonb_build_object('index', n);
  delete from public.vrm_agent_preuves x where x.owner = p_owner;         get diagnostics n = row_count; r := r || jsonb_build_object('preuves', n);
  delete from public.vrm_agent_vendeurs x where x.owner = p_owner;        get diagnostics n = row_count; r := r || jsonb_build_object('vendeurs', n);
  perform set_config('vrm.agent_effacer', '', true);
  return r;
end
$$;

-- 3s. PURGER (une fois par jour, par la 015) : vus > 14 jours ; mémos passés
--     leur échéance (≥ 100 jours) ; compteurs intouchés depuis 400 jours ;
--     journal > 13 mois ; commandes closes depuis 90 jours COMPACTÉES (elles
--     gardent leurs scalaires, le prix du bordereau et la preuve : jamais
--     supprimées sans trace) ; `cron.job_run_details` > 7 jours s'il existe.
create or replace function public.vrm_agent_purger(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  r jsonb := '{}'::jsonb;
  n integer;
begin
  delete from public.vrm_agent_vus x where x.at < p_maintenant - interval '14 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('vus', n);
  delete from public.vrm_agent_memos x where x.expire < p_maintenant;
  get diagnostics n = row_count; r := r || jsonb_build_object('memos', n);
  delete from public.vrm_agent_compteurs x where x.maj < p_maintenant - interval '400 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('compteurs', n);
  perform set_config('vrm.agent_purger_avant', (p_maintenant - interval '13 months')::text, true);
  delete from public.vrm_agent_journal x where x.at < p_maintenant - interval '13 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('journal', n);
  perform set_config('vrm.agent_purger_avant', '', true);
  update public.vrm_agent_commandes c
     set data = jsonb_strip_nulls(jsonb_build_object('bordereau', c.data -> 'bordereau', 'preuve', c.data -> 'preuve',
                                                     'compactee', to_jsonb(p_maintenant))),
         version = c.version + 1
   where c.etape = 'close' and c.maj < p_maintenant - interval '90 days' and not (c.data ? 'compactee');
  get diagnostics n = row_count; r := r || jsonb_build_object('compactees', n);
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < $1' using p_maintenant - interval '7 days';
    get diagnostics n = row_count; r := r || jsonb_build_object('cron', n);
  end if;
  return r;
end
$$;

-- ── 4. LES DROITS SUR LES FONCTIONS ─────────────────────────────────────────
-- Les droits par défaut les ouvrent à anon et authenticated : `service_role`
-- SEULEMENT (vrm_acces_pour, 006, est le modèle). Ce bloc suit DIRECTEMENT
-- les fonctions : appliquée en morceaux (`essai-annule.cjs --morceaux`), la
-- migration ne laisse jamais une fonction ouverte entre deux transactions.
-- Les fonctions de déclencheur (§5, §6) se ferment là où elles naissent : elles
-- n'ont besoin d'aucun droit d'exécution pour se déclencher.
do $$
declare f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('vrm_agent_prendre', 'vrm_agent_prendre_cle', 'vrm_agent_rendre', 'vrm_agent_planifier',
                         'vrm_agent_ecrire_commande', 'vrm_agent_premiere_fois', 'vrm_agent_vu', 'vrm_agent_reserver',
                         'vrm_agent_rendre_reservation', 'vrm_agent_quota', 'vrm_agent_quota_recaler', 'vrm_agent_noter',
                         'vrm_agent_anonymiser_journal', 'vrm_agent_horloge_battre', 'vrm_agent_horloge_succes',
                         'vrm_agent_titulaire', 'vrm_agent_titulaire_liberer', 'vrm_ebay_indexer_annonces',
                         'vrm_agent_preuve_vue', 'vrm_agent_effacer_vendeur', 'vrm_agent_purger')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ── 5. LA GARDE DU JOURNAL (R19) ────────────────────────────────────────────
-- Une seule réécriture : `texte` → NULL avec `texte_retire_le`, rien d'autre.
-- Aucune suppression, sauf la purge (> 13 mois) et l'effacement d'un vendeur
-- (« Fermer mon compte »), qui passent par leurs fonctions. Elle tient même
-- face au rôle propriétaire (le serveur, lui, n'a de toute façon aucun droit
-- d'écriture sur cette table).
create or replace function public.vrm_agent_journal_garde()
returns trigger
language plpgsql
set search_path = ''
as $$
declare avant text;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'texte' - 'texte_retire_le') = (to_jsonb(old) - 'texte' - 'texte_retire_le')
       and new.texte is null
       and new.texte_retire_le is not null
       and (old.texte_retire_le is null or new.texte_retire_le = old.texte_retire_le) then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    if coalesce(current_setting('vrm.agent_effacer', true), '') = old.owner::text then return old; end if;
    avant := coalesce(current_setting('vrm.agent_purger_avant', true), '');
    if avant <> '' and old.at < avant::timestamptz then return old; end if;
  end if;
  raise exception using errcode = 'P0001', message = 'vrm_journal_immuable',
    detail = 'Le journal de l''agent ne se réécrit qu''une fois : effacer le texte à la demande d''eBay (vrm_agent_anonymiser_journal).';
end
$$;
revoke all on function public.vrm_agent_journal_garde() from public, anon, authenticated, service_role;
create or replace trigger vrm_agent_journal_garde before update or delete on public.vrm_agent_journal
  for each row execute function public.vrm_agent_journal_garde();
create or replace trigger vrm_agent_journal_garde_vider before truncate on public.vrm_agent_journal
  for each statement execute function public.vrm_agent_journal_garde();

-- ── 6. LA GARDE D'ÉCRITURE SUR `ebay_tokens*` (§5.1) ─────────────────────────
-- Les jetons eBay ne s'écrivent que par le serveur (clé de service). Un
-- navigateur (anon, authenticated — lu par `auth.role()`, et par le rôle
-- courant, comme `sauvegarde.noter_ecriture`) ne peut ni en créer, ni en
-- réécrire, ni en effacer une ligne, ni renommer une ligne en `ebay_tokens…`.
-- Mesuré le 11 octobre : seule la route serveur écrit cette ligne (aucun
-- écrivain dans l'app ni dans l'extension).
create or replace function public.vrm_garde_ebay_tokens()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') or current_user in ('authenticated', 'anon') then
    raise exception using errcode = 'P0001', message = 'vrm_ebay_tokens_serveur',
      detail = 'Les jetons eBay ne s''écrivent que par le serveur.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$$;
revoke all on function public.vrm_garde_ebay_tokens() from public, anon, authenticated, service_role;
create or replace trigger vrm_garde_ebay_tokens_ajout before insert on public.app_data
  for each row when (starts_with(new.id, 'ebay_tokens'))
  execute function public.vrm_garde_ebay_tokens();
create or replace trigger vrm_garde_ebay_tokens_maj before update on public.app_data
  for each row when (starts_with(old.id, 'ebay_tokens') or starts_with(new.id, 'ebay_tokens'))
  execute function public.vrm_garde_ebay_tokens();
create or replace trigger vrm_garde_ebay_tokens_retrait before delete on public.app_data
  for each row when (starts_with(old.id, 'ebay_tokens'))
  execute function public.vrm_garde_ebay_tokens();

-- ── 7. LE DÉCLENCHEUR JUMEAU DE `sauvegarde.noter_ecriture` ──────────────────
-- La trace des écritures sur les trois tables que le vendeur lit. Même forme
-- que l'original ; l'identifiant de ligne est « owner|clé » (ces tables n'ont
-- pas toutes un `id`). Une mesure ne bloque JAMAIS une écriture.
create schema if not exists sauvegarde;
create or replace function sauvegarde.noter_ecriture_agent()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare j jsonb := to_jsonb(new);
begin
  insert into sauvegarde.journal_ecritures(role, uid, tbl, row_id, op, agent)
  values (coalesce(auth.role(), current_user), auth.uid(), tg_table_name,
          coalesce(j ->> 'owner', '') || '|' || coalesce(j ->> 'id', (j ->> 'plateforme') || ':' || (j ->> 'compte') || ':' || (j ->> 'commande'), ''),
          tg_op, left(coalesce(current_setting('request.headers', true)::json ->> 'user-agent', ''), 80));
  return new;
exception when others then return new;  -- une mesure ne doit JAMAIS bloquer une écriture
end
$$;
revoke all on function sauvegarde.noter_ecriture_agent() from public;
create or replace trigger vrm_noter_ecriture after insert or update on public.vrm_agent_vendeurs
  for each row execute function sauvegarde.noter_ecriture_agent();
create or replace trigger vrm_noter_ecriture after insert or update on public.vrm_agent_commandes
  for each row execute function sauvegarde.noter_ecriture_agent();
create or replace trigger vrm_noter_ecriture after insert or update on public.vrm_agent_journal
  for each row execute function sauvegarde.noter_ecriture_agent();

-- ── 8. LE RÉGLAGE D'INSTALLATION ET LA LIGNE D'HORLOGE ──────────────────────
-- `agent_ebay` : '0' (rien ne tourne, pour personne) · 'proprietaire' (seul
-- VRM_OWNER_UID est servi : la position tant que Vercel est en Hobby [D7]) ·
-- '1' (tous, après Vercel Pro et l'« Application Growth Check » d'eBay). Un
-- réglage déjà posé n'est jamais écrasé.
insert into public.vrm_reglages (cle, valeur) values ('agent_ebay', '0') on conflict (cle) do nothing;
-- La ligne de l'horloge, à « -infinity » partout [D14].
insert into public.vrm_agent_horloge (id, dernier_tic, dernier_battement, dernier_succes)
values (1, '-infinity', '-infinity', '-infinity')
on conflict (id) do nothing;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION (lecture seule) :
--   node scripts/agent-sql/essai-annule.cjs --verifier   ⇒ une ligne, `ok` = true
--   (chaque corps de fonction comparé au fichier par md5, horloge, réglage,
--   aucun droit de navigateur sur une table ni une fonction de l'agent).
-- Retour arrière : aucun nécessaire pour les tables tant que la 015 n'est pas
-- posée (rien ne les lit ni ne les écrit, le réglage vaut '0'). La SEULE chose
-- qui agit dès l'application est la garde `ebay_tokens*` ; si elle gênait un
-- écrivain légitime oublié, la suspendre SANS DROP :
--   alter table public.app_data disable trigger vrm_garde_ebay_tokens_ajout;
--   (idem `_maj`, `_retrait`) — puis la rallumer (`enable trigger`).
-- Retirer les tables demanderait des DROP, confirmés à l'écran par Julien.
-- ════════════════════════════════════════════════════════════════════════════
