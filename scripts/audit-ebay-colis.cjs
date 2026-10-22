// ═══════════════════════════════════════════════════════════════════════════
// AUDIT : LES VENTES eBAY À POSTER — UNE RÈGLE, LES ROUTES QUI LA LISENT
//         (node scripts/audit-ebay-colis.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// 19 octobre — « rien ne se passe après une vente eBay » (etat.md) : une
// commande eBay payée n'apparaissait ni dans le widget, ni dans le rappel du
// matin, ni dans le bilan de la semaine. La règle `colisEbay`
// (api/_lib/ebay-a-expedier.js) est EXÉCUTÉE ici, puis les VRAIES routes
// `api/widget.js` et `api/ship-reminders.js` (§4.10), sur une fausse base
// (données INVENTÉES), avec un faux Web Push.
// Il exige :
//   1. la règle : à poster = payée, pas expédiée, pas d'annulation demandée,
//      un envoi (SHIP_TO ou type inconnu) ; « ne poste pas » = annulation
//      demandée ; retrait en magasin écarté ; `null` (pas su) reste `null` ;
//      la date limite d'eBay (shipByDate) donne les jours ;
//   2. le widget compte les ventes eBay dans `ship` (même total), et dit
//      « au moins » (ebay: null) quand eBay est illisible — jamais un 0 eBay
//      inventé ;
//   3. le rappel du matin part pour un vendeur qui n'a QUE des ventes eBay, le
//      dit (« colis eBay »), et dit « ne poste pas » ;
//   4. l'autre sens : sans vente eBay, le rappel et le widget sont ceux d'avant.
// Mutations éprouvées le 19 octobre (copie mutée, audit lancé depuis elle) :
// la règle qui compte une annulation demandée (7 rouges) ; le widget qui
// ignore eBay (1) ; eBay illisible lu « 0 » (1). Sur 65eec06 : 9 rouges.
const path = require('path'), fs = require('fs'), os = require('os');
const RACINE = process.env.RACINE || path.join(__dirname, '..');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — exécuté', String(e && e.message).split('\n')[0].slice(0, 160)); } };

const J = 86400000;
const iso = (dj) => new Date(Date.now() + dj * J).toISOString();
const cmd = (id, o = {}) => ({
  orderId: id, creationDate: iso(-2), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' },
  fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }],
  lineItems: [{ lineItemId: '1', title: 'Paire ' + id, sku: 'VRM-1' + id.slice(-1), legacyItemId: '11' + id.slice(-1), quantity: 1,
    lineItemFulfillmentInstructions: { shipByDate: iso(o.dj == null ? 3 : o.dj) } }],
  ...o.x,
});
const COMMANDES = [
  cmd('E-1', { dj: -1 }),                                                                              // à poster, en retard
  cmd('E-2', { dj: 0, x: { lineItems: [{ lineItemId: '2', title: 'Paire E-2', sku: 'VRM-12', legacyItemId: '112', quantity: 1, lineItemFulfillmentInstructions: { shipByDate: iso(0) }, program: { authenticityVerification: { status: 'PENDING' } } }] } }), // aujourd'hui, authentification
  cmd('E-3', { x: { orderFulfillmentStatus: 'FULFILLED' } }),                                          // expédiée
  cmd('E-4', { x: { cancelStatus: { cancelState: 'CANCEL_REQUESTED' } } }),                           // ne poste pas
  cmd('E-5', { x: { fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'PREPARE_FOR_PICKUP' }] } }), // retrait
  cmd('E-6', { x: { cancelStatus: { cancelState: 'CANCELED' } } }),                                   // annulée
  cmd('E-7', { x: { orderPaymentStatus: 'PENDING' } }),                                                // pas payée
  cmd('E-8', { dj: 1, x: { fulfillmentStartInstructions: [] } }),                                     // type inconnu ⇒ gardée, demain
];

