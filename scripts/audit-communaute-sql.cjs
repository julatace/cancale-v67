#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 018 — LA CARTE DE LA COMMUNAUTÉ (20 octobre)
//  node scripts/audit-communaute-sql.cjs              (le contrôle)
//  node scripts/audit-communaute-sql.cjs --prouve     (chaque règle réaffaiblie
//                                                      doit faire passer l'audit au ROUGE)
//  node scripts/audit-communaute-sql.cjs --mutation=nom
//
//  La migration (supabase/migrations/018-communaute.sql) est EXÉCUTÉE pour de
//  vrai, sur un Postgres JETABLE qui imite la production (scripts/agent-sql/
//  supabase-min.sql + 005, 006, 007 telles quelles). Aucune donnée réelle,
//  aucune connexion à la vraie base. Les rôles sont joués comme PostgREST les
//  joue (`set role` + `request.jwt.claims`).
//
//  Ce qu'il prouve : opt-in (invisible tant qu'on n'a pas rejoint, retrait =
//  ligne supprimée) ; la position est ARRONDIE (0,05°) et la base refuse une
//  position exacte ; la carte ne rend ni l'identifiant du compte ni l'email ;
//  on n'écrit qu'à quelqu'un de visible, et seulement si l'on est visible ; on
//  ne lit QUE ses conversations ; un bloqué n'atteint plus personne (sans le
//  savoir) et disparaît de la carte de celui qui bloque ; le signalement est
//  rangé et lisible par le propriétaire seul ; plafonds 20/h et 5 nouvelles
//  conversations par jour ; abonnement coupé ⇒ rien ; anon ⇒ rien ; aucune
//  table lisible en direct ; « Fermer mon compte » efface tout ; l'essai
//  annulé ne laisse rien ; `--verifier` rend ok, et ok = false dès qu'une
//  garde est touchée ; une table d'une autre forme fait tout refuser.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/018-communaute.sql');
const MIG19 = path.join(RACINE, 'supabase/migrations/019-communaute-discord-classement.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const OUTIL_SRC = path.join(__dirname, 'communaute-sql/essai-annule.cjs');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql']
  .map((f) => path.join(RACINE, 'supabase/migrations', f));
