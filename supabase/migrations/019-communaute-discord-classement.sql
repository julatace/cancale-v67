-- ════════════════════════════════════════════════════════════════════════════
-- 019 — LA COMMUNAUTÉ : LE PSEUDO DISCORD ET LE CLASSEMENT (20 octobre 2026). PAS APPLIQUÉE.
-- ════════════════════════════════════════════════════════════════════════════
-- Deux demandes de Julien, sur la carte de la 018 (déjà en production) :
--   « pour la carte ça peut être le compte discord » ;
--   « un système de classement entre tous les membres qui utilisent VRM, sur
--     les journées, les semaines, les mois etc. »
--
-- LE PSEUDO DISCORD (`vrm_communaute_discord`) :
--   • FACULTATIF : vide par défaut, posé et retiré par SON geste ; seulement
--     pour quelqu'un qui est sur la carte. Montré aux autres membres VISIBLES
--     (ceux qui le voient déjà sur la carte), pour qu'ils l'écrivent sur Discord.
--   • La forme des pseudos Discord actuels : 2 à 32 caractères parmi a-z, 0-9,
--     « . » et « _ », jamais deux points de suite ; ni « @ », ni « < », ni « > ».
--     La base le refuse sinon (contrainte + fonction). Aucun appel à Discord.
--
-- LE CLASSEMENT (`vrm_communaute_classement(p_periode)`) :
--   • OPT-IN STRICT : on n'y figure que si on l'a activé
--     (`vrm_communaute_classement_inscrire`), et seulement en étant sur la
--     carte (pseudo + ville viennent de là). Défaut : absent. Quitter la carte
--     retire aussi du classement (la ligne de la carte part avec tout).
--   • LE CHIFFRE CLASSÉ EST LE NOMBRE DE VENTES VINTED de la période — jamais
--     des euros : montrer le chiffre d'affaires de quelqu'un aux autres est
--     sensible. Il est CALCULÉ PAR LA BASE, à partir des lignes du membre
--     lui-même ; aucune fonction ne reçoit un chiffre du navigateur.
--   • LA RÈGLE DE COMPTAGE (mesurée le 20 octobre sur la vraie base, lecture
--     seule) — la même que « Vendu » dans l'app (`ventesFaites`) :
--       - les ventes = `harvest_{uid}_orders_sold` → `data.payload.my_orders`,
--         dont la ligne appartient au membre (owner = lui) ;
--       - seulement les comptes Vinted LIÉS à ce membre (`vinted_accounts`,
--         owner = lui) et pas mis de côté dans l'app (`main.vinted_accounts_hidden`) ;
--       - une vente annulée, remboursée, retournée, suspendue, refusée ou au
--         paiement échoué ne compte pas (le motif de `classifyOrderStatus`) ;
--       - datée au jour de la VENTE (`date`, ISO avec décalage), jour /
--         semaine (du lundi) / mois / année au fuseau Europe/Paris ;
--       - une transaction ne compte qu'une fois (dédoublonnage par
--         `transaction_id`).
--     Limite dite à l'écran : Vinted seulement (les ventes Leboncoin et eBay
--     n'y entrent pas), et une vente n'existe pour le classement qu'une fois
--     captée par l'extension.
--   • L'abonnement : la règle du 4 octobre (`vrm_acces_pour`), comme la carte.
--   • CE QUE LES AUTRES VOIENT : rang, pseudo, ville, pays, nombre de ventes,
--     l'identifiant PUBLIC de la carte (`pid`) — jamais l'identifiant du compte.
--
-- « FERMER MON COMPTE » : les deux nouvelles données sont des COLONNES de la
-- ligne de la carte (`vrm_communaute_profils`), que `vrm_communaute_effacer`
-- (018) efface déjà en entier — rien à ajouter, l'audit le vérifie.
--
-- ⚠️ La 018 NE SE REJOUE PLUS après la 019 : son empreinte de forme refuse la
-- table élargie (c'est voulu — rejouée, elle remettrait l'ancienne carte).
-- ⚠️ Cette migration ne contient AUCUNE suppression (l'outil SQL de Supabase
-- demande une confirmation humaine pour ce mot) : elle se colle d'un bloc.
--
-- Additif et rejouable : `add column if not exists`, contraintes posées une
-- fois, `create or replace`, une EMPREINTE de forme avant et après. Aucun DROP.
-- ════════════════════════════════════════════════════════════════════════════
begin;
set local lock_timeout = '3s';

-- ── 1. LA FORME AVANT : celle de la 018, ou celle de la 019 (rejouée) ────────
do $$ declare v text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_communaute_blocages', 'vrm_communaute_conversations', 'vrm_communaute_messages', 'vrm_communaute_profils', 'vrm_communaute_signalements']) t(n)
    into v;
  if v not in ('49e9d1d958352ebb3063719036ef25b5', 'f2dfc8a7f6fb366864c0706c558a6729') then
    raise exception 'vrm_communaute_forme : la 018 n''est pas installée telle quelle (empreinte %) — rien n''est installé', v;
  end if;
end $$;

