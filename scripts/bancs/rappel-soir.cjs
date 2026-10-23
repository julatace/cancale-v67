// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE RAPPEL DE LA VEILLE AU SOIR, EXÉCUTÉ (node scripts/bancs/rappel-soir.cjs)
// ═══════════════════════════════════════════════════════════════════════════
// Retenu par Julien le 11 octobre : « Demain : N colis à poster ». §4.10 : on
// lance le VRAI `api/ship-reminders.js?moment=soir` (et le vrai widget pour
// comparer) sur une fausse base CLOISONNÉE à DEUX vendeurs, un faux Web Push
// (rien ne part), un mercredi 21 octobre 2026 à 20 h 05 (Paris). On exige :
//   • A a 3 colis à poster (2 Vinted + 1 eBay ; un coché « posté » exclu) : il
//     reçoit « Demain : 3 colis à poster », le « dont » juste, sur SON appareil ;
//   • ce nombre est CELUI du widget (même règle, §11) ;
//   • B n'a rien à poster ⇒ rien pour B ;
//   • une fois par jour : relancé ⇒ rien ; mémo non écrit / illisible ⇒ rien ;
//   • préférence « soir » coupée ⇒ rien ; ventes Vinted illisibles ⇒ rien ;
//     eBay illisible ⇒ « au moins », eBay nommé ;
//   • toutes les lectures portent owner=eq.<vendeur> ;
//   • le passage du soir n'envoie NI le rappel du matin, NI l'URSSAF, NI le bilan,
//     et le passage du matin n'envoie pas le rappel du soir ;
//   • vercel.json porte le second cron vers la MÊME route.
// Aucune fixture : tout est inventé ici.
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m, String((e && e.stack) || e).split('\n').slice(0, 2).join(' ')); } };

