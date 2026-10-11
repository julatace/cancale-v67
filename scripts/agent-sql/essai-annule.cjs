#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA MIGRATION 014 (mémoire de l'agent eBay) : L'ESSAI ANNULÉ, PUIS LA VÉRIFICATION
//
//  node scripts/agent-sql/essai-annule.cjs            > essai.sql     (l'essai)
//  node scripts/agent-sql/essai-annule.cjs --verifier > verifier.sql  (après application)
//
//  1. L'ESSAI, fabriqué à partir du fichier TEL QU'IL EST (jamais une copie qui
//     pourrait diverger) : une transaction, la migration SANS son propre
//     BEGIN/COMMIT (sinon le COMMIT du fichier validerait l'essai), un rapport
//     d'UNE ligne (colonne `essai`, en JSON : tables, fonctions et leurs droits,
//     règles, déclencheurs, horloge, réglage), puis ROLLBACK. Les commentaires
//     HORS des corps de fonctions sont retirés (l'outil SQL ne prend pas de
//     fichier ; la 013 de 92 Ko n'était pas passée d'un bloc) ; les corps, eux,
//     restent octet pour octet ceux du fichier.
//  2. LA VÉRIFICATION, en lecture seule, une fois la migration appliquée : pour
//     chaque fonction, `md5(prosrc)` comparé au corps du fichier ; la ligne
//     d'horloge ; le réglage ; les droits. Une ligne, `verification`, en JSON,
//     dont `ok` doit valoir true.
//
//  3. LES MORCEAUX, seulement si l'outil SQL refuse le bloc entier :
//       node scripts/agent-sql/essai-annule.cjs --morceaux --dossier=/chemin
//     écrit trois fichiers, trois transactions, À APPLIQUER DANS L'ORDRE :
//     (1) les tables et leurs droits, (2) les fonctions et leurs droits,
//     (3) les gardes, la trace, le réglage et l'horloge. Chaque objet naît
//     FERMÉ dans la transaction qui le crée (l'audit le vérifie après chaque
//     morceau) ; réappliquer un morceau ne lève rien. Puis `--verifier`.
//
//  ⚠️ L'essai pose des déclencheurs sur `app_data` (verrou de table court) :
//     `lock_timeout` 3 s. Le lancer d'un bloc, jamais pas à pas dans une session
//     laissée ouverte. Il ne lit ni n'écrit AUCUNE donnée de vendeur.
//  ⚠️ `audit-agent-sql.cjs` exécute les deux sur un Postgres jetable : l'essai
//     ne laisse RIEN derrière lui, la vérification rend ok après application.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const arg = (n, d) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const MIG = arg('migration', path.join(__dirname, '..', '..', 'supabase/migrations/014-agent.sql'));
const sql = fs.readFileSync(MIG, 'utf8');

// Retire les commentaires `--` HORS des chaînes et des corps $$…$$ (gardés tels quels).
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
// Les corps des fonctions : `create or replace function <schéma>.<nom>(…) … as $$<corps>$$`.
function corps(s) {
  const r = {}; const re = /create or replace function ([a-z_]+)\.([a-z_]+)\([\s\S]*?\bas \$\$([\s\S]*?)\$\$/g;
  let m; while ((m = re.exec(s))) r[m[1] + '.' + m[2]] = crypto.createHash('md5').update(m[3]).digest('hex');
  return r;
}
const md5s = corps(sql);
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";
const TABLES = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal', 'vrm_agent_file', 'vrm_agent_compteurs', 'vrm_agent_vus',
  'vrm_agent_memos', 'vrm_agent_routes', 'vrm_agent_horloge', 'vrm_ebay_cles_publiques', 'vrm_coffre', 'vrm_ebay_titulaires',
  'vrm_ebay_annonces_index', 'vrm_agent_preuves'];
