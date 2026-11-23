-- ════════════════════════════════════════════════════════════════════════════
-- 046 — LA COMMUNAUTÉ : LE « COUCOU » ET L'HABILLAGE DES GROUPES
-- (17 novembre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- Julien (17 nov.) : « Je veux que tu améliores aussi la création de groupe
-- d'accompagnement. Je veux aussi que les personnes puissent se faire coucou,
-- mais pas échanger des messages dans mon app, mais sur Discord. »
--
-- S'APPUIE SUR LA 025 (groupes d'accompagnement, appliquée le 10 nov.) SANS LA
-- CHANGER : aucune de ses tables ni de ses fonctions n'est touchée (son
-- empreinte reste la même). Quatre tables neuves, à côté.
--
--   • `vrm_accomp_habillage` — la photo du groupe (petit carré JPEG en data URL,
--     40 000 caractères au plus) et le lien de son serveur ou salon Discord
--     (invitation discord.gg / discord.com, ou salon discord.com/channels). Écrit
--     par le CRÉATEUR seul ; lu par lui et par les membres ACCEPTÉS.
--   • `vrm_accomp_coucous` — UN COUCOU = (de, à, groupe, quand). AUCUNE colonne
--     de texte : un coucou ne porte aucun contenu, jamais. Aucune fonction ne
--     prend de texte pour un coucou.
--   • `vrm_accomp_sourdines` — « Ne plus recevoir ses coucous » : (qui, de qui).
--   • `vrm_accomp_ouverts` — un MEMBRE peut dire « Les autres membres peuvent me
--     faire coucou » (NON par défaut). Sans ça, rien ne change à la règle de la
--     025 : un membre ne voit jamais les autres membres ; il ne voit que le
--     créateur (qu'il voit déjà). Deux membres ne se voient que s'ils l'ont
--     TOUS LES DEUX ouvert, dans le même groupe.
--
-- LES GARANTIES (dans la BASE) :
--   • Un coucou n'existe qu'entre deux personnes du MÊME groupe ouvert : le
--     créateur et un membre accepté, ou deux membres acceptés qui ont tous deux
--     ouvert. Jamais à soi-même. Jamais à quelqu'un en attente, refusé, retiré,
--     parti, ni dans un groupe fermé.
--   • UN coucou par PAIRE de personnes par 24 h (dans un sens ou dans l'autre,
--     tous groupes confondus) ; 20 coucous par expéditeur par 24 h glissantes.
--     Un verrou par expéditeur et par paire : deux envois simultanés ne passent
--     pas tous les deux.
--   • Couper quelqu'un (sourdine) : ses coucous ne passent plus (refus neutre
--     « indisponible », sans dire pourquoi) et ceux d'avant ne s'affichent plus.
--   • RLS activé ET forcé sur les quatre tables, aucun droit (ni anon, ni
--     authenticated, ni service_role) : tout passe par des fonctions SECURITY
--     DEFINER qui prennent l'identité dans le jeton. Les règles de lecture
--     écrites ci-dessous bornent même un droit accordé un jour par erreur :
--     un coucou n'est visible QUE de celui qui l'a fait et de celui qui l'a reçu.
--   • Jamais le compte ni l'email de quelqu'un : une personne est désignée par
--     l'identifiant PUBLIC de son adhésion (025) et le NOM qu'elle a choisi.
--     Deux fonctions réservées à la clé de service (la route de VRM) rendent le
--     compte de l'autre — pour SONNER chez celui qui reçoit et pour trouver le
--     Discord relié de celui qui a fait coucou — et la route ne le renvoie jamais.
--   • « Fermer mon compte » : `vrm_coucou_effacer(owner)` (clé de service)
--     détache ses coucous et ses sourdines (identifiant tiré au hasard).
-- ⚠️ Ce fichier ne contient AUCUNE suppression : il se colle d'un bloc.
-- Additif et rejouable. Exige la 025 (refusé sans elle). Aucun DROP.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 1. CE QUI DOIT ÊTRE LÀ AVANT ─────────────────────────────────────────────
do $$ begin
  if pg_catalog.to_regprocedure('public.vrm_acces_pour(uuid)') is null
     or pg_catalog.to_regprocedure('public.vrm_accomp_lire()') is null
     or pg_catalog.to_regclass('public.vrm_accomp_membres') is null then
    raise exception 'vrm_coucou_prealable : la 025 (groupes d''accompagnement) doit être appliquée d''abord — rien n''est installé';
  end if;