process.env.VAPID_PRIVATE_KEY = 'banc-cle-privee-factice';
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
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: { 102: true }, vinted_bords_shipped: {}, vrm_widget_token: 'tokA' },
    ventes: { 11: { cap: iso(SOIR - 3600000), txns: ['102', '106', '107'], orders: [
      { transaction_id: 102, status: 'Le paiement a été validé', date: iso(SOIR - J), price: { amount: '23.5' }, transaction_user_status: 'needs_action' },
      { transaction_id: 106, status: 'Le paiement a été validé', date: iso(SOIR - J), price: { amount: '30' }, transaction_user_status: 'needs_action' },
      { transaction_id: 107, status: 'Le paiement a été validé', date: iso(SOIR - 4 * J), price: { amount: '45' }, transaction_user_status: 'needs_action' },
    ] } },
    // §6.3 (22 oct.) : la forme RÉELLE d'un bordereau email — `filename` et
    // `receivedAt` sont sur 204 lignes sur 204 ; la table « un bordereau par
    // vente » de l'app (et désormais des rappels) ne lit que celles-là.
    bords: [
      { id: 'email_bord_106', data: { transaction: '106', dateLimite: '22/10/2026 23:59', numero: '12', filename: 'Bordereau-Vinted-106.pdf', receivedAt: iso(SOIR - J) } },
      { id: 'email_bord_107', data: { transaction: '107', dateLimite: '21/10/2026 23:59', numero: '14', filename: 'Bordereau-Vinted-107.pdf', receivedAt: iso(SOIR - 4 * J) } },     // limite ce soir : demain, c'est en retard
      { id: 'email_bord_102', data: { transaction: '102', dateLimite: '20/10/2026 23:59', numero: '9', filename: 'Bordereau-Vinted-102.pdf', receivedAt: iso(SOIR - J) } },   // coché « posté » : jamais compté
    ],
    ebay: [ebayCmd('E1', '2026-10-25T21:00:00Z')],
  },
  B: {
    subs: [{ endpoint: 'https://fcm.googleapis.com/B1', keys: {} }], prefs: null,
    comptes: [{ vinted_user_id: '22', login: 'vendeur_b' }],
    main: { vinted_sales_hidden: [], vinted_accounts_hidden: [], vinted_ship_done: {}, vinted_bords_shipped: {}, vrm_widget_token: 'tokB' },
    ventes: { 22: { cap: iso(SOIR - 3600000), txns: [], orders: [{ transaction_id: 201, status: 'Commande finalisée', date: iso(SOIR - 9 * J), price: { amount: '40' } }] } },
    bords: [], ebay: [],
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

  console.log('── Le soir : « Demain : N colis à poster », pour chacun le sien');
  await essaie('soir', async () => {
    reset();
    const r = await lancer(SOIR);
    const a = soirDe('A'), b = soirDe('B');
    const p = a[0] || {};
    console.log(`     sur le téléphone de A : « ${p.title} » / « ${p.body} »`);
    dit(a.length === 1, 'A reçoit UN rappel du soir sur son appareil', `A=${a.length} · HTTP ${r.code}`);
    dit(/^⏰ Demain : 3 colis à poster/.test(p.title || ''), 'le titre dit « ⏰ Demain : 3 colis à poster » (2 Vinted + 1 eBay ; le colis coché « posté » exclu)', p.title);
    dit(/1 déjà en retard/.test(p.body || '') && /1 avec la date limite demain/.test(p.body || '') && !/2 déjà en retard/.test(p.body || ''), 'le « dont » : 1 en retard (limite ce soir), 1 avec la date limite demain — le bordereau du colis coché « posté » n’est pas compté', p.body);
    dit(p.url === '/?tab=cat_bord', 'le clic ouvre Colis', p.url);
    dit(b.length === 0, 'B n’a rien à poster ⇒ rien pour B', `B=${b.length}`);
    const lect = lus.filter((u) => /orders_sold|email_bord|ebay_orders|ebay_comptes|vinted_accounts|soir_reminder_dedup/.test(u));
    dit(lect.length > 0 && lect.every((u) => /owner=eq\./.test(u)), 'toutes les lectures portent owner=eq.<vendeur>', `${lect.length} lectures`);
    dit(!pushes.some((x) => /^(ship-reminder|urssaf-|bilan-)/.test(x.tag || '')), 'le passage du soir n’envoie ni le rappel du matin, ni l’URSSAF, ni le bilan');
  });

  console.log('\n── Le nombre du widget');
  await essaie('widget', async () => {
    reset();
    Date.now = () => SOIR;
    const w = res();
    try { await widget({ method: 'GET', headers: {}, query: { k: 'tokA' } }, w); } finally { Date.now = vraiNow; }
    reset();
    const r = await lancer(SOIR);
    const bil = r.corps && Array.isArray(r.corps.bilans) ? r.corps.bilans.find((x) => x.owner === 'A') : null;
    dit(w.corps && w.corps.ship && bil && bil.n === w.corps.ship.total, 'le soir annonce exactement les colis « à expédier » du widget', `soir=${bil && bil.n} widget=${w.corps && w.corps.ship && w.corps.ship.total}`);
  });

  console.log('\n── Une fois par jour');
  await essaie('doublon', async () => {
    reset();
    await lancer(SOIR); await lancer(SOIR + 1800000);
    dit(soirDe('A').length === 1, 'relancé le même soir : aucun second rappel', `${soirDe('A').length}`);
    await lancer(SOIR + J);
    dit(soirDe('A').length === 2, 'le lendemain soir : un nouveau rappel', `${soirDe('A').length}`);
  });
  await essaie('mémo non écrit', async () => {
    reset(); pannes.add('ecrire:A:soir_reminder_dedup');
    await lancer(SOIR);
    dit(soirDe('A').length === 0, 'le mémo de A ne s’écrit pas ⇒ rien (sinon il repartirait au prochain passage)');
  });
  await essaie('mémo illisible', async () => {
    reset(); pannes.add('A:soir_reminder_dedup');
    await lancer(SOIR);
    dit(soirDe('A').length === 0, 'le mémo de A est illisible ⇒ rien (pas su s’il est déjà parti)');
  });

  console.log('\n── Préférence, lectures ratées');
  await essaie('préférence', async () => {
    reset(); V.A.prefs = { soir: false };
    await lancer(SOIR);
    dit(soirDe('A').length === 0, '« Colis de demain » coupé chez A ⇒ rien');
  });
  await essaie('ventes illisibles', async () => {
    reset(); pannes.add('A:orders_sold');
    await lancer(SOIR);
    dit(soirDe('A').length === 0 && !((memos.A || {}).soir_reminder_dedup), 'ventes Vinted illisibles ⇒ rien envoyé, rien mémorisé (jamais un nombre inventé)');
  });
  await essaie('eBay illisible', async () => {
    reset(); pannes.add('A:ebay_orders');
    await lancer(SOIR);
    const p = soirDe('A')[0] || {};
    dit(/au moins 2 colis/.test(p.title || '') && /eBay/.test(p.body || ''), 'eBay illisible ⇒ « au moins 2 colis », eBay nommé', `${p.title} / ${p.body}`);
  });

  console.log('\n── Le matin ne part pas le soir, et inversement');
  await essaie('matin', async () => {
    reset();
    await lancer(SOIR, {});
    dit(soirDe('A').length === 0, 'sans `moment=soir`, le cron du matin n’envoie pas le rappel du soir');
  });
  await essaie('vercel.json', async () => {
    const vj = JSON.parse(fs.readFileSync(path.join(RACINE, 'vercel.json'), 'utf8'));
    const crons = Array.isArray(vj.crons) ? vj.crons : [];
    // Un chemin de cron SANS paramètre (la doc de Vercel n'en montre aucun) : une
    // réécriture le mène à la MÊME route avec `?moment=soir`.
    const soir = crons.find((c) => c.path === '/api/rappel-soir');
    const rw = (vj.rewrites || []).find((r) => r.source === '/api/rappel-soir');
    dit(crons.length === 2 && !!soir && /^0 1[89] \* \* \*$/.test(soir.schedule) && !!rw && rw.destination === '/api/ship-reminders?moment=soir', 'vercel.json : un second cron, une fois par jour, réécrit vers la MÊME route (?moment=soir)', JSON.stringify(crons));
  });

  console.log(`\n${ok} contrôle(s) OK, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
