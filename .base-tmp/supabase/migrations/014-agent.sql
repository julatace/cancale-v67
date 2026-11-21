-- ════════════════════════════════════════════════════════════════════════════
-- 014 — LA MÉMOIRE DE L'AGENT eBAY (chantier K3, 11 octobre 2026 ; revue du
--        11 octobre au soir intégrée). PAS ENCORE APPLIQUÉE. Aucune horloge ici :
--        ni pg_cron, ni pg_net (c'est la 015, sur le oui de Julien).
-- ════════════════════════════════════════════════════════════════════════════
-- Julien : un agent eBay « 100 % autonome, qui ne dépend de personne ». Il
-- tournera VRM fermé, côté serveur, pour chaque vendeur et chaque compte eBay
-- (spécification : agent-ebay-autonome/spec-finale.md §5.1-5.2 ; synthèse §5).
-- Ce fichier lui donne une MÉMOIRE où les garanties vivent DANS LA BASE, face à
-- tout appelant de l'API (navigateur, clé de service, route boguée) :
--
--   • une FILE de tâches à BAIL : deux preneurs ne prennent jamais la même
--     tâche, et un compte eBay n'a jamais deux tâches en vol — battements ET
--     clics confondus [S24, D15, S15] ;
--   • l'état d'une commande écrit SOUS VERSION ET SOUS LE BAIL DE CETTE COMMANDE
--     (la clé de tâche est dérivée de la commande, jamais reçue) ; une écriture
--     périmée rend 0 ligne, et le rang ne descend jamais ;
--   • un JOURNAL de ce qui est fait en son nom, où l'on ajoute — sa seule
--     réécriture est l'effacement du texte, de la référence et du « défaire »
--     d'une entrée, à la demande d'eBay [S26] ;
--   • des MÉMOS « déjà fait » gardés au moins 100 jours [S25] ; ceux des gestes
--     qui engagent sont GLOBAUX par commande eBay, sous le propriétaire neutre [S5] ;
--   • des RÉSERVATIONS d'argent en une instruction, à 115 % du devis TTC [S9],
--     rendues une seule fois ; les plafonds du mois en cours ne se purgent jamais ;
--   • un REGISTRE DES TITULAIRES : un compte eBay n'est actif que chez UN
--     vendeur VRM [S5] ; son index d'annonces le suit et part avec lui ;
--   • l'HORLOGE à « -infinity » : jamais un NULL qui ferait ignorer chaque
--     battement pour toujours [D14] ;
--   • une PIERRE TOMBALE : « Fermer mon compte » ferme aussi la porte — plus rien
--     ne s'écrit au nom d'un vendeur effacé, même par un battement en vol.
--     L'effacement et les écrivains d'un même vendeur sont SÉRIALISÉS par un
--     verrou consultatif (exclusif pour effacer, partagé pour écrire, pris AVANT
--     toute lecture de la pierre tombale) : une écriture en vol finit avant
--     l'effacement et part avec le reste ; une écriture qui arrive pendant
--     attend, puis voit la pierre tombale. Et une ligne qui resterait malgré
--     tout ne fait jamais échouer le battement des AUTRES vendeurs ;
--   • la GARDE d'écriture sur `ebay_tokens*` : plus aucun navigateur ne peut
--     écrire, réécrire ni effacer un jeton eBay (§5.1) ;
--   • R18 en base, sur ce qui a une FORME : codes, noms de clés eBay, aucune clé
--     d'acheteur ni adresse email dans les champs JSON. Le texte libre (un
--     message envoyé, au journal) reste du ressort du code (K5, K13).
--
-- L'HEURE. Le temps est un paramètre (`p_maintenant`) pour le banc de vie sur
-- horloge simulée (K5) — et pour lui SEUL : sans la variable de session
-- `vrm.horloge_simulee = '1'` (que l'API ne sait pas poser), c'est l'heure du
-- SERVEUR qui compte, quoi que dise l'appelant. Une heure fausse (millisecondes
-- lues en secondes, fuseau mal lu) ne peut donc ni arrêter l'horloge, ni purger
-- le journal et les mémos, ni voler un bail. Et les DURÉES et ÉCHÉANCES reçues
-- sont bornées en base : un bail de plus de 10 minutes (120 000 « secondes »
-- qui étaient des millisecondes) est REFUSÉ, jamais posé — il gèlerait un
-- compte eBay 33 h — ; une prochaine fois ou une sonnette à plus d'un an est
-- refusée — elle ferait disparaître une veille sans qu'elle soit « manquante ».
-- Refusé, jamais réduit en silence : l'appelant le voit (false, NULL, rien).
--
-- QUI LIT, QUI ÉCRIT :
--   • lisibles par LEUR vendeur (RLS `owner = auth.uid()` + la restrictive
--     `abonnement_requis` : qui ne paie plus ne voit plus rien, règle du
--     4 octobre) : vrm_agent_vendeurs, vrm_agent_commandes, vrm_agent_journal ;
--     AUCUNE règle d'écriture, AUCUN droit d'écriture ;
--   • tout le reste : SERVEUR SEULEMENT (RLS activé, aucune règle — le modèle de
--     `vrm_reglages`), et `anon` ne lit rien du tout ;
--   • même le serveur (`service_role`, qui contourne RLS) n'écrit les tables à
--     garantie QUE par les fonctions ci-dessous. Un droit de table ne se
--     « contourne » pas comme RLS : c'est ce qui rend les garanties vraies face
--     à un bogue de route.
--   ⚠️ Le PROPRIÉTAIRE des tables (`postgres`, celui de l'outil SQL) garde, par
--     construction, les moyens de défaire n'importe quelle garde (désactiver un
--     déclencheur, accorder un droit). Aucune garde en base ne tient face à lui :
--     c'est `essai-annule.cjs --verifier` qui voit qu'une garde a été touchée.
--
-- TOUTES les fonctions : SECURITY DEFINER, search_path vide, exécutables par
-- `service_role` SEULEMENT (les aides internes : par personne).
--
-- ⚠️ AUCUN `DROP` dans ce fichier (l'outil SQL attend une confirmation humaine
--    pour un DROP). Réinstaller le fichier une seconde fois ne lève rien et ne
--    touche aucune donnée ; une table déjà là sous une AUTRE forme (une version
--    plus ancienne de ce fichier, y compris une contrainte du même NOM mais d'un
--    autre texte) fait tout refuser (`vrm_agent_forme`).
-- ⚠️ Les fonctions qui écrivent exigent READ COMMITTED (le défaut de PostgREST
--    et de Supabase) : la sérialisation avec l'effacement repose sur une
--    relecture APRÈS le verrou, qu'une transaction REPEATABLE READ ne fait pas.
--    Sous un autre niveau, elles refusent (`vrm_agent_isolation`).
-- ⚠️ « Fermer mon compte » (api/compte.js) devra appeler
--    `vrm_agent_effacer_vendeur(owner)` dès que l'agent écrit quelque chose :
--    le journal refuse toute autre suppression (voir §5).
--
-- APPLICATION (par la session principale, jamais en tâche de fond) : un essai
-- dans une transaction ANNULÉE d'abord (la méthode de la 013), puis
-- l'application, puis la vérification (`scripts/agent-sql/essai-annule.cjs`,
-- `--verifier`). Rien ne tourne après : des tables vides, un réglage à '0'.
-- Si l'outil SQL refuse le bloc entier, `--morceaux` le découpe en TROIS
-- transactions (tables et leurs droits · fonctions et leurs droits · gardes,
-- trace, pierre tombale, réglage) : chaque objet naît FERMÉ dans la transaction
-- qui le crée.
-- Preuve : scripts/audit-agent-sql.cjs (cette migration EXÉCUTÉE sur un Postgres
-- jetable qui imite la production : rôles, droits par défaut, RLS, 005-007, 013).
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

