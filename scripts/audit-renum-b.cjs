#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 013 — « LES ANCIENS NUMÉROS DEVIENNENT B… »
//  node scripts/audit-renum-b.cjs              (le contrôle)
//  node scripts/audit-renum-b.cjs --prouve     (chaque règle réaffaiblie doit
//                                               faire passer l'audit au ROUGE)
//  node scripts/audit-renum-b.cjs --mutation=nom
//
//  Décision de Julien (9 octobre) : tous les anciens numéros deviennent
//  « B + l'ancien », et ses nouvelles paires repartent de 1. La conversion est
//  un SQL (supabase/migrations/013-anciens-numeros-en-b.sql) : on l'EXÉCUTE
//  pour de vrai, sur un Postgres JETABLE lancé par cet audit, chargé de données
//  INVENTÉES à la forme exacte des siennes (scripts/renum-b/fixtures.sql).
//  Aucune donnée réelle, aucune connexion à la vraie base.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1 : un audit qui ne
//  peut pas tourner n'est jamais vert par défaut.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/013-anciens-numeros-en-b.sql');
const MIN = path.join(__dirname, 'renum-b/supabase-min.sql');
const FX = path.join(__dirname, 'renum-b/fixtures.sql');
const APP = path.join(RACINE, 'src/App.jsx');
const J = '11111111-1111-1111-1111-111111111111';   // le vendeur (inventé)
const T = '22222222-2222-2222-2222-222222222222';   // un autre vendeur (inventé)