end $$;

-- ── 2. LES QUATRE TABLES ─────────────────────────────────────────────────────
create table if not exists public.vrm_accomp_habillage (
  groupe uuid primary key,
  discord text,
  photo text,
  maj_le timestamptz not null default now(),
  constraint vrm_accomp_habillage_groupe foreign key (groupe) references public.vrm_accomp_groupes (id),
  constraint vrm_accomp_habillage_discord check (discord is null or (char_length(discord) <= 120
    and discord ~ '^https://(discord\.gg/[A-Za-z0-9-]{2,32}|(www\.)?discord\.com/(invite/[A-Za-z0-9-]{2,32}|channels/[0-9]{15,25}(/[0-9]{15,25})?))/?$')),
  constraint vrm_accomp_habillage_photo check (photo is null or (char_length(photo) <= 40000 and photo ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'))
);

create table if not exists public.vrm_accomp_coucous (
  id uuid primary key default gen_random_uuid(),
  de uuid not null,
  a uuid not null,
  groupe uuid not null,
  le timestamptz not null default now(),
  constraint vrm_accomp_coucou_groupe foreign key (groupe) references public.vrm_accomp_groupes (id),
  constraint vrm_accomp_coucou_pas_soi check (de <> a)
);

create table if not exists public.vrm_accomp_sourdines (
  owner uuid not null,
  muet uuid not null,
  actif boolean not null default true,
  le timestamptz not null default now(),
  constraint vrm_accomp_sourdine_cle primary key (owner, muet)
);

create table if not exists public.vrm_accomp_ouverts (
  membre uuid primary key,
  ouvert boolean not null default false,
  le timestamptz not null default now(),
  constraint vrm_accomp_ouvert_membre foreign key (membre) references public.vrm_accomp_membres (id)
);

-- ── 3. LA FORME APRÈS ────────────────────────────────────────────────────────
-- La table des coucous n'a QUE ces colonnes (aucun texte) : l'audit le vérifie
-- aussi, ici la base refuse de s'installer sur une table d'une autre forme.
do $$ declare v text; begin
  select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
    from pg_catalog.pg_attribute a
   where a.attrelid = pg_catalog.to_regclass('public.vrm_accomp_coucous') and a.attnum > 0 and not a.attisdropped
    into v;
  if v is distinct from 'id:uuid,de:uuid,a:uuid,groupe:uuid,le:timestamp with time zone' then
    raise exception 'vrm_coucou_forme : la table des coucous existe sous une autre forme (%) — rien n''est installé', v;
  end if;
end $$;

create index if not exists vrm_accomp_coucous_de on public.vrm_accomp_coucous (de, le);
create index if not exists vrm_accomp_coucous_a on public.vrm_accomp_coucous (a, le);

alter table public.vrm_accomp_habillage enable row level security;
alter table public.vrm_accomp_habillage force row level security;
alter table public.vrm_accomp_coucous enable row level security;
alter table public.vrm_accomp_coucous force row level security;
alter table public.vrm_accomp_sourdines enable row level security;
alter table public.vrm_accomp_sourdines force row level security;
alter table public.vrm_accomp_ouverts enable row level security;
alter table public.vrm_accomp_ouverts force row level security;
revoke all on public.vrm_accomp_habillage from public, anon, authenticated, service_role;
revoke all on public.vrm_accomp_coucous from public, anon, authenticated, service_role;
revoke all on public.vrm_accomp_sourdines from public, anon, authenticated, service_role;
revoke all on public.vrm_accomp_ouverts from public, anon, authenticated, service_role;

-- Les règles de lecture (bornes, même si un droit était accordé un jour) :
-- un coucou n'est lisible QUE par celui qui l'a fait et celui qui l'a reçu ;
-- une sourdine, par celui qui l'a posée. Aucune règle d'écriture : on n'écrit
-- que par les fonctions ci-dessous.
do $$ begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'vrm_accomp_coucous' and policyname = 'vrm_coucou_les_deux') then
    create policy vrm_coucou_les_deux on public.vrm_accomp_coucous for select to authenticated
      using (de = (select auth.uid()) or a = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'vrm_accomp_sourdines' and policyname = 'vrm_sourdine_la_sienne') then
    create policy vrm_sourdine_la_sienne on public.vrm_accomp_sourdines for select to authenticated
      using (owner = (select auth.uid()));
  end if;
end $$;

-- ── 4. AIDES INTERNES (personne ne les exécute directement) ──────────────────
-- Mon rôle dans un groupe OUVERT : 'createur' · 'membre' (accepté) · null.
create or replace function public.vrm_coucou_role(p_groupe uuid, p_owner uuid)
returns text language sql stable set search_path = '' as $$
  select case
    when exists (select 1 from public.vrm_accomp_groupes g where g.id = p_groupe and g.ferme_le is null and g.cree_par = p_owner) then 'createur'
    when exists (select 1 from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
                  where m.groupe = p_groupe and g.ferme_le is null and m.owner = p_owner and m.statut = 'accepte') then 'membre'
  end
$$;

-- Un membre accepté a-t-il OUVERT les coucous des autres membres ? (non par défaut)
create or replace function public.vrm_coucou_ouvert(p_membre uuid)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((select o.ouvert from public.vrm_accomp_ouverts o where o.membre = p_membre), false)
$$;

-- Un coucou entre ces deux personnes il y a moins de 24 h (un sens ou l'autre) ?
create or replace function public.vrm_coucou_recent(p_x uuid, p_y uuid)
returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.vrm_accomp_coucous c
                  where ((c.de = p_x and c.a = p_y) or (c.de = p_y and c.a = p_x))
                    and c.le > pg_catalog.now() - interval '24 hours')
$$;

-- Le nom que porte une personne DANS un groupe (celui qu'elle a choisi).
create or replace function public.vrm_coucou_nom(p_groupe uuid, p_owner uuid)
returns text language sql stable set search_path = '' as $$
  select coalesce((select g.createur_nom from public.vrm_accomp_groupes g where g.id = p_groupe and g.cree_par = p_owner),
                  (select m.nom from public.vrm_accomp_membres m where m.groupe = p_groupe and m.owner = p_owner))
$$;

-- ── 5. LIRE : l'habillage de mes groupes, à qui je peux faire coucou, mes coucous reçus ──
create or replace function public.vrm_coucou_lire()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return null; end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('acces', false); end if;
  return jsonb_build_object('acces', true,
    'envoyes24h', (select pg_catalog.count(*) from public.vrm_accomp_coucous c where c.de = moi and c.le > pg_catalog.now() - interval '24 hours'),
    'plafond', 20,
    'groupes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'groupe', g.id,
        'discord', h.discord,
        'photo', h.photo,
        -- Mon choix (membre) : les autres membres peuvent-ils me faire coucou ?
        'ouvert', case when r.role = 'membre' then public.vrm_coucou_ouvert(r.adhesion) end,
        'cibles', case
          when r.role = 'createur' then coalesce((
            select jsonb_agg(jsonb_build_object('cible', m.id, 'role', 'membre', 'nom', m.nom,
                                                'deja', public.vrm_coucou_recent(moi, m.owner)) order by m.nom, m.id)
              from public.vrm_accomp_membres m where m.groupe = g.id and m.statut = 'accepte'), '[]'::jsonb)
          else
            jsonb_build_array(jsonb_build_object('cible', null, 'role', 'createur', 'nom', g.createur_nom,
                                                 'deja', public.vrm_coucou_recent(moi, g.cree_par)))
            || case when public.vrm_coucou_ouvert(r.adhesion) then coalesce((
                 select jsonb_agg(jsonb_build_object('cible', m.id, 'role', 'membre', 'nom', m.nom,
                                                     'deja', public.vrm_coucou_recent(moi, m.owner)) order by m.nom, m.id)
                   from public.vrm_accomp_membres m
                  where m.groupe = g.id and m.statut = 'accepte' and m.owner <> moi and public.vrm_coucou_ouvert(m.id)), '[]'::jsonb)
               else '[]'::jsonb end
        end) order by g.cree_le, g.id)
      from (select x.id as groupe, 'createur'::text as role, null::uuid as adhesion from public.vrm_accomp_groupes x where x.cree_par = moi and x.ferme_le is null
            union all
            select m.groupe, 'membre', m.id from public.vrm_accomp_membres m join public.vrm_accomp_groupes x on x.id = m.groupe
             where m.owner = moi and m.statut = 'accepte' and x.ferme_le is null) r
      join public.vrm_accomp_groupes g on g.id = r.groupe
      left join public.vrm_accomp_habillage h on h.groupe = g.id), '[]'::jsonb),
    -- Les coucous REÇUS, 7 jours : de qui (son nom dans le groupe), quel groupe, quand.
    -- Ceux d'une personne coupée ne s'affichent plus ; ceux d'un groupe fermé non plus.
    'recus', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'groupe', c.groupe, 'groupe_nom', g.nom,
                                          'de_nom', coalesce(public.vrm_coucou_nom(c.groupe, c.de), ''),
                                          'le', c.le, 'discord_groupe', h.discord) order by c.le desc, c.id)
        from public.vrm_accomp_coucous c
        join public.vrm_accomp_groupes g on g.id = c.groupe and g.ferme_le is null
        left join public.vrm_accomp_habillage h on h.groupe = c.groupe
       where c.a = moi and c.le > pg_catalog.now() - interval '7 days'
         and public.vrm_coucou_role(c.groupe, moi) is not null
         and not exists (select 1 from public.vrm_accomp_sourdines s where s.owner = moi and s.muet = c.de and s.actif)), '[]'::jsonb),
    -- Les personnes que j'ai coupées (pour les rétablir) : le nom et un coucou d'elle.
    'sourdines', coalesce((
      select jsonb_agg(jsonb_build_object('coucou', d.id, 'nom', d.nom) order by d.nom)
        from (select distinct on (s.muet) c.id, coalesce(public.vrm_coucou_nom(c.groupe, c.de), '') as nom
                from public.vrm_accomp_sourdines s join public.vrm_accomp_coucous c on c.de = s.muet and c.a = moi
               where s.owner = moi and s.actif order by s.muet, c.le desc) d), '[]'::jsonb));