// Des identités INVENTÉES.
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const C = '33333333-3333-3333-3333-333333333333';   // jamais sur la carte
const P = ['1', '2', '3', '4', '5', '6'].map((d) => '44444444-4444-4444-4444-44444444440' + d);
const E = '55555555-5555-5555-5555-555555555555';   // ouvre trop de conversations
const PROPRIO = '99999999-9999-9999-9999-999999999999';

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
const sansForme = (s) => remplace(s, '  if v is distinct from ', '  if false and v is distinct from ', 'forme');
const MUTATIONS = {
  // Lire les messages d'une conversation dont on n'est pas participant.
  'lecture-autrui': { sql: (s) => remplace(s, "    from public.vrm_communaute_conversations x where x.id = p_conv and (x.a = moi or x.b = moi);\n  if autre is null then return null; end if;",
    "    from public.vrm_communaute_conversations x where x.id = p_conv;\n  if autre is null then return null; end if;", 'lecture-autrui') },
  // Position exacte : ni arrondi dans la fonction, ni contrainte.
  'position-exacte': { sql: (s) => sansForme(remplace(remplace(remplace(remplace(s,
    '  la := pg_catalog.round(pg_catalog.round(p_lat * 20) / 20, 2);', '  la := p_lat;', 'pe1'),
    '  lo := pg_catalog.round(pg_catalog.round(p_lon * 20) / 20, 2);', '  lo := p_lon;', 'pe2'),
    ' and lat = round(lat * 20) / 20)', ')', 'pe3'),
    ' and lon = round(lon * 20) / 20)', ')', 'pe4')) },
  'sans-arrondi-fonction': { sql: (s) => remplace(s, '  la := pg_catalog.round(pg_catalog.round(p_lat * 20) / 20, 2);', '  la := p_lat;', 'saf') },
  // Un bloqué qui écrit : son message arrive.
  'bloque-ecrit': { sql: (s) => remplace(s, 'values (c, moi, t, exists (select 1 from public.vrm_communaute_blocages b where b.qui = autre and b.bloque = moi));', 'values (c, moi, t, false);', 'bloque-ecrit') },
  'anon-lit': { apres: 'grant execute on function public.vrm_communaute_carte() to anon;' },
  'quitter-garde': { sql: (s) => remplace(s, '  delete from public.vrm_communaute_profils p where p.owner = moi;\n  return found;', '  update public.vrm_communaute_profils p set maj_le = pg_catalog.now() where p.owner = moi;\n  return found;', 'quitter-garde') },
  'owner-expose': { sql: (s) => remplace(s, "'lat', p.lat, 'lon', p.lon, 'moi', p.owner = auth.uid(),", "'lat', p.lat, 'lon', p.lon, 'moi', p.owner = auth.uid(), 'owner', p.owner,", 'owner-expose') },
  'invisible-ecrit': { sql: (s) => remplace(s, "    return jsonb_build_object('ok', false, 'raison', 'invisible');\n", '    null;\n', 'invisible-ecrit') },
  'plafond-heure': { sql: (s) => remplace(s, 'if n >= 20 then return jsonb_build_object', 'if n >= 100000 then return jsonb_build_object', 'plafond-heure') },
  'plafond-jour': { sql: (s) => remplace(s, 'if n >= 5 then return', 'if n >= 100000 then return', 'plafond-jour') },
  'signalements-tous': { sql: (s) => remplace(s, "  select case when auth.uid() is null\n      or auth.uid()::text is distinct from (select r.valeur from public.vrm_reglages r where r.cle = 'proprietaire') then null",
    '  select case when auth.uid() is null then null', 'signalements-tous') },
  'droits-table': { sql: (s) => remplace(s, 'revoke all on public.vrm_communaute_messages from public, anon, authenticated, service_role;\n', '', 'droits-table') },
  'effacer-incomplet': { sql: (s) => remplace(s, '  delete from public.vrm_communaute_conversations c where c.a = p_owner or c.b = p_owner; get diagnostics k = row_count; n := n + k;\n', '', 'effacer-incomplet') },
  'abonnement-ignore': { sql: (s) => remplace(s, '                  where (p.owner = auth.uid() or public.vrm_acces_pour(p.owner))', '                  where true', 'abonnement-ignore') },
  'blocage-visible': { sql: (s) => remplace(s, '                    and not exists (select 1 from public.vrm_communaute_blocages b where b.qui = auth.uid() and b.bloque = p.owner)), \'[]\'::jsonb))',
    "                    ), '[]'::jsonb))", 'blocage-visible') },
  'forme-ignoree': { sql: (s) => sansForme(s) },
  'verifier-droits': { outil: (s) => remplace(s, "    droits: `json_array_length(e.j -> 'droits') = 0`,\n", '', 'verifier-droits') },
  // ── 019 : Discord et classement ──
  // Le chiffre envoyé par le navigateur : la fonction l'accepterait.
  'chiffre-client': { sql19: (s) => remplace(remplace(remplace(remplace(s,
    'create or replace function public.vrm_communaute_classement(p_periode text)', 'create or replace function public.vrm_communaute_classement(p_periode text, p_ventes integer default null)', 'cc1'),
    "    select m.*, (\n      select pg_catalog.count(distinct x.tx) from (", "    select m.*, coalesce(case when m.owner = moi then p_ventes end, (\n      select pg_catalog.count(distinct x.tx) from (", 'cc2'),
    "    ) ventes\n    from membres m", "    )) ventes\n    from membres m", 'cc3'),
    'revoke all on function public.vrm_communaute_classement(text) from', 'revoke all on function public.vrm_communaute_classement(text, integer) from', 'cc4')
    .replace('grant execute on function public.vrm_communaute_classement(text) to authenticated;', 'grant execute on function public.vrm_communaute_classement(text, integer) to authenticated;') },
  'non-inscrit-visible': { sql19: (s) => remplace(s, '     where p.classement and (p.owner = moi or public.vrm_acces_pour(p.owner))', '     where (p.owner = moi or public.vrm_acces_pour(p.owner))', 'niv') },
  'annulee-comptee': { sql19: (s) => remplace(s, "        and x.s !~* '(annul|cancel|refus|rembours|retour|suspend|paiement\\s+a\\s+[ée]chou|[ée]chec\\s+du\\s+paiement)'\n", '', 'annulee') },
  'autre-vendeur': { sql19: (s) => remplace(s, 'join public.app_data a on a.owner = m.owner and a.id =', 'join public.app_data a on a.id =', 'autre-vendeur') },
  'compte-non-lie': { sql19: (s) => remplace(s, '         where va.owner = m.owner\n', '         where true\n', 'compte-non-lie') },
  'compte-masque': { sql19: (s) => remplace(s, "                              and (h.data -> 'vinted_accounts_hidden') ? va.vinted_user_id)", "                              and false)", 'masque') },
  'sans-dedoublon': { sql19: (s) => remplace(s, 'pg_catalog.count(distinct x.tx)', 'pg_catalog.count(x.tx)', 'dedoublon') },
  'fuseau-utc': { sql19: (s) => s.split("'Europe/Paris';").join("'UTC';") },
  'abonnement-classement': { sql19: (s) => remplace(s, '     where p.classement and (p.owner = moi or public.vrm_acces_pour(p.owner))', '     where p.classement', 'abo-cl') },
  'owner-classement': { sql19: (s) => remplace(s, "'pays', z.pays, 'ventes', z.ventes, 'moi', z.owner = moi)", "'pays', z.pays, 'ventes', z.ventes, 'moi', z.owner = moi, 'owner', z.owner)", 'owner-cl') },
  'discord-libre': { sql19: (s) => remplace(remplace(s.split("if v not in ('49e9d1d958352ebb3063719036ef25b5', ").join("if false and v not in ('49e9d1d958352ebb3063719036ef25b5', ").replace("  if v is distinct from '", "  if false and v is distinct from '"),
    "  elsif d !~ '^[a-z0-9._]{2,32}$' or pg_catalog.strpos(d, '..') > 0 then", "  elsif false then", 'dl1'),
    "      check (discord is null or (discord ~ '^[a-z0-9._]{2,32}$' and position('..' in discord) = 0));", '      check (true);', 'dl2') },
  'discord-sans-carte': { sql19: (s) => remplace(s, "  if not exists (select 1 from public.vrm_communaute_profils p where p.owner = moi) then\n    return jsonb_build_object('ok', false, 'raison', 'invisible');\n  end if;\n  if d = '' then", "  if d = '' then", 'dsc') },
  'effacer-019': { apres19: "create or replace function public.vrm_communaute_effacer(p_owner uuid) returns integer language plpgsql volatile security definer set search_path = '' as $$ begin return 0; end $$;" },
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
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-communaute-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(54432 + (process.pid % 2000));
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
const en = (u, sql) => Q(comme(u) + sql);
const enRun = (u, sql) => run(comme(u) + sql);
const J = (u, sql) => JSON.parse(en(u, sql) || 'null');
const lignes = (s) => s.split('\n').filter(Boolean);
const fraiche = (nom, modele) => { ADM(`drop database if exists ${nom}`); Q(`create database ${nom} template ${modele} owner postgres`, { db: 'postgres', role: 'supabase_admin' }); DB = nom; };
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";

let OUTIL = OUTIL_SRC, FMIG = MIG;
const verifier = (db) => {
  const v = spawnSync(process.execPath, [OUTIL, '--verifier', '--migration=' + FMIG], { encoding: 'utf8' });
  if (v.status !== 0) throw new Error('verifier : ' + v.stderr.slice(0, 200));
  const r = run(v.stdout, { db });
  if (!r.ok) throw new Error('verifier (SQL) : ' + r.err.slice(0, 300));
  return JSON.parse(lignes(r.out).pop());
};
const rejoindre = (u, ps, ville, lat, lon, pays = 'FR') => J(u, `select public.vrm_communaute_rejoindre(${lit(ps)}, ${lit(ville)}, ${lit(pays)}, ${lat}, ${lon});`);
const carte = (u) => J(u, 'select public.vrm_communaute_carte();');
const ecrire = (u, pid, t) => J(u, `select public.vrm_communaute_ecrire(${lit(pid)}, ${lit(t)});`);
const fil = (u, c) => J(u, `select public.vrm_communaute_fil(${lit(c)});`);
const convs = (u) => J(u, 'select public.vrm_communaute_conversations();');

(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  let SQL = fs.readFileSync(MIG, 'utf8');
  const mut = MUTATION ? MUTATIONS[MUTATION] : null;
  if (MUTATION && !mut) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); }
  try {
    if (mut && mut.sql) SQL = mut.sql(SQL);
    if (mut && mut.outil) { OUTIL = path.join(DIR, 'outil.cjs'); fs.writeFileSync(OUTIL, mut.outil(fs.readFileSync(OUTIL_SRC, 'utf8'))); }
  } catch (e) { console.log('❌ ' + e.message + ' — audit NON exécuté'); process.exit(1); }
  FMIG = path.join(DIR, '018.sql'); fs.writeFileSync(FMIG, SQL);

  const socleOk = await essaie('préparer le socle (rôles, droits par défaut, 005-007)', () => {
    Q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin', db: 'postgres' });
    DB = 'socle';
    ADM(fs.readFileSync(MIN, 'utf8'));
    ADM('alter table auth.users add column if not exists email text;');
    for (const f of SOCLE) Q(fs.readFileSync(f, 'utf8'));
    dit(Q("select rolsuper from pg_roles where rolname = 'postgres'") === 'f', 'le socle imite la production : `postgres` n\'est PAS superutilisateur');
    return true;
  });
  if (!socleOk) { console.log('\n❌ socle impossible — audit NON exécuté'); process.exit(1); }
  const REGLES_AVANT = Q("select string_agg(tablename || policyname || coalesce(qual,''), ',' order by tablename, policyname) from pg_policies");

  await essaie('essai annulé', () => {
    fraiche('essai', 'socle');
    const e = spawnSync(process.execPath, [OUTIL_SRC, '--migration=' + FMIG], { encoding: 'utf8' });
    if (e.status !== 0) throw new Error(e.stderr.slice(0, 200));
    const r = run(e.stdout);
    dit(r.ok, "l'essai annulé passe d'un bloc sur le socle", r.err);
    if (r.ok) { const j = JSON.parse(lignes(r.out).pop()); dit(j.tables === 5 && j.rls === true, "l'essai voit les cinq tables installées (RLS forcé) avant d'annuler", JSON.stringify(j).slice(0, 120)); }
    dit(Q("select count(*) from pg_class where relname like 'vrm\\_communaute\\_%'") === '0', "après l'essai : aucune table ni index de la communauté");
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_communaute\\_%'") === '0', "après l'essai : aucune fonction de la communauté");
    dit(Q("select string_agg(tablename || policyname || coalesce(qual,''), ',' order by tablename, policyname) from pg_policies") === REGLES_AVANT, "après l'essai : les règles existantes sont celles d'avant (aucune table existante touchée)");
  });

  await essaie('forme', () => {
    fraiche('ancienne', 'socle');
    Q('create table public.vrm_communaute_profils (owner uuid primary key, pseudo text, ville text, lat double precision, lon double precision);');
    const r = run(SQL);
    dit(!r.ok && /vrm_communaute_forme/.test(r.err), "une table vrm_communaute_profils d'une autre forme fait REFUSER la migration", r.ok ? 'installée quand même' : r.err.slice(0, 160));
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_communaute\\_%'") === '0', "et rien n'est installé (aucune fonction)");
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

  await essaie('vérification', () => {
    const v = verifier('base');
    dit(v.ok === true, '`--verifier` rend ok sur une installation neuve', JSON.stringify(v.ecarts) + ' ' + JSON.stringify(v.fonctions_differentes || ''));
  });

  await essaie('données', () => {
    const us = [A, B, C, E, PROPRIO, ...P].map((u, i) => `('${u}', 'membre${i}@exemple.fr')`).join(',');
    ADM(`insert into auth.users (id, email) values ${us}; update public.vrm_reglages set valeur = '${PROPRIO}' where cle = 'proprietaire';`);
  });

  const pid = {};
  let conv = null;
  await essaie('opt-in : invisible par défaut', () => {
    const c0 = carte(A);
    dit(c0 && c0.acces === true && c0.moi === null && Array.isArray(c0.profils) && c0.profils.length === 0, 'avant de rejoindre : je ne suis pas sur la carte, et personne n\'y est', JSON.stringify(c0));
    const an = run(ANON + 'select public.vrm_communaute_carte();');
    dit(!an.ok && /permission denied/.test(an.err), 'sans compte (anon) : la carte est refusée', an.ok ? an.out : '');
    const t = enRun(A, 'select count(*) from public.vrm_communaute_profils;');
    dit(!t.ok && /permission denied/.test(t.err), 'les profils ne se lisent pas en direct', t.ok ? t.out : '');
  });

  await essaie('rejoindre : position arrondie', () => {
    const r = rejoindre(A, 'Julien', 'Cancale', 48.6781234, -1.8512345);
    dit(r && r.ok === true, 'je rejoins la carte (ville choisie)', JSON.stringify(r));
    pid.A = r && r.pid;
    const lu = ADM(`select lat || ',' || lon from public.vrm_communaute_profils where owner = '${A}'`);
    dit(lu === '48.70,-1.85', 'la position rangée est ARRONDIE à 0,05° (≈ 5 km), jamais la valeur exacte reçue', lu);
    const brut = run(`insert into public.vrm_communaute_profils (owner, pseudo, ville, lat, lon) values ('${C}', 'x', 'Paris', 48.8566, 2.3522);`, { role: 'supabase_admin' });
    dit(!brut.ok && /vrm_communaute_lat|vrm_communaute_lon/.test(brut.err), 'la base REFUSE une position exacte, même écrite par le propriétaire de la table', brut.ok ? 'acceptée' : '');
    const rB = rejoindre(B, 'Bob', 'Cancale', 48.69, -1.86);
    pid.B = rB && rB.pid;
    dit(rB && rB.ok === true, 'une seconde personne rejoint la même ville');
    dit(rejoindre(A, 'jean@mail.fr', 'Cancale', 48.6, -1.8).raison === 'pseudo', 'un pseudo qui ressemble à un email est refusé');
    dit(rejoindre(A, 'Julien', '', 48.6, -1.8).raison === 'ville', 'une ville vide est refusée');
    dit(rejoindre(A, 'Julien', 'Cancale', 120, -1.8).raison === 'position', 'une latitude hors de la Terre est refusée');
    const rv = rejoindre(A, '', 'Cancale', 48.6781, -1.8512);
    dit(rv.ok === true && ADM(`select pseudo from public.vrm_communaute_profils where owner = '${A}'`) === 'Revendeur', 'pseudo vide ⇒ « Revendeur »');
    rejoindre(A, 'Julien', 'Cancale', 48.6781, -1.8512);
  });

  await essaie('ce que les autres voient', () => {
    const c = carte(A);
    const texte = JSON.stringify(c);
    dit(c && c.profils.length === 2 && c.moi && c.moi.pid === pid.A, 'la carte montre les deux personnes de Cancale', texte.slice(0, 200));
    for (const fuite of [A, B, 'membre0@exemple.fr', 'membre1@exemple.fr', 'owner'])
      dit(!texte.includes(fuite), `la carte ne porte PAS « ${fuite.length > 20 ? fuite.slice(0, 8) + '…' : fuite} »`);
    const b = c.profils.find((x) => x.pid === pid.B), a = c.profils.find((x) => x.pid === pid.A);
    dit(a && a.premier === true && b && b.premier === false, 'le premier de sa ville est reconnu (badge honnête)');
    dit(b && b.ville === 'Cancale' && b.pseudo === 'Bob' && b.moi === false, 'des autres : pseudo, ville, cellule');
  });

  await essaie('écrire', () => {
    dit(ecrire(C, pid.B, 'salut').raison === 'invisible', 'quelqu\'un qui n\'est pas sur la carte ne peut écrire à personne');
    dit(ecrire(A, '00000000-0000-0000-0000-000000000001', 'salut').raison === 'introuvable', 'on n\'écrit pas à un identifiant inconnu');
    dit(ecrire(A, pid.A, 'moi').raison === 'soi', 'on ne s\'écrit pas à soi-même');
    dit(ecrire(A, pid.B, '   ').raison === 'texte' && ecrire(A, pid.B, 'x'.repeat(501)).raison === 'texte', 'texte vide ou de plus de 500 caractères refusé');
    const r = ecrire(A, pid.B, 'Coucou ! On est à Cancale tous les deux <b>');
    dit(r && r.ok === true && r.conv, 'j\'écris à quelqu\'un de la carte', JSON.stringify(r));
    conv = r && r.conv;
    const lb = convs(B);
    dit(lb && lb.length === 1 && lb[0].nonLus === 1 && lb[0].pseudo === 'Julien' && lb[0].pid === pid.A, 'il reçoit la conversation, un non-lu', JSON.stringify(lb));
    dit(!JSON.stringify(lb).includes(A), 'ses conversations ne portent pas mon identifiant de compte');
    const f = fil(B, conv);
    dit(f && f.messages.length === 1 && f.messages[0].texte.startsWith('Coucou') && f.messages[0].moi === false, 'il lit le message (le texte tel qu\'écrit, jamais interprété)');
    dit(convs(B)[0].nonLus === 0, 'ouvrir le fil le marque lu');
    dit(fil(C, conv) === null, 'quelqu\'un qui n\'est pas dans la conversation ne la lit PAS');
    dit(JSON.stringify(convs(C)) === '[]', 'ni ne la voit dans ses conversations');
    const t = enRun(C, 'select count(*) from public.vrm_communaute_messages;');
    dit(!t.ok && /permission denied/.test(t.err), 'les messages ne se lisent pas en direct');
    const i = enRun(C, `insert into public.vrm_communaute_messages (conv, de, texte) values ('${conv}', '${C}', 'intrus');`);
    dit(!i.ok, 'personne n\'écrit un message en direct dans la table');
  });

  await essaie('le plafond de l\'heure', () => {
    let n = 1, refus = null;
    for (let k = 0; k < 25 && !refus; k++) { const r = ecrire(A, pid.B, 'm' + k); if (r.ok) n++; else refus = r.raison; }
    dit(refus === 'plafond-heure' && n === 20, '20 messages par heure au plus', `${n} envoyés, puis ${refus}`);
    ADM(`update public.vrm_communaute_messages set envoye_le = envoye_le - interval '2 hours' where de = '${A}';`);
  });

  await essaie('5 nouvelles conversations par jour', () => {
    rejoindre(E, 'Eve', 'Rennes', 48.11, -1.68);
    const pids = P.map((u, i) => rejoindre(u, 'P' + i, 'Rennes', 48.11, -1.68).pid);
    const res = pids.map((x) => ecrire(E, x, 'bonjour').raison || 'ok');
    dit(JSON.stringify(res) === '["ok","ok","ok","ok","ok","plafond-jour"]', '5 nouvelles conversations par jour au plus', JSON.stringify(res));
  });

  await essaie('bloquer', () => {
    dit(en(B, `select public.vrm_communaute_bloquer(${lit(conv)}, true);`) === 't', 'il bloque la personne depuis le fil');
    dit(!carte(B).profils.some((x) => x.pid === pid.A), 'la personne bloquée n\'apparaît plus sur SA carte');
    const r = ecrire(A, pid.B, 'tu es là ?');
    dit(r && r.ok === true, 'la personne bloquée ne le sait pas : son envoi lui semble parti', JSON.stringify(r));
    dit(!fil(B, conv).messages.some((m) => m.texte === 'tu es là ?'), 'mais son message N\'ARRIVE PAS chez celui qui a bloqué');
    dit(convs(B)[0].nonLus === 0, 'et aucun non-lu');
    dit(fil(A, conv).messages.some((m) => m.texte === 'tu es là ?' && m.moi), 'elle le voit dans son propre fil (elle ne sait pas)');
    dit(ecrire(B, pid.A, 'hello').raison === 'tu-as-bloque', 'celui qui a bloqué doit débloquer avant d\'écrire');
    dit(en(C, `select public.vrm_communaute_bloquer(${lit(conv)}, true);`) === 'f', 'on ne bloque pas depuis la conversation des autres');
  });

  await essaie('signaler', () => {
    dit(en(B, `select public.vrm_communaute_signaler(${lit(conv)}, 'insistant');`) === 't', 'il signale la personne');
    const ext = ADM(`select extrait::text from public.vrm_communaute_signalements where par = '${B}'`);
    dit(/tu es là/.test(ext), 'le signalement garde un extrait des derniers messages de la personne signalée', ext.slice(0, 120));
    const s = J(PROPRIO, 'select public.vrm_communaute_signalements();');
    dit(Array.isArray(s) && s.length === 1 && s[0].raison === 'insistant', 'le propriétaire de l\'installation lit le signalement', JSON.stringify(s).slice(0, 160));
    dit(J(B, 'select public.vrm_communaute_signalements();') === null, 'personne d\'autre ne lit les signalements');
    dit(en(C, `select public.vrm_communaute_signaler(${lit(conv)}, 'x');`) === 'f', 'on ne signale pas depuis la conversation des autres');
  });

  await essaie('quitter', () => {
    dit(en(A, 'select public.vrm_communaute_quitter();') === 't', 'je quitte la carte d\'un geste');
    dit(ADM(`select count(*) from public.vrm_communaute_profils where owner = '${A}'`) === '0', 'ma ligne est SUPPRIMÉE');
    dit(carte(A).moi === null, 'je ne suis plus sur la carte');
    dit(!carte(E).profils.some((x) => x.pid === pid.A), 'les autres ne me voient plus');
    dit(ecrire(A, pid.B, 'encore').raison === 'invisible', 'hors de la carte, je n\'écris plus');
    rejoindre(A, 'Julien', 'Cancale', 48.6781, -1.8512);
  });

  await essaie('l\'abonnement', () => {
    ADM("update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';");
    dit(JSON.stringify(carte(B)) === '{"acces": false}' || (carte(B) && carte(B).acces === false), 'abonnement obligatoire et pas payé : la carte dit « accès coupé », rien d\'autre');
    ADM(`insert into public.abonnements (owner, statut) values ('${E}', 'active');`);
    const c = carte(E);
    dit(c && c.acces === true && c.profils.length === 1 && c.profils[0].pid === c.moi.pid, 'les personnes qui ne paient plus ne sont plus montrées aux autres', JSON.stringify(c).slice(0, 200));
    dit(ecrire(B, pid.A, 'x').raison === 'abonnement', 'qui ne paie plus n\'écrit plus');
    ADM("update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire'; delete from public.abonnements;");
  });

  await essaie('anon et la clé de service', () => {
    for (const f of ['vrm_communaute_rejoindre(\'a\',\'b\',\'FR\',1,1)', 'vrm_communaute_conversations()', `vrm_communaute_fil('${conv}')`]) {
      const r = run(ANON + `select public.${f};`);
      dit(!r.ok && /permission denied/.test(r.err), `anon : ${f.split('(')[0]} refusé`);
    }
    const e = enRun(A, `select public.vrm_communaute_effacer('${B}');`);
    dit(!e.ok && /permission denied/.test(e.err), 'l\'effacement (serveur) est refusé à un navigateur');
  });

  await essaie('« Fermer mon compte »', () => {
    const n = Number(Q(SERVEUR + `select public.vrm_communaute_effacer('${A}');`));
    dit(n > 0, 'la clé de service efface sa présence et ses conversations', String(n));
    const reste = ADM(`select (select count(*) from public.vrm_communaute_profils where owner = '${A}') + (select count(*) from public.vrm_communaute_conversations where a = '${A}' or b = '${A}')
      + (select count(*) from public.vrm_communaute_messages where de = '${A}') + (select count(*) from public.vrm_communaute_blocages where qui = '${A}' or bloque = '${A}') + (select count(*) from public.vrm_communaute_signalements where par = '${A}' or contre = '${A}')`);
    dit(reste === '0', 'plus AUCUNE ligne ne porte son nom (présence, conversations, messages, blocages, signalements)', reste);
    dit(ADM(`select count(*) from public.vrm_communaute_profils where owner = '${B}'`) === '1', 'les autres gardent leur présence');
  });

  await essaie('la vérification voit une garde touchée', () => {
    const touche = (nom, sql, partie) => {
      fraiche('t_' + nom.replace(/-/g, '_'), 'base');
      ADM(sql);
      const v = verifier('t_' + nom.replace(/-/g, '_'));
      dit(v.ok === false && v.ecarts.includes(partie), `--verifier voit « ${nom} » (${partie})`, JSON.stringify(v.ecarts));
    };
    touche('lecture-ouverte', 'grant select on public.vrm_communaute_messages to authenticated;', 'droits');
    touche('colonne-ouverte', 'grant select (texte) on public.vrm_communaute_messages to authenticated;', 'droits_colonnes');
    touche('sequence-ouverte', 'grant usage on sequence public.vrm_communaute_messages_id_seq to authenticated;', 'droits_sequences');
    touche('rls-non-force', 'alter table public.vrm_communaute_profils no force row level security;', 'rls');
    touche('regle-table', 'create policy x on public.vrm_communaute_profils for select to authenticated using (true);', 'regles_table');
    touche('invoker', 'alter function public.vrm_communaute_carte() security invoker;', 'fonctions');
    touche('corps', "create or replace function public.vrm_communaute_quitter() returns boolean language plpgsql volatile security definer set search_path = '' as $$ begin return true; end $$;", 'fonctions');
    touche('anon', 'grant execute on function public.vrm_communaute_carte() to anon;', 'fonctions');
    touche('fonction-ajoutee', "create function public.vrm_communaute_tout() returns jsonb language sql security definer set search_path = '' as $$ select '{}'::jsonb $$;", 'fonctions');
    touche('forme', 'alter table public.vrm_communaute_profils add column adresse text;', 'forme');
    DB = 'base';
  });

  await partie019(mut);
  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko === 0 ? 0 : 1);
})();

