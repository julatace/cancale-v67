#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// AUDIT (8 nov.) — « CETTE VENTE ATTEND-ELLE ENCORE MON ENVOI ? », UNE RÈGLE
// (api/_lib/depart-vente.js), PARTOUT.
//
// Julien (8 nov.) : « J'ai expédié des colis, c'est encore marqué qu'il faut que
// je les expédie. C'est inadmissible. » Ses listes Vinted étaient figées
// (« Bordereau envoyé au vendeur ») ; l'e-mail de dépôt du n° de son bordereau,
// le panneau de l'extension… existaient, mais le widget et les rappels ne les
// lisaient pas.
//
// Ce qui est EXÉCUTÉ (jamais lu comme du texte) :
//  §1 la règle pure : chaque preuve, chaque refus (n° partagé, achat, entrant,
//     étiquette seule, e-mail plus vieux que la vente, « info », lecture ratée),
//     50 ventes au même titre ⇒ seule celle du n° sort, la phrase de la raison ;
//  §2 la route api/widget sur une fausse base à la forme de PostgREST ;
//  §3 la composition « à expédier » du cron (matin/soir : `lireDonneesColis`, et
//     bilan : `lireDonneesBilan`) + `txsAExpedier`, sur la même base ;
//  §4 l'app : `bordShipped`, `toShip`, `estParti`, `etapeVente` lisent la règle.
//
// Preuve (§6) : `node scripts/audit-a-envoyer-preuves.cjs --prouve` rejoue
// l'audit sur des copies mutées (chaque refus réaffaibli ⇒ rouge). Sur
// origin/main : `git archive origin/main | tar -x -C <d>`, copier ce fichier
// dans <d>/scripts et le lancer DEPUIS <d> (la règle n'existe pas ⇒ rouge).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));   // heures calmes : midi (Paris) pour ce banc
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'n-partage-accepte': ['api/_lib/depart-vente.js', "  if (amb && (amb instanceof Set ? amb.has(k) : Array.isArray(amb) && amb.includes(k))) return null;\n", ''],
  'entrant-accepte': ['api/_lib/depart-vente.js', "  if (sens === 'entrant') return null;\n", ''],
  'etiquette-acceptee': ['api/_lib/depart-vente.js', "  if (SUJET_ETIQUETTE.test(sujet) && !SUJET_DEPOT.test(sujet) && status === 'transit') return null;\n", ''],
  'info-acceptee': ['api/_lib/depart-vente.js', "const ETATS_PARTI = new Set(['transit', 'available', 'delivered', 'retour']);", "const ETATS_PARTI = new Set(['transit', 'available', 'delivered', 'retour', 'info']);"],
  'avant-vente-accepte': ['api/_lib/depart-vente.js', "  if (pe && !(v != null && pe.at != null && pe.at < v - TOLERANCE_AVANT_VENTE_MS)) {", '  if (pe) {'],
  // (11 nov.) Ancres rendues uniques (deux appels de la règle par fichier : elles ne s'appliquaient plus).
  'widget-sans-email': ['api/widget.js', 'bordsParTx: bordsTx0, shipDone, bordsShipped, panelBordsDone: preuves.panelBordsDone || {}, lignesEmail: preuves.lignesEmail,', 'bordsParTx: bordsTx0, shipDone, bordsShipped, panelBordsDone: preuves.panelBordsDone || {}, lignesEmail: null,'],
  'widget-sans-panneau': ['api/widget.js', 'bordsParTx: bordsTx0, shipDone, bordsShipped, panelBordsDone: preuves.panelBordsDone || {},', 'bordsParTx: bordsTx0, shipDone, bordsShipped, panelBordsDone: {},'],
  'cron-sans-email': ['api/ship-reminders.js', "bordsDuVendeur(d) : {}, shipDone, bordsShipped,\n    panelBordsDone: pr.panelBordsDone || {}, lignesEmail: pr.lignesEmail || null,", "bordsDuVendeur(d) : {}, shipDone, bordsShipped,\n    panelBordsDone: pr.panelBordsDone || {}, lignesEmail: null,"],
  'widget-sans-etiquettes': ['api/widget.js', 'departs, entrants: preuves.entrants, etiquettes: preuves.etiquettes || null });', 'departs, entrants: preuves.entrants });'],
  'bilan-sans-bordereaux': ['api/ship-reminders.js', '    departs, bords: bordsB, preuves,', '    departs, preuves,'],
  'etiquette-ignoree': ['api/_lib/depart-vente.js', "  const bp = bordsAvecEtiquettes(bordsParTx, etiquettes);", '  const bp = objet(bordsParTx);'],
  'suivi-pdf-ignore': ['api/_lib/depart-vente.js', "export const suiviDuBord = (b) => (b ? (String(b.suivi || '').trim() || String(b.suiviPdf || '').trim()) : '');", "export const suiviDuBord = (b) => (b ? String(b.suivi || '').trim() : '');"],
  'app-sans-etiquettes': ['src/App.jsx', 'etiquettes: pdfEtiquettesParTx(), shipDone,', 'shipDone,'],
  'app-email-dabord': ['src/App.jsx', "      .filter(e => !partiParPreuve(partisVinted.get(e.txn)));", '      ;'],
  'app-sans-email': ['src/App.jsx', "lignesEmail: Array.isArray(tracking) ? tracking : null, departs: vcLoc0.departs,", 'lignesEmail: null, departs: vcLoc0.departs,'],
};
const ARG_PROUVE = process.argv.find((x) => x.startsWith('--prouve'));
if (ARG_PROUVE) {
  let ok = 0;
  const seules = ARG_PROUVE.includes('=') ? ARG_PROUVE.split('=')[1].split(',') : null;
  const choisies = Object.entries(MUTATIONS).filter(([nom]) => !seules || seules.includes(nom));
  for (const [nom, [f, de, vers]] of choisies) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-aenv-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre ${src.includes(de) ? 'pas unique' : 'introuvable'} dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
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
  if (u.pathname === '/rest/v1/vinted_accounts') return rep([]);
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

// ── Les ventes du banc (INVENTÉES, à la forme mesurée — jamais en production) ──
const H = 3600000, NOW = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const FIGE = 'Bordereau envoyé au vendeur';
// Les n° à la forme Chronopost stricte (`XW…TS`), comme les bordereaux Vinted mesurés.
const n = (i) => `XW${String(500000000 + i).padStart(9, '0')}TS`;
const T = {
  depot: '9001', partage1: '9002', partage2: '9003', achat: '9004', entrant: '9005', fait: '9006', panneau: '9007',
  etiquette: '9008', ancien: '9009', expedie: '9010', info: '9011', annulee: '9012',
  pdf: '9013',   // (11 nov., lot DJ3) étiquette captée SANS e-mail de bordereau ; son n° est lu sur l'étiquette (PDF)
};
const S = { pdf: n(13), depot: n(1), partage: n(2), achat: n(4), entrant: n(5), etiquette: n(8), ancien: n(9), info: n(11), annulee: n(12), fait: n(6), panneau: n(7), expedie: n(10) };
const JUMELLES = Array.from({ length: 50 }, (_, i) => String(9100 + i));   // 50 ventes au MÊME titre
const SEULE = '9123';
const vente = (tx, o = {}) => ({ transaction_id: Number(tx), title: 'Nike Dunk Low Panda 42', status: FIGE, transaction_user_status: 'needs_action', date: iso(NOW - 50 * H), price: { amount: '60.0', currency_code: 'EUR' }, ...o });
const bord = (tx, suivi) => ({ type: 'bordereau', transaction: tx, suivi, numero: '', modele: 'Nike Dunk Low Panda 42', receivedAt: iso(NOW - 48 * H), filename: `b-${tx}.pdf`, dateLimite: '' });
const email = (suivi, o = {}) => ({ type: 'suivi', carrier: 'mondialrelay', suivi, status: 'transit', statusLabel: 'En transit', subject: 'Votre colis est entre de bonnes mains', receivedAt: iso(NOW - 20 * H), emailAt: iso(NOW - 20 * H), sens: 'sortant', ...o });
const AEXP = [T.pdf, T.depot, T.partage1, T.partage2, T.achat, T.entrant, T.fait, T.panneau, T.etiquette, T.ancien, T.expedie, T.info, ...JUMELLES];
const RESTENT = [T.partage1, T.partage2, T.achat, T.entrant, T.etiquette, T.ancien, T.info, ...JUMELLES.filter((t) => t !== SEULE)];
function poser({ sansEmails = false } = {}) {
  base.clear(); pannes = new Set();
  base.set(`${A}|main`, { vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: { [T.fait]: NOW - 5 * H }, vinted_bords_shipped: { [T.expedie]: 1 }, vinted_bords_hidden: {}, vrm_colis_collected: [], vinted_accounts_hidden: [], vrm_lbc_colis_done: {}, vrm_vc_colis_done: {}, vrm_vc_numeros: {}, vrm_vc_liens: {} });
  const ventes = [...AEXP.map((t) => vente(t)), vente(T.annulee, { status: 'Commande annulée', transaction_user_status: 'failed' })];
  base.set(`${A}|harvest_U1_orders_sold`, { capturedAt: iso(NOW - 40 * H), resume: { at: iso(NOW - 40 * H), txns: AEXP.map(Number) }, payload: { my_orders: ventes } });
  base.set(`${A}|harvest_U1_orders_purchased`, { capturedAt: iso(NOW - 40 * H), resume: { at: iso(NOW - 40 * H), txns: [] }, payload: { my_orders: [] } });
  for (const [tx, s] of [[T.depot, S.depot], [T.partage1, S.partage], [T.partage2, S.partage], [T.achat, S.achat], [T.entrant, S.entrant], [T.fait, S.fait], [T.panneau, S.panneau], [T.etiquette, S.etiquette], [T.ancien, S.ancien], [T.expedie, S.expedie], [T.info, S.info], [T.annulee, S.annulee]]) base.set(`${A}|email_bord_${tx}`, bord(tx, s));
  JUMELLES.forEach((t, i) => base.set(`${A}|email_bord_${t}`, bord(t, n(100 + i))));
  // (11 nov.) T.pdf : étiquette captée par l'extension, AUCUN e-mail de bordereau (mesuré : 24057428717) — son n° n'existe que là.
  base.set(`${A}|vrm_bord_transporteurs`, { v: 1, pdf: { [T.pdf]: { t: 'chronopost', s: S.pdf } } });
  base.set(`${A}|panel_bords_done`, { [T.panneau]: NOW - 3 * H });
  // Le n° d'un ACHAT (ligne `transp_`, lue chez le transporteur pour un achat) : le même n° qu'une vente ⇒ ambigu.
  base.set(`${A}|transp_chronopost_${S.achat}`, { suivi: S.achat, carrier: 'chronopost', etat: 'en_route' });
  if (sansEmails) return;
  base.set(`${A}|email_track_mondialrelay_${S.depot}`, email(S.depot));
  base.set(`${A}|email_track_mondialrelay_${S.partage}`, email(S.partage));
  base.set(`${A}|email_track_chronopost_${S.achat}`, email(S.achat, { carrier: 'chronopost', sens: undefined, subject: 'Votre colis est en route' }));
  base.set(`${A}|email_track_mondialrelay_${S.entrant}`, email(S.entrant, { status: 'available', subject: 'Votre colis est disponible', sens: 'entrant' }));
  base.set(`${A}|email_track_vinted_${S.etiquette}`, email(S.etiquette, { carrier: 'vinted', subject: 'Ton bordereau d’envoi', sens: undefined }));
  base.set(`${A}|email_track_mondialrelay_${S.ancien}`, email(S.ancien, { receivedAt: iso(NOW - 20 * 24 * H), emailAt: iso(NOW - 20 * 24 * H) }));
  base.set(`${A}|email_track_mondialrelay_${S.info}`, email(S.info, { status: 'info', subject: 'Ton compte évolue', sens: undefined }));
  base.set(`${A}|email_track_mondialrelay_${S.annulee}`, email(S.annulee));
  // (11 nov., lot DJ3) Le n° lu sur l'étiquette de T.pdf (ligne légère du cron) et l'e-mail de dépôt de CE n°.
  base.set(`${A}|email_track_chronopost_${S.pdf}`, email(S.pdf, { carrier: 'chronopost', subject: 'Preuve de dépôt de votre colis', sens: 'sortant' }));
  base.set(`${A}|email_track_mondialrelay_${n(123)}`, email(n(123), { subject: 'Confirmation du dépôt de votre colis' }));
}

(async () => {
  // ══ §1 LA RÈGLE PURE ═══════════════════════════════════════════════════════
  let D = null;
  await essaie('§1 la règle', async () => {
    D = await importer('api/_lib/depart-vente.js');
    dit(typeof D.ventesPartiesParPreuve === 'function' && typeof D.raisonDepartVente === 'function', 'api/_lib/depart-vente.js existe (la règle unique)');
    const bp = {}, lignes = [];
    for (const [tx, s] of [['1', 'XW500000001TS'], ['2', 'XW500000002TS'], ['3', 'XW500000002TS'], ['4', 'XW500000004TS'], ['5', 'XW500000005TS']]) bp[tx] = { transaction: tx, suivi: s, receivedAt: iso(NOW - 48 * H) };
    // (11 nov.) Le bordereau du dépôt « du 7 nov. » est reçu AVANT cet e-mail (date fixe : la règle « e-mail plus
    // vieux que la vente ⇒ rien » jugeait l'horloge du jour, le contrôle rougissait seul après le 9 nov.).
    bp['1'].receivedAt = iso(Date.UTC(2026, 10, 6, 9));
    // Forme de l'APP (les lignes `tracking` relues) : status, suivi, subject, sens, emailAt.
    lignes.push({ suivi: 'XW500000001TS', status: 'transit', subject: 'Votre colis est entre de bonnes mains', carrier: 'mondialrelay', emailAt: Date.UTC(2026, 10, 7, 9) });
    lignes.push({ suivi: 'XW500000002TS', status: 'transit', subject: 'Votre colis est entre de bonnes mains', carrier: 'mondialrelay', emailAt: iso(NOW - 10 * H) });
    lignes.push({ suivi: 'XW500000004TS', status: 'transit', subject: 'Votre colis est en route', carrier: 'chronopost', emailAt: iso(NOW - 10 * H) });
    lignes.push({ suivi: 'XW500000005TS', status: 'available', subject: 'Votre colis est disponible', sens: 'entrant', emailAt: iso(NOW - 10 * H) });
    const m = D.ventesPartiesParPreuve({ txs: ['1', '2', '3', '4', '5'], bordsParTx: bp, lignesEmail: lignes, entrants: new Set(['XW500000004TS']) });
    dit(m.has('1') && m.get('1').type === 'email', 'statut Vinted figé + e-mail de dépôt du n° de SON bordereau ⇒ parti', JSON.stringify(m.get('1')));
    dit(m.get('1') && m.get('1').phrase === 'E-mail de dépôt Mondial Relay du 7 nov.', 'la raison est dite : « E-mail de dépôt Mondial Relay du 7 nov. »', m.get('1') && m.get('1').phrase);
    dit(!m.has('2') && !m.has('3'), 'même n° sur deux ventes ⇒ rien déduit, les deux restent', [...m.keys()].join(','));
    dit(!m.has('4'), 'n° aussi porté par un ACHAT ⇒ ambigu, reste');
    dit(!m.has('5'), 'un e-mail ENTRANT (« disponible », sens entrant) ne fait jamais partir une vente');
    dit(D.ventesPartiesParPreuve({ txs: ['1'], bordsParTx: bp, lignesEmail: null }).size === 0, 'e-mails illisibles (null) ⇒ rien de prouvé (pas su ≠ parti)');
    // (11 nov., lot DJ3 — Julien : « Tout imprimer » proposait une paire DÉJÀ DÉPOSÉE) L'e-mail du bordereau ne porte
    // aucun n° (134 sur 237, mesuré) ; le n° est sur SON étiquette (même transaction) : l'e-mail de dépôt de ce n° prouve.
    {
      const bpE = { 61: { transaction: '61', receivedAt: iso(NOW - 48 * H) }, 62: { transaction: '62', receivedAt: iso(NOW - 48 * H) } };
      const lE = [{ suivi: '87696698', status: 'transit', subject: 'Votre colis est entre de bonnes mains', carrier: 'mondialrelay', sens: 'sortant', emailAt: iso(NOW - 10 * H) },
        { suivi: 'XW652257595TS', status: 'transit', subject: 'Preuve de dépôt de votre colis', carrier: 'chronopost', sens: 'sortant', emailAt: iso(NOW - 10 * H) }];
      const etiq = { 61: { t: 'mondialrelay', s: '87696698' }, 63: { t: 'chronopost', s: 'XW652257595TS' }, 64: { t: 'chronopost' } };
      const mE = D.ventesPartiesParPreuve({ txs: ['61', '62', '63', '64'], bordsParTx: bpE, lignesEmail: lE, etiquettes: etiq });
      dit(mE.has('61') && mE.get('61').type === 'email' && mE.get('61').depot, 'bordereau sans n° dans l’e-mail + n° lu sur SON étiquette + e-mail de dépôt de ce n° ⇒ parti', JSON.stringify(mE.get('61')));
      dit(mE.has('63') && mE.get('63').type === 'email', 'étiquette captée sans e-mail de bordereau + e-mail de dépôt de son n° ⇒ parti', JSON.stringify(mE.get('63')));
      dit(!mE.has('62') && !mE.has('64'), 'aucun n° connu (ni e-mail, ni étiquette) ⇒ rien déduit, reste à envoyer', [...mE.keys()].join(','));
      const etiqPart = { 61: { t: 'mondialrelay', s: '87696698' }, 62: { t: 'mondialrelay', s: '87696698' } };
      const mP = D.ventesPartiesParPreuve({ txs: ['61', '62'], bordsParTx: bpE, lignesEmail: lE, etiquettes: etiqPart });
      dit(mP.size === 0, 'le même n° d’étiquette sur deux ventes ⇒ ambigu, rien déduit', [...mP.keys()].join(','));
      const mS = D.ventesPartiesParPreuve({ txs: ['61'], bordsParTx: { 61: { transaction: '61', suivi: 'XW500000009TS', receivedAt: iso(NOW - 48 * H) } }, lignesEmail: lE, etiquettes: etiq });
      dit(!mS.has('61'), 'l’e-mail porte SON n° : le n° de l’étiquette ne le remplace pas', [...mS.keys()].join(','));
    }
    const r6 = D.raisonDepartVente('6', null, { shipDone: { 6: Date.UTC(2026, 10, 7, 15) } });
    dit(r6 && r6.type === 'colis-fait' && r6.phrase === 'Colis fait le 7 nov.', '« Colis fait » ⇒ parti, « Colis fait le 7 nov. »', r6 && r6.phrase);
    dit(D.raisonDepartVente('7', { transaction: '7' }, { panelBordsDone: { 7: 1 } }).type === 'panneau', 'traité depuis le panneau de l’extension ⇒ parti');
    dit(D.raisonDepartVente('8', { transaction: '8' }, { bordsShipped: { 8: 1 } }).type === 'expedie-main', 'expédié à la main sur son bordereau ⇒ parti');
    dit(D.raisonDepartVente('9', { transaction: '9', suivi: 'XW500000009TS' }, { preuvesEmail: D.preuvesEmailParSuivi([{ suivi: 'XW500000009TS', status: 'transit', subject: 'Ton bordereau d’envoi', emailAt: iso(NOW) }]) }) === null, '« Ton bordereau d’envoi » seul (une étiquette) ne prouve aucun départ');
    dit(D.raisonDepartVente('10', { transaction: '10', suivi: 'XW500000010TS' }, { venteMs: NOW - 2 * 24 * H, preuvesEmail: D.preuvesEmailParSuivi([{ suivi: 'XW500000010TS', status: 'transit', subject: 'Votre colis est entre de bonnes mains', emailAt: iso(NOW - 20 * 24 * H) }]) }) === null, 'un e-mail daté avant la vente contredit l’identité ⇒ rien');
    dit(D.raisonDepartVente('11', { transaction: '11', suivi: 'XW500000011TS' }, { preuvesEmail: D.preuvesEmailParSuivi([{ suivi: 'XW500000011TS', status: 'info', subject: 'Ton compte évolue', emailAt: iso(NOW) }]) }) === null, 'un e-mail « info » ne prouve rien');
    // 50 ventes au même titre : seule celle du n° sort.
    const bp50 = {}; JUMELLES.forEach((t, i) => { bp50[t] = { transaction: t, suivi: n(100 + i), modele: 'Nike Dunk Low Panda 42' }; });
    const m50 = D.ventesPartiesParPreuve({ txs: JUMELLES, bordsParTx: bp50, lignesEmail: [{ suivi: n(123), status: 'transit', subject: 'Confirmation du dépôt de votre colis', emailAt: iso(NOW) }] });
    dit(m50.size === 1 && m50.has(SEULE), '50 ventes au même titre : seule celle du n° prouvé sort', [...m50.keys()].join(','));
  });

  // ══ §2 LA ROUTE api/widget ════════════════════════════════════════════════
  const { contexteVendeur } = await importer('api/_lib/owner.js').catch(() => ({}));
  const widget = async () => { const w = (await importer('api/widget.js')).default; const res = faireRes(); await w({ method: 'GET', headers: {}, query: {} }, res); return res; };
  await essaie('§2 widget', async () => {
    poser();
    const r = await widget();
    const v = r.corps && r.corps.ship ? r.corps.ship.vinted : null;
    dit(r.code == null || r.code === 200, 'le widget répond', `code=${r.code} ${JSON.stringify(r.corps).slice(0, 160)}`);
    dit(v === RESTENT.length, `widget : ${RESTENT.length} colis Vinted à envoyer — le déposé (e-mail), le « Colis fait », le panneau, l’expédié à la main et la jumelle prouvée sortent ; n° partagé, achat, entrant, étiquette, e-mail ancien, « info » restent`, `vinted=${v} (attendu ${RESTENT.length})`);
    poser({ sansEmails: true });
    const r2 = await widget();
    dit(r2.corps && r2.corps.ship && r2.corps.ship.vinted === RESTENT.length + 3, 'sans aucun e-mail : le déposé, celui de l’étiquette et la jumelle restent « à envoyer » (rien deviné)', `vinted=${r2.corps && r2.corps.ship && r2.corps.ship.vinted}`);
    poser(); pannes.add('id=like.email_track_*&meta->>status=in.(transit');
    const r3 = await widget();
    dit(r3.corps && r3.corps.ship && r3.corps.ship.vinted === RESTENT.length + 3, 'e-mails illisibles ⇒ les colis restent comptés (pas su ≠ parti), le widget répond quand même', `vinted=${r3.corps && r3.corps.ship && r3.corps.ship.vinted}`);
  });

  // ══ §3 LE CRON : MATIN, SOIR (`lireDonneesColis`) ET BILAN (`lireDonneesBilan`) ══
  await essaie('§3 rappels et bilan', async () => {
    const SR = await importer('api/ship-reminders.js');
    dit(SR._banc && typeof SR._banc.txsAExpedier === 'function', 'api/ship-reminders.js expose sa composition « à expédier » au banc');
    poser();
    const dc = await contexteVendeur.run({ owner: A }, () => SR._banc.lireDonneesColis());
    const tc = SR._banc.txsAExpedier(dc);
    const ens = tc ? [...tc.vinted].sort() : null;
    dit(ens && ens.length === RESTENT.length && RESTENT.every((t) => tc.vinted.has(t)), `rappels du matin et du soir : les ${RESTENT.length} mêmes colis que le widget`, `n=${ens && ens.length} ${ens && ens.slice(0, 12).join(',')}`);
    dit(tc && !tc.vinted.has(T.depot) && !tc.vinted.has(SEULE) && !tc.vinted.has(T.panneau), 'rappels : le colis déposé (e-mail), la jumelle prouvée et le panneau n’y sont plus');
    const db = await contexteVendeur.run({ owner: A }, () => SR._banc.lireDonneesBilan());
    const tb = SR._banc.txsAExpedier(db);
    dit(tb && tb.vinted.size === RESTENT.length && !tb.vinted.has(T.depot), `bilan de la semaine : les ${RESTENT.length} mêmes colis`, `n=${tb && tb.vinted.size}`);
    dit(tc && !tc.vinted.has(T.annulee) && tb && !tb.vinted.has(T.annulee), 'vente annulée (son n° a même un e-mail de dépôt) : jamais « à envoyer »');
  });

  // ══ §4 L'APP LIT LA MÊME RÈGLE (le banc `a-envoyer-preuves.cjs` le rend) ══
  await essaie('§4 app', async () => {
    const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    dit(/ventesPartiesParPreuve\(\{[\s\S]{0,300}shipDone, bordsShipped, panelBordsDone,[\s\S]{0,200}lignesEmail: Array\.isArray\(tracking\)/.test(app), 'app : `partisVinted` = la règle, avec Colis fait, expédié, panneau, e-mails et départs');
    dit(/const rv = partisVinted\.get\(String\(b\.transaction\)\); if \(rv && rv\.type !== 'colis-fait'\) return true;/.test(app), 'app : `bordShipped` (Colis, Ma journée, la cloche, `toShip`) sort la vente prouvée');
    dit(!/shippedSuivis\.has\(String\(b\.suivi\)\.toUpperCase\(\)\)\) return true; \/\/ colis déjà/.test(app), 'app : plus aucune sortie par le n° SANS la règle (n° partagé, achat) pour une vente reliée');
    dit(/ventesPartiesParPreuve\(\{[\s\S]{0,200}etiquettes: pdfEtiquettesParTx\(\)/.test(app), 'app : `partisVinted` lit aussi le n° de SON étiquette (bordereau sans n°)');
    dit(/\.filter\(e => !partiParPreuve\(partisVinted\.get\(e\.txn\)\)\)/.test(app) && /if \(partiParPreuve\(partisVinted\.get\(String\(o\.transaction_id\)\)\)\) continue;/.test(app), 'app : « Tout imprimer » et le compteur sortent la vente prouvée même sans bordereau e-mail');
    dit(/raisonDepartPubliee\(o\.transaction_id\)/.test(app) && /aPoster: \(o\) => aExpedier\(o\) && !shipDone\[String\(o\.transaction_id\)\] && !raisonDepartPubliee/.test(app), 'app : Ventes et la loupe disent « Envoyée » (registre publié par Colis)');
  });

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s).` : '\n✅ « À envoyer » : une règle de preuves, par identité, partout (app, widget, rappels, bilan).');
  process.exit(ko ? 1 : 0);
})();
