#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 025 — LES GROUPES D'ACCOMPAGNEMENT (5 novembre)
//  node scripts/audit-accompagnement-sql.cjs              (le contrôle)
//  node scripts/audit-accompagnement-sql.cjs --prouve     (chaque règle réaffaiblie
//                                                           doit faire passer l'audit au ROUGE)
//  node scripts/audit-accompagnement-sql.cjs --mutation=nom
//  node scripts/audit-accompagnement-sql.cjs --forme      (imprime l'empreinte des tables)
//
//  La migration (supabase/migrations/025-communaute-accompagnement.sql) est
//  EXÉCUTÉE pour de vrai, sur un Postgres JETABLE qui imite la production
//  (scripts/agent-sql/supabase-min.sql + 005, 006, 007, 018, 019, 020 telles
//  quelles). Aucune donnée réelle, aucune connexion à la vraie base. Les rôles
//  sont joués comme PostgREST les joue (`set role` + `request.jwt.claims`).
//
//  Ce qu'il prouve : rien n'est lisible en direct (tables, anon) ; entrer =
//  DEMANDER, le créateur seul valide, refuse, retire ; partage PAR DÉFAUT rien ;
//  le créateur ne voit des chiffres que d'un membre ACCEPTÉ qui les partage, le
//  détail seulement au niveau « détail » ; révoquer retire ET efface ; le membre
//  voit exactement la même vue que le créateur ; jamais un compte ni un email
//  rendus ; une forme publiée inconnue n'écrit rien ; un détail envoyé sans
//  permission n'est jamais rangé ; la base ne lit aucune donnée du membre
//  (aucune référence à app_data) ; abonnement coupé ⇒ rien ; « Fermer mon
//  compte » détache et vide ; nouveau code ⇒ l'ancien ne marche plus ; groupe
//  fermé ⇒ plus rien ; la migration refuse sans la 020 et se rejoue.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const M = (f) => path.join(RACINE, 'supabase/migrations', f);
const MIG = M('025-communaute-accompagnement.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql'].map(M);
const AVANT = ['018-communaute.sql', '019-communaute-discord-classement.sql', '020-communaute-groupes.sql'].map(M);
// Des identités INVENTÉES.
const U = { A: '11111111-1111-1111-1111-111111111111', B: '22222222-2222-2222-2222-222222222222',
  C: '33333333-3333-3333-3333-333333333333', D: '44444444-4444-4444-4444-444444444444', E: '55555555-5555-5555-5555-555555555555' };

const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');
const FORME = args.includes('--forme');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).replace(/\s*\n\s*/g, ' ').slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };
const remplace = (s, avant, apres, nom) => {
  const n = s.split(avant).length - 1;
  if (n !== 1) throw new Error('mutation ' + nom + ' : ancre introuvable (' + n + ' occurrence(s))');
  return s.split(avant).join(apres);
};

