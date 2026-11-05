-- ════════════════════════════════════════════════════════════════════════════
-- 025 — LA COMMUNAUTÉ : LES GROUPES D'ACCOMPAGNEMENT « comme Skool »
-- (5 novembre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- Demande de Julien (5 nov., pages + vocal, docs/passation/demandes-2026-11-05.md §14) :
-- « qui veut peut créer un groupe pour les membres de son accompagnement : un
-- code ou un lien d'invitation ; le créateur valide l'accès de chaque personne ;
-- carré, pro, simple. Si le membre l'accepte, le créateur voit l'évolution de
-- ses ventes et achats (les chiffres seuls) ; le détail des ventes seulement si
-- le membre l'autorise. » — « un peu comme Skool ».
--
-- POURQUOI DE NOUVELLES TABLES (et pas les groupes de la 020) : un groupe de la
-- 020 est un groupe de COMPARAISON, rattaché à la présence publique sur la
-- carte (`pid`, pseudo, ville) — on y entre seul, sans validation, et tous les
-- membres se voient. Un accompagnement ne doit exiger NI la carte NI un
-- classement : on y entre par une demande, le créateur valide, et seul le
-- créateur voit (ce que chacun partage). Mesuré le 5 nov. (lecture seule) :
-- 0 groupe et 0 membre dans les tables de la 020 — rien à reprendre.
-- La 025 S'APPUIE sur l'existant : l'abonnement (`vrm_acces_pour`, 006), la
-- lecture d'un code tapé (`vrm_communaute_code_lu`, 020) et le même alphabet de
-- code (un code n'est jamais celui d'un groupe de la 020 : tirage contre les
-- deux tables).
--
-- LES GARANTIES (dans la BASE, pas dans l'écran) :
--   • Rien n'est lisible en direct : RLS forcé, aucune règle, aucun droit sur les
--     tables ; tout passe par des fonctions SECURITY DEFINER qui prennent
--     l'identité dans le jeton (`auth.uid()`), jamais dans un paramètre.
--   • Jamais l'identifiant d'un compte ni un email : un membre est désigné par
--     l'identifiant PUBLIC de son adhésion et le NOM qu'il choisit en entrant.
--   • Entrer = DEMANDER : statut « attente » jusqu'à ce que le créateur accepte
--     ou refuse. Le créateur peut retirer un membre ; le membre peut partir.
--   • LE PARTAGE, CHOISI PAR LE MEMBRE, PAR DÉFAUT RIEN :
--       rien      → le créateur voit son nom et son statut, aucun chiffre ;
--       chiffres  → + les totaux par semaine et par mois (nombre de ventes, CA
--                   vendu, nombre d'achats, dépensé) ;
--       detail    → + le détail (articles, prix, comptes).
--     Révocable à tout moment, effet immédiat : ce que le niveau ne permet plus
--     n'est plus rendu ET est effacé de la base (`vrm_accomp_elaguer`).
--   • LE PARTAGE N'OUVRE AUCUN ACCÈS AUX DONNÉES DU MEMBRE. Les chiffres et le
--     détail viennent d'une table à part (`vrm_accomp_partages`) que SEULE l'app
--     du membre remplit (`vrm_accomp_publier`, ses propres agrégats, publiés
--     par son app), et seulement jusqu'au niveau qu'il a choisi : la base ne lit
--     jamais `app_data`, `vinted_accounts` ni aucune autre donnée du membre.
--   • UNE RÈGLE POUR « CE QUE VOIT LE CRÉATEUR » : `vrm_accomp_vue(adhésion)`.
--     Le créateur la lit pour ses membres ; le membre lit LA MÊME pour lui-même
--     (`vrm_accomp_ce_que_voit`) — il voit exactement ce que voit le créateur.
--   • Bornes : 5 groupes ouverts créés, 20 groupes demandés ou rejoints par
--     personne ; 200 membres acceptés et 100 demandes en attente par groupe ;
--     un partage publié pèse 256 Ko au plus.
--   • L'abonnement (`vrm_acces_pour`) : qui ne paie plus ne crée, ne rejoint, ne
--     lit plus rien (comme la carte).
--   • « FERMER MON COMPTE » : `vrm_accomp_effacer(owner)` (clé de service) vide
--     ses partages et détache ses adhésions et ses groupes de son compte (un
--     identifiant tiré au hasard à la place, comme le `pid` de la 020) ; ses
--     groupes sont fermés.
-- ⚠️ Ce fichier ne contient AUCUNE suppression (l'outil SQL demande une
-- confirmation pour ce mot) : il se colle d'un bloc. Additif et rejouable.
-- Exige la 006 et la 020 (refusé sans elles). Aucun DROP.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 1. CE QUI DOIT ÊTRE LÀ AVANT ─────────────────────────────────────────────
do $$ begin
  if pg_catalog.to_regprocedure('public.vrm_acces_pour(uuid)') is null
     or pg_catalog.to_regprocedure('public.vrm_communaute_code_lu(text)') is null
     or pg_catalog.to_regclass('public.vrm_communaute_groupes') is null then
    raise exception 'vrm_accomp_prealable : la 006 (abonnement) et la 020 (groupes) doivent être appliquées d''abord — rien n''est installé';
  end if;
end $$;

-- ── 2. LES TROIS TABLES ──────────────────────────────────────────────────────
create table if not exists public.vrm_accomp_groupes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  description text not null default '',
  code text not null,
  cree_par uuid not null,
  createur_nom text not null,
  cree_le timestamptz not null default now(),
  ferme_le timestamptz,
  constraint vrm_accomp_groupe_code unique (code),
  constraint vrm_accomp_groupe_code_forme check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  constraint vrm_accomp_groupe_nom check (char_length(nom) between 2 and 60 and nom = btrim(nom) and nom !~ '[@<>]'),
  constraint vrm_accomp_groupe_description check (char_length(description) <= 500 and description !~ '[<>]'),
  constraint vrm_accomp_groupe_createur check (char_length(createur_nom) between 2 and 40 and createur_nom = btrim(createur_nom) and createur_nom !~ '[@<>]')
);

create table if not exists public.vrm_accomp_membres (
  id uuid primary key default gen_random_uuid(),
  groupe uuid not null,
  owner uuid not null,
  nom text not null,
  statut text not null default 'attente',
  partage text not null default 'rien',
  demande_le timestamptz not null default now(),
  decide_le timestamptz,
  partage_le timestamptz,
  constraint vrm_accomp_membre_groupe foreign key (groupe) references public.vrm_accomp_groupes (id),
  constraint vrm_accomp_membre_unique unique (groupe, owner),
  constraint vrm_accomp_membre_statut check (statut in ('attente', 'accepte', 'refuse', 'retire', 'parti')),
  constraint vrm_accomp_membre_partage check (partage in ('rien', 'chiffres', 'detail')),
  constraint vrm_accomp_membre_nom check (char_length(nom) between 2 and 40 and nom = btrim(nom) and nom !~ '[@<>]')
);

create table if not exists public.vrm_accomp_partages (
  owner uuid primary key,
  chiffres jsonb,
  detail jsonb,
  chiffres_le timestamptz,
  detail_le timestamptz
);

-- ── 3. LA FORME APRÈS (les trois tables) ─────────────────────────────────────
do $$ declare v text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_accomp_groupes', 'vrm_accomp_membres', 'vrm_accomp_partages']) t(n)
    into v;
  if v is distinct from 'a49fae715595b09dd3a068faf2510283' then
    raise exception 'vrm_accomp_forme : une table des groupes d''accompagnement existe sous une autre forme (empreinte %) — rien n''est installé', v;
  end if;
end $$;

create index if not exists vrm_accomp_membres_owner on public.vrm_accomp_membres (owner);
create index if not exists vrm_accomp_groupes_createur on public.vrm_accomp_groupes (cree_par);
alter table public.vrm_accomp_groupes enable row level security;
alter table public.vrm_accomp_groupes force row level security;
alter table public.vrm_accomp_membres enable row level security;
alter table public.vrm_accomp_membres force row level security;
alter table public.vrm_accomp_partages enable row level security;
alter table public.vrm_accomp_partages force row level security;
revoke all on public.vrm_accomp_groupes from public, anon, authenticated, service_role;
revoke all on public.vrm_accomp_membres from public, anon, authenticated, service_role;
revoke all on public.vrm_accomp_partages from public, anon, authenticated, service_role;

-- ── 4. AIDES INTERNES (personne ne les exécute directement) ──────────────────
-- Un code neuf : l'alphabet de la 020, jamais le code d'un groupe de la 020.
create or replace function public.vrm_accomp_code_neuf()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  o bytea; c text; i int; essai int := 0;
begin
  loop
    o := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    c := '';
    for i in 0..7 loop c := c || pg_catalog.substr(alpha, (pg_catalog.get_byte(o, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.vrm_accomp_groupes g where g.code = c)
          and not exists (select 1 from public.vrm_communaute_groupes g where g.code = c);
    essai := essai + 1;
    if essai > 20 then raise exception 'vrm_accomp_code : aucun code libre'; end if;
  end loop;
  return c;
end $$;

-- Le niveau d'un partage : rien 0 · chiffres 1 · detail 2.
create or replace function public.vrm_accomp_niveau(p text)
returns int language sql immutable set search_path = '' as $$
  select case p when 'detail' then 2 when 'chiffres' then 1 else 0 end
$$;

-- Un nom affiché (le sien, ou celui du créateur) : 2 à 40 caractères, sans « @ ».
create or replace function public.vrm_accomp_nom_ok(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p is not null and pg_catalog.char_length(p) between 2 and 40 and p = pg_catalog.btrim(p) and p !~ '[@<>]'
$$;

-- Ce que la base GARDE d'un membre = ce que son niveau le plus haut permet,
-- sur ses adhésions vivantes (en attente ou acceptées, groupe ouvert). Le reste
-- est EFFACÉ (mis à vide), pas seulement caché : révoquer, c'est retirer.
create or replace function public.vrm_accomp_elaguer(p_owner uuid)
returns int language plpgsql volatile set search_path = '' as $$
declare n int;
begin
  select coalesce(pg_catalog.max(public.vrm_accomp_niveau(m.partage)), 0) into n
    from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
   where m.owner = p_owner and m.statut in ('attente', 'accepte') and g.ferme_le is null;
  update public.vrm_accomp_partages s
     set detail = case when n >= 2 then s.detail end, detail_le = case when n >= 2 then s.detail_le end,
         chiffres = case when n >= 1 then s.chiffres end, chiffres_le = case when n >= 1 then s.chiffres_le end
   where s.owner = p_owner and ((n < 2 and s.detail is not null) or (n < 1 and s.chiffres is not null));
  return n;
end $$;

-- LA RÈGLE « ce que voit le créateur » d'une adhésion (une seule, §11) :
--   · toujours : id public, nom choisi, statut, partage, dates ;
--   · `chiffres` (+ `chiffres_le`) SEULEMENT si accepté ET partage ≥ chiffres —
--     la clé présente et `null` = permis mais pas encore publié ; absente = pas permis ;
--   · `detail` (+ `detail_le`) SEULEMENT si accepté ET partage = detail.
-- Jamais le compte, jamais un email.
create or replace function public.vrm_accomp_vue(p_membre uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'nom', m.nom, 'statut', m.statut, 'partage', m.partage,
           'demande_le', m.demande_le, 'decide_le', m.decide_le, 'partage_le', m.partage_le)
      || case when m.statut = 'accepte' and public.vrm_accomp_niveau(m.partage) >= 1
              then jsonb_build_object('chiffres', s.chiffres, 'chiffres_le', s.chiffres_le) else '{}'::jsonb end
      || case when m.statut = 'accepte' and public.vrm_accomp_niveau(m.partage) >= 2
              then jsonb_build_object('detail', s.detail, 'detail_le', s.detail_le) else '{}'::jsonb end
    from public.vrm_accomp_membres m
    left join public.vrm_accomp_partages s on s.owner = m.owner
   where m.id = p_membre
$$;

-- La forme des CHIFFRES publiés par l'app :
--   { v: 1, ventes: bool, achats: bool, semaines: { "2026-W45": [nVentes, caCentimes, nAchats, depenseCentimes] },
--     mois: { "2026-11": [ … ] }, at: nombre }
-- `ventes`/`achats` = la moitié est-elle CONNUE (« pas su » ≠ 0) ? Entiers ≥ 0.
create or replace function public.vrm_accomp_quatre_ok(v jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_typeof(v) = 'array' and pg_catalog.jsonb_array_length(v) = 4
     and not exists (select 1 from pg_catalog.jsonb_array_elements(v) x
                      where pg_catalog.jsonb_typeof(x) <> 'number'
                         or (x #>> '{}')::numeric < 0 or (x #>> '{}')::numeric > 100000000000
                         or (x #>> '{}')::numeric <> pg_catalog.trunc((x #>> '{}')::numeric))
$$;
create or replace function public.vrm_accomp_chiffres_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_typeof(p) = 'object'
     and (p ->> 'v') = '1'
     and pg_catalog.jsonb_typeof(p -> 'ventes') = 'boolean' and pg_catalog.jsonb_typeof(p -> 'achats') = 'boolean'
     and pg_catalog.jsonb_typeof(p -> 'semaines') = 'object' and pg_catalog.jsonb_typeof(p -> 'mois') = 'object'
     and (p -> 'at' is null or pg_catalog.jsonb_typeof(p -> 'at') = 'number')
     and not exists (select 1 from pg_catalog.jsonb_object_keys(p) k where k not in ('v', 'ventes', 'achats', 'semaines', 'mois', 'at'))
     and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p -> 'semaines')) <= 110
     and (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p -> 'mois')) <= 36
     and not exists (select 1 from pg_catalog.jsonb_each(p -> 'semaines') e(k, v) where e.k !~ '^[0-9]{4}-W[0-9]{2}$' or not public.vrm_accomp_quatre_ok(e.v))
     and not exists (select 1 from pg_catalog.jsonb_each(p -> 'mois') e(k, v) where e.k !~ '^[0-9]{4}-[0-9]{2}$' or not public.vrm_accomp_quatre_ok(e.v)), false)
$$;
-- La forme du DÉTAIL : { v: 1, ventes: [[ts, plateforme, compte, titre, prixCentimes|null]],
--   achats: [[ts, compte, titre, prixCentimes|null]] } — 300 lignes au plus de chaque.
create or replace function public.vrm_accomp_ligne_ok(l jsonb, n int)
returns boolean language sql immutable set search_path = '' as $$
  select pg_catalog.jsonb_typeof(l) = 'array' and pg_catalog.jsonb_array_length(l) = n
     and pg_catalog.jsonb_typeof(l -> 0) = 'number'
     and (pg_catalog.jsonb_typeof(l -> (n - 1)) = 'number' or pg_catalog.jsonb_typeof(l -> (n - 1)) = 'null')
     and not exists (select 1 from pg_catalog.generate_series(1, n - 2) i
                      where pg_catalog.jsonb_typeof(l -> i) <> 'string' or pg_catalog.char_length(l ->> i) > 120 or (l ->> i) ~ '[<>]')
$$;
create or replace function public.vrm_accomp_detail_ok(p jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(pg_catalog.jsonb_typeof(p) = 'object'
     and (p ->> 'v') = '1'
     and pg_catalog.jsonb_typeof(p -> 'ventes') = 'array' and pg_catalog.jsonb_typeof(p -> 'achats') = 'array'
     and (p -> 'at' is null or pg_catalog.jsonb_typeof(p -> 'at') = 'number')
     and not exists (select 1 from pg_catalog.jsonb_object_keys(p) k where k not in ('v', 'ventes', 'achats', 'at'))
     and pg_catalog.jsonb_array_length(p -> 'ventes') <= 300 and pg_catalog.jsonb_array_length(p -> 'achats') <= 300
     and not exists (select 1 from pg_catalog.jsonb_array_elements(p -> 'ventes') l where not public.vrm_accomp_ligne_ok(l, 5))
     and not exists (select 1 from pg_catalog.jsonb_array_elements(p -> 'achats') l where not public.vrm_accomp_ligne_ok(l, 4)), false)
$$;

-- ── 5. LIRE : mes groupes créés (et leurs membres) · mes adhésions ───────────
create or replace function public.vrm_accomp_lire()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then null
    when not public.vrm_acces_pour(auth.uid()) then jsonb_build_object('acces', false)
    else jsonb_build_object('acces', true,
      'crees', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'nom', g.nom, 'description', g.description, 'code', g.code,
                     'createur', g.createur_nom, 'cree_le', g.cree_le,
                     'membres', coalesce((select jsonb_agg(public.vrm_accomp_vue(m.id) order by (m.statut = 'attente') desc, m.demande_le, m.id)
                                            from public.vrm_accomp_membres m
                                           where m.groupe = g.id and m.statut in ('attente', 'accepte')), '[]'::jsonb))
                     order by g.cree_le, g.id)
                   from public.vrm_accomp_groupes g where g.cree_par = auth.uid() and g.ferme_le is null), '[]'::jsonb),
      'rejoints', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'groupe', g.id, 'nom', g.nom, 'description', g.description,
                     'createur', g.createur_nom, 'moi', m.nom, 'statut', m.statut, 'partage', m.partage,
                     'demande_le', m.demande_le, 'decide_le', m.decide_le, 'ferme', g.ferme_le is not null,
                     'membres', (select pg_catalog.count(*) from public.vrm_accomp_membres x where x.groupe = g.id and x.statut = 'accepte'))
                     order by m.demande_le, m.id)
                   from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
                  where m.owner = auth.uid() and m.statut <> 'parti'), '[]'::jsonb),
      'niveau', coalesce((select pg_catalog.max(public.vrm_accomp_niveau(m.partage))
                            from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
                           where m.owner = auth.uid() and m.statut in ('attente', 'accepte') and g.ferme_le is null), 0),
      'publie', (select jsonb_build_object('chiffres_le', s.chiffres_le, 'detail_le', s.detail_le)
                   from public.vrm_accomp_partages s where s.owner = auth.uid()))
  end
