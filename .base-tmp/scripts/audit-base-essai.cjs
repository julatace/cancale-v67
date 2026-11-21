#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// LA BASE D'ESSAI « vrm-essai » SE PRÉPARE SEULE — node scripts/audit-base-essai.cjs [--prouve]
// ═══════════════════════════════════════════════════════════════════════════
// (12 nov., agent2-fiabilite-prod) Le VRAI script (scripts/essai/appliquer-migrations.mjs)
// sur un Postgres JETABLE à la forme d'un projet Supabase neuf
// (scripts/sauvegarde/stub-supabase.sql + scripts/essai/stub-storage.sql) :
//   E1 TOUTES les migrations de supabase/migrations/ passent, dans l'ordre ;
//   E2 la base finale a la forme attendue (app_data (owner,id), meta, RLS, 033) ;
//   E3 aucune donnée : app_data vide, l'UID de Julien n'y est nulle part ;
//   E4 relancé : rien ne repasse ;
//   E5 l'adresse de la VRAIE base est refusée AVANT toute connexion ;
//   E6 une base qui porte des lignes est refusée ;
//   E7 une migration en échec arrête tout et est nommée ; relancé, on reprend là ;
//   E8 le workflow : à la main seulement, son seul secret ESSAI_DB_URL.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const R = path.join(__dirname, '..');
const SCRIPT = path.join(R, 'scripts/essai/appliquer-migrations.mjs');

