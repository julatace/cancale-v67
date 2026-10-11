#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 013 — « LES ANCIENS NUMÉROS DEVIENNENT B… »
//  node scripts/audit-renum-b.cjs              (le contrôle)
//  node scripts/audit-renum-b.cjs --prouve     (chaque règle réaffaiblie doit
//                                               faire passer l'audit au ROUGE)
//  node scripts/audit-renum-b.cjs --mutation=nom
//
//  Décisions de Julien : 9 octobre, « tous les anciens numéros commencent par
//  B, les nouvelles paires repartent de 1 » ; 10 octobre, « j'ai tout supprimé
//  et je reposte, regarde par rapport à la DATE DE MISE EN LIGNE » — et « les
//  anciens, c'est que les paires vendues : je vais tout republier ». La
//  conversion est un SQL (supabase/migrations/013-anciens-numeros-en-b.sql) :
//  on l'EXÉCUTE pour de vrai, sur un Postgres JETABLE lancé par cet audit,
//  chargé de données INVENTÉES à la forme exacte des siennes
//  (scripts/renum-b/fixtures.sql, scripts/renum-b/scenario-nouvelles.sql).
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
const SCEN = path.join(__dirname, 'renum-b/scenario-nouvelles.sql');
const APP = path.join(RACINE, 'src/App.jsx');
const J = '11111111-1111-1111-1111-111111111111';   // le vendeur (inventé)
const T = '22222222-2222-2222-2222-222222222222';   // un autre vendeur (inventé)
const COUPURE = '2026-10-09T00:00:00Z';              // la date T (paramètre de l'appel)

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
  // La date de mise en ligne ignorée : on jugerait sur `numberedAt` seul.
  'date-ignoree': { sql: (s) => remplace(s, 'coalesce(dres.c_ms, dres.p_ms, ld.ms, f.na) date_ms', 'f.na date_ms', 'date-ignoree') },
  // Une fiche numérotée AVANT la coupure deviendrait « nouvelle » sur une date contraire.
  'contradiction-ignoree': { sql: (s) => remplace(s, "(date_ms is not null and date_ms >= t_ms and not contradiction) nouvelle", "(date_ms is not null and date_ms >= t_ms) nouvelle", 'contradiction-ignoree') },
  // Les numéros provisoires (553…) resteraient au pool, en « B553 ».
  'frappes-gardees': { sql: (s) => remplace(s, "       where not (sauvegarde.vrm_num_genre(e) = 'nu' and carte ? public.vrm_cle_num(e))\n", "       where true\n", 'frappes-gardees') },
  // Une vente rattachée par sa transaction ne suivrait plus la fiche nouvelle.
  'identite-ignoree': { sql: (s) => remplace(s, "  partx := coalesce(plan -> 'parTx', '{}'::jsonb);\n  select coalesce", "  partx := '{}'::jsonb;\n  select coalesce", 'identite-ignoree') },
  // Le garde-fou du brouillon : il ne protégeait QUE le pool (critique T5).
  'garde-pool-seul': { sql: (s) => remplace(s, "  m := old.data -> 'vrm_numerotation';\n  if m is null or", "  m := null;\n  if m is null or", 'garde-pool-seul') },
  // Une fiche republiée pourrait reprendre son numéro provisoire.
  'sans-renum': { sql: (s) => remplace(s, "  if jsonb_typeof(m -> 'renum') = 'object' then", "  if false then", 'sans-renum') },
  // Le marqueur recopié seulement s'il MANQUE (critique T2) : un navigateur peut le changer.
  'marqueur-libre': { sql: (s) => remplace(s,
    "  if old.data ? 'vrm_numerotation' then\n    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('vrm_numerotation', old.data -> 'vrm_numerotation');\n  elsif coalesce(new.data, '{}'::jsonb) ? 'vrm_numerotation' then\n    new.data := new.data - 'vrm_numerotation';\n  end if;",
    "  if old.data ? 'vrm_numerotation' and not (coalesce(new.data, '{}'::jsonb) ? 'vrm_numerotation') then\n    new.data := coalesce(new.data, '{}'::jsonb) || jsonb_build_object('vrm_numerotation', old.data -> 'vrm_numerotation');\n  end if;", 'marqueur-libre') },
  // Une fiche numérotée peut disparaître (critique T1, deux appareils).
  'sans-fiche-perdue': { sql: (s) => remplace(s, "  if n > 0 then\n    raise exception using errcode = 'P0001', message = 'vrm_fiche_perdue',", "  if false then\n    raise exception using errcode = 'P0001', message = 'vrm_fiche_perdue',", 'sans-fiche-perdue') },
  // Le garage 3D sans garde-fou (critique T4).
  'sans-garde-garage': { apres: 'drop trigger vrm_garde_garage on public.app_data;' },
  // Le garage garde `start` (la pile suivante proposerait 144 : critique « piles »).
  'garage-garde-start': { sql: (s) => remplace(s, "          if it ->> 'type' = 'pile' and it ? 'start' then it := it - 'start'; end if;", "", 'garage-garde-start') },
  // L'idempotence posée sur la seule présence du marqueur (critique T3).
  'idempotence-marqueur': { sql: (s) => {
    const a = s.indexOf('  -- IDEMPOTENCE, sur le REGISTRE');
    const b = s.indexOf("  if attendu is null then", a);
    if (a < 0 || b < 0) throw new Error('mutation idempotence-marqueur : ancre introuvable');
    return s.slice(0, a) + "  if d ? 'vrm_numerotation' then return jsonb_build_object('deja', true); end if;\n" + s.slice(b);
  } },
  // Un nombre lu dans un TITRE (hors pool) deviendrait un faux « B99001 ».
  'emails-titre-en-b': { sql: (s) => remplace(s, "             else 'deplace' end sorte\n", "             else 'converti' end sorte\n", 'emails-titre-en-b') },
  // Une forme inconnue n'arrête plus rien : on devinerait.
  'devine-les-autres': { sql: (s) => remplace(s, "  if sauvegarde.vrm_mesure_somme(avant, 'autre') > 0 then\n", "  if false then\n", 'devine-les-autres') },
  // La mesure n'est plus obligatoire.
  'mesure-facultative': { sql: (s) => remplace(s, "  if attendu is null then\n    raise exception", "  if attendu is null then attendu := '{}'::jsonb; end if;\n  if false then\n    raise exception", 'mesure-facultative') },
  // Le retour arrière ne vérifie plus sa propre condition (critique « retour arrière »).
  'annuler-sans-garde': { sql: (s) => remplace(s, "  if bouge <> '' then\n    raise exception 'vrm_numerotation : retour arrière REFUSÉ", "  if false then\n    raise exception 'vrm_numerotation : retour arrière REFUSÉ", 'annuler-sans-garde') },
  // Le pool peut rétrécir.
  'pool-retrecit': { sql: (s) => remplace(s, "    if perdus > 0 then\n      raise exception using errcode = 'P0001', message = 'vrm_pool_retreci',", "    if false then\n      raise exception using errcode = 'P0001', message = 'vrm_pool_retreci',", 'pool-retrecit') },
  // Les annonces eBay PROGRAMMÉES oubliées : leur « VRM-40 » serait lu comme la nouvelle 40.
  'programmees-oubliees': { sql: (s) => remplace(s, "a.id in ('ebay_listings', 'ebay_programmees')", "a.id = 'ebay_listings'", 'programmees-oubliees') },
  // Un numéro donné à PLUSIEURS paires nouvelles serait attribué « à la première ».
  'ambigu-devine': { sql: (s) => remplace(s, "case when count(*) = 1 then to_jsonb(min(rang)::text) else 'null'::jsonb end val", "to_jsonb(min(rang)::text) val", 'ambigu-devine') },
  // (relecture du 11 octobre) Le garde-fou ne regarde plus les VENTES (B12 → 12 passe).
  'ventes-non-gardees': { sql: (s) => remplace(s, "  foreach carte in array array['vinted_annonce_numeros', 'vinted_sale_overrides'] loop\n    select count(*), min(o.k) into n, ex\n      from jsonb_each(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) o(k, ov)\n      join jsonb_each(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) w(k2, nv) on w.k2 = o.k\n     where jsonb_typeof(ov) = 'object' and jsonb_typeof(nv) = 'object'\n       and public.vrm_cle_num(ov -> 'numero') ~", "  foreach carte in array array['vinted_annonce_numeros'] loop\n    select count(*), min(o.k) into n, ex\n      from jsonb_each(case when jsonb_typeof(old.data -> carte) = 'object' then old.data -> carte else '{}' end) o(k, ov)\n      join jsonb_each(case when jsonb_typeof(new.data -> carte) = 'object' then new.data -> carte else '{}' end) w(k2, nv) on w.k2 = o.k\n     where jsonb_typeof(ov) = 'object' and jsonb_typeof(nv) = 'object'\n       and public.vrm_cle_num(ov -> 'numero') ~", 'ventes-non-gardees') },
  // Les liens Leboncoin « B233 » → « 233 » passent.
  'liens-non-gardes': { sql: (s) => remplace(s, "   where public.vrm_cle_num(ov) ~ ('^' || arch || '[0-9]+$') and public.vrm_cle_num(nv) ~ '^[0-9]+$';", "   where false;", 'liens-non-gardes') },
  // N'importe quel `manuelAt` (même d'avant la conversion) ferait repasser B230 → 230.
  'manuel-ancien': { sql: (s) => remplace(s, "and not (coalesce(nv ->> 'manuelAt', '') > coup and coalesce(nv ->> 'manuelAt', '') is distinct from coalesce(ov ->> 'manuelAt', ''));", "and not (coalesce(nv ->> 'manuelAt', '') <> '');", 'manuel-ancien') },
  // Une ligne ABSENTE (pas de brouillon eBay, sa forme réelle) comparée à un `null` JSON : retour arrière refusé.
  'absente-vs-null': { sql: (s) => remplace(s, "create or replace function sauvegarde.vrm_proj_aucun(j jsonb)\nreturns jsonb\nlanguage sql\nimmutable\nset search_path = ''\nas $$\n  select case when j is null or jsonb_typeof(j) = 'null' or j = '[]'::jsonb then null else j end\n$$;", "create or replace function sauvegarde.vrm_proj_aucun(j jsonb)\nreturns jsonb\nlanguage sql\nimmutable\nset search_path = ''\nas $$ select j $$;", 'absente-vs-null') },
  // Toute annonce eBay / Leboncoin « VRM-n » lue en B, même un numéro donné après la coupure (VRM-553 → « B553 »).
  'externe-toujours-b': { sql: (s) => remplace(s, "              when carte is not null and carte ? c then case when jsonb_typeof(carte -> c) = 'string' then carte ->> c else '' end\n", "", 'externe-toujours-b') },
  // Le bordereau capté (tx → annonce) ignoré : une vente d'après la coupure sans transaction captée passe en « B564 ».
  'bordereaux-ignores': { sql: (s) => remplace(s, "     where a.owner = p_owner and a.id ~ '^harvest_[0-9]+_label_[0-9]+$' and coalesce(a.meta ->> 'item', '') <> ''", "     where false", 'bordereaux-ignores') },
  // Le rattrapage prend pour ancien un numéro de la NOUVELLE série reçu dans la fenêtre.
  'rattrape-nouvelle-serie': { sql: (s) => remplace(s, "              and not (sauvegarde.vrm_num_genre(a.data -> 'numero') = 'nu'\n                       and exists", "              and not (false\n                       and exists", 'rattrape-nouvelle-serie') },
  // Le plan recalculé pour le recompte (deux fois par conversion, `main` verrouillée plus longtemps).
  'plan-deux-fois': { sql: (s) => remplace(s, "  apres := sauvegarde.vrm_numerotation_bilan(p_owner, p_prefixe);", "  apres := sauvegarde.vrm_numerotation_mesurer(p_owner, p_prefixe, p_coupure);", 'plan-deux-fois') },
  // Les dressings figés avant la coupure ne sont plus signalés.
  'dressings-muets': { sql: (s) => remplace(s, "                               'dressings', sauvegarde.vrm_numerotation_dressings(p_owner, p_coupure))", "                               'dressings', null)", 'dressings-muets') },
};