// Chaque règle, réaffaiblie : l'audit doit passer au ROUGE.
const MUTATIONS = {
  // Le créateur voit les chiffres d'un membre qui ne partage RIEN.
  'chiffres-sans-partage': { sql: (s) => remplace(s, "      || case when m.statut = 'accepte' and public.vrm_accomp_niveau(m.partage) >= 1\n", "      || case when m.statut = 'accepte'\n", 'csp') },
  // Le détail rendu au niveau « chiffres ».
  'detail-au-niveau-chiffres': { sql: (s) => remplace(s, "      || case when m.statut = 'accepte' and public.vrm_accomp_niveau(m.partage) >= 2\n", "      || case when m.statut = 'accepte' and public.vrm_accomp_niveau(m.partage) >= 1\n", 'dnc') },
  // Les chiffres d'une personne EN ATTENTE visibles avant validation.
  'chiffres-avant-validation': { sql: (s) => remplace(s, "      || case when m.statut = 'accepte' and public.vrm_accomp_niveau(m.partage) >= 1\n", "      || case when m.statut in ('attente', 'accepte') and public.vrm_accomp_niveau(m.partage) >= 1\n", 'cav') },
  // N'importe qui valide une demande.
  'decider-sans-createur': { sql: (s) => remplace(s, "   where y.id = p_membre and g.cree_par = moi and g.ferme_le is null;\n  if m.id is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;\n  if m.statut <> 'attente'",
    "   where y.id = p_membre and g.ferme_le is null;\n  if m.id is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;\n  if m.statut <> 'attente'", 'dsc') },
  // Entrer = accepté d'office (aucune validation).
  'entree-sans-validation': { sql: (s) => remplace(s, "       values (g.id, moi, q, 'attente', pa, pg_catalog.now())", "       values (g.id, moi, q, 'accepte', pa, pg_catalog.now())", 'esv') },
  // Révoquer cache mais n'efface pas.
  'revoquer-sans-effacer': { sql: (s) => remplace(s, '  n := public.vrm_accomp_elaguer(moi);\n  return jsonb_build_object(\'ok\', true, \'partage\', p_partage', '  n := 2;\n  return jsonb_build_object(\'ok\', true, \'partage\', p_partage', 'rse') },
  // Le détail envoyé sans permission est rangé.
  'detail-sans-permission-range': { sql: (s) => remplace(s, '  de := case when n >= 2 then p_detail end;', '  de := p_detail;', 'dspr') },
  // Une forme publiée inconnue est rangée.
  'forme-libre': { sql: (s) => remplace(s, "  if p_chiffres is not null and not public.vrm_accomp_chiffres_ok(p_chiffres) then", "  if false then", 'fl') },
  // Le compte du membre rendu au créateur.
  'owner-rendu': { sql: (s) => remplace(s, "  select jsonb_build_object('id', m.id, 'nom', m.nom, 'statut', m.statut, 'partage', m.partage,\n", "  select jsonb_build_object('id', m.id, 'owner', m.owner, 'nom', m.nom, 'statut', m.statut, 'partage', m.partage,\n", 'or') },
  // Un membre retiré reste visible avec ses chiffres.
  'retire-visible': { sql: (s) => remplace(s, "                                           where m.groupe = g.id and m.statut in ('attente', 'accepte')), '[]'::jsonb))", "                                           where m.groupe = g.id), '[]'::jsonb))", 'rv') },
  // Partage par défaut = chiffres.
  'defaut-chiffres': { sql: (s) => remplace(s, "        pa text := coalesce(p_partage, 'rien');", "        pa text := coalesce(p_partage, 'chiffres');", 'dc') },
  // La table des partages lisible par un navigateur.
  'partages-lisibles': { apres: 'grant select on public.vrm_accomp_partages to authenticated; alter table public.vrm_accomp_partages no force row level security; alter table public.vrm_accomp_partages disable row level security;' },
  // Anon lit les groupes.
  'anon-apercu': { apres: 'grant execute on function public.vrm_accomp_apercu(text) to anon;' },
  // Un nouveau code laisse l'ancien marcher (le code ne change pas).
  'code-inchange': { sql: (s) => remplace(s, '  update public.vrm_accomp_groupes g set code = c where g.id = p_groupe;', '  c := (select g.code from public.vrm_accomp_groupes g where g.id = p_groupe);', 'ci') },
  // « Fermer mon compte » laisse ses partages.
  'effacer-garde': { sql: (s) => remplace(s, "  update public.vrm_accomp_partages s set owner = pg_catalog.gen_random_uuid(), chiffres = null, detail = null, chiffres_le = null, detail_le = null\n   where s.owner = p_owner;",
    "  update public.vrm_accomp_partages s set chiffres_le = s.chiffres_le\n   where s.owner = p_owner;", 'eg') },
  // Sans abonnement, on crée quand même.
  'creer-sans-abonnement': { sql: (s) => remplace(s, "  if not public.vrm_acces_pour(moi) then return jsonb_build_object('ok', false, 'raison', 'abonnement'); end if;\n  if pg_catalog.char_length(n) not between 2 and 60", "  if pg_catalog.char_length(n) not between 2 and 60", 'csa') },
};

