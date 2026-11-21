-- ════════════════════════════════════════════════════════════════════════════
-- 018 — LA CARTE DE LA COMMUNAUTÉ (demande de Julien, 20 octobre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- « Un onglet avec une carte où les utilisateurs de VRM peuvent mettre leur
-- emplacement ; les autres peuvent envoyer des messages s'ils sont dans les
-- mêmes villes. » Les garanties vivent dans la BASE, pas dans l'écran :
--   • OPT-IN STRICT : personne n'est sur la carte sans y avoir mis SA ville
--     lui-même (`vrm_communaute_rejoindre`). Défaut : invisible. Retrait en un
--     geste : la ligne est SUPPRIMÉE (`vrm_communaute_quitter`).
--   • JAMAIS UNE POSITION EXACTE : la base n'accepte que des coordonnées
--     ARRONDIES à 0,05° (≈ 5 km — le centre de la ville, arrondi encore) ; une
--     contrainte refuse toute autre valeur, et la fonction arrondit avant
--     d'écrire. Aucune adresse, aucun email, aucun compte Vinted : un PSEUDO
--     choisi, une VILLE, un PAYS.
--   • CE QUE LES AUTRES VOIENT : pseudo · ville · pays · coordonnées arrondies ·
--     un identifiant PUBLIC (`pid`, tiré au hasard) — jamais l'identifiant du
--     compte (`owner`), jamais l'email.
--   • LES MESSAGES : seulement entre deux personnes VISIBLES sur la carte, texte
--     de 1 à 500 caractères, 20 messages par heure et 5 nouvelles conversations
--     par jour au plus. On ne lit QUE les conversations dont on est participant.
--   • BLOQUER : plus aucun message de cette personne ne m'arrive — et elle ne le
--     sait pas (son message est rangé « masqué » : elle le voit dans son fil, je
--     ne le vois jamais). Je ne la vois plus sur la carte.
--   • SIGNALER : rangé dans `vrm_communaute_signalements` (avec un extrait des
--     derniers messages de la personne signalée), lisible par le PROPRIÉTAIRE de
--     l'installation seulement (`vrm_reglages.proprietaire`).
--   • L'ABONNEMENT : la règle du 4 octobre (`vrm_acces_pour`). Qui ne paie plus
--     ne voit plus la carte, n'écrit plus, et n'est plus montré aux autres.
--   • « FERMER MON COMPTE » : `vrm_communaute_effacer(owner)` (serveur) efface
--     sa présence, ses conversations (messages compris), ses blocages et ses
--     signalements.
--
-- QUI LIT, QUI ÉCRIT CES TABLES : PERSONNE en direct (RLS activé et forcé,
-- aucune règle, tous les droits retirés à anon, authenticated et
-- service_role). Tout passe par les fonctions SECURITY DEFINER (search_path
-- vide), qui prennent l'identité dans le jeton (`auth.uid()`), jamais dans un
-- paramètre. Aucune table existante n'est modifiée.
--
-- Additif et rejouable : `create … if not exists`, `create or replace`, une
-- EMPREINTE de forme (une table d'une forme différente fait tout refuser).
-- Aucun DROP.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 1. LES TABLES ────────────────────────────────────────────────────────────
create table if not exists public.vrm_communaute_profils (
  owner uuid primary key,
  pid uuid not null default gen_random_uuid(),
  pseudo text not null,
  ville text not null,
  pays text not null default 'FR',
  lat numeric not null,
  lon numeric not null,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now(),
  constraint vrm_communaute_pid unique (pid),
  constraint vrm_communaute_pseudo check (char_length(pseudo) between 1 and 30 and pseudo = btrim(pseudo) and pseudo !~ '[@<>]'),
  constraint vrm_communaute_ville check (char_length(ville) between 1 and 80 and ville = btrim(ville) and ville !~ '[@<>]'),
  constraint vrm_communaute_pays check (pays ~ '^[A-Z]{2}$'),
  constraint vrm_communaute_lat check (lat between -90 and 90 and lat = round(lat * 20) / 20),
  constraint vrm_communaute_lon check (lon between -180 and 180 and lon = round(lon * 20) / 20)
);

create table if not exists public.vrm_communaute_conversations (
  id uuid primary key default gen_random_uuid(),
  a uuid not null,
  b uuid not null,
  cree_le timestamptz not null default now(),
  constraint vrm_communaute_conv_soi check (a <> b)
);

create table if not exists public.vrm_communaute_messages (
  id bigint generated always as identity primary key,
  conv uuid not null,
  de uuid not null,
  texte text not null,
  envoye_le timestamptz not null default now(),
  lu_le timestamptz,
  masque boolean not null default false,
  constraint vrm_communaute_msg_conv foreign key (conv) references public.vrm_communaute_conversations (id) on delete cascade,
  constraint vrm_communaute_msg_texte check (char_length(texte) between 1 and 500)
);

create table if not exists public.vrm_communaute_blocages (
  qui uuid not null,
  bloque uuid not null,
  le timestamptz not null default now(),
  constraint vrm_communaute_bloc_pk primary key (qui, bloque),
  constraint vrm_communaute_bloc_soi check (qui <> bloque)
);

create table if not exists public.vrm_communaute_signalements (
  id bigint generated always as identity primary key,
  par uuid not null,
  contre uuid not null,
  conv uuid,
  raison text not null default '',
  extrait jsonb not null default '[]'::jsonb,
  le timestamptz not null default now(),
  constraint vrm_communaute_sig_raison check (char_length(raison) <= 300)
);

-- L'empreinte de la forme des cinq tables : une table d'une version
-- différente fait TOUT refuser (create if not exists la sauterait en silence).
do $$ declare v text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_communaute_blocages', 'vrm_communaute_conversations', 'vrm_communaute_messages', 'vrm_communaute_profils', 'vrm_communaute_signalements']) t(n)
    into v;
  if v is distinct from '49e9d1d958352ebb3063719036ef25b5' then
    raise exception 'vrm_communaute_forme : une table de la communauté existe sous une autre forme (empreinte %) — rien n''est installé', v;
  end if;
end $$;

create unique index if not exists vrm_communaute_conv_paire on public.vrm_communaute_conversations (least(a, b), greatest(a, b));
create index if not exists vrm_communaute_conv_b on public.vrm_communaute_conversations (b);
create index if not exists vrm_communaute_msg_fil on public.vrm_communaute_messages (conv, envoye_le);
create index if not exists vrm_communaute_msg_de on public.vrm_communaute_messages (de, envoye_le);
create index if not exists vrm_communaute_ville_idx on public.vrm_communaute_profils (pays, lower(ville));

alter table public.vrm_communaute_profils enable row level security;
alter table public.vrm_communaute_profils force row level security;
alter table public.vrm_communaute_conversations enable row level security;
alter table public.vrm_communaute_conversations force row level security;
alter table public.vrm_communaute_messages enable row level security;
alter table public.vrm_communaute_messages force row level security;
alter table public.vrm_communaute_blocages enable row level security;
alter table public.vrm_communaute_blocages force row level security;
alter table public.vrm_communaute_signalements enable row level security;
alter table public.vrm_communaute_signalements force row level security;
revoke all on public.vrm_communaute_profils from public, anon, authenticated, service_role;
revoke all on public.vrm_communaute_conversations from public, anon, authenticated, service_role;
revoke all on public.vrm_communaute_messages from public, anon, authenticated, service_role;
revoke all on public.vrm_communaute_blocages from public, anon, authenticated, service_role;
revoke all on public.vrm_communaute_signalements from public, anon, authenticated, service_role;
revoke all on sequence public.vrm_communaute_messages_id_seq from public, anon, authenticated, service_role;
revoke all on sequence public.vrm_communaute_signalements_id_seq from public, anon, authenticated, service_role;

-- ── 2. LA CARTE : ma présence, et celle des autres (pseudo, ville, cellule) ──
--    NULL sans session ; `{acces:false}` quand l'abonnement est coupé.
create or replace function public.vrm_communaute_carte()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then null
    when not public.vrm_acces_pour(auth.uid()) then jsonb_build_object('acces', false)
    else jsonb_build_object('acces', true,
      'moi', (select jsonb_build_object('pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville, 'pays', p.pays, 'lat', p.lat, 'lon', p.lon, 'depuis', p.cree_le)
                from public.vrm_communaute_profils p where p.owner = auth.uid()),
      'profils', coalesce((select jsonb_agg(jsonb_build_object('pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville, 'pays', p.pays,
                     'lat', p.lat, 'lon', p.lon, 'moi', p.owner = auth.uid(),
                     'premier', not exists (select 1 from public.vrm_communaute_profils q
                                             where q.pays = p.pays and pg_catalog.lower(q.ville) = pg_catalog.lower(p.ville)
                                               and (q.cree_le < p.cree_le or (q.cree_le = p.cree_le and q.pid < p.pid))))
                     order by p.cree_le, p.pid)
                   from public.vrm_communaute_profils p
                  where (p.owner = auth.uid() or public.vrm_acces_pour(p.owner))
                    and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = auth.uid() and b.bloque = p.owner)), '[]'::jsonb))
  end
$$;

-- ── 3. REJOINDRE LA CARTE / CHANGER SA VILLE (opt-in, sur son geste) ─────────
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
  if ps = '' then ps := 'Revendeur'; end if;
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
  insert into public.vrm_communaute_profils as x (owner, pseudo, ville, pays, lat, lon)
       values (moi, ps, vi, pa, la, lo)
  on conflict (owner) do update set pseudo = excluded.pseudo, ville = excluded.ville, pays = excluded.pays,
                                    lat = excluded.lat, lon = excluded.lon, maj_le = pg_catalog.now()
  returning * into r;
  return jsonb_build_object('ok', true, 'pid', r.pid, 'lat', r.lat, 'lon', r.lon);
end $$;

-- ── 4. QUITTER LA CARTE : la ligne est supprimée ─────────────────────────────
create or replace function public.vrm_communaute_quitter()
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return false; end if;
  delete from public.vrm_communaute_profils p where p.owner = moi;
  return found;
end $$;

-- ── 5. ÉCRIRE à quelqu'un de la carte ────────────────────────────────────────
create or replace function public.vrm_communaute_ecrire(p_pid uuid, p_texte text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  t text := pg_catalog.btrim(coalesce(p_texte, ''));
  autre uuid; c uuid; n integer;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if t = '' or pg_catalog.char_length(t) > 500 then return jsonb_build_object('ok', false, 'raison', 'texte'); end if;
  if not exists (select 1 from public.vrm_communaute_profils p where p.owner = moi) then
    return jsonb_build_object('ok', false, 'raison', 'invisible');
  end if;
  select p.owner into autre from public.vrm_communaute_profils p where p.pid = p_pid and public.vrm_acces_pour(p.owner);
  if autre is null then return jsonb_build_object('ok', false, 'raison', 'introuvable'); end if;
  if autre = moi then return jsonb_build_object('ok', false, 'raison', 'soi'); end if;
  if exists (select 1 from public.vrm_communaute_blocages b where b.qui = moi and b.bloque = autre) then
    return jsonb_build_object('ok', false, 'raison', 'tu-as-bloque');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_communaute'), pg_catalog.hashtext(moi::text));
  select pg_catalog.count(*) into n from public.vrm_communaute_messages m
   where m.de = moi and m.envoye_le > pg_catalog.now() - interval '1 hour';
  if n >= 20 then return jsonb_build_object('ok', false, 'raison', 'plafond-heure'); end if;
  select x.id into c from public.vrm_communaute_conversations x
   where least(x.a, x.b) = least(moi, autre) and greatest(x.a, x.b) = greatest(moi, autre);
  if c is null then
    select pg_catalog.count(*) into n from public.vrm_communaute_conversations x
     where x.a = moi and x.cree_le > pg_catalog.now() - interval '1 day';
    if n >= 5 then return jsonb_build_object('ok', false, 'raison', 'plafond-jour'); end if;
    insert into public.vrm_communaute_conversations (a, b) values (moi, autre) returning id into c;
  end if;
  -- Bloqué par l'autre : rangé MASQUÉ (il ne le verra jamais ; l'expéditeur ne
  -- le sait pas — la règle demandée).
  insert into public.vrm_communaute_messages (conv, de, texte, masque)
       values (c, moi, t, exists (select 1 from public.vrm_communaute_blocages b where b.qui = autre and b.bloque = moi));
  return jsonb_build_object('ok', true, 'conv', c);
end $$;

-- ── 6. MES CONVERSATIONS (seulement celles dont je suis participant) ─────────
create or replace function public.vrm_communaute_conversations()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null then null else coalesce((
    select jsonb_agg(z.j order by z.quand desc) from (
      select jsonb_build_object('conv', c.id, 'pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville,
               'bloque', exists (select 1 from public.vrm_communaute_blocages b where b.qui = auth.uid() and b.bloque = o.autre),
               'dernier', d.texte, 'deMoi', d.de = auth.uid(), 'quand', d.envoye_le,
               'nonLus', (select pg_catalog.count(*) from public.vrm_communaute_messages m
                           where m.conv = c.id and m.de <> auth.uid() and not m.masque and m.lu_le is null)) j,
             d.envoye_le quand
        from public.vrm_communaute_conversations c
        cross join lateral (select case when c.a = auth.uid() then c.b else c.a end autre) o
        cross join lateral (select m.texte, m.de, m.envoye_le from public.vrm_communaute_messages m
                             where m.conv = c.id and (m.de = auth.uid() or not m.masque)
                             order by m.envoye_le desc, m.id desc limit 1) d
        left join public.vrm_communaute_profils p on p.owner = o.autre and public.vrm_acces_pour(o.autre)
       where (c.a = auth.uid() or c.b = auth.uid())) z), '[]'::jsonb) end
$$;

-- ── 7. UN FIL (participant seulement) — marque lus les messages reçus ────────
create or replace function public.vrm_communaute_fil(p_conv uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); autre uuid;
begin
  if moi is null then return null; end if;
  select case when x.a = moi then x.b else x.a end into autre
    from public.vrm_communaute_conversations x where x.id = p_conv and (x.a = moi or x.b = moi);
  if autre is null then return null; end if;
  update public.vrm_communaute_messages m set lu_le = pg_catalog.now()
   where m.conv = p_conv and m.de <> moi and not m.masque and m.lu_le is null;
  return jsonb_build_object('conv', p_conv,
    'autre', (select jsonb_build_object('pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville)
                from public.vrm_communaute_profils p where p.owner = autre and public.vrm_acces_pour(autre)),
    'bloque', exists (select 1 from public.vrm_communaute_blocages b where b.qui = moi and b.bloque = autre),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', y.id, 'moi', y.de = moi, 'texte', y.texte, 'le', y.envoye_le) order by y.envoye_le, y.id)
                  from (select m.id, m.de, m.texte, m.envoye_le from public.vrm_communaute_messages m
                         where m.conv = p_conv and (m.de = moi or not m.masque)
                         order by m.envoye_le desc, m.id desc limit 200) y), '[]'::jsonb));
end $$;

-- ── 8. BLOQUER / DÉBLOQUER (depuis un fil) ───────────────────────────────────
create or replace function public.vrm_communaute_bloquer(p_conv uuid, p_oui boolean)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); autre uuid;
begin
  if moi is null then return false; end if;
  select case when x.a = moi then x.b else x.a end into autre
    from public.vrm_communaute_conversations x where x.id = p_conv and (x.a = moi or x.b = moi);
  if autre is null then return false; end if;
  if coalesce(p_oui, true) then
    insert into public.vrm_communaute_blocages (qui, bloque) values (moi, autre) on conflict do nothing;
  else
    delete from public.vrm_communaute_blocages b where b.qui = moi and b.bloque = autre;
  end if;
  return true;
