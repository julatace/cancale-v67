#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 014 — LA MÉMOIRE DE L'AGENT eBAY (chantier K3)
//  node scripts/audit-agent-sql.cjs              (le contrôle)
//  node scripts/audit-agent-sql.cjs --prouve     (chaque règle réaffaiblie doit
//                                                 faire passer l'audit au ROUGE)
//  node scripts/audit-agent-sql.cjs --mutation=nom
//
//  La migration (supabase/migrations/014-agent.sql) est EXÉCUTÉE pour de vrai,
//  sur un Postgres JETABLE lancé par cet audit, qui imite la production (forme
//  mesurée le 11 octobre, scripts/agent-sql/supabase-min.sql) : `postgres` n'y
//  est PAS superutilisateur, les droits par défaut ouvrent toute table neuve à
//  anon et authenticated, et les migrations 005, 006, 007 du dépôt y sont
//  appliquées telles quelles. Aucune donnée réelle, aucune connexion à la vraie
//  base. Les rôles sont joués comme PostgREST les joue (`set role` + les
//  revendications du jeton dans `request.jwt.claims`).
//
//  Ce qu'il prouve (spec-finale §5.1-5.2, K3, synthèse §15.2-1) : deux
//  battements ne prennent jamais la même tâche ni deux tâches d'un même compte
//  eBay, y compris quand l'une est EN VOL dans un autre battement [S24, D15] ;
//  un battement ne bloque pas derrière un autre ; le bail expiré se reprend ;
//  une écriture de commande périmée (version, bail) rend 0 ligne ; le chemin
//  « clic » refuse une tâche tenue [S15] ; une clé de geste GLOBALE appelée par
//  deux vendeurs ne dit « première fois » qu'une fois [S5] ; un compte eBay
//  n'a qu'un titulaire [S5] ; une réservation compte 115 % et 50 réservations
//  simultanées ne dépassent jamais un plafond [S9] ; l'anti-rafale rend une
//  ligne sur une horloge neuve [D14] ; le journal n'a qu'une réécriture
//  possible [S26] ; un navigateur ne lit QUE ses lignes, n'écrit RIEN, et ne
//  touche jamais `ebay_tokens*` ; qui ne paie plus ne voit plus rien.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1 : un audit qui ne
//     peut pas tourner n'est jamais vert par défaut.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, spawn, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/014-agent.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql']
  .map((f) => path.join(RACINE, 'supabase/migrations', f));
const J = '11111111-1111-1111-1111-111111111111';   // un vendeur (inventé)
const V = '22222222-2222-2222-2222-222222222222';   // un autre vendeur (inventé)
const N = '00000000-0000-0000-0000-000000000000';   // le propriétaire neutre
const T0 = '2026-10-12T08:00:00Z';                  // l'heure simulée
const t = (s) => `'${new Date(Date.parse(T0) + s * 1000).toISOString()}'::timestamptz`;

const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle. `--prouve` exige que
//    l'audit sorte en ROUGE pour chacune (« la fonction n'existait pas avant »
//    n'est pas une preuve). ─────────────────────────────────────────────────
const remplace = (s, avant, apres, nom) => {
  const n = s.split(avant).length - 1;
  if (n !== 1) throw new Error('mutation ' + nom + ' : ancre introuvable (' + n + ' occurrence(s))');
  return s.split(avant).join(apres);
};
const MUTATIONS = {
  // ── les six de la spécification (K3) ──
  // Un battement attend derrière un autre au lieu de sauter ses lignes.
  'skip-locked': { sql: (s) => remplace(s, '       for update of f skip locked;\n    continue when not found;', '       for update of f;\n    continue when not found;', 'skip-locked') },
  // Une écriture de commande sur une version périmée passe.
  'version': { sql: (s) => remplace(s, '     and c.version = p_version_lue\n', '', 'version') },
  // Une écriture de commande sans le bail (mauvais jeton, bail expiré) passe.
  'bail-ecrire': { sql: (s) => remplace(s, '     for share of f;\n  if not found then return null; end if;\n', '     for share of f;\n', 'bail-ecrire') },
  // Une tâche d'un compte eBay en vol dans un AUTRE battement est reprise [S24, D15].
  'groupe-en-vol': { sql: (s) => remplace(s, `    continue when exists (select 1 from public.vrm_agent_file g
                           where g.owner = c.owner and g.groupe = c.groupe and g.cle <> c.cle
                             and g.bail_jusqua >= p_maintenant);
`, '', 'groupe-en-vol') },
  // Une règle d'écriture pour `authenticated` (le navigateur écrirait ses commandes).
  'ecriture-navigateur': { apres: `create policy ecrit_soi on public.vrm_agent_commandes for insert to authenticated with check (owner = (select auth.uid()));
grant insert on public.vrm_agent_commandes to authenticated;` },
  // La ligne d'horloge n'est pas insérée : chaque battement serait ignoré [D14].
  'horloge-absente': { sql: (s) => remplace(s, `insert into public.vrm_agent_horloge (id, dernier_tic, dernier_battement, dernier_succes)
values (1, '-infinity', '-infinity', '-infinity')
on conflict (id) do nothing;`, '', 'horloge-absente') },
  // ── les règles ajoutées par K3 ──
  // Sans verrou consultatif, deux battements simultanés prennent deux tâches d'un même compte.
  'verrou-groupe': { sql: (s) => remplace(s, "    continue when not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtext('vrm_agent_groupe'), pg_catalog.hashtext(k));\n", '', 'verrou-groupe') },
  // Un bail vivant ne protège plus la tâche dans `prendre`.
  'bail-prendre': { sql: (s) => remplace(remplace(s, "       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < p_maintenant\n     order by", "     order by", 'bail-prendre'),
    "       and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < p_maintenant\n       for update of f skip locked;", "       for update of f skip locked;", 'bail-prendre') },
  // Plus de « deux tâches par vendeur et par battement ».
  'deux-par-vendeur': { sql: (s) => remplace(s, "    continue when coalesce((par_vendeur ->> c.owner::text)::integer, 0) >= 2;\n", '', 'deux-par-vendeur') },
  // Le chemin « clic » vole une tâche tenue par un battement [S15].
  'clic-vole': { sql: (s) => remplace(s, `   where f.owner = p_owner and f.cle = p_cle
     and coalesce(f.bail_jusqua, '-infinity'::timestamptz) < p_maintenant;
  if found then return true; end if;`, `   where f.owner = p_owner and f.cle = p_cle;
  if found then return true; end if;`, 'clic-vole') },
  // `rendre` libère une tâche sans regarder le jeton.
  'rendre-sans-jeton': { sql: (s) => remplace(s, `  select * into r from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton
     for update;`, `  select * into r from public.vrm_agent_file f
   where f.owner = p_owner and f.cle = p_cle
     for update;`, 'rendre-sans-jeton').split("   where f.owner = p_owner and f.cle = p_cle and f.bail_jeton = p_jeton;\n  return true;").join("   where f.owner = p_owner and f.cle = p_cle;\n  return true;") },
  // Une sonnette arrivée pendant le bail est perdue au `rendre`.
  'reveil-perdu': { sql: (s) => remplace(s, "prochain = least(coalesce(p_prochain, 'infinity'::timestamptz), coalesce(r.reveil, 'infinity'::timestamptz)),", "prochain = coalesce(p_prochain, r.reveil),", 'reveil-perdu') },
  // Les clés de gestes qui engagent rangées PAR vendeur [S5].
  'cle-par-vendeur': { sql: (s) => remplace(s, "  if p_cle ~ '^(achat|msg|eval|offre):' then o := '00000000-0000-0000-0000-000000000000'; end if;\n", '', 'cle-par-vendeur') },
  // Les mémos de gestes purgés à 14 jours comme les notifications [S25].
  'memos-14-jours': { sql: (s) => remplace(s, "  delete from public.vrm_agent_memos x where x.expire < p_maintenant;", "  delete from public.vrm_agent_memos x where x.expire < p_maintenant or x.at < p_maintenant - interval '14 days';", 'memos-14-jours') },
  // La réservation au prix du devis, sans marge [S9].
  'sans-marge': { sql: (s) => remplace(s, '  montant := (p_centimes_ttc::bigint * 115 + 99) / 100;', '  montant := p_centimes_ttc;', 'sans-marge') },
  // Une réservation rendue deux fois.
  'rendue-deux-fois': { sql: (s) => remplace(s, `  delete from public.vrm_agent_compteurs x
   where x.owner = p_owner and x.cle like 'resa:' || p_reservation::text || '|%'
  returning x.cle, x.centimes into k, c;`, `  select x.cle, x.centimes into k, c from public.vrm_agent_compteurs x
   where x.owner = p_owner and x.cle like 'resa:' || p_reservation::text || '|%';`, 'rendue-deux-fois') },
  // Les deux compteurs lus SANS verrou : des réservations simultanées dépassent le plafond.
  'reservation-sans-verrou': { sql: (s) => remplace(s, '  perform 1 from public.vrm_agent_compteurs k where k.owner = p_owner and k.cle in (cj, cm) order by k.cle for update;\n', '  perform pg_sleep(0.02);\n', 'reservation-sans-verrou') },
  // Le confort mange tout le quota (plus de 20 % gardés aux obligations).
  'quota-sans-seuil': { sql: (s) => remplace(s, "when 'confort' then 0.6", "when 'confort' then 1.0", 'quota-sans-seuil') },
  // Un second vendeur prend un compte eBay déjà relié [S5].
  'titulaire-libre': { sql: (s) => remplace(s, `  on conflict (cle_ebay) do nothing
  returning true into ok;`, `  on conflict (cle_ebay) do update set owner = excluded.owner
  returning true into ok;`, 'titulaire-libre') },
  // L'index route vers un autre vendeur une annonce qui n'est pas à lui.
  'index-vole': { sql: (s) => remplace(s, `  on conflict (listing_id) do update set compte = excluded.compte, maj = excluded.maj
   where i.owner = excluded.owner;`, `  on conflict (listing_id) do update set owner = excluded.owner, compte = excluded.compte, maj = excluded.maj;`, 'index-vole') },
  // L'heure de la première preuve est déplacée par une relecture.
  'preuve-deplacee': { sql: (s) => remplace(s, `  on conflict (owner, numero_cle, source, ref) do nothing;`, `  on conflict (owner, numero_cle, source, ref) do update set vue_le = excluded.vue_le;`, 'preuve-deplacee') },
  // Le journal réécrit librement.
  'journal-reecrit': { apres: 'alter table public.vrm_agent_journal disable trigger vrm_agent_journal_garde;' },
  // La garde de `ebay_tokens` retirée.
  'ebay-tokens-libre': { apres: 'alter table public.app_data disable trigger vrm_garde_ebay_tokens_ajout; alter table public.app_data disable trigger vrm_garde_ebay_tokens_maj; alter table public.app_data disable trigger vrm_garde_ebay_tokens_retrait;' },
  // La garde de `ebay_tokens` qui ne regarde que le rôle courant (pas le jeton).
  'ebay-tokens-role-seul': { sql: (s) => remplace(s, "  if coalesce(auth.role(), '') in ('authenticated', 'anon') or current_user in ('authenticated', 'anon') then", "  if current_user in ('authenticated', 'anon') then", 'ebay-tokens-role-seul') },
  // Qui ne paie plus voit encore ses commandes.
  'abonnement-ignore': { sql: (s) => remplace(s, `    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = 'abonnement_requis') then
      execute format('create policy abonnement_requis on public.%I as restrictive for all to authenticated '
                     'using ((select public.vrm_acces_ok())) with check ((select public.vrm_acces_ok()))', t);
    end if;
`, '', 'abonnement-ignore') },
  // Les droits par défaut laissés en place (toute table ouverte à anon et authenticated).
  'droits-par-defaut': { sql: (s) => remplace(s, "    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);\n", '', 'droits-par-defaut') },
  // Les fonctions exécutables par le navigateur.
  'fonctions-ouvertes': { sql: (s) => remplace(s, "    execute format('revoke all on function %s from public, anon, authenticated', f);\n", '', 'fonctions-ouvertes') },
};

