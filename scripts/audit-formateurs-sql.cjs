#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 031 — LA COMMUNAUTÉ POUR LES FORMATEURS (10 novembre)
//  node scripts/audit-formateurs-sql.cjs              (le contrôle)
//  node scripts/audit-formateurs-sql.cjs --prouve     (chaque règle réaffaiblie ⇒ ROUGE)
//  node scripts/audit-formateurs-sql.cjs --mutation=nom
//  node scripts/audit-formateurs-sql.cjs --forme      (imprime l'empreinte des tables)
//
//  La 031 (supabase/migrations/031-communaute-formateurs.sql) est EXÉCUTÉE pour
//  de vrai sur un Postgres JETABLE (socle supabase-min + 005-007 + 018, 019, 020,
//  025 telles quelles). Aucune donnée réelle, aucune connexion à la vraie base.
//  Rôles joués comme PostgREST (`set role` + `request.jwt.claims`).
//
//  Ce qu'il prouve : aucune table lisible en direct ; seule la page publique est
//  ouverte à anon, et seulement PUBLIÉE et formateur ABONNÉ, sans compte, email,
//  code ni chiffre ; demander depuis la page = la demande de la 025 (« attente »,
//  partage « rien » par défaut), seulement pour un groupe MONTRÉ ; le formateur
//  ne voit les étapes cochées d'un élève qu'avec SON ACCORD (faux par défaut,
//  révocable), et jamais d'un élève pas accepté ou retiré ; seul le formateur
//  écrit programme et annonces ; seuls les membres ACCEPTÉS lisent les annonces ;
//  10 annonces / 24 h ; une adresse ne se vole pas ; abonnement coupé ⇒ rien ;
//  « Fermer mon compte » dépublie et détache ; la 031 refuse sans la 025.
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync, spawn } = require('child_process');
const RACINE = path.join(__dirname, '..');
const M = (f) => path.join(RACINE, 'supabase/migrations', f);
const MIG = M('031-communaute-formateurs.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql'].map(M);
const AVANT = ['018-communaute.sql', '019-communaute-discord-classement.sql', '020-communaute-groupes.sql', '025-communaute-accompagnement.sql'].map(M);
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
  // Le formateur voit les étapes cochées SANS l'accord de l'élève.
  'progres-sans-accord': { sql: (s) => remplace(s, "  select case when m.statut = 'accepte' and coalesce(a.etapes, false)\n", "  select case when m.statut = 'accepte'\n", 'psa') },
  // L'accord est donné par défaut.
  'accord-par-defaut': { sql: (s) => remplace(s, "  select case when m.statut = 'accepte' and coalesce(a.etapes, false)\n", "  select case when m.statut = 'accepte' and coalesce(a.etapes, true)\n", 'apd') },
  // Les membres pas (ou plus) acceptés figurent au tableau du formateur.
  'progres-non-accepte': { sql: (s) => remplace(s, "from public.vrm_accomp_membres m where m.groupe = g.id and m.statut = 'accepte'), '[]'::jsonb))", "from public.vrm_accomp_membres m where m.groupe = g.id), '[]'::jsonb))", 'pna') },
  // Une page pas publiée est lisible.
  'page-non-publiee': { sql: (s) => remplace(s, 'from public.vrm_form_pages x where x.adresse = a and x.publiee;', 'from public.vrm_form_pages x where x.adresse = a;', 'pnp') },
  // La page d'un formateur qui ne paie plus reste en ligne.
  'page-sans-abonnement': { sql: (s) => remplace(s, "  if p.owner is null or not public.vrm_acces_pour(p.owner) then return jsonb_build_object('ok', false, 'raison', 'page'); end if;", "  if p.owner is null then return jsonb_build_object('ok', false, 'raison', 'page'); end if;", 'psa2') },
  // La page rend le compte du formateur.
  'page-rend-owner': { sql: (s) => remplace(s, "  return jsonb_build_object('ok', true, 'adresse', a, 'nom', p.nom,", "  return jsonb_build_object('ok', true, 'owner', p.owner, 'adresse', a, 'nom', p.nom,", 'pro') },
  // On rejoint par la page un groupe que le formateur n'y montre pas.
  'demander-hors-vitrine': { sql: (s) => remplace(s, '    join public.vrm_form_vitrine v on v.groupe = g.id and v.montre\n   where p.adresse = a', '   where p.adresse = a', 'dhv') },
  // Demander depuis la page partage les chiffres par défaut.
  'demander-partage-defaut': { sql: (s) => remplace(s, "  return public.vrm_accomp_demander(c, p_nom, coalesce(p_partage, 'rien'));", "  return public.vrm_accomp_demander(c, p_nom, coalesce(p_partage, 'chiffres'));", 'dpd') },
  // N'importe qui écrit le programme d'un groupe.
  'etape-par-autrui': { sql: (s) => remplace(s, "  if public.vrm_form_mon_groupe(p_groupe) is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;\n  if pg_catalog.char_length(t) not between 2 and 80", "  if pg_catalog.char_length(t) not between 2 and 80", 'epa') },
  // N'importe qui écrit une annonce.
  'annonce-par-autrui': { sql: (s) => remplace(s, "  if public.vrm_form_mon_groupe(p_groupe) is null then return jsonb_build_object('ok', false, 'raison', 'pas-createur'); end if;\n  if pg_catalog.char_length(t) not between 1 and 1000", "  if pg_catalog.char_length(t) not between 1 and 1000", 'apa') },
  // Un élève en attente (ou retiré) lit les annonces.
  'annonces-non-membre': { sql: (s) => remplace(s, "                  where m.owner = auth.uid() and m.statut = 'accepte' and g.ferme_le is null), '[]'::jsonb))", "                  where m.owner = auth.uid() and m.statut <> 'parti'), '[]'::jsonb))", 'anm') },
  // Plus de plafond d'annonces.
  'plafond-annonces': { sql: (s) => remplace(s, "interval '24 hours') >= 10 then", "interval '24 hours') >= 100000 then", 'pa') },
  // Une adresse prise par un autre se vole.
  'adresse-volee': { sql: (s) => remplace(s, '  if exists (select 1 from public.vrm_form_pages x where x.adresse = a and x.owner <> moi) then', '  if false then', 'av') },
  // On coche une étape d'un autre groupe.
  'etape-autre-groupe': { sql: (s) => remplace(s, 'where e.id = p_etape and e.groupe = m.groupe and e.retiree_le is null) then', 'where e.id = p_etape and e.retiree_le is null) then', 'eag') },
  // « Fermer mon compte » laisse la page en ligne.
  'effacer-garde': { sql: (s) => remplace(s, '   where p.owner = p_owner; get diagnostics k = row_count; n := n + k;', '   where false; get diagnostics k = row_count; n := n + k;', 'eg') },
  // anon lit l'espace du formateur.
  'anon-lire': { apres: 'grant execute on function public.vrm_form_lire() to anon;' },
  // La table des progrès lisible par un navigateur.
  'progres-lisible': { apres: 'grant select on public.vrm_form_progres to authenticated; alter table public.vrm_form_progres no force row level security; alter table public.vrm_form_progres disable row level security;' },
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
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-form-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(58500 + (process.pid % 2000));
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