end $$;

-- ── 9. SIGNALER (depuis un fil) : rangé pour le propriétaire ─────────────────
create or replace function public.vrm_communaute_signaler(p_conv uuid, p_raison text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); autre uuid; n integer;
begin
  if moi is null then return false; end if;
  select case when x.a = moi then x.b else x.a end into autre
    from public.vrm_communaute_conversations x where x.id = p_conv and (x.a = moi or x.b = moi);
  if autre is null then return false; end if;
  select pg_catalog.count(*) into n from public.vrm_communaute_signalements s where s.par = moi and s.le > pg_catalog.now() - interval '1 day';
  if n >= 20 then return false; end if;
  insert into public.vrm_communaute_signalements (par, contre, conv, raison, extrait)
  values (moi, autre, p_conv, pg_catalog.left(pg_catalog.btrim(coalesce(p_raison, '')), 300),
          coalesce((select jsonb_agg(jsonb_build_object('texte', y.texte, 'le', y.envoye_le) order by y.envoye_le)
                      from (select m.texte, m.envoye_le from public.vrm_communaute_messages m
                             where m.conv = p_conv and m.de = autre order by m.envoye_le desc, m.id desc limit 5) y), '[]'::jsonb));
  return true;
end $$;

-- ── 10. LES SIGNALEMENTS : le propriétaire de l'installation seulement ───────
create or replace function public.vrm_communaute_signalements()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null
      or auth.uid()::text is distinct from (select r.valeur from public.vrm_reglages r where r.cle = 'proprietaire') then null
    else coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'le', s.le, 'raison', s.raison, 'extrait', s.extrait,
                     'contre', (select jsonb_build_object('pid', p.pid, 'pseudo', p.pseudo, 'ville', p.ville) from public.vrm_communaute_profils p where p.owner = s.contre))
                     order by s.le desc)
                   from public.vrm_communaute_signalements s), '[]'::jsonb) end
