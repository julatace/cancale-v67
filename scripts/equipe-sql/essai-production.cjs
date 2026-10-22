#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA MIGRATION 016 (mode équipe) : L'ESSAI ANNULÉ SUR LA VRAIE BASE, AVEC
//  CONTRÔLES PAR RÔLE (22 octobre)
//
//  node scripts/equipe-sql/essai-production.cjs > essai-prod.sql
//
//  Un seul bloc : BEGIN ; mesures d'AVANT ; la migration SANS son propre
//  BEGIN/COMMIT ; contrôles par rôle (comme PostgREST les joue : `set local
//  role authenticated` + `request.jwt.claims` + `request.headers`) ; un rapport
//  d'UNE ligne (`essai`, JSON : des nombres, des booléens, des empreintes —
//  jamais un identifiant, un email, un titre ni un montant) ; ROLLBACK.
//
//  Les rôles :
//   · J = le propriétaire de l'installation (`vrm_reglages.proprietaire`) ;
//   · R = un AUTRE vendeur réel (celui qui a le plus de lignes) — lu, jamais
//     écrit, jamais nommé dans le rapport ;
//   · B (un vendeur), M (l'aide), N (adresse NON confirmée) : des comptes
//     INVENTÉS (`essai-016-…@vrm.invalid`), créés DANS la transaction et donc
//     effacés par le ROLLBACK.
//  ⚠️ La migration pose `create/alter policy` sur app_data (verrou exclusif de
//     la table jusqu'au ROLLBACK) : les lectures de l'app attendent le temps de
//     l'essai (mesuré dans le rapport : `duree_verrou_ms`). Les mesures lourdes
//     (inventaire des clés des colis) sont faites AVANT la migration.
//  Ensuite, en lecture seule : vérifier que RIEN n'est resté (voir CLAUDE.md,
//  section du 22 octobre).
//  `scripts/audit-equipe-sql.cjs` le joue sur un Postgres jetable (et vérifie
//  qu'il ne laisse rien).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const MIG = arg('migration', path.join(__dirname, '..', '..', 'supabase/migrations/016-equipe.sql'));
const sql = fs.readFileSync(MIG, 'utf8');

function sansCommentaires(s) {
  let o = '', i = 0, dollar = false, quote = false;
  while (i < s.length) {
    if (!quote && s.startsWith('$$', i)) { dollar = !dollar; o += '$$'; i += 2; continue; }
    if (!dollar && s[i] === "'") { quote = !quote; o += s[i++]; continue; }
    if (!dollar && !quote && s.startsWith('--', i)) { while (i < s.length && s[i] !== '\n') i++; continue; }
    o += s[i++];
  }
  return o.split('\n').filter((l) => l.trim() !== '').join('\n') + '\n';
}
const lignes = sansCommentaires(sql).split('\n').filter((l) => l.trim() !== '');
const ib = lignes.findIndex((l) => l.trim() === 'begin;');
const ic = lignes.map((l) => l.trim()).lastIndexOf('commit;');
if (ib < 0 || ic < 0 || ic < ib) { console.error('BEGIN/COMMIT introuvables dans la migration'); process.exit(1); }
const corps = lignes.slice(ib + 1, ic).join('\n');
if (/^\s*(begin|commit|rollback)\s*;/im.test(corps)) { console.error('la migration contient un autre BEGIN/COMMIT : essai refusé'); process.exit(1); }

// La vérification (lecture seule) de l'outil voisin, en sous-requête.
const v = spawnSync(process.execPath, [path.join(__dirname, 'essai-annule.cjs'), '--verifier', '--migration=' + MIG], { encoding: 'utf8' });
if (v.status !== 0) { console.error('verifier : ' + v.stderr); process.exit(1); }
const verif = v.stdout.split('\n').filter((l) => !l.startsWith('--')).join('\n').trim()
  .replace(/;\s*$/, '').replace("  'etat', e.j) as verification", "  'etat_regles', e.j -> 'regles', 'etat_forme', e.j -> 'forme', 'etat_bloquantes', e.j -> 'restrictives_bloquantes') as verification");
if (!/etat_regles/.test(verif)) { console.error('verifier : forme inattendue'); process.exit(1); }

