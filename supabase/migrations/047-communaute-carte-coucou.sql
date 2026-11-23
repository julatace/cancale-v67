-- ════════════════════════════════════════════════════════════════════════════
-- 047 — LA CARTE DE LA COMMUNAUTÉ : LE COUCOU REMPLACE LES MESSAGES
-- (17 novembre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- Julien (17 nov.) : « que les personnes puissent se faire coucou, mais pas
-- échanger des messages dans mon app, mais sur Discord ». La même règle que les
-- groupes d'accompagnement (046) vaut pour la CARTE : le « 👋 Coucou » de la
-- carte devient un SIGNE sans texte, et plus personne n'écrit de message dans VRM.
--
-- POURQUOI UNE TABLE À PART (et pas celle de la 046) : un coucou de la 046
-- appartient à un GROUPE (clé étrangère, non nulle) ; sur la carte il n'y a pas
-- de groupe — deux personnes présentes sur la carte, c'est tout. On RÉUTILISE
-- en revanche ce qui a le même sens :
--   • `vrm_accomp_sourdines` (046) : « Ne plus recevoir ses coucous » vaut pour
--     la personne, partout (groupes et carte) ;
--   • les blocages de la 018 (`vrm_communaute_blocages`) : quelqu'un de bloqué
--     ne fait plus coucou, dans aucun sens ;
--   • les MÊMES bornes, comptées sur les DEUX tables : un coucou par PAIRE de
--     personnes et par 24 h (un sens ou l'autre), 20 par expéditeur et par 24 h.
--
-- LES MESSAGES DE LA CARTE (018) : plus aucun message ne s'écrit — le droit
-- d'exécuter `vrm_communaute_ecrire` est RETIRÉ aux navigateurs. Rien n'est
-- effacé : les conversations et les messages d'avant restent en base
-- (`vrm_communaute_conversations`, `vrm_communaute_messages`), l'app ne les
-- montre plus.
--
-- LES GARANTIES : RLS activé ET forcé, aucun droit sur la table ; une règle de
-- lecture qui borne même un droit accordé un jour par erreur (seuls les deux) ;
-- identité tirée du jeton ; une personne est désignée par son `pid` PUBLIC de
-- la carte, jamais par son compte ; deux fonctions réservées à la clé de
-- service (sonner chez celui qui reçoit, trouver le Discord de l'auteur).
-- ⚠️ Aucune suppression dans le fichier : il se colle d'un bloc. Rejouable.
-- Exige la 018 et la 046 (refusé sans elles).
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

do $$ begin
  if pg_catalog.to_regclass('public.vrm_communaute_profils') is null
     or pg_catalog.to_regclass('public.vrm_communaute_blocages') is null
     or pg_catalog.to_regclass('public.vrm_accomp_coucous') is null
     or pg_catalog.to_regclass('public.vrm_accomp_sourdines') is null then
    raise exception 'vrm_carte_coucou_prealable : la 018 (carte) et la 046 (coucou des groupes) doivent être appliquées d''abord — rien n''est installé';
  end if;
end $$;

-- ── 1. LA TABLE : un coucou de la carte = (de, à, quand). Aucun texte. ──────
create table if not exists public.vrm_communaute_coucous (
  id uuid primary key default gen_random_uuid(),
  de uuid not null,
  a uuid not null,
  le timestamptz not null default now(),
  constraint vrm_communaute_coucou_pas_soi check (de <> a)
);
do $$ declare v text; begin
  select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod), ',' order by a.attnum)
    from pg_catalog.pg_attribute a
   where a.attrelid = pg_catalog.to_regclass('public.vrm_communaute_coucous') and a.attnum > 0 and not a.attisdropped
    into v;
  if v is distinct from 'id:uuid,de:uuid,a:uuid,le:timestamp with time zone' then
    raise exception 'vrm_carte_coucou_forme : la table des coucous de la carte existe sous une autre forme (%) — rien n''est installé', v;
  end if;
end $$;
create index if not exists vrm_communaute_coucous_de on public.vrm_communaute_coucous (de, le);
create index if not exists vrm_communaute_coucous_a on public.vrm_communaute_coucous (a, le);
alter table public.vrm_communaute_coucous enable row level security;
alter table public.vrm_communaute_coucous force row level security;
revoke all on public.vrm_communaute_coucous from public, anon, authenticated, service_role;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'vrm_communaute_coucous' and policyname = 'vrm_carte_coucou_les_deux') then
    create policy vrm_carte_coucou_les_deux on public.vrm_communaute_coucous for select to authenticated
      using (de = (select auth.uid()) or a = (select auth.uid()));
  end if;