$$;

-- ── 11. « Fermer mon compte » (serveur) ──────────────────────────────────────
create or replace function public.vrm_communaute_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer := 0; k integer;
begin
  if p_owner is null then return 0; end if;
  delete from public.vrm_communaute_profils p where p.owner = p_owner; get diagnostics k = row_count; n := n + k;
  delete from public.vrm_communaute_conversations c where c.a = p_owner or c.b = p_owner; get diagnostics k = row_count; n := n + k;
  delete from public.vrm_communaute_blocages b where b.qui = p_owner or b.bloque = p_owner; get diagnostics k = row_count; n := n + k;
  delete from public.vrm_communaute_signalements s where s.par = p_owner or s.contre = p_owner; get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- ── 12. LES DROITS DES FONCTIONS ─────────────────────────────────────────────
revoke all on function public.vrm_communaute_carte() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_rejoindre(text, text, text, numeric, numeric) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_quitter() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_ecrire(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_conversations() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_fil(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_bloquer(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_signaler(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_signalements() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_effacer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_communaute_carte() to authenticated;
grant execute on function public.vrm_communaute_rejoindre(text, text, text, numeric, numeric) to authenticated;
grant execute on function public.vrm_communaute_quitter() to authenticated;
grant execute on function public.vrm_communaute_ecrire(uuid, text) to authenticated;
grant execute on function public.vrm_communaute_conversations() to authenticated;
grant execute on function public.vrm_communaute_fil(uuid) to authenticated;
grant execute on function public.vrm_communaute_bloquer(uuid, boolean) to authenticated;
grant execute on function public.vrm_communaute_signaler(uuid, text) to authenticated;
grant execute on function public.vrm_communaute_signalements() to authenticated;
grant execute on function public.vrm_communaute_effacer(uuid) to service_role;

commit;