if (PROUVE) {
  // Trois mutations à la fois (chacune a SON Postgres jetable), le bilan dans l'ordre.
  const noms = Object.keys(MUTATIONS);
  const une = (nom) => new Promise((fin) => {
    const p = spawn(process.execPath, [__filename, '--mutation=' + nom]);
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => fin({ nom, status: code, stdout: out, stderr: err }));
  });
  (async () => {
    const res = {}; let i = 0;
    await Promise.all(Array.from({ length: 3 }, async () => { while (i < noms.length) { const nom = noms[i++]; res[nom] = await une(nom); } }));
    let rouges = 0;
    for (const nom of noms) {
      const r = res[nom];
      const n = (r.stdout.match(/^❌ /mg) || []).length;
      const sautee = /audit NON exécuté|ancre introuvable/.test(r.stdout + r.stderr);
      const bon = r.status !== 0 && n > 0 && !sautee;
      if (bon) rouges++;
      console.log(`${bon ? '✅' : '❌'} mutation « ${nom} » → ${bon ? n + ' contrôle(s) au rouge' : (sautee ? 'audit non exécuté ou ancre introuvable' : 'RESTE VERTE : le contrôle ne mord pas')}`);
      if (bon) for (const l of r.stdout.split('\n').filter((x) => x.startsWith('❌ ')).slice(0, 2)) console.log('      ' + l.slice(0, 220));
      else if (sautee) console.log('      ' + (r.stdout + r.stderr).split('\n').filter((x) => /ancre|NON/.test(x)).slice(0, 1).join(''));
    }
    console.log(`\n${rouges}/${noms.length} mutations attrapées.`);
    process.exit(rouges === noms.length ? 0 : 1);
  })();
}

if (!PROUVE) principal();