async function regle() {
  const m = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay-a-expedier.js') + '?t=' + Math.random());
  const c = m.colisEbay(COMMANDES);
  const ids = (l) => (l || []).map((x) => x.orderId).sort().join(',');
  dit(!!c && ids(c.aPoster) === 'E-1,E-2,E-8', 'à poster : payée, pas expédiée, pas d\'annulation, un envoi (type inconnu gardé)', c && ids(c.aPoster));
  dit(!!c && ids(c.nePasPoster) === 'E-4', '« ne poste pas » : l\'annulation demandée, jamais comptée à poster', c && ids(c.nePasPoster));
  dit(!!c && ids(c.horsEnvoi) === 'E-5', 'retrait en magasin écarté des colis à poster', c && ids(c.horsEnvoi));
  const e1 = c && c.aPoster.find((x) => x.orderId === 'E-1'), e2 = c && c.aPoster.find((x) => x.orderId === 'E-2');
  dit(e1 && e1.jours === -1 && e2 && e2.jours === 0, 'la date limite d\'eBay donne les jours (en retard · aujourd\'hui)', JSON.stringify([e1 && e1.jours, e2 && e2.jours]));
  dit(e2 && e2.authentification === true && e1 && e1.authentification === false, 'l\'authentificateur d\'eBay est signalé, et seulement là', JSON.stringify([e1 && e1.authentification, e2 && e2.authentification]));
  dit(m.colisEbay(null) === null && m.colisEbay(undefined) === null, '« pas su » reste « pas su » (jamais une liste vide)');
  const r = m.resumeColisEbay(c);
  dit(r && r.total === 3 && r.overdue === 1 && r.today === 1 && r.tomorrow === 1 && r.nePasPoster === 1, 'résumé : 3 · 1 en retard · 1 aujourd\'hui · 1 demain · 1 ne pas poster', JSON.stringify(r));
  dit(m.resumeColisEbay(null) === null, 'résumé de « pas su » : null');
  const vieux = m.limiteEnvoiEbay({ lineItems: [{ fulfillmentInstructions: { shipByDate: '2026-10-14T14:00:00Z' } }] });
  dit(vieux === Date.parse('2026-10-14T14:00:00Z'), 'l\'ancien nom du champ (lu par ebay-agent) reste lu en repli');
  dit(/^https:\/\/www\.ebay\.fr\//.test(m.lienCommandeEbay('E-1')) && /E-1/.test(m.lienCommandeEbay('E-1')), 'le lien mène à la commande sur ebay.fr');
}

// ── La fausse base des routes ────────────────────────────────────────────────
const pushes = [];
let ecritDedup = null;
function poserFetch({ ebay = 'ok', vinted = true }) {
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    const R = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
    if ((opts.method || 'GET') !== 'GET') {
      try { for (const r of JSON.parse(opts.body || '[]')) if (r && r.id === 'ship_reminder_dedup') ecritDedup = r.data; } catch (_) {}
      return new Response('', { status: 201 });
    }
    if (/select=owner&limit=1/.test(u)) return R([]);
    if (/id=eq\.main&select=owner/.test(u)) return R((opts.headers?.Range&&!/^0-/.test(opts.headers.Range))?[]:[{owner:'vendeur_banc'}]);
    if (/vinted_accounts/.test(u)) return R([{ vinted_user_id: '111', login: 'compte_a' }]);
    if (/id=eq\.main/.test(u) && /select=data/.test(u)) return R([{ data: { vinted_ship_done: {} } }]);
    if (/id=eq\.main/.test(u)) return R([{ vrm_widget_token: '', vinted_pickup_done: {}, vinted_ship_done: {}, vinted_bords_shipped: {}, vinted_sales_hidden: [], vinted_bords_printed: {} }]);
    if (/id=eq\.push_subs/.test(u)) return R([{ data: { subs: [{ endpoint: 'https://fcm.googleapis.com/A', keys: { p256dh: 'x', auth: 'y' } }] } }]);
    if (/id=eq\.push_prefs/.test(u)) return R([{ data: {} }]);
    if (/id=eq\.ebay_comptes/.test(u)) return ebay === 'panne' ? new Response('<html>522</html>', { status: 522 }) : R([]);
    if (/id=like\.ebay_orders/.test(u)) {
      if (ebay === 'panne') return new Response('<html>522</html>', { status: 522 });
      if (ebay === 'aucune') return R([]);
      return R([{ id: 'ebay_orders', orders: COMMANDES }]);
    }
    if (/id=eq\.(ship_reminder_dedup|panel_bords_done|urssaf_reminder_dedup|bilan_semaine_dedup|widget_stats)/.test(u)) return R([]);
    if (/id=like\.email_bord_/.test(u)) return R([]);
    if (/orders_sold/.test(u) && /resume/.test(u)) return R(vinted ? [{ id: 'harvest_111_orders_sold', txns: [] }] : []);
    if (/orders_purchased/.test(u) && /resume/.test(u)) return R([{ id: 'harvest_111_orders_purchased', txns: [] }]);
    return R([]);
  };
}
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });
async function widget(opts) {
  poserFetch(opts);
  const mod = await import('file://' + path.join(RACINE, 'api', 'widget.js') + '?t=' + Math.random());
  const r = res(); await mod.default({ method: 'GET', headers: {}, query: {} }, r); return r;
}
async function rappel(opts) {
  process.env.CRON_SECRET='cle-banc-ebay';
  poserFetch(opts); pushes.length = 0; ecritDedup = null;
  const wp = require(path.join(RACINE, 'node_modules', 'web-push'));
  wp.setVapidDetails = () => {};
  wp.sendNotification = async (sub, body) => { const b = JSON.parse(body); if (b.tag === 'ship-reminder') pushes.push(b); return { statusCode: 201 }; };   // le bilan du lundi a son propre banc
  process.env.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'x';
  const mod = await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js') + '?t=' + Math.random());
  const r = res(); await mod.default({ method: 'GET', headers: {authorization:'Bearer cle-banc-ebay'}, query: {} }, r); return r;
}