end $$;

-- ── 2. AIDES INTERNES ────────────────────────────────────────────────────────
-- Un coucou entre ces deux personnes il y a moins de 24 h, dans un groupe OU sur la carte.
create or replace function public.vrm_carte_coucou_recent(p_x uuid, p_y uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.vrm_coucou_recent(p_x, p_y)
      or exists (select 1 from public.vrm_communaute_coucous c
                  where ((c.de = p_x and c.a = p_y) or (c.de = p_y and c.a = p_x))
                    and c.le > pg_catalog.now() - interval '24 hours')
$$;
-- Les coucous faits par une personne en 24 h, groupes ET carte.
create or replace function public.vrm_carte_coucou_envoyes(p_de uuid)
returns bigint language sql stable set search_path = '' as $$
  select (select pg_catalog.count(*) from public.vrm_accomp_coucous c where c.de = p_de and c.le > pg_catalog.now() - interval '24 hours')
       + (select pg_catalog.count(*) from public.vrm_communaute_coucous c where c.de = p_de and c.le > pg_catalog.now() - interval '24 hours')
$$;

-- ── 3. FAIRE COUCOU à quelqu'un de la carte (son pid public). AUCUN texte. ──
create or replace function public.vrm_carte_coucou(p_pid uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); cible uuid; nouveau uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_communaute_profils p where p.owner = moi) then
    return jsonb_build_object('ok', false, 'raison', 'carte');
  end if;
  select p.owner into cible from public.vrm_communaute_profils p where p.pid = p_pid and public.vrm_acces_pour(p.owner);
  if cible is null then return jsonb_build_object('ok', false, 'raison', 'cible'); end if;
  if cible = moi then return jsonb_build_object('ok', false, 'raison', 'soi'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_coucou_de'), pg_catalog.hashtext(moi::text));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('vrm_coucou_paire'),
    pg_catalog.hashtext(least(moi::text, cible::text) || greatest(moi::text, cible::text)));
  if exists (select 1 from public.vrm_communaute_blocages b where (b.qui = cible and b.bloque = moi) or (b.qui = moi and b.bloque = cible))
     or exists (select 1 from public.vrm_accomp_sourdines s where s.owner = cible and s.muet = moi and s.actif) then
    return jsonb_build_object('ok', false, 'raison', 'indisponible');
  end if;
  if public.vrm_carte_coucou_recent(moi, cible) then return jsonb_build_object('ok', false, 'raison', 'deja'); end if;
  if public.vrm_carte_coucou_envoyes(moi) >= 20 then return jsonb_build_object('ok', false, 'raison', 'plafond'); end if;
  insert into public.vrm_communaute_coucous (de, a) values (moi, cible) returning vrm_communaute_coucous.id into nouveau;
  return jsonb_build_object('ok', true, 'id', nouveau);
end $$;

-- ── 4. LIRE : les coucous reçus sur la carte (7 jours), à qui je l'ai déjà fait ──
create or replace function public.vrm_carte_coucou_lire()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare moi uuid := auth.uid();
begin
  if moi is null then return null; end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('acces', false); end if;
  return jsonb_build_object('acces', true,
    'envoyes24h', public.vrm_carte_coucou_envoyes(moi), 'plafond', 20,
    -- Les pid de la carte avec qui un coucou a eu lieu en 24 h (le bouton se grise).
    'deja', coalesce((select jsonb_agg(p.pid) from public.vrm_communaute_profils p
                       where p.owner <> moi and public.vrm_carte_coucou_recent(moi, p.owner)), '[]'::jsonb),
    'recus', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'de_pid', p.pid, 'de_nom', p.pseudo, 'le', c.le) order by c.le desc, c.id)
        from public.vrm_communaute_coucous c join public.vrm_communaute_profils p on p.owner = c.de
       where c.a = moi and c.le > pg_catalog.now() - interval '7 days'
         and not exists (select 1 from public.vrm_accomp_sourdines s where s.owner = moi and s.muet = c.de and s.actif)
         and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = moi and b.bloque = c.de)), '[]'::jsonb),
    'sourdines', coalesce((select jsonb_agg(jsonb_build_object('coucou', d.id, 'nom', d.nom) order by d.nom)
        from (select distinct on (s.muet) c.id, coalesce(p.pseudo, '') as nom
                from public.vrm_accomp_sourdines s join public.vrm_communaute_coucous c on c.de = s.muet and c.a = moi
                left join public.vrm_communaute_profils p on p.owner = s.muet
               where s.owner = moi and s.actif order by s.muet, c.le desc) d), '[]'::jsonb));
