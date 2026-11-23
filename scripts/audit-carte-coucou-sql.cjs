#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 047 — LA CARTE : LE COUCOU REMPLACE LES MESSAGES (17 nov.)
//  node scripts/audit-carte-coucou-sql.cjs            (le contrôle)
//  node scripts/audit-carte-coucou-sql.cjs --prouve   (chaque règle réaffaiblie ⇒ ROUGE)
//
//  La 047 est EXÉCUTÉE sur un Postgres JETABLE (supabase-min + 005-007, 018-020,
//  025, 046 telles quelles). Identités INVENTÉES. Prouve : un coucou de la carte
//  ne porte AUCUN texte ; seulement entre deux personnes PRÉSENTES sur la carte ;
//  les MÊMES bornes que les groupes, comptées sur les deux tables (une paire par
//  24 h, 20 par jour) ; bloqué ou coupé ⇒ rien ; seul celui qui reçoit coupe ;
//  la règle de lecture (seuls les deux) ; aucun compte rendu au navigateur ; les
//  fonctions de la route réservées à la clé de service ; PLUS AUCUN MESSAGE ne
//  s'écrit (droit retiré) mais l'historique reste en base, intact ; refus sans
//  la 046 ; rejouable ; « Fermer mon compte » détache.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const M = (f) => path.join(RACINE, 'supabase/migrations', f);
const MIG = M('047-communaute-carte-coucou.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql'].map(M);
const AVANT = ['018-communaute.sql', '019-communaute-discord-classement.sql', '020-communaute-groupes.sql', '025-communaute-accompagnement.sql'].map(M);
const M046 = M('046-communaute-coucous.sql');
const U = {}; for (let i = 1; i <= 30; i++) U['P' + i] = `${String(i).padStart(8, '0')}-2222-4222-8222-222222222222`;
const [A, B, C, D] = [U.P1, U.P2, U.P3, U.P4];
const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).replace(/\s*\n\s*/g, ' ').slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };
const remplace = (s, avant, apres, nom) => { const n = s.split(avant).length - 1; if (n !== 1) throw new Error('mutation ' + nom + ' : ancre introuvable (' + n + ')'); return s.split(avant).join(apres); };
const MUTATIONS = {
  'paire-un-sens': (s) => remplace(s, "                  where ((c.de = p_x and c.a = p_y) or (c.de = p_y and c.a = p_x))\n                    and c.le > pg_catalog.now() - interval '24 hours')\n$$;", "                  where (c.de = p_x and c.a = p_y)\n                    and c.le > pg_catalog.now() - interval '24 hours')\n$$;", 'pus'),
  'paire-sans-groupes': (s) => remplace(s, "  select public.vrm_coucou_recent(p_x, p_y)\n      or exists", "  select exists", 'psg'),
  'plafond-sans-groupes': (s) => remplace(s, "  select (select pg_catalog.count(*) from public.vrm_accomp_coucous c where c.de = p_de and c.le > pg_catalog.now() - interval '24 hours')\n       + (select", "  select (select", 'pl'),
  'sans-blocage': (s) => remplace(s, "  if exists (select 1 from public.vrm_communaute_blocages b where (b.qui = cible and b.bloque = moi) or (b.qui = moi and b.bloque = cible))\n     or exists", "  if exists", 'sb'),
  'sans-sourdine': (s) => remplace(s, "     or exists (select 1 from public.vrm_accomp_sourdines s where s.owner = cible and s.muet = moi and s.actif) then", "     then", 'ss'),
  'hors-carte': (s) => remplace(s, "  if not exists (select 1 from public.vrm_communaute_profils p where p.owner = moi) then\n    return jsonb_build_object('ok', false, 'raison', 'carte');\n  end if;\n", "", 'hc'),
  'ecrire-garde': (s) => remplace(s, "revoke all on function public.vrm_communaute_ecrire(uuid, text) from public, anon, authenticated;", "", 'eg').replace(/  if pg_catalog.has_function_privilege[\s\S]*?end if;\n/, ''),
  'politique-ouverte': (s) => remplace(s, "      using (de = (select auth.uid()) or a = (select auth.uid()));", "      using (true);", 'po'),
  'texte': (s) => remplace(remplace(s, "  le timestamptz not null default now(),\n  constraint vrm_communaute_coucou_pas_soi", "  le timestamptz not null default now(),\n  texte text,\n  constraint vrm_communaute_coucou_pas_soi", 't1'), "'id:uuid,de:uuid,a:uuid,le:timestamp with time zone'", "'id:uuid,de:uuid,a:uuid,le:timestamp with time zone,texte:text'", 't2'),
  'owner-rendu': (s) => remplace(s, "jsonb_build_object('id', c.id, 'de_pid', p.pid,", "jsonb_build_object('id', c.id, 'de', c.de, 'de_pid', p.pid,", 'or'),
  'sourdine-par-autrui': (s) => remplace(s, "  select c.de into auteur from public.vrm_communaute_coucous c where c.id = p_coucou and c.a = moi;", "  select c.de into auteur from public.vrm_communaute_coucous c where c.id = p_coucou;", 'spa'),
  'a-sonner-ouvert': (s) => remplace(s, "grant execute on function public.vrm_carte_coucou_a_sonner(uuid, uuid) to service_role;", "grant execute on function public.vrm_carte_coucou_a_sonner(uuid, uuid) to service_role, authenticated;", 'aso'),
};
if (PROUVE) {
  const noms = Object.keys(MUTATIONS); let rouges = 0;
  for (const nom of noms) {
    const r = spawnSync(process.execPath, [__filename, '--mutation=' + nom], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const n = (r.stdout.match(/^❌ /gm) || []).length, sautee = /NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
    const bon = r.status !== 0 && n > 0 && !sautee; if (bon) rouges++;
    console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté ou ancre introuvable' : 'RESTE VERTE')}`);
  }
  console.log(`\n${rouges}/${noms.length} mutations attrapées.`); process.exit(rouges === noms.length ? 0 : 1);
}
if (!fs.existsSync(MIG) || !fs.existsSync(M046)) { console.log('❌ la migration 047 (ou la 046) est absente : la carte n’a pas de coucou'); process.exit(1); }
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
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-carte-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(60432 + (process.pid % 2000));
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

const rejoindre = (u, pseudo) => J(u, `select public.vrm_communaute_rejoindre(${lit(pseudo)}, 'Lyon', 'FR', 45.75, 4.85);`);
const carte = (u) => J(u, 'select public.vrm_communaute_carte();');
const pidDe = (u) => Q(`select pid from public.vrm_communaute_profils where owner = '${u}'`);
const coucou = (u, pid) => J(u, `select public.vrm_carte_coucou(${lit(pid)});`);
const cl = (u) => J(u, 'select public.vrm_carte_coucou_lire();');
const sourdine = (u, c, oui) => J(u, `select public.vrm_carte_coucou_sourdine(${lit(c)}, ${oui});`);
const vieillir = () => ADM("update public.vrm_communaute_coucous set le = le - interval '25 hours'; update public.vrm_accomp_coucous set le = le - interval '25 hours';");

(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  let SQL = fs.readFileSync(MIG, 'utf8');
  if (MUTATION && !MUTATIONS[MUTATION]) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); }
  try { if (MUTATION) SQL = MUTATIONS[MUTATION](SQL); } catch (e) { console.log('❌ ' + e.message + ' — audit NON exécuté'); process.exit(1); }
  const socleOk = await essaie('socle', () => {
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
  await essaie('sans la 046', () => {
    fraiche('sans', 'socle'); const r = run(SQL);
    dit(!r.ok && /vrm_carte_coucou_prealable/.test(r.err), 'sans la 046, la 047 REFUSE et le dit', r.ok ? 'installée' : r.err.slice(0, 120));
  });
  await essaie('le fichier', () => {
    const sans = fs.readFileSync(MIG, 'utf8').replace(/--[^\n]*/g, '');
    dit(!/\bdelete\b/i.test(sans) && !/\bdrop\b/i.test(sans) && !/\btruncate\b/i.test(sans), 'aucune suppression dans la 047 (l’historique des messages n’est jamais effacé)');
    dit(!/(update|alter table)\s+public\.vrm_communaute_(messages|conversations)\b/i.test(sans), 'la 047 ne touche ni aux messages ni aux conversations d’avant');
  });
  fraiche('base', 'socle');
  const installe = await essaie('installation', () => {
    Q(fs.readFileSync(M046, 'utf8'));
    rejoindre(A, 'alice_carte'); rejoindre(B, 'bruno_carte'); rejoindre(C, 'cam_carte');
    // Un message d'AVANT (018), écrit tant que c'était permis : il doit rester en base.
    const avant = J(A, `select public.vrm_communaute_ecrire(${lit(pidDe(B))}, 'Message d’avant, inventé');`);
    if (!avant || avant.ok !== true) throw new Error('message d’avant impossible : ' + JSON.stringify(avant));
    const r = run(SQL); if (!r.ok) throw new Error(r.err);
    dit(/ESSAI OK/.test(r.err + r.out), 'l’essai de la 047 passe (« ESSAI OK »)', (r.err + r.out).slice(-160));
    dit(run(SQL).ok, 'la 047 se rejoue sans erreur');
    return true;
  });
  if (!installe) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }

  await essaie('plus aucun message, l’historique gardé', () => {
    const r = run(comme(A) + `select public.vrm_communaute_ecrire(${lit(pidDe(B))}, 'Nouveau message');`);
    dit(!r.ok, 'un navigateur ne peut PLUS écrire un message sur la carte', r.ok ? r.out : '');
    dit(Q("select count(*) from public.vrm_communaute_messages where texte = 'Message d’avant, inventé'") === '1', 'le message d’avant est toujours en base (rien d’effacé)');
  });

  await essaie('forme et droits', () => {
    const cols = Q("select string_agg(attname || ':' || format_type(atttypid, atttypmod), ',' order by attnum) from pg_attribute where attrelid = 'public.vrm_communaute_coucous'::regclass and attnum > 0 and not attisdropped");
    dit(cols === 'id:uuid,de:uuid,a:uuid,le:timestamp with time zone', 'un coucou de la carte = (id, de, à, quand), AUCUN texte', cols);
    const sig = Q("select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ' ; ') from pg_proc p where p.proname in ('vrm_carte_coucou', 'vrm_carte_coucou_lire', 'vrm_carte_coucou_sourdine')");
    dit(!/\btext\b|json|character/.test(sig), 'aucune fonction du coucou de la carte ne prend de texte', sig);
    dit(!enRun(A, 'select count(*) from public.vrm_communaute_coucous;').ok && Q("select relforcerowsecurity and relrowsecurity from pg_class where relname = 'vrm_communaute_coucous'") === 't', 'table illisible en direct, RLS forcé');
    const pol = Q("select cmd || '|' || qual from pg_policies where tablename = 'vrm_communaute_coucous'");
    dit(/^SELECT\|/.test(pol) && /de = \( SELECT auth\.uid\(\)/.test(pol) && /a = \( SELECT auth\.uid\(\)/.test(pol), 'règle de lecture : seuls les deux', pol);
    for (const f of [`vrm_carte_coucou_a_sonner('${A}', '${A}')`, `vrm_carte_coucou_auteurs('${A}')`, `vrm_carte_coucou_effacer('${A}')`]) dit(!enRun(B, `select public.${f};`).ok, `${f.split('(')[0]} : pas pour un navigateur`);
    dit(!run(ANON + 'select public.vrm_carte_coucou_lire();').ok, 'anon n’exécute rien');
  });

  let c1;
  await essaie('faire coucou sur la carte', () => {
    dit(coucou(D, pidDe(A)).raison === 'carte', 'qui n’est pas sur la carte ne fait coucou à personne');
    dit(coucou(A, pidDe(A)).raison === 'soi', 'pas à soi-même');
    dit(coucou(A, '99999999-9999-4999-8999-999999999999').raison === 'cible', 'un pid inconnu ⇒ refusé');
    const r = coucou(A, pidDe(B)); c1 = r.id;
    dit(r.ok === true, 'Alice fait coucou à Bruno', JSON.stringify(r));
    dit(coucou(A, pidDe(B)).raison === 'deja' && coucou(B, pidDe(A)).raison === 'deja', 'une paire, un coucou par 24 h, dans un sens ou dans l’autre');
    const lB = cl(B);
    dit(lB.recus.length === 1 && lB.recus[0].de_nom === 'alice_carte' && lB.recus[0].de_pid === pidDe(A), 'Bruno le voit (pseudo et pid public de la carte)', JSON.stringify(lB.recus));
    dit(!JSON.stringify(lB).includes(A) && Object.keys(lB.recus[0]).sort().join() === 'de_nom,de_pid,id,le', 'aucun compte rendu, rien d’autre que qui et quand', Object.keys(lB.recus[0]).join());
    dit(cl(A).deja.includes(pidDe(B)), 'Alice sait que c’est fait (bouton grisé)');
    const so = JSON.parse(Q(SERVEUR + `select public.vrm_carte_coucou_a_sonner(${lit(c1)}, ${lit(A)});`).split('\n').pop());
    dit(so && so.a === B && so.de_nom === 'alice_carte', 'à sonner (clé de service, auteur vérifié) : chez Bruno, avec le pseudo d’Alice', JSON.stringify(so));
    ADM('grant select on public.vrm_communaute_coucous to authenticated;');
    const vus = [A, B, C].map((u) => enRun(u, 'select count(*) from public.vrm_communaute_coucous;').out);
    ADM('revoke select on public.vrm_communaute_coucous from authenticated;');
    dit(vus.join() === '1,1,0', 'même avec un droit, seuls les deux le voient (RLS)', vus.join());
  });

  await essaie('les bornes, partagées avec les groupes', () => {
    vieillir();
    // Un coucou de GROUPE entre Alice et Cam compte aussi pour la carte.
    const g = J(A, "select public.vrm_accomp_creer('Groupe carte', '', 'Alice');");
    const m = J(C, `select public.vrm_accomp_demander('${g.code}', 'Cam', null);`); J(A, `select public.vrm_accomp_decider('${m.id}', true);`);
    dit(J(A, `select public.vrm_coucou_envoyer('${g.id}', '${m.id}');`).ok === true, 'coucou de groupe Alice → Cam');
    dit(coucou(C, pidDe(A)).raison === 'deja', 'sur la carte, Cam ne peut pas le rendre : la paire compte partout');
    for (let i = 5; i <= 26; i++) rejoindre(U['P' + i], 'p' + i);
    let n = 1; for (let i = 5; i <= 26 && n < 20; i++) if (coucou(A, pidDe(U['P' + i])).ok) n++;
    dit(n === 20, '20 en 24 h, groupes et carte confondus', n);
    dit(coucou(A, pidDe(U.P26)).raison === 'plafond', 'le suivant : « plafond »');
  });

  await essaie('bloquer, couper', () => {
    vieillir();
    dit(sourdine(C, c1, true).raison === 'coucou', 'seul celui qui a reçu coupe');
    dit(sourdine(B, c1, true).ok === true && cl(B).recus.length === 0, 'Bruno coupe Alice : ses coucous disparaissent');
    dit(cl(B).sourdines.some((s) => s.nom === 'alice_carte'), 'il la retrouve pour la rétablir');
    dit(coucou(A, pidDe(B)).raison === 'indisponible', 'Alice ne passe plus (refus neutre)');
    sourdine(B, c1, false);
    const conv = Q(`select id from public.vrm_communaute_conversations limit 1`);
    dit(/^[0-9a-f-]{36}$/.test(conv), 'la conversation d’avant est là', conv);
    const b = enRun(B, `select public.vrm_communaute_bloquer('${conv}', true);`);
    dit(b.ok && b.out.trim().endsWith('t'), 'Bruno bloque Alice (018)', b.err || b.out);
    dit(coucou(A, pidDe(B)).raison === 'indisponible', 'Bruno a bloqué Alice (018) : aucun coucou');
  });

  await essaie('route et fermer mon compte', () => {
    const brut = Q(SERVEUR + `select coalesce(public.vrm_carte_coucou_a_sonner(${lit(c1)}, ${lit(A)})::text, 'null');`).split('\n').pop();
    const s = JSON.parse(brut || 'null');
    dit(s === null || (s.a === B && s.de_nom === 'alice_carte'), 'à sonner : chez celui qui reçoit (ou rien après 10 min)', JSON.stringify(s));
    dit(Q(SERVEUR + `select coalesce(public.vrm_carte_coucou_a_sonner(${lit(c1)}, ${lit(C)})::text, 'null');`).split('\n').pop() === 'null', 'avec une autre identité : rien');
    const au = JSON.parse(Q(SERVEUR + `select public.vrm_carte_coucou_auteurs(${lit(B)});`).split('\n').pop());
    dit(Array.isArray(au) && au.every((x) => Object.keys(x).sort().join() === 'de,id'), 'les auteurs, pour la route seulement');
    dit(run(SERVEUR + `select public.vrm_carte_coucou_effacer(${lit(A)});`).ok && Q(`select count(*) from public.vrm_communaute_coucous where de = '${A}' or a = '${A}'`) === '0', '« Fermer mon compte » détache');
  });
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
