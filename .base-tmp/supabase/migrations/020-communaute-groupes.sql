-- ════════════════════════════════════════════════════════════════════════════
-- 020 — LA COMMUNAUTÉ : LES GROUPES À CODE (accompagnement) (20 octobre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- Demande de Julien : « pour le classement et la carte, un endroit où je peux
-- mettre un code pour que les membres d'un accompagnement puissent comparer
-- leurs résultats ».
--
-- UN GROUPE = un nom + un CODE de 8 caractères (alphabet sans I, O, 0, 1 :
-- 32^8 ≈ 1 100 milliards de codes — on ne le devine pas). Qui crée le groupe
-- reçoit le code et le donne aux membres de son accompagnement ; chacun le
-- tape dans VRM, et :
--   • LA CARTE peut n'afficher que les membres du groupe ;
--   • LE CLASSEMENT du groupe compare le NOMBRE de ventes Vinted de ses membres
--     (même comptage que le classement de la 019 — une seule règle : le
--     classement public et celui d'un groupe passent par la même fonction).
--
-- LES GARANTIES (dans la BASE) :
--   • Entrer dans un groupe est un CONSENTEMENT explicite, dit à l'écran avant
--     le geste : les membres du groupe verront ton pseudo, ta ville et ton
--     nombre de ventes. Le classement PUBLIC, lui, reste opt-in à part.
--   • Il faut être sur la carte (pseudo et ville en viennent). Une adhésion
--     est rattachée à l'identifiant PUBLIC de la carte (`pid`), jamais au
--     compte : quitter la carte (la ligne part, son `pid` avec) fait quitter
--     tous ses groupes ; y revenir donne un nouveau `pid`, qui n'est dans aucun.
--   • On ne lit un groupe que si l'on en est membre ; un groupe ne montre
--     jamais l'identifiant d'un compte ni un email — le `pid` public de la carte.
--   • Seul le créateur change le code (l'ancien ne marche plus) ; personne
--     n'expulse personne, chacun quitte quand il veut.
--   • Bornes : 5 groupes créés et 10 groupes rejoints au plus par personne,
--     200 membres par groupe.
--   • L'abonnement (`vrm_acces_pour`) et les blocages : comme la carte.
--
-- ET UN PSEUDO UNIQUE sur la carte (demande du même jour) : deux personnes ne
-- portent jamais le même pseudo (majuscules ignorées) — index unique sur
-- lower(pseudo) + `vrm_communaute_rejoindre` redéfinie (« pseudo-pris ») ; un
-- pseudo laissé vide devient « Revendeur-XXXX ». ⚠️ L'index refuse l'installation
-- si deux pseudos identiques existent déjà (mesuré le 20 octobre : 0 ligne).
--
-- « FERMER MON COMPTE » : `vrm_communaute_effacer` (018) efface la ligne de la
-- carte, donc son `pid`. Ses adhésions ne désignent alors plus personne (elles
-- ne portent ni compte ni email : un `pid` tiré au hasard, qui ne se relie plus
-- à rien) et n'apparaissent plus nulle part ; un groupe qu'il avait créé perd
-- seulement son créateur (le code des autres membres continue de marcher).
-- ⚠️ Cette migration ne contient AUCUNE suppression (l'outil SQL de Supabase
-- demande une confirmation pour ce mot) : elle se colle d'un bloc.
-- Additif et rejouable. Exige la 019. Aucun DROP.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 1. LA FORME AVANT : la 019 telle qu'elle a été appliquée ─────────────────
do $$ declare avant text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_communaute_blocages', 'vrm_communaute_conversations', 'vrm_communaute_messages', 'vrm_communaute_profils', 'vrm_communaute_signalements']) t(n) into avant;
  if avant is distinct from 'f2dfc8a7f6fb366864c0706c558a6729' then
    raise exception 'vrm_communaute_forme : la 019 n''est pas installée telle quelle (empreinte %) — rien n''est installé', avant;
  end if;
end $$;

-- ── 2. LES DEUX TABLES ───────────────────────────────────────────────────────
create table if not exists public.vrm_communaute_groupes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  code text not null,
  cree_par uuid,
  cree_le timestamptz not null default now(),
  constraint vrm_communaute_groupe_code unique (code),
  constraint vrm_communaute_groupe_code_forme check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  constraint vrm_communaute_groupe_nom check (char_length(nom) between 2 and 40 and nom = btrim(nom) and nom !~ '[@<>]')
);

create table if not exists public.vrm_communaute_membres (
  groupe uuid not null,
  pid uuid not null,
  rejoint_le timestamptz not null default now(),
  quitte_le timestamptz,
  constraint vrm_communaute_membre_pk primary key (groupe, pid),
  constraint vrm_communaute_membre_groupe foreign key (groupe) references public.vrm_communaute_groupes (id)
);

-- ── 3. LA FORME APRÈS (les sept tables) ──────────────────────────────────────
do $$ declare v text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_communaute_blocages', 'vrm_communaute_conversations', 'vrm_communaute_groupes', 'vrm_communaute_membres', 'vrm_communaute_messages', 'vrm_communaute_profils', 'vrm_communaute_signalements']) t(n)
    into v;
  if v is distinct from 'c86baf95e3c9fefe49f91f754819df1b' then
    raise exception 'vrm_communaute_forme : une table des groupes existe sous une autre forme (empreinte %) — rien n''est installé', v;
  end if;
end $$;

create unique index if not exists vrm_communaute_pseudo_unique on public.vrm_communaute_profils (lower(pseudo));
create index if not exists vrm_communaute_membres_pid on public.vrm_communaute_membres (pid);
create index if not exists vrm_communaute_groupes_createur on public.vrm_communaute_groupes (cree_par);
alter table public.vrm_communaute_groupes enable row level security;
alter table public.vrm_communaute_groupes force row level security;
alter table public.vrm_communaute_membres enable row level security;
alter table public.vrm_communaute_membres force row level security;
revoke all on public.vrm_communaute_groupes from public, anon, authenticated, service_role;
revoke all on public.vrm_communaute_membres from public, anon, authenticated, service_role;

-- ── 4. UN CODE TIRÉ AU HASARD (aide interne, personne ne l'exécute) ──────────
create or replace function public.vrm_communaute_code_neuf()
returns text language plpgsql volatile set search_path = '' as $$
declare
  alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  o bytea; c text; i int; essai int := 0;
begin
  loop
    o := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    c := '';
    for i in 0..7 loop c := c || pg_catalog.substr(alpha, (pg_catalog.get_byte(o, i) % 32) + 1, 1); end loop;
    exit when not exists (select 1 from public.vrm_communaute_groupes g where g.code = c);
    essai := essai + 1;
    if essai > 20 then raise exception 'vrm_communaute_code : aucun code libre'; end if;
  end loop;
  return c;
end $$;

-- Un code tapé : majuscules, sans espaces ni tirets.
create or replace function public.vrm_communaute_code_lu(p text)
returns text language sql immutable set search_path = '' as $$
  select pg_catalog.upper(pg_catalog.regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- ── 5. CRÉER UN GROUPE (le créateur y entre) ─────────────────────────────────
create or replace function public.vrm_communaute_groupe_creer(p_nom text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); mp uuid; n text := pg_catalog.btrim(coalesce(p_nom, '')); g uuid; c text;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  select p.pid into mp from public.vrm_communaute_profils p where p.owner = moi;
  if mp is null then return jsonb_build_object('ok', false, 'raison', 'invisible'); end if;
  if pg_catalog.char_length(n) not between 2 and 40 or n ~ '[@<>]' then return jsonb_build_object('ok', false, 'raison', 'nom-groupe'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_communaute_groupe'), pg_catalog.hashtext(moi::text));
  if (select pg_catalog.count(*) from public.vrm_communaute_groupes x where x.cree_par = mp) >= 5 then
    return jsonb_build_object('ok', false, 'raison', 'trop-crees');
  end if;
  if (select pg_catalog.count(*) from public.vrm_communaute_membres m where m.pid = mp and m.quitte_le is null) >= 10 then
    return jsonb_build_object('ok', false, 'raison', 'trop-groupes');
  end if;
  c := public.vrm_communaute_code_neuf();
  insert into public.vrm_communaute_groupes (nom, code, cree_par) values (n, c, mp) returning id into g;
  insert into public.vrm_communaute_membres (groupe, pid) values (g, mp);
  return jsonb_build_object('ok', true, 'id', g, 'code', c, 'nom', n);
end $$;

-- ── 6. ENTRER DANS UN GROUPE AVEC SON CODE ───────────────────────────────────
create or replace function public.vrm_communaute_groupe_rejoindre(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); mp uuid; c text := public.vrm_communaute_code_lu(p_code); gr record;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  select p.pid into mp from public.vrm_communaute_profils p where p.owner = moi;
  if mp is null then return jsonb_build_object('ok', false, 'raison', 'invisible'); end if;
  if c !~ '^[A-HJ-NP-Z2-9]{8}$' then return jsonb_build_object('ok', false, 'raison', 'code'); end if;
  select g.id, g.nom into gr from public.vrm_communaute_groupes g where g.code = c;
  if gr.id is null then return jsonb_build_object('ok', false, 'raison', 'code'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_communaute_groupe'), pg_catalog.hashtext(moi::text));
  if exists (select 1 from public.vrm_communaute_membres m where m.groupe = gr.id and m.pid = mp and m.quitte_le is null) then
    return jsonb_build_object('ok', true, 'id', gr.id, 'nom', gr.nom, 'deja', true);
  end if;
  if (select pg_catalog.count(*) from public.vrm_communaute_membres m where m.pid = mp and m.quitte_le is null) >= 10 then
    return jsonb_build_object('ok', false, 'raison', 'trop-groupes');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_communaute_groupe_n'), pg_catalog.hashtext(gr.id::text));
  if (select pg_catalog.count(*) from public.vrm_communaute_membres m where m.groupe = gr.id and m.quitte_le is null) >= 200 then
    return jsonb_build_object('ok', false, 'raison', 'groupe-plein');
  end if;
  insert into public.vrm_communaute_membres (groupe, pid) values (gr.id, mp)
    on conflict (groupe, pid) do update set quitte_le = null, rejoint_le = pg_catalog.now();
  return jsonb_build_object('ok', true, 'id', gr.id, 'nom', gr.nom);
end $$;

-- ── 7. QUITTER UN GROUPE ─────────────────────────────────────────────────────
create or replace function public.vrm_communaute_groupe_quitter(p_groupe uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  update public.vrm_communaute_membres m set quitte_le = pg_catalog.now()
   where m.groupe = p_groupe and m.quitte_le is null
     and m.pid = (select p.pid from public.vrm_communaute_profils p where p.owner = moi);
  return jsonb_build_object('ok', true, 'quitte', found);
end $$;

-- ── 8. CHANGER LE CODE (le créateur seulement ; l'ancien ne marche plus) ─────
create or replace function public.vrm_communaute_groupe_code(p_groupe uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); c text;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_communaute_groupes g join public.vrm_communaute_profils p on p.pid = g.cree_par
                  where g.id = p_groupe and p.owner = moi) then
    return jsonb_build_object('ok', false, 'raison', 'pas-createur');
  end if;
  c := public.vrm_communaute_code_neuf();
  update public.vrm_communaute_groupes g set code = c where g.id = p_groupe;
  return jsonb_build_object('ok', true, 'code', c);
end $$;

-- ── 8 bis. REJOINDRE LA CARTE (remplace celle de la 018) : le pseudo unique ──
create or replace function public.vrm_communaute_rejoindre(p_pseudo text, p_ville text, p_pays text, p_lat numeric, p_lon numeric)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  ps text := pg_catalog.btrim(coalesce(p_pseudo, ''));
  vi text := pg_catalog.btrim(coalesce(p_ville, ''));
  pa text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_pays, 'FR')));
  la numeric; lo numeric; r public.vrm_communaute_profils;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if ps = '' then ps := 'Revendeur-' || pg_catalog.substr(public.vrm_communaute_code_neuf(), 1, 4); end if;
  if pg_catalog.char_length(ps) > 30 or ps ~ '[@<>]' then return jsonb_build_object('ok', false, 'raison', 'pseudo'); end if;
  if vi = '' or pg_catalog.char_length(vi) > 80 or vi ~ '[@<>]' then return jsonb_build_object('ok', false, 'raison', 'ville'); end if;
  if pa = '' then pa := 'FR'; end if;
  if pa !~ '^[A-Z]{2}$' then return jsonb_build_object('ok', false, 'raison', 'pays'); end if;
  if p_lat is null or p_lon is null or p_lat < -90 or p_lat > 90 or p_lon < -180 or p_lon > 180 then
    return jsonb_build_object('ok', false, 'raison', 'position');
  end if;
  -- JAMAIS une position exacte : la cellule de 0,05° (≈ 5 km) avant d'écrire.
  la := pg_catalog.round(pg_catalog.round(p_lat * 20) / 20, 2);
  lo := pg_catalog.round(pg_catalog.round(p_lon * 20) / 20, 2);
  -- UN PSEUDO UNIQUE (sans tenir compte des majuscules) : personne ne prend le nom d'un autre.
  if exists (select 1 from public.vrm_communaute_profils o where pg_catalog.lower(o.pseudo) = pg_catalog.lower(ps) and o.owner <> moi) then
    return jsonb_build_object('ok', false, 'raison', 'pseudo-pris');
  end if;
  insert into public.vrm_communaute_profils as x (owner, pseudo, ville, pays, lat, lon)
       values (moi, ps, vi, pa, la, lo)
  on conflict (owner) do update set pseudo = excluded.pseudo, ville = excluded.ville, pays = excluded.pays,
                                    lat = excluded.lat, lon = excluded.lon, maj_le = pg_catalog.now()
  returning * into r;
  return jsonb_build_object('ok', true, 'pid', r.pid, 'lat', r.lat, 'lon', r.lon, 'pseudo', r.pseudo);
exception when unique_violation then
  return jsonb_build_object('ok', false, 'raison', 'pseudo-pris');
end $$;

-- ── 9. LA CARTE (remplace celle de la 019) : + mes groupes et leurs membres ──
create or replace function public.vrm_communaute_carte()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then null
    when not public.vrm_acces_pour(auth.uid()) then jsonb_build_object('acces', false)
    else jsonb_build_object('acces', true,
      'moi', (select jsonb_build_object('pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville, 'pays', p.pays, 'lat', p.lat, 'lon', p.lon, 'depuis', p.cree_le,
                                        'discord', p.discord, 'classement', p.classement)
                from public.vrm_communaute_profils p where p.owner = auth.uid()),
      'profils', coalesce((select jsonb_agg(jsonb_build_object('pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville, 'pays', p.pays,
                     'lat', p.lat, 'lon', p.lon, 'moi', p.owner = auth.uid(), 'discord', p.discord,
                     'premier', not exists (select 1 from public.vrm_communaute_profils q
                                             where q.pays = p.pays and pg_catalog.lower(q.ville) = pg_catalog.lower(p.ville)
                                               and (q.cree_le < p.cree_le or (q.cree_le = p.cree_le and q.pid < p.pid))))
                     order by p.cree_le, p.pid)
                   from public.vrm_communaute_profils p
                  where (p.owner = auth.uid() or public.vrm_acces_pour(p.owner))
                    and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = auth.uid() and b.bloque = p.owner)), '[]'::jsonb),
      'groupes', coalesce((select jsonb_agg(jsonb_build_object('id', gr.id, 'nom', gr.nom, 'code', gr.code, 'createur', gr.cree_par is not distinct from m.pid,
                     'membres', coalesce((select jsonb_agg(p.pid order by p.cree_le, p.pid)
                                            from public.vrm_communaute_membres g join public.vrm_communaute_profils p on p.pid = g.pid
                                           where g.groupe = gr.id and g.quitte_le is null
                                             and (p.owner = auth.uid() or public.vrm_acces_pour(p.owner))
                                             and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = auth.uid() and b.bloque = p.owner)), '[]'::jsonb))
                     order by m.rejoint_le, gr.id)
                   from public.vrm_communaute_membres m join public.vrm_communaute_groupes gr on gr.id = m.groupe
                  where m.pid = (select q.pid from public.vrm_communaute_profils q where q.owner = auth.uid()) and m.quitte_le is null), '[]'::jsonb))
  end
$$;


-- ── 10. LE CLASSEMENT : UNE SEULE RÈGLE DE COMPTAGE (aide interne) ───────────
--    `p_groupe` NULL ⇒ les inscrits au classement public ; sinon ⇒ les membres
--    du groupe. Le comptage est celui de la 019, mot pour mot.
create or replace function public.vrm_communaute_classement_calc(p_periode text, p_groupe uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  moi uuid := auth.uid();
  per text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_periode, '')));
  ici timestamp := pg_catalog.now() at time zone 'Europe/Paris';
  d timestamp; f timestamp; deb timestamptz; fin timestamptz;
  r jsonb;