-- ── 2. DEUX COLONNES SUR LA LIGNE DE LA CARTE ────────────────────────────────
alter table public.vrm_communaute_profils add column if not exists discord text;
alter table public.vrm_communaute_profils add column if not exists classement boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_catalog.pg_constraint k where k.conname = 'vrm_communaute_discord'
                   and k.conrelid = 'public.vrm_communaute_profils'::regclass) then
    alter table public.vrm_communaute_profils add constraint vrm_communaute_discord
      check (discord is null or (discord ~ '^[a-z0-9._]{2,32}$' and position('..' in discord) = 0));
  end if;
end $$;

-- ── 3. LA FORME APRÈS ────────────────────────────────────────────────────────
do $$ declare v text; begin
  select pg_catalog.md5(pg_catalog.string_agg(t.n || '{' ||
      coalesce((select pg_catalog.string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text, ',' order by a.attnum)
         from pg_catalog.pg_attribute a where a.attrelid = pg_catalog.to_regclass('public.' || t.n) and a.attnum > 0 and not a.attisdropped), '') || '|' ||
      coalesce((select pg_catalog.string_agg(k.conname || '=' || pg_catalog.replace(pg_catalog.pg_get_constraintdef(k.oid), 'public.', ''), ',' order by k.conname)
         from pg_catalog.pg_constraint k where k.conrelid = pg_catalog.to_regclass('public.' || t.n)), '') || '}', ';' order by t.n))
      from pg_catalog.unnest(array['vrm_communaute_blocages', 'vrm_communaute_conversations', 'vrm_communaute_messages', 'vrm_communaute_profils', 'vrm_communaute_signalements']) t(n)
    into v;
  if v is distinct from 'f2dfc8a7f6fb366864c0706c558a6729' then
    raise exception 'vrm_communaute_forme : la table de la carte n''a pas la forme attendue après la 019 (empreinte %) — rien n''est installé', v;
  end if;
end $$;

alter table public.vrm_communaute_profils enable row level security;
alter table public.vrm_communaute_profils force row level security;
revoke all on public.vrm_communaute_profils from public, anon, authenticated, service_role;

-- ── 4. LA CARTE (remplace celle de la 018) : + le pseudo Discord ─────────────
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
                    and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = auth.uid() and b.bloque = p.owner)), '[]'::jsonb))
  end
$$;

-- ── 5. LE PSEUDO DISCORD : poser, changer, retirer (vide) ────────────────────
create or replace function public.vrm_communaute_discord(p_discord text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  moi uuid := auth.uid();
  d text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_discord, '')));
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_communaute_profils p where p.owner = moi) then
    return jsonb_build_object('ok', false, 'raison', 'invisible');
  end if;
  if d = '' then d := null;
  elsif d !~ '^[a-z0-9._]{2,32}$' or pg_catalog.strpos(d, '..') > 0 then
    return jsonb_build_object('ok', false, 'raison', 'discord');
  end if;
  update public.vrm_communaute_profils p set discord = d, maj_le = pg_catalog.now() where p.owner = moi;
  return jsonb_build_object('ok', true, 'discord', d);
end $$;

-- ── 6. S'INSCRIRE / SE RETIRER DU CLASSEMENT (opt-in, sur son geste) ─────────
create or replace function public.vrm_communaute_classement_inscrire(p_oui boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare moi uuid := auth.uid(); oui boolean := coalesce(p_oui, false);
begin
  if moi is null then return jsonb_build_object('ok', false, 'raison', 'session'); end if;
  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;
  if not exists (select 1 from public.vrm_communaute_profils p where p.owner = moi) then
    return jsonb_build_object('ok', false, 'raison', 'invisible');
  end if;
  update public.vrm_communaute_profils p set classement = oui, maj_le = pg_catalog.now() where p.owner = moi;
  return jsonb_build_object('ok', true, 'classement', oui);
end $$;

-- ── 7. UNE DATE DE VENTE LISIBLE, SINON RIEN (aide interne, personne ne l'exécute) ──
create or replace function public.vrm_communaute_ts(p text)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' then return null; end if;
  return p::timestamptz;
exception when others then return null;
end $$;

-- ── 8. LE CLASSEMENT : jour, semaine, mois, année (fuseau Europe/Paris) ──────
--    NULL sans session ; `{acces:false}` quand l'abonnement est coupé ;
--    `{erreur:'periode'}` pour une période inconnue. Le chiffre est compté ICI.
create or replace function public.vrm_communaute_classement(p_periode text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
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
     where p.classement and (p.owner = moi or public.vrm_acces_pour(p.owner))
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
  select jsonb_build_object('acces', true, 'periode', per, 'debut', deb, 'fin', fin,
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

-- ── 9. LES DROITS DES FONCTIONS ──────────────────────────────────────────────
revoke all on function public.vrm_communaute_carte() from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_discord(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_classement_inscrire(boolean) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_ts(text) from public, anon, authenticated, service_role;
revoke all on function public.vrm_communaute_classement(text) from public, anon, authenticated, service_role;
grant execute on function public.vrm_communaute_carte() to authenticated;
grant execute on function public.vrm_communaute_discord(text) to authenticated;
grant execute on function public.vrm_communaute_classement_inscrire(boolean) to authenticated;
grant execute on function public.vrm_communaute_classement(text) to authenticated;

commit;