if (PROUVE) {
  const noms = Object.keys(MUTATIONS);
  let rouges = 0;
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /gm) || []).length;
    const sautee = /NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !sautee;
    if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté ou ancre introuvable' : 'RESTE VERTE : le contrôle ne mord pas')}`);
    if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 200));
  }
  console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
  process.exit(rouges === noms.length ? 0 : 1);
}

function trouverBin() {
  const avec = (d) => d && fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'pg_ctl')) && fs.existsSync(path.join(d, 'postgres'));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  try { const d = execFileSync('pg_config', ['--bindir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (avec(d)) return d; } catch (_) {}
  return null;
}
const BIN = trouverBin();
const PSQL = BIN && fs.existsSync(path.join(BIN, 'psql')) ? path.join(BIN, 'psql') : null;
if (!BIN || !PSQL) { console.log('❌ Postgres introuvable (initdb, pg_ctl, postgres, psql) — audit NON exécuté. Installe postgresql (16+), ou donne PG_BIN=/chemin/vers/bin.'); process.exit(1); }
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) {
  try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; }
  catch (_) { console.log('❌ lancé en root sans utilisateur système « postgres » — audit NON exécuté.'); process.exit(1); }
}
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-accomp-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(56432 + (process.pid % 2000));
const serveur = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
process.on('SIGINT', () => { arreter(); process.exit(1); });
{
  const r = serveur('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb a échoué — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}
const argsPsql = (role, db) => ['-h', DIR, '-p', PORT, '-U', role, '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'];
let DB = 'postgres';
const run = (sql, o = {}) => {
  const r = spawnSync(PSQL, argsPsql(o.role || 'postgres', o.db || DB), { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const Q = (sql, o = {}) => { const r = run(sql, o); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const ADM = (sql) => Q(sql, { role: 'supabase_admin' });
const comme = (u) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}';\n`;
const ANON = `set role anon; set "request.jwt.claims" = '{"role":"anon"}';\n`;
const SERVEUR = `set role service_role; set "request.jwt.claims" = '{"role":"service_role"}';\n`;
const enRun = (u, sql) => run(comme(u) + sql);
const J = (u, sql) => { const r = enRun(u, sql); if (!r.ok) throw new Error(r.err.slice(0, 300)); return JSON.parse(r.out.split('\n').filter(Boolean).pop() || 'null'); };
const fraiche = (nom, modele) => { ADM(`drop database if exists ${nom}`); Q(`create database ${nom} template ${modele} owner postgres`, { db: 'postgres', role: 'supabase_admin' }); DB = nom; };
const lit = (x) => x === null ? 'null' : "'" + String(x).replace(/'/g, "''") + "'";
const jb = (o) => o === null ? 'null' : lit(JSON.stringify(o)) + '::jsonb';

const lire = (u) => J(u, 'select public.vrm_accomp_lire();');
const creer = (u, nom, d, q) => J(u, `select public.vrm_accomp_creer(${lit(nom)}, ${lit(d)}, ${lit(q)});`);
const apercu = (u, c) => J(u, `select public.vrm_accomp_apercu(${lit(c)});`);
const demander = (u, c, nom, p) => J(u, `select public.vrm_accomp_demander(${lit(c)}, ${lit(nom)}, ${p === undefined ? 'null' : lit(p)});`);
const decider = (u, m, oui) => J(u, `select public.vrm_accomp_decider(${lit(m)}, ${oui});`);
const retirer = (u, m) => J(u, `select public.vrm_accomp_retirer(${lit(m)});`);
const quitter = (u, m) => J(u, `select public.vrm_accomp_quitter(${lit(m)});`);
const partage = (u, m, p) => J(u, `select public.vrm_accomp_partage(${lit(m)}, ${lit(p)});`);
const publier = (u, ch, de) => J(u, `select public.vrm_accomp_publier(${jb(ch)}, ${jb(de)});`);
const voit = (u, m) => J(u, `select public.vrm_accomp_ce_que_voit(${lit(m)});`);
const CHIFFRES = { v: 1, ventes: true, achats: true, semaines: { '2026-W44': [3, 12000, 2, 5000], '2026-W45': [1, 4500, 0, 0] }, mois: { '2026-10': [3, 12000, 2, 5000], '2026-11': [1, 4500, 0, 0] }, at: 1793000000000 };
const DETAIL = { v: 1, ventes: [[1793000000000, 'Vinted', 'compte_invente', 'Paire inventée 42', 4500]], achats: [[1792000000000, 'compte_invente', 'Achat inventé', 2500]], at: 1793000000000 };
const membreDe = (l, nom) => (l.crees[0] && l.crees[0].membres || []).find((m) => m.nom === nom);

(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  let SQL = fs.readFileSync(MIG, 'utf8');
  const mut = MUTATION ? MUTATIONS[MUTATION] : null;
  if (MUTATION && !mut) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); }
  try { if (mut && mut.sql) SQL = mut.sql(SQL); } catch (e) { console.log('❌ ' + e.message + ' — audit NON exécuté'); process.exit(1); }

  const socleOk = await essaie('préparer le socle (rôles, 005-007)', () => {
    Q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin', db: 'postgres' });
    DB = 'socle';
    ADM(fs.readFileSync(MIN, 'utf8'));
    ADM('alter table auth.users add column if not exists email text;');
    ADM('insert into auth.users (id) values ' + Object.values(U).map((u) => `('${u}')`).join(', ') + ';');
    for (const f of SOCLE) Q(fs.readFileSync(f, 'utf8'));
    return true;
  });
  if (!socleOk) { console.log('\n❌ socle impossible — audit NON exécuté'); process.exit(1); }

  await essaie('sans la 020', () => {
    fraiche('sans', 'socle');
    const r = run(SQL);
    dit(!r.ok && /vrm_accomp_prealable/.test(r.err), 'sans la 020, la migration REFUSE et le dit', r.ok ? 'installée quand même' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_class where relname like 'vrm\\_accomp\\_%'") === '0', "et rien n'est installé");
  });

  await essaie('socle 018-020', () => { DB = 'socle'; for (const f of AVANT) Q(fs.readFileSync(f, 'utf8')); return true; });

  if (FORME) {
    fraiche('forme', 'socle');
    const s = fs.readFileSync(MIG, 'utf8').replace(/  if v is distinct from '[^']+' then/, "  raise notice 'FORME=%', v; if false then");
    const r = run(s);
    console.log((r.err.match(/FORME=([0-9a-f]{32})/) || [])[1] || r.err);
    process.exit(0);
  }

  await essaie('le fichier', () => {
    const brut = fs.readFileSync(MIG, 'utf8');
    const sansComm = brut.replace(/--[^\n]*/g, '');
    dit(!/\bdelete\b/i.test(sansComm) && !/\bdrop\b/i.test(sansComm) && !/\btruncate\b/i.test(sansComm), 'la 025 ne contient AUCUNE suppression (elle se colle d\'un bloc dans l\'outil SQL)');
    dit(!/app_data|vinted_accounts|harvest_/i.test(sansComm), 'la 025 ne lit AUCUNE donnée du membre (ni app_data, ni vinted_accounts, ni moisson) : seulement ce que son app publie');
    dit(!/@@FORME@@/.test(brut), "l'empreinte des tables est posée (pas un gabarit)");
  });

  await essaie('forme', () => {
    fraiche('ancienne', 'socle');
    Q('create table public.vrm_accomp_partages (owner uuid primary key, chiffres jsonb);');
    const r = run(SQL);
    dit(!r.ok && /vrm_accomp_forme/.test(r.err), "une table vrm_accomp_partages d'une autre forme fait REFUSER la migration", r.ok ? 'installée quand même' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_accomp\\_%'") === '0', "et rien n'est installé (aucune fonction)");
  });

  fraiche('base', 'socle');
  const installe = await essaie('installation', () => {
    const r = run(SQL);
    if (!r.ok) throw new Error(r.err);
    const r2 = run(SQL);
    dit(r2.ok, 'la migration se rejoue sans erreur (idempotente)', r2.err);
    if (mut && mut.apres) ADM(mut.apres);
    return true;
  });
  if (!installe) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }

  await essaie('droits', () => {
    for (const t of ['vrm_accomp_groupes', 'vrm_accomp_membres', 'vrm_accomp_partages']) {
      const r = enRun(U.A, `select count(*) from public.${t};`);
      dit(!r.ok, `un navigateur connecté ne lit pas ${t} en direct`, r.ok ? 'lu : ' + r.out : '');
      dit(Q(`select relforcerowsecurity and relrowsecurity from pg_class where relname = '${t}'`) === 't', `${t} : RLS activé et forcé`);
    }
    const a = run(ANON + "select public.vrm_accomp_apercu('ABCDEFGH');");
    dit(!a.ok, "anon n'exécute aucune fonction des groupes", a.ok ? a.out : '');
    const s = run(SERVEUR + "select public.vrm_accomp_lire();");
    dit(!s.ok, 'la clé de service ne lit pas les groupes (seul « effacer » lui est permis)', s.ok ? s.out : '');
    for (const f of ['vrm_accomp_vue(uuid)', 'vrm_accomp_elaguer(uuid)', 'vrm_accomp_code_neuf()']) {
      const r = enRun(U.A, `select public.${f.replace('(uuid)', "('" + U.B + "')")};`);
      dit(!r.ok, `${f} (aide interne) n'est exécutable par personne`, r.ok ? r.out : '');
    }
  });

  let code, gid, mB, mC;
  await essaie('créer, demander, valider', () => {
    dit(creer(U.A, 'x', '', 'Julien').raison === 'nom-groupe', 'un nom de groupe trop court est refusé');
    dit(creer(U.A, 'Mon accompagnement', 'a<b', 'Julien').raison === 'description', 'une description avec « < » est refusée');
    dit(creer(U.A, 'Mon accompagnement', 'desc', 'j@x.fr').raison === 'nom', 'un nom affiché qui ressemble à un email est refusé');
    const c = creer(U.A, 'Accompagnement Lyon', 'Le groupe des élèves de novembre.', 'Coach Julien');
    dit(c.ok === true && /^[A-HJ-NP-Z2-9]{8}$/.test(c.code), 'créer un groupe rend un code de 8 caractères', JSON.stringify(c));
    code = c.code; gid = c.id;
    const ap = apercu(U.B, code.slice(0, 4).toLowerCase() + '-' + code.slice(4));
    dit(ap.ok === true && ap.nom === 'Accompagnement Lyon' && ap.description === 'Le groupe des élèves de novembre.' && ap.createur === 'Coach Julien' && ap.membres === 0,
      "l'aperçu d'un code (tapé en minuscules avec tiret) dit le nom, la description, le créateur et le nombre de membres", JSON.stringify(ap));
    dit(!JSON.stringify(ap).includes(U.A), "l'aperçu ne rend jamais le compte du créateur");
    dit(apercu(U.B, 'ZZZZZZZZ').raison === 'code', 'un code inconnu ⇒ « code »');
    dit(demander(U.A, code, 'Coach', 'rien').raison === 'soi', 'le créateur ne demande pas à entrer dans son propre groupe');
    const d = demander(U.B, code, 'Élève Bea', undefined);
    dit(d.ok === true && d.statut === 'attente', 'entrer = DEMANDER : statut « attente »', JSON.stringify(d));
    mB = d.id;
    const lB = lire(U.B);
    dit(lB.rejoints.length === 1 && lB.rejoints[0].partage === 'rien', 'sans choix, le partage est RIEN', JSON.stringify(lB.rejoints[0]));
    const dC = demander(U.C, code, 'Élève Cam', 'chiffres');
    mC = dC.id;
    const lA = lire(U.A);
    dit(lA.crees.length === 1 && lA.crees[0].membres.length === 2 && lA.crees[0].membres.every((m) => m.statut === 'attente'), 'le créateur voit les deux demandes en attente');
    dit(!JSON.stringify(lA).includes(U.B) && !JSON.stringify(lA).includes(U.C), 'le créateur ne voit jamais le compte des membres');
    dit(decider(U.B, mC, true).raison === 'pas-createur', "un membre ne valide pas la demande d'un autre");
    dit(decider(U.D, mC, true).raison === 'pas-createur', 'un inconnu ne valide rien');
    dit(decider(U.A, mB, true).statut === 'accepte', 'le créateur ACCEPTE une demande');
    dit(decider(U.A, mB, true).raison === 'etat', 'une demande déjà tranchée ne se re-tranche pas');
    dit(apercu(U.D, code).membres === 1, "l'aperçu compte les membres acceptés seulement");
    dit(demander(U.B, code, 'Élève Bea', 'detail').deja === true, 'redemander quand on est déjà dedans ne change rien');
  });

  await essaie('partage : rien, chiffres, détail', () => {
    const r0 = publier(U.B, CHIFFRES, DETAIL);
    dit(r0.ok === false && r0.raison === 'rien-a-partager', 'qui ne partage rien ne peut rien publier', JSON.stringify(r0));
    let vB = membreDe(lire(U.A), 'Élève Bea');
    dit(vB && !('chiffres' in vB) && !('detail' in vB), 'partage « rien » ⇒ le créateur voit le nom et le statut, AUCUN chiffre', JSON.stringify(vB));
    dit(partage(U.B, mB, 'chiffres').ok === true, 'le membre passe à « chiffres »');
    vB = membreDe(lire(U.A), 'Élève Bea');
    dit(vB && 'chiffres' in vB && vB.chiffres === null, 'permis mais pas encore publié ⇒ la clé est là et vaut null (« pas encore publié », jamais 0)', JSON.stringify(vB));
    dit(publier(U.B, { ...CHIFFRES, semaines: { '2026-W45': [1, -5, 0, 0] } }, null).raison === 'forme', 'un nombre négatif publié est refusé (forme)');
    dit(publier(U.B, { ...CHIFFRES, intrus: 1 }, null).raison === 'forme', 'une clé inconnue publiée est refusée (forme)');
    dit(publier(U.B, { ...CHIFFRES, mois: { 'nov': [1, 1, 1, 1] } }, null).raison === 'forme', 'un mois mal formé est refusé (forme)');
    const r1 = publier(U.B, CHIFFRES, DETAIL);
    dit(r1.ok === true && r1.chiffres === true && r1.detail === false, 'au niveau « chiffres », le détail envoyé est JETÉ', JSON.stringify(r1));
    dit(Q("select count(*) from public.vrm_accomp_partages where detail is not null") === '0', 'et aucun détail n\'est rangé en base');
    vB = membreDe(lire(U.A), 'Élève Bea');
    dit(vB && vB.chiffres && vB.chiffres.mois['2026-10'][0] === 3 && !('detail' in vB), 'le créateur voit les chiffres, pas le détail', JSON.stringify(vB).slice(0, 200));
    const vC = membreDe(lire(U.A), 'Élève Cam');
    dit(vC && !('chiffres' in vC), "une personne EN ATTENTE ne montre aucun chiffre, même si elle les partage");
    dit(partage(U.B, mB, 'detail').ok === true, 'le membre autorise le détail');
    dit(publier(U.B, CHIFFRES, { ...DETAIL, ventes: [[1, 'Vinted', 'c', '<script>', 1]] }).raison === 'forme', 'un texte avec « < » dans le détail est refusé');
    publier(U.B, CHIFFRES, DETAIL);
    vB = membreDe(lire(U.A), 'Élève Bea');
    dit(vB && vB.detail && vB.detail.ventes[0][3] === 'Paire inventée 42', 'au niveau « détail », le créateur voit les articles, prix, comptes', JSON.stringify(vB).slice(0, 200));
    const moi = voit(U.B, mB);
    dit(moi && JSON.stringify(moi.vue) === JSON.stringify(vB), 'le membre voit EXACTEMENT ce que voit le créateur (même objet)', JSON.stringify(moi).slice(0, 160));
    dit(voit(U.C, mB).erreur === 'adhesion', "personne d'autre ne lit « ce que voit le créateur » d'un membre");
    dit(partage(U.C, mB, 'rien').raison === 'adhesion', "personne ne change le partage d'un autre");
    // Révoquer : retiré ET effacé.
    dit(partage(U.B, mB, 'chiffres').ok === true, 'le membre revient à « chiffres »');
    vB = membreDe(lire(U.A), 'Élève Bea');
    dit(vB && !('detail' in vB) && vB.chiffres, 'révoquer le détail : le créateur ne le voit plus');
    dit(Q("select count(*) from public.vrm_accomp_partages where detail is not null") === '0', 'et le détail est EFFACÉ de la base, pas seulement caché');
    dit(partage(U.B, mB, 'rien').ok === true, 'le membre revient à « rien »');
    vB = membreDe(lire(U.A), 'Élève Bea');
    dit(vB && !('chiffres' in vB), 'révoquer tout : plus aucun chiffre');
    dit(Q("select count(*) from public.vrm_accomp_partages where chiffres is not null") === '0', 'et les chiffres sont EFFACÉS de la base');
  });

  await essaie('retirer, quitter, code, fermer', () => {
    partage(U.B, mB, 'chiffres'); publier(U.B, CHIFFRES, null);
    dit(retirer(U.C, mB).raison === 'pas-createur', 'un membre ne retire personne');
    dit(retirer(U.A, mB).statut === 'retire', 'le créateur RETIRE un membre');
    const lA = lire(U.A);
    dit(!membreDe(lA, 'Élève Bea'), 'un membre retiré disparaît de la liste du créateur');
    dit(Q("select count(*) from public.vrm_accomp_partages where chiffres is not null") === '0', 'ses chiffres sont effacés (il ne partage plus nulle part)');
    const lB = lire(U.B);
    dit(lB.rejoints[0].statut === 'retire', 'le membre retiré le sait (statut « retire »)');
    dit(partage(U.B, mB, 'detail').raison === 'adhesion', 'un membre retiré ne repartage rien');
    dit(decider(U.A, mC, false).statut === 'refuse', 'le créateur REFUSE une demande');
    const dC2 = demander(U.C, code, 'Élève Cam', 'rien');
    dit(dC2.ok && dC2.statut === 'attente', 'une personne refusée peut redemander (le créateur retranche)');
    dit(decider(U.A, mC, true).statut === 'accepte', 'puis être acceptée');
    dit(quitter(U.C, mC).ok === true, 'le membre PART quand il veut');
    dit(!lire(U.C).rejoints.length, 'parti ⇒ le groupe sort de sa liste');
    const ancien = code;
    const nc = J(U.A, `select public.vrm_accomp_code(${lit(gid)});`);
    dit(nc.ok && nc.code !== ancien, 'le créateur change le code');
    dit(apercu(U.D, ancien).raison === 'code' && demander(U.D, ancien, 'Intrus', 'rien').raison === 'code', "l'ancien code (et l'ancien lien) ne marche plus");
    dit(J(U.B, `select public.vrm_accomp_code(${lit(gid)});`).raison === 'pas-createur', 'seul le créateur change le code');
    code = nc.code;
    const dD = demander(U.D, code, 'Élève Dan', 'chiffres'); decider(U.A, dD.id, true); publier(U.D, CHIFFRES, null);
    dit(J(U.B, `select public.vrm_accomp_fermer(${lit(gid)});`).raison === 'pas-createur', 'seul le créateur ferme le groupe');
    dit(J(U.A, `select public.vrm_accomp_fermer(${lit(gid)});`).ok === true, 'le créateur FERME le groupe');
    dit(lire(U.A).crees.length === 0, 'un groupe fermé sort de la liste du créateur');
    dit(apercu(U.E, code).raison === 'code', "un groupe fermé ne s'ouvre plus par son code");
    dit(lire(U.D).rejoints[0].ferme === true, 'le membre voit que le groupe est fermé');
    dit(Q("select count(*) from public.vrm_accomp_partages where chiffres is not null") === '0', 'groupe fermé ⇒ les chiffres de ses membres sont effacés');
  });

  await essaie('bornes', () => {
    for (let i = 0; i < 5; i++) creer(U.E, 'Groupe ' + i, '', 'Coach Eve');
    dit(creer(U.E, 'Groupe 6', '', 'Coach Eve').raison === 'trop-crees', '5 groupes ouverts créés au plus');
  });

  await essaie('abonnement', () => {
    const c = creer(U.A, 'Second groupe', '', 'Coach Julien');
    const dB = demander(U.B, c.code, 'Élève Bea', 'chiffres'); decider(U.A, dB.id, true);
    ADM("update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';");
    ADM(`insert into public.abonnements (owner, statut) values ('${U.A}', 'active');`);
    dit(lire(U.B).acces === false, 'abonnement coupé ⇒ on ne lit plus rien');
    dit(creer(U.B, 'Groupe B', '', 'Bea').raison === 'abonnement', 'abonnement coupé ⇒ on ne crée rien');
    dit(publier(U.B, CHIFFRES, null).raison === 'abonnement', 'abonnement coupé ⇒ on ne publie rien');
    dit(partage(U.B, dB.id, 'rien').ok === true, 'abonnement coupé ⇒ BAISSER son partage marche toujours');
    dit(partage(U.B, dB.id, 'detail').raison === 'abonnement', "abonnement coupé ⇒ l'élargir, non");
    dit(lire(U.A).acces === true, "le créateur abonné lit toujours son groupe");
    ADM("update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire'; truncate public.abonnements;");
  });

  await essaie('fermer mon compte', () => {
    const c = lire(U.A).crees[0];
    const dC = demander(U.C, c.code, 'Élève Cam', 'detail'); decider(U.A, dC.id, true); publier(U.C, CHIFFRES, DETAIL);
    const rB = run(SERVEUR + `select public.vrm_accomp_effacer(${lit(U.C)});`);
    dit(rB.ok && Number(rB.out.split('\n').pop()) >= 2, '« Fermer mon compte » (clé de service) détache ses adhésions et ses partages', rB.err || rB.out);
    dit(Q(`select count(*) from public.vrm_accomp_membres where owner = '${U.C}'`) === '0' && Q(`select count(*) from public.vrm_accomp_partages where owner = '${U.C}'`) === '0', 'plus aucune ligne ne porte son compte');
    dit(Q("select count(*) from public.vrm_accomp_partages where detail is not null or chiffres is not null and owner not in (select owner from public.vrm_accomp_membres where statut in ('attente','accepte'))") === '0', 'ses chiffres et son détail sont vidés');
    dit(!JSON.stringify(lire(U.A)).includes('Paire inventée'), "le créateur ne voit plus rien de lui");
    const rA = run(SERVEUR + `select public.vrm_accomp_effacer(${lit(U.A)});`);
    dit(rA.ok && Q(`select count(*) from public.vrm_accomp_groupes where cree_par = '${U.A}'`) === '0', 'les groupes du créateur qui ferme son compte sont détachés');
    dit(Q(`select count(*) from public.vrm_accomp_groupes g where ferme_le is null and cree_par <> '${U.E}'`) === '0', 'et fermés (seuls ceux des autres restent ouverts)');
    dit(!run(comme(U.A) + `select public.vrm_accomp_effacer(${lit(U.B)});`).ok, "un navigateur n'efface personne");
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
