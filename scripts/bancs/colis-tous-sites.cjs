// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES COLIS LEBONCOIN ET VESTIAIRE À POSTER, CÔTÉ SERVEUR (1er novembre)
//        (node scripts/bancs/colis-tous-sites.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// L'audit des parcours du 1er novembre (A4) : une vente Leboncoin ou Vestiaire
// à poster n'était comptée que dans l'écran Colis. Le widget de l'iPhone et le
// rappel du soir (« Demain : N colis à poster ») ne la voyaient pas, et une
// date limite Vestiaire pouvait passer sans un mot. §4.10 : on EXÉCUTE les
// vraies routes (api/widget.js, api/ship-reminders.js?moment=soir) sur une
// fausse base cloisonnée (le harnais de `rappel-soir.cjs`), un faux Web Push.
// Le vendeur A : 1 colis Vinted, 1 Leboncoin à poster (+ un coché « Colis
// fait », un parti, un ACHAT), 1 Vestiaire à poster dont la limite tombe
// demain (+ une vente Vestiaire envoyée). On exige :
//   • widget : 3 colis (Vinted 1 · Leboncoin 1 · Vestiaire 1), demain compte
//     la vente Vestiaire ; ni l'achat, ni le coché « fait », ni le parti ;
//   • rappel du soir : « Demain : 3 colis à poster », la limite Vestiaire dite ;
//   • le soir et le widget disent le MÊME nombre (§11) ;
//   • Leboncoin illisible ⇒ « au moins », Leboncoin NOMMÉ (jamais un total
//     partiel présenté complet) ;
//   • toutes les lectures portent owner=eq.<vendeur>.
// Aucune fixture : tout est inventé ici.
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

process.env.VAPID_PRIVATE_KEY = 'YmFuYy1jbGUtcHJpdmVlLWZhY3RpY2UtMzItb2N0ZXQ';
delete process.env.SUPABASE_SERVICE_KEY;
process.env.CRON_SECRET = 'cle-banc-cron'; // obligatoire depuis dc4799f (la route refuse sans elle)
const webpush = require(path.join(RACINE, 'node_modules', 'web-push'));
const pushes = [];
webpush.setVapidDetails = () => {};
webpush.sendNotification = async (sub, body) => { pushes.push({ endpoint: sub.endpoint, ...JSON.parse(body) }); return { statusCode: 201 }; };

const SOIR = Date.parse('2026-10-21T18:05:00Z');      // mercredi, 20 h 05 à Paris
const vraiNow = Date.now;
const J = 86400000;
const iso = (t) => new Date(t).toISOString();
const ebayCmd = (id, shipBy) => ({
  orderId: id, creationDate: iso(SOIR - 2 * J), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }],
  lineItems: [{ lineItemId: '1', title: 'Paire ' + id, sku: 'VRM-7', legacyItemId: '117', quantity: 1, lineItemFulfillmentInstructions: { shipByDate: shipBy } }],
});