// ════════════════════════════════════════════════════════════════════════════
//  019 — LE PSEUDO DISCORD ET LE CLASSEMENT
//  Sur une base neuve : le socle, la 018 TELLE QU'ELLE EST (elle est en
//  production), puis la 019 (éventuellement mutée).
// ════════════════════════════════════════════════════════════════════════════
async function partie019(mut) {
  console.log('\n── 019 : Discord et classement ──');
  let S19 = fs.readFileSync(MIG19, 'utf8');
  try { if (mut && mut.sql19) S19 = mut.sql19(S19); } catch (e) { dit(false, e.message); return; }
  const F19 = path.join(DIR, '019.sql'); fs.writeFileSync(F19, S19);
  const F18 = path.join(DIR, '018-vrai.sql'); fs.writeFileSync(F18, fs.readFileSync(MIG, 'utf8'));
  const outil19 = (extra) => spawnSync(process.execPath, [OUTIL, '--migration=' + F18, '--migration=' + F19, ...extra], { encoding: 'utf8' });
  const verifier19 = (db) => {
    const v = outil19(['--verifier']);
    if (v.status !== 0) throw new Error('verifier : ' + v.stderr.slice(0, 200));
    const r = run(v.stdout, { db });
    if (!r.ok) throw new Error('verifier (SQL) : ' + r.err.slice(0, 300));
    return JSON.parse(lignes(r.out).pop());
  };
  dit(!/\bdelete\b/i.test(fs.readFileSync(MIG19, 'utf8')), 'la 019 ne contient AUCUNE suppression (elle se colle d\'un bloc dans l\'outil SQL)');

  const pret = await essaie('019 : socle + 018', () => { fraiche('c18', 'socle'); Q(fs.readFileSync(MIG, 'utf8')); return true; });
  if (!pret) return;

  await essaie('019 : essai annulé', () => {
    fraiche('c19essai', 'c18');
    const e = outil19([]);
    if (e.status !== 0) throw new Error(e.stderr.slice(0, 200));
    dit(!/\bdelete\b/i.test(e.stdout), "l'essai de la 019 ne contient aucune suppression");
    const r = run(e.stdout);
    dit(r.ok, "l'essai annulé de la 019 passe d'un bloc sur une base où la 018 est installée", r.err);
    dit(Q("select count(*) from pg_attribute where attrelid = 'public.vrm_communaute_profils'::regclass and attname in ('discord','classement')") === '0', "après l'essai : la table de la carte n'a pas bougé");
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_communaute\\_%'") === '10', "après l'essai : les dix fonctions de la 018, rien de plus");
  });

  fraiche('c19', 'c18');
  const installe = await essaie('019 : installation', () => {
    const r = run(S19); if (!r.ok) throw new Error(r.err);
    const r2 = run(S19); dit(r2.ok, 'la 019 se rejoue sans erreur (idempotente)', r2.err);
    if (mut && mut.apres19) ADM(mut.apres19);
    const r3 = run(fs.readFileSync(MIG, 'utf8'));
    dit(!r3.ok && /vrm_communaute_forme/.test(r3.err), 'la 018 rejouée APRÈS la 019 est refusée (elle remettrait l\'ancienne carte)', r3.ok ? 'rejouée' : '');
    return true;
  });
  if (!installe) return;

  await essaie('019 : vérification', () => {
    const v = verifier19('c19');
    dit(v.ok === true, '`--verifier` (018 + 019) rend ok sur une installation neuve', JSON.stringify(v.ecarts) + ' ' + JSON.stringify(v.fonctions_differentes || ''));
  });

  // Des identités INVENTÉES.
  const U = { A: '61111111-1111-4111-8111-111111111111', B: '62222222-2222-4222-8222-222222222222', C: '63333333-3333-4333-8333-333333333333', D: '64444444-4444-4444-8444-444444444444' };
  // Une date de vente : un instant LOCAL à Paris (jour relatif + heure), écrit en ISO UTC.
  const iso = (jours, heure) => `to_char(((date_trunc('day', now() at time zone 'Europe/Paris') + interval '${jours} day' + interval '${heure}') at time zone 'Europe/Paris') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
  const vente = (tx, jours, heure, statut = "Commande finalisée - l'acheteur a validé la commande") =>
    `jsonb_build_object('transaction_id', ${tx}, 'date', ${iso(jours, heure)}, 'status', ${lit(statut)}, 'price', jsonb_build_object('amount', '50.0'))`;
  const ligne = (owner, uid, ventes) => `insert into public.app_data (owner, id, data) values ('${owner}', 'harvest_${uid}_orders_sold', jsonb_build_object('payload', jsonb_build_object('my_orders', jsonb_build_array(${ventes.join(',')}))));`;
  const pidDe = {};
  await essaie('019 : données inventées', () => {
    fraiche('c19d', 'c19');
    ADM(`insert into auth.users (id, email) values ${Object.values(U).map((u, i) => `('${u}', 'm${i}@exemple.fr')`).join(',')};`);
    ADM(`insert into public.vinted_accounts (vinted_user_id, login, owner) values ('100', 'compte_a', '${U.A}'), ('400', 'compte_a_masque', '${U.A}'), ('200', 'compte_b', '${U.B}'), ('300', 'compte_b2', '${U.B}'), ('500', 'compte_c', '${U.C}');`);
    ADM([
      // A, compte 100 : 3 ventes aujourd'hui (une à 00:30 heure de Paris), la même transaction
      // vue deux fois, une remboursée, une annulée, une hier à 23:30, une il y a deux ans, une date illisible.
      ligne(U.A, '100', [vente(1001, 0, '00:30'), vente(1002, 0, '12:00'), vente(1003, 0, '18:00'), vente(1003, 0, '18:00'),
        vente(1004, 0, '10:00', 'Remboursement effectué'), vente(1005, 0, '11:00', 'Commande annulée'),
        vente(1006, -1, '23:30'), vente(1007, -730, '12:00'), `jsonb_build_object('transaction_id', 1008, 'date', 'pas une date', 'status', 'Commande livrée !')`]),
      // A : un compte lié mais MASQUÉ dans l'app (2 ventes du jour) ; et une ligne d'un compte qui n'est PAS lié à A (300, lié à B).
      ligne(U.A, '400', [vente(4001, 0, '09:00'), vente(4002, 0, '09:30')]),
      ligne(U.A, '300', [vente(3901, 0, '09:00'), vente(3902, 0, '09:30'), vente(3903, 0, '09:40')]),
      `insert into public.app_data (owner, id, data) values ('${U.A}', 'main', '{"vinted_accounts_hidden": ["400"]}'::jsonb);`,
      // B : 5 ventes du jour sur son compte 200 ; et une ligne harvest_100 À LUI (le même compte vu chez deux vendeurs).
      ligne(U.B, '200', [2001, 2002, 2003, 2004, 2005].map((t) => vente(t, 0, '08:00'))),
      ligne(U.B, '100', [vente(1101, 0, '08:00'), vente(1102, 0, '08:10'), vente(1103, 0, '08:20'), vente(1104, 0, '08:30')]),
      // C : sur la carte, des ventes, mais PAS inscrit au classement.
      ligne(U.C, '500', [5001, 5002, 5003, 5004, 5005, 5006, 5007].map((t) => vente(t, 0, '07:00'))),
    ].join('\n'));
    DB = 'c19d';
    for (const [k, u] of Object.entries(U)) if (k !== 'D') { const r = J(u, `select public.vrm_communaute_rejoindre('Membre${k}', 'Cancale', 'FR', 48.68, -1.85);`); pidDe[k] = r && r.pid; }
    return true;
  });
  const cl = (u, per = 'jour') => J(u, `select public.vrm_communaute_classement(${lit(per)});`);
  const inscrire = (u, oui) => J(u, `select public.vrm_communaute_classement_inscrire(${oui});`);
  const discord = (u, d) => J(u, `select public.vrm_communaute_discord(${d === null ? 'null' : lit(d)});`);

  await essaie('019 : opt-in du classement', () => {
    const c0 = cl(U.A);
    dit(c0 && c0.acces === true && c0.inscrit === false && c0.n === 0 && Array.isArray(c0.lignes) && c0.lignes.length === 0 && c0.moi === null,
      'personne n\'est classé par défaut (invisible tant qu\'on ne l\'active pas)', JSON.stringify(c0).slice(0, 200));
    dit(inscrire(U.D, true).raison === 'invisible', 'hors de la carte, on ne s\'inscrit pas (le classement montre le pseudo et la ville de la carte)');
    dit(inscrire(U.A, true).ok === true && inscrire(U.B, true).ok === true, 'deux membres s\'inscrivent');
    const n = run(ANON + "select public.vrm_communaute_classement('jour');");
    dit(!n.ok && /permission denied/.test(n.err), 'sans compte (anon) : le classement est refusé');
    dit(J(U.A, "select public.vrm_communaute_classement('n_importe');").erreur === 'periode', 'une période inconnue est refusée');
  });

  await essaie('019 : le chiffre, compté par la base', () => {
    const c = cl(U.A);
    const la = c && c.lignes.find((l) => l.moi), lb = c && c.lignes.find((l) => l.pid === pidDe.B);
    dit(c && c.n === 2 && c.lignes.length === 2, 'deux inscrits, deux lignes', JSON.stringify(c).slice(0, 240));
    dit(la && la.ventes === 3, 'A : 3 ventes du jour — une transaction vue deux fois compte une fois, remboursée / annulée / illisible / hier / ancienne non comptées, compte masqué et compte non lié écartés, la vente de 00:30 heure de Paris comptée', JSON.stringify(la));
    dit(lb && lb.ventes === 5 && lb.rang === 1 && la && la.rang === 2, 'B : 5 ventes de SON compte (pas celles de la ligne harvest_100 qu\'il porte aussi) — 1er, A 2ᵉ', JSON.stringify(lb));
    dit(c && c.moi && c.moi.rang === 2 && c.moi.ventes === 3, 'ma ligne : « tu es 2ᵉ sur 2 »', JSON.stringify(c && c.moi));
    dit(!c.lignes.some((l) => l.pid === pidDe.C), 'C est sur la carte avec 7 ventes, mais pas inscrit : il n\'apparaît pas');
    const txt = JSON.stringify(c);
    for (const f of [U.A, U.B, 'm0@exemple.fr', 'owner', '"eur"', 'amount']) dit(!txt.includes(f), `le classement ne porte PAS « ${f.length > 20 ? f.slice(0, 8) + '…' : f} »`);
    const hier = Q(`select (date_trunc('month', now() at time zone 'Europe/Paris') <= date_trunc('day', now() at time zone 'Europe/Paris') - interval '1 day')::text || ',' || (date_trunc('week', now() at time zone 'Europe/Paris') <= date_trunc('day', now() at time zone 'Europe/Paris') - interval '1 day')::text || ',' || (date_trunc('year', now() at time zone 'Europe/Paris') <= date_trunc('day', now() at time zone 'Europe/Paris') - interval '1 day')::text`).split(',').map((x) => x === 'true');
    const m = cl(U.A, 'mois'), s2 = cl(U.A, 'semaine'), y = cl(U.A, 'annee');
    const v = (x) => x && x.lignes.find((l) => l.moi) && x.lignes.find((l) => l.moi).ventes;
    dit(v(m) === 3 + (hier[0] ? 1 : 0) && v(s2) === 3 + (hier[1] ? 1 : 0) && v(y) === 3 + (hier[2] ? 1 : 0), 'semaine (du lundi), mois, année : bornes au fuseau de Paris, la vente d\'il y a deux ans jamais comptée', `${v(s2)} · ${v(m)} · ${v(y)}`);
    const triche = enRun(U.A, "select public.vrm_communaute_classement('jour', 999);");
    dit(!triche.ok, 'un chiffre envoyé par le navigateur est refusé (aucune fonction ne le reçoit)', triche.ok ? triche.out.slice(0, 160) : '');
    const direct = enRun(U.A, `update public.vrm_communaute_profils set classement = true where owner = '${U.C}';`);
    dit(!direct.ok && /permission denied/.test(direct.err), 'personne n\'écrit la table en direct (ni s\'inscrire à la place d\'un autre)');
    const args = Q("select string_agg(proname || '(' || pg_get_function_identity_arguments(oid) || ')', ' ') from pg_proc where proname like 'vrm\\_communaute\\_classement%'");
    dit(/vrm_communaute_classement\(p_periode text\)/.test(args) && !/integer|numeric|bigint/.test(args), 'les fonctions du classement ne reçoivent aucun nombre', args);
  });

  await essaie('019 : se retirer, l\'abonnement, quitter la carte', () => {
    dit(inscrire(U.B, false).ok === true && !cl(U.A).lignes.some((l) => l.pid === pidDe.B), 'B se retire : il disparaît du classement');
    inscrire(U.B, true);
    ADM("update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';");
    ADM(`insert into public.abonnements (owner, statut) values ('${U.A}', 'active');`);
    const c = cl(U.A);
    dit(c && c.n === 1 && !c.lignes.some((l) => l.pid === pidDe.B), 'qui ne paie plus n\'est plus classé', JSON.stringify(c).slice(0, 160));
    dit(JSON.stringify(cl(U.B)) === '{"acces": false}' || (cl(U.B) || {}).acces === false, 'et ne voit plus le classement');
    ADM("update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire'; truncate public.abonnements;");
    dit(en(U.B, 'select public.vrm_communaute_quitter();') === 't' && !cl(U.A).lignes.some((l) => l.pid === pidDe.B), 'quitter la carte retire aussi du classement');
    pidDe.B = J(U.B, "select public.vrm_communaute_rejoindre('MembreB', 'Cancale', 'FR', 48.68, -1.85);").pid;
    dit(cl(U.A).n === 1, 'revenir sur la carte ne réinscrit PAS au classement (opt-in à refaire)');
  });

  await essaie('019 : le pseudo Discord', () => {
    dit(discord(U.D, 'julien').raison === 'invisible', 'hors de la carte, pas de pseudo Discord');
    for (const mauvais of ['@julien', 'a', 'jul..ien', '<b>x</b>', 'x'.repeat(33), 'jul ien', 'julien#1234'])
      dit(discord(U.A, mauvais).raison === 'discord', `pseudo Discord refusé : « ${mauvais.length > 12 ? mauvais.slice(0, 12) + '…' : mauvais} »`);
    const r = discord(U.A, '  Julien.VRM_35 ');
    dit(r && r.ok === true && r.discord === 'julien.vrm_35', 'un pseudo valide est rangé (minuscules, sans espaces)', JSON.stringify(r));
    const vu = carte(U.B).profils.find((x) => x.pid === pidDe.A);
    dit(vu && vu.discord === 'julien.vrm_35', 'les autres membres visibles le voient sur la carte');
    dit(carte(U.A).moi.discord === 'julien.vrm_35', 'je le vois sur ma présence');
    dit(!carte(U.B).profils.find((x) => x.pid === pidDe.C).discord, 'qui n\'en a pas mis n\'en montre pas (vide par défaut)');
    const brut = run(`update public.vrm_communaute_profils set discord = '@x' where owner = '${U.A}';`, { role: 'supabase_admin' });
    dit(!brut.ok && /vrm_communaute_discord/.test(brut.err), 'la base REFUSE un pseudo Discord invalide, même écrit par le propriétaire de la table');
    rejoindre(U.A, 'MembreA', 'Rennes', 48.11, -1.68);
    dit(carte(U.A).moi.discord === 'julien.vrm_35' && cl(U.A).inscrit === true, 'changer de ville garde le pseudo Discord et l\'inscription');
    dit(discord(U.A, '').ok === true && !carte(U.B).profils.find((x) => x.pid === pidDe.A).discord, 'un pseudo vide le RETIRE');
    discord(U.A, 'julien.vrm_35');
  });

  await essaie('019 : « Fermer mon compte »', () => {
    const n = Number(Q(SERVEUR + `select public.vrm_communaute_effacer('${U.A}');`));
    dit(n > 0, 'la clé de service efface', String(n));
    dit(ADM(`select count(*) from public.vrm_communaute_profils where owner = '${U.A}'`) === '0', 'sa ligne part avec son pseudo Discord et son inscription');
    dit(!JSON.stringify(cl(U.C)).includes(pidDe.A) && !JSON.stringify(carte(U.C)).includes('julien.vrm_35'), 'ni la carte ni le classement ne le montrent plus');
  });

  await essaie('019 : la vérification voit une garde touchée', () => {
    const touche = (nom, sql, partie) => {
      const db = 't19_' + nom.replace(/-/g, '_');
      fraiche(db, 'c19');
      ADM(sql);
      const v = verifier19(db);
      dit(v.ok === false && v.ecarts.includes(partie), `--verifier (019) voit « ${nom} » (${partie})`, JSON.stringify(v.ecarts));
    };
    touche('discord-contrainte', 'alter table public.vrm_communaute_profils drop constraint vrm_communaute_discord;', 'forme');
    touche('classement-anon', 'grant execute on function public.vrm_communaute_classement(text) to anon;', 'fonctions');
    touche('aide-ouverte', 'grant execute on function public.vrm_communaute_ts(text) to authenticated;', 'fonctions');
    touche('carte-018', fs.readFileSync(MIG, 'utf8').split('-- ── 2. LA CARTE')[1].split('-- ── 3.')[0].replace(/^[^\n]*\n[^\n]*\n/, ''), 'fonctions');
    DB = 'base';
  });
}