end $$;

-- ── 6. FAIRE COUCOU : un groupe, une personne (p_membre = son adhésion, ou null = le créateur) ──
-- AUCUN paramètre de texte : un coucou ne porte rien.
create or replace function public.vrm_coucou_envoyer(p_groupe uuid, p_membre uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); mon_role text; mon_adh uuid; cible uuid; cible_adh uuid; nouveau uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  mon_role := public.vrm_coucou_role(p_groupe, moi);
  if mon_role is null then return jsonb_build_object('ok', false, 'raison', 'groupe'); end if;
  if p_membre is null then
    -- Au créateur : seulement un membre accepté.
    if mon_role <> 'membre' then return jsonb_build_object('ok', false, 'raison', 'soi'); end if;
    select g.cree_par into cible from public.vrm_accomp_groupes g where g.id = p_groupe;
  else
    select m.owner, m.id into cible, cible_adh from public.vrm_accomp_membres m
     where m.id = p_membre and m.groupe = p_groupe and m.statut = 'accepte';
    if cible is null then return jsonb_build_object('ok', false, 'raison', 'cible'); end if;
    if cible = moi then return jsonb_build_object('ok', false, 'raison', 'soi'); end if;
    if mon_role = 'membre' then
      -- Entre deux membres : tous les deux l'ont ouvert, sinon ils ne se voient pas.
      select m.id into mon_adh from public.vrm_accomp_membres m where m.groupe = p_groupe and m.owner = moi and m.statut = 'accepte';
      if not (public.vrm_coucou_ouvert(mon_adh) and public.vrm_coucou_ouvert(cible_adh)) then
        return jsonb_build_object('ok', false, 'raison', 'cible');
      end if;
    end if;
  end if;
  -- Un verrou par expéditeur, puis par paire (ordre fixe : aucun blocage mutuel).
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_coucou_de'), pg_catalog.hashtext(moi::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_coucou_paire'),
    pg_catalog.hashtext(least(moi::text, cible::text) || greatest(moi::text, cible::text)));
  if exists (select 1 from public.vrm_accomp_sourdines s where s.owner = cible and s.muet = moi and s.actif) then
    return jsonb_build_object('ok', false, 'raison', 'indisponible');
  end if;
  if public.vrm_coucou_recent(moi, cible) then return jsonb_build_object('ok', false, 'raison', 'deja'); end if;
  if (select pg_catalog.count(*) from public.vrm_accomp_coucous c where c.de = moi and c.le > pg_catalog.now() - interval '24 hours') >= 20 then
    return jsonb_build_object('ok', false, 'raison', 'plafond');
  end if;
  insert into public.vrm_accomp_coucous (de, a, groupe) values (moi, cible, p_groupe) returning vrm_accomp_coucous.id into nouveau;
  return jsonb_build_object('ok', true, 'id', nouveau);