if (process.argv.includes('--prouve')) {
  const MUTS = [
    ['la vraie base acceptée', 'scripts/essai/appliquer-migrations.mjs', "if (u.includes(REF_PRODUCTION)) return", 'if (false) return'],
    ['base remplie acceptée', 'scripts/essai/appliquer-migrations.mjs', 'if (Number(lignes.out) > 0) {', 'if (false) {'],
    ['tout repasse à chaque fois', 'scripts/essai/appliquer-migrations.mjs', '    if (faites.has(nom)) continue;\n', ''],
    ['un échec n’arrête rien', 'scripts/essai/appliquer-migrations.mjs', "console.log(`  ${n} migration(s) appliquée(s) avant l’arrêt ; relancer reprend à ${nom}.`); return 1; }", '}'],
    ['sans les ponts', 'scripts/essai/appliquer-migrations.mjs', "const sql = (fs.existsSync(pont) ?", 'const sql = (false ?'],
    ['l’UID de Julien gardé', 'scripts/essai/appliquer-migrations.mjs', ".replace(/74eea6e7-f060-46b6-b9c7-d500cedf4738/g, uid)", ''],
    ['le workflow planifié', '.github/workflows/base-essai.yml', 'on:\n  workflow_dispatch:', "on:\n  push:\n    branches: [main]\n  workflow_dispatch:"],
  ];
  let rouges = 0;
  for (const [nom, rel, avant, apres] of MUTS) {
    const f = path.join(R, rel); const src = fs.readFileSync(f, 'utf8');
    if (!src.includes(avant)) { console.log(`❌ mutation « ${nom} » : motif introuvable`); continue; }
    try {
      fs.writeFileSync(f, src.replace(avant, apres));
      const r = spawnSync(process.execPath, [__filename], { cwd: R, encoding: 'utf8', timeout: 300000 });
      if (r.status !== 0) rouges++;
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation « ${nom} » ⇒ ${r.status !== 0 ? 'ROUGE' : 'encore vert'}`);
    } finally { fs.writeFileSync(f, src); }
  }
  console.log(`\n${rouges === MUTS.length ? '✅' : '❌'} ${rouges}/${MUTS.length} mutations rouges`);
  process.exit(rouges === MUTS.length ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d !== '' ? ' — ' + String(typeof d === 'string' ? d : JSON.stringify(d)).slice(0, 600) : '')); } };
const PG_BIN = process.env.PG_BIN || (() => { try { return fs.readdirSync('/usr/lib/postgresql').sort((a, b) => Number(b) - Number(a)).map((v) => `/usr/lib/postgresql/${v}/bin`)[0]; } catch (_) { return ''; } })();
const B = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-audit-essai-'));
const ROOT = process.getuid && process.getuid() === 0;
const SOUS = (cmd, args) => (ROOT ? ['runuser', ['-u', 'postgres', '--', cmd, ...args]] : [cmd, args]);
const PORT = 20000 + Math.floor(Math.random() * 20000);
const U = (base) => `postgresql://banc@127.0.0.1:${PORT}/${base}`;
const PSQL = path.join(PG_BIN, 'psql');
const q = (base, sql) => { const r = spawnSync(PSQL, [U(base), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-c', sql], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); return r.stdout.trim(); };
const qf = (base, f) => { const r = spawnSync(PSQL, [U(base), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', f], { encoding: 'utf8' }); if (r.status !== 0) throw new Error(r.stderr); };
const lancer = (env) => spawnSync(process.execPath, [SCRIPT], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: process.env.HOME, PSQL, ...env } });
function arreter() {
  try { const [c, a] = SOUS(path.join(PG_BIN, 'pg_ctl'), ['-D', path.join(B, 'pg'), '-m', 'immediate', 'stop']); spawnSync(c, a); } catch (_) {}
  try { fs.rmSync(B, { recursive: true, force: true }); } catch (_) {}
}

try {
  fs.mkdirSync(path.join(B, 'pg')); fs.mkdirSync(path.join(B, 'sock'));
  if (ROOT) { spawnSync('chown', ['postgres', path.join(B, 'pg'), path.join(B, 'sock')]); fs.chmodSync(B, 0o755); }
  let [c, a] = SOUS(path.join(PG_BIN, 'initdb'), ['-D', path.join(B, 'pg'), '-U', 'banc', '--auth=trust']);
  if (spawnSync(c, a).status !== 0) throw new Error('initdb');
  [c, a] = SOUS(path.join(PG_BIN, 'pg_ctl'), ['-D', path.join(B, 'pg'), '-o', `-p ${PORT} -k ${path.join(B, 'sock')} -c listen_addresses=127.0.0.1`, '-l', path.join(B, 'pg', 'log'), '-w', 'start']);
  if (spawnSync(c, a).status !== 0) throw new Error('pg_ctl');
  for (const base of ['essai', 'remplie', 'casse']) {
    q('postgres', `create database ${base}`);
    qf(base, path.join(R, 'scripts/sauvegarde/stub-supabase.sql')); qf(base, path.join(R, 'scripts/essai/stub-storage.sql'));
  }
} catch (e) { dit(false, 'Postgres jetable monté', String(e.message || e)); arreter(); process.exit(1); }

try {
  const toutes = fs.readdirSync(path.join(R, 'supabase/migrations')).filter((f) => /^\d{3}[-_].*\.sql$/.test(f));
  let r = lancer({ ESSAI_DB_URL: U('essai') });
  const faites = q('essai', 'select count(*) from vrm_essai.migrations');
  dit(r.status === 0 && Number(faites) === toutes.length + 1, `E1 les ${toutes.length} migrations (+ le socle) passent, dans l’ordre`, r.stdout.split('\n').filter((l) => /✗/.test(l)).join(' ') || r.stdout.slice(-300));
  const ordre = q('essai', 'select string_agg(nom, \',\' order by appliquee_le, nom) from vrm_essai.migrations').split(',');
  dit(ordre[0] === '000-socle.sql' && JSON.stringify(ordre.slice(1)) === JSON.stringify([...toutes].sort()), 'E1 dans l’ordre des numéros', ordre.slice(0, 5));
  const pk = q('essai', "select pg_get_constraintdef(oid) from pg_constraint where conname = 'app_data_pkey'");
  const meta = q('essai', "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'app_data' and column_name in ('owner', 'meta')");
  const rls = q('essai', "select relrowsecurity from pg_class where oid = 'public.app_data'::regclass");
  const garde = q('essai', "select count(*) from pg_trigger where tgname = 'vrm_garde_points'");
  dit(pk === 'PRIMARY KEY (owner, id)' && meta === '2' && rls === 't' && garde === '1', 'E2 la forme : clé (owner, id), owner + meta, RLS allumée, garde des points (033)', { pk, meta, rls, garde });
  const lignes = q('essai', 'select count(*) from public.app_data') + '/' + q('essai', 'select count(*) from public.vinted_accounts');
  const julien = q('essai', "select count(*) from public.vrm_reglages where valeur like '%74eea6e7%'");
  dit(lignes === '0/0' && julien === '0', 'E3 aucune donnée : app_data et comptes vides, l’UID de Julien nulle part', { lignes, julien });
  r = lancer({ ESSAI_DB_URL: U('essai') });
  dit(r.status === 0 && /déjà à jour/.test(r.stdout) && !/✓ 0/.test(r.stdout), 'E4 relancé : rien ne repasse', r.stdout.slice(-200));
  r = lancer({ ESSAI_DB_URL: 'postgresql://postgres.lgonxzrzjcqthjtbdpzo:x@aws-0-eu-west-1.pooler.supabase.com:5432/postgres', PSQL: '/nexiste/pas' });
  dit(r.status === 1 && /VRAIE base/.test(r.stdout), 'E5 l’adresse de la vraie base est refusée avant toute connexion', r.stdout);
  q('remplie', "create table public.app_data (id text, data jsonb); insert into public.app_data values ('main', '{}')");
  r = lancer({ ESSAI_DB_URL: U('remplie') });
  dit(r.status === 1 && /déjà 1 ligne/.test(r.stdout) && q('remplie', "select count(*) from information_schema.schemata where schema_name = 'vrm_essai'") === '0', 'E6 une base qui porte des lignes est refusée, rien n’y est écrit', r.stdout);
  // E7 : une copie des migrations avec une migration cassée au milieu.
  const D = path.join(B, 'migrations'); fs.mkdirSync(D);
  for (const f of toutes) fs.copyFileSync(path.join(R, 'supabase/migrations', f), path.join(D, f));
  fs.writeFileSync(path.join(D, '005-abonnements.sql'), fs.readFileSync(path.join(D, '005-abonnements.sql'), 'utf8') + '\nselect * from une_table_qui_nexiste_pas;\n');
  r = lancer({ ESSAI_DB_URL: U('casse'), ESSAI_MIGRATIONS: D });
  const nCasse = q('casse', 'select count(*) from vrm_essai.migrations');
  const abo = q('casse', "select to_regclass('public.abonnements') is null");
  dit(r.status === 1 && /✗ 005-abonnements\.sql/.test(r.stdout) && /reprend à 005/.test(r.stdout) && nCasse === '5' && abo === 't', 'E7 une migration en échec : nommée, tout s’arrête, elle est annulée entière', { out: r.stdout.slice(-300), nCasse, abo });
  fs.copyFileSync(path.join(R, 'supabase/migrations/005-abonnements.sql'), path.join(D, '005-abonnements.sql'));
  r = lancer({ ESSAI_DB_URL: U('casse'), ESSAI_MIGRATIONS: D });
  dit(r.status === 0 && !/✓ 001/.test(r.stdout) && /✓ 005-abonnements/.test(r.stdout), 'E7 réparée et relancée : on reprend à 005, rien d’avant ne repasse', r.stdout.slice(0, 200));
} catch (e) { dit(false, 'E a levé', String(e.stack || e).slice(0, 600)); }

const wf = fs.readFileSync(path.join(R, '.github/workflows/base-essai.yml'), 'utf8');
const on = (/\non:\n([\s\S]*?)\npermissions:/.exec(wf) || [])[1] || '';
const secrets = [...new Set([...wf.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1]))];
dit(/workflow_dispatch:/.test(on) && !/schedule:|push:|pull_request/.test(on) && JSON.stringify(secrets) === '["ESSAI_DB_URL"]' && /contents: read/.test(wf) && !/contents: write/.test(wf), 'E8 le workflow : à la main, son seul secret ESSAI_DB_URL, lecture seule du dépôt', { on, secrets });

// E9 — un déploiement « Preview » peut viser la base d'essai : l'app ET les routes lisent leur variable,
// la production (aucune variable) garde la vraie base.
const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
dit(/const SUPABASE_URL = \(import\.meta\.env && import\.meta\.env\.VITE_SUPABASE_URL\) \|\| "https:\/\/lgonxzrzjcqthjtbdpzo\.supabase\.co";/.test(app)
  && /const SUPABASE_KEY = \(import\.meta\.env && import\.meta\.env\.VITE_SUPABASE_ANON_KEY\) \|\| "eyJ/.test(app), 'E9 l’app lit VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (Preview), sinon la vraie base');
const figees = [];
for (const dir of ['api', 'api/_lib']) for (const f of fs.readdirSync(path.join(R, dir)).filter((x) => x.endsWith('.js'))) {
  const src = fs.readFileSync(path.join(R, dir, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l));
  for (const l of src) if (/['"]https:\/\/lgonxzrzjcqthjtbdpzo\.supabase\.co/.test(l) && !/SUPABASE_URL\s*\|\|/.test(l)) figees.push(`${dir}/${f}: ${l.trim().slice(0, 80)}`);
}
dit(!figees.length, 'E10 aucune route serveur n’a la vraie base en dur sans SUPABASE_URL d’abord', figees);
const ex = fs.readFileSync(path.join(R, 'src/modeExemple.js'), 'utf8');
dit(/const HOTE_BASE = [^\n]*VITE_SUPABASE_URL/.test(ex), 'E11 le mode exemple tient aussi la base d’essai à l’écart');

arreter();
console.log(`\n${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);