const args = process.argv.slice(2);
const MUTATION = (args.find(a => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = (nom, f) => { try { return f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle. `--prouve` exige que
//    l'audit sorte en ROUGE pour chacune (« la fonction n'existait pas avant »
//    n'est pas une preuve : il faut montrer que le contrôle attrape la règle
//    fautive). ─────────────────────────────────────────────────────────────
const remplace = (s, avant, apres, nom) => { if (!s.includes(avant)) throw new Error('mutation ' + nom + ' : ancre introuvable'); return s.split(avant).join(apres); };
const MUTATIONS = {
  // Le garde-fou du brouillon : il ne protégeait QUE le pool (critique T5).
  'garde-pool-seul': { sql: (s) => remplace(s,
    "  m := old.data -> 'vrm_numerotation';\n  if m is null or",
    "  m := null;\n  if m is null or", 'garde-pool-seul') },
  // Le marqueur recopié seulement s'il MANQUE (critique T2) : un navigateur peut le changer.
  'marqueur-libre': { sql: (s) => remplace(s,
    "  if old.data ? 'vrm_numerotation' then\n    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('vrm_numerotation', old.data -> 'vrm_numerotation');\n  elsif coalesce(new.data, '{}'::jsonb) ? 'vrm_numerotation' then\n    new.data := new.data - 'vrm_numerotation';\n  end if;",
    "  if old.data ? 'vrm_numerotation' and not (coalesce(new.data, '{}'::jsonb) ? 'vrm_numerotation') then\n    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('vrm_numerotation', old.data -> 'vrm_numerotation');\n  end if;", 'marqueur-libre') },
  // Une fiche numérotée peut disparaître (critique T1, deux appareils).
  'sans-fiche-perdue': { sql: (s) => remplace(s,
    "  if n > 0 then\n    raise exception using errcode = 'P0001', message = 'vrm_fiche_perdue',",
    "  if false then\n    raise exception using errcode = 'P0001', message = 'vrm_fiche_perdue',", 'sans-fiche-perdue') },
  // Le garage 3D sans garde-fou (critique T4).
  'sans-garde-garage': { apres: 'drop trigger vrm_garde_garage on public.app_data;' },
  // Le garage garde `start` (la pile suivante proposerait 144 : critique « piles »).
  'garage-garde-start': { sql: (s) => remplace(s,
    "          if sens = 'archive' and it ->> 'type' = 'pile' and it ? 'start' then\n            it := it - 'start';",
    "          if false then\n            it := it - 'start';", 'garage-garde-start') },
  // L'idempotence posée sur la seule présence du marqueur (critique T3).
  'idempotence-marqueur': { sql: (s) => {
    const a = s.indexOf('  -- IDEMPOTENCE, sur le REGISTRE');
    const b = s.indexOf("  if attendu is null then", a);
    if (a < 0 || b < 0) throw new Error('mutation idempotence-marqueur : ancre introuvable');
    return s.slice(0, a) + "  if d ? 'vrm_numerotation' then return jsonb_build_object('deja', true); end if;\n" + s.slice(b);
  } },
  // Un nombre lu dans un TITRE (hors pool) deviendrait un faux « B99001 ».
  'emails-titre-en-b': { sql: (s) => remplace(s,
    "   where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_' and sauvegarde.vrm_num_genre(a.data -> 'numero') in ('nu', 'lot')\n     and not exists (select 1 from sauvegarde.vrm_num_elements(a.data -> 'numero') el where not (el::text = any (coalesce(pool_cles, '{}'::text[]))));\n  get diagnostics n_convertis = row_count;",
    "   where a.owner = p_owner and a.id ~ '^email_(bord|sale|final)_' and sauvegarde.vrm_num_genre(a.data -> 'numero') in ('nu', 'lot');\n  get diagnostics n_convertis = row_count;", 'emails-titre-en-b') },
  // Une forme inconnue n'arrête plus rien : on devinerait.
  'devine-les-autres': { sql: (s) => remplace(s,
    "  if sauvegarde.vrm_mesure_autres(avant) > 0 then\n    raise exception 'vrm_numerotation : % valeur(s) de forme inconnue",
    "  if false then\n    raise exception 'vrm_numerotation : % valeur(s) de forme inconnue", 'devine-les-autres') },
  // La mesure n'est plus obligatoire.
  'mesure-facultative': { sql: (s) => remplace(s,
    "  if attendu is null then\n    raise exception",
    "  if attendu is null then attendu := '{}'::jsonb; end if;\n  if false then\n    raise exception", 'mesure-facultative') },
  // Le retour arrière ne vérifie plus sa propre condition (critique « retour arrière »).
  'annuler-sans-garde': { sql: (s) => remplace(s,
    "  if bloque <> '' then\n    raise exception 'vrm_numerotation : retour arrière REFUSÉ",
    "  if false then\n    raise exception 'vrm_numerotation : retour arrière REFUSÉ", 'annuler-sans-garde') },
  // Le pool peut rétrécir.
  'pool-retrecit': { sql: (s) => remplace(s,
    "    if perdus > 0 then\n      raise exception using errcode = 'P0001', message = 'vrm_pool_retreci',",
    "    if false then\n      raise exception using errcode = 'P0001', message = 'vrm_pool_retreci',", 'pool-retrecit') },
};

if (PROUVE) {
  let rouges = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /mg) || []).length;
    const sautee = /audit NON exécuté/.test(r.stdout);
    const bon = r.status !== 0 && n > 0 && !sautee;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté' : 'RESTE VERTE : le contrôle ne mord pas')}`);
    if (bon) for (const l of r.stdout.split('\n').filter(x => x.startsWith('❌ ')).slice(0, 3)) console.log('      ' + l);
  }
  console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
  process.exit(rouges === noms.length ? 0 : 1);
}

// ── TROUVER POSTGRES ─────────────────────────────────────────────────────
function trouverBin() {
  const avec = (d) => d && fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'pg_ctl')) && fs.existsSync(path.join(d, 'postgres'));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter(x => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  try { const d = execFileSync('pg_config', ['--bindir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (avec(d)) return d; } catch (_) {}
  return null;
}
const BIN = trouverBin();
const PSQL = (() => { if (BIN && fs.existsSync(path.join(BIN, 'psql'))) return path.join(BIN, 'psql'); try { return execFileSync('which', ['psql']).toString().trim() || null; } catch (_) { return null; } })();
if (!BIN || !PSQL) {
  console.log('❌ Postgres introuvable (initdb, pg_ctl, postgres, psql) — audit NON exécuté. Installe postgresql (16+), ou donne PG_BIN=/chemin/vers/bin.');
  process.exit(1);
}
// Postgres refuse de tourner sous root : on lance le serveur sous `postgres`.
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) {
  try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; }
  catch (_) { console.log('❌ lancé en root sans utilisateur « postgres » — audit NON exécuté.'); process.exit(1); }
}
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-renum-b-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(55432 + (process.pid % 2000));
const serveur = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
process.on('SIGINT', () => { arreter(); process.exit(1); });
{
  const r = serveur('initdb', ['-D', DIR + '/data', '-U', 'postgres', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb a échoué — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}
const version = spawnSync(PSQL, ['-h', DIR, '-p', PORT, '-U', 'postgres', '-X', '-At', '-c', 'show server_version'], { encoding: 'utf8' }).stdout.trim();
console.log(`(Postgres ${version} jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);

// ── PSQL ─────────────────────────────────────────────────────────────────
const psql = (db, sql, o = {}) => {
  const a = ['-h', DIR, '-p', PORT, '-U', 'postgres', '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'J=' + J, '-v', 'T=' + T];
  if (o.fichier) a.push('-f', o.fichier); else a.push('-c', sql);
  const r = spawnSync(PSQL, a, { encoding: 'utf8', maxBuffer: 64 << 20, input: o.input });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const Q = (db, sql) => { const r = psql(db, sql); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const QJ = (db, sql) => JSON.parse(Q(db, sql) || 'null');
// Une écriture comme la fait l'app (PostgREST : un upsert, sous le rôle du
// navigateur, avec la session du vendeur).
const navigateur = (db, idLigne, expr, owner = J) => psql(db,
  `set role authenticated; set "request.jwt.claim.sub" = '${owner}';
   insert into public.app_data (owner, id, data)
   select '${owner}', '${idLigne}', ${expr} from (select data from public.app_data where owner = '${owner}' and id = '${idLigne}') cur
   on conflict (owner, id) do update set data = excluded.data;`);
const refus = (r) => (/vrm_[a-z_]+/.exec(r.err || '') || [''])[0];
const md5 = (db, id, owner = J) => Q(db, `select md5(data::text) from public.app_data where owner = '${owner}' and id = '${id}'`);

let SQL = fs.readFileSync(MIG, 'utf8');
const m = MUTATION ? MUTATIONS[MUTATION] : null;
if (MUTATION && !m) { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }
if (m && m.sql) SQL = m.sql(SQL);
const FMIG = path.join(DIR, 'migration.sql');
fs.writeFileSync(FMIG, SQL);

const nouvelleBase = (db) => {
  Q('postgres', `drop database if exists ${db}`); Q('postgres', `create database ${db}`);
  let r = psql(db, null, { fichier: MIN }); if (!r.ok) throw new Error('supabase-min : ' + r.err.slice(0, 300));
  r = psql(db, null, { fichier: FX }); if (!r.ok) throw new Error('fixtures : ' + r.err.slice(0, 300));
};
const installer = (db) => {
  const r = psql(db, null, { fichier: FMIG });
  if (r.ok && m && m.apres) Q(db, m.apres);
  return r;
};
const MESURE = (db) => Q(db, `select sauvegarde.vrm_numerotation_mesurer('${J}', 'B')::text`);
const archiver = (db, attendu) => psql(db, `select sauvegarde.vrm_numerotation_archiver('${J}', 'B', ${attendu === null ? 'null' : `'${attendu.replace(/'/g, "''")}'::jsonb`})::text`);

// ════════════════════════════════════════════════════════════════════════════
const DB = 'renum';
essaie('préparer la base inventée', () => nouvelleBase(DB));
const AVANT = {};
essaie('mémoriser l\'avant', () => {
  AVANT.main = md5(DB, 'main'); AVANT.T = md5(DB, 'main', T); AVANT.room = md5(DB, 'vrm_room');
  AVANT.stock = Q(DB, `select md5((data -> 'vinted_stock_vinted')::text) from public.app_data where owner = '${J}' and id = 'main'`);
  AVANT.pdf = Q(DB, `select md5(string_agg(data ->> 'pdfB64', '' order by id)) from public.app_data where owner = '${J}' and id like 'email_bord_%'`);
  AVANT.lbc = md5(DB, 'lbc_listings'); AVANT.journal = md5(DB, 'email_journal'); AVANT.ebayl = md5(DB, 'ebay_listings');
  AVANT.emailsMaj = Q(DB, `select md5(string_agg(updated_at::text, ',' order by id)) from public.app_data where owner = '${J}' and id like 'email\\_%'`);
});

console.log('1. L\'INSTALLATION (le fichier seul) ne convertit RIEN');
essaie('installer', () => {
  const r = installer(DB);
  dit(r.ok, 'le fichier s\'applique (une transaction, aucune erreur)', r.ok ? '' : r.err.slice(0, 300));
});
essaie('rien converti', () => {
  dit(md5(DB, 'main') === AVANT.main, 'la ligne main est intacte après l\'installation');
  dit(Q(DB, "select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid = 'public.app_data'::regclass and not tgisinternal")
      === (m && m.apres && /garage/.test(m.apres) ? 'vrm_garde_numeros,vrm_meta_maj,vrm_noter_ecriture' : 'vrm_garde_garage,vrm_garde_numeros,vrm_meta_maj,vrm_noter_ecriture'),
    'les garde-fous sont posés, avant `vrm_meta_maj` (ordre alphabétique : `meta` est calculé sur la ligne finale)');
  dit(Q(DB, "select has_schema_privilege('authenticated', 'sauvegarde', 'usage')") === 'f', 'le navigateur n\'a aucun accès au schéma `sauvegarde` (fonctions de conversion, copies)');
});
essaie('avant la coupure', () => {
  const r = navigateur(DB, 'main', `data || '{"vrm_numerotation":{"version":9,"archive":"Z"}}'::jsonb`);
  dit(r.ok && Q(DB, `select data ? 'vrm_numerotation' from public.app_data where owner = '${J}' and id = 'main'`) === 'f',
    'avant la coupure, un navigateur ne peut pas POSER de marqueur (il appartient au serveur)', r.ok ? '' : r.err.slice(0, 200));
  const r2 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') - 0)`);
  dit(!r2.ok && refus(r2) === 'vrm_pool_retreci', 'avant la coupure déjà, le pool ne rétrécit pas depuis un navigateur (§5, append-only)', refus(r2) || 'accepté');
  dit(md5(DB, 'main') === AVANT.main, 'et la ligne main n\'a pas bougé');
});

console.log('\n2. LA MESURE, et ce qui ARRÊTE la conversion');
let ATTENDU = null;
essaie('mesure', () => {
  ATTENDU = MESURE(DB);
  const a = JSON.parse(ATTENDU);
  dit(a.vinted_used_numeros.nu === 552 && a.vinted_used_numeros.lettres === 1 && a.poolCles === 553 && a.poolMax === 552,
    'pool : 552 numéros nus + 1 déjà à lettres (C3), max 552', JSON.stringify(a.vinted_used_numeros));
  dit(a.vinted_annonce_numeros.nu === 401 && a.vinted_sale_overrides.nu === 500 && a.vinted_sale_overrides.lot === 1,
    'fiches 401 nues · ventes 500 nues + 1 lot « 40+41 »');
  dit(a.emails.nuDuPool === 119 && a.emails.nuHorsPool === 2, 'emails : 119 numéros du pool (dont le lot), 2 nombres lus dans un TITRE (hors pool)', JSON.stringify(a.emails));
  dit(a.garage3d.nu === 33, 'garage 3D : 33 cartons (pile de 26, 3 cases, une pile de 3 numérotée depuis `start`, une boîte seule)', JSON.stringify(a.garage3d));
});
essaie('sans mesure', () => {
  const r = archiver(DB, null);
  dit(!r.ok && /mesure « attendu » est obligatoire/.test(r.err) && md5(DB, 'main') === AVANT.main, 'sans la mesure : refus, rien ne bouge', r.ok ? 'ACCEPTÉ' : '');
});
essaie('forme inconnue', () => {
  const r = psql(DB, `begin;
    update public.app_data set data = jsonb_set(data, '{vinted_annonce_numeros,9000000001,numero}', '"0"') where owner = '${J}' and id = 'main';
    select sauvegarde.vrm_numerotation_archiver('${J}', 'B', sauvegarde.vrm_numerotation_mesurer('${J}', 'B'));
    rollback;`);
  dit(!r.ok && /forme inconnue/.test(r.err), 'une valeur de forme inconnue (« 0 ») ARRÊTE tout : on ne devine pas', r.ok ? 'ACCEPTÉ' : r.err.slice(0, 160));
  const r2 = psql(DB, `begin;
    update public.app_data set data = jsonb_set(data, '{vinted_sale_overrides,22000000001,numero}', '"1234567"') where owner = '${J}' and id = 'main';
    select sauvegarde.vrm_numerotation_archiver('${J}', 'B', sauvegarde.vrm_numerotation_mesurer('${J}', 'B'));
    rollback;`);
  dit(!r2.ok && /forme inconnue/.test(r2.err), 'sept chiffres : arrête tout aussi', r2.ok ? 'ACCEPTÉ' : '');
  dit(md5(DB, 'main') === AVANT.main, 'rien n\'a bougé');
});
essaie('mesure périmée', () => {
  const r = psql(DB, `begin;
    update public.app_data set data = jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '553'::jsonb) where owner = '${J}' and id = 'main';
    select sauvegarde.vrm_numerotation_archiver('${J}', 'B', '${ATTENDU}'::jsonb);
    commit;`);
  dit(!r.ok && /la base a changé depuis la mesure/.test(r.err), 'une paire numérotée entre la mesure et l\'application : refus nommé', r.ok ? 'ACCEPTÉ' : r.err.slice(0, 160));
  dit(md5(DB, 'main') === AVANT.main, 'et rien ne bouge (même pas le 553)');
});
essaie('série B déjà là', () => {
  const r = psql(DB, `begin;
    update public.app_data set data = jsonb_set(data, '{vinted_annonce_numeros,9000000999,numero}', '"B7"') where owner = '${J}' and id = 'main';
    select sauvegarde.vrm_numerotation_archiver('${J}', 'B', sauvegarde.vrm_numerotation_mesurer('${J}', 'B'));
    rollback;`);
  dit(!r.ok && /existent déjà/.test(r.err), 'une série « B… » déjà présente : refus (les anciens s\'y mélangeraient)', r.ok ? 'ACCEPTÉ' : '');
});

console.log('\n3. L\'ESSAI DANS UNE TRANSACTION ANNULÉE ne laisse rien (c\'est ainsi qu\'on l\'essaie sur sa vraie base)');
essaie('essai annulé', () => {
  const r = psql(DB, `begin; select (sauvegarde.vrm_numerotation_archiver('${J}', 'B', '${ATTENDU}'::jsonb)) ->> 'deja'; rollback;`);
  dit(r.ok && r.out === 'false', 'l\'essai va jusqu\'au bout (aucune erreur)', r.ok ? '' : r.err.slice(0, 200));
  dit(md5(DB, 'main') === AVANT.main && md5(DB, 'vrm_room') === AVANT.room, 'main et garage inchangés après ROLLBACK');
  dit(Q(DB, 'select count(*) from sauvegarde.numerotation_013') === '0' && Q(DB, 'select count(*) from sauvegarde.numerotation_faite') === '0',
    'ni copie ni registre après ROLLBACK');
});

console.log('\n4. L\'APPLICATION');
let RAPPORT = null;
essaie('application', () => {
  const r = archiver(DB, ATTENDU);
  dit(r.ok, 'aucune erreur', r.ok ? '' : r.err.slice(0, 300));
  RAPPORT = r.ok ? JSON.parse(r.out) : null;
  dit(RAPPORT && RAPPORT.deja === false && RAPPORT.version === 2, 'rapport : version 2', RAPPORT ? JSON.stringify({ v: RAPPORT.version, conv: RAPPORT.emailsConvertis, dep: RAPPORT.emailsDeplacesEnTitre }) : '');
});
const champ = (sql) => Q(DB, sql);
essaie('main converti', () => {
  dit(champ(`select jsonb_array_length(data -> 'vinted_used_numeros') || '/' || (select count(*) from jsonb_array_elements(data -> 'vinted_used_numeros') e where jsonb_typeof(e) = 'number')
    || '/' || (select count(*) from jsonb_array_elements_text(data -> 'vinted_used_numeros') e where e ~ '^B[0-9]+$') || '/' || (data -> 'vinted_used_numeros' @> '["C3"]')
    from public.app_data where owner = '${J}' and id = 'main'`) === '553/0/552/true',
    'pool : 553 entrées, 0 entier, 552 « B… », C3 intact');
  dit(champ(`select count(*) || '/' || count(*) filter (where v ->> 'numero' ~ '^B[0-9]+$') || '/' || count(*) filter (where v ->> 'numero' = 'C3')
    || '/' || count(*) filter (where (v ->> 'auto')::boolean) || '/' || count(*) filter (where v ? 'buyPrice') || '/' || count(*) filter (where v ? 'mp') || '/' || count(*) filter (where v ? 'repriseAt')
    from public.app_data a, jsonb_each(a.data -> 'vinted_annonce_numeros') e(k, v) where owner = '${J}' and id = 'main'`) === '402/401/1/384/8/4/17',
    'fiches : 401 en B, C3 intact ; auto, prix d\'achat, places et reprises gardés');
  dit(champ(`select count(*) || '/' || count(*) filter (where v ->> 'numero' ~ '^B[0-9]+$') || '/' || max(v ->> 'numero') filter (where k = '22000000999')
    || '/' || count(*) filter (where (v ->> 'autoShip')::boolean) from public.app_data a, jsonb_each(a.data -> 'vinted_sale_overrides') e(k, v) where owner = '${J}' and id = 'main'`) === '501/500/B40+B41/132',
    'ventes : 500 en B, le lot devient « B40+B41 », autoShip gardé');
  dit(champ(`select (select string_agg(k, ',') from jsonb_object_keys(data -> 'vinted_buyprice_by_num') k) || '|' || (select count(*) from jsonb_object_keys(data -> 'vinted_pairs_lost') k where k ~ '^B[0-9]+$')
    || '|' || (select string_agg(k || '=' || v, ',' order by k) from jsonb_each_text(data -> 'vrm_lbc_liens') x(k, v))
    from public.app_data where owner = '${J}' and id = 'main'`) === 'B385|26|2900000001=B233,2900000002=B250,2900000003=B271',
    'prix d\'achat par N° : B385 · 26 paires retirées en B · liens Leboncoin en B (clés intactes)');
  dit(champ(`select (data #>> '{vinted_bord_links,22000000400,numero}') || '|' || (data #>> '{vinted_offvinted_buys,0,numero}') || '|' || coalesce(data #>> '{vinted_offvinted_buys,1,numero}', '?')
    || '|' || (data #>> '{vinted_garage_grid,A1,0}') || '|' || (select string_agg(k, ',' order by k) from jsonb_object_keys(data #> '{vrm_inventaire_pointage,pointes}') k)
    || '|' || coalesce(data #>> '{vrm_inventaire_pointage,debut}', 'null') from public.app_data where owner = '${J}' and id = 'main'`) === 'B77|B88||B9|B116,B14|null',
    'bordereau relié B77 · achat hors Vinted B88 (le vide reste vide) · garage 2D B9 · pointage B116/B14, recommencé');
  dit(champ(`select (data -> 'vrm_num_prefixe')::text || '|' || (data #>> '{vrm_numerotation,version}') || '|' || (data #>> '{vrm_numerotation,archive}')
    || '|' || jsonb_array_length(data #> '{vrm_numerotation,lbcAnnonces}') || '|' || (data #> '{vrm_numerotation,ebayAnnonces}')::text
    from public.app_data where owner = '${J}' and id = 'main'`) === '""|2|B|3|["3"]',
    'nouvelles paires en chiffres (préfixe "") · marqueur version 2, archive B · 3 annonces Leboncoin et 1 eBay d\'archive (par identifiant)');
  dit(champ(`select md5((data -> 'vinted_stock_vinted')::text) from public.app_data where owner = '${J}' and id = 'main'`) === AVANT.stock, 'l\'ancien catalogue (vinted_stock_vinted) n\'est PAS touché');
  dit(champ(`select (data -> 'vinted_ship_done')::text || (data ->> 'vrm_prenom') from public.app_data where owner = '${J}' and id = 'main'`) === '{"22000000010": true}Prénom inventé', 'le reste de main est intact');
});
essaie('garage 3D', () => {
  const g = QJ(DB, `select data from public.app_data where owner = '${J}' and id = 'vrm_room'`);
  const it = (id) => g.rooms[0].items.find(x => x.id === id);
  dit(it('f1').nums.length === 26 && it('f1').nums[24] === 'B143' && it('f1').nums[25] === 'B143' && !('start' in it('f1')),
    'pile : 26 cartons en B, le B143 deux fois (deux boîtes), `start` retiré (la pile suivante ne proposera plus 144)');
  dit(JSON.stringify(it('f5').nums) === '["B600","B601","B602"]' && !('start' in it('f5')), 'une pile numérotée depuis `start` reçoit sa liste B600…B602');
  dit(it('f6').num === 'B88' && JSON.stringify(it('f2').slots) === '{"7_3":["B15"],"8_3":["B20"]}' && JSON.stringify(it('f3').slots) === '{"1_0":["B14"]}', 'boîte seule B88, cases B14, B15, B20');
  dit(g.numerotation === 2, 'le garage est estampillé de la version (2)');
});
essaie('local, brouillons', () => {
  dit(champ(`select data #>> '{photos,0,pins,0,numero}' || '|' || (data #>> '{photos,0,pins,1,numero}') || '|' || (data #>> '{photos,0,img}') from public.app_data where owner = '${J}' and id = 'vrm_local'`) === 'B116||data:image/jpeg;base64,AAAA',
    '« Mon local en photo » : le repère passe en B116, l\'image ne bouge pas');
  dit(champ(`select data #>> '{items,b-1,numero}' || '|' || coalesce(data #>> '{items,b-2,numero}', '-') from public.app_data where owner = '${J}' and id = 'ebay_brouillons'`) === 'B30|-', 'brouillon eBay B30');
});
essaie('emails', () => {
  dit(champ(`select count(*) filter (where data ->> 'numero' ~ '^B') || '/' || count(*) filter (where data ->> 'numero' = '') from public.app_data where owner = '${J}' and id ~ '^email_(bord|sale|final)_'`) === '119/67',
    'emails : 119 en B (dont le lot B40+B41), les vides restent vides');
  dit(champ(`select string_agg(id || '=' || (data ->> 'numero') || ':' || (data ->> 'numeroTitre'), ',' order by id) from public.app_data where owner = '${J}' and data ? 'numeroTitre'`) === 'email_final_cccc=:2079,email_sale_aaaa=:99001',
    '« 99001 » et « 2079 » (lus dans un TITRE, absents du pool) ne deviennent PAS de faux B : ils passent dans `numeroTitre`');
  dit(champ(`select count(*) from public.app_data where owner = '${J}' and id like 'email_bord_%' and coalesce(meta ->> 'numero', '') <> coalesce(data ->> 'numero', '')`) === '0', '`meta` suit (déclencheur vrm_meta_maj)');
  dit(champ(`select md5(string_agg(data ->> 'pdfB64', '' order by id)) from public.app_data where owner = '${J}' and id like 'email_bord_%'`) === AVANT.pdf, 'les PDF ne bougent pas');
  dit(champ(`select md5(string_agg(updated_at::text, ',' order by id)) from public.app_data where owner = '${J}' and id like 'email\\_%'`) === AVANT.emailsMaj, '`updated_at` des emails intact (ce ne sont pas des emails reçus aujourd\'hui)');
  dit(md5(DB, 'email_journal') === AVANT.journal && md5(DB, 'lbc_listings') === AVANT.lbc && md5(DB, 'ebay_listings') === AVANT.ebayl,
    'le journal du serveur, les captures Leboncoin et eBay ne sont pas touchés');
  dit(md5(DB, 'main', T) === AVANT.T, 'l\'autre vendeur n\'est pas touché');
});
essaie('copie et registre', () => {
  dit(champ(`select count(*) || '/' || count(*) filter (where data ? 'pdfB64') from sauvegarde.numerotation_013`) === '125/0', 'copie : main, garage, local, brouillons + 121 emails (sans PDF)');
  dit(champ(`select md5(data::text) from sauvegarde.numerotation_013 where id = 'main'`) === AVANT.main, 'la copie de main est l\'avant exact');
  dit(champ(`select version || '/' || archive || '/' || (annule_le is null) from sauvegarde.numerotation_faite`) === '2/B/true', 'le registre dit « fait », version 2');
});
// Le VRAI calcul du prochain numéro d'App.jsx, sur la ligne convertie.
const prochain = (data) => {
  const src = fs.readFileSync(APP, 'utf8');
  const prend = (re) => { const x = re.exec(src); if (!x) throw new Error('introuvable dans App.jsx : ' + re); return x[0]; };
  const code = [prend(/const cleNum = \(v\) => \{[\s\S]*?\n\};/), prend(/const NUM_OK = [^\n]*/), prend(/const entreePool = \(v\) => \{[\s\S]*?\n\};/),
    prend(/const prochainLibre = \(prisInt, prisCles, pref\) => \{[\s\S]*?\n\};/)].join('\n') + '\n;({ cleNum, prochainLibre })';
  const { cleNum, prochainLibre } = vm.runInNewContext(code, {});
  const taken = new Set(), cles = new Set();
  const ajI = (x) => { const n = parseInt(String(x), 10); if (!isNaN(n)) taken.add(n); };
  const ajC = (v) => { const c = cleNum(v); if (c) cles.add(c); };
  const used = data.vinted_used_numeros || [], fi = Object.values(data.vinted_annonce_numeros || {}), ve = Object.values(data.vinted_sale_overrides || {});
  used.forEach(ajI); fi.forEach(e => ajI(e && e.numero)); ve.forEach(e => ajI(e && e.numero));
  used.forEach(ajC); fi.forEach(e => ajC(e && e.numero)); ve.forEach(e => ajC(e && e.numero));
  const pref = String(data.vrm_num_prefixe || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return prochainLibre(taken, cles, pref);
};
essaie('prochain numéro', () => {
  const d = QJ(DB, `select data from public.app_data where owner = '${J}' and id = 'main'`);
  dit(prochain(d) === '1', 'le VRAI `prochainLibre` d\'App.jsx sur la ligne convertie rend « 1 » : la première nouvelle paire reçoit 1', prochain(d));
});

console.log('\n5. RELANCÉE, ELLE NE FAIT RIEN');
const APRES1 = (() => { try { return md5(DB, 'main'); } catch (_) { return ''; } })();
essaie('relance', () => {
  const r = archiver(DB, ATTENDU);
  dit(r.ok && JSON.parse(r.out).deja === true, 'relancée avec la même mesure : « déjà fait »', r.ok ? '' : r.err.slice(0, 200));
  dit(md5(DB, 'main') === APRES1, 'main identique');
  dit(champ(`select count(*) from public.app_data where owner = '${J}' and (data ->> 'numero' like 'BB%' or data::text like '%"BB%')`) === '0', 'aucun « BB… » nulle part');
  dit(champ('select count(*) from sauvegarde.numerotation_013') === '125', 'aucune seconde copie');
});

console.log('\n6. LES GARDE-FOUS — ce qu\'un navigateur ne peut plus écrire');
essaie('copies', () => {
  Q(DB, `create schema banc; grant usage on schema banc to authenticated;
         create table banc.snap (nom text primary key, d jsonb); grant select on banc.snap to authenticated;
         insert into banc.snap select 'avant', data from sauvegarde.numerotation_013 where id = 'main';
         insert into banc.snap select 'avant_room', data from sauvegarde.numerotation_013 where id = 'vrm_room';
         insert into banc.snap select 'apres', data from public.app_data where owner = '${J}' and id = 'main';`);
});
essaie('appareil chargé avant la coupure', () => {
  const r = navigateur(DB, 'main', `(select d from banc.snap where nom = 'avant')`);
  dit(!r.ok && refus(r) === 'vrm_pool_retreci', 'la ligne ENTIÈRE d\'avant (l\'appareil resté ouvert) : refusée', refus(r) || 'ACCEPTÉE');
  dit(md5(DB, 'main') === APRES1, 'main toujours en B');
});
essaie('T5 pool à jour, cartes d\'avant', () => {
  const r = navigateur(DB, 'main', `data || jsonb_build_object('vinted_annonce_numeros', (select d -> 'vinted_annonce_numeros' from banc.snap where nom = 'avant'),
    'vinted_buyprice_by_num', (select d -> 'vinted_buyprice_by_num' from banc.snap where nom = 'avant'), 'vinted_pairs_lost', (select d -> 'vinted_pairs_lost' from banc.snap where nom = 'avant'))`);
  dit(!r.ok && refus(r) === 'vrm_numeros_perimes', 'le pool à jour mais les fiches, prix par N° et paires retirées d\'avant (critique T5) : refusé', refus(r) || 'ACCEPTÉ');
  const r2 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_buyprice_by_num}', '{"385":"30"}')`);
  dit(!r2.ok && refus(r2) === 'vrm_numeros_perimes', 'le seul prix par N° d\'avant (« 385 » au lieu de « B385 ») : refusé (la nouvelle paire 385 en hériterait)', refus(r2) || 'ACCEPTÉ');
  const r3 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_pairs_lost}', (select d -> 'vinted_pairs_lost' from banc.snap where nom = 'avant'))`);
  dit(!r3.ok && refus(r3) === 'vrm_numeros_perimes', 'les seules paires retirées d\'avant : refusé (la nouvelle paire 23 sortirait des files)', refus(r3) || 'ACCEPTÉ');
  const r4 = navigateur(DB, 'main', `jsonb_set(data, '{vrm_lbc_liens}', '{"2900000001":"233","2900000002":"B250","2900000003":"B271"}')`);
  dit(!r4.ok && refus(r4) === 'vrm_numeros_perimes', 'un lien Leboncoin d\'avant (« 233 ») : refusé', refus(r4) || 'ACCEPTÉ');
  const r5 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_sale_overrides,22000000005,numero}', '"56"')`);
  dit(!r5.ok && refus(r5) === 'vrm_numeros_perimes', 'une vente « B56 » remise à « 56 » : refusé', refus(r5) || 'ACCEPTÉ');
  dit(md5(DB, 'main') === APRES1, 'main inchangé');
});
essaie('marqueur', () => {
  const r = navigateur(DB, 'main', `jsonb_set(data, '{vrm_numerotation}', '{"version":1}')`);
  dit(r.ok && champ(`select data #>> '{vrm_numerotation,version}' from public.app_data where owner = '${J}' and id = 'main'`) === '2',
    'un navigateur qui ÉCRIT un autre marqueur (version 1) : le marqueur reste celui du serveur (critique T2)', r.ok ? '' : r.err.slice(0, 120));
  const r2 = navigateur(DB, 'main', `data - 'vrm_numerotation'`);
  dit(r2.ok && champ(`select data #>> '{vrm_numerotation,version}' from public.app_data where owner = '${J}' and id = 'main'`) === '2',
    'un code qui ne connaît pas le marqueur (il l\'oublie) : recopié');
});
essaie('écritures légitimes', () => {
  const r = navigateur(DB, 'main', `jsonb_set(jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[1]'::jsonb),
    '{vinted_annonce_numeros,8000000001}', '{"numero":"1","auto":true,"numberedAt":"2099-01-01T00:00:00.000Z","title":"nouvelle paire"}')`);
  dit(r.ok, 'appareil rechargé : la nouvelle paire N°1 est acceptée', r.ok ? '' : refus(r) || r.err.slice(0, 160));
  const r2 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_annonce_numeros,9000000001,buyPrice}', '"35"')`);
  dit(r2.ok, 'saisir un prix d\'achat sur une fiche B : accepté', r2.ok ? '' : refus(r2));
  const r3 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_buyprice_by_num,B12}', '"20"')`);
  dit(r3.ok, 'ranger un prix sous « B12 » : accepté', r3.ok ? '' : refus(r3));
});
essaie('manuel', () => {
  const k = '9000000002';
  const sans = navigateur(DB, 'main', `jsonb_set(jsonb_set(data, '{vinted_annonce_numeros,${k},numero}', '"5"'), '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[5]'::jsonb)`);
  dit(!sans.ok && refus(sans) === 'vrm_numeros_perimes', 'une fiche B qui passe à « 5 » SANS saisie à la main : refusé', refus(sans) || 'ACCEPTÉ');
  const avec = navigateur(DB, 'main', `jsonb_set(jsonb_set(jsonb_set(data, '{vinted_annonce_numeros,${k},numero}', '"5"'), '{vinted_annonce_numeros,${k},manuelAt}', '"2099-01-01T00:00:00.000Z"'),
    '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[5]'::jsonb)`);
  dit(avec.ok, '…tapée à la main après la coupure (`manuelAt`) : acceptée — c\'est SON geste', avec.ok ? '' : refus(avec) || avec.err.slice(0, 160));
});
essaie('T1 deux appareils', () => {
  Q(DB, `insert into banc.snap select 'B', data from public.app_data where owner = '${J}' and id = 'main'`);
  const a = navigateur(DB, 'main', `jsonb_set(jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[2]'::jsonb),
    '{vinted_annonce_numeros,8000000002}', '{"numero":"2","auto":true,"numberedAt":"2099-01-01T00:00:01.000Z","title":"paire X"}')`);
  dit(a.ok, 'appareil A donne le 2 à la paire X', a.ok ? '' : refus(a));
  const b = navigateur(DB, 'main', `(select jsonb_set(jsonb_set(d, '{vinted_used_numeros}', (d -> 'vinted_used_numeros') || '[2]'::jsonb),
    '{vinted_annonce_numeros,8000000003}', '{"numero":"2","auto":true,"numberedAt":"2099-01-01T00:00:02.000Z","title":"paire Y"}') from banc.snap where nom = 'B')`);
  dit(!b.ok && refus(b) === 'vrm_fiche_perdue', 'appareil B (chargé avant A) donne AUSSI le 2 à la paire Y : refusé (critique T1)', refus(b) || 'ACCEPTÉ — deux cartons « 2 »');
  dit(champ(`select string_agg(k, ',') from public.app_data a, jsonb_each(a.data -> 'vinted_annonce_numeros') e(k, v) where owner = '${J}' and id = 'main' and v ->> 'numero' = '2'`) === '8000000002',
    'en base, seule la paire X porte le 2');
  const c = navigateur(DB, 'main', `(select d from banc.snap where nom = 'B')`);
  dit(!c.ok && /^vrm_(fiche_perdue|pool_retreci)$/.test(refus(c)), 'appareil B qui ne numérote rien mais ignore X : refusé aussi (X perdrait son numéro)', refus(c) || 'ACCEPTÉ');
});
essaie('reprise', () => {
  const r = navigateur(DB, 'main', `jsonb_set((data #- '{vinted_annonce_numeros,8000000002}'), '{vinted_annonce_numeros,8000000004}',
    '{"numero":"2","auto":false,"repriseAt":"2099-01-02T00:00:00.000Z","repriseDe":"8000000002","title":"paire X republiée"}')`);
  dit(r.ok, 'une reprise désignée (`repriseDe`) : l\'ancienne fiche cède sa place, accepté', r.ok ? '' : refus(r) || r.err.slice(0, 160));
});
essaie('préfixe', () => {
  const r = navigateur(DB, 'main', `jsonb_set(data, '{vrm_num_prefixe}', '"b"')`);
  dit(!r.ok && refus(r) === 'vrm_prefixe_archive', 'choisir « B » pour les nouveaux numéros : refusé (c\'est la série des anciens)', refus(r) || 'ACCEPTÉ');
  const r2 = navigateur(DB, 'main', `jsonb_set(data, '{vrm_num_prefixe}', '"C"')`);
  dit(r2.ok, 'choisir « C » : accepté', r2.ok ? '' : refus(r2));
  navigateur(DB, 'main', `jsonb_set(data, '{vrm_num_prefixe}', '""')`);
});
essaie('serveur', () => {
  const r = psql(DB, `set role service_role; update public.app_data set data = jsonb_set(data, '{vinted_used_numeros}', '[]') where owner = '${T}' and id = 'main';`);
  dit(r.ok, 'le serveur (service_role) n\'est pas bridé', r.ok ? '' : r.err.slice(0, 120));
});
essaie('garage', () => {
  const r = navigateur(DB, 'vrm_room', `(select d from banc.snap where nom = 'avant_room')`);
  dit(!r.ok && refus(r) === 'vrm_garage_perime', 'le garage d\'AVANT (écran chargé avant la coupure) : refusé', refus(r) || 'ACCEPTÉ');
  const r2 = navigateur(DB, 'vrm_room', `data - 'numerotation'`);
  dit(!r2.ok && refus(r2) === 'vrm_garage_perime', 'le code d\'aujourd\'hui, qui jette `numerotation` (normalizePlan) : refusé — le garde-fou n\'est pas rendu inerte (critique T4)', refus(r2) || 'ACCEPTÉ');
  const r3 = navigateur(DB, 'vrm_room', `jsonb_set(jsonb_set(data, '{rooms,0,items,1,slots,7_3}', '["15"]'), '{rooms,0,items,1,slots,8_3}', '["20"]')`);
  dit(!r3.ok && refus(r3) === 'vrm_garage_perime', 'à la bonne version mais deux cartons « B15 », « B20 » qui redeviennent « 15 », « 20 » d\'un coup : refusé (copie d\'avant)', refus(r3) || 'ACCEPTÉ');
  const r4 = navigateur(DB, 'vrm_room', `jsonb_set(data, '{rooms,0,items,2,slots,1_0}', '["14"]')`);
  dit(r4.ok, 'UN carton renuméroté à la main (B14 → 14) : accepté', r4.ok ? '' : refus(r4));
  const r5 = navigateur(DB, 'vrm_room', `jsonb_set(data, '{active}', '"r2"')`);
  dit(r5.ok, 'une sauvegarde normale (version 2) : acceptée', r5.ok ? '' : refus(r5));
  const r6 = navigateur(DB, 'vrm_room', `data`, T);
  dit(r6.ok, 'un vendeur sans coupure (l\'autre) sauve son garage librement', r6.ok ? '' : refus(r6));
});