end $$;

-- ── 5. COUPER (ou rétablir) quelqu'un — celui qui a REÇU un de ses coucous ──
create or replace function public.vrm_carte_coucou_sourdine(p_coucou uuid, p_oui boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); auteur uuid;
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  select c.de into auteur from public.vrm_communaute_coucous c where c.id = p_coucou and c.a = moi;
  if auteur is null then return jsonb_build_object('ok', false, 'raison', 'coucou'); end if;
  insert into public.vrm_accomp_sourdines as s (owner, muet, actif, le) values (moi, auteur, p_oui is true, pg_catalog.now())
  on conflict (owner, muet) do update set actif = excluded.actif, le = excluded.le;
  return jsonb_build_object('ok', true, 'sourdine', p_oui is true);
end $$;

-- ── 6. RÉSERVÉ À LA ROUTE DE VRM (clé de service) ───────────────────────────
create or replace function public.vrm_carte_coucou_a_sonner(p_coucou uuid, p_de uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('a', c.a, 'de_nom', coalesce(p.pseudo, ''))
    from public.vrm_communaute_coucous c left join public.vrm_communaute_profils p on p.owner = c.de
   where c.id = p_coucou and c.de = p_de and c.le > pg_catalog.now() - interval '10 minutes'
$$;
create or replace function public.vrm_carte_coucou_auteurs(p_a uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'de', c.de)), '[]'::jsonb)
    from public.vrm_communaute_coucous c
   where c.a = p_a and c.le > pg_catalog.now() - interval '7 days'
$$;
create or replace function public.vrm_carte_coucou_effacer(p_owner uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer := 0; k integer;
begin
  if p_owner is null then return 0; end if;
  update public.vrm_communaute_coucous c set de = pg_catalog.gen_random_uuid() where c.de = p_owner; get diagnostics k = row_count; n := n + k;
  update public.vrm_communaute_coucous c set a = pg_catalog.gen_random_uuid() where c.a = p_owner; get diagnostics k = row_count; n := n + k;
  return n;
end $$;

-- ── 7. LES DROITS ────────────────────────────────────────────────────────────
revoke all on function public.vrm_carte_coucou_recent(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou_envoyes(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou_lire() from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou_sourdine(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou_a_sonner(uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou_auteurs(uuid) from public, anon, authenticated, service_role;
revoke all on function public.vrm_carte_coucou_effacer(uuid) from public, anon, authenticated, service_role;
grant execute on function public.vrm_carte_coucou(uuid) to authenticated;
grant execute on function public.vrm_carte_coucou_lire() to authenticated;
grant execute on function public.vrm_carte_coucou_sourdine(uuid, boolean) to authenticated;
grant execute on function public.vrm_carte_coucou_a_sonner(uuid, uuid) to service_role;
grant execute on function public.vrm_carte_coucou_auteurs(uuid) to service_role;
grant execute on function public.vrm_carte_coucou_effacer(uuid) to service_role;
-- Plus aucun message ne s'écrit sur la carte (l'historique reste en base, intact).
revoke all on function public.vrm_communaute_ecrire(uuid, text) from public, anon, authenticated;

-- ── 8. L'ESSAI ───────────────────────────────────────────────────────────────
do $e$ declare n int; begin
  select pg_catalog.count(*) into n from pg_catalog.pg_proc p join pg_catalog.pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.proname like 'vrm\_carte\_coucou%';
  if n <> 8 then raise exception 'vrm_carte_coucou_essai : % fonctions sur 8', n; end if;
  if pg_catalog.has_function_privilege('authenticated', 'public.vrm_communaute_ecrire(uuid, text)', 'execute') then
    raise exception 'vrm_carte_coucou_essai : les navigateurs peuvent encore écrire un message sur la carte';
  end if;
  raise notice 'ESSAI OK : coucou de la carte sans texte (8 fonctions), plus aucun message écrit, l''historique gardé';
end $e$;

commit;