const vendeurs = () => ({
  A: {
    subs: [{ endpoint: 'https://fcm.googleapis.com/A1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '11', login: 'vendeuse_a' }],
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: { 102: true }, vinted_bords_shipped: {}, vrm_widget_token: 'tokA', vrm_lbc_colis_done: { L2: SOIR - 3600000 } },
    // Leboncoin : la FORME rangée par l'extension (`lbc_ventes.data.ventes`, clé = txId, prix en centimes).
    lbc: { L1: { txId: 'L1', itemId: '501', isSeller: true, title: 'Salomon XT-6', price: 9000, stepLabel: 'Paiement reçu' },
      L2: { txId: 'L2', itemId: '502', isSeller: true, title: 'Asics', price: 5000, stepLabel: 'Paiement reçu' },        // coché « Colis fait »
      L3: { txId: 'L3', itemId: '503', isSeller: true, title: 'Puma', price: 4000, parcelStatus: 'in_transit' },         // parti
      L4: { txId: 'L4', itemId: '504', isSeller: false, title: 'Un achat', price: 3000 } },                               // un ACHAT
    // Vestiaire : `vc_ventes.data.ventes` (background.js `rangerVcVentes`), la date limite écrite par Vestiaire.
    vc: { V1: { productId: 'P40', ref: '40', aExpedier: true, limite: '2026-10-22T21:59:00.000Z', date: iso(SOIR - 2 * J) },
      V2: { productId: 'P41', ref: '41', aExpedier: false, etat: 'shipped', date: iso(SOIR - 5 * J) } },
    ventes: { 11: { cap: iso(SOIR - 3600000), txns: ['102', '106'], orders: [
      { transaction_id: 102, status: 'Le paiement a été validé', date: iso(SOIR - J), price: { amount: '23.5' }, transaction_user_status: 'needs_action' },
      { transaction_id: 106, status: 'Le paiement a été validé', date: iso(SOIR - J), price: { amount: '30' }, transaction_user_status: 'needs_action' },
    ] } },
    // §6.3 (22 oct.) : la forme RÉELLE d'un bordereau email — `filename` et
    // `receivedAt` sont sur 204 lignes sur 204 ; la table « un bordereau par
    // vente » de l'app (et désormais des rappels) ne lit que celles-là.
    bords: [
      { id: 'email_bord_106', data: { transaction: '106', dateLimite: '22/10/2026 23:59', numero: '12', filename: 'Bordereau-Vinted-106.pdf', receivedAt: iso(SOIR - J) } },
      { id: 'email_bord_102', data: { transaction: '102', dateLimite: '20/10/2026 23:59', numero: '9', filename: 'Bordereau-Vinted-102.pdf', receivedAt: iso(SOIR - J) } },   // coché « posté » : jamais compté
    ],
    ebay: [],
  },
  B: {
    subs: [{ endpoint: 'https://fcm.googleapis.com/B1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '22', login: 'vendeur_b' }],
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: {}, vinted_bords_shipped: {}, vrm_widget_token: 'tokB' },
    ventes: { 22: { cap: iso(SOIR - 3600000), txns: [], orders: [{ transaction_id: 201, status: 'Commande finalisée', date: iso(SOIR - 9 * J), price: { amount: '40' } }] } },
    bords: [], ebay: [], lbc: null, vc: null,
  },
});

let V, memos, lus, ecrits, pannes;
const reset = () => { V = vendeurs(); memos = {}; lus = []; ecrits = []; pannes = new Set(); pushes.length = 0; };
const rep = (o, status = 200) => new Response(typeof o === 'string' ? o : JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
const chemin = (obj, p) => p.reduce((o, k) => (o == null ? undefined : o[k]), obj);
function projette(ligne, select) {
  if (!select || select === '*') return ligne;
  const out = {};
  for (const item of select.split(',')) {
    const [alias, expr] = item.includes(':') ? item.split(/:(.+)/) : [item, item];
    const morceaux = expr.split(/->>?/);
    const b = morceaux.shift();
    let v = b === 'meta' ? ligne.meta : b === 'data' ? ligne.data : ligne[b];
    if (morceaux.length) v = chemin(v, morceaux);
    if (/->>/.test(expr) && v != null) v = typeof v === 'object' ? JSON.stringify(v) : String(v);
    out[alias] = v === undefined ? null : v;
  }
  return out;
}
const lignesDe = (o) => {
  const v = V[o]; if (!v) return [];
  const L = [{ id: 'main', data: v.main }];
  for (const [uid, x] of Object.entries(v.ventes)) L.push({ id: `harvest_${uid}_orders_sold`, data: { capturedAt: x.cap, payload: { my_orders: x.orders }, resume: { txns: x.txns } } });
  for (const b of v.bords) L.push(b);
  L.push({ id: 'ebay_orders', data: { orders: v.ebay } });
  if (v.lbc) L.push({ id: 'lbc_ventes', data: { ventes: v.lbc } });
  if (v.vc) { L.push({ id: 'vc_ventes', data: { ventes: v.vc } }); L.push({ id: 'vc_listings', data: { liens: {} } }); }
  L.push({ id: 'push_subs', data: { subs: v.subs } });
  if (v.prefs) L.push({ id: 'push_prefs', data: v.prefs });
  for (const [id, data] of Object.entries(memos[o] || {})) L.push({ id, data });
  return L;
};
const filtreId = (id, q) => {
  const eq = /(?:^|&)id=eq\.([^&]+)/.exec(q), like = /(?:^|&)id=like\.([^&]+)/.exec(q);
  if (eq) return id === eq[1];
  if (like) { const re = new RegExp('^' + like[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '\u0000').replace(/_/g, '.').replace(/\u0000/g, '.*') + '$'); return re.test(id); }
  return true;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url)), m = opts.method || 'GET';
  if (!u.includes('/rest/v1/')) return rep({}, 404);
  const [table, q = ''] = u.split('/rest/v1/')[1].split('?');
  const own = (/(?:^|&)owner=eq\.([^&]+)/.exec(q) || [])[1] || null;
  if (m === 'POST' && table === 'app_data') {
    for (const l of JSON.parse(opts.body || '[]')) {
      ecrits.push({ id: l.id, owner: l.owner || null, data: l.data });
      if (pannes.has(`ecrire:${l.owner}:${l.id}`)) return rep('<html>522</html>', 522);
      (memos[l.owner] = memos[l.owner] || {})[l.id] = l.data;
    }
    return rep('', 201);
  }
  lus.push(u);
  const select = (/(?:^|&)select=([^&]+)/.exec(q) || [])[1] || '';
  if (table === 'app_data' && /select=owner&limit=1/.test(q)) return rep([{ owner: 'A' }]);
  if (table === 'app_data' && /id=eq\.main/.test(q) && !own) return rep(Object.keys(V).map((o) => projette({ owner: o, id: 'main', data: V[o].main }, select)));
  if (!own) return rep({ message: 'lecture sans vendeur' }, 400);
  for (const p of pannes) { const [o, motif] = p.split(':'); if (o === own && (table + '?' + q).includes(motif)) return rep('<html>522</html>', 522); }
  if (table === 'vinted_accounts') return rep((V[own] ? V[own].comptes : []).map((c) => projette(c, select)));
  if (table !== 'app_data') return rep([]);
  return rep(lignesDe(own).filter((l) => filtreId(l.id, q)).map((l) => projette({ ...l, owner: own }, select)));
};
const res = () => ({ code: null, corps: null, status(n) { this.code = n; return this; }, json(o) { this.corps = o; return this; }, setHeader() {}, end() { return this; } });

(async () => {
  reset();
  let cron, widget;
  try { cron = (await import('file://' + path.join(RACINE, 'api', 'ship-reminders.js'))).default; } catch (e) { dit(false, 'api/ship-reminders.js se charge', e.message); }
  try { widget = (await import('file://' + path.join(RACINE, 'api', 'widget.js'))).default; } catch (e) { dit(false, 'api/widget.js se charge', e.message); }
  const lancer = async (t, query = { moment: 'soir' }) => { Date.now = () => t; try { const r = res(); await cron({ method: 'GET', headers: { authorization: 'Bearer cle-banc-cron' }, query }, r); return r; } finally { Date.now = vraiNow; } };
  const soirDe = (o) => pushes.filter((p) => /^soir-/.test(p.tag || '') && p.endpoint.includes('/' + o));
  const lancerWidget = async (k) => { Date.now = () => SOIR; const w = res(); try { await widget({ method: 'GET', headers: {}, query: { k } }, w); } finally { Date.now = vraiNow; } return w; };

  console.log('── Le widget : Vinted + Leboncoin + Vestiaire');
  await essaie('widget', async () => {
    reset();
    const w = await lancerWidget('tokA');
    const s = (w.corps && w.corps.ship) || {};
    dit(w.code === 200 && s.total === 3, 'à expédier = 3 (1 Vinted · 1 Leboncoin · 1 Vestiaire) — ni l’achat Leboncoin, ni le coché « Colis fait », ni le parti', `HTTP ${w.code} · total=${s.total} · ${JSON.stringify({ lbc: s.leboncoin, vc: s.vestiaire })}`);
    dit(s.vestiaire && s.vestiaire.tomorrow === 1 && s.tomorrow >= 1, 'la date limite Vestiaire (demain) compte dans « demain », comme Vinted', JSON.stringify({ tomorrow: s.tomorrow, vc: s.vestiaire }));
    dit(s.leboncoin && s.leboncoin.overdue === 0 && s.leboncoin.sansLimite === 1, 'Leboncoin n’écrit aucune date limite : compté, jamais « en retard »', JSON.stringify(s.leboncoin));
    dit(s.auMoins === false && Array.isArray(s.manque) && s.manque.length === 0, 'tout est lu ⇒ le total n’est pas « au moins »', JSON.stringify({ auMoins: s.auMoins, manque: s.manque }));
    const lect = lus.filter((u) => /lbc_ventes|vc_ventes|vc_listings/.test(u));
    dit(lect.length >= 3 && lect.every((u) => /owner=eq\./.test(u)) && lect.every((u) => !/select=data(&|$)/.test(u)), 'Leboncoin et Vestiaire lus pour CE vendeur, projetés (jamais `select=data`)', `${lect.length} lectures`);
    const b = await lancerWidget('tokB');
    dit(b.corps && b.corps.ship && b.corps.ship.total === 0, 'B (sans Leboncoin ni Vestiaire) : rien d’inventé', JSON.stringify(b.corps && b.corps.ship && b.corps.ship.total));
  });

  console.log('\n── Le rappel du soir : le même nombre');
  await essaie('soir', async () => {
    reset();
    const w = await lancerWidget('tokA');
    reset();
    await lancer(SOIR);
    const p = soirDe('A')[0] || {};
    console.log(`     sur le téléphone de A : « ${p.title} » / « ${p.body} »`);
    dit(/Demain : 3 colis à poster/.test(p.title || ''), 'le soir dit « Demain : 3 colis à poster » (Leboncoin et Vestiaire compris)', p.title);
    dit(/2 avec la date limite demain/.test(p.body || ""), "la date limite Vestiaire de demain est dite (2 : le colis Vinted ET la vente Vestiaire)", p.body);
    dit(w.corps && w.corps.ship && /Demain : 3 /.test(p.title || '') && w.corps.ship.total === 3, 'le soir et le widget disent le MÊME nombre (§11)', `widget=${w.corps && w.corps.ship && w.corps.ship.total}`);
  });

  console.log('\n── Une lecture ratée : « au moins », le site nommé');
  await essaie('Leboncoin illisible', async () => {
    reset(); pannes.add('A:lbc_ventes');
    const w = await lancerWidget('tokA');
    const s = (w.corps && w.corps.ship) || {};
    dit(s.total === 2 && s.auMoins === true && (s.manque || []).includes('Leboncoin') && s.leboncoin === null, 'widget : « au moins 2 », Leboncoin nommé (jamais 0 à sa place)', JSON.stringify({ total: s.total, auMoins: s.auMoins, manque: s.manque, lbc: s.leboncoin }));
    reset(); pannes.add('A:lbc_ventes');
    await lancer(SOIR);
    const p = soirDe('A')[0] || {};
    dit(/au moins 2 colis/.test(p.title || '') && /Leboncoin/.test(p.body || ''), 'soir : « au moins 2 colis », Leboncoin nommé', `${p.title} / ${p.body}`);
  });
  await essaie('Vestiaire illisible', async () => {
    reset(); pannes.add('A:vc_ventes');
    const w = await lancerWidget('tokA');
    const s = (w.corps && w.corps.ship) || {};
    dit(s.total === 2 && s.auMoins === true && (s.manque || []).includes('Vestiaire'), 'widget : Vestiaire illisible ⇒ « au moins 2 », Vestiaire nommé', JSON.stringify({ total: s.total, manque: s.manque }));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