function principal() {
// ── TROUVER POSTGRES ─────────────────────────────────────────────────────────
function trouverBin() {
  const avec = (d) => d && fs.existsSync(path.join(d, 'initdb')) && fs.existsSync(path.join(d, 'pg_ctl')) && fs.existsSync(path.join(d, 'postgres'));
  if (avec(process.env.PG_BIN)) return process.env.PG_BIN;
  try { const v = fs.readdirSync('/usr/lib/postgresql').filter((x) => avec(path.join('/usr/lib/postgresql', x, 'bin'))).sort((a, b) => Number(b) - Number(a)); if (v.length) return path.join('/usr/lib/postgresql', v[0], 'bin'); } catch (_) {}
  try { const d = execFileSync('pg_config', ['--bindir'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); if (avec(d)) return d; } catch (_) {}
  return null;
}
const BIN = trouverBin();
const PSQL = (() => { if (BIN && fs.existsSync(path.join(BIN, 'psql'))) return path.join(BIN, 'psql'); try { return execFileSync('which', ['psql']).toString().trim() || null; } catch (_) { return null; } })();
if (!BIN || !PSQL) {
  console.log('❌ Postgres introuvable (initdb, pg_ctl, postgres, psql) — audit NON exécuté. Installe postgresql (16+), ou donne PG_BIN=/chemin/vers/bin.');
  process.exit(1);
}
const ROOT = typeof process.getuid === 'function' && process.getuid() === 0;
let UIDG = null;
if (ROOT) {
  try { UIDG = { uid: Number(execFileSync('id', ['-u', 'postgres']).toString().trim()), gid: Number(execFileSync('id', ['-g', 'postgres']).toString().trim()) }; }
  catch (_) { console.log('❌ lancé en root sans utilisateur système « postgres » — audit NON exécuté.'); process.exit(1); }
}
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-agent-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(56432 + (process.pid % 2000));
const serveur = (cmd, a) => spawnSync(path.join(BIN, cmd), a, { encoding: 'utf8', ...(UIDG || {}) });
let demarre = false;
const arreter = () => { if (demarre) { serveur('pg_ctl', ['-D', DIR + '/data', '-m', 'immediate', 'stop']); demarre = false; } try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (_) {} };
process.on('exit', arreter);
process.on('SIGINT', () => { arreter(); process.exit(1); });
{
  // Le superutilisateur s'appelle comme en production ; `postgres` ne l'est PAS.
  const r = serveur('initdb', ['-D', DIR + '/data', '-U', 'supabase_admin', '--auth=trust', '-E', 'UTF8', '--locale=C', '--no-sync']);
  if (r.status !== 0) { console.log('❌ initdb a échoué — audit NON exécuté : ' + (r.stderr || r.stdout).slice(0, 300)); process.exit(1); }
  const s = serveur('pg_ctl', ['-D', DIR + '/data', '-o', `-p ${PORT} -k ${DIR} -c listen_addresses='' -c fsync=off -c max_connections=200 -c timezone=UTC`, '-l', DIR + '/journal', '-w', 'start']);
  if (s.status !== 0) { console.log('❌ Postgres ne démarre pas — audit NON exécuté : ' + (s.stderr || s.stdout).slice(0, 300)); process.exit(1); }
  demarre = true;
}

// ── PSQL ─────────────────────────────────────────────────────────────────────
const argsPsql = (role, db) => ['-h', DIR, '-p', PORT, '-U', role, '-d', db, '-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'];
const run = (sql, o = {}) => {
  const r = spawnSync(PSQL, argsPsql(o.role || 'postgres', o.db || 'postgres'), { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
const runAsync = (sql, o = {}) => new Promise((ok) => {
  const debut = Date.now();
  const p = spawn(PSQL, argsPsql(o.role || 'postgres', o.db || 'postgres'));
  let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => ok({ ok: code === 0, out: out.trim(), err: err.trim(), ms: Date.now() - debut }));
  p.stdin.end(sql);
});
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Les rôles, joués comme PostgREST les joue.
const COMME = {
  serveur: `set role service_role; set "request.jwt.claims" = '{"role":"service_role"}';\n`,
  vendeur: (u) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}';\n`,
  anon: `set role anon; set "request.jwt.claims" = '{"role":"anon"}';\n`,
};
let DB = 'gabarit';
const Q = (sql, o = {}) => { const r = run(sql, { db: DB, ...o }); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const QJ = (sql, o) => JSON.parse(Q(sql, o) || 'null');
const S = (sql) => Q(COMME.serveur + sql);              // le serveur (clé de service)
const refuse = (r, motif) => !r.ok && motif.test(r.err);
const fraiche = (nom) => { Q(`drop database if exists ${nom}`, { db: 'postgres', role: 'supabase_admin' }); Q(`create database ${nom} template gabarit owner postgres`, { db: 'postgres', role: 'supabase_admin' }); DB = nom; };
// Une tâche à la main (le banc seulement : le superutilisateur passe outre les droits).
const tache = (owner, cle, groupe, prochainS = -60, bail = null) => Q(
  `insert into public.vrm_agent_file (owner, cle, groupe, prochain, bail_jeton, bail_jusqua) values ('${owner}', '${cle}', '${groupe}', ${t(prochainS)}, ${bail ? `'${bail.jeton}'` : 'null'}, ${bail ? t(bail.jusqua) : 'null'})`,
  { role: 'supabase_admin' });
const prendre = (lim, jeton, s = 0, bail = 120) => QJ(COMME.serveur + `select coalesce(json_agg(x order by x.owner, x.cle), '[]') from public.vrm_agent_prendre(${lim}, '${jeton}', ${bail}, ${t(s)}) x;`);
const uuid = (i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`;
const groupesDe = (l) => l.map((x) => x.owner + '|' + x.groupe);

// ════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);

  // ── LE SOCLE : la forme de la production, puis 005-007 TELLES QUELLES ──────
  let SQL = null;
  await essaie('préparer le socle (rôles, droits par défaut, 005-007)', () => {
    let r = run(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin' });
    if (!r.ok) throw new Error('rôle/base : ' + r.err);
    r = run(fs.readFileSync(MIN, 'utf8'), { role: 'supabase_admin', db: 'socle' });
    if (!r.ok) throw new Error('supabase-min : ' + r.err);
    for (const f of SOCLE) { r = run(fs.readFileSync(f, 'utf8'), { db: 'socle' }); if (!r.ok) throw new Error(path.basename(f) + ' : ' + r.err.slice(0, 300)); }
    r = run('create database gabarit template socle owner postgres;', { role: 'supabase_admin' });
    if (!r.ok) throw new Error('gabarit : ' + r.err);
    dit(Q("select rolsuper from pg_roles where rolname = 'postgres'") === 'f', 'le socle imite la production : `postgres` n\'est PAS superutilisateur (la migration tourne avec ses vrais droits)');
  });

  console.log('\n1. L\'INSTALLATION');
  await essaie('la migration existe', () => { dit(fs.existsSync(MIG), 'supabase/migrations/014-agent.sql existe'); if (fs.existsSync(MIG)) SQL = fs.readFileSync(MIG, 'utf8'); });
  const m = MUTATION ? MUTATIONS[MUTATION] : null;
  if (MUTATION && !m) { console.log('❌ mutation inconnue : ' + MUTATION); process.exit(1); }
  if (SQL && m && m.sql) SQL = m.sql(SQL);   // une ancre introuvable lève ici : « ancre introuvable », jamais vert
  await essaie('appliquer la migration', () => {
    if (!SQL) throw new Error('migration absente');
    const r = run(SQL, { db: 'gabarit' });
    dit(r.ok, 'la migration s\'applique, en tant que `postgres` (non superutilisateur), en une transaction', r.ok ? '' : r.err.slice(0, 300));
    const r2 = run(SQL, { db: 'gabarit' });
    dit(r2.ok, 'la réinstaller une seconde fois ne lève rien', r2.ok ? '' : r2.err.slice(0, 200));
  });
  await essaie('ce que le fichier ne contient pas', () => {
    const sansCommentaires = (SQL || '').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
    dit(!!SQL && !/\bdrop\s+(table|function|trigger|policy|schema|index|extension|view|type)\b/i.test(sansCommentaires), 'aucune instruction DROP (l\'outil SQL attend une confirmation humaine pour un DROP)');
    dit(!!SQL && !/create\s+extension|cron\.schedule|net\.http_/i.test(sansCommentaires), 'ni pg_cron ni pg_net : l\'horloge est la 015, sur le oui de Julien');
  });
  await essaie('le réglage et l\'horloge', () => {
    dit(Q("select valeur from public.vrm_reglages where cle = 'agent_ebay'") === '0', 'vrm_reglages.agent_ebay vaut \'0\' (rien ne tourne)');
    const h = Q("select id || '|' || dernier_tic || '|' || dernier_battement || '|' || dernier_succes from public.vrm_agent_horloge");
    dit(h === '1|-infinity|-infinity|-infinity', 'la ligne d\'horloge existe, à « -infinity » partout [D14]', h || '(aucune ligne)');
    Q("update public.vrm_reglages set valeur = 'proprietaire' where cle = 'agent_ebay'", { role: 'supabase_admin' });
    const r = run(SQL, { db: 'gabarit' });
    dit(r.ok && Q("select valeur from public.vrm_reglages where cle = 'agent_ebay'") === 'proprietaire', 'un réglage déjà posé n\'est jamais écrasé par une réinstallation');
    Q("update public.vrm_reglages set valeur = '0' where cle = 'agent_ebay'", { role: 'supabase_admin' });
  });
  // La mutation posée APRÈS l'installation (une réinstallation la défait : `create or replace trigger`).
  if (m && m.apres) await essaie('poser la mutation', () => Q(m.apres));
  await essaie('l\'essai annulé (la méthode de la 013) puis la vérification', () => {
    if (!SQL) throw new Error('migration absente');
    const FMIG = path.join(DIR, 'migration.sql'); fs.writeFileSync(FMIG, SQL);
    const OUTIL = path.join(__dirname, 'agent-sql/essai-annule.cjs');
    const essai = spawnSync(process.execPath, [OUTIL, '--migration=' + FMIG], { encoding: 'utf8' });
    if (essai.status !== 0) throw new Error('essai-annule : ' + essai.stderr.slice(0, 200));
    dit(Buffer.byteLength(essai.stdout) < 46000, `l'essai fait moins de la moitié des 92 Ko que l'outil SQL a refusés d'un bloc pour la 013 (${Buffer.byteLength(essai.stdout)} octets, commentaires hors corps retirés ; NON mesuré que l'outil l'accepte — sinon, les morceaux)`);
    Q('create database essai template socle owner postgres;', { db: 'postgres', role: 'supabase_admin' });
    const r = run(essai.stdout, { db: 'essai' });
    const j = r.ok ? JSON.parse(r.out.split('\n').filter(Boolean).pop()) : null;
    dit(!!j && j.tables === 14 && j.agent_ebay === '0' && Array.isArray(j.horloge) && j.horloge.length === 1 && j.navigateur_ecrit === null && j.fonctions_ouvertes === null,
      'l\'essai installe tout et rend son rapport (14 tables, horloge, réglage, aucun droit de navigateur)', r.ok ? JSON.stringify(j).slice(0, 240) : r.err.slice(0, 200));
    const reste = run(`select (select count(*) from pg_class where relname like 'vrm\\_agent\\_%' or relname like 'vrm\\_ebay\\_%' or relname = 'vrm_coffre') || '|' || (select count(*) from pg_trigger where tgname like 'vrm\\_garde\\_ebay%') || '|' || (select count(*) from public.vrm_reglages where cle = 'agent_ebay') || '|' || (select count(*) from pg_proc where proname like 'vrm\\_agent\\_%')`, { db: 'essai' });
    dit(reste.ok && reste.out === '0|0|0|0', 'l\'essai ne laisse RIEN derrière lui (ROLLBACK)', reste.ok ? reste.out : reste.err.slice(0, 160));
    const ver = spawnSync(process.execPath, [OUTIL, '--verifier', '--migration=' + FMIG], { encoding: 'utf8' });
    const rv = run(ver.stdout, { db: 'gabarit' });
    const v = rv.ok ? JSON.parse(rv.out.split('\n').filter(Boolean).pop()) : null;
    dit(!!v && v.ok === true, 'la vérification (lecture seule) rend ok sur la base installée : chaque corps de fonction est celui du fichier (md5)', rv.ok ? JSON.stringify(v && (v.ok ? v.corps_differents : v)).slice(0, 300) : rv.err.slice(0, 200));
    // Le repli si l'outil SQL refuse le bloc entier : trois transactions, chaque objet né FERMÉ.
    const DM = path.join(DIR, 'morceaux');
    const mo = spawnSync(process.execPath, [OUTIL, '--morceaux', '--dossier=' + DM, '--migration=' + FMIG], { encoding: 'utf8' });
    if (mo.status !== 0) throw new Error('morceaux : ' + mo.stderr.slice(0, 200));
    Q('create database morceaux template socle owner postgres;', { db: 'postgres', role: 'supabase_admin' });
    const ouverts = [];
    for (let i = 1; i <= 3; i++) {
      const f = fs.readFileSync(path.join(DM, `014-morceau-${i}.sql`), 'utf8');
      const a = run(f, { db: 'morceaux' }), b = run(f, { db: 'morceaux' });
      if (!a.ok || !b.ok) { ouverts.push(`morceau ${i} : ${(a.err || b.err).slice(0, 120)}`); continue; }
      const e = run(ver.stdout, { db: 'morceaux' });
      const je = e.ok ? JSON.parse(e.out.split('\n').filter(Boolean).pop()) : null;
      if (!je || je.etat.navigateur_ecrit !== null || je.etat.fonctions_ouvertes !== null) ouverts.push(`après le morceau ${i} : ${e.ok ? JSON.stringify({ n: je.etat.navigateur_ecrit, f: je.etat.fonctions_ouvertes }) : e.err.slice(0, 120)}`);
      if (i === 3) dit(!!je && je.ok === true, 'appliquée en trois morceaux, la vérification rend ok', je ? JSON.stringify(je.corps_differents) : '');
    }
    dit(ouverts.length === 0, 'en morceaux, aucun objet n\'est jamais ouvert au navigateur entre deux transactions, et chaque morceau se réapplique sans lever', ouverts.join(' · ').slice(0, 300));
  });
  const TABLES = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal', 'vrm_agent_file', 'vrm_agent_compteurs', 'vrm_agent_vus',
    'vrm_agent_memos', 'vrm_agent_routes', 'vrm_agent_horloge', 'vrm_ebay_cles_publiques', 'vrm_coffre', 'vrm_ebay_titulaires',
    'vrm_ebay_annonces_index', 'vrm_agent_preuves'];
  const LISIBLES = ['vrm_agent_vendeurs', 'vrm_agent_commandes', 'vrm_agent_journal'];
  const SERVEUR = TABLES.filter((x) => !LISIBLES.includes(x));
  const FONCTIONS = ['vrm_agent_prendre', 'vrm_agent_prendre_cle', 'vrm_agent_rendre', 'vrm_agent_planifier', 'vrm_agent_ecrire_commande',
    'vrm_agent_premiere_fois', 'vrm_agent_vu', 'vrm_agent_reserver', 'vrm_agent_rendre_reservation', 'vrm_agent_quota',
    'vrm_agent_quota_recaler', 'vrm_agent_noter', 'vrm_agent_anonymiser_journal', 'vrm_agent_horloge_battre', 'vrm_agent_horloge_succes',
    'vrm_agent_titulaire', 'vrm_agent_titulaire_liberer', 'vrm_ebay_indexer_annonces', 'vrm_agent_preuve_vue', 'vrm_agent_effacer_vendeur',
    'vrm_agent_purger'];
  await essaie('le catalogue', () => {
    const rls = Q(`select string_agg(relname, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relname = any(array[${TABLES.map((x) => `'${x}'`).join(',')}]) and relrowsecurity`);
    dit(rls.split(',').filter(Boolean).length === TABLES.length, `RLS activé sur les ${TABLES.length} tables de l'agent`, rls);
    const pol = Q(`select coalesce(string_agg(tablename || ':' || policyname || ':' || permissive || ':' || cmd, ' ' order by tablename, policyname), '') from pg_policies where schemaname = 'public' and tablename = any(array[${TABLES.map((x) => `'${x}'`).join(',')}])`);
    const attendu = LISIBLES.slice().sort().map((x) => `${x}:abonnement_requis:RESTRICTIVE:ALL ${x}:agent_lecture_soi:PERMISSIVE:SELECT`).join(' ');
    dit(pol === attendu, 'les tables lisibles n\'ont QUE la lecture de soi et la restrictive abonnement_requis ; les tables du serveur n\'ont AUCUNE règle', pol.slice(0, 300));
    const f = QJ(`select json_agg(json_build_object('n', p.proname, 'def', p.prosecdef, 'cfg', p.proconfig, 'acl', coalesce(p.proacl::text, ''))) from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(array[${FONCTIONS.map((x) => `'${x}'`).join(',')}])`) || [];
    const noms = new Set(f.map((x) => x.n));
    dit(FONCTIONS.every((x) => noms.has(x)), `les ${FONCTIONS.length} fonctions existent`, FONCTIONS.filter((x) => !noms.has(x)).join(', '));
    const fautives = f.filter((x) => !x.def || !(x.cfg || []).includes('search_path=""') || /(^|[{,])(=|anon=|authenticated=)X/.test(x.acl) || !/service_role=X/.test(x.acl));
    dit(f.length > 0 && fautives.length === 0, 'chacune : SECURITY DEFINER, search_path vide, exécutable par service_role SEULEMENT', fautives.map((x) => x.n + ' ' + x.acl).join(' · '));
  });

  // ── 2. QUI LIT, QUI ÉCRIT ─────────────────────────────────────────────────
  console.log('\n2. QUI LIT, QUI ÉCRIT (RLS, droits, abonnement)');
  await essaie('préparer', () => {
    fraiche('droits');
    Q(`insert into public.vrm_agent_vendeurs (owner, actif) values ('${J}', true), ('${V}', true);
       insert into public.vrm_agent_commandes (owner, compte, commande, etape, rang) values ('${J}', 's1', 'O-J1', 'payee', 1), ('${J}', 's1', 'O-J2', 'payee', 1), ('${V}', 's9', 'O-V1', 'payee', 1);
       insert into public.vrm_agent_file (owner, cle, groupe, prochain) values ('${J}', 'ebay:s1:veille', 's1', now());
       insert into public.vrm_coffre (owner, compte, fournisseur, v, nonce, chiffre, tag) values ('${J}', 's1', 'ebay', 1, '\\x000102030405060708090a0b', '\\x00', '\\x000102030405060708090a0b0c0d0e0f');`, { role: 'supabase_admin' });
    S(`select public.vrm_agent_noter('${J}', '{"geste":"retrait","resultat":"fait","cible":"O-J1","texte":"retirée d''eBay"}', ${t(0)}); select public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait","cible":"O-V1"}', ${t(0)});`);
  });
  await essaie('le vendeur lit SES lignes, jamais celles d\'un autre', () => {
    const lu = (u) => Q(COMME.vendeur(u) + `select (select count(*) from public.vrm_agent_vendeurs) || '|' || (select count(*) from public.vrm_agent_commandes) || '|' || (select count(*) from public.vrm_agent_journal) || '|' || (select count(*) from public.vrm_agent_commandes where owner <> '${u}');`);
    dit(lu(J) === '1|2|1|0', 'le vendeur J lit 1 réglage, SES 2 commandes, SON journal, et aucune ligne d\'un autre', lu(J));
    dit(lu(V) === '1|1|1|0', 'le vendeur V lit les siennes seulement', lu(V));
  });
  await essaie('le vendeur ne lit RIEN de ce qui est au serveur', () => {
    const lues = SERVEUR.filter((x) => run(COMME.vendeur(J) + `select count(*) from public.${x};`, { db: DB }).ok);
    dit(lues.length === 0, 'file, compteurs, mémos, vus, routes, horloge, clés, coffre, titulaires, index, preuves : « permission refusée » pour le navigateur', lues.join(', '));
    const anon = TABLES.filter((x) => run(COMME.anon + `select count(*) from public.${x};`, { db: DB }).ok);
    dit(anon.length === 0, 'la clé publique (anon) ne lit RIEN, pas même les tables lisibles', anon.join(', '));
  });
  await essaie('le navigateur n\'écrit RIEN', () => {
    const ecrit = [];
    for (const x of TABLES) {
      const col = x === 'vrm_agent_horloge' ? 'id' : x === 'vrm_ebay_cles_publiques' ? 'kid' : 'owner';
      const essais = [`insert into public.${x} default values;`, `update public.${x} set ${col} = ${col};`, `delete from public.${x};`];
      if (x === 'vrm_agent_commandes') essais.unshift(`insert into public.vrm_agent_commandes (owner, compte, commande, etape, rang) values ('${J}', 's1', 'O-FAUX', 'payee', 1);`);
      if (x === 'vrm_agent_vendeurs') essais.unshift(`update public.vrm_agent_vendeurs set actif = false where owner = '${J}';`);
      for (const sql of essais) {
        const r = run(COMME.vendeur(J) + sql, { db: DB });
        if (r.ok || !/permission denied|row-level security|violates|null value|not-null/.test(r.err)) ecrit.push(x + ' ← ' + sql.slice(0, 40) + (r.ok ? ' (passé)' : ' (' + r.err.slice(0, 60) + ')'));
      }
    }
    // L'issue qui compte : la base n'a pas bougé.
    const apres = Q(`select (select count(*) from public.vrm_agent_commandes where commande = 'O-FAUX') || '|' || (select count(*) from public.vrm_agent_vendeurs where actif)`, { role: 'supabase_admin' });
    dit(ecrit.length === 0 && apres === '0|2', 'un vendeur connecté ne peut ni créer, ni modifier, ni effacer une ligne d\'aucune table de l\'agent (pas même SES commandes)', (ecrit.join(' · ') + ' ' + apres).slice(0, 400));
  });
  await essaie('le navigateur n\'appelle aucune fonction', () => {
    const appels = [`select public.vrm_agent_prendre(8, '${uuid(1)}', 120);`, `select public.vrm_agent_premiere_fois('${J}', 'msg:O1:x');`,
      `select public.vrm_agent_titulaire('0123456789abcdef', '${J}', 's1');`, `select public.vrm_agent_reserver('${J}', 's1', 100, 9999, 9, 9999, 9999);`,
      `select public.vrm_agent_effacer_vendeur('${V}');`, `select public.vrm_agent_horloge_battre();`];
    const passes = appels.filter((sql) => run(COMME.vendeur(J) + sql, { db: DB }).ok || run(COMME.anon + sql, { db: DB }).ok);
    dit(passes.length === 0, 'aucune fonction de l\'agent n\'est exécutable par un navigateur (connecté ou non)', passes.join(' · '));
  });
  await essaie('le serveur n\'écrit les tables à garantie QUE par leurs fonctions', () => {
    const passe = [];
    for (const x of ['vrm_agent_file', 'vrm_agent_commandes', 'vrm_agent_journal', 'vrm_agent_compteurs', 'vrm_agent_memos', 'vrm_ebay_titulaires', 'vrm_ebay_annonces_index', 'vrm_agent_preuves', 'vrm_agent_horloge']) {
      for (const sql of [`update public.${x} set owner = owner;`, `delete from public.${x};`]) {
        const r = run(COMME.serveur + sql.replace('set owner = owner', x === 'vrm_agent_horloge' ? 'set id = id' : 'set owner = owner'), { db: DB });
        if (r.ok) passe.push(x + ' ← ' + sql.slice(0, 20));
      }
    }
    dit(passe.length === 0, 'même la clé de service ne peut ni réécrire ni effacer la file, les commandes, le journal, les compteurs, les mémos, les titulaires, l\'index, les preuves, l\'horloge sans passer par leurs fonctions', passe.join(' · '));
    const r = run(COMME.serveur + `update public.vrm_agent_vendeurs set pouls = '{"vu":1}' where owner = '${J}'; select count(*) from public.vrm_agent_file;`, { db: DB });
    dit(r.ok && r.out === '1', 'l\'autre sens : le serveur LIT tout, et écrit les réglages et le pouls d\'un vendeur', r.ok ? r.out : r.err.slice(0, 120));
  });
  await essaie('qui ne paie plus ne voit plus rien (abonnement_requis)', () => {
    Q(`update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire'; update public.vrm_reglages set valeur = '${J}' where cle = 'proprietaire';`, { role: 'supabase_admin' });
    const lu = (u) => Q(COMME.vendeur(u) + `select (select count(*) from public.vrm_agent_vendeurs) || '|' || (select count(*) from public.vrm_agent_commandes) || '|' || (select count(*) from public.vrm_agent_journal);`);
    dit(lu(V) === '0|0|0', 'abonnement obligatoire, V sans abonnement : il ne voit ni son pouls, ni ses commandes, ni son journal', lu(V));
    dit(lu(J) === '1|2|1', 'l\'autre sens : le propriétaire de l\'installation voit toujours les siennes', lu(J));
    Q(`insert into auth.users (id) values ('${V}') on conflict do nothing; insert into public.abonnements (owner, statut) values ('${V}', 'active');`, { role: 'supabase_admin' });
    dit(lu(V) === '1|1|1', 'et V voit les siennes dès qu\'il paie', lu(V));
    Q(`update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire';`, { role: 'supabase_admin' });
  });
  await essaie('la trace des écritures (le jumeau de noter_ecriture)', () => {
    const n = Q(`select string_agg(distinct tbl, ',' order by tbl) from sauvegarde.journal_ecritures where tbl like 'vrm_agent_%'`, { role: 'supabase_admin' });
    dit(n === 'vrm_agent_commandes,vrm_agent_journal,vrm_agent_vendeurs', 'chaque écriture des trois tables lisibles laisse sa trace dans sauvegarde.journal_ecritures', n);
    const id = Q(`select count(*) from sauvegarde.journal_ecritures where tbl = 'vrm_agent_commandes' and row_id = '${J}|ebay:s1:O-J1'`, { role: 'supabase_admin' });
    dit(id === '1', 'la trace nomme la ligne (vendeur|plateforme:compte:commande)', id);
  });

  // ── 3. LA GARDE DES JETONS eBAY ───────────────────────────────────────────
  console.log('\n3. LA GARDE D\'ÉCRITURE SUR ebay_tokens*');
  await essaie('le navigateur', () => {
    fraiche('jetons');
    S(`insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens', '{"refresh_token":"VIEUX"}'), ('${J}', 'main', '{}');`);
    const essais = {
      'créer ebay_tokens_{cle}': `insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens_0123456789abcdef', '{"refresh_token":"VOLE"}');`,
      'réécrire ebay_tokens': `update public.app_data set data = '{"refresh_token":"VOLE"}' where owner = '${J}' and id = 'ebay_tokens';`,
      'effacer ebay_tokens': `delete from public.app_data where owner = '${J}' and id = 'ebay_tokens';`,
      'renommer main en ebay_tokens_x': `update public.app_data set id = 'ebay_tokens_x' where owner = '${J}' and id = 'main';`,
      'upsert comme l\'app': `insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens', '{"refresh_token":"VOLE"}') on conflict (owner, id) do update set data = excluded.data;`,
    };
    const passes = Object.entries(essais).filter(([, sql]) => !refuse(run(COMME.vendeur(J) + sql, { db: DB }), /vrm_ebay_tokens_serveur/)).map(([k]) => k);
    dit(passes.length === 0, 'un vendeur connecté ne peut ni créer, ni réécrire, ni effacer, ni renommer une ligne ebay_tokens* (refus nommé « vrm_ebay_tokens_serveur »)', passes.join(' · '));
    dit(Q(`select data->>'refresh_token' from public.app_data where owner = '${J}' and id = 'ebay_tokens'`, { role: 'supabase_admin' }) === 'VIEUX'
      && Q(`select count(*) from public.app_data where id like 'ebay\\_tokens%'`, { role: 'supabase_admin' }) === '1', 'le jeton rangé n\'a pas bougé');
    // Le jeton dit « authenticated » même quand le rôle courant est un autre (fonction SECURITY DEFINER) :
    const r = run(`set "request.jwt.claims" = '{"sub":"${J}","role":"authenticated"}'; update public.app_data set data = '{"refresh_token":"VOLE"}' where owner = '${J}' and id = 'ebay_tokens';`, { db: DB });
    dit(refuse(r, /vrm_ebay_tokens_serveur/), 'une écriture qui porte un jeton de navigateur est refusée même sous un autre rôle (auth.role())', r.ok ? 'passée' : r.err.slice(0, 80));
  });
  await essaie('l\'autre sens', () => {
    const r1 = run(COMME.vendeur(J) + `update public.app_data set data = '{"a":1}' where owner = '${J}' and id = 'main'; insert into public.app_data (owner, id, data) values ('${J}', 'ebay_listings', '{}');`, { db: DB });
    dit(r1.ok, 'le navigateur écrit toujours ses autres lignes (main, ebay_listings) : la garde ne vise que les jetons', r1.ok ? '' : r1.err.slice(0, 120));
    const r2 = run(COMME.serveur + `update public.app_data set data = '{"refresh_token":"NEUF"}' where owner = '${J}' and id = 'ebay_tokens';
      insert into public.app_data (owner, id, data) values ('${J}', 'ebay_tokens_0123456789abcdef', '{"refresh_token":"AUTRE"}');
      delete from public.app_data where owner = '${J}' and id = 'ebay_tokens_0123456789abcdef';`, { db: DB });
    dit(r2.ok && Q(`select data->>'refresh_token' from public.app_data where owner = '${J}' and id = 'ebay_tokens'`, { role: 'supabase_admin' }) === 'NEUF', 'le serveur (clé de service) crée, réécrit et efface les jetons', r2.ok ? '' : r2.err.slice(0, 120));
  });

  // ── 4. LA FILE : PRENDRE, BAIL, GROUPE ────────────────────────────────────
  console.log('\n4. LA FILE (prendre, bail, un appel en vol par compte eBay)');
  await essaie('un battement : ≤ 1 par groupe, ≤ 2 par vendeur', () => {
    fraiche('file1');
    tache(J, 'a1', 'g1', -50); tache(J, 'a2', 'g1', -49); tache(J, 'b1', 'g2', -48); tache(J, 'c1', 'g3', -47); tache(V, 'v1', 'g1', -46);
    const l = prendre(8, uuid(1));
    const g = groupesDe(l);
    dit(l.length === 3 && new Set(g).size === g.length, 'jamais deux tâches d\'un même compte eBay dans un battement', JSON.stringify(l.map((x) => x.cle)));
    dit(l.filter((x) => x.owner === J).length === 2, 'au plus 2 tâches par vendeur et par battement : le second vendeur n\'attend pas derrière le premier', JSON.stringify(l.map((x) => x.cle)));
    dit(l.some((x) => x.owner === V), 'le second vendeur est servi dans le même battement');
  });
  await essaie('une tâche EN VOL dans un autre battement exclut son groupe [S24, D15]', () => {
    // a1 vient d'être prise par le battement 1 (bail vivant, déjà validé).
    const l2 = prendre(8, uuid(2), 5);
    dit(!l2.some((x) => x.owner === J && x.groupe === 'g1') && !l2.some((x) => x.owner === V && x.groupe === 'g1'), 'le battement 2 ne prend AUCUNE tâche d\'un compte qui a déjà une tâche en vol', JSON.stringify(l2.map((x) => x.cle)));
    dit(l2.some((x) => x.cle === 'c1'), 'l\'autre sens : il prend la tâche d\'un compte libre', JSON.stringify(l2.map((x) => x.cle)));
  });
  await essaie('un bail expiré se reprend, un bail vivant non', () => {
    fraiche('file2');
    tache(J, 'vive', 'g1', -60, { jeton: uuid(7), jusqua: 60 });
    tache(J, 'morte', 'g2', -60, { jeton: uuid(8), jusqua: -1 });
    const l = prendre(8, uuid(9));
    dit(l.some((x) => x.cle === 'morte'), 'une tâche au bail EXPIRÉ (battement coupé) est reprise');
    dit(!l.some((x) => x.cle === 'vive'), 'une tâche au bail VIVANT n\'est jamais reprise', JSON.stringify(l.map((x) => x.cle)));
    dit(Q(`select bail_jeton from public.vrm_agent_file where cle = 'morte'`, { role: 'supabase_admin' }) === uuid(9), 'le bail porte le jeton du battement qui l\'a prise');
  });
  await essaie('deux battements SIMULTANÉS', async () => {
    fraiche('file3');
    tache(J, 'a1', 'g1', -50); tache(J, 'a2', 'g1', -49); tache(J, 'b1', 'g2', -48); tache(J, 'b2', 'g2', -47); tache(J, 'c1', 'g3', -46); tache(J, 'd1', 'g4', -45);
    tache(V, 'v1', 'g1', -44); tache(V, 'v2', 'g1', -43);
    const sel = (jeton) => `select 'R:' || coalesce(jsonb_agg(x)::text, '[]') from public.vrm_agent_prendre(8, '${jeton}', 120, ${t(0)}) x;\n`;
    const A = runAsync(COMME.serveur + 'begin;\n' + sel(uuid(11)) + 'select pg_sleep(2.5);\ncommit;\n', { db: DB });
    await attendre(700);
    const B = await runAsync(COMME.serveur + sel(uuid(12)), { db: DB });
    const a = await A;
    const lit = (r) => { const l = r.out.split('\n').find((x) => x.startsWith('R:')); try { return JSON.parse(l ? l.slice(2) : '[]'); } catch (e) { throw new Error('sortie illisible : ' + JSON.stringify(r).slice(0, 400)); } };
    const la = lit(a), lb = lit(B);
    dit(a.ok && B.ok, 'les deux battements répondent', (a.err + ' ' + B.err).slice(0, 200));
    dit(B.ms < 1500, `un battement ne BLOQUE pas derrière un autre (skip locked) : ${B.ms} ms pendant que l'autre tient ses lignes 2,5 s`);
    const cles = la.map((x) => x.owner + x.cle), clesB = lb.map((x) => x.owner + x.cle);
    dit(la.length > 0 && lb.length > 0 && !clesB.some((k) => cles.includes(k)), 'jamais la même tâche dans deux battements', JSON.stringify({ A: la.map((x) => x.cle), B: lb.map((x) => x.cle) }));
    const ga = groupesDe(la);
    dit(!groupesDe(lb).some((g) => ga.includes(g)), 'jamais deux tâches d\'un même compte eBay EN VOL dans deux battements simultanés (verrou consultatif)', JSON.stringify({ A: la.map((x) => x.cle), B: lb.map((x) => x.cle) }));
  });
  await essaie('un battement pendant qu\'un CLIC tient sa tâche', async () => {
    fraiche('file4');
    tache(J, 'x1', 'g5', -50); tache(J, 'y1', 'g6', -40);
    const A = runAsync(COMME.serveur + `begin;\nselect 'R:' || public.vrm_agent_prendre_cle('${J}', 'x1', '${uuid(13)}', 120, ${t(0)});\nselect pg_sleep(2.5);\ncommit;\n`, { db: DB });
    await attendre(700);
    const B = await runAsync(COMME.serveur + `select 'R:' || coalesce(jsonb_agg(x)::text, '[]') from public.vrm_agent_prendre(8, '${uuid(14)}', 120, ${t(0)}) x;\n`, { db: DB });
    const a = await A;
    const lb = JSON.parse(((B.out.split('\n').find((l) => l.startsWith('R:')) || 'R:[]').slice(2)));
    dit(a.ok && B.ok && /R:t/.test(a.out), 'le clic tient sa tâche, le battement répond', (a.out + ' ' + a.err + ' ' + B.err).slice(0, 200));
    dit(B.ms < 1500, `le battement n'attend pas derrière la ligne tenue par le clic (skip locked) : ${B.ms} ms`);
    dit(!lb.some((x) => x.cle === 'x1') && lb.some((x) => x.cle === 'y1'), 'il saute la tâche tenue et prend l\'autre', JSON.stringify(lb.map((x) => x.cle)));
  });
  await essaie('le chemin « clic » prend le même bail [S15, R8]', () => {
    fraiche('clic');
    tache(J, 'ebay:s1:cmd:O1', 's1', -60, { jeton: uuid(20), jusqua: 60 });   // tenue par un battement
    tache(J, 'ebay:s1:cmd:O2', 's1', 3600);                                   // libre, pas encore due
    const pc = (cle, jeton, groupe) => S(`select public.vrm_agent_prendre_cle('${J}', '${cle}', '${jeton}', 120, ${t(0)}${groupe ? `, '${groupe}'` : ''});`);
    dit(pc('ebay:s1:cmd:O1', uuid(21)) === 'f', 'une tâche tenue par un battement est REFUSÉE au clic (la route répond 409)');
    dit(Q(`select bail_jeton from public.vrm_agent_file where cle = 'ebay:s1:cmd:O1'`, { role: 'supabase_admin' }) === uuid(20), 'et le bail du battement est intact');
    dit(pc('ebay:s1:cmd:O2', uuid(22)) === 't', 'une tâche libre est prise par le clic');
    dit(pc('ebay:s1:cmd:O2', uuid(23)) === 'f', 'un double clic : le second est refusé');
    dit(pc('ebay:s1:cmd:O3', uuid(24), 's1') === 't' && pc('ebay:s1:cmd:O4', uuid(25)) === 'f', 'une tâche absente est créée tenue si le groupe est donné, refusée sinon');
    const l = prendre(8, uuid(26), 0);
    dit(!l.some((x) => x.cle.startsWith('ebay:s1:cmd:O')), 'un battement ne reprend pas une tâche tenue par un clic', JSON.stringify(l.map((x) => x.cle)));
  });
  await essaie('rendre une tâche', () => {
    fraiche('rendre');
    tache(J, 'k', 'g1', -60, { jeton: uuid(30), jusqua: 60 });
    const r = (jeton, prochain, echec = false) => S(`select public.vrm_agent_rendre('${J}', 'k', '${jeton}', ${prochain === null ? 'null' : t(prochain)}, ${echec}, 'raison', ${t(1)});`);
    dit(r(uuid(31), 600) === 'f' && Q(`select bail_jeton from public.vrm_agent_file where cle = 'k'`, { role: 'supabase_admin' }) === uuid(30), 'un autre jeton ne rend pas la tâche (le bail reste)');
    dit(r(uuid(30), 600, true) === 't', 'le bon jeton la rend');
    dit(Q(`select (bail_jeton is null) || '|' || essais || '|' || (prochain = ${t(600)}) from public.vrm_agent_file where cle = 'k'`, { role: 'supabase_admin' }) === 'true|1|true', 'bail libéré, prochaine fois fixée, échec compté');
  });
  await essaie('une sonnette pendant le bail n\'est jamais perdue', () => {
    fraiche('reveil');
    tache(J, 'k', 'g1', -60, { jeton: uuid(40), jusqua: 60 });
    S(`select public.vrm_agent_planifier('${J}', 'k', 'g1', ${t(5)}, ${t(2)});`);
    S(`select public.vrm_agent_rendre('${J}', 'k', '${uuid(40)}', ${t(3600)}, false, null, ${t(10)});`);
    dit(Q(`select prochain = ${t(5)} from public.vrm_agent_file where cle = 'k'`, { role: 'supabase_admin' }) === 't', 'la tâche rendue « dans 1 h » repasse à l\'heure de la sonnette arrivée pendant son bail');
    tache(J, 'k2', 'g1', -60, { jeton: uuid(41), jusqua: 60 });
    S(`select public.vrm_agent_planifier('${J}', 'k2', 'g1', ${t(5)}, ${t(2)});`);
    S(`select public.vrm_agent_rendre('${J}', 'k2', '${uuid(41)}', null, false, null, ${t(10)});`);
    dit(Q(`select count(*) from public.vrm_agent_file where cle = 'k2'`, { role: 'supabase_admin' }) === '1', 'une tâche « finie » avec une sonnette en attente n\'est pas retirée');
    tache(J, 'k3', 'g1', -60, { jeton: uuid(42), jusqua: 60 });
    S(`select public.vrm_agent_rendre('${J}', 'k3', '${uuid(42)}', null, false, null, ${t(10)});`);
    dit(Q(`select count(*) from public.vrm_agent_file where cle = 'k3'`, { role: 'supabase_admin' }) === '0', 'l\'autre sens : une tâche finie sans sonnette est retirée');
    S(`select public.vrm_agent_planifier('${J}', 'p', 'g9', ${t(100)}, ${t(0)}); select public.vrm_agent_planifier('${J}', 'p', 'g9', ${t(5000)}, ${t(0)});`);
    dit(Q(`select prochain = ${t(100)} from public.vrm_agent_file where cle = 'p'`, { role: 'supabase_admin' }) === 't', 'planifier ne recule jamais une échéance (« au plus tard à »)');
  });

  // ── 5. LES COMMANDES : VERSION ET BAIL ────────────────────────────────────
  console.log('\n5. L\'ÉTAT D\'UNE COMMANDE (version et bail)');
  await essaie('écrire sous version et sous bail', () => {
    fraiche('cmd');
    const JE = uuid(50);
    S(`select public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O1', '${JE}', 120, ${t(0)}, 's1');`);
    const ec = (jeton, version, cols, s = 1) => S(`select public.vrm_agent_ecrire_commande('${J}', 'ebay:s1:cmd:O1', '${jeton}', 's1', 'O1', ${version === null ? 'null' : version}, '${JSON.stringify(cols).replace(/'/g, "''")}', 'ebay', ${t(s)});`);
    dit(ec(JE, null, { etape: 'payee', rang: 1, numero: '1', pays: 'FR' }) === '1', 'création : version 1');
    dit(ec(JE, null, { etape: 'payee', rang: 1 }) === '', 'une seconde création rend 0 ligne (elle existe déjà)');
    dit(ec(JE, 1, { etape: 'a_expedier', rang: 2, voie: 'ebay' }) === '2', 'écriture sur la version lue : version 2');
    dit(ec(JE, 1, { etape: 'historique', rang: 0 }) === '', 'écriture sur une version PÉRIMÉE : 0 ligne, on relit, on n\'écrase jamais');
    dit(Q(`select etape || '|' || rang || '|' || numero || '|' || pays || '|' || version from public.vrm_agent_commandes where commande = 'O1'`, { role: 'supabase_admin' }) === 'a_expedier|2|1|FR|2', 'l\'état est celui de la bonne écriture, et les colonnes non envoyées sont gardées');
    dit(ec(uuid(51), 2, { etape: 'historique', rang: 0 }) === '', 'un autre jeton (le bail n\'est pas à lui) : 0 ligne');
    dit(ec(JE, 2, { etape: 'historique', rang: 0 }, 500) === '', 'le bail EXPIRÉ (coupé en plein geste) : 0 ligne');
    dit(Q(`select version from public.vrm_agent_commandes where commande = 'O1'`, { role: 'supabase_admin' }) === '2', 'la commande n\'a pas bougé');
  });
  await essaie('ce que la commande ne garde jamais (R18)', () => {
    const JE = uuid(52);
    S(`select public.vrm_agent_prendre_cle('${J}', 'ebay:s1:cmd:O9', '${JE}', 120, ${t(0)}, 's1');`);
    const cree = (cols) => run(COMME.serveur + `select public.vrm_agent_ecrire_commande('${J}', 'ebay:s1:cmd:O9', '${JE}', 's1', 'O9', null, '${JSON.stringify(cols).replace(/'/g, "''")}', 'ebay', ${t(1)});`, { db: DB });
    dit(!cree({ etape: 'payee', rang: 1, pays: 'France' }).ok, 'un pays qui n\'est pas un code ISO 2 est refusé');
    dit(!cree({ etape: 'payee', rang: 1, cles_shipto: ['Jean Dupont', '12 rue des Lilas'] }).ok, 'des VALEURS d\'adresse à la place des noms de clés sont refusées');
    dit(!cree({ etape: 'payee', rang: 1, data: { commande: 'x'.repeat(5000) } }).ok, 'une commande recopiée entière (plus de 4 Ko) est refusée');
    dit(!cree({ etape: 'payee', rang: 1, politique_etiquette: 'EBAY' }).ok, 'une politique d\'étiquette inconnue est refusée (EBAY_ONLY · aucune · pas lue)');
    const r = cree({ etape: 'payee', rang: 1, pays: 'FR', cles_shipto: ['contactAddress', 'fullName'], politique_etiquette: 'aucune', data: { transitions: [] } });
    dit(r.ok && r.out === '1', 'l\'autre sens : ISO 2, des noms de clés et une politique lue passent', r.ok ? r.out : r.err.slice(0, 120));
  });

  // ── 6. MÉMOS ET VUS ───────────────────────────────────────────────────────
  console.log('\n6. « PREMIÈRE FOIS » (mémos de gestes) ET « DÉJÀ VU »');
  await essaie('les mémos', async () => {
    fraiche('memos');
    const pf = (o, cle, s = 0, exp = null) => S(`select public.vrm_agent_premiere_fois('${o}', '${cle}', ${exp === null ? 'null' : t(exp)}, ${t(s)});`);
    dit(pf(J, 'msg:O1:merci') === 't' && pf(J, 'msg:O1:merci') === 'f', 'true UNE fois, puis false');
    dit(pf(V, 'msg:O1:merci') === 'f', 'une clé de geste GLOBALE appelée par un SECOND vendeur : false (un seul « merci » pour une commande eBay) [S5]');
    dit(pf(J, 'achat:O2') === 't' && pf(V, 'achat:O2') === 'f' && pf(V, 'eval:L1') === 't' && pf(J, 'eval:L1') === 'f', 'achat, évaluation : globaux aussi');
    dit(Q(`select owner from public.vrm_agent_memos where cle = 'msg:O1:merci'`, { role: 'supabase_admin' }) === N, 'rangés sous le propriétaire neutre');
    dit(pf(J, 'push:vente:O3') === 't' && pf(V, 'push:vente:O3') === 't', 'l\'autre sens : une notification de vente reste PAR vendeur (chacun ses appareils)');
    const res = await Promise.all(Array.from({ length: 50 }, () => runAsync(COMME.serveur + `select public.vrm_agent_premiere_fois('${J}', 'msg:O5:relais', null, ${t(0)});`, { db: DB })));
    const vrais = res.filter((r) => r.ok && r.out === 't').length;
    dit(vrais === 1 && res.every((r) => r.ok), `50 appels simultanés : ${vrais} « première fois » (attendu : 1)`);
    pf(J, 'offre:I1', 0, 86400);
    dit(Q(`select expire >= ${t(0)} + interval '100 days' from public.vrm_agent_memos where cle = 'offre:I1'`, { role: 'supabase_admin' }) === 't', 'un mémo demandé pour 1 jour est gardé au moins 100 jours [S25, R12]');
  });
  await essaie('les vus et la purge', () => {
    S(`select public.vrm_agent_vu('${J}', 'notif:N1', ${t(0)});`);
    dit(S(`select public.vrm_agent_vu('${J}', 'notif:N1', ${t(1)});`) === 'f', 'une notification déjà vue : false');
    S(`select public.vrm_agent_purger(${t(15 * 86400)});`);
    dit(Q(`select count(*) from public.vrm_agent_vus`, { role: 'supabase_admin' }) === '0', 'les vus partent à 14 jours');
    dit(Q(`select count(*) from public.vrm_agent_memos where cle = 'msg:O1:merci'`, { role: 'supabase_admin' }) === '1', 'les mémos de GESTES restent à 14 jours (un message est permis 90 jours)');
    S(`select public.vrm_agent_purger(${t(101 * 86400)});`);
    dit(Q(`select count(*) from public.vrm_agent_memos where cle = 'msg:O1:merci'`, { role: 'supabase_admin' }) === '0', 'et partent passé leur échéance (100 jours)');
  });

  // ── 7. L'ARGENT ───────────────────────────────────────────────────────────
  console.log('\n7. RÉSERVER DE L\'ARGENT (115 %, plafonds, une fois)');
  const resa = (o, ttc, pl = {}, s = 0, compte = 's1') => QJ(COMME.serveur + `select public.vrm_agent_reserver('${o}', '${compte}', ${ttc}, ${pl.geste ?? 2500}, ${pl.n ?? 10}, ${pl.jour ?? 8000}, ${pl.mois ?? 30000}, ${t(s)});`);
  await essaie('la marge et les plafonds', () => {
    fraiche('argent');
    const r = resa(J, 1000);
    dit(r && r.ok === true && r.centimes === 1150, 'un devis de 10,00 € TTC réserve 11,50 € (+15 %) [S9, R15]', JSON.stringify(r));
    dit(resa(J, 2200).raison === 'geste', 'un devis dont la réservation passe le plafond du geste est refusé (« à confirmer »)');
    dit(QJ(COMME.serveur + `select public.vrm_agent_reserver('${J}', 's1', 1000, null, 10, 8000, 30000, ${t(0)});`).raison === 'pas-su', 'un plafond inconnu : refusé (« pas su » n\'agit jamais)');
    const k = Q(`select n || '|' || centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:jour:s1:2026-10-12'`, { role: 'supabase_admin' });
    dit(k === '1|1150', 'le compteur du jour porte ce qui est réservé', k);
    dit(S(`select public.vrm_agent_rendre_reservation('${J}', '${r.reservation}', ${t(10)});`) === 't', 'une réservation se rend (refus prouvé)');
    dit(S(`select public.vrm_agent_rendre_reservation('${J}', '${r.reservation}', ${t(11)});`) === 'f', 'mais une seule fois');
    const k2 = Q(`select n || '|' || centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:jour:s1:2026-10-12'`, { role: 'supabase_admin' });
    dit(k2 === '0|0', 'le compteur revient à zéro, pas en dessous', k2);
    const nuit = resa(J, 100, {}, 15 * 3600);   // 23:00 UTC = 01:00 à Paris le 13
    dit(nuit && nuit.jour === '2026-10-13', 'le jour est celui de PARIS', JSON.stringify(nuit));
  });
  await essaie('50 réservations SIMULTANÉES', async () => {
    fraiche('argent2');
    const lot = await Promise.all(Array.from({ length: 50 }, () => runAsync(COMME.serveur + `select (public.vrm_agent_reserver('${J}', 's1', 1000, 2500, 10, 1000000, 1000000, ${t(0)}) ->> 'ok');`, { db: DB })));
    const pris = lot.filter((r) => r.ok && r.out === 'true').length;
    const k = Q(`select n || '|' || centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:jour:s1:2026-10-12'`, { role: 'supabase_admin' });
    dit(pris === 10 && k === '10|11500' && lot.every((r) => r.ok), `plafond de 10 bordereaux par jour : ${pris} réservés sur 50 demandes simultanées, compteur ${k}`);
    const lot2 = await Promise.all(Array.from({ length: 50 }, () => runAsync(COMME.serveur + `select (public.vrm_agent_reserver('${J}', 's2', 1000, 2500, 1000, 1000000, 30000, ${t(0)}) ->> 'ok');`, { db: DB })));
    const mois = Q(`select centimes from public.vrm_agent_compteurs where owner = '${J}' and cle = 'argent:mois:2026-10'`, { role: 'supabase_admin' });
    dit(Number(mois) <= 30000 && lot2.every((r) => r.ok), `plafond du mois (300 €) : ${mois} centimes réservés au total, jamais plus`);
  });
  await essaie('le quota d\'appels', () => {
    fraiche('quota');
    const q = (prio, o = null, c = null) => S(`select public.vrm_agent_quota('trading:2026-10-12', '${prio}', 1, 100, ${o ? `'${o}'` : 'null'}, ${c ? `'${c}'` : 'null'}, ${t(0)});`);
    let n = 0; while (n < 200 && q('confort') === 't') n++;
    dit(n === 60, `le confort s'arrête à 60 % du quota (${n} appels sur 100)`);
    n = 0; while (n < 200 && q('detection') === 't') n++;
    dit(n === 20, `la détection va jusqu'à 80 % (${n} de plus)`);
    n = 0; while (n < 200 && q('obligation') === 't') n++;
    dit(n === 20, `les obligations gardent les 20 % restants (${n} de plus)`);
    dit(q('inconnue') === 'f', 'une priorité inconnue est refusée');
    fraiche('quota2');
    const r1 = q('confort', J, 's1'), r2 = q('confort', J, 's1'), r3 = q('confort', J, 's2'), r4 = q('obligation', J, 's1');
    dit(r1 === 't' && r2 === 'f' && r3 === 't' && r4 === 't', 'hors obligation, au plus 1 % par compte et par jour ; une obligation passe quand même', [r1, r2, r3, r4].join(''));
    S(`select public.vrm_agent_quota_recaler('trading:2026-10-12', 99, ${t(0)}); select public.vrm_agent_quota_recaler('trading:2026-10-12', 5, ${t(1)});`);
    dit(Q(`select n from public.vrm_agent_compteurs where cle = 'trading:2026-10-12'`, { role: 'supabase_admin' }) === '99', 'le recalage sur eBay ne fait que monter');
  });

  // ── 8. LES TITULAIRES ET L'INDEX ──────────────────────────────────────────
  console.log('\n8. UN COMPTE eBAY, UN VENDEUR ; L\'INDEX DES ANNONCES');
  await essaie('les titulaires [S5, R10]', async () => {
    fraiche('titulaires');
    const ti = (cle, o, c = 's1') => S(`select public.vrm_agent_titulaire('${cle}', '${o}', '${c}', ${t(0)});`);
    dit(ti('0123456789abcdef', J) === 't' && ti('0123456789abcdef', J) === 't', 'le premier vendeur devient titulaire (et le reste)');
    dit(ti('0123456789abcdef', V) === 'f', 'un SECOND vendeur VRM qui relie le même compte eBay est refusé');
    dit(Q(`select owner from public.vrm_ebay_titulaires where cle_ebay = '0123456789abcdef'`, { role: 'supabase_admin' }) === J, 'le titulaire n\'a pas changé');
    dit(ti('PAS-UNE-CLE', J) === 'f' && ti('fedcba9876543210', N) === 'f', 'une clé qui n\'est pas une identité eBay, ou le propriétaire neutre : refusés');
    const lot = await Promise.all([J, V, J, V, V, J].map((o) => runAsync(COMME.serveur + `select '${o}:' || public.vrm_agent_titulaire('aaaaaaaaaaaaaaaa', '${o}', 's2', ${t(0)});`, { db: DB })));
    const gagnants = new Set(lot.filter((r) => r.out.endsWith(':true')).map((r) => r.out.split(':')[0]));
    dit(gagnants.size === 1, 'deux vendeurs qui relient le même compte au même instant : un seul gagne', [...gagnants].join(','));
    dit(S(`select public.vrm_agent_titulaire_liberer('0123456789abcdef', '${V}');`) === 'f', 'seul le titulaire libère son compte');
    dit(S(`select public.vrm_agent_titulaire_liberer('0123456789abcdef', '${J}');`) === 't' && ti('0123456789abcdef', V) === 't', 'libéré, il peut être relié ailleurs');
  });
  await essaie('l\'index des annonces [D13]', () => {
    fraiche('index');
    const ix = (o, c, l) => QJ(COMME.serveur + `select public.vrm_ebay_indexer_annonces('${o}', '${c}', ${l === null ? 'null' : `array[${l.map((x) => `'${x}'`).join(',')}]::text[]`}, ${t(0)});`);
    const r1 = ix(J, 's1', ['128086452103', '128127336988']);
    dit(r1 && r1.indexees === 2, 'les annonces d\'un compte sont indexées', JSON.stringify(r1));
    const r2 = ix(V, 's9', ['128086452103', '199999999999']);
    dit(r2 && r2.refusees === 1 && Q(`select owner from public.vrm_ebay_annonces_index where listing_id = '128086452103'`, { role: 'supabase_admin' }) === J, 'une annonce déjà à un AUTRE vendeur n\'est jamais prise', JSON.stringify(r2));
    const r3 = ix(J, 's1', ['128127336988', 'pas-un-id']);
    dit(r3 && r3.retirees === 1 && r3.refusees === 1, 'relecture complète : l\'annonce disparue sort de l\'index, un identifiant malformé est refusé', JSON.stringify(r3));
    dit(ix(J, 's1', null) === null && Q(`select count(*) from public.vrm_ebay_annonces_index where owner = '${J}'`, { role: 'supabase_admin' }) === '1', 'une lecture ratée (NULL) ne touche à rien');
  });
  await essaie('les preuves de vente : la première fois ne bouge pas', () => {
    const p = (s) => S(`select public.vrm_agent_preuve_vue('${J}', '1', 'vinted', 'tx-1', ${t(s)}) = ${t(0)};`);
    dit(p(0) === 't' && p(3600) === 't', 'relue une heure plus tard, la preuve garde l\'heure où l\'agent l\'a VUE la première fois (décision 2)');
  });

  // ── 9. LE JOURNAL ─────────────────────────────────────────────────────────
  console.log('\n9. LE JOURNAL (une seule réécriture possible) [S26, R19]');
  await essaie('le journal', () => {
    fraiche('journal');
    const id = S(`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O1","numero":"1","texte":"Bonjour Paul, ton colis est au relais."}', ${t(0)});`);
    S(`select public.vrm_agent_noter('${J}', '{"geste":"message","resultat":"fait","cible":"O2","texte":"Autre acheteur"}', ${t(0)});`);
    dit(/^\d+$/.test(id), 'une ligne s\'ajoute');
    dit(!run(COMME.serveur + `select public.vrm_agent_noter('${J}', '{"geste":"x","resultat":"peut-etre"}', ${t(0)});`, { db: DB }).ok, 'un résultat hors liste est refusé');
    const tente = {
      'réécrire le texte': `update public.vrm_agent_journal set texte = 'autre chose' where id = ${id};`,
      'changer le résultat': `update public.vrm_agent_journal set resultat = 'refuse' where id = ${id};`,
      'effacer le texte ET changer la cible': `update public.vrm_agent_journal set texte = null, texte_retire_le = now(), cible = 'O9' where id = ${id};`,
      'supprimer une ligne': `delete from public.vrm_agent_journal where id = ${id};`,
      'vider la table': `truncate public.vrm_agent_journal;`,
    };
    const passes = Object.entries(tente).filter(([, sql]) => run(sql, { db: DB }).ok).map(([k]) => k);
    dit(passes.length === 0, 'même le propriétaire de la table ne peut ni réécrire, ni supprimer, ni vider le journal', passes.join(' · '));
    dit(!run(COMME.serveur + `update public.vrm_agent_journal set texte = null where id = ${id};`, { db: DB }).ok, 'le serveur non plus (aucun droit d\'écriture directe)');
    dit(S(`select public.vrm_agent_anonymiser_journal('${J}', 'O1', ${t(60)});`) === '1', 'l\'effacement du texte à la demande d\'eBay passe');
    dit(Q(`select (texte is null) || '|' || (texte_retire_le is not null) || '|' || geste || '|' || numero from public.vrm_agent_journal where id = ${id}`, { role: 'supabase_admin' }) === 'true|true|message|1', 'le texte est retiré, la trace du geste reste');
    dit(Q(`select texte from public.vrm_agent_journal where cible = 'O2'`, { role: 'supabase_admin' }) === 'Autre acheteur', 'les autres entrées ne bougent pas');
    S(`select public.vrm_agent_purger(${t(14 * 31 * 86400)});`);
    dit(Q(`select count(*) from public.vrm_agent_journal`, { role: 'supabase_admin' }) === '0', 'la purge retire le journal de plus de 13 mois');
  });

  // ── 10. L'HORLOGE ─────────────────────────────────────────────────────────
  console.log('\n10. L\'HORLOGE (l\'anti-rafale sur une ligne neuve) [D14, D4]');
  await essaie('l\'horloge', () => {
    fraiche('horloge');
    dit(S(`select public.vrm_agent_horloge_battre(${t(0)});`) === 't', 'sur une horloge NEUVE, le premier battement travaille (la ligne rend une ligne)');
    dit(S(`select public.vrm_agent_horloge_battre(${t(5)});`) === 'f', '5 s plus tard : ignoré (anti-rafale)');
    dit(S(`select public.vrm_agent_horloge_battre(${t(21)});`) === 't', '21 s plus tard : il travaille');
    S(`select public.vrm_agent_horloge_succes(${t(30)}); select public.vrm_agent_horloge_succes(${t(10)});`);
    dit(Q(`select dernier_succes = ${t(30)} from public.vrm_agent_horloge`, { role: 'supabase_admin' }) === 't', 'le dernier succès ne recule jamais');
  });

  // ── 11. EFFACER UN VENDEUR, COMPACTER ─────────────────────────────────────
  console.log('\n11. « FERMER MON COMPTE » ET LA PURGE');
  await essaie('effacer un vendeur', () => {
    fraiche('effacer');
    S(`select public.vrm_agent_planifier('${J}', 'k', 'g1', ${t(0)}, ${t(0)}); select public.vrm_agent_planifier('${V}', 'k', 'g1', ${t(0)}, ${t(0)});
       select public.vrm_agent_noter('${J}', '{"geste":"retrait","resultat":"fait"}', ${t(0)}); select public.vrm_agent_noter('${V}', '{"geste":"retrait","resultat":"fait"}', ${t(0)});
       select public.vrm_agent_titulaire('0123456789abcdef', '${J}', 's1', ${t(0)}); select public.vrm_agent_premiere_fois('${J}', 'msg:O1:x', null, ${t(0)});
       select public.vrm_agent_premiere_fois('${J}', 'push:vente:O1', null, ${t(0)});`);
    Q(`insert into public.vrm_agent_vendeurs (owner) values ('${J}'), ('${V}');`, { role: 'supabase_admin' });
    const r = QJ(COMME.serveur + `select public.vrm_agent_effacer_vendeur('${J}');`);
    const reste = Q(`select (select count(*) from public.vrm_agent_file where owner = '${J}') + (select count(*) from public.vrm_agent_journal where owner = '${J}') + (select count(*) from public.vrm_agent_vendeurs where owner = '${J}') + (select count(*) from public.vrm_ebay_titulaires where owner = '${J}') + (select count(*) from public.vrm_agent_memos where owner = '${J}')`, { role: 'supabase_admin' });
    dit(r && r.journal === 1 && reste === '0', 'tout ce que l\'agent garde du vendeur part, journal compris', JSON.stringify(r));
    const autre = Q(`select (select count(*) from public.vrm_agent_file where owner = '${V}') || '|' || (select count(*) from public.vrm_agent_journal where owner = '${V}') || '|' || (select count(*) from public.vrm_agent_memos where owner = '${N}')`, { role: 'supabase_admin' });
    dit(autre === '1|1|1', 'rien de l\'autre vendeur ; les mémos GLOBAUX restent', autre);
    dit(S(`select public.vrm_agent_effacer_vendeur('${N}') is null;`) === 't', 'le propriétaire neutre ne s\'efface pas');
  });
  await essaie('compacter les commandes closes depuis 90 jours', () => {
    fraiche('compacter');
    Q(`insert into public.vrm_agent_commandes (owner, compte, commande, etape, rang, maj, data) values
         ('${J}', 's1', 'VIEILLE', 'close', 10, ${t(-100 * 86400)}, '{"transitions":[1,2,3],"bordereau":{"prixCentimes":840},"preuve":{"suivi":"X1"},"devis":{"ville":"Rennes"}}'),
         ('${J}', 's1', 'EN-COURS', 'a_expedier', 2, ${t(-100 * 86400)}, '{"transitions":[1]}');`, { role: 'supabase_admin' });
    S(`select public.vrm_agent_purger(${t(0)});`);
    const d = QJ(`select json_object_agg(commande, data) from public.vrm_agent_commandes`, { role: 'supabase_admin' });
    dit(d && d.VIEILLE && d.VIEILLE.bordereau && d.VIEILLE.preuve && !d.VIEILLE.transitions && !d.VIEILLE.devis, 'une commande close depuis 90 jours ne garde que son bordereau et sa preuve (jamais supprimée)', JSON.stringify(d && d.VIEILLE));
    dit(d && d['EN-COURS'] && d['EN-COURS'].transitions, 'une commande en cours n\'est pas touchée');
  });

  console.log(`\n${ok + ko} contrôles, ${ko} au rouge.`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ l\'audit a levé : ' + String(e && e.stack || e).slice(0, 500)); process.exit(1); });
}
