-- ════════════════════════════════════════════════════════════════════════════
-- 032 — LA COMMUNAUTÉ POUR LES CRÉATEURS DE FORMATION (10 novembre 2026)
--       PAS APPLIQUÉE (geste de Julien, docs/passation/2026-11-10-communaute-formateurs.md).
-- ════════════════════════════════════════════════════════════════════════════
-- Demande de Julien (9 nov., 21 h, docs/passation/2026-11-09-propositions.md, n° 7) :
-- « Communauté : un outil parfait et pratique pour les créateurs de formation. »
--
-- S'APPUIE SUR LA 025 (groupes d'accompagnement : entrer = DEMANDER, le
-- créateur valide, le membre choisit ce qu'il partage, PAR DÉFAUT RIEN) et ne la
-- modifie pas. Elle ajoute, pour le formateur :
--   • SA PAGE PUBLIQUE (vrm.center/f/<adresse>) : son nom, sa présentation, les
--     groupes qu'il y montre. Éteinte par défaut ; lisible sans compte seulement
--     une fois publiée, et seulement tant que son abonnement est actif. Elle ne
--     rend JAMAIS son compte, son email, ni le moindre chiffre d'un élève.
--   • « DEMANDER À REJOINDRE » depuis la page : la MÊME demande que le code (la
--     025 : statut « attente », partage choisi, « rien » par défaut) — seulement
--     pour un groupe que le formateur a mis sur sa page.
--   • LE PROGRAMME : des étapes par groupe (« Installer l'extension », « 10 ventes
--     ce mois »…). L'élève coche SES étapes. Le formateur ne voit ce qu'il a coché
--     QUE si l'élève l'a accepté (`vrm_form_accords.etapes`, FAUX par défaut,
--     révocable à tout moment, effet immédiat).
--   • LES ANNONCES : le formateur écrit à son groupe (1 000 caractères, 10 par
--     jour) ; seuls les membres ACCEPTÉS d'un groupe ouvert les lisent.
-- Les CHIFFRES d'un élève restent ceux de la 025 (`vrm_accomp_vue` : rien sans
-- son partage) : cette migration n'en rend aucun et ne lit aucune donnée d'un
-- vendeur (ni `app_data`, ni `vinted_accounts`, ni `vrm_accomp_partages`).
--
-- LES GARANTIES (dans la BASE) : RLS activé ET forcé sur les six tables, aucune
-- règle, aucun droit (ni anon, ni authenticated, ni service_role) ; tout passe
-- par des fonctions SECURITY DEFINER, `search_path` vide, identité tirée du
-- jeton (`auth.uid()`), jamais d'un paramètre. Seule `vrm_form_page` est
-- ouverte à `anon` (la page publique) ; elle ne rend que ce qui est public.
-- « FERMER MON COMPTE » : `vrm_form_effacer(owner)` (clé de service) dépublie et
-- détache sa page, retire ses accords. ⚠️ AUCUNE suppression dans ce fichier
-- (l'outil SQL demande une confirmation pour ce mot) : il se colle d'un bloc.
-- Additif et rejouable. Exige la 025 (refusé sans elle). Aucun DROP.
--
-- ── ESSAI (rien n'est gardé) ─────────────────────────────────────────────────
--   Coller dans l'éditeur SQL de Supabase, d'un bloc :
--     begin;
--     <le contenu de ce fichier ENTRE `begin;` et `commit;` ci-dessous>
--     do $e$ declare n int; f int; p jsonb; begin
--       select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
--        where s.nspname = 'public' and c.relname like 'vrm\_form\_%' and c.relkind = 'r'
--          and c.relrowsecurity and c.relforcerowsecurity;
--       select count(*) into f from pg_proc where proname like 'vrm\_form\_%';
--       set local role anon;
--       p := public.vrm_form_page('page-qui-n-existe-pas');
--       reset role;
--       if n <> 6 or f <> 18 or (p ->> 'ok') <> 'false' then
--         raise exception 'ESSAI RATÉ : tables % (6), fonctions % (18), page %', n, f, p;
--       end if;
--       raise notice 'ESSAI OK : 6 tables (RLS forcé), 18 fonctions, page inconnue refusée';
--     end $e$;
--     rollback;
--   Attendu : « ESSAI OK : … » puis ROLLBACK (rien n'est installé : tout est annulé).
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 1. CE QUI DOIT ÊTRE LÀ AVANT ─────────────────────────────────────────────
do $$ begin
  if pg_catalog.to_regprocedure('public.vrm_acces_pour(uuid)') is null
     or pg_catalog.to_regprocedure('public.vrm_accomp_demander(text,text,text)') is null
     or pg_catalog.to_regclass('public.vrm_accomp_groupes') is null
     or pg_catalog.to_regclass('public.vrm_accomp_membres') is null then
    raise exception 'vrm_form_prealable : la 025 (groupes d''accompagnement) doit être appliquée d''abord — rien n''est installé';
  end if;
end $$;

-- ── 2. LES SIX TABLES ────────────────────────────────────────────────────────
-- La page du formateur : une par compte.
create table if not exists public.vrm_form_pages (
  owner uuid primary key,
  adresse text not null,
  nom text not null,
  presentation text not null default '',
  publiee boolean not null default false,
  maj_le timestamptz not null default now(),
  constraint vrm_form_page_adresse unique (adresse),
  constraint vrm_form_page_adresse_forme check (adresse ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' and adresse !~ '--'),
  constraint vrm_form_page_nom check (char_length(nom) between 2 and 40 and nom = btrim(nom) and nom !~ '[@<>]'),
  constraint vrm_form_page_presentation check (char_length(presentation) <= 600 and presentation !~ '[<>]')
);
-- Les groupes que le formateur montre sur sa page (absent = pas montré).
create table if not exists public.vrm_form_vitrine (
  groupe uuid primary key,
  montre boolean not null default true,
  maj_le timestamptz not null default now(),
  constraint vrm_form_vitrine_groupe foreign key (groupe) references public.vrm_accomp_groupes (id)
);
-- Le programme d'un groupe.
create table if not exists public.vrm_form_etapes (
  id uuid primary key default gen_random_uuid(),
  groupe uuid not null,
  ordre int not null,
  titre text not null,
  cree_le timestamptz not null default now(),
  retiree_le timestamptz,
  constraint vrm_form_etape_groupe foreign key (groupe) references public.vrm_accomp_groupes (id),
  constraint vrm_form_etape_titre check (char_length(titre) between 2 and 80 and titre = btrim(titre) and titre !~ '[<>]')
);
-- Ce que l'élève a coché (une ligne par adhésion et par étape ; décocher = fait_le vide).
create table if not exists public.vrm_form_progres (
  membre uuid not null,
  etape uuid not null,
  fait_le timestamptz,
  constraint vrm_form_progres_pk primary key (membre, etape),
  constraint vrm_form_progres_membre foreign key (membre) references public.vrm_accomp_membres (id),
  constraint vrm_form_progres_etape foreign key (etape) references public.vrm_form_etapes (id)
);
-- L'ACCORD de l'élève : le formateur voit-il ses étapes ? (absent = non)
create table if not exists public.vrm_form_accords (
  membre uuid primary key,
  etapes boolean not null default false,
  maj_le timestamptz not null default now(),
  constraint vrm_form_accord_membre foreign key (membre) references public.vrm_accomp_membres (id)
);
-- Les annonces du formateur à un groupe.
create table if not exists public.vrm_form_annonces (
  id uuid primary key default gen_random_uuid(),
  groupe uuid not null,
  texte text not null,
  cree_le timestamptz not null default now(),
  retiree_le timestamptz,
  constraint vrm_form_annonce_groupe foreign key (groupe) references public.vrm_accomp_groupes (id),
  constraint vrm_form_annonce_texte check (char_length(texte) between 1 and 1000 and texte = btrim(texte))
);

-- ── 3. LA FORME APRÈS (les six tables) ───────────────────────────────────────
do $$ declare v text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_form_accords', 'vrm_form_annonces', 'vrm_form_etapes', 'vrm_form_pages', 'vrm_form_progres', 'vrm_form_vitrine']) t(n)
    into v;
  if v is distinct from '508fd6a9efdf03054aa08459c14e1164' then
    raise exception 'vrm_form_forme : une table des formateurs existe sous une autre forme (empreinte %) — rien n''est installé', v;
  end if;
end $$;

create index if not exists vrm_form_etapes_groupe on public.vrm_form_etapes (groupe);
create index if not exists vrm_form_annonces_groupe on public.vrm_form_annonces (groupe, cree_le);
create index if not exists vrm_form_progres_etape on public.vrm_form_progres (etape);
alter table public.vrm_form_pages enable row level security;
alter table public.vrm_form_pages force row level security;
alter table public.vrm_form_vitrine enable row level security;
alter table public.vrm_form_vitrine force row level security;
alter table public.vrm_form_etapes enable row level security;
alter table public.vrm_form_etapes force row level security;
alter table public.vrm_form_progres enable row level security;
alter table public.vrm_form_progres force row level security;
alter table public.vrm_form_accords enable row level security;
alter table public.vrm_form_accords force row level security;
alter table public.vrm_form_annonces enable row level security;
alter table public.vrm_form_annonces force row level security;
revoke all on public.vrm_form_pages from public, anon, authenticated, service_role;
revoke all on public.vrm_form_vitrine from public, anon, authenticated, service_role;
revoke all on public.vrm_form_etapes from public, anon, authenticated, service_role;
revoke all on public.vrm_form_progres from public, anon, authenticated, service_role;
revoke all on public.vrm_form_accords from public, anon, authenticated, service_role;
revoke all on public.vrm_form_annonces from public, anon, authenticated, service_role;

-- ── 4. AIDES INTERNES (personne ne les exécute directement) ──────────────────
-- Le groupe vivant que JE crée (sinon null).
create or replace function public.vrm_form_mon_groupe(p_groupe uuid)
returns uuid language sql stable set search_path = '' as $$
  select g.id from public.vrm_accomp_groupes g
   where g.id = p_groupe and g.cree_par = auth.uid() and g.ferme_le is null
$$;
-- Mon adhésion ACCEPTÉE dans un groupe ouvert (sinon null) — le groupe avec.
create or replace function public.vrm_form_mon_adhesion(p_adhesion uuid)
returns table (membre uuid, groupe uuid) language sql stable set search_path = '' as $$
  select m.id, m.groupe from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
   where m.id = p_adhesion and m.owner = auth.uid() and m.statut = 'accepte' and g.ferme_le is null
$$;
-- Les étapes vivantes d'un groupe (dans l'ordre).
create or replace function public.vrm_form_etapes_de(p_groupe uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'titre', e.titre, 'ordre', e.ordre) order by e.ordre, e.cree_le, e.id), '[]'::jsonb)
    from public.vrm_form_etapes e where e.groupe = p_groupe and e.retiree_le is null
$$;
-- Les 30 dernières annonces vivantes d'un groupe (la plus récente d'abord).
create or replace function public.vrm_form_annonces_de(p_groupe uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'texte', x.texte, 'le', x.cree_le) order by x.cree_le desc, x.id), '[]'::jsonb)
    from (select a.id, a.texte, a.cree_le from public.vrm_form_annonces a
           where a.groupe = p_groupe and a.retiree_le is null order by a.cree_le desc, a.id limit 30) x