if (PROUVE) {
  let rouges = 0; const noms = Object.keys(MUTATIONS);
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /mg) || []).length;
    const sautee = /audit NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !sautee;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté ou ancre introuvable' : 'RESTE VERTE : le contrôle ne mord pas')}`);
    if (bon) for (const l of r.stdout.split('\n').filter(x => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 220));
    else if (sautee) console.log('      ' + (r.stdout + r.stderr).split('\n').filter(x => /ancre|NON/.test(x)).slice(0, 1).join(''));
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
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c track_functions=all`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}
const version = spawnSync(PSQL, ['-h', DIR, '-p', PORT, '-U', 'postgres', '-X', '-At', '-c', 'show server_version'], { encoding: 'utf8' }).stdout.trim();
console.log(`(Postgres ${version} jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);

// ── PSQL ─────────────────────────────────────────────────────────────────
const psql = (db, sql, o = {}) => {
  const a = ['-h', DIR, '-p', PORT, '-U', 'postgres', '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'J=' + J, '-v', 'T=' + T];
  if (o.niv != null) a.push('-v', 'NIV=' + o.niv);
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


const nouvelleBase = (db, niv = 0) => {
  Q('postgres', `drop database if exists ${db}`); Q('postgres', `create database ${db}`);
  let r = psql(db, null, { fichier: MIN }); if (!r.ok) throw new Error('supabase-min : ' + r.err.slice(0, 300));
  r = psql(db, null, { fichier: FX }); if (!r.ok) throw new Error('fixtures : ' + r.err.slice(0, 300));
  if (niv > 0) { r = psql(db, null, { fichier: SCEN, niv }); if (!r.ok) throw new Error('scénario : ' + r.err.slice(0, 300)); }
  // (banc seulement) des instantanés que le rôle du navigateur peut relire, pour
  // simuler l'appareil chargé AVANT la conversion.
  Q(db, `create table public.banc_snap (nom text primary key, data jsonb); grant select on public.banc_snap to authenticated;`);
};
const installer = (db) => {
  const r = psql(db, null, { fichier: FMIG });
  if (r.ok && m && m.apres) Q(db, m.apres);
  return r;
};
const MESURE = (db) => Q(db, `select sauvegarde.vrm_numerotation_mesurer('${J}', 'B', '${COUPURE}')::text`);
const archiver = (db, attendu) => psql(db, `select sauvegarde.vrm_numerotation_archiver('${J}', 'B', '${COUPURE}', ${attendu === null ? 'null' : `'${attendu.replace(/'/g, "''")}'::jsonb`})::text`);
const snap = (db, nom, id = 'main') => Q(db, `insert into public.banc_snap select '${nom}', data from public.app_data where owner = '${J}' and id = '${id}' on conflict (nom) do update set data = excluded.data`);
const S = (nom) => `(select data from public.banc_snap where nom = '${nom}')`;
const champ = (db, sql) => Q(db, sql);
const mainJ = (db) => QJ(db, `select data from public.app_data where owner = '${J}' and id = 'main'`);
// Le VRAI calcul du prochain numéro d'App.jsx (cleNum, NUM_OK, entreePool,
// prochainLibre, et la construction de takenNums du composant), sur la ligne.
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
const fiche = (d, id) => ((d.vinted_annonce_numeros || {})[id] || {}).numero;
const vente = (d, tx) => ((d.vinted_sale_overrides || {})[tx] || {}).numero;
const pool = (d) => (d.vinted_used_numeros || []).map(x => String(x));

// ════════════════════════════════════════════════════════════════════════════
console.log('A. AUCUNE NOUVELLE ANNONCE (la base telle qu\'elle était le 9 octobre)');
const DB = 'renum_a';
essaie('préparer la base inventée', () => nouvelleBase(DB));
const AVANT = {};
essaie('mémoriser l\'avant', () => {
  AVANT.main = md5(DB, 'main'); AVANT.T = md5(DB, 'main', T); AVANT.room = md5(DB, 'vrm_room');
  AVANT.stock = Q(DB, `select md5((data -> 'vinted_stock_vinted')::text) from public.app_data where owner = '${J}' and id = 'main'`);
  AVANT.pdf = Q(DB, `select md5(string_agg(data ->> 'pdfB64', '' order by id)) from public.app_data where owner = '${J}' and id like 'email_bord_%'`);
  AVANT.lbc = md5(DB, 'lbc_listings'); AVANT.journal = md5(DB, 'email_journal'); AVANT.ebayl = md5(DB, 'ebay_listings'); AVANT.ebayp = md5(DB, 'ebay_programmees');
  AVANT.emailsMaj = Q(DB, `select md5(string_agg(updated_at::text, ',' order by id)) from public.app_data where owner = '${J}' and id like 'email\\_%'`);
  snap(DB, 'avant'); snap(DB, 'room_avant', 'vrm_room');
});

console.log('\n1. L\'INSTALLATION (le fichier seul) ne convertit RIEN');
essaie('installer', () => {
  const r = installer(DB);
  dit(r.ok, 'le fichier s\'applique (une transaction, aucune erreur)', r.ok ? '' : r.err.slice(0, 300));
  dit(md5(DB, 'main') === AVANT.main, 'la ligne main est intacte après l\'installation');
  dit(Q(DB, "select string_agg(tgname, ',' order by tgname) from pg_trigger where tgrelid = 'public.app_data'::regclass and not tgisinternal")
      === (m && m.apres && /garage/.test(m.apres) ? 'vrm_garde_numeros,vrm_meta_maj,vrm_noter_ecriture' : 'vrm_garde_garage,vrm_garde_numeros,vrm_meta_maj,vrm_noter_ecriture'),
    'les garde-fous sont posés, avant `vrm_meta_maj` (ordre alphabétique : `meta` est calculé sur la ligne finale)');
  dit(Q(DB, "select has_schema_privilege('authenticated', 'sauvegarde', 'usage')") === 'f', 'le navigateur n\'a aucun accès au schéma `sauvegarde`');
  dit(installer(DB).ok, 'réinstaller le fichier une seconde fois ne lève rien');
});
essaie('avant la coupure', () => {
  const r = navigateur(DB, 'main', `data || '{"vrm_numerotation":{"version":9,"archive":"Z"}}'::jsonb`);
  dit(r.ok && Q(DB, `select data ? 'vrm_numerotation' from public.app_data where owner = '${J}' and id = 'main'`) === 'f',
    'un navigateur ne peut pas POSER de marqueur (il appartient au serveur)', r.ok ? '' : r.err.slice(0, 200));
  const r2 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') - 0)`);
  dit(!r2.ok && refus(r2) === 'vrm_pool_retreci', 'déjà avant la coupure, le pool ne rétrécit pas depuis un navigateur (§5, append-only)', refus(r2) || 'accepté');
  dit(md5(DB, 'main') === AVANT.main, 'et la ligne main n\'a pas bougé');
});

console.log('\n2. LA MESURE, et ce qui ARRÊTE la conversion');
let ATTENDU = null;
essaie('mesure', () => {
  ATTENDU = MESURE(DB);
  const a = JSON.parse(ATTENDU);
  dit(a.vinted_used_numeros.nu === 552 && a.vinted_used_numeros.lettres === 1 && a.poolCles === 553 && a.poolMax === 552,
    'pool : 552 numéros en chiffres + 1 déjà à lettres (C3), max 552', JSON.stringify(a.vinted_used_numeros));
  dit(a.plan && a.plan.nouvelles.length === 0, 'aucune annonce mise en ligne après la coupure', JSON.stringify(a.plan && a.plan.nouvelles));
  dit(JSON.stringify(a.plan.sources) === JSON.stringify({ numberedAt: 113, listingDates: 19, dressingPhoto: 270 }),
    'la mesure dit par quelle source chaque fiche est datée (dressing 270 · dates captées 19 · numberedAt 113)', JSON.stringify(a.plan.sources));
  dit(a.vinted_annonce_numeros.nu === 401 && a.vinted_sale_overrides.nu === 500 && a.vinted_sale_overrides.lot === 1 && a.emails.nus === 121 && a.garage3d.nu === 33,
    'fiches 401 · ventes 500 + 1 lot · 121 emails · 33 cartons au garage (dont la pile sans liste)', `${a.vinted_annonce_numeros.nu}/${a.vinted_sale_overrides.nu}/${a.emails.nus}/${a.garage3d.nu}`);
  // (relecture du 11 octobre) Deux de ses comptes avaient un dressing figé au
  // 8 octobre : le plan n'y voyait aucune annonce republiée, sans le dire.
  const dr = a.dressings || {};
  dit(JSON.stringify(dr.avantCoupure) === '["compte_un (2026-10-08T22:29:22.465Z)","compte_jamais (jamais capté)"]'
      && (dr.comptes || []).length === 2 && !(dr.comptes || []).some((c) => c.login === 'compte_autre_vendeur'),
    'la mesure NOMME les comptes dont le dressing a été capté avant la coupure (ou jamais) — ses comptes seulement', JSON.stringify(dr.avantCoupure));
});
essaie('essai annulé', () => {
  const r = psql(DB, `begin; select sauvegarde.vrm_numerotation_archiver('${J}', 'B', '${COUPURE}', '${ATTENDU.replace(/'/g, "''")}'::jsonb); rollback;`);
  dit(r.ok, 'l\'essai dans une transaction ANNULÉE passe', r.ok ? '' : r.err.slice(0, 300));
  dit(md5(DB, 'main') === AVANT.main && md5(DB, 'vrm_room') === AVANT.room, 'après ROLLBACK : main et le garage sont intacts');
  dit(Q(DB, 'select (select count(*) from sauvegarde.numerotation_013) || \'/\' || (select count(*) from sauvegarde.numerotation_faite)') === '0/0',
    'après ROLLBACK : aucune copie, aucun registre');
});
essaie('mesure périmée', () => {
  const r = psql(DB, `begin; update public.app_data set data = jsonb_set(jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '553'::jsonb),
      '{vinted_annonce_numeros,8000000099}', '{"numero":"553","auto":true,"numberedAt":"2026-10-10T08:00:00.000Z"}') where owner = '${J}' and id = 'main';
    select sauvegarde.vrm_numerotation_archiver('${J}', 'B', '${COUPURE}', '${ATTENDU.replace(/'/g, "''")}'::jsonb); commit;`);
  dit(!r.ok && /la base a changé depuis la mesure/.test(r.err), 'une paire numérotée entre la mesure et l\'application ⇒ refus nommé', r.err.slice(0, 160));
  dit(md5(DB, 'main') === AVANT.main, 'et rien ne bouge');
});
essaie('forme inconnue', () => {
  const r = psql(DB, `begin; update public.app_data set data = jsonb_set(data, '{vinted_annonce_numeros,9000000001,numero}', '"12a"') where owner = '${J}' and id = 'main';
    select sauvegarde.vrm_numerotation_archiver('${J}', 'B', '${COUPURE}', sauvegarde.vrm_numerotation_mesurer('${J}', 'B', '${COUPURE}')); commit;`);
  // Le PREMIER garde-fou (avant toute écriture) — le second, après conversion,
  // rattraperait aussi, mais on prouve celui-ci : « rien n'est fait ».
  dit(!r.ok && /forme inconnue \(ni un numéro/.test(r.err), 'un numéro de forme inconnue (« 12a ») ARRÊTE tout AVANT d\'écrire : on ne devine pas', r.err.slice(0, 160));
  const r2 = archiver(DB, null);
  dit(!r2.ok && /mesure « attendu » est obligatoire/.test(r2.err), 'sans la mesure, rien ne se fait', r2.err.slice(0, 120));
  const r3 = psql(DB, `select sauvegarde.vrm_numerotation_archiver('${J}', 'B', now() + interval '1 day', '{}'::jsonb)`);
  dit(!r3.ok && /coupure invalide/.test(r3.err), 'une coupure dans le futur est refusée', r3.err.slice(0, 120));
  dit(md5(DB, 'main') === AVANT.main, 'et rien ne bouge');
});

console.log('\n3. L\'APPLICATION');
let RAP = null;
essaie('appliquer', () => {
  Q(DB, 'select pg_stat_reset()');
  const r = archiver(DB, ATTENDU);
  // `main` reste verrouillée pendant toute la conversion : le plan (le plus cher)
  // n'y est calculé qu'UNE fois (relecture du 11 octobre : il l'était deux fois).
  const plans2 = Q(DB, "select coalesce((select calls from pg_stat_user_functions where funcname = 'vrm_numerotation_plan'), 0)");
  dit(r.ok && plans2 === '1', 'le plan n\'est calculé qu\'UNE fois pendant la conversion (`main` verrouillée)', `${plans2} appel(s)`);
  dit(r.ok, 'la conversion passe', r.ok ? '' : r.err.slice(0, 400));
  RAP = r.ok ? JSON.parse(r.out) : null;
  dit(RAP && RAP.deja === false && RAP.version === 2 && RAP.nouvelles.length === 0 && RAP.contradictions === 0, 'rapport : version 2, aucune nouvelle, aucune contradiction');
});
essaie('main convertie', () => {
  const d = mainJ(DB);
  const p = pool(d);
  dit(p.length === 553 && p.filter(x => /^B\d+$/.test(x)).length === 552 && p.includes('C3') && !p.some(x => /^\d+$/.test(x)),
    'pool : B1…B552 + C3, plus aucun numéro en chiffres', `${p.length} · ${p.slice(0, 3)}…`);
  const fi = Object.values(d.vinted_annonce_numeros);
  dit(fi.filter(e => /^B\d+$/.test(e.numero)).length === 401 && fiche(d, '9000000999') === 'C3', 'fiches : 401 en B, la C3 intacte');
  dit(fi.filter(e => e.auto).length === 384 && fi.filter(e => e.buyPrice != null).length === 8 && fi.filter(e => e.mp).length === 4,
    'fiches : auto, prix d\'achat et choix des places gardés');
  dit(Object.values(d.vinted_sale_overrides).filter(v => /^B\d+$/.test(v.numero)).length === 500 && vente(d, '22000000999') === 'B40+B41'
      && Object.values(d.vinted_sale_overrides).filter(v => v.autoShip).length === 132, 'ventes : 500 en B, le lot « 40+41 » → « B40+B41 », autoShip gardé');
  dit(JSON.stringify(Object.keys(d.vinted_buyprice_by_num)) === '["B385"]', 'prix d\'achat par N° : « 385 » → « B385 »');
  dit(Object.keys(d.vinted_pairs_lost).length === 26 && Object.keys(d.vinted_pairs_lost).every(k => /^B\d+$/.test(k)), 'paires retirées : 26 clés en B');
  dit(JSON.stringify(d.vrm_lbc_liens) === '{"2900000001":"B233","2900000002":"B250","2900000003":"B271"}', 'liens Leboncoin : valeurs en B, identifiants d\'annonce intacts');
  dit(d.vinted_bord_links['22000000400'].numero === 'B77' && d.vinted_offvinted_buys[0].numero === 'B88' && d.vinted_offvinted_buys[1].numero === ''
      && JSON.stringify(d.vinted_garage_grid) === '{"A1":["B9"],"A2":[]}', 'bordereau relié, achat hors Vinted, garage 2D : en B (le vide reste vide)');
  dit(JSON.stringify(Object.keys(d.vrm_inventaire_pointage.pointes).sort()) === '["B116","B14"]' && d.vrm_inventaire_pointage.debut === null,
    'pointage du stock : clés en B, son début remis à zéro (il ne dit plus rien des nouvelles paires)');
  dit(d.vrm_num_prefixe === '', 'nouvelles paires en chiffres (vrm_num_prefixe = "")');
  const mk = d.vrm_numerotation || {};
  dit(mk.version === 2 && mk.archive === 'B' && mk.coupure === '2026-10-09T00:00:00.000Z' && mk.renum && Object.keys(mk.renum).length === 0 && mk.nouvelles === 0 && !!mk.appliqueLe,
    'marqueur : { version 2, coupure T, appliqueLe, archive B, renum {} }', JSON.stringify(mk).slice(0, 200));
  dit(JSON.stringify(mk.lbcAnnonces) === '{"2900000001": {"233": "B233", "266": "B266"}, "2900000002": {"250": "B250"}, "2900000003": {"271": "B271"}}'.replace(/: /g, ':').replace(/, /g, ',')
      && JSON.stringify(mk.ebayAnnonces) === '{"3":{"12":"B12"},"7":{"40":"B40"},"9":{"41":"B41"}}',
    'marqueur : les annonces Leboncoin et eBay (en ligne ET programmées) qui portaient un N°, par leur IDENTIFIANT, avec ce que devient CE numéro', JSON.stringify(mk.ebayAnnonces) + ' ' + JSON.stringify(mk.lbcAnnonces));
  dit(Q(DB, `select md5((data -> 'vinted_stock_vinted')::text) from public.app_data where owner = '${J}' and id = 'main'`) === AVANT.stock, 'l\'ancien catalogue (stock_vinted) n\'est pas touché');
  dit(prochain(d) === '1', 'le VRAI `prochainLibre` d\'App.jsx sur la ligne convertie rend « 1 »', prochain(d));
});
essaie('garage, local, brouillons', () => {
  const g = QJ(DB, `select data from public.app_data where owner = '${J}' and id = 'vrm_room'`);
  const it = (id) => g.rooms[0].items.find(x => x.id === id);
  dit(it('f1').nums.length === 26 && it('f1').nums[24] === 'B143' && it('f1').nums[25] === 'B143' && it('f1').nums[0] === 'B116' && !('start' in it('f1')),
    'pile : 26 boîtes en B (les deux « 143 » restent deux boîtes), `start` retiré');
  dit(JSON.stringify(it('f5').nums) === '["B600","B601","B602"]' && !('start' in it('f5')), 'une pile sans liste (numérotée depuis `start`) reçoit sa liste en B');
  dit(it('f6').num === 'B88' && it('f2').slots['7_3'][0] === 'B15' && it('f3').slots['1_0'][0] === 'B14' && g.numerotation === 2,
    'boîte seule, cases en B, et le garage porte la version 2');
  const l = QJ(DB, `select data from public.app_data where owner = '${J}' and id = 'vrm_local'`);
  dit(l.photos[0].pins[0].numero === 'B116' && l.photos[0].pins[1].numero === '', '« Mon local en photo » : repère en B');
  const b = QJ(DB, `select data from public.app_data where owner = '${J}' and id = 'ebay_brouillons'`);
  dit(b.items['b-1'].numero === 'B30' && !('numero' in b.items['b-2']), 'brouillons eBay : en B');
});
essaie('emails', () => {
  dit(Q(DB, `select count(*) filter (where data ->> 'numero' ~ '^B[0-9]+(\\+B[0-9]+)*$') || '/' || count(*) filter (where meta ->> 'numero' ~ '^B') from public.app_data where owner = '${J}' and id ~ '^email_(bord|sale|final)_'`) === '119/119',
    'emails : 118 bordereaux + le lot en B, et `meta` suit (déclencheur vrm_meta)');
  dit(Q(DB, `select string_agg(id || '=' || (data ->> 'numero') || '|' || (data ->> 'numeroTitre'), ',' order by id) from public.app_data where owner = '${J}' and id in ('email_sale_aaaa', 'email_final_cccc')`)
      === 'email_final_cccc=|2079,email_sale_aaaa=|99001', 'un nombre lu dans un TITRE (99001, 2079 : hors pool) ne devient pas un faux B : il passe dans `numeroTitre`');
  dit(Q(DB, `select md5(string_agg(data ->> 'pdfB64', '' order by id)) from public.app_data where owner = '${J}' and id like 'email_bord_%'`) === AVANT.pdf
      && Q(DB, `select md5(string_agg(updated_at::text, ',' order by id)) from public.app_data where owner = '${J}' and id like 'email\\_%'`) === AVANT.emailsMaj,
    'les PDF et `updated_at` des emails ne bougent pas');
  dit(md5(DB, 'lbc_listings') === AVANT.lbc && md5(DB, 'email_journal') === AVANT.journal && md5(DB, 'ebay_listings') === AVANT.ebayl && md5(DB, 'ebay_programmees') === AVANT.ebayp && md5(DB, 'main', T) === AVANT.T,
    'captures Leboncoin/eBay, journal du serveur et l\'autre vendeur : intacts');
  dit(Q(DB, `select count(*) || '/' || count(*) filter (where data ? 'pdfB64') from sauvegarde.numerotation_013`) === '125/0', 'copie : main, garage, local, brouillons + 121 emails (sans PDF)');
  dit(Q(DB, `select md5(data::text) from sauvegarde.numerotation_013 where id = 'main'`) === AVANT.main, 'la copie de main est l\'avant exact');
});

console.log('\n4. RELANCÉE, ELLE NE FAIT RIEN');
essaie('rejouer', () => {
  const avant = md5(DB, 'main');
  const r = archiver(DB, MESURE(DB));
  dit(r.ok && JSON.parse(r.out).deja === true, 'rend deja = true', r.ok ? '' : r.err.slice(0, 200));
  dit(md5(DB, 'main') === avant && Q(DB, `select count(*) from public.app_data where owner = '${J}' and data::text ~ '"BB[0-9]'`) === '0', 'main identique, aucun « BB »');
});

console.log('\n5. LES EMAILS RANGÉS PENDANT LA CONVERSION');
essaie('rattraper', () => {
  Q(DB, `insert into public.app_data (owner, id, data) values
    ('${J}', 'email_bord_pendant', jsonb_build_object('numero', '17', 'transaction', '22000001234', 'receivedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    ('${J}', 'email_bord_bien_apres', jsonb_build_object('numero', '2', 'transaction', '22000001235', 'receivedAt', to_char((clock_timestamp() + interval '2 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))`);
  const r = psql(DB, `select sauvegarde.vrm_numerotation_rattraper('${J}', 60)::text`);
  dit(r.ok && JSON.parse(r.out).rattrapes === 1, 'un seul email rattrapé', r.ok ? r.out : r.err.slice(0, 200));
  dit(Q(DB, `select string_agg(id || '=' || (data ->> 'numero'), ',' order by id) from public.app_data where owner = '${J}' and id in ('email_bord_pendant', 'email_bord_bien_apres')`)
      === 'email_bord_bien_apres=2,email_bord_pendant=B17', 'celui rangé PENDANT la conversion passe en B17 ; celui d\'une nouvelle paire, bien après, reste « 2 »');
});

console.log('\n6. LES GARDE-FOUS — un navigateur resté ouvert');
essaie('appareil périmé', () => {
  snap(DB, 'apres');
  const r = navigateur(DB, 'main', S('avant'));
  dit(!r.ok && refus(r) === 'vrm_pool_retreci', 'il renvoie la ligne d\'AVANT : refusé (vrm_pool_retreci)', refus(r) || 'accepté');
  const r2 = navigateur(DB, 'main', `data || jsonb_build_object('vinted_annonce_numeros', ${S('avant')} -> 'vinted_annonce_numeros', 'vinted_pairs_lost', ${S('avant')} -> 'vinted_pairs_lost')`);
  dit(!r2.ok && refus(r2) === 'vrm_numeros_perimes', 'pool à jour mais FICHES d\'avant (état React périmé) : refusé (vrm_numeros_perimes) — critique T5', refus(r2) || 'accepté');
  const r3 = navigateur(DB, 'main', `data || jsonb_build_object('vinted_buyprice_by_num', ${S('avant')} -> 'vinted_buyprice_by_num')`);
  dit(!r3.ok && refus(r3) === 'vrm_numeros_perimes', 'pool à jour mais prix d\'achat par N° d\'avant (« 385 » au lieu de « B385 ») : refusé', refus(r3) || 'accepté');
  dit(md5(DB, 'main') === Q(DB, `select md5(data::text) from public.banc_snap where nom = 'apres'`), 'et la ligne n\'a pas bougé');
});
essaie('appareil rechargé', () => {
  const r = navigateur(DB, 'main', `jsonb_set(jsonb_set(data - 'vrm_numerotation', '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[1]'::jsonb),
      '{vinted_annonce_numeros,8100000001}', '{"numero":"1","auto":true,"numberedAt":"2026-10-10T12:00:00.000Z"}')`);
  dit(r.ok, 'il numérote sa nouvelle paire « 1 » : accepté', r.ok ? '' : r.err.slice(0, 200));
  const d = mainJ(DB);
  dit(fiche(d, '8100000001') === '1' && d.vrm_numerotation && d.vrm_numerotation.version === 2, 'la paire 1 est rangée, le marqueur oublié par le code est recopié');
  const r2 = navigateur(DB, 'main', `jsonb_set(data, '{vrm_numerotation}', '{"version":1,"archive":"Z"}')`);
  dit(r2.ok && mainJ(DB).vrm_numerotation.version === 2, 'un navigateur ne peut pas CHANGER le marqueur (critique T2)', r2.ok ? '' : r2.err.slice(0, 120));
});
essaie('deux appareils', () => {
  // B a été chargé AVANT que A ne numérote 8100000001 : il donne « 1 » à une autre paire.
  const r = navigateur(DB, 'main', `jsonb_set(jsonb_set(${S('apres')}, '{vinted_used_numeros}', (${S('apres')} -> 'vinted_used_numeros') || '[1]'::jsonb),
      '{vinted_annonce_numeros,8100000002}', '{"numero":"1","auto":true}')`);
  dit(!r.ok && refus(r) === 'vrm_fiche_perdue', 'le second appareil efface la paire 1 du premier : refusé (vrm_fiche_perdue) — critique T1', refus(r) || 'accepté');
  const r2 = navigateur(DB, 'main', `jsonb_set(data #- '{vinted_annonce_numeros,8100000001}', '{vinted_annonce_numeros,8100000003}', '{"numero":"1","auto":false,"repriseDe":"8100000001"}')`);
  dit(r2.ok, 'une fiche qui en REMPLACE une autre en le disant (`repriseDe`) : acceptée', r2.ok ? '' : r2.err.slice(0, 160));
  const r3 = navigateur(DB, 'main', `jsonb_set(data, '{vrm_num_prefixe}', '"B"')`);
  dit(!r3.ok && refus(r3) === 'vrm_prefixe_archive', 'choisir « B » pour les nouveaux numéros : refusé (c\'est la série des anciens)', refus(r3) || 'accepté');
  const r4 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_annonce_numeros,9000000001}', (data -> 'vinted_annonce_numeros' -> '9000000001') || jsonb_build_object('numero', '700', 'manuelAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
       || jsonb_build_object('vinted_used_numeros', (data -> 'vinted_used_numeros') || '[700]'::jsonb)`);
  dit(r4.ok, 'une saisie À LA MAIN après la conversion (`manuelAt`) passe : c\'est son geste', r4.ok ? '' : r4.err.slice(0, 160));
  // (relecture du 11 octobre) Ces trois règles n'étaient prouvées par rien :
  const tx = Object.keys(mainJ(DB).vinted_sale_overrides).find((k) => /^B\d+$/.test(String(mainJ(DB).vinted_sale_overrides[k].numero)));
  const vb = mainJ(DB).vinted_sale_overrides[tx].numero;
  const r6 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_sale_overrides,${tx},numero}', '"${vb.slice(1)}"')`);
  dit(!r6.ok && refus(r6) === 'vrm_numeros_perimes', `une VENTE « ${vb} » qui repasse à « ${vb.slice(1)} » (écran d'avant) : refusée`, refus(r6) || 'accepté');
  const r7 = navigateur(DB, 'main', `jsonb_set(data, '{vrm_lbc_liens,2900000001}', '"233"')`);
  dit(!r7.ok && refus(r7) === 'vrm_numeros_perimes', 'un LIEN Leboncoin « B233 » qui repasse à « 233 » : refusé', refus(r7) || 'accepté');
  const r8 = navigateur(DB, 'main', `jsonb_set(data, '{vinted_annonce_numeros,9000000002}', (data -> 'vinted_annonce_numeros' -> '9000000002') || jsonb_build_object('numero', substr(data -> 'vinted_annonce_numeros' -> '9000000002' ->> 'numero', 2), 'manuelAt', '2026-10-09T01:00:00.000Z'))`);
  dit(!r8.ok && refus(r8) === 'vrm_numeros_perimes', 'une saisie « à la main » datée d\'APRÈS la coupure mais d\'AVANT la conversion (un appareil périmé) ne fait pas repasser B→chiffres', refus(r8) || 'accepté');
  const r5 = psql(DB, `set role service_role; update public.app_data set data = jsonb_set(data, '{vinted_used_numeros}', '[]') where owner = '${T}' and id = 'main';`);
  dit(r5.ok, 'le serveur (service_role) n\'est pas bridé', r5.ok ? '' : r5.err.slice(0, 120));
});
essaie('garage', () => {
  const r = navigateur(DB, 'vrm_room', `data - 'numerotation'`);
  dit(!r.ok && refus(r) === 'vrm_garage_perime', 'le code d\'aujourd\'hui (qui jette `numerotation`) ne peut plus écrire le garage : refusé', refus(r) || 'accepté');
  const r2 = navigateur(DB, 'vrm_room', `jsonb_set(${S('room_avant')}, '{numerotation}', '2')`);
  dit(!r2.ok && refus(r2) === 'vrm_garage_perime', 'une copie d\'avant estampillée de la bonne version (29 cartons repassent en chiffres) : refusée', refus(r2) || 'accepté');
  const r3 = navigateur(DB, 'vrm_room', `jsonb_set(data, '{active}', '"r2"')`);
  dit(r3.ok, 'un garage à jour (changer de pièce) : accepté', r3.ok ? '' : r3.err.slice(0, 160));
  const r4 = navigateur(DB, 'vrm_room', `jsonb_set(data, '{rooms,0,items,2,slots,1_0}', '["14"]')`);
  dit(r4.ok, 'changer le numéro d\'UN carton (B14 → 14, son geste) : accepté', r4.ok ? '' : r4.err.slice(0, 160));
});