-- 1·0. R18 sur un champ JSON : aucune clé qui nomme l'acheteur ou son adresse,
--      à aucun niveau, et aucune valeur en forme d'adresse email. La VILLE est
--      permise : celle d'un devis, effacée avec lui (§5.6). Utilisée par les
--      contraintes des tables, d'où sa place ici.
create or replace function public.vrm_agent_sans_acheteur(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select j is null or (
    not pg_catalog.jsonb_path_exists(j, 'strict $.** ? (@.type() == "object").keyvalue() ? (@.key like_regex "^(shipto|shippingaddress|contactaddress|buyer|acheteur|destinataire|fullname|name|nom|prenom|firstname|lastname|username|pseudo|phone|phonenumber|primaryphone|tel|telephone|mobile|portable|email|mail|address|addressline|addressline1|addressline2|adresse|rue|street|postalcode|zip|zipcode|cp|codepostal|stateorprovince|county|companyname)$" flag "i")')
    and not pg_catalog.jsonb_path_exists(j, 'strict $.** ? (@.type() == "string" && @ like_regex "[^@ ]+@[^@ ]+[.][A-Za-z]{2,}")'))
$$;
revoke all on function public.vrm_agent_sans_acheteur(jsonb) from public, anon, authenticated, service_role;

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
  cles_shipto text[],                                      -- des NOMS de clés eBay, jamais les valeurs (R18)
  version integer not null default 0,
  maj timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,                 -- ≤ 2 Ko prévus ; 4 Ko refusés
  primary key (owner, plateforme, compte, commande),
  constraint vrm_agent_commandes_rang check (rang between 0 and 10),
  constraint vrm_agent_commandes_politique check (politique_etiquette is null or politique_etiquette in ('EBAY_ONLY', 'aucune')),
  constraint vrm_agent_commandes_pays check (pays is null or pays ~ '^[A-Z]{2}$'),
  -- R18 : des CODES, jamais du texte libre (un nom, une adresse, un téléphone
  -- ont une espace, une majuscule de prose ou un @).
  constraint vrm_agent_commandes_codes check (
        plateforme ~ '^[a-z]{1,20}$' and compte ~ '^[0-9A-Za-z_-]{0,64}$' and commande ~ '^[0-9A-Za-z_-]{1,64}$'
    and etape ~ '^[a-z0-9_]{1,40}$' and (branche is null or branche ~ '^[a-z0-9_]{1,40}$')
    and (etape_colis is null or etape_colis ~ '^[a-z0-9_]{1,40}$')
    and (voie is null or voie ~ '^[a-z0-9_.:-]{1,64}$') and (transporteur is null or transporteur ~ '^[a-z0-9_.:-]{1,64}$')
    and (numero is null or numero ~ '^[A-Za-z0-9]{0,16}$') and (suivi is null or suivi ~ '^[A-Za-z0-9-]{4,40}$')),
  constraint vrm_agent_commandes_data check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 4096
    and public.vrm_agent_sans_acheteur(data)),
  constraint vrm_agent_commandes_en_cours check (en_cours is null or (jsonb_typeof(en_cours) = 'object'
    and octet_length(en_cours::text) <= 1024 and public.vrm_agent_sans_acheteur(en_cours))),
  -- Les seuls noms permis sont ceux de `shipTo` chez eBay (Fulfillment), seuls
  -- ou sous `contactAddress.` / `primaryPhone.` : « Dupont », « Cancale »,
  -- « Jean Dupont » ne sont pas des noms de clés.
  constraint vrm_agent_commandes_shipto check (cles_shipto is null or (cardinality(cles_shipto) <= 30
    and array_to_string(cles_shipto, '|', '?') ~ '^((contactAddress[.]|primaryPhone[.])?(fullName|companyName|email|contactAddress|primaryPhone|addressLine1|addressLine2|city|stateOrProvince|postalCode|countryCode|county|phoneNumber)([|]|$))*$')));

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
  texte text,                   -- le texte EXACT de ce qui est parti en son nom (relisible, anonymisable)
  ref text,                     -- un IDENTIFIANT (n° d'envoi, référence) — jamais une phrase
  source text,
  defaire jsonb,                -- de quoi défaire le geste (un prix d'avant…), ≤ 2 Ko
  texte_retire_le timestamptz,  -- R19 : « texte retiré à la demande d'eBay »
  constraint vrm_agent_journal_resultat check (resultat in ('fait', 'refuse', 'incertain', 'aurait-fait', 'ecarte')),
  constraint vrm_agent_journal_texte check (texte is null or octet_length(texte) <= 4000),
  constraint vrm_agent_journal_codes check (
        geste ~ '^[a-z0-9_-]{1,40}$' and (compte is null or compte ~ '^[0-9A-Za-z_-]{0,64}$')
    and (cible is null or cible ~ '^[A-Za-z0-9_.:-]{1,64}$') and (numero is null or numero ~ '^[A-Za-z0-9]{0,16}$')
    and (source is null or source ~ '^[a-z0-9_.:-]{1,64}$') and (ref is null or ref ~ '^[A-Za-z0-9_.:/#-]{1,120}$')),
  constraint vrm_agent_journal_defaire check (defaire is null or (jsonb_typeof(defaire) = 'object'
    and octet_length(defaire::text) <= 2048 and public.vrm_agent_sans_acheteur(defaire))));
create index if not exists vrm_agent_journal_owner_at on public.vrm_agent_journal (owner, at desc);
create index if not exists vrm_agent_journal_owner_cible on public.vrm_agent_journal (owner, cible);

-- 1b. Serveur seulement.
create table if not exists public.vrm_agent_file (
  owner uuid not null,
  cle text not null,                                       -- ebay:{s}:veille · ebay:{s}:cmd:{orderId} · vendeur:doubles …
  groupe text not null,                                    -- le compte eBay : UN appel en vol par groupe
  prochain timestamptz not null,
  bail_jeton uuid,
  bail_jusqua timestamptz,
  essais integer not null default 0,
  raison text,                                             -- un CODE (« ebay-503 »), jamais une réponse brute (R18)
  reveil timestamptz,                                      -- une sonnette arrivée pendant le bail : jamais perdue
  primary key (owner, cle),
  constraint vrm_agent_file_bail check ((bail_jeton is null) = (bail_jusqua is null)),
  constraint vrm_agent_file_essais check (essais >= 0),
  constraint vrm_agent_file_codes check (cle ~ '^[A-Za-z0-9_.:-]{1,200}$' and groupe ~ '^[A-Za-z0-9_.:-]{0,64}$'
    and (raison is null or raison ~ '^[a-z0-9_.:-]{1,64}$')));
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
  compte text not null default '',                         -- son libellé chez CE vendeur : unique (il nomme ses tâches)
  depuis timestamptz not null default now(),
  constraint vrm_ebay_titulaires_cle check (cle_ebay ~ '^[0-9a-f]{16}$' and compte ~ '^[0-9A-Za-z_-]{0,64}$'),
  constraint vrm_ebay_titulaires_libelle unique (owner, compte));
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

create table if not exists public.vrm_agent_effaces (        -- la PIERRE TOMBALE d'un vendeur qui a fermé son compte
  owner uuid primary key,
  le timestamptz not null default now());

create table if not exists public.vrm_agent_marques (        -- les marques de TRANSACTION de la purge et de l'effacement
  xid bigint not null,                                     --   (txid_current) : la garde du journal ne laisse partir des
  quoi text not null,                                      --   lignes que dans la transaction de ces deux fonctions
  owner uuid,
  avant timestamptz,
  primary key (xid, quoi),
  constraint vrm_agent_marques_quoi check (quoi in ('effacer', 'purger')));