begin
  if moi is null then return null; end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('acces', false); end if;
  if per = 'jour' then d := pg_catalog.date_trunc('day', ici); f := d + interval '1 day';
  elsif per = 'semaine' then d := pg_catalog.date_trunc('week', ici); f := d + interval '7 days';
  elsif per = 'mois' then d := pg_catalog.date_trunc('month', ici); f := d + interval '1 month';
  elsif per = 'annee' then d := pg_catalog.date_trunc('year', ici); f := d + interval '1 year';
  else return jsonb_build_object('acces', true, 'erreur', 'periode');
  end if;
  deb := d at time zone 'Europe/Paris';
  fin := f at time zone 'Europe/Paris';
  with membres as (
    select p.owner, p.pid, p.pseudo, p.ville, p.pays, p.cree_le
      from public.vrm_communaute_profils p
     where (p.owner = moi or public.vrm_acces_pour(p.owner))
       and case when p_groupe is null then p.classement
                else exists (select 1 from public.vrm_communaute_membres g
                              where g.groupe = p_groupe and g.pid = p.pid and g.quitte_le is null) end
  ), comptes as (
    select m.*, (
      select pg_catalog.count(distinct x.tx) from (
        select coalesce(e.v ->> 'transaction_id', e.v ->> 'id') tx,
               public.vrm_communaute_ts(e.v ->> 'date') t,
               coalesce(e.v ->> 'status', '') s
          from public.vinted_accounts va
          join public.app_data a on a.owner = m.owner and a.id = 'harvest_' || va.vinted_user_id || '_orders_sold'
          cross join lateral pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(a.data -> 'payload' -> 'my_orders') = 'array'
                                                                  then a.data -> 'payload' -> 'my_orders' else '[]'::jsonb end) e(v)
         where va.owner = m.owner
           and not exists (select 1 from public.app_data h
                            where h.owner = m.owner and h.id = 'main'
                              and pg_catalog.jsonb_typeof(h.data -> 'vinted_accounts_hidden') = 'array'
                              and (h.data -> 'vinted_accounts_hidden') ? va.vinted_user_id)
      ) x
      where x.tx is not null and x.t >= deb and x.t < fin
        and x.s !~* '(annul|cancel|refus|rembours|retour|suspend|paiement\s+a\s+[ée]chou|[ée]chec\s+du\s+paiement)'
    ) ventes
    from membres m
  ), rangs as (
    select c.*, pg_catalog.rank() over (order by c.ventes desc) rang, pg_catalog.count(*) over () n from comptes c
  )
  select jsonb_build_object('acces', true, 'periode', per, 'debut', deb, 'fin', fin, 'groupe', p_groupe,
      'visible', exists (select 1 from public.vrm_communaute_profils p where p.owner = moi),
      'inscrit', exists (select 1 from public.vrm_communaute_profils p where p.owner = moi and p.classement),
      'n', (select pg_catalog.count(*) from rangs),
      'moi', (select jsonb_build_object('rang', z.rang, 'ventes', z.ventes) from rangs z where z.owner = moi),
      'lignes', coalesce((select jsonb_agg(jsonb_build_object('rang', z.rang, 'pid', z.pid, 'pseudo', z.pseudo, 'ville', z.ville,
                                   'pays', z.pays, 'ventes', z.ventes, 'moi', z.owner = moi) order by z.rang, z.cree_le, z.pid)
                           from rangs z
                          where (z.rang <= 100 or z.owner = moi)
                            and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = moi and b.bloque = z.owner)), '[]'::jsonb))
    into r;
  return r;
