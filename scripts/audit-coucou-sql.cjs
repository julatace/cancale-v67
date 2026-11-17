#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 046 — LE « COUCOU » ET L'HABILLAGE DES GROUPES (17 nov.)
//  node scripts/audit-coucou-sql.cjs              (le contrôle)
//  node scripts/audit-coucou-sql.cjs --prouve     (chaque règle réaffaiblie ⇒ ROUGE)
//  node scripts/audit-coucou-sql.cjs --mutation=nom
//
//  La 046 est EXÉCUTÉE pour de vrai sur un Postgres JETABLE qui imite la
//  production (scripts/agent-sql/supabase-min.sql + 005-007, 018-020 et 025
//  telles quelles). Identités INVENTÉES, aucune connexion à la vraie base. Les
//  rôles sont joués comme PostgREST les joue (`set role` + `request.jwt.claims`).
//
//  Ce qu'il prouve : un coucou ne porte AUCUN texte (ni colonne, ni paramètre) ;
//  il n'existe qu'entre deux personnes du MÊME groupe ouvert (créateur ↔ membre
//  accepté ; deux membres seulement s'ils l'ont tous deux ouvert, NON par
//  défaut) ; un par paire et par 24 h, dans un sens ou dans l'autre ; 20 par
//  expéditeur et par 24 h ; couper quelqu'un bloque ses coucous et les cache ;
//  seul celui qui reçoit coupe ; la règle de lecture (RLS) ne laisse voir un
//  coucou qu'aux deux personnes ; aucune table lisible en direct ; jamais le
//  compte de l'autre rendu au navigateur ; les fonctions qui le rendent sont
//  réservées à la clé de service ; habiller (photo, Discord) : le créateur seul,
//  formes vérifiées, vu par les membres ACCEPTÉS seulement ; retiré, groupe
//  fermé ⇒ plus rien ; abonnement coupé ⇒ rien ; « Fermer mon compte » détache ;
//  la 025 n'est pas touchée (son empreinte) ; refus sans la 025 ; rejouable.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const M = (f) => path.join(RACINE, 'supabase/migrations', f);
const MIG = M('046-communaute-coucous.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql'].map(M);
const AVANT = ['018-communaute.sql', '019-communaute-discord-classement.sql', '020-communaute-groupes.sql'].map(M);
const M025 = M('025-communaute-accompagnement.sql');
let R = null;   // src/communaute/coucou.js (ESM), chargé au départ
const U = {};
for (let i = 1; i <= 30; i++) U['P' + i] = `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`;
const [A, B, C, D, E] = [U.P1, U.P2, U.P3, U.P4, U.P5];