end $$;

-- ── 7. COUPER (ou rétablir) les coucous de quelqu'un — celui qui a REÇU ──────
create or replace function public.vrm_coucou_sourdine(p_coucou uuid, p_oui boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); auteur uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  select c.de into auteur from public.vrm_accomp_coucous c where c.id = p_coucou and c.a = moi;
  if auteur is null then return jsonb_build_object('ok', false, 'raison', 'coucou'); end if;
  insert into public.vrm_accomp_sourdines as s (owner, muet, actif, le) values (moi, auteur, p_oui is true, pg_catalog.now())
  on conflict (owner, muet) do update set actif = excluded.actif, le = excluded.le;
  return jsonb_build_object('ok', true, 'sourdine', p_oui is true);
end $$;

-- ── 8. UN MEMBRE ouvre (ou ferme) ses coucous aux autres membres ─────────────
create or replace function public.vrm_coucou_ouvrir(p_adhesion uuid, p_oui boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  -- Fermer marche toujours ; ouvrir demande l'accès.
  if p_oui is true and not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_accomp_membres m where m.id = p_adhesion and m.owner = moi and m.statut in ('attente', 'accepte')) then
    return jsonb_build_object('ok', false, 'raison', 'adhesion');
  end if;
  insert into public.vrm_accomp_ouverts as o (membre, ouvert, le) values (p_adhesion, p_oui is true, pg_catalog.now())
  on conflict (membre) do update set ouvert = excluded.ouvert, le = excluded.le;
  return jsonb_build_object('ok', true, 'ouvert', p_oui is true);