-- 1c. LA FORME. `create table if not exists` SAUTE en silence une table déjà là
--     sous une autre forme (une version plus ancienne de ce fichier) : l'erreur
--     n'apparaîtrait qu'à l'exécution (« column f.reveil does not exist »). On
--     compare donc chaque table à son empreinte (colonnes, types, NOT NULL, et
--     chaque contrainte : son NOM et une empreinte de son TEXTE, md5 de
--     `pg_get_constraintdef` sans « public. ») : un écart fait tout refuser,
--     rien n'est installé. Le NOM seul ne suffisait pas : une table d'avant dont
--     la contrainte R18 du même nom vaut `check (true)` était réutilisée en
--     silence, et la 014 corrigée, réappliquée, la gardait.
--     `essai-annule.cjs --verifier` relit la MÊME empreinte ET la MÊME expression
--     (celle qui suit `select`, jusqu'à `into v`) dans ce fichier.
--     ⚠️ Changer une contrainte change son empreinte : l'installation neuve de
--     l'audit refuse alors en donnant la nouvelle valeur (`detail`), à recopier
--     ici. Mesurée identique en Postgres 16.14 et 17.6.
do $$
declare
  attendu constant jsonb := $empreinte${
    "vrm_agent_vendeurs": "owner uuid !, actif boolean !, reglages jsonb !, reglages_version integer !, repetition jsonb !, pouls jsonb !, reverif_jusqua timestamp with time zone, maj timestamp with time zone ! | vrm_agent_vendeurs_formes=116a432ad517, vrm_agent_vendeurs_pkey=27e717ec98bb",
    "vrm_agent_commandes": "owner uuid !, plateforme text !, compte text !, commande text !, etape text !, rang integer !, branche text, numero text, voie text, limite timestamp with time zone, transporteur text, suivi text, etape_colis text, colis_le timestamp with time zone, en_cours jsonb, politique_etiquette text, pays text, pickup boolean, reference_programme boolean, cles_shipto text[], version integer !, maj timestamp with time zone !, data jsonb ! | vrm_agent_commandes_codes=72cca1e8327d, vrm_agent_commandes_data=4afe548af558, vrm_agent_commandes_en_cours=2f87c2de3319, vrm_agent_commandes_pays=9319441f18df, vrm_agent_commandes_pkey=170543a69c79, vrm_agent_commandes_politique=7894c5f9f28a, vrm_agent_commandes_rang=7e059deb9fcf, vrm_agent_commandes_shipto=dd7b4d471160",
    "vrm_agent_journal": "id bigint !, owner uuid !, compte text, at timestamp with time zone !, geste text !, cible text, numero text, resultat text !, centimes integer, texte text, ref text, source text, defaire jsonb, texte_retire_le timestamp with time zone | vrm_agent_journal_codes=b9fc37f3acbf, vrm_agent_journal_defaire=39dbf5eb5a8f, vrm_agent_journal_pkey=4c6419b37043, vrm_agent_journal_resultat=c566ce4cf418, vrm_agent_journal_texte=ce061b28c3d1",
    "vrm_agent_file": "owner uuid !, cle text !, groupe text !, prochain timestamp with time zone !, bail_jeton uuid, bail_jusqua timestamp with time zone, essais integer !, raison text, reveil timestamp with time zone | vrm_agent_file_bail=3817e0d52e2e, vrm_agent_file_codes=700ff24e9934, vrm_agent_file_essais=825e629b238d, vrm_agent_file_pkey=8b2a24b5e6f0",
    "vrm_agent_compteurs": "owner uuid !, cle text !, n integer !, centimes bigint !, maj timestamp with time zone ! | vrm_agent_compteurs_pkey=8b2a24b5e6f0, vrm_agent_compteurs_positifs=ed89b41ebeb1",
    "vrm_agent_vus": "owner uuid !, cle text !, at timestamp with time zone ! | vrm_agent_vus_pkey=8b2a24b5e6f0",
    "vrm_agent_memos": "owner uuid !, cle text !, at timestamp with time zone !, expire timestamp with time zone ! | vrm_agent_memos_cent_jours=f635393ea0c2, vrm_agent_memos_pkey=8b2a24b5e6f0",
    "vrm_agent_routes": "k text !, owner uuid !, compte text, fournisseur text !, cree timestamp with time zone !, revoque timestamp with time zone | vrm_agent_routes_opaque=3206f2ef3bc9, vrm_agent_routes_pkey=606573f57e77",
    "vrm_agent_horloge": "id integer !, dernier_tic timestamp with time zone !, dernier_battement timestamp with time zone !, dernier_succes timestamp with time zone ! | vrm_agent_horloge_id_check=d1e072e92488, vrm_agent_horloge_pkey=4c6419b37043",
    "vrm_ebay_cles_publiques": "kid text !, pem text !, lu timestamp with time zone ! | vrm_ebay_cles_publiques_pkey=025f593b821c",
    "vrm_coffre": "owner uuid !, compte text !, fournisseur text !, v integer !, nonce bytea !, chiffre bytea !, tag bytea !, etat text, teste_le timestamp with time zone, maj timestamp with time zone ! | vrm_coffre_gcm=f9deb2479952, vrm_coffre_pkey=10dd5d77e957",
    "vrm_ebay_titulaires": "cle_ebay text !, owner uuid !, compte text !, depuis timestamp with time zone ! | vrm_ebay_titulaires_cle=d7f6901371c6, vrm_ebay_titulaires_libelle=a15d21d09601, vrm_ebay_titulaires_pkey=191afbc59980",
    "vrm_ebay_annonces_index": "listing_id text !, owner uuid !, compte text !, maj timestamp with time zone ! | vrm_ebay_annonces_index_id=6fa9b0ceaf82, vrm_ebay_annonces_index_pkey=389f0ae8d81d",
    "vrm_agent_preuves": "owner uuid !, numero_cle text !, source text !, ref text !, vue_le timestamp with time zone ! | vrm_agent_preuves_non_vides=89d175d462fd, vrm_agent_preuves_pkey=1394297198fe",
    "vrm_agent_effaces": "owner uuid !, le timestamp with time zone ! | vrm_agent_effaces_pkey=27e717ec98bb",
    "vrm_agent_marques": "xid bigint !, quoi text !, owner uuid, avant timestamp with time zone | vrm_agent_marques_pkey=256d2282284a, vrm_agent_marques_quoi=161592d72c4f"
  }$empreinte$;
  t text;
  a text;
  v text;
  d text;
begin
  for t, a in select e.key, e.value from jsonb_each_text(attendu) e loop
    select coalesce((select string_agg(x.attname || ' ' || pg_catalog.format_type(x.atttypid, x.atttypmod) || case when x.attnotnull then ' !' else '' end, ', ' order by x.attnum)
                       from pg_catalog.pg_attribute x where x.attrelid = c.oid and x.attnum > 0 and not x.attisdropped), '')
           || ' | ' || coalesce((select string_agg(k.conname || '=' || pg_catalog.substr(pg_catalog.md5(pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', '')), 1, 12), ', ' order by k.conname)
                                   from pg_catalog.pg_constraint k where k.conrelid = c.oid and k.contype in ('c', 'f', 'p', 'u', 'x')), '')
      into v
      from pg_catalog.pg_class c where c.oid = pg_catalog.to_regclass('public.' || t);
    if v is distinct from a then
      select pg_catalog.string_agg(k.conname || ' ' || pg_catalog.pg_get_constraintdef(k.oid), ' · ' order by k.conname) into d
        from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t) and k.contype in ('c', 'f', 'p', 'u', 'x');
      raise exception using errcode = 'P0001', message = 'vrm_agent_forme',
        detail = 'public.' || t || ' existe déjà sous une autre forme : ' || coalesce(v, '(absente)') || ' — contraintes en place : ' || coalesce(d, '(aucune)'),
        hint = 'attendu : ' || a || ' — rien n''est installé ; à trancher à la main (jamais par un DROP en tâche de fond).';
    end if;
  end loop;
end $$;

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
                           'vrm_ebay_titulaires', 'vrm_ebay_annonces_index', 'vrm_agent_preuves', 'vrm_agent_effaces',
                           'vrm_agent_marques'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
    -- Les marques de transaction ne se lisent pas, même par le serveur.
    if t <> 'vrm_agent_marques' then
      execute format('grant select on public.%I to service_role', t);
    end if;
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

-- Ce que le serveur écrit DIRECTEMENT (aucune garantie à tenir au-delà de RLS ;
-- la pierre tombale y vaut aussi, par déclencheur) :
grant insert, update on public.vrm_agent_vendeurs to service_role;
grant insert on public.vrm_agent_vus to service_role;
grant insert, update on public.vrm_agent_routes to service_role;
grant insert, update, delete on public.vrm_ebay_cles_publiques to service_role;
grant insert, update, delete on public.vrm_coffre to service_role;
-- Tout le reste ne s'écrit que par les fonctions du §3 (file, commandes,
-- journal, compteurs, mémos, titulaires, index, preuves, horloge, pierres
-- tombales, marques).
revoke all on sequence public.vrm_agent_journal_id_seq from public, anon, authenticated, service_role;

-- ── 3. LES FONCTIONS ────────────────────────────────────────────────────────

-- 3·0. L'HEURE : celle de l'appelant SEULEMENT sur horloge simulée (le banc),
--      sinon celle du serveur (voir l'en-tête). Une aide interne.
create or replace function public.vrm_agent_heure(p timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when pg_catalog.current_setting('vrm.horloge_simulee', true) = '1'
              then coalesce(p, pg_catalog.now()) else pg_catalog.now() end
$$;

-- 3·1. La PIERRE TOMBALE : ce vendeur a fermé son compte. Une aide interne.
--      Elle prend D'ABORD le verrou PARTAGÉ du vendeur — « Fermer mon compte »
--      prend le même en EXCLUSIF (§3r) — PUIS relit la pierre tombale :
--        • un écrivain déjà en vol tient le verrou : l'effacement l'attend, et
--          ses lignes partent avec le reste ;
--        • un écrivain qui arrive pendant l'effacement attend, puis VOIT la
--          pierre tombale (validée) et refuse.
--      Lue sans ce verrou, la pierre tombale n'était visible qu'au COMMIT de
--      l'effacement : une sonnette ou une ligne de journal écrite pendant ces
--      quelques secondes survivait (le texte de l'acheteur compris), et une
--      tâche orpheline faisait échouer `prendre` pour TOUS les vendeurs.
--      ⚠️ VOLATILE et plpgsql, exprès : chaque instruction y prend un instantané
--      NEUF (READ COMMITTED), donc la lecture qui suit le verrou voit ce qui a
--      été validé pendant l'attente. STABLE, elle relirait l'instantané d'AVANT
--      l'attente (`--verifier` contrôle la volatilité). Pour la même raison, une
--      transaction REPEATABLE READ ou SERIALIZABLE est refusée.
create or replace function public.vrm_agent_efface(p_owner uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_owner is null then return false; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'P0001', message = 'vrm_agent_isolation',
      detail = 'L''agent écrit en READ COMMITTED (le défaut de PostgREST) : sous un autre niveau, la pierre tombale serait relue sur un instantané d''avant le verrou.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock_shared(pg_catalog.hashtext('vrm_agent_vendeur'), pg_catalog.hashtext(p_owner::text));
  return exists (select 1 from public.vrm_agent_effaces e where e.owner = p_owner);
end
$$;

-- 3a. PRENDRE des tâches dues. ≤ 2 par vendeur, ≤ 1 par groupe (compte eBay),
--     et JAMAIS un groupe qui a déjà une tâche en vol, battement ou clic [S24,
--     D15] : un bail vivant l'exclut, et un verrou consultatif par groupe ferme
--     la course entre deux preneurs simultanés.
--     Les candidats sont choisis EN SQL, avant toute limite : au plus UNE tâche
--     par compte libre et 4 par vendeur, la plus en retard d'abord. Un arriéré de
--     250 tâches sur un compte n'y occupe qu'une place : les autres vendeurs et
--     les autres comptes passent dans le même battement.
--     Seule la ligne PRISE est verrouillée, et `skip locked` : un battement ne
--     bloque JAMAIS derrière un autre (ni derrière un clic qui tient sa tâche).
--     Un vendeur EFFACÉ (pierre tombale) n'est jamais candidat, et un vendeur en
--     cours d'effacement (verrou exclusif tenu ou demandé) est sauté sans
--     attendre : une ligne restée à son nom ne fait JAMAIS échouer le battement
--     des autres vendeurs (elle levait `vrm_vendeur_efface` pour tout le monde).
--     Le bail est BORNÉ : 1 à 600 s. Au-delà, rien n'est pris (120 000
--     « secondes » qui étaient des millisecondes geleraient un compte 33 h).
create or replace function public.vrm_agent_prendre(p_lim integer, p_jeton uuid, p_bail_s integer, p_maintenant timestamptz default now())
returns table (owner uuid, cle text, groupe text, essais integer, raison text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  c record;
  pris integer := 0;
  par_vendeur jsonb := '{}'::jsonb;
  groupes text[] := '{}';
  k text;
begin
  if p_jeton is null or p_lim is null or p_lim < 1 or p_bail_s is null or p_bail_s < 1 or p_bail_s > 600 then
    return;
  end if;
  for c in
    with dues as (
      select f.owner, f.cle, f.groupe, f.prochain
        from public.vrm_agent_file f
       where f.prochain <= maintenant
         and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant
         and not exists (select 1 from public.vrm_agent_file g
                          where g.owner = f.owner and g.groupe = f.groupe and g.bail_jusqua >= maintenant)
         and not exists (select 1 from public.vrm_agent_effaces e where e.owner = f.owner)
    ), une_par_groupe as (
      select distinct on (d.owner, d.groupe) d.owner, d.cle, d.groupe, d.prochain
        from dues d
       order by d.owner, d.groupe, d.prochain, d.cle
    ), classees as (
      select u.owner, u.cle, u.groupe, u.prochain,
             row_number() over (partition by u.owner order by u.prochain, u.cle) as rang_vendeur
        from une_par_groupe u
    )
    select x.owner, x.cle, x.groupe
      from classees x
     where x.rang_vendeur <= 4
     order by x.prochain, x.owner, x.cle
     limit least(p_lim, 100) * 4
  loop
    exit when pris >= p_lim;
    k := c.owner::text || '|' || c.groupe;
    continue when k = any (groupes);
    continue when coalesce((par_vendeur ->> c.owner::text)::integer, 0) >= 2;
    -- Le vendeur d'abord : verrou PARTAGÉ sans attendre (un effacement en cours
    -- ⇒ on passe, sans avoir pris le verrou de son compte), puis la pierre
    -- tombale relue APRÈS ce verrou.
    continue when not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtext('vrm_agent_vendeur'), pg_catalog.hashtext(c.owner::text));
    continue when exists (select 1 from public.vrm_agent_effaces e where e.owner = c.owner);
    continue when not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_groupe'), pg_catalog.hashtext(k));
    continue when exists (select 1 from public.vrm_agent_file g
                           where g.owner = c.owner and g.groupe = c.groupe and g.cle <> c.cle
                             and g.bail_jusqua >= maintenant);
    -- La ligne elle-même : verrouillée sans attendre (tenue ailleurs ⇒ on passe)
    -- et revérifiée sur sa DERNIÈRE version.
    perform 1 from public.vrm_agent_file f
     where f.owner = c.owner and f.cle = c.cle and f.prochain <= maintenant
       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant
       for update of f skip locked;
    continue when not found;
    update public.vrm_agent_file f
       set bail_jeton = p_jeton,
           bail_jusqua = maintenant + pg_catalog.make_interval(secs => p_bail_s),
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
--     R8], sous la MÊME règle de compte : tâche tenue, ou AUTRE tâche du même
--     compte eBay en vol (un battement, un autre clic) ⇒ false : la route
--     répond 409 « l'agent travaille sur ce compte eBay ». Tâche absente : elle
--     est créée tenue si l'appelant donne son groupe. Bail borné (1 à 600 s) :
--     au-delà, false.
create or replace function public.vrm_agent_prendre_cle(p_owner uuid, p_cle text, p_jeton uuid, p_bail_s integer,
                                                        p_maintenant timestamptz default now(), p_groupe text default null)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  grp text;
begin
  if p_owner is null or p_cle is null or p_jeton is null or p_bail_s is null or p_bail_s < 1 or p_bail_s > 600
     or public.vrm_agent_efface(p_owner) then
    return false;
  end if;
  select f.groupe into grp from public.vrm_agent_file f where f.owner = p_owner and f.cle = p_cle;
  if not found then
    if p_groupe is null then return false; end if;
    grp := p_groupe;
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_groupe'), pg_catalog.hashtext(p_owner::text || '|' || grp)) then
    return false;
  end if;
  if exists (select 1 from public.vrm_agent_file f
              where f.owner = p_owner and f.groupe = grp and f.cle <> p_cle and f.bail_jusqua >= maintenant) then
    return false;
  end if;
  update public.vrm_agent_file f
     set bail_jeton = p_jeton, bail_jusqua = maintenant + pg_catalog.make_interval(secs => p_bail_s), reveil = null
   where f.owner = p_owner and f.cle = p_cle
     and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < maintenant;
  if found then return true; end if;
  if exists (select 1 from public.vrm_agent_file f where f.owner = p_owner and f.cle = p_cle) then
    return false;
  end if;
  insert into public.vrm_agent_file (owner, cle, groupe, prochain, bail_jeton, bail_jusqua)
  values (p_owner, p_cle, grp, maintenant, p_jeton, maintenant + pg_catalog.make_interval(secs => p_bail_s))
  on conflict (owner, cle) do nothing;
  return found;
end
$$;

-- 3c. RENDRE une tâche : seulement si le bail porte CE jeton. La tâche n'est
--     RETIRÉE que sur un « fini » explicite (`p_fini`), sans échec et sans
--     sonnette en attente (`reveil`). « Pas de prochaine fois » sans « fini », ou
--     un échec, la GARDE (dans 15 min) : « pas su » ne détruit jamais une tâche.
--     La raison est un CODE : une réponse brute devient « raison-illisible ».
--     Une prochaine fois à plus d'un an (« dans 15 min » écrit en millisecondes :
--     l'an 58 748) est REFUSÉE (false) : la tâche reste tenue, et revient à la
--     fin de son bail (≤ 10 min) — jamais une veille rangée hors du temps, que
--     le secours ne recréerait pas puisqu'elle n'est pas « manquante ».
create or replace function public.vrm_agent_rendre(p_owner uuid, p_cle text, p_jeton uuid, p_prochain timestamptz,
                                                   p_echec boolean default false, p_raison text default null,
                                                   p_fini boolean default false, p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  r public.vrm_agent_file%rowtype;
  fini boolean := coalesce(p_fini, false) and p_prochain is null and not coalesce(p_echec, false);
begin
  if p_owner is null or p_cle is null or p_jeton is null or p_prochain > maintenant + interval '1 year'
     or public.vrm_agent_efface(p_owner) then
    return false;
  end if;
  select * into r from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton
     for update;
  if not found then return false; end if;
  if fini and r.reveil is null then
    delete from public.vrm_agent_file f where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton;
    return true;
  end if;
  update public.vrm_agent_file f
     set bail_jeton = null,
         bail_jusqua = null,
         prochain = case when fini then r.reveil
                         else least(coalesce(p_prochain, maintenant + interval '15 minutes'), coalesce(r.reveil, 'infinity'::timestamptz)) end,
         reveil = null,
         essais = case when coalesce(p_echec, false) then f.essais + 1 else 0 end,
         raison = case when p_raison is null then null
                       when p_raison ~ '^[a-z0-9_.:-]{1,64}$' then p_raison
                       else 'raison-illisible' end
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton;
  return true;
end
$$;

-- 3d. PLANIFIER « au plus tard à `p_quand` » : ne recule jamais une échéance,
--     ne vole jamais un bail. Si la tâche est TENUE (bail vivant, ou expiré mais
--     pas encore repris : un appel lent peut encore rendre « dans 6 h »), la
--     sonnette est gardée dans `reveil` et `rendre` la respecte. Une échéance à
--     plus d'un an est refusée (NULL) : une tâche neuve rangée en l'an 58 748
--     ne serait jamais « manquante », donc jamais recréée par le secours.
create or replace function public.vrm_agent_planifier(p_owner uuid, p_cle text, p_groupe text, p_quand timestamptz,
                                                      p_maintenant timestamptz default now())
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  p timestamptz;
begin
  if p_owner is null or p_cle is null or p_groupe is null or p_quand is null or p_quand > maintenant + interval '1 year'
     or public.vrm_agent_efface(p_owner) then
    return null;
  end if;
  insert into public.vrm_agent_file as f (owner, cle, groupe, prochain)
  values (p_owner, p_cle, p_groupe, p_quand)
  on conflict (owner, cle) do update
     set prochain = least(f.prochain, excluded.prochain),
         reveil = case when f.bail_jeton is not null
                       then least(coalesce(f.reveil, 'infinity'::timestamptz), excluded.prochain)
                       else f.reveil end
  returning f.prochain into p;
  return p;
end
$$;

-- 3e. ÉCRIRE l'état d'une commande. La tâche qui la tient est DÉRIVÉE de la
--     commande (`{plateforme}:{compte}:cmd:{commande}`), jamais reçue : une
--     MODIFICATION exige le bail de CETTE tâche-là (la veille d'un compte ne
--     réécrit pas une commande qu'un clic est en train d'acheter). Une CRÉATION
--     (`p_version_lue` NULL, seulement si absente) exige le bail d'une tâche de
--     ce vendeur et de CE compte eBay (sa veille, ou la tâche de la commande).
--     0 ligne (NULL) si la version a bougé ou si le bail n'est pas tenu ⇒ on
--     relit, on n'écrase jamais. Le rang ne descend jamais (§5.6) : une écriture
--     qui le ferait est une erreur de code, et elle est DITE (`vrm_rang_descend`).
--     Le bail est verrouillé (FOR SHARE) le temps de l'écriture : un preneur ne
--     peut pas le reprendre entre la vérification et l'écriture.
create or replace function public.vrm_agent_ecrire_commande(p_owner uuid, p_jeton uuid, p_compte text, p_commande text,
                                                            p_version_lue integer, p_colonnes jsonb,
                                                            p_plateforme text default 'ebay', p_maintenant timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  pf text := coalesce(p_plateforme, 'ebay');
  k_cle text;
  v integer;
  ligne public.vrm_agent_commandes%rowtype;
  neuf public.vrm_agent_commandes%rowtype;
begin
  if p_owner is null or p_jeton is null or p_compte is null or p_commande is null
     or p_colonnes is null or jsonb_typeof(p_colonnes) <> 'object' or public.vrm_agent_efface(p_owner) then
    return null;
  end if;
  k_cle := pf || ':' || p_compte || ':cmd:' || p_commande;
  if p_version_lue is null then
    perform 1 from public.vrm_agent_file f
     where f.owner = p_owner and f.groupe = p_compte and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant
       for share of f;
    if not found then return null; end if;
    insert into public.vrm_agent_commandes as c
           (owner, plateforme, compte, commande, etape, rang, branche, numero, voie, limite, transporteur, suivi,
            etape_colis, colis_le, en_cours, politique_etiquette, pays, pickup, reference_programme, cles_shipto,
            data, version, maj)
    select p_owner, pf, p_compte, p_commande, x.etape, x.rang, x.branche, x.numero, x.voie,
           x.limite, x.transporteur, x.suivi, x.etape_colis, x.colis_le, x.en_cours, x.politique_etiquette, x.pays,
           x.pickup, x.reference_programme, x.cles_shipto, coalesce(x.data, '{}'::jsonb), 1, maintenant
      from jsonb_populate_record(null::public.vrm_agent_commandes, p_colonnes) x
    on conflict (owner, plateforme, compte, commande) do nothing
    returning c.version into v;
    return v;
  end if;
  perform 1 from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = k_cle and f.bail_jeton = p_jeton and f.bail_jusqua > maintenant
     for share of f;
  if not found then return null; end if;
  select * into ligne from public.vrm_agent_commandes c
   where c.owner = p_owner and c.plateforme = pf and c.compte = p_compte and c.commande = p_commande
     and c.version = p_version_lue
     for update of c;
  if not found then return null; end if;
  neuf := jsonb_populate_record(ligne, p_colonnes);
  if neuf.rang < ligne.rang then
    raise exception using errcode = 'P0001', message = 'vrm_rang_descend',
      detail = 'commande ' || p_commande || ' : rang ' || ligne.rang || ' → ' || neuf.rang || ' (le rang ne descend jamais)';
  end if;
  update public.vrm_agent_commandes c
     set etape = neuf.etape, rang = neuf.rang, branche = neuf.branche, numero = neuf.numero, voie = neuf.voie,
         limite = neuf.limite, transporteur = neuf.transporteur, suivi = neuf.suivi, etape_colis = neuf.etape_colis,
         colis_le = neuf.colis_le, en_cours = neuf.en_cours, politique_etiquette = neuf.politique_etiquette,
         pays = neuf.pays, pickup = neuf.pickup, reference_programme = neuf.reference_programme,
         cles_shipto = neuf.cles_shipto, data = neuf.data,
         version = c.version + 1,
         maj = maintenant
   where c.owner = p_owner and c.plateforme = pf and c.compte = p_compte and c.commande = p_commande
     and c.version = p_version_lue
  returning c.version into v;
  return v;
end
$$;

-- 3f. « PREMIÈRE FOIS » d'un geste : true UNE seule fois, le mémo est écrit
--     AVANT le geste (R5). Gardé au moins 100 jours [S25]. Les clés des gestes
--     qui engagent (achat:, msg:, eval:, offre:) sont GLOBALES : rangées sous le
--     propriétaire neutre QUEL QUE SOIT l'appelant [S5, R10].
create or replace function public.vrm_agent_premiere_fois(p_owner uuid, p_cle text, p_expire timestamptz default null,
                                                          p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  o uuid := p_owner;
  ok boolean;
begin
  if p_owner is null or p_cle is null or p_cle = '' or public.vrm_agent_efface(p_owner) then return false; end if;
  if p_cle ~ '^(achat|msg|eval|offre):' then o := '00000000-0000-0000-0000-000000000000'; end if;
  insert into public.vrm_agent_memos (owner, cle, at, expire)
  values (o, p_cle, maintenant, greatest(coalesce(p_expire, maintenant), maintenant + interval '100 days'))
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
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  ok boolean;
begin
  if p_owner is null or p_cle is null or p_cle = '' or public.vrm_agent_efface(p_owner) then return false; end if;
  insert into public.vrm_agent_vus (owner, cle, at) values (p_owner, p_cle, maintenant)
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
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  montant integer;
  jour text;
  mois text;
  cj text;
  cm text;
  j record;
  m record;
  id uuid := gen_random_uuid();
begin
  if p_owner is null or p_compte is null or p_compte !~ '^[0-9A-Za-z_-]{0,64}$'
     or p_centimes_ttc is null or p_centimes_ttc <= 0
     or p_plafond_geste is null or p_plafond_jour_n is null or p_plafond_jour_centimes is null or p_plafond_mois_centimes is null then
    return jsonb_build_object('ok', false, 'raison', 'pas-su');
  end if;
  if public.vrm_agent_efface(p_owner) then
    return jsonb_build_object('ok', false, 'raison', 'efface');
  end if;
  montant := (p_centimes_ttc::bigint * 115 + 99) / 100;   -- ceil(× 1,15), en entiers
  if montant > p_plafond_geste then
    return jsonb_build_object('ok', false, 'raison', 'geste', 'centimes', montant);
  end if;
  jour := to_char(maintenant at time zone 'Europe/Paris', 'YYYY-MM-DD');
  mois := to_char(maintenant at time zone 'Europe/Paris', 'YYYY-MM');
  cj := 'argent:jour:' || p_compte || ':' || jour;
  cm := 'argent:mois:' || mois;
  insert into public.vrm_agent_compteurs (owner, cle, maj) values (p_owner, cj, maintenant), (p_owner, cm, maintenant)
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
  update public.vrm_agent_compteurs k set n = k.n + 1, centimes = k.centimes + montant, maj = maintenant
   where k.owner = p_owner and k.cle in (cj, cm);
  insert into public.vrm_agent_compteurs (owner, cle, n, centimes, maj)
  values (p_owner, 'resa:' || id::text || '|' || cj || '|' || cm, 1, montant, maintenant);
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
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  k text;
  c bigint;
begin
  if p_owner is null or p_reservation is null or public.vrm_agent_efface(p_owner) then return false; end if;
  delete from public.vrm_agent_compteurs x
   where x.owner = p_owner and x.cle like 'resa:' || p_reservation::text || '|%'
  returning x.cle, x.centimes into k, c;
  if not found then return false; end if;
  update public.vrm_agent_compteurs x
     set n = greatest(x.n - 1, 0), centimes = greatest(x.centimes - c, 0), maj = maintenant
   where x.owner = p_owner and x.cle in (split_part(k, '|', 2), split_part(k, '|', 3));
  return true;
end
$$;

-- 3j. Le QUOTA d'appels (Trading : 5 000 par jour pour TOUTE l'application),
--     réservé AVANT l'appel, sous le propriétaire neutre : `obligation` jusqu'à
--     100 % (20 % lui sont gardés), `detection` jusqu'à 80 %, `confort` jusqu'à
--     60 % ; hors obligation, au plus 1 % par compte et par jour (§4.8) — et
--     un vendeur INCONNU (NULL) hors obligation est refusé : « pas su » n'est
--     jamais plus permissif. `p_cle` porte le jour (« trading:2026-10-11 »).
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
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
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
  if p_priorite <> 'obligation' and p_owner is null then return false; end if;
  -- Le verrou du vendeur AVANT le compteur `cc` (qui le NOMME, sous le neutre,
  -- où le déclencheur de la pierre tombale ne le voit pas) : un effacement
  -- attend la fin de cet appel, et efface son compteur avec le reste ; un appel
  -- qui arrive pendant l'effacement attend, puis est refusé sans rien écrire.
  if p_owner is not null and public.vrm_agent_efface(p_owner) then return false; end if;
  lim := floor(p_plafond * seuil)::integer;
  if p_priorite <> 'obligation' then
    cc := p_cle || '|' || p_owner::text || '|' || coalesce(p_compte, '');
    par_compte := greatest(1, ceil(p_plafond * 0.01)::integer);
  end if;
  insert into public.vrm_agent_compteurs (owner, cle, maj) values (neutre, p_cle, maintenant) on conflict (owner, cle) do nothing;
  if cc is not null then
    insert into public.vrm_agent_compteurs (owner, cle, maj) values (neutre, cc, maintenant) on conflict (owner, cle) do nothing;
  end if;
  perform 1 from public.vrm_agent_compteurs k where k.owner = neutre and k.cle in (p_cle, cc) order by k.cle for update;
  select k.n into g from public.vrm_agent_compteurs k where k.owner = neutre and k.cle = p_cle;
  if g + p_n > lim then return false; end if;
  if cc is not null then
    select k.n into c from public.vrm_agent_compteurs k where k.owner = neutre and k.cle = cc;
    if c + p_n > par_compte then return false; end if;
  end if;
  update public.vrm_agent_compteurs k set n = k.n + p_n, maj = maintenant
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
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  r integer;
begin
  if p_cle is null or p_cle = '' or p_utilises is null or p_utilises < 0 then return null; end if;
  insert into public.vrm_agent_compteurs as k (owner, cle, n, maj)
  values ('00000000-0000-0000-0000-000000000000', p_cle, p_utilises, maintenant)
  on conflict (owner, cle) do update set n = greatest(k.n, excluded.n), maj = excluded.maj
  returning k.n into r;
  return r;
end
$$;

-- 3l. NOTER une ligne au journal (ajout seulement). L'heure de la ligne est
--     celle du serveur (`vrm_agent_heure`) : un « at » glissé dans l'entrée est
--     ignoré.
create or replace function public.vrm_agent_noter(p_owner uuid, p_entree jsonb, p_maintenant timestamptz default now())
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  i bigint;
begin
  if p_owner is null or p_entree is null or jsonb_typeof(p_entree) <> 'object' or public.vrm_agent_efface(p_owner) then
    return null;
  end if;
  insert into public.vrm_agent_journal (owner, compte, at, geste, cible, numero, resultat, centimes, texte, ref, source, defaire)
  select p_owner, x.compte, maintenant, x.geste, x.cible, x.numero, x.resultat, x.centimes, x.texte, x.ref, x.source, x.defaire
    from jsonb_populate_record(null::public.vrm_agent_journal, p_entree) x
  returning id into i;
  return i;
end
$$;

-- 3m. La SEULE réécriture du journal (R19, [S26]) : effacer le texte, la
--     référence et le « défaire » des entrées qui visent un acheteur supprimé
--     (« texte retiré à la demande d'eBay »). La trace du geste reste (geste,
--     cible, N°, résultat, montant). Rend le nombre d'entrées touchées.
create or replace function public.vrm_agent_anonymiser_journal(p_owner uuid, p_cible text, p_maintenant timestamptz default now())
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  n integer;
begin
  -- Le verrou du vendeur d'abord (comme tout écrivain) : un vendeur effacé n'a
  -- plus aucune ligne, il n'y a rien à retirer.
  if p_owner is null or p_cible is null or p_cible = '' or public.vrm_agent_efface(p_owner) then return 0; end if;
  update public.vrm_agent_journal j set texte = null, ref = null, defaire = null, texte_retire_le = maintenant
   where j.owner = p_owner and j.cible = p_cible
     and (j.texte is not null or j.ref is not null or j.defaire is not null);
  get diagnostics n = row_count;
  return n;
end
$$;

-- 3n. L'HORLOGE. L'anti-rafale en UNE instruction : rend true si le battement
--     peut travailler (le précédent date de plus de `p_ecart_s` secondes). La
--     ligne existe dès l'installation, à « -infinity » [D14].
create or replace function public.vrm_agent_horloge_battre(p_maintenant timestamptz default now(), p_ecart_s integer default 20)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  ok boolean;
begin
  update public.vrm_agent_horloge h set dernier_battement = maintenant
   where h.id = 1
     and coalesce(h.dernier_battement, '-infinity'::timestamptz) < maintenant - pg_catalog.make_interval(secs => greatest(coalesce(p_ecart_s, 20), 1))
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
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  ok boolean;
begin
  update public.vrm_agent_horloge h set dernier_succes = greatest(h.dernier_succes, maintenant)
   where h.id = 1
  returning true into ok;
  return coalesce(ok, false);
end
$$;

-- 3o. Les TITULAIRES [S5, R10] : `true` si ce compte eBay est (ou devient) à
--     ce vendeur ; `false` s'il est déjà à un AUTRE vendeur VRM (« ce compte
--     eBay est déjà relié à un autre compte VRM »), ou si son libellé est déjà
--     celui d'un autre compte eBay du même vendeur. Jamais le propriétaire
--     neutre. Quand le LIBELLÉ change, l'index des annonces le suit (sinon il
--     resterait sous l'ancien libellé, et la libération ne le retirerait pas).
create or replace function public.vrm_agent_titulaire(p_cle_ebay text, p_owner uuid, p_compte text,
                                                      p_maintenant timestamptz default now())
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  ok boolean;
  o uuid;
  ancien text;
begin
  if p_cle_ebay is null or p_cle_ebay !~ '^[0-9a-f]{16}$' or p_owner is null
     or p_owner = '00000000-0000-0000-0000-000000000000' or public.vrm_agent_efface(p_owner)
     or coalesce(p_compte, '') !~ '^[0-9A-Za-z_-]{0,64}$' then
    return false;
  end if;
  begin
    insert into public.vrm_ebay_titulaires (cle_ebay, owner, compte, depuis)
    values (p_cle_ebay, p_owner, coalesce(p_compte, ''), maintenant)
    on conflict (cle_ebay) do nothing
    returning true into ok;
  exception when unique_violation then
    return false;
  end;
  if ok then return true; end if;
  select t.owner, t.compte into o, ancien from public.vrm_ebay_titulaires t where t.cle_ebay = p_cle_ebay for update;
  if o is distinct from p_owner then return false; end if;
  if p_compte is not null and p_compte is distinct from ancien then
    begin
      update public.vrm_ebay_titulaires t set compte = p_compte where t.cle_ebay = p_cle_ebay and t.owner = p_owner;
    exception when unique_violation then
      return false;
    end;
    update public.vrm_ebay_annonces_index i set compte = p_compte where i.owner = p_owner and i.compte = ancien;
  end if;
  return true;
end
$$;
-- Libérer un compte eBay (déconnexion, fermeture) : seulement par SON titulaire.
-- Tout son index d'annonces part avec lui (une sonnette n'est plus routée vers lui).
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
  delete from public.vrm_ebay_annonces_index i where i.owner = p_owner and i.compte = c;
  return true;
end
$$;

-- 3p. L'INDEX des annonces (listingId → vendeur, compte) d'UN compte, réécrit à
--     chaque relecture COMPLÈTE de ses annonces [D13]. Seul le TITULAIRE de ce
--     compte eBay indexe. `p_listings` NULL = pas su : rien ne bouge. Une annonce
--     indexée chez un AUTRE vendeur encore titulaire n'est jamais prise (comptée
--     « refusée ») ; une ligne laissée par un vendeur qui ne l'est plus est
--     reprise. Rend {indexees, retirees, refusees}.
create or replace function public.vrm_ebay_indexer_annonces(p_owner uuid, p_compte text, p_listings text[],
                                                            p_maintenant timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  valides text[];
  n_ret integer;
  n_ind integer;
  n_brut integer;
begin
  if p_owner is null or p_compte is null or p_listings is null or public.vrm_agent_efface(p_owner) then return null; end if;
  select coalesce(array_agg(distinct x), '{}'), count(distinct x) into valides, n_brut
    from unnest(p_listings) x where x is not null;
  if not exists (select 1 from public.vrm_ebay_titulaires t where t.owner = p_owner and t.compte = p_compte) then
    return jsonb_build_object('indexees', 0, 'retirees', 0, 'refusees', n_brut, 'raison', 'pas-titulaire');
  end if;
  select coalesce(array_agg(x), '{}') into valides from unnest(valides) x where x ~ '^[0-9]{6,20}$';
  delete from public.vrm_ebay_annonces_index i
   where i.owner = p_owner and i.compte = p_compte and not (i.listing_id = any (valides));
  get diagnostics n_ret = row_count;
  insert into public.vrm_ebay_annonces_index as i (listing_id, owner, compte, maj)
  select x, p_owner, p_compte, maintenant from unnest(valides) x
  on conflict (listing_id) do update set owner = excluded.owner, compte = excluded.compte, maj = excluded.maj
   where i.owner = excluded.owner
      or not exists (select 1 from public.vrm_ebay_titulaires t where t.owner = i.owner and t.compte = i.compte);
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
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  v timestamptz;
begin
  if p_owner is null or coalesce(p_numero_cle, '') = '' or coalesce(p_source, '') = '' or coalesce(p_ref, '') = ''
     or public.vrm_agent_efface(p_owner) then
    return null;
  end if;
  insert into public.vrm_agent_preuves (owner, numero_cle, source, ref, vue_le)
  values (p_owner, p_numero_cle, p_source, p_ref, maintenant)
  on conflict (owner, numero_cle, source, ref) do nothing;
  select p.vue_le into v from public.vrm_agent_preuves p
   where p.owner = p_owner and p.numero_cle = p_numero_cle and p.source = p_source and p.ref = p_ref;
  return v;
end
$$;

-- 3r. EFFACER tout ce que l'agent garde d'un vendeur (« Fermer mon compte »).
--     D'ABORD le verrou EXCLUSIF du vendeur : il attend la fin de chaque
--     écrivain en vol (tous prennent le même verrou PARTAGÉ avant d'écrire,
--     §3·1 et §8) — leurs lignes, validées, partent avec le reste — et chaque
--     écrivain qui arrive ensuite attend la fin de l'effacement, puis voit la
--     pierre tombale. Chaque suppression relit APRÈS ce verrou (plpgsql
--     VOLATILE, READ COMMITTED exigé). Puis la pierre tombale : un battement en
--     vol ne peut plus rien écrire à son nom (journal, tâches, mémos, coffre…).
--     ⚠️ Sans ce verrou, la pierre tombale n'était visible qu'au COMMIT : une
--     sonnette ou une ligne de journal écrite pendant l'effacement restait, et
--     « Fermer mon compte » rendait « fait ». Puis ses tâches, commandes,
--     journal, compteurs (et les quotas par compte qui le nomment, sous le
--     neutre), mémos à son nom, vus, routes, coffre, titulaires (son compte eBay
--     redevient libre), index, preuves, réglages. Les mémos GLOBAUX restent : ils
--     ne disent que « ce geste a été fait pour cette commande eBay ». Rend le
--     nombre de lignes par table.
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
  tx bigint := pg_catalog.txid_current();
begin
  if p_owner is null or p_owner = '00000000-0000-0000-0000-000000000000' then return null; end if;
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception using errcode = 'P0001', message = 'vrm_agent_isolation',
      detail = 'Effacer un vendeur exige READ COMMITTED : chaque suppression relit ce que les écrivains ont validé pendant l''attente du verrou.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_vendeur'), pg_catalog.hashtext(p_owner::text));
  insert into public.vrm_agent_effaces (owner, le) values (p_owner, pg_catalog.now()) on conflict (owner) do nothing;
  insert into public.vrm_agent_marques (xid, quoi, owner) values (tx, 'effacer', p_owner)
  on conflict (xid, quoi) do update set owner = excluded.owner;
  delete from public.vrm_agent_file x where x.owner = p_owner;            get diagnostics n = row_count; r := r || jsonb_build_object('file', n);
  delete from public.vrm_agent_commandes x where x.owner = p_owner;       get diagnostics n = row_count; r := r || jsonb_build_object('commandes', n);
  delete from public.vrm_agent_journal x where x.owner = p_owner;         get diagnostics n = row_count; r := r || jsonb_build_object('journal', n);
  delete from public.vrm_agent_compteurs x where x.owner = p_owner;       get diagnostics n = row_count; r := r || jsonb_build_object('compteurs', n);
  delete from public.vrm_agent_compteurs x
   where x.owner = '00000000-0000-0000-0000-000000000000' and x.cle like '%|' || p_owner::text || '|%';
                                                                          get diagnostics n = row_count; r := r || jsonb_build_object('quotas', n);
  delete from public.vrm_agent_memos x where x.owner = p_owner;           get diagnostics n = row_count; r := r || jsonb_build_object('memos', n);
  delete from public.vrm_agent_vus x where x.owner = p_owner;             get diagnostics n = row_count; r := r || jsonb_build_object('vus', n);
  delete from public.vrm_agent_routes x where x.owner = p_owner;          get diagnostics n = row_count; r := r || jsonb_build_object('routes', n);
  delete from public.vrm_coffre x where x.owner = p_owner;                get diagnostics n = row_count; r := r || jsonb_build_object('coffre', n);
  delete from public.vrm_ebay_titulaires x where x.owner = p_owner;       get diagnostics n = row_count; r := r || jsonb_build_object('titulaires', n);
  delete from public.vrm_ebay_annonces_index x where x.owner = p_owner;   get diagnostics n = row_count; r := r || jsonb_build_object('index', n);
  delete from public.vrm_agent_preuves x where x.owner = p_owner;         get diagnostics n = row_count; r := r || jsonb_build_object('preuves', n);
  delete from public.vrm_agent_vendeurs x where x.owner = p_owner;        get diagnostics n = row_count; r := r || jsonb_build_object('vendeurs', n);
  delete from public.vrm_agent_marques m where m.xid = tx and m.quoi = 'effacer';
  return r;
end
$$;

-- 3s. PURGER (une fois par jour, par la 015) : vus > 14 jours ; mémos passés
--     leur échéance (≥ 100 jours) ; compteurs intouchés depuis 400 jours, mais
--     JAMAIS ceux du mois en cours ni du mois précédent (ce sont des plafonds
--     d'argent) ; journal > 13 mois ; commandes closes depuis 90 jours COMPACTÉES
--     (elles gardent leurs scalaires, le prix du bordereau et la preuve : jamais
--     supprimées sans trace) ; `cron.job_run_details` > 7 jours s'il existe —
--     sans jamais faire échouer le reste.
create or replace function public.vrm_agent_purger(p_maintenant timestamptz default now())
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  maintenant timestamptz := public.vrm_agent_heure(p_maintenant);
  r jsonb := '{}'::jsonb;
  n integer;
  tx bigint := pg_catalog.txid_current();
  mois_gardes text := to_char(maintenant at time zone 'Europe/Paris', 'YYYY-MM') || '|'
                      || to_char((maintenant at time zone 'Europe/Paris') - interval '1 month', 'YYYY-MM');
begin
  delete from public.vrm_agent_vus x where x.at < maintenant - interval '14 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('vus', n);
  delete from public.vrm_agent_memos x where x.expire < maintenant;
  get diagnostics n = row_count; r := r || jsonb_build_object('memos', n);
  delete from public.vrm_agent_compteurs x
   where x.maj < maintenant - interval '400 days'
     and x.cle !~ ('(' || mois_gardes || ')');
  get diagnostics n = row_count; r := r || jsonb_build_object('compteurs', n);
  insert into public.vrm_agent_marques (xid, quoi, avant) values (tx, 'purger', maintenant - interval '13 months')
  on conflict (xid, quoi) do update set avant = excluded.avant;
  delete from public.vrm_agent_journal x where x.at < maintenant - interval '13 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('journal', n);
  delete from public.vrm_agent_marques m where m.xid = tx and m.quoi = 'purger';
  update public.vrm_agent_commandes c
     set data = jsonb_strip_nulls(jsonb_build_object('bordereau', c.data -> 'bordereau', 'preuve', c.data -> 'preuve',
                                                     'compactee', to_jsonb(maintenant))),
         version = c.version + 1
   where c.etape = 'close' and c.maj < maintenant - interval '90 days' and not (c.data ? 'compactee')
     and not exists (select 1 from public.vrm_agent_effaces e where e.owner = c.owner);
  get diagnostics n = row_count; r := r || jsonb_build_object('compactees', n);
  if to_regclass('cron.job_run_details') is not null then
    begin
      execute 'delete from cron.job_run_details where end_time < $1' using maintenant - interval '7 days';
      get diagnostics n = row_count; r := r || jsonb_build_object('cron', n);
    exception when others then
      r := r || jsonb_build_object('cron', null);
    end;
  end if;
  return r;
end
$$;

-- ── 4. LES DROITS SUR LES FONCTIONS ─────────────────────────────────────────
-- Les droits par défaut les ouvrent à anon et authenticated : `service_role`
-- SEULEMENT pour l'API de l'agent (vrm_acces_pour, 006, est le modèle) ; les
-- aides internes (heure, pierre tombale) : PERSONNE. Ce bloc suit DIRECTEMENT
-- les fonctions : appliquée en morceaux (`essai-annule.cjs --morceaux`), la
-- migration ne laisse jamais une fonction ouverte entre deux transactions.
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
  for f in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('vrm_agent_heure', 'vrm_agent_efface')
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end $$;

-- ── 5. LA GARDE DU JOURNAL (R19) ────────────────────────────────────────────
-- Une seule réécriture : `texte`, `ref` et `defaire` → NULL avec
-- `texte_retire_le`, rien d'autre. Aucune suppression, sauf la purge (> 13 mois)
-- et l'effacement d'un vendeur, qui posent une MARQUE de transaction
-- (`vrm_agent_marques`, clé `txid_current()`) le temps de leur suppression :
-- une variable de session, une ligne laissée à la main ou un réglage de base ne
-- l'ouvrent pas. Elle refuse aussi les réécritures du PROPRIÉTAIRE de la table
-- (qui garde, lui, le moyen de désactiver la garde : `--verifier` le voit).
create or replace function public.vrm_agent_journal_garde()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'texte' - 'ref' - 'defaire' - 'texte_retire_le') = (to_jsonb(old) - 'texte' - 'ref' - 'defaire' - 'texte_retire_le')
       and new.texte is null and new.ref is null and new.defaire is null
       and new.texte_retire_le is not null
       and (old.texte_retire_le is null or new.texte_retire_le = old.texte_retire_le) then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    if exists (select 1 from public.vrm_agent_marques m
                where m.xid = pg_catalog.txid_current() and m.quoi = 'effacer' and m.owner = old.owner) then
      return old;
    end if;
    if exists (select 1 from public.vrm_agent_marques m
                where m.xid = pg_catalog.txid_current() and m.quoi = 'purger' and old.at < m.avant) then
      return old;
    end if;
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
-- navigateur (anon, authenticated — lu par `auth.role()`, ET par le rôle
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
revoke all on function sauvegarde.noter_ecriture_agent() from public, anon, authenticated, service_role;
create or replace trigger vrm_noter_ecriture after insert or update on public.vrm_agent_vendeurs
  for each row execute function sauvegarde.noter_ecriture_agent();
create or replace trigger vrm_noter_ecriture after insert or update on public.vrm_agent_commandes
  for each row execute function sauvegarde.noter_ecriture_agent();
create or replace trigger vrm_noter_ecriture after insert or update on public.vrm_agent_journal
  for each row execute function sauvegarde.noter_ecriture_agent();

-- ── 8. LA PIERRE TOMBALE, PARTOUT ───────────────────────────────────────────
-- « Fermer mon compte » ferme aussi la porte : plus aucune ligne ne s'écrit au
-- nom d'un vendeur effacé, que ce soit par une fonction (un battement qui était
-- en vol) ou par une écriture directe du serveur (pouls, coffre, vus, routes).
-- Les fonctions refusent déjà proprement ; ce déclencheur tient le reste.
--   • Une NOUVELLE ligne à son nom (INSERT, ou UPDATE qui change le
--     propriétaire) prend le verrou PARTAGÉ du vendeur (`vrm_agent_efface`) :
--     une écriture directe en vol fait attendre l'effacement, qui la voit et
--     l'efface ; une écriture qui arrive pendant attend, puis est refusée. Le
--     déclencheur passe AVANT l'attente sur un conflit de clé : sans ce verrou,
--     une insertion attendait la fin de l'effacement… puis réinsérait la ligne.
--   • Un UPDATE d'une ligne existante sans changer son propriétaire ne crée rien
--     qu'un effacement ne voie (il attend la ligne, puis l'efface) : on ne relit
--     que la pierre tombale validée, SANS verrou — un verrou pris après celui de
--     la ligne pourrait se croiser avec l'effacement (interblocage).
create or replace function public.vrm_agent_refuser_efface()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  efface boolean;
begin
  if tg_op = 'INSERT' then
    efface := public.vrm_agent_efface(new.owner);
  elsif new.owner is distinct from old.owner then
    efface := public.vrm_agent_efface(new.owner);
  else
    efface := exists (select 1 from public.vrm_agent_effaces e where e.owner = new.owner);
  end if;
  if efface then
    raise exception using errcode = 'P0001', message = 'vrm_vendeur_efface',
      detail = 'Ce vendeur a fermé son compte : l''agent n''écrit plus rien à son nom.';
  end if;
  return new;