(async () => {
  await essaie('la règle', regle);
  await essaie('widget, eBay lu', async () => {
    const r = await widget({ ebay: 'ok' });
    const s = (r.corps && r.corps.ship) || {};
    dit(r.code === 200 && s.total === 3, 'widget : les 3 ventes eBay à poster comptent dans `ship.total`', `HTTP ${r.code} · total=${s.total}`);
    dit(s.overdue === 1 && s.today === 1 && s.tomorrow === 1, 'widget : en retard · aujourd\'hui · demain, sur la date limite d\'eBay', JSON.stringify(s));
    dit(s.ebay && s.ebay.total === 3 && s.auMoins === false && s.vinted === 0, 'widget : le détail eBay est rendu, total complet', JSON.stringify({ ebay: s.ebay, auMoins: s.auMoins }));
  });
  await essaie('widget, eBay illisible', async () => {
    const r = await widget({ ebay: 'panne' });
    const s = (r.corps && r.corps.ship) || {};
    dit(r.code === 200 && s.ebay === null && s.auMoins === true && (s.manque || []).includes('eBay'), 'widget : eBay illisible ⇒ `ebay: null`, « au moins » — jamais un 0 eBay inventé', JSON.stringify(s));
  });
  await essaie('widget, aucune vente eBay', async () => {
    const r = await widget({ ebay: 'aucune' });
    const s = (r.corps && r.corps.ship) || {};
    dit(r.code === 200 && s.total === 0 && s.ebay && s.ebay.total === 0 && s.auMoins === false, 'widget : aucune vente eBay ⇒ 0 sûr (l\'autre sens)', JSON.stringify(s));
  });
  await essaie('rappel du matin, eBay seul', async () => {
    const r = await rappel({ ebay: 'ok', vinted: false });
    const p = pushes[0] || {};
    dit(r.code === 200 && pushes.length === 1, 'rappel : il part même sans résumé Vinted (vendeur eBay)', `HTTP ${r.code} · ${pushes.length} envoi(s) · ${JSON.stringify(r.corps).slice(0, 200)}`);
    dit(/3 colis eBay/.test(p.body || '') && /ne poste pas/.test(p.body || ''), 'rappel : « 3 colis eBay » et « ne poste pas » (annulation demandée)', p.body);
    dit(ecritDedup && ecritDedup.total === 3 && ecritDedup.nePasPoster === 1, 'rappel : le mémo du jour porte le total et l\'annulation', JSON.stringify(ecritDedup));
  });
  await essaie('rappel du matin, eBay illisible et pas de résumé', async () => {
    const r = await rappel({ ebay: 'panne', vinted: false });
    // (22 oct.) Le rappel lit maintenant la liste du soir (`txsAExpedier`) :
    // « aucune vente Vinted captée » remplace « resume absent ». La règle jugée
    // reste la même : rien de lisible ⇒ aucun envoi, et le silence est motivé.
    dit(pushes.length === 0 && /resume absent|aucune vente Vinted captée/.test(JSON.stringify(r.corps)), 'rappel : rien de lisible ⇒ aucun envoi (rien inventé)', JSON.stringify(r.corps).slice(0, 200));
  });
  await essaie('rappel du matin, aucune vente eBay', async () => {
    const r = await rappel({ ebay: 'aucune', vinted: true });
    dit(pushes.length === 0, 'rappel : ni vente eBay ni colis Vinted dû ⇒ aucun envoi (l\'autre sens)', `${pushes.length} envoi(s)`);
  });
  console.log(ko ? `\n❌ ventes eBay à poster : ${ko} rouge(s)` : '\n✅ ventes eBay à poster : tout est vert');
  process.exit(ko ? 1 : 0);
})();