$$;

-- ── 6. CE QUE VOIT LE CRÉATEUR DE MOI (la même règle, pour le membre) ────────
create or replace function public.vrm_accomp_ce_que_voit(p_adhesion uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  if not public.vrm_acces_pour(auth.uid()) then return jsonb_build_object('acces', false); end if;
  if not exists (select 1 from public.vrm_accomp_membres m where m.id = p_adhesion and m.owner = auth.uid() and m.statut <> 'parti') then
    return jsonb_build_object('acces', true, 'erreur', 'adhesion');
  end if;
  return jsonb_build_object('acces', true, 'vue', public.vrm_accomp_vue(p_adhesion));
end $$;

-- ── 7. UN CODE OU UN LIEN : ce que l'on rejoint, AVANT de demander ────────────
create or replace function public.vrm_accomp_apercu(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare moi uuid := auth.uid(); c text := public.vrm_communaute_code_lu(p_code); g record; m record;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if c !~ '^[A-HJ-NP-Z2-9]{8}$' then return jsonb_build_object('ok', false, 'raison', 'code'); end if;
  select x.id, x.nom, x.description, x.createur_nom, x.cree_par into g from public.vrm_accomp_groupes x where x.code = c and x.ferme_le is null;
  if g.id is null then return jsonb_build_object('ok', false, 'raison', 'code'); end if;
  select y.statut into m from public.vrm_accomp_membres y where y.groupe = g.id and y.owner = moi;
  return jsonb_build_object('ok', true, 'nom', g.nom, 'description', g.description, 'createur', g.createur_nom,
    'membres', (select pg_catalog.count(*) from public.vrm_accomp_membres x where x.groupe = g.id and x.statut = 'accepte'),
    'createur_moi', g.cree_par = moi, 'statut', m.statut);
end $$;

-- ── 8. CRÉER UN GROUPE ───────────────────────────────────────────────────────
create or replace function public.vrm_accomp_creer(p_nom text, p_description text, p_createur text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); n text := pg_catalog.btrim(coalesce(p_nom, '')); d text := pg_catalog.btrim(coalesce(p_description, ''));
        q text := pg_catalog.btrim(coalesce(p_createur, '')); g uuid; c text;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if pg_catalog.char_length(n) not between 2 and 60 or n ~ '[@<>]' then return jsonb_build_object('ok', false, 'raison', 'nom-groupe'); end if;
  if pg_catalog.char_length(d) > 500 or d ~ '[<>]' then return jsonb_build_object('ok', false, 'raison', 'description'); end if;
  if not public.vrm_accomp_nom_ok(q) then return jsonb_build_object('ok', false, 'raison', 'nom'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_accomp'), pg_catalog.hashtext(moi::text));
  if (select pg_catalog.count(*) from public.vrm_accomp_groupes x where x.cree_par = moi and x.ferme_le is null) >= 5 then
    return jsonb_build_object('ok', false, 'raison', 'trop-crees');
  end if;
  c := public.vrm_accomp_code_neuf();
  insert into public.vrm_accomp_groupes (nom, description, code, cree_par, createur_nom) values (n, d, c, moi, q) returning id into g;
  return jsonb_build_object('ok', true, 'id', g, 'code', c, 'nom', n);
end $$;

-- ── 9. DEMANDER À ENTRER (code tapé ou lien) — le partage choisi À L'ENTRÉE ──
create or replace function public.vrm_accomp_demander(p_code text, p_nom text, p_partage text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); c text := public.vrm_communaute_code_lu(p_code); q text := pg_catalog.btrim(coalesce(p_nom, ''));
        pa text := coalesce(p_partage, 'rien'); g record; m record; id_m uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if c !~ '^[A-HJ-NP-Z2-9]{8}$' then return jsonb_build_object('ok', false, 'raison', 'code'); end if;
  if pa not in ('rien', 'chiffres', 'detail') then return jsonb_build_object('ok', false, 'raison', 'partage'); end if;
  if not public.vrm_accomp_nom_ok(q) then return jsonb_build_object('ok', false, 'raison', 'nom'); end if;
  select x.id, x.nom, x.cree_par into g from public.vrm_accomp_groupes x where x.code = c and x.ferme_le is null;
  if g.id is null then return jsonb_build_object('ok', false, 'raison', 'code'); end if;
  if g.cree_par = moi then return jsonb_build_object('ok', false, 'raison', 'soi'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_accomp'), pg_catalog.hashtext(moi::text));
  select y.id, y.statut into m from public.vrm_accomp_membres y where y.groupe = g.id and y.owner = moi;
  if m.statut in ('attente', 'accepte') then
    return jsonb_build_object('ok', true, 'id', m.id, 'nom', g.nom, 'statut', m.statut, 'deja', true);
  end if;
  if (select pg_catalog.count(*) from public.vrm_accomp_membres x join public.vrm_accomp_groupes z on z.id = x.groupe
       where x.owner = moi and x.statut in ('attente', 'accepte') and z.ferme_le is null) >= 20 then
    return jsonb_build_object('ok', false, 'raison', 'trop-groupes');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_accomp_n'), pg_catalog.hashtext(g.id::text));
  if (select pg_catalog.count(*) from public.vrm_accomp_membres x where x.groupe = g.id and x.statut = 'attente') >= 100 then
    return jsonb_build_object('ok', false, 'raison', 'trop-demandes');
  end if;
  insert into public.vrm_accomp_membres as y (groupe, owner, nom, statut, partage, partage_le)
       values (g.id, moi, q, 'attente', pa, pg_catalog.now())
  on conflict (groupe, owner) do update set nom = excluded.nom, statut = 'attente', partage = excluded.partage,
       demande_le = pg_catalog.now(), decide_le = null, partage_le = pg_catalog.now()
  returning y.id into id_m;
  return jsonb_build_object('ok', true, 'id', id_m, 'nom', g.nom, 'statut', 'attente');
end $$;

-- ── 10. LE CRÉATEUR VALIDE OU REFUSE une demande ─────────────────────────────
create or replace function public.vrm_accomp_decider(p_membre uuid, p_oui boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); m record; s text;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  select y.id, y.groupe, y.owner, y.statut into m from public.vrm_accomp_membres y join public.vrm_accomp_groupes g on g.id = y.groupe
   where y.id = p_membre and g.cree_par = moi and g.ferme_le is null;
  if m.id is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  if m.statut <> 'attente' then return jsonb_build_object('ok', false, 'raison', 'etat'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_accomp_n'), pg_catalog.hashtext(m.groupe::text));
  if p_oui is true and (select pg_catalog.count(*) from public.vrm_accomp_membres x where x.groupe = m.groupe and x.statut = 'accepte') >= 200 then
    return jsonb_build_object('ok', false, 'raison', 'groupe-plein');
  end if;
  s := case when p_oui is true then 'accepte' else 'refuse' end;
  update public.vrm_accomp_membres y set statut = s, decide_le = pg_catalog.now() where y.id = m.id;
  perform public.vrm_accomp_elaguer(m.owner);
  return jsonb_build_object('ok', true, 'statut', s);
end $$;

-- ── 11. LE CRÉATEUR RETIRE un membre (ou une demande) ────────────────────────
create or replace function public.vrm_accomp_retirer(p_membre uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); m record;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  select y.id, y.owner, y.statut into m from public.vrm_accomp_membres y join public.vrm_accomp_groupes g on g.id = y.groupe
   where y.id = p_membre and g.cree_par = moi;
  if m.id is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  if m.statut not in ('attente', 'accepte') then return jsonb_build_object('ok', true, 'statut', m.statut); end if;
  update public.vrm_accomp_membres y set statut = 'retire', decide_le = pg_catalog.now() where y.id = m.id;
  perform public.vrm_accomp_elaguer(m.owner);
  return jsonb_build_object('ok', true, 'statut', 'retire');
end $$;

-- ── 12. LE MEMBRE PART ───────────────────────────────────────────────────────
create or replace function public.vrm_accomp_quitter(p_adhesion uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  update public.vrm_accomp_membres y set statut = 'parti', partage = 'rien', partage_le = pg_catalog.now()
   where y.id = p_adhesion and y.owner = moi and y.statut <> 'parti';
  if not found then return jsonb_build_object('ok', false, 'raison', 'adhesion'); end if;
  perform public.vrm_accomp_elaguer(moi);
  return jsonb_build_object('ok', true);
end $$;

-- ── 13. LE MEMBRE CHANGE CE QU'IL PARTAGE (révocable à tout moment) ──────────
create or replace function public.vrm_accomp_partage(p_adhesion uuid, p_partage text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); n int;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if coalesce(p_partage, '') not in ('rien', 'chiffres', 'detail') then return jsonb_build_object('ok', false, 'raison', 'partage'); end if;
  -- Baisser son partage marche TOUJOURS (même sans abonnement) ; l'élargir demande l'accès.
  if public.vrm_accomp_niveau(p_partage) > 0 and not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  update public.vrm_accomp_membres y set partage = p_partage, partage_le = pg_catalog.now()
   where y.id = p_adhesion and y.owner = moi and y.statut in ('attente', 'accepte');
  if not found then return jsonb_build_object('ok', false, 'raison', 'adhesion'); end if;
  n := public.vrm_accomp_elaguer(moi);
  return jsonb_build_object('ok', true, 'partage', p_partage, 'niveau', n);
end $$;

-- ── 14. NOUVEAU CODE (le créateur ; l'ancien code et l'ancien lien ne marchent plus) ──
create or replace function public.vrm_accomp_code(p_groupe uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); c text;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_accomp_groupes g where g.id = p_groupe and g.cree_par = moi and g.ferme_le is null) then
    return jsonb_build_object('ok', false, 'raison', 'pas-createur');
  end if;
  c := public.vrm_accomp_code_neuf();
  update public.vrm_accomp_groupes g set code = c where g.id = p_groupe;
  return jsonb_build_object('ok', true, 'code', c);
end $$;

-- ── 15. FERMER UN GROUPE (le créateur) : plus personne n'y entre ni n'y est vu ──
create or replace function public.vrm_accomp_fermer(p_groupe uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); o uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  update public.vrm_accomp_groupes g set ferme_le = pg_catalog.now() where g.id = p_groupe and g.cree_par = moi and g.ferme_le is null;
  if not found then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  for o in select m.owner from public.vrm_accomp_membres m where m.groupe = p_groupe loop
    perform public.vrm_accomp_elaguer(o);
  end loop;
  return jsonb_build_object('ok', true);
end $$;

-- ── 16. PUBLIER SES AGRÉGATS (l'app du membre, pour lui-même) ────────────────
-- La base garde ce que son niveau permet, rien de plus : sans aucun partage ⇒
-- refus (« rien-a-partager ») et ce qui restait est effacé ; « chiffres » seul ⇒
-- le détail envoyé est JETÉ (jamais rangé). Une forme inconnue n'écrit rien.
create or replace function public.vrm_accomp_publier(p_chiffres jsonb, p_detail jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); n int; ch jsonb; de jsonb;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  n := public.vrm_accomp_elaguer(moi);
  if n < 1 then return jsonb_build_object('ok', false, 'raison', 'rien-a-partager'); end if;
  if p_chiffres is not null and not public.vrm_accomp_chiffres_ok(p_chiffres) then return jsonb_build_object('ok', false, 'raison', 'forme'); end if;
  if n >= 2 and p_detail is not null and not public.vrm_accomp_detail_ok(p_detail) then return jsonb_build_object('ok', false, 'raison', 'forme'); end if;
  if pg_catalog.octet_length(coalesce(p_chiffres::text, '')) + (case when n >= 2 then pg_catalog.octet_length(coalesce(p_detail::text, '')) else 0 end) > 262144 then
    return jsonb_build_object('ok', false, 'raison', 'trop-lourd');
  end if;
  ch := p_chiffres;
  de := case when n >= 2 then p_detail end;
  insert into public.vrm_accomp_partages as s (owner, chiffres, detail, chiffres_le, detail_le)
       values (moi, ch, de, case when ch is not null then pg_catalog.now() end, case when de is not null then pg_catalog.now() end)
  on conflict (owner) do update set
       chiffres = coalesce(excluded.chiffres, s.chiffres), chiffres_le = coalesce(excluded.chiffres_le, s.chiffres_le),
       detail = case when n >= 2 then coalesce(excluded.detail, s.detail) end,
       detail_le = case when n >= 2 then coalesce(excluded.detail_le, s.detail_le) end;
  return jsonb_build_object('ok', true, 'niveau', n, 'chiffres', ch is not null, 'detail', de is not null);
end $$;

-- ── 17. « FERMER MON COMPTE » (clé de service) ──────────────────────────────
create or replace function public.vrm_accomp_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer := 0; k integer; o uuid;
begin
  if p_owner is null then return 0; end if;
  update public.vrm_accomp_partages s set owner = pg_catalog.gen_random_uuid(), chiffres = null, detail = null, chiffres_le = null, detail_le = null
   where s.owner = p_owner; get diagnostics k = row_count; n := n + k;
  update public.vrm_accomp_membres m set owner = pg_catalog.gen_random_uuid(), nom = 'Compte fermé', statut = 'parti', partage = 'rien'
   where m.owner = p_owner; get diagnostics k = row_count; n := n + k;
  -- Ses groupes sont FERMÉS d'abord ; ce que leurs membres ne partagent plus
  -- nulle part est effacé ; puis le groupe est détaché de son compte.
  update public.vrm_accomp_groupes g set ferme_le = pg_catalog.now() where g.cree_par = p_owner and g.ferme_le is null;
  for o in select distinct m.owner from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
            where g.cree_par = p_owner loop
    perform public.vrm_accomp_elaguer(o);
  end loop;
  update public.vrm_accomp_groupes g set cree_par = pg_catalog.gen_random_uuid()
   where g.cree_par = p_owner; get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- ── 18. LES DROITS DES FONCTIONS ─────────────────────────────────────────────
revoke all on function public.vrm_accomp_code_neuf() from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_niveau(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_nom_ok(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_elaguer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_vue(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_quatre_ok(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_chiffres_ok(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_ligne_ok(jsonb, int) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_detail_ok(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_lire() from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_ce_que_voit(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_apercu(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_creer(text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_demander(text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_decider(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_retirer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_quitter(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_partage(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_code(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_fermer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_publier(jsonb, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_effacer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_accomp_lire() to authenticated;
grant execute on function public.vrm_accomp_ce_que_voit(uuid) to authenticated;
grant execute on function public.vrm_accomp_apercu(text) to authenticated;
grant execute on function public.vrm_accomp_creer(text, text, text) to authenticated;
grant execute on function public.vrm_accomp_demander(text, text, text) to authenticated;
grant execute on function public.vrm_accomp_decider(uuid, boolean) to authenticated;
grant execute on function public.vrm_accomp_retirer(uuid) to authenticated;
grant execute on function public.vrm_accomp_quitter(uuid) to authenticated;
grant execute on function public.vrm_accomp_partage(uuid, text) to authenticated;
grant execute on function public.vrm_accomp_code(uuid) to authenticated;
grant execute on function public.vrm_accomp_fermer(uuid) to authenticated;
grant execute on function public.vrm_accomp_publier(jsonb, jsonb) to authenticated;
grant execute on function public.vrm_accomp_effacer(uuid) to service_role;

commit;
