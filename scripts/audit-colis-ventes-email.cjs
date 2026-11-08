#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT (8 nov., chantier « restes ventes ») — LE WIDGET IPHONE ET LES RAPPELS
// COMPTENT LES VENTES VUES PAR E-MAIL DONT LE BORDEREAU EST LÀ, COMME MA JOURNÉE.
//
// Avant : Ma journée comptait une vente connue seulement par son e-mail (liste
// Vinted pas encore relue) dès que SON bordereau (même n° de transaction, PDF)
// était arrivé (src/bordereauVenteEmail.js) ; api/widget.js et
// api/ship-reminders.js (matin, soir, bilan) ne lisaient que la liste Vinted :
// l'iPhone affichait un colis de moins.
//
// La règle serveur (api/_lib/colis-ventes-email.js) IMPORTE celles de l'app
// (`ventesEmailFraiches`, `colisVentesEmail`) et les preuves de départ
// (`ventesPartiesParPreuve`). Ce qui est EXÉCUTÉ (jamais lu comme du texte) :
//  §1 la règle sur une base inventée : 50 ventes e-mail au MÊME titre, un seul
//     bordereau ⇒ une seule compte (jamais le titre) ; pas su ⇒ rien ;
//  §2 la route api/widget (résumé de l'extension ET liste entière), pannes :
//     e-mail avant la lecture, sans bordereau, sans PDF, compte masqué, compte
//     non lié, n° déjà dans la liste (non « à expédier »), parti (e-mail de
//     dépôt, Colis fait), e-mail de statut ⇒ rien ;
//  §3 les rappels (`lireDonneesColis`) et le bilan (`lireDonneesBilan`) ;
//  §4 l'app (le modèle de Ma journée : les mêmes fonctions, appelées comme
//     `toShip` les appelle) = widget = rappels. Le banc
//     scripts/bancs/colis-ventes-email.cjs le refait avec l'app RENDUE.
// Preuve (§6) : `--prouve` (mutations) ; sur la branche de départ (git archive)
// le widget compte 1 au lieu de 3 ⇒ rouge.
// Données INVENTÉES (le dépôt est public) — jamais en production.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'liste-ignoree': ['api/_lib/colis-ventes-email.js', '  const ventes = [...ensembleDe(connues)].map((t) => ({ transaction_id: t }));\n', '  const ventes = [];\n'],
  'sans-preuve-depart': ['api/_lib/colis-ventes-email.js', '    partie: (o) => partis.has(String(o.transaction_id)),\n', '    partie: () => false,\n'],
  'compte-ecarte-ignore': ['api/_lib/colis-ventes-email.js', '    ecarte: (u) => compteEcarte(u, m, panneau || {}), ventes, ko, lectures,\n', '    ecarte: () => false, ventes, ko, lectures,\n'],
  'resume-pris-pour-liste': ['api/widget.js', '    if (!txSold || !r.txs.length) return r;\n', '    return r;\n'],
  'widget-sans-email': ['api/widget.js', '    for (const t of venteEmail.txs) shipTxns.add(String(t));\n', ''],
  'rappels-sans-email': ['api/ship-reminders.js', '  for (const t of ventesEmailColis(d).txs) vinted.add(String(t));\n', ''],
  'lecture-ignoree': ['src/venteEmailFraiche.js', '    if (!(p.t > lu)) continue;                                          // (c) la lecture fait foi\n', ''],
  'relie-par-titre': ['src/bordereauVenteEmail.js', "    const b = bordsParTx[tx];\n    if (!b || String(b.transaction) !== tx) continue;          // l'identité, rien d'autre\n", '    const b = bordsParTx[tx] || Object.values(bordsParTx).find((x) => x && x.modele && x.modele === o.title);\n    if (!b) continue;\n'],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const choisies = Object.entries(MUTATIONS);
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-cve-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const s = fs.readFileSync(path.join(t, f), 'utf8');
    if (s.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${s.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), s.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8', timeout: 240000 });
    const rouges = (String(r.stdout || '').match(/^❌.*$/gm) || []);
    const tombe = r.status !== 0 && rouges.length > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges.length + ' rouge(s) — ' + rouges[0].slice(2, 120) : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = choisies.length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String((e && e.stack) || e).split('\n').slice(0, 2).join(' ').slice(0, 260)); } };