const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

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
  // La paire ne compte que dans un sens : B répond à A tout de suite.
  'paire-un-sens': (s) => remplace(s, "                  where ((c.de = p_x and c.a = p_y) or (c.de = p_y and c.a = p_x))", "                  where (c.de = p_x and c.a = p_y)", 'pus'),
  // Pas de plafond par jour.
  'sans-plafond': (s) => remplace(s, "c.le > pg_catalog.now() - interval '24 hours') >= 20 then", "c.le > pg_catalog.now() - interval '24 hours') >= 100000 then", 'sp'),
  // La sourdine ne bloque plus.
  'sans-sourdine': (s) => remplace(s, "  if exists (select 1 from public.vrm_accomp_sourdines s where s.owner = cible and s.muet = moi and s.actif) then\n    return jsonb_build_object('ok', false, 'raison', 'indisponible');\n  end if;\n", '', 'ss'),
  // Les coucous d'une personne coupée restent affichés.
  'sourdine-visible': (s) => remplace(s, "\n         and not exists (select 1 from public.vrm_accomp_sourdines s where s.owner = moi and s.muet = c.de and s.actif)), '[]'::jsonb),", "), '[]'::jsonb),", 'sv'),
  // Hors du groupe : n'importe qui fait coucou au créateur.
  'hors-groupe': (s) => remplace(s, "  if mon_role is null then return jsonb_build_object('ok', false, 'raison', 'groupe'); end if;\n  if p_membre is null then\n    -- Au créateur : seulement un membre accepté.\n    if mon_role <> 'membre' then",
    "  if p_membre is null then\n    -- Au créateur : seulement un membre accepté.\n    if mon_role = 'createur' then", 'hg'),
  // Deux membres se font coucou sans l'avoir ouvert.
  'membres-sans-ouvrir': (s) => remplace(s, "      if not (public.vrm_coucou_ouvert(mon_adh) and public.vrm_coucou_ouvert(cible_adh)) then", "      if false then", 'mso'),
  // Ouvert par défaut.
  'ouvert-par-defaut': (s) => remplace(s, "  select coalesce((select o.ouvert from public.vrm_accomp_ouverts o where o.membre = p_membre), false)", "  select coalesce((select o.ouvert from public.vrm_accomp_ouverts o where o.membre = p_membre), true)", 'opd'),
  // Une personne en attente reçoit un coucou.
  'cible-en-attente': (s) => remplace(s, "     where m.id = p_membre and m.groupe = p_groupe and m.statut = 'accepte';", "     where m.id = p_membre and m.groupe = p_groupe and m.statut in ('attente', 'accepte');", 'cea'),
  // La règle de lecture laisse tout voir.
  'politique-ouverte': (s) => remplace(s, "      using (de = (select auth.uid()) or a = (select auth.uid()));", "      using (true);", 'po'),
  // Un coucou porte un texte.
  'texte': (s) => remplace(remplace(s, "  le timestamptz not null default now(),\n  constraint vrm_accomp_coucou_groupe", "  le timestamptz not null default now(),\n  texte text,\n  constraint vrm_accomp_coucou_groupe", 't1'),
    "'id:uuid,de:uuid,a:uuid,groupe:uuid,le:timestamp with time zone'", "'id:uuid,de:uuid,a:uuid,groupe:uuid,le:timestamp with time zone,texte:text'", 't2'),
  // Le compte de l'expéditeur rendu à celui qui reçoit.
  'owner-rendu': (s) => remplace(s, "      select jsonb_agg(jsonb_build_object('id', c.id, 'groupe', c.groupe, 'groupe_nom', g.nom,", "      select jsonb_agg(jsonb_build_object('id', c.id, 'de', c.de, 'groupe', c.groupe, 'groupe_nom', g.nom,", 'or'),
  // N'importe qui coupe (même sans avoir reçu le coucou).
  'sourdine-par-autrui': (s) => remplace(s, "  select c.de into auteur from public.vrm_accomp_coucous c where c.id = p_coucou and c.a = moi;", "  select c.de into auteur from public.vrm_accomp_coucous c where c.id = p_coucou;", 'spa'),
  // Un membre habille le groupe.
  'habiller-par-membre': (s) => remplace(s, "  if not exists (select 1 from public.vrm_accomp_groupes g where g.id = p_groupe and g.cree_par = moi and g.ferme_le is null) then\n    return jsonb_build_object('ok', false, 'raison', 'pas-createur');\n  end if;\n  if d is not null", "  if d is not null", 'hpm'),
  // Un lien Discord libre accepté.
  'discord-libre': (s) => remplace(s, "  if d is not null and (pg_catalog.char_length(d) > 120 or d !~ ", "  if d is not null and false and (pg_catalog.char_length(d) > 120 or d !~ ", 'dl'),
  // La route-seule ouverte aux navigateurs.
  'a-sonner-ouvert': (s) => remplace(s, "grant execute on function public.vrm_coucou_a_sonner(uuid, uuid) to service_role;", "grant execute on function public.vrm_coucou_a_sonner(uuid, uuid) to service_role, authenticated;", 'aso'),
  // Un retiré reçoit encore.
  'retire-recoit': (s) => remplace(s, "         and public.vrm_coucou_role(c.groupe, moi) is not null\n", "\n", 'rr'),
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
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-coucou-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(58432 + (process.pid % 2000));
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
const creer = (u, nom, q) => J(u, `select public.vrm_accomp_creer(${lit(nom)}, '', ${lit(q)});`);
const demander = (u, c, nom) => J(u, `select public.vrm_accomp_demander(${lit(c)}, ${lit(nom)}, null);`);
const decider = (u, m, oui) => J(u, `select public.vrm_accomp_decider(${lit(m)}, ${oui});`);
const cl = (u) => J(u, 'select public.vrm_coucou_lire();');
const coucou = (u, g, m) => J(u, `select public.vrm_coucou_envoyer(${lit(g)}, ${m ? lit(m) + '::uuid' : 'null'});`);
const sourdine = (u, c, oui) => J(u, `select public.vrm_coucou_sourdine(${lit(c)}, ${oui});`);
const ouvrir = (u, m, oui) => J(u, `select public.vrm_coucou_ouvrir(${lit(m)}, ${oui});`);
const habiller = (u, g, d, p) => J(u, `select public.vrm_accomp_habiller(${lit(g)}, ${lit(d)}, ${lit(p)});`);
const vieillir = () => ADM("update public.vrm_accomp_coucous set le = le - interval '25 hours';");
const groupeDe = (l, g) => (l.groupes || []).find((x) => x.groupe === g);
const PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(400) + '==';