end $$;

create or replace function public.vrm_communaute_classement(p_periode text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select public.vrm_communaute_classement_calc(p_periode, null)
$$;

-- Le classement d'un groupe : seulement pour un membre du groupe.
create or replace function public.vrm_communaute_classement_groupe(p_periode text, p_groupe uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  if not public.vrm_acces_pour(auth.uid()) then return jsonb_build_object('acces', false); end if;
  if not exists (select 1 from public.vrm_communaute_membres m join public.vrm_communaute_profils p on p.pid = m.pid
                  where m.groupe = p_groupe and p.owner = auth.uid() and m.quitte_le is null) then
    return jsonb_build_object('acces', true, 'erreur', 'groupe');
  end if;
  return public.vrm_communaute_classement_calc(p_periode, p_groupe);
end $$;

-- ── 11. LES DROITS DES FONCTIONS ─────────────────────────────────────────────
revoke all on function public.vrm_communaute_code_neuf() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_code_lu(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_groupe_creer(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_groupe_rejoindre(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_groupe_quitter(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_groupe_code(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_carte() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_rejoindre(text, text, text, numeric, numeric) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_classement_calc(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_classement(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_classement_groupe(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_communaute_groupe_creer(text) to authenticated;
grant execute on function public.vrm_communaute_groupe_rejoindre(text) to authenticated;
grant execute on function public.vrm_communaute_groupe_quitter(uuid) to authenticated;
grant execute on function public.vrm_communaute_groupe_code(uuid) to authenticated;
grant execute on function public.vrm_communaute_carte() to authenticated;
grant execute on function public.vrm_communaute_rejoindre(text, text, text, numeric, numeric) to authenticated;
grant execute on function public.vrm_communaute_classement(text) to authenticated;
grant execute on function public.vrm_communaute_classement_groupe(text, uuid) to authenticated;

commit;