console.log('\n7. APRÈS LA COUPURE : un numéro neuf reste neuf');
essaie('relance après numéro neuf', () => {
  const r = archiver(DB, ATTENDU);
  dit(r.ok && JSON.parse(r.out).deja === true, 'relancée APRÈS que la paire N°1 a son numéro : « déjà fait »');
  dit(champ(`select data #>> '{vinted_annonce_numeros,8000000001,numero}' from public.app_data where owner = '${J}' and id = 'main'`) === '1', 'la paire N°1 reste « 1 » (jamais « B1 »)');
});
essaie('rattrapage', () => {
  const c = champ(`select data #>> '{vrm_numerotation,coupure}' from public.app_data where owner = '${J}' and id = 'main'`);
  Q(DB, `insert into public.app_data (owner, id, data) values
    ('${J}', 'email_bord_pendant', jsonb_build_object('numero', '45', 'receivedAt', to_char(('${c}'::timestamptz + interval '1 minute') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    ('${J}', 'email_bord_neuf', jsonb_build_object('numero', '3', 'receivedAt', to_char(('${c}'::timestamptz + interval '20 minutes') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))`);
  const r = psql(DB, `select sauvegarde.vrm_numerotation_rattraper('${J}', 2)::text`);
  dit(r.ok && JSON.parse(r.out).rattrapes === 1, 'un bordereau rangé PENDANT la coupure avec « 45 » : rattrapé en B45', r.ok ? r.out.slice(0, 120) : r.err.slice(0, 200));
  dit(champ(`select string_agg(id || '=' || (data ->> 'numero'), ',' order by id) from public.app_data where owner = '${J}' and id in ('email_bord_pendant', 'email_bord_neuf')`) === 'email_bord_neuf=3,email_bord_pendant=B45',
    'un bordereau arrivé 20 min après (une NOUVELLE paire 3) n\'est pas touché');
  const r2 = psql(DB, `select sauvegarde.vrm_numerotation_rattraper('${J}', 2)::text`);
  dit(r2.ok && JSON.parse(r2.out).rattrapes === 0, 'relancé : rien de plus');
});
essaie('annuler refusé', () => {
  const avant = md5(DB, 'main');
  const r = psql(DB, `select sauvegarde.vrm_numerotation_annuler('${J}')`);
  dit(!r.ok && /REFUSÉ/.test(r.err), 'retour arrière REFUSÉ : une nouvelle paire a déjà un numéro (il est peut-être sur un carton)', r.ok ? 'ACCEPTÉ' : r.err.slice(0, 200));
  dit(md5(DB, 'main') === avant, 'rien n\'a bougé');
});