$$;
-- Les étapes cochées d'une adhésion (identifiants), étapes vivantes seulement.
create or replace function public.vrm_form_faits_de(p_membre uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(p.etape order by p.fait_le, p.etape), '[]'::jsonb)
    from public.vrm_form_progres p join public.vrm_form_etapes e on e.id = p.etape
   where p.membre = p_membre and p.fait_le is not null and e.retiree_le is null
$$;
-- LA RÈGLE « ce que le formateur voit du programme d'un élève » (une seule, §11) :
-- seulement un membre ACCEPTÉ qui a DONNÉ son accord ; sinon la clé est absente.
create or replace function public.vrm_form_progres_vu(p_membre uuid)
returns jsonb language sql stable set search_path = '' as $$
  select case when m.statut = 'accepte' and coalesce(a.etapes, false)
              then jsonb_build_object('membre', m.id, 'faits', public.vrm_form_faits_de(m.id))
              else jsonb_build_object('membre', m.id) end
    from public.vrm_accomp_membres m left join public.vrm_form_accords a on a.membre = m.id
   where m.id = p_membre
$$;

-- ── 5. LIRE : ma page · mes groupes (programme, annonces, progrès consentis) · mes adhésions ──
create or replace function public.vrm_form_lire()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then null
    when not public.vrm_acces_pour(auth.uid()) then jsonb_build_object('acces', false)
    else jsonb_build_object('acces', true,
      'page', (select jsonb_build_object('adresse', p.adresse, 'nom', p.nom, 'presentation', p.presentation, 'publiee', p.publiee, 'maj_le', p.maj_le)
                 from public.vrm_form_pages p where p.owner = auth.uid()),
      'crees', coalesce((select jsonb_agg(jsonb_build_object('groupe', g.id,
                     'vitrine', coalesce((select v.montre from public.vrm_form_vitrine v where v.groupe = g.id), false),
                     'etapes', public.vrm_form_etapes_de(g.id),
                     'annonces', public.vrm_form_annonces_de(g.id),
                     'progres', coalesce((select jsonb_agg(public.vrm_form_progres_vu(m.id) order by m.demande_le, m.id)
                                            from public.vrm_accomp_membres m where m.groupe = g.id and m.statut = 'accepte'), '[]'::jsonb))
                     order by g.cree_le, g.id)
                   from public.vrm_accomp_groupes g where g.cree_par = auth.uid() and g.ferme_le is null), '[]'::jsonb),
      'rejoints', coalesce((select jsonb_agg(jsonb_build_object('adhesion', m.id, 'groupe', g.id,
                     'accord', coalesce((select a.etapes from public.vrm_form_accords a where a.membre = m.id), false),
                     'etapes', public.vrm_form_etapes_de(g.id),
                     'annonces', public.vrm_form_annonces_de(g.id),
                     'faits', public.vrm_form_faits_de(m.id))
                     order by m.demande_le, m.id)
                   from public.vrm_accomp_membres m join public.vrm_accomp_groupes g on g.id = m.groupe
                  where m.owner = auth.uid() and m.statut = 'accepte' and g.ferme_le is null), '[]'::jsonb))
  end