const tabs = 'array[' + TABLES.map(lit).join(',') + ']';
const etat = `json_build_object(
  'tables', (select count(*) from pg_class where relnamespace = 'public'::regnamespace and relname = any(${tabs}) and relrowsecurity),
  'horloge', (select json_agg(json_build_object('tic', dernier_tic::text, 'battement', dernier_battement::text, 'succes', dernier_succes::text)) from public.vrm_agent_horloge),
  'agent_ebay', (select valeur from public.vrm_reglages where cle = 'agent_ebay'),
  'regles', (select json_agg(tablename || ':' || policyname || ':' || cmd order by tablename, policyname) from pg_policies where schemaname = 'public' and tablename = any(${tabs})),
  'declencheurs_app_data', (select json_agg(tgname order by tgname) from pg_trigger where tgrelid = 'public.app_data'::regclass and not tgisinternal),
  'navigateur_ecrit', (select json_agg(t) from unnest(${tabs}) t where has_table_privilege('authenticated', 'public.' || t, 'insert') or has_table_privilege('authenticated', 'public.' || t, 'update') or has_table_privilege('authenticated', 'public.' || t, 'delete') or has_table_privilege('anon', 'public.' || t, 'select')),
  'fonctions_ouvertes', (select json_agg(p.proname) from pg_proc p where p.pronamespace = 'public'::regnamespace and (p.proname like 'vrm\\_agent\\_%' or p.proname like 'vrm\\_ebay\\_%') and p.proname not in ('vrm_agent_journal_garde') and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))),
  'corps', (select json_object_agg(n.nspname || '.' || p.proname, md5(p.prosrc)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname || '.' || p.proname = any(array[${Object.keys(md5s).map(lit).join(',')}]))
)`;

if (process.argv.includes('--verifier')) {
  const attendu = JSON.stringify(md5s);
  process.stdout.write(`-- Vérification de la migration 014 APPLIQUÉE (lecture seule). Rend une ligne : verification.ok doit valoir true.
with e as (select ${etat} j)
select json_build_object(
  'ok', (e.j ->> 'tables')::int = ${TABLES.length}
        and json_typeof(e.j -> 'horloge') = 'array' and json_array_length(e.j -> 'horloge') = 1
        and e.j ->> 'agent_ebay' is not null
        and (e.j ->> 'navigateur_ecrit') is null and (e.j ->> 'fonctions_ouvertes') is null
        and (e.j -> 'corps')::jsonb = ${lit(attendu)}::jsonb,
  'corps_differents', (select json_agg(k) from jsonb_each_text(${lit(attendu)}::jsonb) a(k, v) where (e.j -> 'corps')::jsonb ->> k is distinct from v),
  'etat', e.j) as verification
from e;
`);
  process.exit(0);
}

if (process.argv.includes('--morceaux')) {
  const dossier = arg('dossier', null);
  if (!dossier) { console.error('--dossier=/chemin exigé'); process.exit(1); }
  const L = sql.split('\n');
  const sec = (n) => L.findIndex((l) => l.startsWith('-- ── ' + n + '. '));
  const fin = L.map((l) => l.trim()).lastIndexOf('commit;');
  const bornes = [sec(1), sec(3), sec(5), fin];
  if (bornes.some((b) => b < 0) || !(bornes[0] < bornes[1] && bornes[1] < bornes[2] && bornes[2] < bornes[3])) { console.error('sections introuvables dans la migration'); process.exit(1); }
  const tete = "begin;\nset local lock_timeout = '3s';\nset local statement_timeout = '60s';\n";
  fs.mkdirSync(dossier, { recursive: true });
  const noms = ['tables et leurs droits', 'fonctions et leurs droits', 'gardes, trace, réglage, horloge'];
  for (let i = 0; i < 3; i++) {
    const f = path.join(dossier, `014-morceau-${i + 1}.sql`);
    fs.writeFileSync(f, `-- Migration 014, morceau ${i + 1}/3 : ${noms[i]} (à appliquer dans l'ordre).\n` + tete + sansCommentaires(L.slice(bornes[i], bornes[i + 1]).join('\n')) + 'commit;\n');
    console.log(f + ' — ' + fs.statSync(f).size + ' octets');
  }
  process.exit(0);
}

const lignes = sansCommentaires(sql).split('\n');
const ib = lignes.findIndex((l) => l.trim() === 'begin;');
const ic = lignes.map((l) => l.trim()).lastIndexOf('commit;');
if (ib < 0 || ic < 0 || ic < ib) { console.error('BEGIN/COMMIT introuvables dans la migration'); process.exit(1); }
const corpsMig = lignes.slice(ib + 1, ic).join('\n');
process.stdout.write(`-- ESSAI ANNULÉ de la migration 014 (fabriqué par scripts/agent-sql/essai-annule.cjs) : RIEN ne reste après.
begin;
${corpsMig}
select ${etat} as essai;
rollback;
`);