const importer = (p) => import('file://' + path.join(R, p));
let comptesBanc = [{ vinted_user_id: '111' }, { vinted_user_id: '222' }];

// ── L'environnement des routes ──────────────────────────────────────────────
const A = '11111111-2222-3333-4444-555555555555';
process.env.SUPABASE_SERVICE_KEY = 'banc-cle-service';
process.env.VRM_OWNER_UID = A;
process.env.CRON_SECRET = 'cle-banc-cron';
delete process.env.AI_API_KEY; delete process.env.ANTHROPIC_API_KEY;

// ── Une fausse base à état, à la forme de PostgREST (scalaires `meta->>`, projections) ──
const base = new Map();
let pannes = new Set();
const rep = (c, s = 200) => new Response(typeof c === 'string' ? c : JSON.stringify(c), { status: s, headers: { 'content-type': 'application/json' } });
const chemin = (obj, ch) => { let v = obj; for (const seg of ch.split(/->>|->/)) v = v == null ? undefined : v[seg]; return v; };
const metaDe = (d) => { const m = {}; if (d && typeof d === 'object') for (const [k, v] of Object.entries(d)) { if (v == null || typeof v === 'object') continue; const s = String(v); if (s.length <= 600) m[k] = s; } return m; };
const valeur = (l, k) => {
  if (k === 'id') return l.id; if (k === 'owner') return l.owner;
  if (k.startsWith('meta->>')) return metaDe(l.data)[k.slice(7)];
  if (k.startsWith('data->>') || k.startsWith('data->')) { const v = chemin(l.data, k.replace(/^data(->>|->)/, '')); return v == null ? undefined : (typeof v === 'object' ? JSON.stringify(v) : String(v)); }
  return undefined;
};
const teste = (x, op) => {
  const i = op.indexOf('.'); const o = op.slice(0, i), v = op.slice(i + 1);
  if (o === 'eq') return x === v;
  if (o === 'neq') return x !== v;
  if (o === 'like' || o === 'ilike') { const re = new RegExp('^' + v.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$', o === 'ilike' ? 'i' : ''); return x != null && re.test(x); }
  if (o === 'in') return v.replace(/^\(|\)$/g, '').split(',').map((y) => y.replace(/^"|"$/g, '')).includes(x);
  if (o === 'is') return v === 'null' ? x == null : true;
  if (o === 'not') return !teste(x, v);
  return true;
};
const filtrer = (u) => {
  const conds = [];
  for (const [k, v] of u.searchParams) {
    if (['select', 'on_conflict', 'limit', 'order', 'offset', 'or'].includes(k)) continue;
    conds.push((l) => teste(valeur(l, k), v));
  }
  return [...base.entries()].map(([cle, d]) => { const i = cle.indexOf('|'); return { owner: cle.slice(0, i), id: cle.slice(i + 1), data: d }; }).filter((l) => conds.every((c) => c(l)));
};
const projeter = (l, sel) => {
  if (!sel || sel === '*') return { owner: l.owner, id: l.id, data: l.data };
  const o = {};
  for (const part of sel.split(',')) {
    const [alias, ch] = part.includes(':') ? part.split(/:(.+)/) : [part.split(/->>|->/).pop(), part];
    if (ch === 'id' || ch === 'owner') { o[alias] = l[ch]; continue; }
    if (ch === 'data') { o[alias] = l.data; continue; }
    if (ch.startsWith('meta->>')) { const v = metaDe(l.data)[ch.slice(7)]; o[alias] = v == null ? null : v; continue; }
    const v = chemin(l.data, ch.replace(/^data(->>|->)/, ''));
    o[alias] = v === undefined ? null : (/->>[^>]*$/.test(ch) && v != null && typeof v !== 'object' ? String(v) : v);
  }
  return o;
};
const lectures = [];
global.fetch = async (url, opts = {}) => {
  const u = new URL(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  if (u.pathname === '/rest/v1/rpc/vrm_acces_pour') return rep(true);
  if (u.pathname === '/rest/v1/vinted_accounts') return rep(comptesBanc);
  if (u.pathname !== '/rest/v1/app_data') return rep([]);
  const brut = decodeURIComponent(u.pathname + u.search);
  if (m !== 'GET') return new Response('', { status: 201 });
  lectures.push(brut);
  for (const p of pannes) if (brut.includes(p)) return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
  const sel = u.searchParams.get('select') || '';
  if (sel === 'owner' && u.searchParams.get('limit') === '1') return rep([]);
  return rep(filtrer(u).map((l) => projeter(l, sel)));
};
const faireRes = () => { const r = { code: null, corps: null }; r.status = (n) => { r.code = n; return r; }; r.json = (o) => { r.corps = o; return r; }; r.setHeader = () => {}; r.send = () => r; r.end = () => r; return r; };

// ── LA BASE DU BANC (INVENTÉE, à la forme mesurée — jamais en production) ──
const H = 3600000, NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const n = (i) => `XW${String(600000000 + i).padStart(9, '0')}TS`;
const TITRE = 'Nike Dunk Low Panda 42';
const jourFr = (ms) => new Date(ms).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
const LU = NOW - 24 * H;                 // la liste des ventes de U1 a été lue hier
const vente = (tx, o = {}) => ({ transaction_id: Number(tx), title: TITRE, status: 'Bordereau envoyé au vendeur', transaction_user_status: 'needs_action', date: iso(NOW - 50 * H), price: { amount: '60.0', currency_code: 'EUR' }, ...o });
const bord = (tx, suivi, o = {}) => ({ type: 'bordereau', transaction: tx, suivi, numero: '', modele: TITRE, article: TITRE, receivedAt: iso(NOW - 1.5 * H), filename: `b-${tx}.pdf`, pdfB64: 'JVBERi0x', dateLimite: '', ...o });
const mail = (tx, uid, at, o = {}) => ({ type: 'vente', designation: TITRE, prix: '60.00', uid, transaction: tx, receivedAt: iso(at), ...o });
const JUMELLES = Array.from({ length: 50 }, (_, i) => String(628100 + i));   // 50 ventes e-mail au MÊME titre
const SEULE = '628123';                                                     // la seule dont le bordereau est là
const ATTENDU = ['627001', '628001', SEULE].sort();
function poser({ resume = true } = {}) {
  base.clear(); pannes = new Set(); comptesBanc = [{ vinted_user_id: '111' }, { vinted_user_id: '222' }];
  base.set(`${A}|main`, { vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: { '628008': NOW - H }, vinted_bords_shipped: {}, vinted_bords_hidden: {}, vrm_colis_collected: [], vinted_accounts_hidden: ['222'], vrm_lbc_colis_done: {}, vrm_vc_colis_done: {}, vrm_vc_numeros: {}, vrm_vc_liens: {} });
  const ventes = [vente('627001'), vente('627002', { status: 'Commande finalisée', transaction_user_status: 'completed' })];
  base.set(`${A}|harvest_111_orders_sold`, { capturedAt: iso(LU), ...(resume ? { resume: { at: iso(LU), txns: [627001] } } : {}), payload: { my_orders: ventes } });
  base.set(`${A}|harvest_222_orders_sold`, { capturedAt: iso(LU), ...(resume ? { resume: { at: iso(LU), txns: [] } } : {}), payload: { my_orders: [] } });
  base.set(`${A}|harvest_111_orders_purchased`, { capturedAt: iso(LU), resume: { at: iso(LU), txns: [] }, payload: { my_orders: [] } });
  base.set(`${A}|panel_accounts_off`, {});
  base.set(`${A}|email_bord_7001`, bord('627001', n(1001), { receivedAt: iso(NOW - 48 * H), dateLimite: jourFr(NOW + 5 * 24 * H) + ' 10 h 00' }));
  // Les e-mails de vente (forme du serveur : `email_sale_*`, meta remplie par la base).
  const E = (id, d) => base.set(`${A}|email_sale_${id}`, d);
  E('a1', mail('628001', '111', NOW - 2 * H));                  base.set(`${A}|email_bord_8001`, bord('628001', n(1), { dateLimite: jourFr(NOW + 24 * H) + ' 23 h 00' }));
  E('a2', mail('628002', '111', NOW - 2 * H));                  // aucun bordereau
  E('a3', mail('628003', '111', NOW - 30 * H));                 base.set(`${A}|email_bord_8003`, bord('628003', n(3)));   // avant la lecture : la liste fait foi
  E('a4', mail('627002', '111', NOW - 2 * H));                  base.set(`${A}|email_bord_7002`, bord('627002', n(4)));   // déjà dans la liste (finalisée)
  E('a5', mail('628005', '222', NOW - 2 * H));                  base.set(`${A}|email_bord_8005`, bord('628005', n(5)));   // compte masqué
  E('a6', mail('628006', '999', NOW - 2 * H));                  base.set(`${A}|email_bord_8006`, bord('628006', n(6)));   // compte non lié
  E('a7', mail('628007', '111', NOW - 2 * H));                  base.set(`${A}|email_bord_8007`, bord('628007', n(7)));   // déposé (e-mail du transporteur)
  base.set(`${A}|email_track_chronopost_${n(7)}`, { type: 'suivi', carrier: 'chronopost', suivi: n(7), status: 'transit', subject: 'Votre colis est entre de bonnes mains', receivedAt: iso(NOW - H), emailAt: iso(NOW - H), sens: 'sortant' });
  E('a8', mail('628008', '111', NOW - 2 * H));                  base.set(`${A}|email_bord_8008`, bord('628008', n(8)));   // « Colis fait »
  E('a9', mail('628009', '111', NOW - 2 * H));                  base.set(`${A}|email_bord_8009`, bord('628009', n(9), { filename: 'None', pdfB64: undefined }));   // pas de PDF
  E('statut', { type: 'statut', designation: TITRE, uid: '111', transaction: '628010', receivedAt: iso(NOW - 2 * H) }); base.set(`${A}|email_bord_8010`, bord('628010', n(10)));   // un e-mail de STATUT n'est pas une vente
  JUMELLES.forEach((t, i) => E('j' + i, mail(t, '111', NOW - (2 + i / 100) * H)));
  base.set(`${A}|email_bord_${SEULE}`, bord(SEULE, n(200)));
  // Un bordereau au MÊME titre pour une transaction que rien ne connaît : il ne se relie à aucune jumelle.
  base.set(`${A}|email_bord_9999`, bord('629999', n(999)));
}

(async () => {
  const { contexteVendeur } = await importer('api/_lib/owner.js').catch(() => ({}));
  const widget = async () => { const w = (await importer('api/widget.js')).default; const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res); return res; };
  const SR = await importer('api/ship-reminders.js').catch(() => null);
  const rappels = async (quoi) => { const d = await contexteVendeur.run({ owner: A }, () => SR._banc[quoi]()); const t = SR._banc.txsAExpedier(d); return t ? [...t.vinted].sort() : null; };

  // ══ §1 LA RÈGLE (le serveur importe celles de l'app) ═══════════════════════
  await essaie('§1 la règle', async () => {
    const L = await importer('api/_lib/colis-ventes-email.js');
    dit(typeof L.colisVentesEmailServeur === 'function', 'api/_lib/colis-ventes-email.js existe (la règle serveur, qui importe celles de l’app)');
    const lib = fs.readFileSync(path.join(R, 'api/_lib/colis-ventes-email.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    dit(/from '\.\.\/\.\.\/src\/venteEmailFraiche\.js'/.test(lib) && /from '\.\.\/\.\.\/src\/bordereauVenteEmail\.js'/.test(lib) && /from '\.\/depart-vente\.js'/.test(lib), 'la règle serveur IMPORTE celles de l’app (aucune copie à la main)');
    dit(!/select=data\b/.test(lib) && /requeteVentesEmail/.test(lib), 'lecture projetée (la requête `meta->>` de l’app), jamais `select=data`');
    // 50 ventes e-mail au même titre, bordereaux au même titre : le titre ne relie rien.
    const mails = JUMELLES.map((t, i) => ({ type: 'vente', tx: t, uid: '111', at: iso(NOW - (2 + i / 100) * H), titre: TITRE }));
    const bp = { [SEULE]: { transaction: SEULE, suivi: n(200), filename: 'b.pdf', modele: TITRE }, '629999': { transaction: '629999', suivi: n(999), filename: 'b.pdf', modele: TITRE } };
    const r = L.colisVentesEmailServeur({ mails, comptes: ['111'], masques: [], panneau: {}, connues: ['627001'], lectures: { 111: LU }, bordsParTx: bp });
    dit(r.txs.length === 1 && r.txs[0] === SEULE, '50 ventes e-mail au même titre, deux bordereaux au même titre : seule celle dont le bordereau porte SON n° compte', JSON.stringify(r.txs));
    dit(L.colisVentesEmailServeur({ mails: null, comptes: ['111'], connues: [], lectures: { 111: LU }, bordsParTx: bp }).txs.length === 0, 'e-mails illisibles (null) ⇒ aucun colis e-mail (pas su)');
    dit(L.colisVentesEmailServeur({ mails, comptes: null, connues: [], lectures: { 111: LU }, bordsParTx: bp }).txs.length === 0, 'comptes liés illisibles ⇒ aucun colis e-mail (pas su)');
    dit(L.colisVentesEmailServeur({ mails, comptes: ['111'], connues: [], lectures: {}, bordsParTx: bp }).txs.length === 0, 'liste du compte jamais lue (aucune date) ⇒ rien (pas su)');
    dit(L.colisVentesEmailServeur({ mails, comptes: ['111'], connues: [SEULE], lectures: { 111: LU }, bordsParTx: bp }).txs.length === 0, 'n° déjà dans la liste Vinted ⇒ la liste gagne');
  });

  // ══ §2 LA ROUTE api/widget ════════════════════════════════════════════════
  const lireW = (r) => (r.corps && r.corps.ship ? r.corps.ship : null);
  await essaie('§2 widget', async () => {
    poser({ resume: true });
    lectures.length = 0;
    const r = await widget();
    const s = lireW(r);
    dit(r.code == null || r.code === 200, 'le widget répond', `code=${r.code} ${JSON.stringify(r.corps).slice(0, 160)}`);
    dit(s && s.vinted === ATTENDU.length, `widget (résumé de l’extension) : ${ATTENDU.length} colis Vinted — 627001 (liste) + 628001 et ${SEULE} (vues par e-mail, leur bordereau là)`, `vinted=${s && s.vinted}`);
    dit(s && s.tomorrow >= 1, 'widget : la date limite LUE dans le bordereau de la vente e-mail compte (demain)', `tomorrow=${s && s.tomorrow}`);
    dit(lectures.some((q) => /email_sale_/.test(q) && /meta->>type=eq\.vente/.test(q)), 'widget : les e-mails de vente lus PROJETÉS pour cette règle (meta->>)', lectures.filter((q) => /email_sale_/.test(q)).join(' | ').slice(0, 300));
    poser({ resume: false });
    const r2 = lireW(await widget());
    dit(r2 && r2.vinted === ATTENDU.length, `widget (liste entière, sans résumé) : les ${ATTENDU.length} mêmes`, `vinted=${r2 && r2.vinted}`);
    poser({ resume: true }); pannes.add('meta->>type=eq.vente');
    const r3 = lireW(await widget());
    dit(r3 && r3.vinted === 1, 'e-mails de vente illisibles ⇒ la liste Vinted seule (1), rien d’inventé, le widget répond', `vinted=${r3 && r3.vinted}`);
    poser({ resume: true }); pannes.add('id=in.(harvest_111_orders_sold)');
    const r4 = lireW(await widget());
    dit(r4 && r4.vinted === 1, 'résumé seul et liste entière illisible ⇒ « n° absent de la liste » pas jugeable : aucun colis e-mail', `vinted=${r4 && r4.vinted}`);
    poser({ resume: true }); comptesBanc = [];
    const r5 = lireW(await widget());
    dit(r5 && r5.vinted === 1, 'comptes liés pas sus ⇒ aucun colis e-mail', `vinted=${r5 && r5.vinted}`);
  });

  // ══ §3 LES RAPPELS (matin/soir) ET LE BILAN ═════════════════════════════════
  let enRappel = null, enBilan = null;
  await essaie('§3 rappels et bilan', async () => {
    dit(SR && SR._banc && typeof SR._banc.lireDonneesColis === 'function', 'api/ship-reminders.js expose sa composition au banc');
    poser({ resume: true });
    enRappel = await rappels('lireDonneesColis');
    dit(JSON.stringify(enRappel) === JSON.stringify(ATTENDU), `rappels du matin et du soir : ${ATTENDU.join(', ')}`, JSON.stringify(enRappel));
    enBilan = await rappels('lireDonneesBilan');
    dit(JSON.stringify(enBilan) === JSON.stringify(ATTENDU), `bilan de la semaine : ${ATTENDU.join(', ')}`, JSON.stringify(enBilan));
    pannes.add('meta->>type=eq.vente');
    const sans = await rappels('lireDonneesColis');
    dit(JSON.stringify(sans) === JSON.stringify(['627001']), 'rappels : e-mails de vente illisibles ⇒ la liste seule (pas su ≠ colis)', JSON.stringify(sans));
  });

  // ══ §4 L'APP (Ma journée) = WIDGET = RAPPELS ═══════════════════════════════
  await essaie('§4 app = widget = rappels', async () => {
    poser({ resume: true });
    const VEF = await importer('src/venteEmailFraiche.js'), BVE = await importer('src/bordereauVenteEmail.js');
    const DV = await importer('api/_lib/depart-vente.js'), LE = await importer('api/_lib/limite-envoi.js'), VR = await importer('api/_lib/ventes-regle.js');
    // Ce que l'app lit : la requête projetée (servie par la fausse base), la liste ENTIÈRE, `capturedAt`.
    const u = new URL('https://x.supabase.co/rest/v1/app_data?' + VEF.requeteVentesEmail(NOW));
    const mails = filtrer(u).map((l) => projeter(l, u.searchParams.get('select')));
    const lignes = [...base.entries()].map(([k, d]) => ({ id: k.split('|')[1], data: d }));
    const ventes = lignes.filter((l) => /^harvest_.+_orders_sold$/.test(l.id)).flatMap((l) => l.data.payload.my_orders);
    const mainD = base.get(`${A}|main`);
    const fr = VEF.ventesEmailFraiches({ mails, comptes: comptesBanc, ecarte: (x) => VR.compteEcarte(x, new Set(mainD.vinted_accounts_hidden), {}), ventes, ko: [], lectures: { 111: LU, 222: LU } });
    const bords = lignes.filter((l) => /^email_bord_/.test(l.id)).map((l) => l.data);
    const bp = LE.bordsParTransaction(bords, () => false);
    const pistes = lignes.filter((l) => /^email_track_/.test(l.id)).map((l) => l.data);
    const partis = DV.ventesPartiesParPreuve({ bordsParTx: bp, shipDone: mainD.vinted_ship_done, bordsShipped: {}, panelBordsDone: {}, lignesEmail: pistes, departs: null, entrants: null });
    const soldByTxn = Object.fromEntries(ventes.map((o) => [String(o.transaction_id), o]));
    const app = BVE.colisVentesEmail({ ventesEmail: fr, bordsParTx: bp, connues: (tx) => !!soldByTxn[tx], cachee: () => false, partie: (o) => partis.has(String(o.transaction_id)) })
      .filter((x) => !mainD.vinted_ship_done[x.txn]).map((x) => x.txn);
    const appTout = ['627001', ...app].sort();
    dit(JSON.stringify(appTout) === JSON.stringify(ATTENDU), `app (Ma journée, \`toShip\`) : ${appTout.join(', ')}`, JSON.stringify(appTout));
    const w = lireW(await widget());
    dit(w && w.vinted === appTout.length && JSON.stringify(enRappel) === JSON.stringify(appTout) && JSON.stringify(enBilan) === JSON.stringify(appTout), `app = widget = rappels = bilan (${appTout.length})`, JSON.stringify({ app: appTout, widget: w && w.vinted, rappels: enRappel, bilan: enBilan }));
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s).` : '\n✅ Widget, rappels et bilan comptent les ventes vues par e-mail dont le bordereau est là — le nombre de Ma journée.');
  process.exit(ko ? 1 : 0);
})();