const creer = (u, nom, q) => J(u, `select public.vrm_accomp_creer(${lit(nom)}, '', ${lit(q)});`);
const decider = (u, m, oui) => J(u, `select public.vrm_accomp_decider(${lit(m)}, ${oui});`);
const retirer = (u, m) => J(u, `select public.vrm_accomp_retirer(${lit(m)});`);
const lire = (u) => J(u, 'select public.vrm_form_lire();');
const ranger = (u, a, nom, pres, pub) => J(u, `select public.vrm_form_page_ranger(${lit(a)}, ${lit(nom)}, ${lit(pres)}, ${pub});`);
const vitrine = (u, g, oui) => J(u, `select public.vrm_form_vitrine_regler(${lit(g)}, ${oui});`);
const pageAnon = (a) => { const r = run(ANON + `select public.vrm_form_page(${lit(a)});`); if (!r.ok) throw new Error(r.err.slice(0, 300)); return JSON.parse(r.out.split('\n').filter(Boolean).pop() || 'null'); };
const demPage = (u, a, g, nom, p) => J(u, `select public.vrm_form_demander(${lit(a)}, ${lit(g)}, ${lit(nom)}, ${p === undefined ? 'null' : lit(p)});`);
const etape = (u, g, t) => J(u, `select public.vrm_form_etape(${lit(g)}, ${lit(t)});`);
const etapeRetirer = (u, e) => J(u, `select public.vrm_form_etape_retirer(${lit(e)});`);
const annonce = (u, g, t) => J(u, `select public.vrm_form_annonce(${lit(g)}, ${lit(t)});`);
const annonceRetirer = (u, a) => J(u, `select public.vrm_form_annonce_retirer(${lit(a)});`);
const cocher = (u, m, e, f) => J(u, `select public.vrm_form_cocher(${lit(m)}, ${lit(e)}, ${f});`);
const accord = (u, m, oui) => J(u, `select public.vrm_form_accord(${lit(m)}, ${oui});`);
const progresDe = (l, gid, mid) => ((l.crees.find((g) => g.groupe === gid) || {}).progres || []).find((p) => p.membre === mid);

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
  await essaie('socle 018-020', () => { DB = 'socle'; for (const f of AVANT.slice(0, 3)) Q(fs.readFileSync(f, 'utf8')); return true; });

  await essaie('sans la 025', () => {
    fraiche('sans', 'socle');
    const r = run(SQL);
    dit(!r.ok && /vrm_form_prealable/.test(r.err), 'sans la 025, la migration REFUSE et le dit', r.ok ? 'installée quand même' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_class where relname like 'vrm\\_form\\_%'") === '0', "et rien n'est installé");
  });
  await essaie('socle 025', () => { DB = 'socle'; Q(fs.readFileSync(AVANT[3], 'utf8')); return true; });

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
    dit(!/\bdelete\b/i.test(sansComm) && !/\bdrop\b/i.test(sansComm) && !/\btruncate\b/i.test(sansComm), "la 031 ne contient AUCUNE suppression (elle se colle d'un bloc)");
    dit(!/app_data|vinted_accounts|harvest_|vrm_accomp_partages/i.test(sansComm), "la 031 ne lit AUCUNE donnée d'un vendeur ni ses chiffres partagés (025)");
    dit(!/@@EMPREINTE@@/.test(brut), "l'empreinte des tables est posée (pas un gabarit)");
    dit(/^-- ── ESSAI[\s\S]*?--     begin;[\s\S]*?--     rollback;/m.test(brut.split('\nbegin;')[0]), "l'essai BEGIN … ROLLBACK est en tête du fichier");
  });

  await essaie('forme', () => {
    fraiche('ancienne', 'socle');
    Q('create table public.vrm_form_pages (owner uuid primary key, nom text);');
    const r = run(SQL);
    dit(!r.ok && /vrm_form_forme/.test(r.err), "une table vrm_form_pages d'une autre forme fait REFUSER la migration", r.ok ? 'installée quand même' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_form\\_%'") === '0', "et rien n'est installé (aucune fonction)");
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

  await essaie("l'essai d'en-tête", () => {
    // L'essai écrit dans l'en-tête, joué tel quel sur une base fraîche : « ESSAI OK », rien gardé.
    fraiche('essai', 'socle');
    const brut = fs.readFileSync(MIG, 'utf8');
    const tete = brut.split('\nbegin;')[0];
    const bloc = (tete.match(/--     do \$e\$[\s\S]*?--     end \$e\$;/) || [''])[0].replace(/^--     /gm, '');
    const corps = brut.slice(brut.indexOf('\nbegin;') + 7, brut.lastIndexOf('commit;'));
    const r = run('begin;\n' + corps + '\n' + bloc + '\nrollback;');
    dit(r.ok && /ESSAI OK/.test(r.err), "l'essai d'en-tête dit « ESSAI OK »", (r.err || r.out).slice(-200));
    dit(Q("select count(*) from pg_class where relname like 'vrm\\_form\\_%'") === '0', "et ROLLBACK : rien n'est gardé");
    DB = 'base';
  });

  await essaie('droits', () => {
    for (const t of ['vrm_form_pages', 'vrm_form_vitrine', 'vrm_form_etapes', 'vrm_form_progres', 'vrm_form_accords', 'vrm_form_annonces']) {
      const r = enRun(U.A, `select count(*) from public.${t};`);
      dit(!r.ok, `un navigateur connecté ne lit pas ${t} en direct`, r.ok ? 'lu : ' + r.out : '');
      const a = run(ANON + `select count(*) from public.${t};`);
      dit(!a.ok, `anon ne lit pas ${t}`, a.ok ? a.out : '');
      dit(Q(`select relforcerowsecurity and relrowsecurity from pg_class where relname = '${t}'`) === 't', `${t} : RLS activé et forcé`);
    }
    dit(!run(ANON + 'select public.vrm_form_lire();').ok, "anon n'exécute pas vrm_form_lire (seule la page publique lui est ouverte)");
    dit(run(ANON + "select public.vrm_form_page('personne');").ok, 'anon exécute vrm_form_page (la page publique)');
    dit(!run(SERVEUR + 'select public.vrm_form_lire();').ok, 'la clé de service ne lit pas les espaces (seul « effacer » lui est permis)');
    for (const f of ['vrm_form_progres_vu', 'vrm_form_faits_de', 'vrm_form_mon_groupe', 'vrm_form_annonces_de']) {
      const r = enRun(U.A, `select public.${f}('${U.B}');`);
      dit(!r.ok, `${f} (aide interne) n'est exécutable par personne`, r.ok ? r.out : '');
    }
  });

  let G, G2, mB, mC, e1, e2;
  await essaie('la page publique', () => {
    G = creer(U.A, 'Formation Sneakers', 'Coach Julien').id;
    G2 = creer(U.A, 'Cohorte privée', 'Coach Julien').id;
    dit(ranger(U.A, 'Coach Julien', 'Coach Julien', '', false).raison === 'adresse', 'une adresse avec espaces ou majuscules mêlées est refusée');
    dit(ranger(U.A, 'coach--julien', 'Coach Julien', '', false).raison === 'adresse', 'une adresse avec « -- » est refusée');
    dit(ranger(U.A, 'coach-julien', 'j@x.fr', '', false).raison === 'nom', 'un nom qui ressemble à un email est refusé');
    dit(ranger(U.A, 'coach-julien', 'Coach Julien', 'a<script>', false).raison === 'presentation', 'une présentation avec « < » est refusée');
    dit(ranger(U.A, 'coach-julien', 'Coach Julien', 'Je forme des revendeurs depuis 2022.', false).ok === true, 'la page est rangée (pas publiée)');
    dit(pageAnon('coach-julien').ok === false, 'PAS publiée ⇒ illisible sans compte (et la même réponse qu’une page inconnue)');
    dit(J(U.B, "select public.vrm_form_page('coach-julien');").ok === false, 'PAS publiée ⇒ illisible même connecté');
    ranger(U.A, 'coach-julien', 'Coach Julien', 'Je forme des revendeurs depuis 2022.', true);
    const p = pageAnon('Coach-Julien');
    dit(p.ok === true && p.nom === 'Coach Julien' && /depuis 2022/.test(p.presentation), 'publiée ⇒ lisible sans compte (adresse en minuscules)', JSON.stringify(p));
    dit(Array.isArray(p.groupes) && p.groupes.length === 0, 'aucun groupe montré tant que le formateur n’en a mis aucun');
    dit(vitrine(U.B, G, true).raison === 'pas-createur', 'un autre ne met pas le groupe sur la page');
    dit(vitrine(U.A, G, true).ok === true, 'le formateur montre « Formation Sneakers »');
    const p2 = pageAnon('coach-julien');
    dit(p2.groupes.length === 1 && p2.groupes[0].id === G && p2.groupes[0].nom === 'Formation Sneakers', 'la page montre ce groupe, et lui seul (pas la cohorte privée)', JSON.stringify(p2.groupes));
    const s = JSON.stringify(p2), code = Q(`select code from public.vrm_accomp_groupes where id = '${G}'`);
    dit(!s.includes(U.A) && !s.includes(code) && !/owner|code|membres|chiffres|email/.test(s), 'la page ne rend ni compte, ni code, ni membres, ni chiffres', s.slice(0, 200));
    dit(ranger(U.B, 'coach-julien', 'Bea', '', false).raison === 'adresse-prise', 'une adresse prise par un autre ne se vole pas');
    dit(pageAnon('coach-julien').nom === 'Coach Julien', 'et la page reste celle du formateur');
  });

  await essaie('demander depuis la page', () => {
    dit(demPage(U.A, 'coach-julien', G, 'Coach', undefined).raison === 'soi', 'le formateur ne demande pas son propre groupe');
    dit(demPage(U.B, 'coach-julien', G2, 'Élève Bea', undefined).raison === 'page', 'un groupe PAS montré sur la page ne se rejoint pas par elle');
    dit(demPage(U.B, 'autre-page', G, 'Élève Bea', undefined).raison === 'page', 'une autre adresse ne mène pas à ce groupe');
    const d = demPage(U.B, 'coach-julien', G, 'Élève Bea', undefined);
    mB = d.id;
    dit(d.ok === true && d.statut === 'attente', 'la demande part « en attente » : le formateur doit valider', JSON.stringify(d));
    dit(Q(`select partage from public.vrm_accomp_membres where id = '${mB}'`) === 'rien', 'partage « rien » par défaut (la règle de la 025)');
    dit(lire(U.B).rejoints.length === 0, 'en attente : aucun programme ni annonce visibles');
    dit(progresDe(lire(U.A), G, mB) === undefined, 'en attente : absente du tableau du formateur');
    const dC = demPage(U.C, 'coach-julien', G, 'Élève Cam', 'chiffres');
    mC = dC.id;
    decider(U.A, mB, true); decider(U.A, mC, true);
    vitrine(U.A, G, false);
    dit(demPage(U.D, 'coach-julien', G, 'Élève Dan', undefined).raison === 'page', 'retiré de la page ⇒ plus de demande par elle');
    vitrine(U.A, G, true);
  });

  await essaie('le programme et le consentement', () => {
    dit(etape(U.B, G, 'Installer l’extension').raison === 'pas-createur', 'un élève n’écrit pas le programme');
    dit(etape(U.A, G, 'a<b').raison === 'titre', 'un titre avec « < » est refusé');
    e1 = etape(U.A, G, 'Installer l’extension').id; e2 = etape(U.A, G, 'Première vente').id;
    const eG2 = etape(U.A, G2, 'Étape de la cohorte privée').id;
    const lB = lire(U.B);
    dit(lB.rejoints.length === 1 && lB.rejoints[0].etapes.map((e) => e.id).join() === [e1, e2].join(), 'l’élève accepté voit le programme, dans l’ordre');
    dit(lB.rejoints[0].accord === false, 'son accord est FAUX par défaut');
    dit(cocher(U.B, mB, e1, true).ok === true, 'il coche « Installer l’extension »');
    dit(cocher(U.B, mB, eG2, true).raison === 'etape', 'une étape d’un autre groupe ne se coche pas');
    dit(cocher(U.D, mB, e1, true).raison === 'adhesion', 'personne ne coche à sa place');
    dit(JSON.stringify(lire(U.B).rejoints[0].faits) === JSON.stringify([e1]), 'il voit sa coche');
    let p = progresDe(lire(U.A), G, mB);
    dit(p && !('faits' in p), 'SANS son accord, le formateur ne voit RIEN de ses étapes', JSON.stringify(p));
    dit(accord(U.D, mB, true).raison === 'adhesion', 'personne ne donne l’accord à sa place');
    dit(accord(U.B, mB, true).ok === true, 'il donne son accord');
    p = progresDe(lire(U.A), G, mB);
    dit(p && JSON.stringify(p.faits) === JSON.stringify([e1]), 'avec son accord, le formateur voit SES coches', JSON.stringify(p));
    accord(U.B, mB, false);
    p = progresDe(lire(U.A), G, mB);
    dit(p && !('faits' in p), 'accord retiré ⇒ plus rien, tout de suite', JSON.stringify(p));
    dit(cocher(U.B, mB, e1, false).ok === true && lire(U.B).rejoints[0].faits.length === 0, 'il décoche (rien n’est supprimé : la coche est vidée)');
    cocher(U.B, mB, e2, true); accord(U.B, mB, true);
    dit(etapeRetirer(U.B, e2).raison === 'pas-createur', 'un élève ne retire pas une étape');
    dit(etapeRetirer(U.A, e2).ok === true, 'le formateur retire une étape');
    dit(lire(U.B).rejoints[0].etapes.length === 1 && lire(U.B).rejoints[0].faits.length === 0, 'elle disparaît du programme et des coches');
    const sA = JSON.stringify(lire(U.A));
    dit(!/chiffres|detail|"ventes"|"ca"/.test(sA), 'l’espace du formateur ne porte AUCUN chiffre d’élève (ils restent ceux de la 025, par partage)');
    dit(!sA.includes(U.B) && !sA.includes(U.C), 'ni le compte d’un élève');
  });

  await essaie('les annonces', () => {
    dit(annonce(U.B, G, 'Coucou').raison === 'pas-createur', 'un élève n’écrit pas d’annonce');
    dit(annonce(U.A, G, '   ').raison === 'texte', 'une annonce vide est refusée');
    const a1 = annonce(U.A, G, 'Live jeudi 20 h : les prix de fin d’année.').id;
    dit(lire(U.B).rejoints[0].annonces[0].id === a1, 'l’élève accepté la lit');
    const dD = demPage(U.D, 'coach-julien', G, 'Élève Dan', undefined);
    dit(dD.statut === 'attente' && lire(U.D).rejoints.length === 0, 'un élève EN ATTENTE ne lit pas les annonces');
    let n = 1, refus = null;
    for (let i = 0; i < 10; i++) { const r = annonce(U.A, G, 'Annonce ' + i); if (r.ok) n++; else { refus = r.raison; break; } }
    dit(n === 10 && refus === 'plafond-annonces', '10 annonces par 24 h au plus', `${n} · ${refus}`);
    dit(annonceRetirer(U.B, a1).raison === 'pas-createur', 'un élève ne retire pas une annonce');
    dit(annonceRetirer(U.A, a1).ok === true && !lire(U.B).rejoints[0].annonces.some((x) => x.id === a1), 'le formateur la retire : elle disparaît');
  });

  await essaie('retrait et départ', () => {
    retirer(U.A, mB);
    dit(progresDe(lire(U.A), G, mB) === undefined, 'élève retiré ⇒ absent du tableau du formateur (même avec son accord)');
    dit(lire(U.B).rejoints.length === 0, 'et il ne voit plus le programme ni les annonces');
    dit(cocher(U.B, mB, e1, true).raison === 'adhesion', 'ni ne coche');
  });

  await essaie('abonnement', () => {
    ADM("update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';");
    dit(pageAnon('coach-julien').ok === false, 'formateur sans abonnement ⇒ sa page n’est plus lisible');
    dit(lire(U.A).acces === false, '⇒ il ne lit plus son espace');
    dit(etape(U.A, G, 'Nouvelle étape').raison === 'abonnement', '⇒ il n’écrit plus');
    dit(accord(U.C, mC, false).ok === true, 'sans abonnement, RETIRER son accord marche toujours');
    dit(accord(U.C, mC, true).raison === 'abonnement', 'le donner, non');
    dit(ranger(U.A, 'coach-julien', 'Coach Julien', '', false).ok === true && Q(`select publiee from public.vrm_form_pages where owner = '${U.A}'`) === 'f', 'sans abonnement, DÉPUBLIER sa page marche toujours');
    ADM(`insert into public.abonnements (owner, statut) values ('${U.A}', 'active');`);
    ranger(U.A, 'coach-julien', 'Coach Julien', 'Je forme des revendeurs depuis 2022.', true);
    dit(pageAnon('coach-julien').ok === true, 'formateur abonné ⇒ la page revient');
    ADM("update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire'; truncate public.abonnements;");
  });

  await essaie('fermer mon compte', () => {
    accord(U.C, mC, true);
    const rC = run(SERVEUR + `select public.vrm_form_effacer(${lit(U.C)});`);
    dit(rC.ok && Q(`select count(*) from public.vrm_form_accords where membre = '${mC}' and etapes`) === '0', '« Fermer mon compte » d’un élève retire ses accords', rC.err || rC.out);
    const rA = run(SERVEUR + `select public.vrm_form_effacer(${lit(U.A)});`);
    dit(rA.ok && pageAnon('coach-julien').ok === false, '« Fermer mon compte » du formateur dépublie sa page', rA.err || rA.out);
    dit(Q(`select count(*) from public.vrm_form_pages where owner = '${U.A}'`) === '0' && Q("select count(*) from public.vrm_form_pages where nom = 'Coach Julien' or presentation <> ''") === '0', 'plus aucune page ne porte son compte, son nom ni sa présentation');
    dit(Q('select count(*) from public.vrm_form_vitrine where montre') === '0', 'ses groupes ne sont plus montrés');
    dit(ranger(U.D, 'coach-julien', 'Dan', '', false).ok === true, 'son adresse est libérée');
    dit(!run(comme(U.A) + `select public.vrm_form_effacer(${lit(U.B)});`).ok, "un navigateur n'efface personne");
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko ? 1 : 0);
})();