console.log('\n7. LE RETOUR ARRIÈRE');
essaie('refusé après un numéro neuf', () => {
  const r = psql(DB, `select sauvegarde.vrm_numerotation_annuler('${J}')`);
  dit(!r.ok && /REFUSÉ/.test(r.err), 'une nouvelle paire a un numéro : le retour arrière est REFUSÉ', r.err.slice(0, 160));
});
const DB2 = 'renum_r';
essaie('retour ciblé', () => {
  nouvelleBase(DB2);
  // SA forme réelle (mesurée le 11 octobre) : AUCUNE ligne `ebay_brouillons`.
  // Une ligne absente valait « des numéros ont bougé » et le retour arrière
  // était refusé (relecture du 11 octobre).
  Q(DB2, `delete from public.app_data where owner = '${J}' and id = 'ebay_brouillons'`);
  dit(installer(DB2).ok, 'installation');
  const avant = Q(DB2, `select sauvegarde.vrm_projection(data)::text from public.app_data where owner = '${J}' and id = 'main'`);
  const room = md5(DB2, 'vrm_room');
  const r = archiver(DB2, MESURE(DB2));
  dit(r.ok, 'conversion', r.ok ? '' : r.err.slice(0, 200));
  // Un geste SANS numéro fait après : un colis coché « posté ». Et un brouillon
  // eBay SANS numéro créé après (une ligne `[]` vaut une ligne absente).
  Q(DB2, `update public.app_data set data = jsonb_set(data, '{vinted_ship_done,22000000011}', 'true') where owner = '${J}' and id = 'main'`);
  Q(DB2, `insert into public.app_data (owner, id, data) values ('${J}', 'ebay_brouillons', '{"items":{"b-9":{"titre":"brouillon sans numéro"}}}')`);
  const a = psql(DB2, `select sauvegarde.vrm_numerotation_annuler('${J}')::text`);
  dit(a.ok, 'retour arrière', a.ok ? '' : a.err.slice(0, 300));
  const d = mainJ(DB2);
  dit(Q(DB2, `select sauvegarde.vrm_projection(data)::text from public.app_data where owner = '${J}' and id = 'main'`) === avant, 'tous les numéros sont revenus exactement');
  dit(d.vinted_ship_done && d.vinted_ship_done['22000000011'] === true, 'le colis coché APRÈS la conversion est gardé (retour CIBLÉ, pas une ligne entière)');
  dit(d.vrm_numerotation && d.vrm_numerotation.annule === true && d.vrm_numerotation.version === 3, 'marqueur « annulé », version 3 (un appareil chargé pendant la coupure se recharge)');
  const g = QJ(DB2, `select data from public.app_data where owner = '${J}' and id = 'vrm_room'`);
  const it = (id) => g.rooms[0].items.find(x => x.id === id);
  dit(it('f1').start === 116 && it('f1').nums[0] === '116' && !('nums' in it('f5')) && it('f5').start === 600 && g.numerotation === 3, 'garage : numéros et `start` revenus, version 3');
  dit(Q(DB2, `select (data ->> 'numero') || '|' || coalesce(data ->> 'numeroTitre', '∅') from public.app_data where owner = '${J}' and id = 'email_sale_aaaa'`) === '99001|∅', 'emails : leur numéro d\'avant, exactement');
  const r2 = archiver(DB2, MESURE(DB2));
  dit(r2.ok && JSON.parse(r2.out).deja === false && JSON.parse(r2.out).version === 4, 'après un retour arrière, la conversion se refait (version 4)', r2.ok ? '' : r2.err.slice(0, 200));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\nB. TROIS ANNONCES REPUBLIÉES AVANT LA MIGRATION, NUMÉROTÉES 553-555');
const DBB = 'renum_b';
essaie('base', () => {
  nouvelleBase(DBB, 1);
  // SA forme (mesurée le 11 octobre) : ses DEUX annonces eBay portent le numéro
  // PROVISOIRE donné après la coupure (« VRM-553 », « VRM-559 »). Ici : l'annonce
  // eBay et une annonce Leboncoin de la paire A (553 → 3).
  Q(DBB, `update public.app_data set data = jsonb_set(data, '{items}', (data -> 'items') || '[{"itemId":"128127336988","sku":"VRM-553"}]'::jsonb) where owner = '${J}' and id = 'ebay_listings';
          update public.app_data set data = jsonb_set(data, '{items,2900000553}', '{"id":"2900000553","ref":"553","subject":"Nouvelle inventée A n553"}'::jsonb) where owner = '${J}' and id = 'lbc_listings'`);
  dit(installer(DBB).ok, 'installation');
});
essaie('plan', () => {
  const a = JSON.parse(MESURE(DBB));
  const n = a.plan.nouvelles.map(x => `${x.id}:${x.avant}→${x.apres}`).join(',');
  dit(n === '8000000002:554→1,8000000003:555→2,8000000001:553→3', 'dans l\'ORDRE DE MISE EN LIGNE (08:10, 08:20, 08:30), pas dans l\'ordre des 553-555', n);
  dit(JSON.stringify(a.plan.sourcesNouvelles) === '{"dressingPhoto":3}', 'datées par le dressing capté (heure de dépôt de la photo)', JSON.stringify(a.plan.sourcesNouvelles));
  dit(a.plan.nouvellesPasEnLigne === 0 && a.plan.nouvelles.every((x) => x.enLigne === true), 'le plan dit que les trois sont EN LIGNE (vues ouvertes dans une capture)', `${a.plan.nouvellesPasEnLigne}`);
  snap(DBB, 'avant');
  const r = archiver(DBB, JSON.stringify(a));
  dit(r.ok, 'conversion', r.ok ? '' : r.err.slice(0, 300));
  const d = mainJ(DBB);
  dit(fiche(d, '8000000002') === '1' && fiche(d, '8000000003') === '2' && fiche(d, '8000000001') === '3', 'les trois annonces republiées portent 1, 2, 3');
  const p = pool(d);
  dit(['1', '2', '3'].every(x => p.includes(x)) && !p.some(x => /^B?55[345]$/.test(x)) && p.filter(x => /^B\d+$/.test(x)).length === 552,
    'pool : B1…B552 + 1, 2, 3 — les numéros provisoires 553-555 en sont SORTIS (jamais écrits sur un carton)');
  dit(JSON.stringify(d.vrm_numerotation.renum) === '{"553":"3","554":"1","555":"2"}', 'marqueur : renum { 553→3, 554→1, 555→2 }', JSON.stringify(d.vrm_numerotation.renum));
  dit(prochain(d) === '4', 'le VRAI `prochainLibre` d\'App.jsx donne « 4 » à la paire suivante', prochain(d));
  // (relecture du 11 octobre) « VRM-553 » était lu « B553 » — une paire qui
  // n'existe pas : l'anti double vente eBay perdait ses deux vraies annonces.
  const mk = d.vrm_numerotation || {};
  dit(JSON.stringify((mk.ebayAnnonces || {})['128127336988']) === '{"553":"3"}' && JSON.stringify((mk.ebayAnnonces || {})['3']) === '{"12":"B12"}',
    'marqueur : l\'annonce eBay « VRM-553 » (numéro donné après la coupure) désigne la paire 3 ; « VRM-12 » (ancien) la B12', JSON.stringify(mk.ebayAnnonces));
  dit(JSON.stringify((mk.lbcAnnonces || {})['2900000553']) === '{"553":"3"}', 'marqueur : l\'annonce Leboncoin « ref 553 / n553 » désigne la paire 3', JSON.stringify((mk.lbcAnnonces || {})['2900000553']));
});
essaie('rattraper après des nouvelles paires', () => {
  // Rangés dans la fenêtre : un email de la NOUVELLE paire 1 (même titre que sa
  // fiche) et un email de l'ancienne paire 2 (lu sur la ligne d'avant).
  Q(DBB, `insert into public.app_data (owner, id, data) values
    ('${J}', 'email_bord_nv1', jsonb_build_object('numero', '1', 'article', 'Nouvelle  inventée B', 'transaction', '22000009001', 'receivedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),
    ('${J}', 'email_bord_anc2', jsonb_build_object('numero', '2', 'article', 'Paire inventée 2', 'transaction', '22000009002', 'receivedAt', to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))`);
  const r = psql(DBB, `select sauvegarde.vrm_numerotation_rattraper('${J}', 60)::text`);
  dit(r.ok && JSON.stringify(JSON.parse(r.out).ids) === '["email_bord_anc2"]', 'seul l\'email de l\'ANCIENNE paire 2 est rattrapé', r.ok ? r.out : r.err.slice(0, 200));
  dit(Q(DBB, `select string_agg(id || '=' || (data ->> 'numero'), ',' order by id) from public.app_data where owner = '${J}' and id in ('email_bord_nv1', 'email_bord_anc2')`)
      === 'email_bord_anc2=B2,email_bord_nv1=1', 'la NOUVELLE paire 1 (même titre que sa fiche) garde « 1 » ; l\'ancienne 2 devient « B2 »');
});
essaie('appareil chargé avant', () => {
  const r = navigateur(DBB, 'main', `jsonb_set(data, '{vinted_annonce_numeros,8000000001,numero}', '"553"')`);
  dit(!r.ok && refus(r) === 'vrm_numeros_perimes', 'il réécrit « 553 » sur la fiche devenue « 3 » : refusé (vrm_numeros_perimes)', refus(r) || 'accepté');
  const r2 = archiver(DBB, MESURE(DBB));
  dit(r2.ok && JSON.parse(r2.out).deja === true, 'rejouée : rien ne change');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\nC. LES CAS DE BORD');
const DBC = 'renum_c';
essaie('base', () => {
  nouvelleBase(DBC, 2);
  // (relecture du 11 octobre) Trois ventes d'après la coupure n'ont, chez lui,
  // QUE leur bordereau capté (`harvest_{uid}_label_{tx}` : tx → annonce). Ici :
  // 781 — le bordereau relie la vente à la paire C (555 → 2) ; 782 — seule la
  // COPIE `label_latest` le dit (écartée) ; 783 — `meta.tx` contredit
  // l'identifiant de la ligne (doute : écartée).
  Q(DBC, `update public.app_data set data = jsonb_set(jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[560, 561, 562]'::jsonb),
      '{vinted_sale_overrides}', (data -> 'vinted_sale_overrides') || '{"22000000781":{"numero":"560","autoAssigned":true,"autoShip":true},"22000000782":{"numero":"561","autoAssigned":true,"autoShip":true},"22000000783":{"numero":"562","autoAssigned":true,"autoShip":true}}'::jsonb)
     where owner = '${J}' and id = 'main';
    insert into public.app_data (owner, id, data) values
      ('${J}', 'harvest_1002_label_22000000781', '{"tx":"22000000781","item":"8000000003","uid":"1002","capturedAt":"2026-10-10T21:55:24.680Z","pdfB64":"JVBERi0xLjQK"}'),
      ('${J}', 'harvest_1002_label_latest', '{"tx":"22000000782","item":"8000000002","uid":"1002","capturedAt":"2026-10-10T21:56:24.680Z","pdfB64":"JVBERi0xLjQK"}'),
      ('${J}', 'harvest_1002_label_22000000783', '{"tx":"22000000999","item":"8000000002","uid":"1002","capturedAt":"2026-10-10T21:57:24.680Z","pdfB64":"JVBERi0xLjQK"}')`);
  dit(installer(DBC).ok, 'installation');
});
essaie('plan et conversion', () => {
  const a = JSON.parse(MESURE(DBC));
  const n = a.plan.nouvelles.map(x => `${x.id}→${x.apres}(${x.source})`).join(',');
  dit(n === '8000000002→1(dressingPhoto),8000000003→2(dressingPhoto),8000000001→3(dressingPhoto),8000000005→4(dressingPhoto),8000000004→5(numberedAt)',
    'une annonce sans date lisible est jugée par `numberedAt`, ET LE PLAN LE DIT', n);
  dit(a.plan.nouvellesPasEnLigne === 1 && (a.plan.nouvelles.find((x) => x.id === '8000000004') || {}).enLigne === false,
    'le plan SIGNALE la nouvelle qu\'aucune capture ne montre en ligne (à regarder avant d\'appliquer : une coupure trop tôt numéroterait des annonces supprimées)', `${a.plan.nouvellesPasEnLigne}`);
  dit(a.plan.contradictions === 1 && !a.plan.nouvelles.some(x => x.id === '9000000300'),
    'une fiche numérotée en juillet dont la photo a été redéposée après la coupure reste ANCIENNE (on ne numérote pas une annonce qui n\'existe pas encore) — comptée', `contradictions ${a.plan.contradictions}`);
  const r = archiver(DBC, JSON.stringify(a));
  dit(r.ok, 'conversion', r.ok ? '' : r.err.slice(0, 300));
  const rap = r.ok ? JSON.parse(r.out) : {};
  dit(JSON.stringify(rap.sourcesNouvelles) === '{"numberedAt":1,"dressingPhoto":4}', 'le rapport dit combien de nouvelles par source', JSON.stringify(rap.sourcesNouvelles));
  const d = mainJ(DBC);
  dit(fiche(d, '9000000300') && /^B\d+$/.test(fiche(d, '9000000300')), 'la fiche « contradiction » est en B', fiche(d, '9000000300'));
  dit(fiche(d, '8000000005') === '4' && pool(d).includes('B230'), 'la paire reprise sur son ancien N°230 prend « 4 » ; le B230 reste au pool (il est écrit sur un vieux carton)');
  dit(vente(d, '22000000777') === '3', 'une vente rattachée par sa TRANSACTION à la paire A suit son nouveau numéro (553 → 3)', vente(d, '22000000777'));
  dit(vente(d, '22000000780') === '4', 'une vente rattachée par transaction à la paire reprise (« 230 ») suit la paire, pas la valeur (→ 4, pas B230)', vente(d, '22000000780'));
  dit(vente(d, '22000000778') === '1', 'une vente SANS rattachement qui porte 554 (donné à une seule paire nouvelle) suit cette paire (→ 1)', vente(d, '22000000778'));
  dit(vente(d, '22000000781') === '2', 'une vente reliée par son BORDEREAU capté (tx → annonce C) suit sa paire (560 → 2), comme ses voisines reliées par la transaction', vente(d, '22000000781'));
  dit(vente(d, '22000000782') === 'B561' && vente(d, '22000000783') === 'B562',
    'la copie `label_latest`, et un bordereau dont `meta.tx` contredit sa ligne, ne relient rien (→ B)', `${vente(d, '22000000782')} · ${vente(d, '22000000783')}`);
  dit(d.vinted_buyprice_by_num['3'] === '40' && d.vinted_buyprice_by_num['B385'] === '30' && !('553' in d.vinted_buyprice_by_num), 'prix d\'achat : « 553 » → « 3 », « 385 » → « B385 »');
  dit(Q(DBC, `select string_agg(id || '=' || (data ->> 'numero'), ',' order by id) from public.app_data where owner = '${J}' and id in ('email_bord_22000000777', 'email_bord_22000000779')`)
      === 'email_bord_22000000777=3,email_bord_22000000779=2', 'bordereaux : par transaction (→ 3), par numéro provisoire (555 → 2)');
  dit(prochain(d) === '6', 'la paire suivante reçoit « 6 »', prochain(d));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\nD. DEUX APPAREILS ONT DONNÉ LE MÊME NUMÉRO PROVISOIRE');
const DBD = 'renum_d';
essaie('ambigu', () => {
  nouvelleBase(DBD); dit(installer(DBD).ok, 'installation');
  Q(DBD, `update public.app_data set data = jsonb_set(jsonb_set(jsonb_set(data, '{vinted_used_numeros}', (data -> 'vinted_used_numeros') || '[557]'::jsonb),
      '{vinted_annonce_numeros}', (data -> 'vinted_annonce_numeros') || '{"8200000001":{"numero":"557","auto":true,"numberedAt":"2026-10-10T08:31:00.000Z"},"8200000002":{"numero":"557","auto":true,"numberedAt":"2026-10-10T08:32:00.000Z"}}'::jsonb),
      '{vinted_sale_overrides,22000005570}', '{"numero":"557","autoAssigned":true,"autoShip":true}') where owner = '${J}' and id = 'main';
    insert into public.app_data (owner, id, data) values ('${J}', 'harvest_1003_listings', '{"payload":{"items":[{"id":8200000001,"photo":{"high_resolution":{"timestamp":1791620000}}},{"id":8200000002,"photo":{"high_resolution":{"timestamp":1791620100}}}]}}');`);
  const avant = md5(DBD, 'main');
  const r = archiver(DBD, MESURE(DBD));
  dit(!r.ok && /PLUSIEURS paires nouvelles/.test(r.err), 'une vente qui porte « 557 », donné à DEUX annonces republiées : on ne devine pas laquelle — rien n\'est fait', r.ok ? 'appliquée' : r.err.slice(0, 160));
  dit(md5(DBD, 'main') === avant, 'et rien ne bouge');
  Q(DBD, `update public.app_data set data = data #- '{vinted_sale_overrides,22000005570}' where owner = '${J}' and id = 'main'`);
  const r2 = archiver(DBD, MESURE(DBD));
  const d = mainJ(DBD);
  dit(r2.ok && fiche(d, '8200000001') === '1' && fiche(d, '8200000002') === '2' && !pool(d).some(x => /557/.test(x)),
    'sans cette vente : chacune son numéro (1, 2), et 557 sort du pool', r2.ok ? '' : r2.err.slice(0, 160));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\nE. L\'ESSAI DANS UNE TRANSACTION ANNULÉE (le script remis à celui qui applique)');
const DBE = 'renum_e';
essaie('essai annulé', () => {
  nouvelleBase(DBE, 2);
  const tout = () => Q(DBE, `select md5(string_agg(md5(owner::text || id || data::text), ',' order by owner, id)) from public.app_data`);
  const avant = tout();
  const fab = spawnSync(process.execPath, [path.join(__dirname, 'renum-b/essai-annule.cjs'), '--coupure=' + COUPURE, '--migration=' + FMIG], { encoding: 'utf8', maxBuffer: 64 << 20 });
  dit(fab.status === 0 && /^begin;$/m.test(fab.stdout) && /^rollback;\s*$/m.test(fab.stdout) && !/^commit;$/m.test(fab.stdout),
    'le script d\'essai se fabrique depuis la migration : BEGIN … ROLLBACK, aucun COMMIT', (fab.stderr || '').slice(0, 200));
  const F = path.join(DIR, 'essai.sql'); fs.writeFileSync(F, fab.stdout);
  const r = psql(DBE, null, { fichier: F });
  dit(r.ok, 'l\'essai passe sans erreur', r.ok ? '' : r.err.slice(0, 300));
  const ligne = (r.out || '').split('\n').filter((l) => l.startsWith('{')).pop() || 'null';
  const e = JSON.parse(ligne) || {};
  dit(e.proprietaireTrouve === true && e.rapport && e.rapport.version === 2 && e.marqueur && e.marqueur.archive === 'B',
    'il rend UN rapport : le vendeur trouvé, la conversion (version 2), le marqueur', JSON.stringify(e.rapport || {}).slice(0, 160));
  dit(e.plan && e.plan.nouvellesPasEnLigne === 1 && Array.isArray(e.plan.nouvelles) && e.plan.nouvelles.length === 5,
    'et le plan à relire AVANT d\'appliquer : les 5 nouvelles, dont 1 qu\'aucune capture ne montre en ligne');
  dit(e.attention && JSON.stringify(e.attention.dressingsAvantCoupure) === '["compte_un (2026-10-08T22:29:22.465Z)","compte_jamais (jamais capté)"]',
    'et, À LIRE AVANT D\'APPLIQUER, les comptes dont le dressing date d\'avant la coupure (le plan n\'y voit aucune annonce republiée)', JSON.stringify(e.attention));
  dit(e.poolApres && e.poolApres.enChiffres === 5 && JSON.stringify(e.poolApres.chiffres) === '[1,2,3,4,5]' && e.fichesApres.enChiffres === 5,
    'le pool après : seuls 1 à 5 restent en chiffres', JSON.stringify(e.poolApres));
  dit(tout() === avant, 'après le ROLLBACK, AUCUNE ligne n\'a bougé');
  dit(Q(DBE, "select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname like 'vrm_numerotation%' or (n.nspname = 'public' and p.proname in ('vrm_garde_numeros', 'vrm_garde_garage'))") === '0'
      && Q(DBE, "select count(*) from pg_trigger where tgname like 'vrm_garde%'") === '0'
      && Q(DBE, "select count(*) from pg_tables where schemaname = 'sauvegarde' and tablename like 'numerotation%'") === '0',
    'ni fonction, ni déclencheur, ni table de sauvegarde ne restent installés');
});

console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
process.exit(ko ? 1 : 0);
