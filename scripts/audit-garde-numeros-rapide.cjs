#!/usr/bin/env node
// Prouve la 017 sur un Postgres jetable : la garde des numéros (013, section 7)
// et sa version rapide (017) rendent les MÊMES verdicts sur les mêmes écritures,
// et la version rapide tient sous 8 s au volume mesuré chez Julien
// (425 fiches, 509 ventes, 24 renumérotations, pool de 582). Données inventées.
// `--avant` : juge la garde de la 013 seule (elle doit dépasser 8 s).
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const M13 = fs.readFileSync(path.join(RACINE, 'supabase/migrations/013-anciens-numeros-en-b.sql'), 'utf8').split('\n');
const F017 = path.join(RACINE, 'supabase/migrations/017-garde-numeros-rapide.sql');
const binDe = () => {
  const avec = (d) => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every((b) => fs.existsSync(path.join(d, b)));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  for (const v of ['17', '16', '15']) { const d = `/usr/lib/postgresql/${v}/bin`; if (avec(d)) return d; }
  return null;
};
const BIN = binDe();
if (!BIN) { console.log('❌ Postgres introuvable — audit NON exécuté (PG_BIN=…)'); process.exit(1); }
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'garde-')), PORT = 5600 + Math.floor(Math.random() * 300);
const run = (b, a, o = {}) => spawnSync(path.join(BIN, b), a, { encoding: 'utf8', ...o });
const asRoot = process.getuid && process.getuid() === 0;
let ok = 0, ko = 0;
const verdict = (c, m) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m); } };
fs.chmodSync(DIR, 0o777);
const su = (b, a) => asRoot ? spawnSync('su', ['postgres', '-s', '/bin/sh', '-c', [path.join(BIN, b), ...a].map((x) => `'${String(x).replace(/'/g, `'\\''`)}'`).join(' ')], { encoding: 'utf8' }) : run(b, a);
const init = su('initdb', ['-D', DIR + '/data', '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
if (init.status !== 0) { console.log('❌ initdb : ' + (init.stderr || init.stdout).slice(0, 300)); process.exit(1); }
const st = su('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`, '-l', DIR + '/journal', '-w', 'start']);
if (st.status !== 0) { console.log('❌ pg_ctl : ' + st.stderr); process.exit(1); }
const stop = () => { su('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
const psql = (sql) => run('psql', ['-h', DIR, '-p', String(PORT), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql]);
try {
  const cle = M13.slice(109, 121).join('\n');
  const garde13 = M13.slice(1324, 1450).join('\n');
  psql(`create role authenticated nologin; create role anon nologin; create table public.app_data (owner uuid not null, id text not null, data jsonb, primary key (owner, id)); grant select, insert, update on public.app_data to authenticated;`);
  let r = psql(cle); if (r.status) throw new Error(r.stderr);
  const installer = (corps) => { const x = psql(corps); if (x.status) throw new Error(x.stderr); };
  // Données inventées, au volume mesuré.
  const fiches = {}, ventes = {}, renum = {}, liens = {}, pool = [];
  for (let i = 1; i <= 401; i++) { fiches['a' + i] = { numero: 'B' + i, numberedAt: '2026-08-01' }; pool.push('B' + i); }
  for (let i = 1; i <= 24; i++) { fiches['n' + i] = { numero: String(i) }; pool.push(i); renum[String(552 + i)] = String(i); }
  for (let i = 1; i <= 509; i++) ventes['t' + i] = { numero: 'B' + (i % 500 + 1) };
  for (let i = 1; i <= 40; i++) liens['l' + i] = 'B' + i;
  while (pool.length < 582) pool.push('B' + (pool.length + 1000));
  const main = { vinted_annonce_numeros: fiches, vinted_sale_overrides: ventes, vinted_used_numeros: pool, vrm_lbc_liens: liens,
    vrm_numerotation: { version: 2, archive: 'B', coupure: '2026-10-09T00:00:00Z', appliqueLe: '2026-10-11T14:58:07Z', renum } };
  const O = '00000000-0000-0000-0000-000000000001';
  const lit = (j) => `'${JSON.stringify(j).replace(/'/g, "''")}'::jsonb`;
  const essai = (nouv) => {
    psql(`delete from app_data; insert into app_data values ('${O}','main',${lit(main)});`);
    const t0 = Date.now();
    const x = psql(`set statement_timeout = '8s'; set role authenticated; update app_data set data = ${lit(nouv)} where owner='${O}' and id='main';`);
    const ms = Date.now() - t0;
    const err = (x.stderr || '').match(/vrm_[a-z_]+|statement timeout/);
    return { ms, res: x.status === 0 ? 'ok' : (err ? err[0] : 'erreur:' + x.stderr.slice(0, 120)) };
  };
  const clone = () => JSON.parse(JSON.stringify(main));
  const cas = {
    'écriture normale (un prix change)': () => { const m = clone(); m.vinted_annonce_numeros.a5.prix = 30; return m; },
    'B230 → 230 sur une fiche': () => { const m = clone(); m.vinted_annonce_numeros.a230.numero = '230'; return m; },
    'B12 → 12 sur une vente': () => { const m = clone(); m.vinted_sale_overrides.t11.numero = '12'; return m; },
    'fiche 1 → provisoire 553': () => { const m = clone(); m.vinted_annonce_numeros.n1.numero = '553'; return m; },
    'pool qui rétrécit': () => { const m = clone(); m.vinted_used_numeros = m.vinted_used_numeros.slice(1); return m; },
    'fiche numérotée disparue': () => { const m = clone(); delete m.vinted_annonce_numeros.a7; return m; },
    'lien Leboncoin B3 → 3': () => { const m = clone(); m.vrm_lbc_liens.l3 = '3'; return m; },
    'saisie à la main datée après la conversion': () => { const m = clone(); m.vinted_annonce_numeros.a230 = { numero: '230', manuelAt: '2026-10-12T00:00:00Z' }; return m; },
  };
  const avant = process.argv.includes('--avant');
  installer(garde13 + `\ncreate trigger vrm_garde_numeros before update of data on public.app_data for each row when (new.id = 'main') execute function public.vrm_garde_numeros();`);
  const res13 = {}; for (const [n, f] of Object.entries(cas)) res13[n] = essai(f());
  if (avant) {
    verdict(res13['écriture normale (un prix change)'].res === 'ok', `013 : écriture normale acceptée (${res13['écriture normale (un prix change)'].res}, ${res13['écriture normale (un prix change)'].ms} ms)`);
  } else {
    installer(fs.readFileSync(F017, 'utf8'));
    for (const [n, f] of Object.entries(cas)) {
      const a = res13[n], b = essai(f());
      const attendu = a.res === 'statement timeout' ? null : a.res;
      verdict(b.res !== 'statement timeout' && b.ms < 2000, `017 « ${n} » : ${b.res} en ${b.ms} ms (013 : ${a.res}, ${a.ms} ms)`);
      if (attendu) verdict(b.res === attendu, `017 « ${n} » : même verdict que la 013 (${attendu})`);
    }
    const exp = { 'écriture normale (un prix change)': 'ok', 'B230 → 230 sur une fiche': 'vrm_numeros_perimes', 'B12 → 12 sur une vente': 'vrm_numeros_perimes',
      'fiche 1 → provisoire 553': 'vrm_numeros_perimes', 'pool qui rétrécit': 'vrm_pool_retreci', 'fiche numérotée disparue': 'vrm_fiche_perdue',
      'lien Leboncoin B3 → 3': 'vrm_numeros_perimes', 'saisie à la main datée après la conversion': 'ok' };
    for (const [n, f] of Object.entries(cas)) { const b = essai(f()); verdict(b.res === exp[n], `017 « ${n} » attendu ${exp[n]} : ${b.res}`); }
  }
} catch (e) { ko++; console.log('❌ ' + e.message.slice(0, 400)); }
finally { stop(); }
console.log(`\n${ok} ✅ · ${ko} ❌`); process.exit(ko ? 1 : 0);