$$;

-- ── 6. LA PAGE PUBLIQUE (anon) : seulement publiée, formateur abonné ─────────
-- Rend : nom, présentation, les groupes montrés (id, nom, description). Jamais
-- un compte, un email, un code, un membre ni un chiffre.
create or replace function public.vrm_form_page(p_adresse text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare a text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_adresse, ''))); p record;
begin
  if a !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' then return jsonb_build_object('ok', false, 'raison', 'page'); end if;
  select x.owner, x.nom, x.presentation into p from public.vrm_form_pages x where x.adresse = a and x.publiee;
  if p.owner is null or not public.vrm_acces_pour(p.owner) then return jsonb_build_object('ok', false, 'raison', 'page'); end if;
  return jsonb_build_object('ok', true, 'adresse', a, 'nom', p.nom, 'presentation', p.presentation,
    'groupes', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'nom', g.nom, 'description', g.description) order by g.cree_le, g.id)
                           from public.vrm_accomp_groupes g join public.vrm_form_vitrine v on v.groupe = g.id and v.montre
                          where g.cree_par = p.owner and g.ferme_le is null), '[]'::jsonb));
end $$;

-- ── 7. RÉGLER MA PAGE ────────────────────────────────────────────────────────
create or replace function public.vrm_form_page_ranger(p_adresse text, p_nom text, p_presentation text, p_publiee boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); a text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_adresse, '')));
        n text := pg_catalog.btrim(coalesce(p_nom, '')); d text := pg_catalog.btrim(coalesce(p_presentation, ''));
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  -- Dépublier marche TOUJOURS (même sans abonnement) ; publier ou changer demande l'accès.
  if p_publiee is not true and exists (select 1 from public.vrm_form_pages x where x.owner = moi) and not public.vrm_acces_pour(moi) then
    update public.vrm_form_pages x set publiee = false, maj_le = pg_catalog.now() where x.owner = moi;
    return jsonb_build_object('ok', true, 'publiee', false);
  end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if a !~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$' or a ~ '--' then return jsonb_build_object('ok', false, 'raison', 'adresse'); end if;
  if pg_catalog.char_length(n) not between 2 and 40 or n ~ '[@<>]' then return jsonb_build_object('ok', false, 'raison', 'nom'); end if;
  if pg_catalog.char_length(d) > 600 or d ~ '[<>]' then return jsonb_build_object('ok', false, 'raison', 'presentation'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_form_adresse'), pg_catalog.hashtext(a));
  if exists (select 1 from public.vrm_form_pages x where x.adresse = a and x.owner <> moi) then
    return jsonb_build_object('ok', false, 'raison', 'adresse-prise');
  end if;
  insert into public.vrm_form_pages as x (owner, adresse, nom, presentation, publiee, maj_le)
       values (moi, a, n, d, p_publiee is true, pg_catalog.now())
  on conflict (owner) do update set adresse = excluded.adresse, nom = excluded.nom, presentation = excluded.presentation,
       publiee = excluded.publiee, maj_le = excluded.maj_le;
  return jsonb_build_object('ok', true, 'adresse', a, 'publiee', p_publiee is true);
end $$;

-- ── 8. MONTRER (ou non) UN DE MES GROUPES SUR MA PAGE ────────────────────────
create or replace function public.vrm_form_vitrine_regler(p_groupe uuid, p_montre boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if p_montre is true and not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if public.vrm_form_mon_groupe(p_groupe) is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  insert into public.vrm_form_vitrine as v (groupe, montre, maj_le) values (p_groupe, p_montre is true, pg_catalog.now())
  on conflict (groupe) do update set montre = excluded.montre, maj_le = excluded.maj_le;
  return jsonb_build_object('ok', true, 'montre', p_montre is true);
end $$;

-- ── 9. DEMANDER À REJOINDRE DEPUIS LA PAGE (la MÊME demande que le code) ─────
create or replace function public.vrm_form_demander(p_adresse text, p_groupe uuid, p_nom text, p_partage text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); a text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_adresse, ''))); c text;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  select g.code into c
    from public.vrm_form_pages p
    join public.vrm_accomp_groupes g on g.cree_par = p.owner and g.id = p_groupe and g.ferme_le is null
    join public.vrm_form_vitrine v on v.groupe = g.id and v.montre
   where p.adresse = a and p.publiee and public.vrm_acces_pour(p.owner);
  if c is null then return jsonb_build_object('ok', false, 'raison', 'page'); end if;
  -- La règle d'entrée de la 025, inchangée : « attente », partage « rien » par défaut.
  return public.vrm_accomp_demander(c, p_nom, coalesce(p_partage, 'rien'));