// La liste blanche (celle de la fonction `vrm_equipe_id_permis`, relue dans le fichier).
const permis = /select coalesce\(p_id ~ '(\^\(email_bord_[^']+)', false\)/.exec(sql);
if (!permis) { console.error('liste blanche introuvable dans la migration'); process.exit(1); }
const PERMIS = permis[1];
// Un nom de clé qui parle d'argent (à toute profondeur).
// (« achat » n'en est pas un : la projection range les colis À RETIRER sous `achats`.)
const ARGENT = '(price|prix|amount|montant|total|currency|devise|fee|frais|balance|solde|escrow|payout|versement|benef|marge|cost|cout|revenue|recette|paid|wallet)';
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";

process.stdout.write(`-- ESSAI ANNULÉ de la migration 016 SUR LA BASE, avec contrôles par rôle (scripts/equipe-sql/essai-production.cjs). RIEN ne reste après.
begin;
set local lock_timeout = '3s';
create temp table vrm_essai_016 (k text primary key, v jsonb);
create function pg_temp.noter(p_k text, p_v jsonb) returns void language sql as $f$
  insert into pg_temp.vrm_essai_016 (k, v) values (p_k, p_v) on conflict (k) do update set v = excluded.v $f$;
create function pg_temp.lu(p_k text) returns jsonb language sql as $f$ select v from pg_temp.vrm_essai_016 where k = p_k $f$;
-- Une requête jouée COMME PostgREST la joue pour un compte connecté.
create function pg_temp.lire(u uuid, entete text, q text) returns jsonb language plpgsql as $f$
declare r jsonb;
begin
  perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), true);
  perform set_config('request.jwt.claims', case when u is null then '' else json_build_object('sub', u, 'role', 'authenticated')::text end, true);
  perform set_config('request.headers', case when entete is null then '' else json_build_object('x-vrm-equipe', entete)::text end, true);
  execute 'set local role authenticated';
  begin
    execute q into r;
  exception when others then
    r := jsonb_build_object('erreur', sqlstate);
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.headers', '', true);
  return r;
end $f$;
create function pg_temp.plan(u uuid, q text) returns jsonb language plpgsql as $f$
declare p jsonb;
begin
  p := pg_temp.lire(u, null, 'explain (analyze, format json) ' || q);
  return jsonb_build_object('seq_scan', coalesce(p::text like '%"Seq Scan"%', false), 'index', coalesce(p::text like '%Index%', false),
    'ms', p -> 0 -> 'Execution Time');
exception when others then
  return jsonb_build_object('erreur', sqlstate);
end $f$;

-- ── AVANT : ce que chacun lit aujourd'hui ───────────────────────────────────
do $essai$
declare j uuid; r uuid;
begin
  perform pg_temp.noter('_t0', to_jsonb(clock_timestamp()));
  select c.valeur::uuid into j from public.vrm_reglages c where c.cle = 'proprietaire';
  if j is null then raise exception 'essai_016 : propriétaire inconnu'; end if;
  select a.owner into r from public.app_data a join auth.users u on u.id = a.owner where a.owner <> j group by a.owner order by count(*) desc limit 1;
  perform pg_temp.noter('_j', to_jsonb(j));
  perform pg_temp.noter('_r', to_jsonb(r));
  perform pg_temp.noter('autre_vendeur_trouve', to_jsonb(r is not null));
  perform pg_temp.noter('avant_j_postgres', (select to_jsonb(count(*)) from public.app_data where owner = j));
  perform pg_temp.noter('avant_j_lit_tout', pg_temp.lire(j, null, 'select to_jsonb(count(*)) from public.app_data'));
  perform pg_temp.noter('avant_j_lit_siennes', pg_temp.lire(j, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('avant_j_comptes_vinted', pg_temp.lire(j, null, 'select to_jsonb(count(*)) from public.vinted_accounts'));
  perform pg_temp.noter('avant_r_postgres', (select to_jsonb(count(*)) from public.app_data where owner = r));
  perform pg_temp.noter('avant_r_lit_siennes', pg_temp.lire(r, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', r)));
  perform pg_temp.noter('avant_r_lit_j', pg_temp.lire(r, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('permis_j', (select jsonb_build_object('n', count(*), 'md5', md5(string_agg(a.id, ',' order by a.id)))
                                       from public.app_data a where a.owner = j and a.id ~ ${lit(PERMIS)}));
  -- L'inventaire des CLÉS des lignes que l'aide pourra lire (à toute profondeur, data et meta) : aucune ne doit parler d'argent.
  perform pg_temp.noter('permis_j_cles_argent', (select coalesce(jsonb_agg(distinct k), '[]'::jsonb) from (
       select jsonb_path_query(a.data - 'pdfB64' - 'pdfTamponneB64' - 'qrB64', 'strict $.** ? (@.type() == "object").keyvalue().key') #>> '{}' k
         from public.app_data a where a.owner = j and a.id ~ ${lit(PERMIS)}
       union all
       select jsonb_path_query(coalesce(a.meta, '{}'::jsonb), 'strict $.** ? (@.type() == "object").keyvalue().key') #>> '{}'
         from public.app_data a where a.owner = j and a.id ~ ${lit(PERMIS)}) z where k ~* ${lit(ARGENT)}));
  perform pg_temp.noter('avant_plan_bordereaux', pg_temp.plan(j, 'select id from public.app_data where id like ''email_bord_%'''));
  perform pg_temp.noter('avant_plan_main', pg_temp.plan(j, 'select id, meta from public.app_data where id = ''main'''));
  perform pg_temp.noter('avant_plan_compte', pg_temp.plan(j, 'select count(*) from public.app_data'));
  perform pg_temp.noter('_t1', to_jsonb(clock_timestamp()));
end $essai$;

-- ── LA MIGRATION 016 (sans son BEGIN/COMMIT) ─────────────────────────────────
${corps}

-- ── APRÈS : les mêmes lectures, et l'aide ────────────────────────────────────
do $essai$
declare
  j uuid := (pg_temp.lu('_j') #>> '{}')::uuid;
  r uuid := (pg_temp.lu('_r') #>> '{}')::uuid;
  b uuid := gen_random_uuid(); m uuid := gen_random_uuid(); n uuid := gen_random_uuid();
  em text; en text; im jsonb; inn jsonb; c jsonb; x jsonb;
begin
  perform pg_temp.noter('_t2', to_jsonb(clock_timestamp()));
  -- Le propriétaire et l'autre vendeur, comme avant.
  perform pg_temp.noter('apres_j_lit_tout', pg_temp.lire(j, null, 'select to_jsonb(count(*)) from public.app_data'));
  perform pg_temp.noter('apres_j_lit_siennes', pg_temp.lire(j, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('apres_j_lit_siennes_entete', pg_temp.lire(j, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('apres_j_comptes_vinted', pg_temp.lire(j, null, 'select to_jsonb(count(*)) from public.vinted_accounts'));
  perform pg_temp.noter('apres_r_lit_siennes', pg_temp.lire(r, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', r)));
  perform pg_temp.noter('apres_r_lit_j', pg_temp.lire(r, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('apres_r_demande_j', pg_temp.lire(r, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('apres_r_demande_j_tout', pg_temp.lire(r, j::text, format('select to_jsonb(count(*)) from public.app_data where owner <> %L', r)));
  -- Trois comptes INVENTÉS, effacés par le ROLLBACK.
  em := 'essai-016-aide-' || left(m::text, 8) || '@vrm.invalid';
  en := 'essai-016-nonconf-' || left(n::text, 8) || '@vrm.invalid';
  insert into auth.users (id, email, email_confirmed_at, aud, role, created_at, updated_at) values
    (b, 'essai-016-vendeur-' || left(b::text, 8) || '@vrm.invalid', now(), 'authenticated', 'authenticated', now(), now()),
    (m, em, now(), 'authenticated', 'authenticated', now(), now()),
    (n, en, null, 'authenticated', 'authenticated', now(), now());
  perform pg_temp.noter('apres_b_demande_j', pg_temp.lire(b, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  -- J invite M et N ; M accepte ; N (adresse non confirmée) ne peut pas ; R ne peut pas prendre l'invitation de M.
  im := pg_temp.lire(j, null, format('select public.vrm_equipe_inviter(%L)', em));
  inn := pg_temp.lire(j, null, format('select public.vrm_equipe_inviter(%L)', en));
  perform pg_temp.noter('invitation_m', jsonb_build_object('ok', im -> 'ok', 'statut', im -> 'statut'));
  perform pg_temp.noter('invitation_n', jsonb_build_object('ok', inn -> 'ok', 'statut', inn -> 'statut'));
  perform pg_temp.noter('m_avant_acceptation_demande_j', pg_temp.lire(m, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('r_prend_invitation_m', pg_temp.lire(r, null, format('select to_jsonb(public.vrm_equipe_accepter(%L::uuid))', im ->> 'id')));
  perform pg_temp.noter('m_accepte', pg_temp.lire(m, null, format('select to_jsonb(public.vrm_equipe_accepter(%L::uuid))', im ->> 'id')));
  perform pg_temp.noter('n_accepte', pg_temp.lire(n, null, format('select to_jsonb(public.vrm_equipe_accepter(%L::uuid))', inn ->> 'id')));
  perform pg_temp.noter('n_demande_j', pg_temp.lire(n, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  -- L'aide : sans en-tête rien ; avec, EXACTEMENT la liste blanche ; rien d'autre.
  perform pg_temp.noter('m_sans_entete_j', pg_temp.lire(m, null, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('m_sans_entete_tout', pg_temp.lire(m, null, 'select to_jsonb(count(*)) from public.app_data'));
  perform pg_temp.noter('m_demande_j', pg_temp.lire(m, j::text, format(
    'select jsonb_build_object(''n'', count(*), ''md5'', md5(string_agg(id, '','' order by id)), ''hors_liste'', count(*) filter (where id !~ %L)) from public.app_data where owner = %L',
    ${lit(PERMIS)}, j)));
  perform pg_temp.noter('m_demande_j_tout', pg_temp.lire(m, j::text, 'select to_jsonb(count(*)) from public.app_data'));
  perform pg_temp.noter('m_demande_j_meta_argent', pg_temp.lire(m, j::text, format(
    'select coalesce(jsonb_agg(distinct k), ''[]''::jsonb) from (select jsonb_path_query(coalesce(meta, ''{}''::jsonb), ''strict $.** ? (@.type() == "object").keyvalue().key'') #>> ''{}'' k from public.app_data where owner = %L) z where k ~* %L',
    j, ${lit(ARGENT)})));
  perform pg_temp.noter('m_demande_j_main', pg_temp.lire(m, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L and id = ''main''', j)));
  perform pg_temp.noter('m_demande_j_ventes', pg_temp.lire(m, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L and (id like ''%%orders%%'' or id like ''%%txn%%'' or id like ''%%billing%%'' or id like ''email_sale%%'' or id like ''email_final%%'' or id like ''ebay%%'')', j)));
  perform pg_temp.noter('m_demande_j_comptes_vinted', pg_temp.lire(m, j::text, 'select to_jsonb(count(*)) from public.vinted_accounts'));
  perform pg_temp.noter('m_demande_j_pdf', pg_temp.lire(m, j::text, format(
    'select to_jsonb(coalesce(length(data->>''pdfB64''), 0) > 0) from public.app_data where owner = %L and id ~ ''^(email_bord_|harvest_[0-9]+_label_)'' and meta->>''_pdf'' = ''true'' limit 1', j)));
  perform pg_temp.noter('m_demande_r', pg_temp.lire(m, r::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', r)));
  -- L'aide n'écrit rien.
  perform pg_temp.noter('m_modifie_j', pg_temp.lire(m, j::text, format('with x as (update public.app_data set data = data where owner = %L returning 1) select to_jsonb(count(*)) from x', j)));
  perform pg_temp.noter('m_efface_j', pg_temp.lire(m, j::text, format('with x as (delete from public.app_data where owner = %L returning 1) select to_jsonb(count(*)) from x', j)));
  perform pg_temp.noter('m_cree_chez_j', pg_temp.lire(m, j::text, format('with x as (insert into public.app_data (owner, id, data) values (%L, ''email_bord_essai016'', ''{}''::jsonb) returning 1) select to_jsonb(count(*)) from x', j)));
  perform pg_temp.noter('m_lit_table_equipe', pg_temp.lire(m, null, 'select to_jsonb(count(*)) from public.vrm_equipe'));
  -- La projection des colis : des clés sans argent.
  c := pg_temp.lire(m, null, format('select public.vrm_equipe_colis(%L::uuid)', j));
  perform pg_temp.noter('m_colis', case when c is null or jsonb_typeof(c) <> 'object' or c ? 'erreur' then jsonb_build_object('brut', c) else jsonb_build_object(
    'ventes', jsonb_array_length(c -> 'ventes'), 'achats', jsonb_array_length(c -> 'achats'),
    'comptes', (select count(*) from jsonb_object_keys(c -> 'comptes')), 'postes', jsonb_array_length(c -> 'postes'), 'retires', jsonb_array_length(c -> 'retires'),
    'cles', (select coalesce(jsonb_agg(distinct k order by k), '[]'::jsonb) from jsonb_array_elements((c -> 'ventes') || (c -> 'achats')) e(v), jsonb_object_keys(e.v) k),
    'cles_argent', (select coalesce(jsonb_agg(distinct k), '[]'::jsonb) from (select jsonb_path_query(c, 'strict $.** ? (@.type() == "object").keyvalue().key') #>> '{}' k) z where k ~* ${lit(ARGENT)}),
    'mot_argent', c::text ~* '("price"|"amount"|"total_item_price"|"currency_code"|buyPrice)') end);
  perform pg_temp.noter('m_colis_de_r', pg_temp.lire(m, null, format('select coalesce(public.vrm_equipe_colis(%L::uuid), ''null''::jsonb)', r)));
  perform pg_temp.noter('j_colis_de_j', pg_temp.lire(j, null, format('select coalesce(public.vrm_equipe_colis(%L::uuid), ''null''::jsonb)', j)));
  x := pg_temp.lire(m, null, 'select public.vrm_equipe_lister()');
  perform pg_temp.noter('m_liste', jsonb_build_object('membre_de', jsonb_array_length(x -> 'membre_de'), 'invitations', jsonb_array_length(x -> 'invitations'), 'equipe', jsonb_array_length(x -> 'equipe')));
  x := pg_temp.lire(j, null, 'select public.vrm_equipe_lister()');
  perform pg_temp.noter('j_liste', jsonb_build_object('equipe', jsonb_array_length(x -> 'equipe'), 'membre_de', jsonb_array_length(x -> 'membre_de')));
  -- Révoquer : plus rien, tout de suite.
  perform pg_temp.noter('j_revoque_m', pg_temp.lire(j, null, format('select to_jsonb(public.vrm_equipe_revoquer(%L::uuid))', im ->> 'id')));
  perform pg_temp.noter('m_revoque_demande_j', pg_temp.lire(m, j::text, format('select to_jsonb(count(*)) from public.app_data where owner = %L', j)));
  perform pg_temp.noter('m_revoque_colis', pg_temp.lire(m, null, format('select coalesce(public.vrm_equipe_colis(%L::uuid), ''null''::jsonb)', j)));
  -- Le coût pour tout le monde : les mêmes requêtes qu'avant, au nom du propriétaire.
  perform pg_temp.noter('apres_plan_bordereaux', pg_temp.plan(j, 'select id from public.app_data where id like ''email_bord_%'''));
  perform pg_temp.noter('apres_plan_main', pg_temp.plan(j, 'select id, meta from public.app_data where id = ''main'''));
  perform pg_temp.noter('apres_plan_compte', pg_temp.plan(j, 'select count(*) from public.app_data'));
  perform pg_temp.noter('regles_app_data', (select jsonb_agg(p.policyname || ':' || p.permissive || ':' || p.cmd || ':' || (coalesce(p.qual, '') like '%vrm_equipe_vendeur%')::text order by p.policyname)
                                              from pg_policies p where p.schemaname = 'public' and p.tablename = 'app_data'));
  perform pg_temp.noter('_t3', to_jsonb(clock_timestamp()));
end $essai$;

select json_build_object(
  'essai', (select jsonb_object_agg(k, v) from pg_temp.vrm_essai_016 where k !~ '^_'),
  'duree_verrou_ms', round(extract(epoch from ((pg_temp.lu('_t3') #>> '{}')::timestamptz - (pg_temp.lu('_t1') #>> '{}')::timestamptz)) * 1000),
  'duree_totale_ms', round(extract(epoch from (clock_timestamp() - (pg_temp.lu('_t0') #>> '{}')::timestamptz)) * 1000),
  'verification', (${verif})
) as essai;
rollback;
`);
