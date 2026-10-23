#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT DE LA MIGRATION 016 — LE MODE ÉQUIPE (fonction n°37, 11 octobre)
//  node scripts/audit-equipe-sql.cjs              (le contrôle)
//  node scripts/audit-equipe-sql.cjs --prouve     (chaque règle réaffaiblie doit
//                                                  faire passer l'audit au ROUGE)
//  node scripts/audit-equipe-sql.cjs --mutation=nom
//
//  La migration (supabase/migrations/016-equipe.sql) est EXÉCUTÉE pour de vrai,
//  sur un Postgres JETABLE qui imite la production (scripts/agent-sql/
//  supabase-min.sql : `postgres` non superutilisateur, droits par défaut
//  ouverts, auth.uid() lu dans le jeton) ; les migrations 005, 006, 007 et 013
//  y sont appliquées TELLES QUELLES. Aucune donnée réelle, aucune connexion à
//  la vraie base. Les rôles sont joués comme PostgREST les joue (`set role` +
//  `request.jwt.claims`).
//
//  Ce qu'il prouve : un membre ACTIF lit les colis du vendeur (bordereaux,
//  étiquettes captées, suivis, codes de retrait) et RIEN d'autre (ni `main`, ni
//  les ventes avec prix, ni les transactions, ni le porte-monnaie, ni
//  `ebay_tokens`, ni `vinted_accounts`) ; la projection des colis ne porte
//  aucun montant ni jeton ; il n'écrit RIEN ; un membre d'un autre vendeur, une
//  invitation non acceptée, une adresse non confirmée, une invitation révoquée
//  ou un vendeur qui ne paie plus ne lisent rien ; le vendeur voit comme avant ;
//  l'essai annulé ne laisse rien ; `--verifier` rend ok, et ok = false dès
//  qu'une garde est touchée ; une table d'une autre forme fait tout refuser.
//
//  ⚠️ S'il ne trouve pas Postgres, il le DIT et sort en 1 : un audit qui ne
//     peut pas tourner n'est jamais vert par défaut.
//  ⚠️ Un audit ne meurt pas, il rapporte : chaque bloc passe par `essaie`.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync, execFileSync } = require('child_process');
const RACINE = path.join(__dirname, '..');
const MIG = path.join(RACINE, 'supabase/migrations/016-equipe.sql');
const MIN = path.join(__dirname, 'agent-sql/supabase-min.sql');
const OUTIL_SRC = path.join(__dirname, 'equipe-sql/essai-annule.cjs');
const SOCLE = ['005-abonnements.sql', '006-acces-abonnement.sql', '007-droits-minimaux.sql', '013-anciens-numeros-en-b.sql']
  .map((f) => path.join(RACINE, 'supabase/migrations', f));
// La 021 (confidentialité) : appliquée en production le 21 octobre, AVANT la
// 016. Sa restrictive de lecture fermait la lecture du membre (22 octobre).
const M021 = path.join(RACINE, 'supabase/migrations/021-confidentialite-boutiques.sql');
// Des identités INVENTÉES.
const J = '11111111-1111-1111-1111-111111111111';   // le vendeur
const V = '22222222-2222-2222-2222-222222222222';   // un autre vendeur
const M = '33333333-3333-3333-3333-333333333333';   // le membre de J
const M2 = '44444444-4444-4444-4444-444444444444';  // le membre de V
const X = '55555555-5555-5555-5555-555555555555';   // invité par J, n'accepte pas
const U = '66666666-6666-6666-6666-666666666666';   // invité par J, adresse NON confirmée
const PERMIS_J = ['email_bord_111', 'email_track_mondialrelay_AB123', 'harvest_9_label_111', 'harvest_9_label_latest', 'panel_colis_relais'];

const args = process.argv.slice(2);
const MUTATION = (args.find((a) => a.startsWith('--mutation=')) || '').slice('--mutation='.length);
const PROUVE = args.includes('--prouve');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d !== undefined && d !== '' ? ' — ' + String(d).replace(/\s*\n\s*/g, ' ').slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { return await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 300)); return undefined; } };