end
$$;
revoke all on function public.vrm_agent_refuser_efface() from public, anon, authenticated, service_role;
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_vendeurs
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_commandes
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_journal
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_file
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_compteurs
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_vus
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_memos
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_routes
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_coffre
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_ebay_titulaires
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_ebay_annonces_index
  for each row execute function public.vrm_agent_refuser_efface();
create or replace trigger vrm_agent_pierre_tombale before insert or update on public.vrm_agent_preuves
  for each row execute function public.vrm_agent_refuser_efface();

-- ── 9. LE RÉGLAGE D'INSTALLATION ET LA LIGNE D'HORLOGE ──────────────────────
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
--   (forme de chaque table, RLS forcé, droits EXACTS par rôle, règles et leur
--   texte, chaque fonction — une seule version, SECURITY DEFINER, search_path,
--   corps comparé au fichier par md5 —, chaque déclencheur présent ET actif,
--   horloge, réglage, aucune marque qui traîne, aucune horloge simulée posée sur
--   la base ou un rôle). `ecarts` dit ce qui diffère.
-- Retour arrière : aucun nécessaire pour les tables tant que la 015 n'est pas
-- posée (rien ne les lit ni ne les écrit, le réglage vaut '0'). La SEULE chose
-- qui agit dès l'application est la garde `ebay_tokens*` ; si elle gênait un
-- écrivain légitime oublié, la suspendre SANS DROP :
--   alter table public.app_data disable trigger vrm_garde_ebay_tokens_ajout;
--   (idem `_maj`, `_retrait`) — puis la rallumer (`enable trigger`). Tant
--   qu'elle est suspendue, `--verifier` rend ok = false : c'est voulu.
-- Retirer les tables demanderait des DROP, confirmés à l'écran par Julien.
-- ════════════════════════════════════════════════════════════════════════════