console.log('\n8. LE RETOUR ARRIÈRE CIBLÉ (seconde base, avant toute nouvelle paire)');
const DB2 = 'renum2';
essaie('base 2', () => { nouvelleBase(DB2); const r = installer(DB2); if (!r.ok) throw new Error(r.err.slice(0, 200)); });
let AVANT2 = {};
essaie('application 2', () => {
  AVANT2 = { main: md5(DB2, 'main'), room: md5(DB2, 'vrm_room'), local: md5(DB2, 'vrm_local'), br: md5(DB2, 'ebay_brouillons'),
    emails: Q(DB2, `select md5(string_agg(id || coalesce(data ->> 'numero', '?') || coalesce(data ->> 'numeroTitre', '-'), ',' order by id)) from public.app_data where owner = '${J}' and id ~ '^email_'`) };
  const r = psql(DB2, `select sauvegarde.vrm_numerotation_archiver('${J}', 'B', sauvegarde.vrm_numerotation_mesurer('${J}', 'B'))->>'version'`);
  dit(r.ok && r.out === '2', 'convertie', r.ok ? '' : r.err.slice(0, 200));
  // Après la coupure, il vit sa vie : coche un colis, saisit un prix, déclare son mois, déplace un meuble.
  const w = navigateur(DB2, 'main', `jsonb_set(jsonb_set(jsonb_set(data, '{vinted_ship_done,22000000011}', 'true'), '{vinted_annonce_numeros,9000000003,buyPrice}', '"42"'),
     '{vrm_urssaf_declare,2026-10}', '{"n":1}')`);
  const w2 = navigateur(DB2, 'vrm_room', `jsonb_set(data, '{rooms,0,items,3,x}', '3.5')`);
  dit(w.ok && w2.ok, 'il continue de travailler (colis coché, prix saisi, déclaration, meuble déplacé)', (w.ok ? '' : refus(w)) + (w2.ok ? '' : refus(w2)));
});
essaie('annuler', () => {
  const r = psql(DB2, `select sauvegarde.vrm_numerotation_annuler('${J}')::text`);
  dit(r.ok, 'retour arrière accepté (aucune nouvelle paire numérotée)', r.ok ? '' : r.err.slice(0, 300));
  const d = QJ(DB2, `select data from public.app_data where owner = '${J}' and id = 'main'`);
  const a = QJ(DB2, `select data from sauvegarde.numerotation_013 where id = 'main'`);
  dit(JSON.stringify(d.vinted_used_numeros) === JSON.stringify(a.vinted_used_numeros), 'le pool redevient EXACTEMENT celui d\'avant (entiers, C3)');
  const nums = (o) => JSON.stringify(Object.entries(o || {}).map(([k, v]) => [k, v && v.numero]).sort());
  dit(nums(d.vinted_annonce_numeros) === nums(a.vinted_annonce_numeros) && nums(d.vinted_sale_overrides) === nums(a.vinted_sale_overrides),
    'fiches et ventes : leurs numéros d\'avant (le lot « 40+41 » compris)');
  dit(JSON.stringify(Object.keys(d.vinted_buyprice_by_num)) === '["385"]' && Object.keys(d.vinted_pairs_lost).every(k => /^\d+$/.test(k))
    && d.vrm_lbc_liens['2900000001'] === '233' && !('vrm_num_prefixe' in d), 'clés, liens et préfixe d\'avant');
  dit(d.vinted_ship_done['22000000011'] === true && d.vinted_annonce_numeros['9000000003'].buyPrice === '42' && d.vrm_urssaf_declare['2026-10'] && d.vrm_inventaire_pointage.debut === '2026-10-01T08:00:00.000Z',
    'ce qu\'il a fait APRÈS la coupure est GARDÉ (colis coché, prix saisi, déclaration) — le retour ne remet pas des lignes entières');
  dit(d.vrm_numerotation && d.vrm_numerotation.version === 3 && d.vrm_numerotation.annule === true && d.vrm_numerotation.archive === null,
    'le marqueur passe à la version 3, « annulé » (un appareil chargé pendant la coupure le voit)', JSON.stringify(d.vrm_numerotation));
  const g = QJ(DB2, `select data from public.app_data where owner = '${J}' and id = 'vrm_room'`);
  const it = (id) => g.rooms[0].items.find(x => x.id === id);
  dit(it('f1').nums[0] === '116' && it('f1').start === 116 && !('nums' in it('f5')) && it('f5').start === 600 && it('f6').num === '88' && it('f4').x === 3.5 && g.numerotation === 3,
    'garage : numéros et `start` d\'avant, le meuble déplacé reste déplacé, estampillé version 3');
  dit(Q(DB2, `select md5(string_agg(id || coalesce(data ->> 'numero', '?') || coalesce(data ->> 'numeroTitre', '-'), ',' order by id)) from public.app_data where owner = '${J}' and id ~ '^email_'`) === AVANT2.emails,
    'emails : numéros d\'avant, « numeroTitre » reparti');
  dit(md5(DB2, 'vrm_local') === AVANT2.local && md5(DB2, 'ebay_brouillons') === AVANT2.br, '« Mon local » et brouillons eBay : exactement d\'avant');
  dit(Q(DB2, `select annule_le is not null from sauvegarde.numerotation_faite`) === 't', 'le registre le note');
});
essaie('après annulation', () => {
  const r = navigateur(DB2, 'main', `jsonb_set(data, '{vinted_annonce_numeros,9000000004,numero}', '"77"')`);
  dit(r.ok, 'annulée : plus de règle d\'archive (une écriture en chiffres passe)', r.ok ? '' : refus(r));
  const r2 = navigateur(DB2, 'vrm_room', `jsonb_set(data, '{numerotation}', '2')`);
  dit(!r2.ok && refus(r2) === 'vrm_garage_perime', 'un garage resté à la version 2 (pendant la coupure) : refusé', refus(r2) || 'ACCEPTÉ');
  const r3 = archiver(DB2, MESURE(DB2));
  const rep = r3.ok ? JSON.parse(r3.out) : null;
  dit(rep && rep.deja === false && rep.version === 4, 'relancée après l\'annulation, avec une nouvelle mesure : une NOUVELLE coupure (version 4)', r3.ok ? '' : r3.err.slice(0, 200));
  dit(Q(DB2, 'select count(distinct coupure) from sauvegarde.numerotation_013') === '2', 'deux copies, une par passage : la seconde ne remplace pas la première');
});

console.log('\n9. CE QUE CE FICHIER NE DOIT JAMAIS PORTER');
essaie('identifiants', () => {
  const s = fs.readFileSync(MIG, 'utf8') + fs.readFileSync(FX, 'utf8') + fs.readFileSync(MIN, 'utf8');
  dit(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(s.replace(/1{8}-1{4}-1{4}-1{4}-1{12}|2{8}-2{4}-2{4}-2{4}-2{12}/g, '')),
    'aucun identifiant de vendeur réel dans la migration ni dans les données inventées (dépôt PUBLIC)');
  dit(!/^\s*select\s+sauvegarde\.vrm_numerotation_archiver/m.test(fs.readFileSync(MIG, 'utf8')), 'la migration n\'APPELLE pas la conversion : l\'appel est une étape à part, après la mesure');
});

console.log(`\nBilan : ${ok} vert(s), ${ko} rouge(s).`);
process.exitCode = ko ? 1 : 0;