(async () => {
  R = await import('file://' + path.join(RACINE, 'src/communaute/coucou.js'));
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  let SQL = fs.readFileSync(MIG, 'utf8');
  if (MUTATION && !MUTATIONS[MUTATION]) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); }
  try { if (MUTATION) SQL = MUTATIONS[MUTATION](SQL); } catch (e) { console.log('❌ ' + e.message + ' — audit NON exécuté'); process.exit(1); }

  const socleOk = await essaie('préparer le socle (rôles, 005-007, 018-020)', () => {
    Q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin', db: 'postgres' });
    DB = 'socle';
    ADM(fs.readFileSync(MIN, 'utf8'));
    ADM('alter table auth.users add column if not exists email text;');
    ADM('insert into auth.users (id) values ' + Object.values(U).map((u) => `('${u}')`).join(', ') + ';');
    for (const f of SOCLE) Q(fs.readFileSync(f, 'utf8'));
    for (const f of AVANT) Q(fs.readFileSync(f, 'utf8'));
    return true;
  });
  if (!socleOk) { console.log('\n❌ socle impossible — audit NON exécuté'); process.exit(1); }

  await essaie('sans la 025', () => {
    fraiche('sans', 'socle');
    const r = run(SQL);
    dit(!r.ok && /vrm_coucou_prealable/.test(r.err), 'sans la 025, la 046 REFUSE et le dit', r.ok ? 'installée quand même' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_coucou\\_%'") === '0', "et rien n'est installé");
  });

  await essaie('le fichier', () => {
    const brut = fs.readFileSync(MIG, 'utf8');
    const sans = brut.replace(/--[^\n]*/g, '');
    dit(!/\bdelete\b/i.test(sans) && !/\bdrop\b/i.test(sans) && !/\btruncate\b/i.test(sans), 'la 046 ne contient AUCUNE suppression (elle se colle d’un bloc)');
    dit(!/app_data|vinted_accounts|harvest_/i.test(sans), 'la 046 ne lit AUCUNE donnée des vendeurs (ni app_data, ni vinted_accounts)');
    dit(!/(create\s+table\s+(if\s+not\s+exists\s+)?|alter\s+table\s+)public\.vrm_accomp_(groupes|membres|partages)\b/i.test(sans) && !/create or replace function public\.vrm_accomp_(lire|vue|creer|demander|decider|retirer|quitter|partage|code|fermer|publier|effacer|apercu|ce_que_voit|elaguer)\(/i.test(sans), 'la 046 ne change AUCUNE table ni fonction de la 025');
    // La même règle des deux côtés (§11) : l'expression du lien Discord et la borne de la photo.
    const discordSql = (sans.match(/discord ~ '([^']+)'/) || [])[1];
    dit(discordSql === R.DISCORD_GROUPE_SQL, 'le lien Discord d’un groupe : la MÊME expression dans la base et dans l’app', discordSql);
    dit(sans.split(R.DISCORD_GROUPE_SQL).length - 1 === 2, 'et la même dans la contrainte et dans « habiller »');
    dit((sans.match(/char_length\(photo\) <= (\d+)/) || [])[1] === String(R.PHOTO_MAX), 'la borne de la photo : la même que l’app', R.PHOTO_MAX);
    dit((sans.match(/interval '24 hours'\) >= (\d+) then/) || [])[1] === String(R.COUCOU_PAR_JOUR), 'le plafond par jour : le même que l’app (' + R.COUCOU_PAR_JOUR + ')');
  });

  fraiche('base', 'socle');
  const installe = await essaie('installation', () => {
    Q(fs.readFileSync(M025, 'utf8'));
    const avant025 = Q("select md5(string_agg(p.proname || pg_get_functiondef(p.oid), '' order by p.proname)) from pg_proc p where p.proname like 'vrm\\_accomp\\_%'");
    const r = run(SQL);
    if (!r.ok) throw new Error(r.err);
    dit(/ESSAI OK/.test(r.err) || /ESSAI OK/.test(r.out) || true, 'installée');
    const r2 = run(SQL);
    dit(r2.ok, 'la 046 se rejoue sans erreur (rejouable)', r2.err);
    const apres025 = Q("select md5(string_agg(p.proname || pg_get_functiondef(p.oid), '' order by p.proname)) from pg_proc p where p.proname like 'vrm\\_accomp\\_%' and p.proname <> 'vrm_accomp_habiller'");
    dit(avant025 === apres025, 'les fonctions de la 025 sont identiques avant et après');
    return true;
  });
  if (!installe) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }

  await essaie('forme et droits', () => {
    const cols = Q("select string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' order by attnum) from pg_attribute where attrelid = 'public.vrm_accomp_coucous'::regclass and attnum > 0 and not attisdropped");
    dit(cols === 'id:uuid,de:uuid,a:uuid,groupe:uuid,le:timestamp with time zone', 'un coucou = (id, de, à, groupe, quand) — AUCUNE autre colonne', cols);
    dit(Q("select count(*) from pg_attribute where attrelid = 'public.vrm_accomp_coucous'::regclass and attnum > 0 and not attisdropped and atttypid in ('text'::regtype, 'varchar'::regtype, 'jsonb'::regtype, 'json'::regtype, 'bytea'::regtype)") === '0', 'aucune colonne de texte dans la table des coucous');
    const sig = Q("select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' ; ' order by p.proname) from pg_proc p where p.proname in ('vrm_coucou_envoyer', 'vrm_coucou_sourdine', 'vrm_coucou_ouvrir', 'vrm_coucou_lire')");
    dit(!/\btext\b|json|character/.test(sig), 'aucune fonction du coucou ne prend de texte', sig);
    for (const t of ['vrm_accomp_habillage', 'vrm_accomp_coucous', 'vrm_accomp_sourdines', 'vrm_accomp_ouverts']) {
      const r = enRun(A, `select count(*) from public.${t};`);
      dit(!r.ok, `un navigateur connecté ne lit pas ${t} en direct`, r.ok ? 'lu : ' + r.out : '');
      dit(Q(`select relforcerowsecurity and relrowsecurity from pg_class where relname = '${t}'`) === 't', `${t} : RLS activé et forcé`);
    }
    const pol = Q("select cmd || '|' || array_to_string(roles, ',') || '|' || qual from pg_policies where tablename = 'vrm_accomp_coucous'");
    dit(/^SELECT\|authenticated\|/.test(pol) && /de = \( SELECT auth\.uid\(\)/.test(pol) && /a = \( SELECT auth\.uid\(\)/.test(pol) && pol.split('\n').length === 1, 'la règle de lecture des coucous : SEULEMENT celui qui l’a fait et celui qui l’a reçu', pol);
    dit(Q("select count(*) from pg_policies where tablename = 'vrm_accomp_coucous' and cmd <> 'SELECT'") === '0', 'aucune règle d’écriture sur les coucous (on n’écrit que par les fonctions)');
    const pol2 = Q("select qual from pg_policies where tablename = 'vrm_accomp_sourdines'");
    dit(/owner = \( SELECT auth\.uid\(\)/.test(pol2), 'une sourdine n’est lisible que de celui qui l’a posée', pol2);
    const an = run(ANON + 'select public.vrm_coucou_lire();');
    dit(!an.ok, 'anon n’exécute aucune fonction du coucou', an.ok ? an.out : '');
    for (const f of [`vrm_coucou_a_sonner('${A}', '${A}')`, `vrm_coucou_auteurs('${A}')`, `vrm_coucou_effacer('${A}')`, `vrm_coucou_recent('${A}', '${B}')`, `vrm_coucou_role('${A}', '${B}')`]) {
      const r = enRun(B, `select public.${f};`);
      dit(!r.ok, `${f.split('(')[0]} n’est pas exécutable par un navigateur`, r.ok ? r.out : '');
    }
  });

  let g, code, mB, mC, mD;
  await essaie('le groupe', () => {
    const c = creer(A, 'Accompagnement Lyon', 'Coach Léa'); g = c.id; code = c.code;
    mB = demander(B, code, 'Bea').id; mC = demander(C, code, 'Cam').id; mD = demander(D, code, 'Dom').id;
    decider(A, mB, true); decider(A, mC, true);   // Dom reste en attente ; E n'est dans rien
    dit(!!(g && mB && mC && mD), 'groupe créé, deux membres acceptés, un en attente');
  });

  let cAB;
  await essaie('créateur ↔ membre', () => {
    const lA = cl(A);
    const gA = groupeDe(lA, g);
    dit(gA && gA.cibles.length === 2 && gA.cibles.every((x) => x.role === 'membre') && !gA.cibles.some((x) => x.nom === 'Dom'), 'le créateur peut faire coucou à ses membres ACCEPTÉS (pas à une demande en attente)', JSON.stringify(gA && gA.cibles));
    const r = coucou(A, g, mB);
    dit(r.ok === true, 'le créateur fait coucou à Bea', JSON.stringify(r)); cAB = r.id;
    dit(coucou(A, g, mB).raison === 'deja', 'une 2e fois dans les 24 h ⇒ refusé (« deja »)');
    dit(coucou(B, g, null).raison === 'deja', 'et Bea ne peut pas le lui rendre dans les 24 h (une PAIRE, dans les deux sens)');
    const lB = cl(B);
    dit(lB.recus.length === 1 && lB.recus[0].de_nom === 'Coach Léa' && lB.recus[0].groupe_nom === 'Accompagnement Lyon', 'Bea le voit : « Coach Léa », dans quel groupe', JSON.stringify(lB.recus));
    dit(!JSON.stringify(lB).includes(A) && !JSON.stringify(lA).includes(B) && !JSON.stringify(lA).includes(C), 'jamais le compte de l’autre dans ce que lit le navigateur');
    dit(Object.keys(lB.recus[0]).sort().join(',') === 'de_nom,discord_groupe,groupe,groupe_nom,id,le', 'un coucou reçu = qui (son nom), quel groupe, quand — rien d’autre', Object.keys(lB.recus[0]).join(','));
    dit(cl(C).recus.length === 0 && cl(A).recus.length === 0, 'personne d’autre ne le voit');
    dit(Q(`select count(*) from public.vrm_accomp_coucous where de = '${A}' and a = '${B}'`) === '1', 'en base : une ligne (de, à, groupe, quand)');
    // La règle de lecture, jouée telle quelle (le droit accordé le temps du contrôle, puis retiré).
    ADM('grant select on public.vrm_accomp_coucous to authenticated;');
    const vuB = enRun(B, 'select count(*) from public.vrm_accomp_coucous;').out, vuC = enRun(C, 'select count(*) from public.vrm_accomp_coucous;').out, vuA = enRun(A, 'select count(*) from public.vrm_accomp_coucous;').out;
    ADM('revoke select on public.vrm_accomp_coucous from authenticated;');
    dit(vuA === '1' && vuB === '1' && vuC === '0', 'même avec un droit de lecture, seuls celui qui l’a fait et celui qui l’a reçu le voient (RLS)', `A ${vuA} · B ${vuB} · C ${vuC}`);
  });

  await essaie('qui peut faire coucou à qui', () => {
    dit(coucou(A, g, null).raison === 'soi', 'le créateur ne se fait pas coucou à lui-même');
    dit(coucou(E, g, null).raison === 'groupe', 'quelqu’un hors du groupe ne fait coucou à personne');
    dit(coucou(D, g, null).raison === 'groupe', 'une demande en attente ne fait pas coucou au créateur');
    dit(coucou(A, g, mD).raison === 'cible', 'le créateur ne fait pas coucou à une demande en attente');
    dit(coucou(B, g, mB).raison === 'soi', 'un membre ne se fait pas coucou à lui-même');
    const autre = creer(E, 'Autre groupe', 'Eve');
    dit(coucou(B, autre.id, null).raison === 'groupe', 'un membre ne fait pas coucou au créateur d’un AUTRE groupe');
    dit(coucou(A, autre.id, mB).raison === 'groupe', 'ni un créateur à quelqu’un d’un autre groupe');
  });

  await essaie('entre membres : ouvert par les deux, non par défaut', () => {
    const gB = groupeDe(cl(B), g);
    dit(gB && gB.ouvert === false && gB.cibles.length === 1 && gB.cibles[0].role === 'createur', 'par défaut, un membre ne voit que le créateur (la règle de la 025 ne change pas)', JSON.stringify(gB));
    dit(coucou(B, g, mC).raison === 'cible', 'Bea → Cam sans ouverture : refusé');
    dit(ouvrir(B, mB, true).ok === true, 'Bea ouvre ses coucous aux autres membres');
    dit(coucou(B, g, mC).raison === 'cible', 'Cam n’a pas ouvert : toujours refusé');
    dit(groupeDe(cl(B), g).cibles.length === 1, 'et Bea ne voit toujours pas Cam');
    dit(ouvrir(C, mB, true).raison === 'adhesion', 'on n’ouvre que pour SOI');
    ouvrir(C, mC, true);
    const cb = groupeDe(cl(B), g).cibles;
    dit(cb.length === 2 && cb.some((x) => x.nom === 'Cam' && x.cible === mC), 'les deux ont ouvert : Bea voit Cam', JSON.stringify(cb));
    dit(coucou(B, g, mC).ok === true, 'Bea fait coucou à Cam');
    dit(ouvrir(C, mC, false).ok === true && coucou(C, g, mB).raison === 'cible', 'Cam referme : plus de coucou entre membres');
  });

  await essaie('plafond par jour', () => {
    const h = creer(U.P6, 'Grand groupe', 'Hugo');
    const ids = [];
    for (let i = 7; i <= 28; i++) { const d = demander(U['P' + i], h.code, 'Membre ' + i); decider(U.P6, d.id, true); ids.push(d.id); }
    let n = 0; for (const id of ids.slice(0, R.COUCOU_PAR_JOUR)) if (coucou(U.P6, h.id, id).ok) n++;
    dit(n === R.COUCOU_PAR_JOUR, `${R.COUCOU_PAR_JOUR} coucous en 24 h passent`, n);
    dit(coucou(U.P6, h.id, ids[R.COUCOU_PAR_JOUR]).raison === 'plafond', 'le suivant est refusé (« plafond »)');
    dit(cl(U.P6).envoyes24h === R.COUCOU_PAR_JOUR, 'et l’écran le sait (envoyés en 24 h)');
  });

  await essaie('couper (sourdine)', () => {
    dit(sourdine(C, cAB, true).raison === 'coucou', 'seul celui qui a REÇU le coucou peut couper son auteur');
    dit(sourdine(B, cAB, true).ok === true, 'Bea coupe les coucous de Coach Léa');
    dit(cl(B).recus.length === 0, 'ses coucous ne s’affichent plus');
    dit((cl(B).sourdines || []).some((s) => s.nom === 'Coach Léa'), 'Bea retrouve qui elle a coupé (pour le rétablir)');
    vieillir();
    dit(coucou(A, g, mB).raison === 'indisponible', '24 h plus tard, Coach Léa ne peut toujours pas lui faire coucou (refus neutre)');
    dit(sourdine(B, cAB, false).ok === true && coucou(A, g, mB).ok === true, 'Bea rétablit : le coucou repasse');
  });

  await essaie('retiré, groupe fermé', () => {
    vieillir();
    J(A, `select public.vrm_accomp_retirer(${lit(mC)});`);
    dit(coucou(B, g, mC).raison === 'cible' && coucou(A, g, mC).raison === 'cible', 'Cam retiré : plus personne ne lui fait coucou');
    dit(coucou(C, g, null).raison === 'groupe', 'et lui ne fait plus coucou à personne du groupe');
    dit(!groupeDe(cl(C), g) && cl(C).recus.length === 0, 'il ne voit plus le groupe ni ses coucous');
    J(A, `select public.vrm_accomp_fermer(${lit(g)});`);
    dit(coucou(B, g, null).raison === 'groupe' && coucou(A, g, mB).raison === 'groupe', 'groupe fermé : plus aucun coucou');
    dit(cl(B).recus.length === 0, 'et ceux d’avant ne s’affichent plus');
  });

  let g2, m2;
  await essaie('habiller : photo et Discord', () => {
    const c = creer(A, 'Groupe photo', 'Coach Léa'); g2 = c.id;
    m2 = demander(B, c.code, 'Bea').id; const mE = demander(E, c.code, 'Eve').id; decider(A, m2, true);
    dit(habiller(B, g2, 'https://discord.gg/abcd', null).raison === 'pas-createur', 'un membre n’habille pas le groupe');
    for (const mauvais of ['http://discord.gg/abcd', 'https://evil.example/discord.gg/x', 'https://discord.gg/a b', 'javascript:alert(1)', 'https://discord.com/users/123456789012345678'])
      dit(habiller(A, g2, mauvais, null).raison === 'discord-groupe', `lien refusé : ${mauvais}`);
    dit(habiller(A, g2, 'https://discord.gg/abcd', 'data:image/png;base64,AAAA').raison === 'photo', 'une photo qui n’est pas un JPEG en data URL est refusée');
    dit(habiller(A, g2, 'https://discord.gg/abcd', 'data:image/jpeg;base64,' + 'A'.repeat(R.PHOTO_MAX)).raison === 'photo', 'une photo trop lourde est refusée');
    dit(habiller(A, g2, 'https://discord.com/channels/123456789012345678/876543210987654321', PHOTO).ok === true, 'le créateur pose le salon Discord et la photo');
    const gB = groupeDe(cl(B), g2);
    dit(gB && gB.discord === 'https://discord.com/channels/123456789012345678/876543210987654321' && gB.photo === PHOTO, 'un membre accepté les voit');
    dit(!groupeDe(cl(E), g2), 'une demande en attente ne les voit pas');
    dit(habiller(A, g2, '', PHOTO).ok === true && groupeDe(cl(B), g2).discord === null, 'vide ⇒ le lien est retiré');
    habiller(A, g2, 'https://discord.gg/abcd', PHOTO);
    coucou(A, g2, m2);
    const rec = cl(B).recus.find((x) => x.groupe === g2);
    dit(rec && rec.discord_groupe === 'https://discord.gg/abcd', 'un coucou reçu porte le lien Discord du groupe (le repli)', JSON.stringify(rec));
  });

  await essaie('réservé à la route (clé de service)', () => {
    const id = cl(B).recus.find((x) => x.groupe === g2).id;
    const s = JSON.parse(Q(SERVEUR + `select public.vrm_coucou_a_sonner(${lit(id)}, ${lit(A)});`).split('\n').pop());
    dit(s && s.a === B && s.de_nom === 'Coach Léa', 'à sonner : la route sait chez qui (avec l’identité VÉRIFIÉE de l’auteur)', JSON.stringify(s));
    dit(Q(SERVEUR + `select coalesce(public.vrm_coucou_a_sonner(${lit(id)}, ${lit(C)})::text, 'null');`).split('\n').pop() === 'null', 'avec une autre identité que l’auteur : rien');
    const au = JSON.parse(Q(SERVEUR + `select public.vrm_coucou_auteurs(${lit(B)});`).split('\n').pop());
    dit(Array.isArray(au) && au.some((x) => x.id === id && x.de === A) && au.every((x) => Object.keys(x).sort().join() === 'de,id'), 'les auteurs des coucous REÇUS par cette personne seulement', JSON.stringify(au).slice(0, 120));
    dit(JSON.parse(Q(SERVEUR + `select public.vrm_coucou_auteurs(${lit(E)});`).split('\n').pop()).length === 0, 'rien pour qui n’a rien reçu');
  });

  await essaie('abonnement coupé', () => {
    ADM("update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';");
    ADM(`insert into public.abonnements (owner, statut) values ('${A}', 'active');`);
    dit(cl(B).acces === false, 'abonnement coupé ⇒ on ne lit plus rien');
    dit(coucou(B, g2, null).raison === 'abonnement', 'abonnement coupé ⇒ aucun coucou');
    dit(habiller(A, g2, '', null).ok === true, 'l’abonné habille toujours son groupe');
    ADM("update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire'; truncate public.abonnements;");
  });

  await essaie('fermer mon compte', () => {
    const r = run(SERVEUR + `select public.vrm_coucou_effacer(${lit(A)});`);
    dit(r.ok && Number(r.out.split('\n').pop()) >= 1, '« Fermer mon compte » (clé de service) détache ses coucous', r.err || r.out);
    dit(Q(`select count(*) from public.vrm_accomp_coucous where de = '${A}' or a = '${A}'`) === '0' && Q(`select count(*) from public.vrm_accomp_sourdines where owner = '${A}' or muet = '${A}'`) === '0', 'plus aucune ligne ne porte son compte');
    dit(!run(comme(B) + `select public.vrm_coucou_effacer(${lit(A)});`).ok, 'un navigateur n’efface personne');
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
