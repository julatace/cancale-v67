// Migration 048 (capacité 3 000 vendeurs) sur PostgreSQL JETABLE, jamais sur Supabase.
// Modèle : scripts/audit-index-base-sql.cjs. Données INVENTÉES (dépôt public).
//   · 3 000 vendeurs × 2 preuves d'adresse sous le propriétaire NEUTRE (+ 30 000 autres
//     lignes) : la requête « preuves de CETTE adresse » rend la MÊME réponse avant et après,
//     l'index 1 est pris APRÈS, et lit beaucoup moins de pages que la lecture de tout le
//     registre (celle d'aujourd'hui, `lirePreuvesProuvees`) ;
//   · le journal des écritures : la purge garde tout ce qui a moins de 90 jours, retire le
//     reste, refuse moins de 30 jours, et n'est exécutable ni par anon ni par authenticated ;
//   · le fichier se rejoue (deux fois de suite sans erreur).
// Lancer : node scripts/audit-capacite-sql.cjs  (PG_BIN si PostgreSQL n'est pas trouvé)
const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const candidats = [process.env.PG_BIN];
try { for (const v of fs.readdirSync('/usr/lib/postgresql')) candidats.push(`/usr/lib/postgresql/${v}/bin`); } catch (_) {}
const BIN = candidats.find((d) => d && ['initdb', 'pg_ctl', 'postgres', 'psql'].every((n) => fs.existsSync(path.join(d, n))));
if (!BIN) { console.error('PostgreSQL absent : audit NON exécuté (PG_BIN requis).'); process.exit(1); }
let identite = {};
if (process.getuid?.() === 0) { try { identite = { uid: Number(execFileSync('id', ['-u', 'postgres'])), gid: Number(execFileSync('id', ['-g', 'postgres'])) }; } catch (_) { console.error('Utilisateur postgres absent : audit NON exécuté.'); process.exit(1); } }
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-capacite-sql-'));
if (identite.uid !== undefined) fs.chownSync(DIR, identite.uid, identite.gid);
const PORT = String(56000 + process.pid % 1000), base = ['-h', DIR, '-p', PORT, '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1'];
const serveur = (n, args) => spawnSync(path.join(BIN, n), args, { encoding: 'utf8', ...identite });
let demarre = false, ok = 0, ko = 0;
const nettoyer = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } fs.rmSync(DIR, { recursive: true, force: true }); };
process.on('exit', nettoyer); process.on('SIGINT', () => process.exit(1)); process.on('SIGTERM', () => process.exit(1));
const run = (sql) => { const r = spawnSync(path.join(BIN, 'psql'), base, { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 }); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: r.stderr || '' }; };
const Q = (sql) => { const r = run(sql); if (!r.ok) throw Error(r.err); return r.out; };
const dit = (c, n, d) => { c ? ok++ : ko++; console.log(`${c ? '✅' : '❌'} ${n}${d ? ' — ' + d : ''}`); };
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const MIGRATION = fs.readFileSync(path.join(RACINE, 'supabase', 'migrations', '048-capacite-3000.sql'), 'utf8');
// La lecture d'une adresse (étape 3 du plan) et celle de tout le registre (aujourd'hui).
const ADRESSE = 'vendeur01234@exemple.test';
const UNE = `select id, data->>'owner', data->>'adresse' from app_data where owner='${NEUTRE}' and id like 'vrm_email_preuve_%' and data->>'etat'='prouvee' and data->>'adresse' = any('{${ADRESSE}}') order by id`;
const TOUT = `select id, data->>'owner', data->>'adresse' from app_data where owner='${NEUTRE}' and id like 'vrm_email_preuve_%' and data->>'etat'='prouvee' order by id`;
function mesure(sql) {
  const plan = JSON.parse(Q(`set enable_seqscan=on; explain (analyze, buffers, format json) ${sql}`).split('\n').filter(Boolean).join(''))[0];
  const noeuds = []; (function f(n) { noeuds.push(n['Index Name'] || n['Node Type']); (n.Plans || []).forEach(f); })(plan.Plan);
  const pages = (plan.Plan['Shared Hit Blocks'] || 0) + (plan.Plan['Shared Read Blocks'] || 0);
  return { noeuds, pages, rep: Q(`select md5(coalesce(string_agg(x::text, ',' order by x::text), '')) from (${sql}) s(x)`) };
}
try {
  let r = serveur('initdb', ['-D', DIR + '/data', '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']); if (r.status !== 0) throw Error(r.stderr);
  r = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`, '-l', DIR + '/journal', '-w', 'start']); if (r.status !== 0) throw Error(r.stderr); demarre = true;
  Q(`create role anon; create role authenticated; create role service_role;
  create table app_data(owner uuid not null, id text not null, data jsonb, meta jsonb, updated_at timestamptz default now(), primary key(owner, id));
  create index app_data_owner_id_prefixe on app_data (owner, id text_pattern_ops);
  create index app_data_id_motif on app_data (id text_pattern_ops);
  create schema sauvegarde;
  create table sauvegarde.journal_ecritures(at timestamptz default now(), role text, uid uuid, tbl text, row_id text, op text, agent text);`);
  // 3 000 vendeurs × 2 preuves (une prouvée, une en attente) + du bruit sous le neutre et chez les vendeurs.
  Q(`insert into app_data(owner, id, data)
     select '${NEUTRE}', 'vrm_email_preuve_' || md5(g::text || k::text), jsonb_build_object('owner', md5(g::text)::uuid, 'adresse', 'vendeur' || lpad(g::text, 5, '0') || case when k = 1 then '' else '.b' end || '@exemple.test', 'etat', case when k = 1 then 'prouvee' else 'en-attente' end, 'at', now())
     from generate_series(1, 3000) g, generate_series(1, 2) k;
     insert into app_data(owner, id, data) select '${NEUTRE}', 'cron_curseur_x_' || g, jsonb_build_object('n', g) from generate_series(1, 10000) g;
     insert into app_data(owner, id, data) select md5((g % 3000)::text)::uuid, 'harvest_' || g || '_txn_1', jsonb_build_object('pad', repeat('x', 400)) from generate_series(1, 20000) g;
     insert into sauvegarde.journal_ecritures(at, op) select now() - make_interval(days => g % 200), 'UPDATE' from generate_series(1, 40000) g;
     analyze;`);
  const avant = mesure(UNE), toutAvant = mesure(TOUT);
  r = run(MIGRATION); dit(r.ok, '048 s’applique sur une base à la forme de la vraie', r.ok ? '' : r.err.slice(0, 300));
  r = run(MIGRATION); dit(r.ok, '048 se rejoue (deuxième passage sans erreur)', r.ok ? '' : r.err.slice(0, 300));
  Q('analyze;');
  const apres = mesure(UNE);
  dit(avant.rep === apres.rep && Q(`select count(*) from (${UNE}) s`) === '1', 'la preuve d’UNE adresse : même réponse avant et après (une ligne)');
  dit(apres.noeuds.includes('app_data_preuve_adresse'), 'l’index par adresse est pris', apres.noeuds.join(' > '));
  dit(apres.pages * 20 < toutAvant.pages, 'une adresse lit au moins 20 fois moins de pages que tout le registre d’aujourd’hui', `${apres.pages} pages contre ${toutAvant.pages}`);
  // La purge.
  const total = Number(Q('select count(*) from sauvegarde.journal_ecritures'));
  const recents = Number(Q("select count(*) from sauvegarde.journal_ecritures where at >= now() - interval '90 days'"));
  const n = Number(Q('select sauvegarde.vrm_purger_journal(90, 1000)'));
  const reste = Number(Q('select count(*) from sauvegarde.journal_ecritures'));
  dit(n === total - recents && reste === recents, 'la purge retire seulement ce qui a plus de 90 jours', `${n} retirées, ${reste} gardées`);
  Q('select sauvegarde.vrm_purger_journal(1)');
  const reste30 = Number(Q('select count(*) from sauvegarde.journal_ecritures'));
  const attendu30 = Number(Q("select count(*) from sauvegarde.journal_ecritures where at >= now() - interval '30 days'"));
  dit(reste30 === attendu30 && attendu30 > 0, 'moins de 30 jours demandés ⇒ 30 jours gardés quand même', `${reste30} gardées`);
  dit(Q("select has_function_privilege('anon','sauvegarde.vrm_purger_journal(int,int)','execute')") === 'f' && Q("select has_function_privilege('authenticated','sauvegarde.vrm_purger_journal(int,int)','execute')") === 'f' && Q("select has_function_privilege('service_role','sauvegarde.vrm_purger_journal(int,int)','execute')") === 't', 'la purge : clé de service seule');
  dit(!/\bdelete\s+from\s+public\./i.test(MIGRATION) && !/\bdrop\s+(table|schema)\b/i.test(MIGRATION.replace(/^--.*$/gm, '')), 'le fichier n’efface rien de lui-même (aucun delete sur public, aucun drop hors commentaires)');
} catch (e) { ko++; console.log('❌ ' + String(e && e.message || e).slice(0, 400)); }
console.log(`\n${ok} vert(s), ${ko} rouge(s)`);
process.exit(ko ? 1 : 0);