// ── LES MUTATIONS : chacune réaffaiblit UNE règle ─────────────────────────────
const remplace = (s, avant, apres, nom) => {
  const n = s.split(avant).length - 1;
  if (n !== 1) throw new Error('mutation ' + nom + ' : ancre introuvable (' + n + ' occurrence(s))');
  return s.split(avant).join(apres);
};
const MUTATIONS = {
  'liste-large': { sql: (s) => remplace(s, "select coalesce(p_id ~ '^(email_bord_", "select coalesce(p_id ~ '^(email_|harvest_|main|email_bord_", 'liste-large') },
  'sans-statut': { sql: (s) => remplace(s, "                    and e.statut = 'actif')\n", ')\n', 'sans-statut') },
  'sans-acces-vendeur': { sql: (s) => remplace(s, '     and public.vrm_acces_pour(p_vendeur)\n', '\n', 'sans-acces-vendeur') },
  // Le vendeur pris d'office (sans l'en-tête) : un membre qui est aussi vendeur verrait les colis de l'autre mêlés aux siens.
  'sans-entete': { sql: (s) => remplace(s, "    v := (nullif(pg_catalog.current_setting('request.headers', true), '')::json ->> 'x-vrm-equipe')::uuid;",
    "    select e.vendeur into v from public.vrm_equipe e where e.membre = auth.uid() and e.statut = 'actif' limit 1;", 'sans-entete') },
  'colis-avec-prix': { sql: (s) => remplace(s, "'title', r.o->'title', 'status', r.o->'status',", "'title', r.o->'title', 'status', r.o->'status', 'price', r.o->'price',", 'colis-avec-prix') },
  'colis-sans-garde': { sql: (s) => remplace(s, 'with ok as (select 1 where public.vrm_equipe_actif(p_vendeur)),', 'with ok as (select 1),', 'colis-sans-garde') },
  'accepter-sans-confirmation': { sql: (s) => remplace(s, 'where u.id = moi and u.email_confirmed_at is not null;', 'where u.id = moi;', 'accepter-sans-confirmation') },
  'accepter-autre-email': { sql: (s) => remplace(s, "x.statut = 'invitee' and x.email = e and x.vendeur <> moi;", "x.statut = 'invitee' and x.vendeur <> moi;", 'accepter-autre-email') },
  'revoquer-quiconque': { sql: (s) => remplace(s, " and (x.vendeur = moi or x.membre = moi);", ';', 'revoquer-quiconque') },
  'invite-soi': { sql: (s) => remplace(s, "    return jsonb_build_object('ok', false, 'raison', 'soi');\n", '    null;\n', 'invite-soi') },
  'droits-table': { sql: (s) => remplace(s, 'revoke all on public.vrm_equipe from public, anon, authenticated, service_role;\n', '', 'droits-table') },
  'restrictive-ouverte': { sql: (s) => remplace(s, '  using ((select public.vrm_acces_ok()) or owner = (select public.vrm_equipe_vendeur()));', '  using (true);', 'restrictive-ouverte') },
  'forme-ignoree': { sql: (s) => remplace(s, "  if v is distinct from '", "  if false and v is distinct from '", 'forme-ignoree') },
  'ecriture-membre': { apres: `create policy equipe_ecrit on public.app_data for update to authenticated
  using (owner = (select public.vrm_equipe_vendeur())) with check (true);` },
  'verifier-droits': { outil: (s) => remplace(s, "    droits: `json_array_length(e.j -> 'droits') = 0`,\n", '', 'verifier-droits') },
  'verifier-regles': { outil: (s) => remplace(s, "    regles: `(e.j -> 'regles')::jsonb = case when ${AVEC_021} then ${lit(JSON.stringify(REGLES_021))}::jsonb else ${lit(JSON.stringify(REGLES))}::jsonb end`,\n", '', 'verifier-regles') },
  // 22 octobre : la 016 telle qu'elle était (sans retoucher la restrictive de la 021).
  'sans-lecture-021': { sql: (s) => remplace(s, "  if exists (select 1 from pg_catalog.pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'vrm_lecture_privee') then\n", "  if false then\n", 'sans-lecture-021') },
  'sans-garde-restrictive': { sql: (s) => remplace(s, "  if b is not null then\n    raise exception 'vrm_equipe_lecture_bloquee", "  if false then\n    raise exception 'vrm_equipe_lecture_bloquee", 'sans-garde-restrictive') },
  'verifier-restrictives': { outil: (s) => remplace(s, "    restrictives_bloquantes: `(e.j ->> 'restrictives_bloquantes') is null`,\n", '', 'verifier-restrictives') },
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

// ── TROUVER POSTGRES ─────────────────────────────────────────────────────────
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
const DIR = fs.mkdtempSync(path.join(ROOT ? '/tmp' : os.tmpdir(), 'vrm-equipe-sql-'));
if (ROOT) fs.chownSync(DIR, UIDG.uid, UIDG.gid);
const PORT = String(52432 + (process.pid % 2000));
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
const run = (sql, o = {}) => {
  const r = spawnSync(PSQL, argsPsql(o.role || 'postgres', o.db || DB), { input: sql, encoding: 'utf8', maxBuffer: 64 << 20 });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
};
let DB = 'postgres';
const Q = (sql, o = {}) => { const r = run(sql, o); if (!r.ok) throw new Error(r.err.slice(0, 400)); return r.out; };
const A = (sql) => Q(sql, { role: 'supabase_admin' });
const comme = (u, v) => `set role authenticated; set "request.jwt.claims" = '{"sub":"${u}","role":"authenticated"}';\n`
  + (v ? `set "request.headers" = '{"x-vrm-equipe":"${v}","user-agent":"banc"}';\n` : '');
const ANON = `set role anon; set "request.jwt.claims" = '{"role":"anon"}';\n`;
const SERVEUR = `set role service_role; set "request.jwt.claims" = '{"role":"service_role"}';\n`;
const en = (u, sql, v) => Q(comme(u, v) + sql);
const enRun = (u, sql, v) => run(comme(u, v) + sql);
const lignes = (s) => s.split('\n').filter(Boolean);
const fraiche = (nom, modele) => { A(`drop database if exists ${nom}`); Q(`create database ${nom} template ${modele} owner postgres`, { db: 'postgres', role: 'supabase_admin' }); DB = nom; };
const lit = (x) => "'" + String(x).replace(/'/g, "''") + "'";
const js = (o) => lit(JSON.stringify(o));

let OUTIL = OUTIL_SRC, FMIG = MIG;
const verifier = (db) => {
  const v = spawnSync(process.execPath, [OUTIL, '--verifier', '--migration=' + FMIG], { encoding: 'utf8' });
  if (v.status !== 0) throw new Error('verifier : ' + v.stderr.slice(0, 200));
  const r = run(v.stdout, { db });
  if (!r.ok) throw new Error('verifier (SQL) : ' + r.err.slice(0, 300));
  return JSON.parse(lignes(r.out).pop());
};

(async () => {
  console.log(`(Postgres jetable dans ${DIR}${MUTATION ? ' · MUTATION « ' + MUTATION + ' »' : ''})\n`);
  let SQL = fs.readFileSync(MIG, 'utf8');
  const mut = MUTATION ? MUTATIONS[MUTATION] : null;
  if (MUTATION && !mut) { console.log('❌ mutation inconnue — audit NON exécuté'); process.exit(1); }
  try {
    if (mut && mut.sql) SQL = mut.sql(SQL);
    if (mut && mut.outil) { OUTIL = path.join(DIR, 'outil.cjs'); fs.writeFileSync(OUTIL, mut.outil(fs.readFileSync(OUTIL_SRC, 'utf8'))); }
  } catch (e) { console.log('❌ ' + e.message + ' — audit NON exécuté'); process.exit(1); }
  FMIG = path.join(DIR, '016.sql'); fs.writeFileSync(FMIG, SQL);

  // ── LE SOCLE ────────────────────────────────────────────────────────────
  const socleOk = await essaie('préparer le socle (rôles, droits par défaut, 005-007, 013)', () => {
    Q(`do $$ begin if not exists (select 1 from pg_roles where rolname = 'postgres') then create role postgres login nosuperuser bypassrls inherit; end if; end $$;\ncreate database socle owner postgres;`, { role: 'supabase_admin', db: 'postgres' });
    DB = 'socle';
    A(fs.readFileSync(MIN, 'utf8'));
    // auth.users porte, en production, l'adresse et sa confirmation (lues par 016).
    A(`alter table auth.users add column if not exists email text, add column if not exists email_confirmed_at timestamptz;
       alter table public.vinted_accounts add column if not exists access_token text, add column if not exists refresh_token text;`);
    for (const f of SOCLE) Q(fs.readFileSync(f, 'utf8'));
    dit(Q("select rolsuper from pg_roles where rolname = 'postgres'") === 'f', 'le socle imite la production : `postgres` n\'est PAS superutilisateur');
    dit(/vrm_acces_ok/.test(Q("select qual from pg_policies where tablename = 'app_data' and policyname = 'abonnement_requis'")), 'le socle porte la restrictive `abonnement_requis` de la 006');
    return true;
  });
  if (!socleOk) { console.log('\n❌ socle impossible — audit NON exécuté'); process.exit(1); }
  const QUAL_AVANT = Q("select qual from pg_policies where tablename = 'app_data' and policyname = 'abonnement_requis'");

  // ── L'ESSAI ANNULÉ : il ne laisse RIEN ─────────────────────────────────
  await essaie('essai annulé', () => {
    fraiche('essai', 'socle');
    const e = spawnSync(process.execPath, [OUTIL_SRC, '--migration=' + FMIG], { encoding: 'utf8' });
    if (e.status !== 0) throw new Error(e.stderr.slice(0, 200));
    const r = run(e.stdout);
    dit(r.ok, "l'essai annulé passe d'un bloc sur le socle", r.err);
    if (r.ok) { const j = JSON.parse(lignes(r.out).pop()); dit(j.table === true && j.rls === true, "l'essai voit la table installée (RLS forcé) avant d'annuler"); }
    dit(Q("select to_regclass('public.vrm_equipe') is null") === 't', "après l'essai : la table n'existe pas");
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_equipe\\_%'") === '0', "après l'essai : aucune fonction de l'équipe");
    dit(Q("select qual from pg_policies where tablename = 'app_data' and policyname = 'abonnement_requis'") === QUAL_AVANT && Q("select count(*) from pg_policies where policyname = 'equipe_lit'") === '0', "après l'essai : les règles d'app_data sont celles d'avant");
  });

  // ── UNE TABLE D'UNE AUTRE FORME : tout est refusé ──────────────────────
  await essaie('forme', () => {
    fraiche('ancienne', 'socle');
    Q('create table public.vrm_equipe (id uuid primary key, vendeur uuid not null, email text not null, membre uuid, role text, statut text, invite_le timestamptz, accepte_le timestamptz, revoque_le timestamptz);');
    const r = run(SQL);
    dit(!r.ok && /vrm_equipe_forme/.test(r.err), "une table vrm_equipe d'une autre forme fait REFUSER la migration", r.ok ? 'installée quand même' : r.err.slice(0, 120));
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_equipe\\_%'") === '0', 'et rien n\'est installé (aucune fonction)');
  });

  // ── L'INSTALLATION ──────────────────────────────────────────────────────
  fraiche('base', 'socle');
  const installe = await essaie('installation', () => {
    const r = run(SQL);
    if (!r.ok) throw new Error(r.err);
    if (mut && mut.apres) A(mut.apres);
    const r2 = run(SQL);
    dit(r2.ok, 'la migration se rejoue sans erreur (idempotente)', r2.err);
    return true;
  });
  if (!installe) { console.log(`\n${ok} vert(s), ${ko} rouge(s).`); process.exit(1); }

  await essaie('vérification', () => {
    const v = verifier('base');
    dit(v.ok === true, '`--verifier` rend ok sur une installation neuve', JSON.stringify(v.ecarts) + ' ' + JSON.stringify(v.fonctions_differentes || '') + (v.ok ? '' : ' regles=' + JSON.stringify(v.etat.regles)));
  });

  // ── LES DONNÉES (inventées) ─────────────────────────────────────────────
  const poserDonnees = () => {
    A(`insert into auth.users (id, email, email_confirmed_at) values
        ('${J}', 'j@exemple.fr', now()), ('${V}', 'v@exemple.fr', now()), ('${M}', 'm@exemple.fr', now()),
        ('${M2}', 'm2@exemple.fr', now()), ('${X}', 'x@exemple.fr', now()), ('${U}', 'u@exemple.fr', null);`);
    const row = (o, id, d) => `('${o}', ${lit(id)}, ${js(d)}::jsonb)`;
    A(`insert into public.app_data (owner, id, data) values
      ${row(J, 'main', { vinted_ship_done: { 111: 1 }, vinted_pickup_done: { 211: 1 }, vinted_annonce_numeros: { 5: { num: '12', buyPrice: 31.5 } } })},
      ${row(J, 'email_bord_111', { pdfB64: 'JVBERi0xLjQ=', numero: '12', modele: 'Nike Air', transaction: '111' })},
      ${row(J, 'harvest_9_label_111', { pdfB64: 'JVBERi0xLjQ=', tx: '111', item: '5' })},
      ${row(J, 'harvest_9_label_latest', { pdfB64: 'JVBERi0xLjQ=', tx: '111' })},
      ${row(J, 'panel_colis_relais', { 211: { code: 'C49341', lieu: 'Relais Cancale' } })},
      ${row(J, 'email_track_mondialrelay_AB123', { code: '123456', suivi: 'AB123' })},
      ${row(J, 'harvest_9_orders_sold', { payload: { my_orders: [
        { transaction_id: 111, item_id: 5, title: 'Nike Air', status: 'Le paiement a été validé', transaction_user_status: 'needs_action', price: { amount: '42.00' }, total_item_price: { amount: '42.00' }, opposite_user: { login: 'acheteur_x' }, photo: { url: 'https://images1.vinted.net/x.jpg', dominant_color: '#fff' } },
        { transaction_id: 112, title: 'Vieille vente', status: 'Commande finalisée', price: { amount: '77.00' } }] } })},
      ${row(J, 'harvest_9_orders_purchased', { payload: { my_orders: [
        { transaction_id: 211, title: 'Achat Samba', status: 'Colis déposé en point relais', transaction_user_status: 'needs_action', price: { amount: '15.00' } }] } })},
      ${row(J, 'harvest_9_txn_111', { transaction: { id: 111, price: '42.00', buyer: 'acheteur_x' } })},
      ${row(J, 'harvest_9_billing', { payload: { main: 281.94, escrow: 2235.8 } })},
      ${row(J, 'harvest_9_inbox', { conversations: [{ id: 1, description: 'bonjour' }] })},
      ${row(J, 'ebay_tokens', { refresh_token: 'secret-ebay' })},
      ${row(J, 'email_sale_111', { montant: '42.00' })},
      ${row(J, 'email_inconnu_1', { corps: 'email entier' })},
      ${row(J, 'email_bord_111_copie', { pdfB64: 'JVBERi0xLjQ=' })},
      ${row(J, 'harvest_9_labels', { x: 1 })},
      ${row(J, 'panel_colis_relais_ancien', { x: 1 })},
      ${row(V, 'email_bord_999', { pdfB64: 'JVBERi0xLjQ=', modele: 'Adidas' })},
      ${row(V, 'panel_colis_relais', { 999: { code: 'V0000' } })},
      ${row(V, 'harvest_8_orders_sold', { payload: { my_orders: [{ transaction_id: 999, title: 'Vente de V', status: 'Le paiement a été validé' }] } })},
      ${row(M, 'main', { vrm_prenom: 'Membre' })};
      insert into public.vinted_accounts (vinted_user_id, login, owner, access_token, refresh_token) values
        ('9', 'jlogin', '${J}', 'tokJ', 'refJ'), ('8', 'vlogin', '${V}', 'tokV', 'refV');`);
  };
  await essaie('données', poserDonnees);
  const nbJ = Number(A(`select count(*) from public.app_data where owner = '${J}'`));
  // La requête DEMANDE le vendeur lu (en-tête `x-vrm-equipe`), comme le fera l'écran de l'équipe.
const lusDe = (u, owner, entete = owner) => lignes(en(u, `select id from public.app_data where owner = '${owner}' order by id;`, entete));

  // ── AVANT TOUTE ACCEPTATION : rien ──────────────────────────────────────
  const ids = {};
  await essaie('inviter', () => {
    const inv = (u, e) => JSON.parse(en(u, `select public.vrm_equipe_inviter(${lit(e)});`));
    const a = inv(J, 'M@Exemple.fr '); dit(a.ok === true && a.statut === 'invitee', 'le vendeur invite par email (normalisé)', JSON.stringify(a)); ids.M = a.id;
    dit(inv(J, 'm@exemple.fr').deja === true, 'inviter deux fois la même adresse ne crée pas de doublon');
    ids.X = inv(J, 'x@exemple.fr').id; ids.U = inv(J, 'u@exemple.fr').id; ids.M2 = inv(V, 'm2@exemple.fr').id;
    dit(inv(J, 'j@exemple.fr').raison === 'soi', 'le vendeur ne peut pas s\'inviter lui-même');
    dit(inv(J, 'pas-une-adresse').raison === 'email', 'une adresse illisible est refusée');
    const anon = run(ANON + "select public.vrm_equipe_inviter('a@b.fr');");
    dit(!anon.ok && /permission denied/.test(anon.err), 'sans compte, inviter est refusé (anon)');
  });
  await essaie('avant acceptation', () => {
    dit(lusDe(M, J).length === 0, 'invité mais pas encore accepté : le membre ne lit RIEN du vendeur');
    const l = JSON.parse(en(M, 'select public.vrm_equipe_lister();'));
    dit(l.invitations.length === 1 && l.invitations[0].de === 'j@exemple.fr', 'l\'invité voit son invitation (et qui l\'invite)', JSON.stringify(l.invitations));
    dit(JSON.parse(en(X, 'select public.vrm_equipe_lister();')).invitations.length === 1, 'chaque invité ne voit que la sienne');
  });

  // ── ACCEPTER ────────────────────────────────────────────────────────────
  await essaie('accepter', () => {
    dit(en(U, `select public.vrm_equipe_accepter('${ids.U}');`) === 'f', 'une adresse NON confirmée ne peut pas accepter');
    dit(lusDe(U, J).length === 0, 'et elle ne lit rien');
    dit(en(M, `select public.vrm_equipe_accepter('${ids.X}');`) === 'f', 'on ne peut pas accepter l\'invitation adressée à une AUTRE adresse');
    dit(lusDe(M, J).length === 0, 'et elle n\'ouvre rien');
    dit(en(M, `select public.vrm_equipe_accepter('${ids.M}');`) === 't', 'l\'invité (adresse confirmée) accepte');
    dit(en(M2, `select public.vrm_equipe_accepter('${ids.M2}');`) === 't', 'le membre de l\'autre vendeur accepte la sienne');
  });

  // ── LE MEMBRE ACTIF ─────────────────────────────────────────────────────
  await essaie('le membre lit les colis, et rien d\'autre', () => {
    const lus = lusDe(M, J);
    dit(JSON.stringify(lus) === JSON.stringify(PERMIS_J), 'le membre lit EXACTEMENT les colis du vendeur (bordereaux, étiquettes captées, suivi, codes de retrait)', JSON.stringify(lus));
    for (const interdit of ['main', 'harvest_9_orders_sold', 'harvest_9_txn_111', 'harvest_9_billing', 'ebay_tokens', 'harvest_9_inbox', 'email_sale_111', 'email_inconnu_1'])
      dit(!lus.includes(interdit), `le membre ne lit PAS « ${interdit} »`);
    dit(!lus.includes('email_bord_111_copie') && !lus.includes('harvest_9_labels') && !lus.includes('panel_colis_relais_ancien'), 'la liste blanche est ancrée (un id qui COMMENCE comme un colis ne passe pas)');
    dit(en(M, `select count(*) from public.vinted_accounts where owner = '${J}';`, J) === '0', 'le membre ne lit PAS les comptes Vinted du vendeur (jetons)');
    dit(en(M, "select count(*) from public.vinted_accounts;") === '0', 'ni aucun compte Vinted');
    dit(lusDe(M, V).length === 0, 'le membre de J ne lit rien de l\'autre vendeur');
    dit(JSON.stringify(lusDe(M, M, J)) === '["main"]', 'le membre voit toujours SES lignes à lui (même en mode équipe)');
    const bord = en(M, `select data->>'pdfB64' from public.app_data where owner = '${J}' and id = 'email_bord_111';`, J);
    dit(bord === 'JVBERi0xLjQ=', 'il lit le PDF du bordereau (pour l\'imprimer)');
    const meta = en(M, `select meta->>'_pdf' from public.app_data where owner = '${J}' and id = 'harvest_9_label_111';`, J);
    // ⚠️ LE MÉLANGE : sans en-tête (ses écrans à lui, qui lisent sans filtre de propriétaire), il ne voit QUE ses lignes.
    dit(lignes(en(M, "select id from public.app_data where id like 'email_bord_%' or id like 'panel_%' or id like 'harvest_%' order by id;")).length === 0,
      'SANS la demande explicite (ses propres écrans, qui lisent sans filtre de propriétaire), le membre ne voit AUCUNE ligne du vendeur mêlée aux siennes');
    dit(JSON.stringify(lignes(en(M, 'select id from public.app_data order by id;'))) === '["main"]', 'sans en-tête : seulement SES lignes');
    dit(lusDe(M, V, V).length === 0, 'en DEMANDANT un vendeur dont il n\'est pas membre : rien');
    dit(lusDe(M, J, 'pas-un-uuid').length === 0 && lusDe(M, J, '').length === 0, 'un en-tête illisible : rien (et pas d\'erreur)');
    const brut = run(comme(M) + `set "request.headers" = 'pas du json';\nselect count(*) from public.app_data where owner = '${J}';`);
    dit(brut.ok && brut.out === '0', 'des en-têtes illisibles ne cassent pas la lecture et n\'ouvrent rien', brut.err);
    dit(meta === 'true', 'et le `meta` de l\'étiquette captée (même ligne)');
  });

  await essaie('la projection des colis', () => {
    const t = en(M, `select public.vrm_equipe_colis('${J}');`);
    const c = JSON.parse(t);
    dit(c && c.ventes.length === 1 && c.ventes[0].title === 'Nike Air' && c.ventes[0].transaction_user_status === 'needs_action', 'la projection rend la vente à expédier (titre, état), pas la vente finalisée', t.slice(0, 200));
    dit(c && c.achats.length === 1 && c.achats[0].title === 'Achat Samba', 'et l\'achat à retirer');
    dit(c && c.comptes['9'] === 'jlogin', 'et le login du compte (pour dire sur quel compte)');
    dit(c && JSON.stringify(c.postes) === '["111"]' && JSON.stringify(c.retires) === '["211"]', 'et les colis déjà cochés « posté » / « retiré » (les clés seules)');
    for (const fuite of ['42.00', '77.00', '15.00', 'price', 'acheteur_x', 'tokJ', 'refJ', 'buyPrice', '31.5', 'secret-ebay', 'dominant_color'])
      dit(!t.includes(fuite), `la projection ne porte PAS « ${fuite} »`);
    dit(en(M, `select coalesce(public.vrm_equipe_colis('${V}')::text, 'null');`) === 'null', 'la projection d\'un AUTRE vendeur rend null');
    dit(en(J, `select coalesce(public.vrm_equipe_colis('${J}')::text, 'null');`) === 'null', 'le vendeur sur lui-même : null (il a ses écrans)');
  });

  await essaie('le membre n\'écrit rien', () => {
    const avant = A(`select md5(string_agg(id || data::text, ',' order by id)) from public.app_data where owner = '${J}'`);
    const u = enRun(M, `with x as (update public.app_data set data = '{"vide":1}' where owner = '${J}' returning 1) select count(*) from x;`, J);
    dit(u.ok ? u.out === '0' : /permission denied|row-level/.test(u.err), 'le membre ne peut RÉÉCRIRE aucune ligne du vendeur', u.ok ? u.out + ' ligne(s)' : u.err.slice(0, 80));
    const d = enRun(M, `with x as (delete from public.app_data where owner = '${J}' returning 1) select count(*) from x;`, J);
    dit(d.ok ? d.out === '0' : /permission denied|row-level/.test(d.err), 'ni en EFFACER une', d.ok ? d.out + ' ligne(s)' : d.err.slice(0, 80));
    const i = enRun(M, `insert into public.app_data (owner, id, data) values ('${J}', 'email_bord_777', '{}');`, J);
    dit(!i.ok, 'ni en CRÉER une au nom du vendeur', i.err.slice(0, 80));
    dit(A(`select md5(string_agg(id || data::text, ',' order by id)) from public.app_data where owner = '${J}'`) === avant, 'les lignes du vendeur sont intactes');
    const t1 = enRun(M, 'select count(*) from public.vrm_equipe;');
    dit(!t1.ok && /permission denied/.test(t1.err), 'la table de l\'équipe ne se lit pas en direct');
    const t2 = enRun(M, `insert into public.vrm_equipe (vendeur, email, membre, statut, accepte_le) values ('${V}', 'm@exemple.fr', '${M}', 'actif', now());`);
    dit(!t2.ok, 'personne ne s\'ajoute à une équipe en écrivant la table', t2.ok ? 'INSÉRÉ' : '');
    dit(lusDe(M, V).length === 0, 'et le membre ne lit toujours rien de l\'autre vendeur');
    const e = enRun(M, `select public.vrm_equipe_effacer('${J}');`);
    dit(!e.ok && /permission denied/.test(e.err), 'l\'effacement (serveur) est refusé à un navigateur');
  });

  await essaie('les autres', () => {
    dit(lusDe(M2, J).length === 0, 'le membre d\'un AUTRE vendeur ne lit rien de J');
    dit(JSON.stringify(lusDe(M2, V)) === '["email_bord_999","panel_colis_relais"]', 'il lit les colis de SON vendeur', JSON.stringify(lusDe(M2, V)));
    dit(lusDe(X, J).length === 0, 'une invitation non acceptée n\'ouvre rien');
    dit(lignes(en(J, `select id from public.app_data where owner = '${J}';`)).length === nbJ, 'le vendeur voit TOUTES ses lignes, comme avant');
    dit(lignes(en(J, `select id from public.app_data where owner = '${J}';`, J)).length === nbJ, 'même si son navigateur envoie l\'en-tête');
    dit(en(J, `select count(*) from public.vinted_accounts where owner = '${J}';`) === '1', 'et son compte Vinted, comme avant');
    dit(Q(ANON + 'select count(*) from public.app_data;') === '0', 'sans compte : rien');
    dit(Q(SERVEUR + `select count(*) from public.app_data where owner = '${J}';`) === String(nbJ), 'le serveur (clé de service) : inchangé');
  });

  await essaie('l\'abonnement du VENDEUR', () => {
    A("update public.vrm_reglages set valeur = '1' where cle = 'abonnement_obligatoire';");
    dit(lusDe(J, J, null).length === 0, 'abonnement obligatoire, le vendeur ne paie pas : il ne lit plus rien (règle du 4 octobre intacte)');
    dit(lusDe(M, J).length === 0, 'et son équipe non plus');
    dit(en(M, `select coalesce(public.vrm_equipe_colis('${J}')::text, 'null');`) === 'null', 'ni la projection des colis');
    A(`insert into public.abonnements (owner, statut) values ('${J}', 'active');`);
    dit(lusDe(J, J, null).length === nbJ, 'le vendeur paie : il relit tout');
    dit(JSON.stringify(lusDe(M, J)) === JSON.stringify(PERMIS_J), 'son membre relit les colis — sans abonnement à lui (un aide ne paie pas)');
    dit(lusDe(M2, V).length === 0, 'l\'autre vendeur ne paie pas : son membre ne lit rien');
    A("update public.vrm_reglages set valeur = '0' where cle = 'abonnement_obligatoire'; delete from public.abonnements;");
  });

  await essaie('révoquer', () => {
    dit(en(M2, `select public.vrm_equipe_revoquer('${ids.X}');`) === 'f', 'personne d\'autre que le vendeur (ou le membre) ne révoque une invitation');
    dit(en(J, `select public.vrm_equipe_revoquer('${ids.M}');`) === 't', 'le vendeur révoque son membre');
    dit(lusDe(M, J).length === 0, 'révoqué : le membre ne lit PLUS RIEN, tout de suite');
    dit(en(M, `select coalesce(public.vrm_equipe_colis('${J}')::text, 'null');`) === 'null', 'ni la projection');
    dit(en(M, `select public.vrm_equipe_accepter('${ids.M}');`) === 'f', 'une invitation révoquée ne se réaccepte pas');
    const r = JSON.parse(en(J, "select public.vrm_equipe_inviter('m@exemple.fr');"));
    dit(r.ok && r.deja === false, 'le vendeur peut le réinviter (une nouvelle invitation)');
    dit(en(M, `select public.vrm_equipe_accepter('${r.id}');`) === 't' && lusDe(M, J).length === PERMIS_J.length, 'réaccepté : il relit les colis');
    dit(en(M, `select public.vrm_equipe_revoquer('${r.id}');`) === 't' && lusDe(M, J).length === 0, 'le membre peut QUITTER lui-même — et ne lit plus rien');
    const l = JSON.parse(en(J, 'select public.vrm_equipe_lister();'));
    dit(l.equipe.some((x) => x.email === 'm@exemple.fr' && x.statut === 'revoquee'), 'le vendeur voit qui est révoqué');
  });

  await essaie('le plafond', () => {
    const n = Number(A(`select count(*) from public.vrm_equipe where vendeur = '${J}' and statut <> 'revoquee'`));
    for (let i = n; i < 5; i++) en(J, `select public.vrm_equipe_inviter('p${i}@exemple.fr');`);
    dit(JSON.parse(en(J, "select public.vrm_equipe_inviter('trop@exemple.fr');")).raison === 'plafond', 'au plus 5 invitations vivantes par vendeur');
  });

  await essaie('la liste blanche, cas par cas', () => {
    const cas = { email_bord_23052006117: true, email_track_chronopost_XW476115185SP: true, 'email_track_vinted_04103186091937': true, harvest_199082413_label_23052006117: true,
      harvest_9_label_latest: true, panel_colis_relais: true, main: false, harvest_9_orders_sold: false, harvest_9_txn_1: false, 'email_bord_1 ': false,
      'email_bord_1/../main': false, email_bordx_1: false, 'email_track__x': false, harvest_x_label_1: false, ebay_tokens: false, ebay_tokens_ab12: false,
      email_sale_1: false, email_quarantaine_1: false, panel_buyprices: false, 'Email_bord_1': false };
    const faux = Object.entries(cas).filter(([id, att]) => (A(`select public.vrm_equipe_id_permis(${lit(id)})`) === 't') !== att).map(([id]) => id);
    dit(faux.length === 0, 'la liste blanche accepte les colis et refuse le reste (20 cas)', faux.join(', '));
  });

  await essaie('la vérification voit une garde touchée', () => {
    const touche = (nom, sql, partie) => {
      fraiche('t_' + nom.replace(/-/g, '_'), 'base');
      A(sql);
      const v = verifier('t_' + nom.replace(/-/g, '_'));
      dit(v.ok === false && v.ecarts.includes(partie), `--verifier voit « ${nom} » (${partie})`, JSON.stringify(v.ecarts));
    };
    touche('lecture-ouverte', 'grant select on public.vrm_equipe to authenticated;', 'droits');
    touche('colonne-ouverte', 'grant select (email) on public.vrm_equipe to authenticated;', 'droits_colonnes');
    touche('rls-non-force', 'alter table public.vrm_equipe no force row level security;', 'rls');
    touche('regle-table', 'create policy x on public.vrm_equipe for select to authenticated using (true);', 'regles_table');
    touche('invoker', 'alter function public.vrm_equipe_vendeur() security invoker;', 'fonctions');
    touche('corps', "create or replace function public.vrm_equipe_id_permis(p_id text) returns boolean language sql immutable set search_path = '' as $$ select true $$;", 'fonctions');
    touche('anon', 'grant execute on function public.vrm_equipe_colis(uuid) to anon;', 'fonctions');
    touche('restrictive-revenue', 'alter policy abonnement_requis on public.app_data using ((select public.vrm_acces_ok()));', 'regles');
    touche('ecriture-ajoutee', 'create policy equipe_ecrit on public.app_data for update to authenticated using (owner = (select public.vrm_equipe_vendeur()));', 'regles');
    touche('forme', 'alter table public.vrm_equipe add column note text;', 'forme');
    DB = 'base';
  });

  // ── L'ORDRE DE LA PRODUCTION : la 021 AVANT la 016 (22 octobre) ────────
  // En production, la 021 a posé `vrm_lecture_privee` (RESTRICTIVE, SELECT,
  // `owner = auth.uid()`) le 21 octobre, avant la 016. La 016 d'avant ne la
  // retouchait pas : le membre ne lisait RIEN (0 ligne au lieu des colis).
  const parcoursMembre = (nom) => {
    const a = JSON.parse(en(J, "select public.vrm_equipe_inviter('m@exemple.fr');"));
    dit(a.ok === true, nom + ' : le vendeur invite', JSON.stringify(a));
    dit(en(M, `select public.vrm_equipe_accepter('${a.id}');`) === 't', nom + ' : le membre accepte');
    const lus = lusDe(M, J);
    dit(JSON.stringify(lus) === JSON.stringify(PERMIS_J), nom + ' : le membre lit EXACTEMENT les colis du vendeur', JSON.stringify(lus));
    dit(lignes(en(M, "select id from public.app_data where id like 'email_bord_%' or id like 'panel_%' or id like 'harvest_%' order by id;")).length === 0, nom + ' : sans en-tête, rien du vendeur');
    dit(en(M, `select count(*) from public.vinted_accounts where owner = '${J}';`, J) === '0', nom + ' : ni ses comptes Vinted');
    dit(lusDe(M, V).length === 0 && lusDe(M2, J).length === 0, nom + ' : rien entre vendeurs (ni de l\'autre vendeur, ni pour un étranger)');
    const nb = Number(A(`select count(*) from public.app_data where owner = '${J}'`));
    dit(lignes(en(J, `select id from public.app_data where owner = '${J}';`)).length === nb && nb > 0, nom + ' : le vendeur lit toujours TOUTES ses lignes');
    dit(lignes(en(J, `select id from public.app_data where owner = '${J}';`, J)).length === nb, nom + ' : même avec l\'en-tête');
    dit(lignes(en(V, `select id from public.app_data where owner = '${J}';`, J)).length === 0, nom + ' : un autre vendeur qui DEMANDE J ne lit rien');
    const u = enRun(M, `with x as (update public.app_data set data = '{"vide":1}' where owner = '${J}' returning 1) select count(*) from x;`, J);
    dit(u.ok ? u.out === '0' : true, nom + ' : le membre n\'écrit rien', u.out);
    const v = verifier(DB);
    dit(v.ok === true, nom + ' : `--verifier` rend ok', JSON.stringify(v.ecarts) + (v.ok ? '' : ' regles=' + JSON.stringify(v.etat.regles) + ' bloquantes=' + JSON.stringify(v.etat.restrictives_bloquantes)));
  };
  await essaie('021 puis 016 (l\'ordre de la production)', () => {
    fraiche('prod021', 'socle');
    Q(fs.readFileSync(M021, 'utf8'));
    dit(Q("select qual from pg_policies where tablename = 'app_data' and policyname = 'vrm_lecture_privee'") === '(owner = ( SELECT auth.uid() AS uid))', 'la 021 posée seule : sa restrictive de lecture ne connaît pas l\'équipe (comme en production le 22 octobre)');
    const r = run(SQL);
    if (!r.ok) throw new Error(r.err);
    if (mut && mut.apres) A(mut.apres);
    poserDonnees();
    parcoursMembre('021 puis 016');
  });
  await essaie('016 puis 021', () => {
    fraiche('inverse', 'socle');
    const r = run(SQL);
    if (!r.ok) throw new Error(r.err);
    Q(fs.readFileSync(M021, 'utf8'));
    poserDonnees();
    parcoursMembre('016 puis 021');
    const t = run(SQL);
    dit(t.ok, '016 puis 021 : la 016 se rejoue encore', t.err);
  });
  await essaie('une autre restrictive inconnue', () => {
    fraiche('bloquee', 'socle');
    Q('create policy autre_verrou on public.app_data as restrictive for select to authenticated using (owner = (select auth.uid()));');
    const r = run(SQL);
    dit(!r.ok && /vrm_equipe_lecture_bloquee/.test(r.err), 'une restrictive de lecture qui ignore l\'équipe fait REFUSER la migration (pas de fonction morte)', r.ok ? 'installée quand même' : r.err.slice(0, 120));
    dit(Q("select count(*) from pg_proc where proname like 'vrm\\_equipe\\_%'") === '0', 'et rien n\'est installé');
  });
  // ── L'ESSAI DE PRODUCTION (scripts/equipe-sql/essai-production.cjs) ────
  // Le bloc qui a été joué le 22 octobre sur la vraie base : il doit tourner
  // d'un bloc sur une base à la forme de la production (021 posée), dire ce
  // qu'il faut, et ne RIEN laisser.
  await essaie('l\'essai de production', () => {
    fraiche('essai_prod', 'socle');
    A(`alter table auth.users add column if not exists aud text, add column if not exists role text,
         add column if not exists created_at timestamptz, add column if not exists updated_at timestamptz;
       grant insert on auth.users to postgres;`);
    Q(fs.readFileSync(M021, 'utf8'));
    poserDonnees();
    A(`update public.vrm_reglages set valeur = '${J}' where cle = 'proprietaire';`);
    const avant = A(`select md5(string_agg(owner::text || id || data::text, ',' order by owner, id)) from public.app_data`);
    const g = spawnSync(process.execPath, [path.join(__dirname, 'equipe-sql/essai-production.cjs'), '--migration=' + FMIG], { encoding: 'utf8' });
    if (g.status !== 0) throw new Error('générateur : ' + g.stderr.slice(0, 200));
    const r = run(g.stdout);
    dit(r.ok, 'l\'essai de production passe d\'un bloc', r.err);
    if (r.ok) {
      const t = JSON.parse(lignes(r.out).pop()), e = t.essai || {};
      dit(e.autre_vendeur_trouve === true && e.avant_r_lit_j === 0 && e.apres_r_lit_j === 0 && e.apres_r_demande_j === 0 && e.apres_b_demande_j === 0,
        'essai : un autre vendeur ne lit rien du propriétaire (même en le DEMANDANT)', JSON.stringify([e.avant_r_lit_j, e.apres_r_lit_j, e.apres_r_demande_j, e.apres_b_demande_j]));
      dit(e.avant_j_lit_tout === e.avant_j_postgres && e.apres_j_lit_tout === e.avant_j_postgres && e.apres_j_lit_siennes_entete === e.avant_j_postgres,
        'essai : le propriétaire lit toutes ses lignes, avant comme après', JSON.stringify([e.avant_j_postgres, e.avant_j_lit_tout, e.apres_j_lit_tout]));
      dit(e.permis_j && e.permis_j.n === PERMIS_J.length && e.m_demande_j && e.m_demande_j.n === e.permis_j.n && e.m_demande_j.md5 === e.permis_j.md5 && e.m_demande_j.hors_liste === 0,
        'essai : l\'aide lit EXACTEMENT la liste blanche', JSON.stringify([e.permis_j, e.m_demande_j]));
      dit(e.m_sans_entete_j === 0 && e.m_demande_j_main === 0 && e.m_demande_j_ventes === 0 && e.m_demande_j_comptes_vinted === 0 && e.m_demande_r === 0,
        'essai : et rien d\'autre (ni sans en-tête, ni main, ni ventes, ni comptes Vinted, ni l\'autre vendeur)');
      dit(e.m_colis && e.m_colis.ventes === 1 && e.m_colis.achats === 1 && Array.isArray(e.m_colis.cles_argent) && e.m_colis.cles_argent.length === 0 && e.m_colis.mot_argent === false
        && Array.isArray(e.permis_j_cles_argent) && e.permis_j_cles_argent.length === 0, 'essai : la projection et les colis ne portent aucune clé d\'argent', JSON.stringify(e.m_colis));
      dit(e.m_modifie_j === 0 && e.m_efface_j === 0 && e.m_cree_chez_j && e.m_cree_chez_j.erreur === '42501', 'essai : l\'aide n\'écrit rien');
      dit(e.m_accepte === true && e.n_accepte === false && e.r_prend_invitation_m === false && e.j_revoque_m === true && e.m_revoque_demande_j === 0 && e.m_revoque_colis === null,
        'essai : accepter (adresse confirmée seulement), révoquer (plus rien, tout de suite)');
      dit(t.verification && t.verification.ok === true, 'essai : la vérification rend ok dans la transaction', JSON.stringify(t.verification && t.verification.ecarts));
    }
    dit(Q("select to_regclass('public.vrm_equipe') is null") === 't' && Q("select count(*) from pg_proc where proname like 'vrm\\_equipe\\_%'") === '0'
      && Q("select count(*) from pg_policies where policyname = 'equipe_lit'") === '0'
      && Q("select qual from pg_policies where tablename = 'app_data' and policyname = 'vrm_lecture_privee'") === '(owner = ( SELECT auth.uid() AS uid))',
      'après l\'essai de production : ni table, ni fonction, ni règle — tout est comme avant');
    dit(A("select count(*) from auth.users where email like 'essai-016-%'") === '0' && A(`select md5(string_agg(owner::text || id || data::text, ',' order by owner, id)) from public.app_data`) === avant,
      'après l\'essai de production : aucun compte inventé, aucune ligne touchée');
  });

  await essaie('la vérification voit la restrictive de la 021 retouchée', () => {
    fraiche('t_lecture_021', 'prod021');
    A('alter policy vrm_lecture_privee on public.app_data using (owner = (select auth.uid()));');
    const v = verifier('t_lecture_021');
    dit(v.ok === false && v.ecarts.includes('regles') && v.ecarts.includes('restrictives_bloquantes'), '--verifier voit « la restrictive de la 021 sans l\'équipe » (regles, restrictives_bloquantes)', JSON.stringify(v.ecarts));
    DB = 'base';
  });

  console.log(`\n${ok} vert(s), ${ko} rouge(s).`);
  process.exit(ko === 0 ? 0 : 1);
})();