end $$;

-- ── 10. LE PROGRAMME (le formateur) ──────────────────────────────────────────
create or replace function public.vrm_form_etape(p_groupe uuid, p_titre text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); t text := pg_catalog.btrim(coalesce(p_titre, '')); i uuid; o int;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if public.vrm_form_mon_groupe(p_groupe) is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  if pg_catalog.char_length(t) not between 2 and 80 or t ~ '[<>]' then return jsonb_build_object('ok', false, 'raison', 'titre'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_form_g'), pg_catalog.hashtext(p_groupe::text));
  if (select pg_catalog.count(*) from public.vrm_form_etapes e where e.groupe = p_groupe and e.retiree_le is null) >= 30 then
    return jsonb_build_object('ok', false, 'raison', 'trop-etapes');
  end if;
  select coalesce(pg_catalog.max(e.ordre), 0) + 1 into o from public.vrm_form_etapes e where e.groupe = p_groupe;
  insert into public.vrm_form_etapes (groupe, ordre, titre) values (p_groupe, o, t) returning id into i;
  return jsonb_build_object('ok', true, 'id', i);
end $$;
create or replace function public.vrm_form_etape_retirer(p_etape uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  update public.vrm_form_etapes e set retiree_le = pg_catalog.now()
   where e.id = p_etape and e.retiree_le is null and public.vrm_form_mon_groupe(e.groupe) is not null;
  if not found then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 11. LES ANNONCES (le formateur) ──────────────────────────────────────────
create or replace function public.vrm_form_annonce(p_groupe uuid, p_texte text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); t text := pg_catalog.btrim(coalesce(p_texte, '')); i uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if public.vrm_form_mon_groupe(p_groupe) is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  if pg_catalog.char_length(t) not between 1 and 1000 then return jsonb_build_object('ok', false, 'raison', 'texte'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_form_g'), pg_catalog.hashtext(p_groupe::text));
  if (select pg_catalog.count(*) from public.vrm_form_annonces a where a.groupe = p_groupe and a.cree_le > pg_catalog.now() - interval '24 hours') >= 10 then
    return jsonb_build_object('ok', false, 'raison', 'plafond-annonces');
  end if;
  insert into public.vrm_form_annonces (groupe, texte) values (p_groupe, t) returning id into i;
  return jsonb_build_object('ok', true, 'id', i);
end $$;
create or replace function public.vrm_form_annonce_retirer(p_annonce uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  update public.vrm_form_annonces a set retiree_le = pg_catalog.now()
   where a.id = p_annonce and a.retiree_le is null and public.vrm_form_mon_groupe(a.groupe) is not null;
  if not found then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;
  return jsonb_build_object('ok', true);
end $$;

-- ── 12. L'ÉLÈVE COCHE (ou décoche) UNE DE SES ÉTAPES ─────────────────────────
create or replace function public.vrm_form_cocher(p_adhesion uuid, p_etape uuid, p_fait boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); m record;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  select x.membre, x.groupe into m from public.vrm_form_mon_adhesion(p_adhesion) x;
  if m.membre is null then return jsonb_build_object('ok', false, 'raison', 'adhesion'); end if;
  if not exists (select 1 from public.vrm_form_etapes e where e.id = p_etape and e.groupe = m.groupe and e.retiree_le is null) then
    return jsonb_build_object('ok', false, 'raison', 'etape');
  end if;
  insert into public.vrm_form_progres as p (membre, etape, fait_le) values (m.membre, p_etape, case when p_fait is true then pg_catalog.now() end)
  on conflict (membre, etape) do update set fait_le = case when p_fait is true then coalesce(p.fait_le, pg_catalog.now()) end;
  return jsonb_build_object('ok', true, 'fait', p_fait is true);
end $$;

-- ── 13. L'ACCORD DE L'ÉLÈVE : le formateur voit-il mes étapes ? (révocable) ──
create or replace function public.vrm_form_accord(p_adhesion uuid, p_etapes boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  -- Retirer son accord marche TOUJOURS ; le donner demande l'accès.
  if p_etapes is true and not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_accomp_membres m where m.id = p_adhesion and m.owner = moi and m.statut in ('attente', 'accepte')) then
    return jsonb_build_object('ok', false, 'raison', 'adhesion');
  end if;
  insert into public.vrm_form_accords as a (membre, etapes, maj_le) values (p_adhesion, p_etapes is true, pg_catalog.now())
  on conflict (membre) do update set etapes = excluded.etapes, maj_le = excluded.maj_le;
  return jsonb_build_object('ok', true, 'etapes', p_etapes is true);
end $$;

-- ── 14. « FERMER MON COMPTE » (clé de service) ──────────────────────────────
-- Sa page : dépubliée, détachée (un compte tiré au hasard), nom et présentation
-- vidés, adresse libérée. Ses accords : retirés (ses adhésions sont détachées
-- par `vrm_accomp_effacer`, 025). À appeler AVANT `vrm_accomp_effacer`.
create or replace function public.vrm_form_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer := 0; k integer;
begin
  if p_owner is null then return 0; end if;
  update public.vrm_form_pages p set owner = pg_catalog.gen_random_uuid(), publiee = false, nom = 'Compte fermé', presentation = '',
         adresse = 'ferme-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.gen_random_uuid()::text), 1, 20), maj_le = pg_catalog.now()
   where p.owner = p_owner; get diagnostics k = row_count; n := n + k;
  update public.vrm_form_accords a set etapes = false, maj_le = pg_catalog.now()
   where a.etapes and a.membre in (select m.id from public.vrm_accomp_membres m where m.owner = p_owner);
  get diagnostics k = row_count; n := n + k;
  update public.vrm_form_vitrine v set montre = false, maj_le = pg_catalog.now()
   where v.montre and v.groupe in (select g.id from public.vrm_accomp_groupes g where g.cree_par = p_owner);
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- ── 15. LES DROITS DES FONCTIONS ─────────────────────────────────────────────
revoke all on function public.vrm_form_mon_groupe(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_mon_adhesion(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_etapes_de(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_annonces_de(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_faits_de(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_progres_vu(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_lire() from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_page(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_page_ranger(text, text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_vitrine_regler(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_demander(text, uuid, text, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_etape(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_etape_retirer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_annonce(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_annonce_retirer(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_cocher(uuid, uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_accord(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_form_effacer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_form_lire() to authenticated;
grant execute on function public.vrm_form_page(text) to anon, authenticated;
grant execute on function public.vrm_form_page_ranger(text, text, text, boolean) to authenticated;
grant execute on function public.vrm_form_vitrine_regler(uuid, boolean) to authenticated;
grant execute on function public.vrm_form_demander(text, uuid, text, text) to authenticated;
grant execute on function public.vrm_form_etape(uuid, text) to authenticated;
grant execute on function public.vrm_form_etape_retirer(uuid) to authenticated;
grant execute on function public.vrm_form_annonce(uuid, text) to authenticated;
grant execute on function public.vrm_form_annonce_retirer(uuid) to authenticated;
grant execute on function public.vrm_form_cocher(uuid, uuid, boolean) to authenticated;
grant execute on function public.vrm_form_accord(uuid, boolean) to authenticated;
grant execute on function public.vrm_form_effacer(uuid) to service_role;

commit;