end $$;

-- ── 9. HABILLER SON GROUPE : photo et lien Discord (le créateur seul) ────────
-- `null` ou '' efface. Une forme refusée n'écrit rien.
create or replace function public.vrm_accomp_habiller(p_groupe uuid, p_discord text, p_photo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); d text := nullif(pg_catalog.btrim(coalesce(p_discord, '')), ''); p text := nullif(coalesce(p_photo, ''), '');
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_accomp_groupes g where g.id = p_groupe and g.cree_par = moi and g.ferme_le is null) then
    return jsonb_build_object('ok', false, 'raison', 'pas-createur');
  end if;
  if d is not null and (pg_catalog.char_length(d) > 120 or d !~ '^https://(discord\.gg/[A-Za-z0-9-]{2,32}|(www\.)?discord\.com/(invite/[A-Za-z0-9-]{2,32}|channels/[0-9]{15,25}(/[0-9]{15,25})?))/?$') then
    return jsonb_build_object('ok', false, 'raison', 'discord-groupe');
  end if;
  if p is not null and (pg_catalog.char_length(p) > 40000 or p !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$') then
    return jsonb_build_object('ok', false, 'raison', 'photo');
  end if;
  insert into public.vrm_accomp_habillage as h (groupe, discord, photo, maj_le) values (p_groupe, d, p, pg_catalog.now())
  on conflict (groupe) do update set discord = excluded.discord, photo = excluded.photo, maj_le = excluded.maj_le;
  return jsonb_build_object('ok', true, 'discord', d, 'photo', p is not null);
end $$;

-- ── 10. RÉSERVÉ À LA ROUTE DE VRM (clé de service) ──────────────────────────
-- Après un coucou RÉUSSI : à qui sonner, avec quel nom. Seulement si p_de est
-- bien celui qui l'a fait (la route passe l'identité VÉRIFIÉE de l'appelant).
create or replace function public.vrm_coucou_a_sonner(p_coucou uuid, p_de uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('a', c.a, 'de_nom', coalesce(public.vrm_coucou_nom(c.groupe, c.de), ''), 'groupe_nom', g.nom)
    from public.vrm_accomp_coucous c join public.vrm_accomp_groupes g on g.id = c.groupe
   where c.id = p_coucou and c.de = p_de and c.le > pg_catalog.now() - interval '10 minutes'
$$;
-- Pour celui qui REÇOIT (p_a, identité vérifiée) : qui a fait chacun de ses coucous
-- des 7 derniers jours — pour lui proposer le Discord relié de cette personne.
create or replace function public.vrm_coucou_auteurs(p_a uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'de', c.de)), '[]'::jsonb)
    from public.vrm_accomp_coucous c
   where c.a = p_a and c.le > pg_catalog.now() - interval '7 days'
$$;

-- « Fermer mon compte » : ses coucous et ses sourdines détachés de son compte.
create or replace function public.vrm_coucou_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer := 0; k integer;
begin
  if p_owner is null then return 0; end if;
  update public.vrm_accomp_coucous c set de = pg_catalog.gen_random_uuid() where c.de = p_owner; get diagnostics k = row_count; n := n + k;
  update public.vrm_accomp_coucous c set a = pg_catalog.gen_random_uuid() where c.a = p_owner; get diagnostics k = row_count; n := n + k;
  update public.vrm_accomp_sourdines s set owner = pg_catalog.gen_random_uuid(), actif = false where s.owner = p_owner; get diagnostics k = row_count; n := n + k;
  update public.vrm_accomp_sourdines s set muet = pg_catalog.gen_random_uuid(), actif = false where s.muet = p_owner; get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- ── 11. LES DROITS DES FONCTIONS ─────────────────────────────────────────────
revoke all on function public.vrm_coucou_role(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_ouvert(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_recent(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_nom(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_lire() from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_envoyer(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_sourdine(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_ouvrir(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_accomp_habiller(uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_a_sonner(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_auteurs(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_coucou_effacer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_coucou_lire() to authenticated;
grant execute on function public.vrm_coucou_envoyer(uuid, uuid) to authenticated;
grant execute on function public.vrm_coucou_sourdine(uuid, boolean) to authenticated;
grant execute on function public.vrm_coucou_ouvrir(uuid, boolean) to authenticated;
grant execute on function public.vrm_accomp_habiller(uuid, text, text) to authenticated;
grant execute on function public.vrm_coucou_a_sonner(uuid, uuid) to service_role;
grant execute on function public.vrm_coucou_auteurs(uuid) to service_role;
grant execute on function public.vrm_coucou_effacer(uuid) to service_role;

-- ── 12. L'ESSAI (rien n'est gardé s'il échoue : la transaction est annulée) ──
do $e$ declare n int; begin
  select pg_catalog.count(*) into n from pg_catalog.pg_class c join pg_catalog.pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relname in ('vrm_accomp_habillage', 'vrm_accomp_coucous', 'vrm_accomp_sourdines', 'vrm_accomp_ouverts')
     and c.relrowsecurity and c.relforcerowsecurity;
  if n <> 4 then raise exception 'vrm_coucou_essai : % tables sur 4 ont la RLS forcée', n; end if;
  select pg_catalog.count(*) into n from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and (p.proname like 'vrm\_coucou\_%' or p.proname = 'vrm_accomp_habiller');
  if n <> 12 then raise exception 'vrm_coucou_essai : % fonctions sur 12', n; end if;
  raise notice 'ESSAI OK : 4 tables (RLS forcé), 12 fonctions, coucou sans texte';
end $e$;

commit;
