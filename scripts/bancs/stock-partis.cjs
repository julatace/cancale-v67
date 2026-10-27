// Banc : UN ARTICLE PARTI SORT TOUT SEUL DU STOCK (27 octobre). Données INVENTÉES.
// Julien : « pour une vente où je ne suis pas allé dans le stock, enlever le
// numéro si l'article est expédié » — tranché : on libère la PLACE, on garde le
// NUMÉRO. Il exige, à 1512 px et à 390 px tactile :
//  1. N°41 (case, « Commande finalisée ») et N°45 (pile, « Colis livré ») sortent
//     du plan, au nuage ; leurs fiches gardent leur numéro ;
//  2. RESTENT : N°42 (« Le paiement a été validé » : à poster), N°43 (annulée),
//     N°44 (« En cours d'acheminement » mais son annonce est ENCORE en ligne),
//     N°46 (« Retour initié ») ;
//  3. le Stock dit « Sortis du stock car partis » avec les deux, et « Remettre »
//     la remet dans sa case ; elle n'est plus retirée au passage suivant ;
//  4. « pas su » : ventes illisibles ⇒ rien ne bouge.
//  5. (même jour) Leboncoin et eBay : N°48 (Leboncoin « Colis envoyé », relié à la
//     main) et N°49 (eBay « Expédiée », SKU VRM-49) sortent ; N°50 et N°51, à
//     envoyer, restent.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7181;
const CHROME = '/opt/pw-browsers/chromium';
const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();

const PLAN = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère B', x: 0.2, y: 0.1, w: 1.2, h: 0.5, rows: 5, cols: 2, h3d: 1.25,
    slots: { '0_0': ['41'], '1_0': ['42'], '2_0': ['43'], '3_0': ['44'], '0_1': ['46'], '4_0': ['48'], '4_1': ['50'], '1_1': ['49'], '2_1': ['51'] } },
  { id: 'p1', type: 'pile', name: 'Cartons au sol', x: 3, y: 2, w: 1.5, h: 0.5, rows: 3, cols: 3, cell: 0.5, h3d: 0.34, nums: ['45', '47'], lift: 0 },
] }], active: 'r1' };
const vente = (tx, titre, status) => ({ transaction_id: tx, title: titre, status, price: { amount: '40.0', currency_code: 'EUR' }, date: iso(48) });
const VENTES = [vente(9001, 'Paire quarante et un', 'Commande finalisée'), vente(9002, 'Paire quarante-deux', 'Le paiement a été validé'),
  vente(9003, 'Paire quarante-trois', 'Commande annulée'), vente(9004, 'Paire quarante-quatre', "En cours d'acheminement"),
  vente(9005, 'Paire quarante-cinq', 'Colis livré'), vente(9006, 'Paire quarante-six', 'Retour initié')];
const OV = { '9001': { numero: '41' }, '9002': { numero: '42' }, '9003': { numero: '43' }, '9004': { numero: '44' }, '9005': { numero: '45' }, '9006': { numero: '46' } };
const ANN = { id: 7044, title: 'Paire quarante-quatre', price: { amount: '40.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: null, status: 'Très bon état', nPhotos: 3 };
const FICHES = { '7044': { numero: '44' }, '7047': { numero: '47' }, '7048': { numero: '48' }, '7049': { numero: '49' }, '7050': { numero: '50' }, '7051': { numero: '51' } };
// Leboncoin : reliées à la main (`vrm_lbc_liens`) ; eBay : par le SKU VRM-{n°}.
const LBC = { L1: { txId: 'L1', id: 'L1', itemId: '601', isSeller: true, price: 5000, parcelStatus: 'in_transit', stepLabel: 'Colis envoyé', title: 'Paire quarante-huit LBC' },
  L2: { txId: 'L2', id: 'L2', itemId: '602', isSeller: true, price: 5000, stepLabel: 'À envoyer', title: 'Paire cinquante LBC' } };
const cmdEbay = (orderId, sku, ful) => ({ orderId, orderPaymentStatus: 'PAID', orderFulfillmentStatus: ful, creationDate: iso(30), pricingSummary: { total: { value: '60.00', currency: 'EUR' } }, paymentSummary: { totalDueSeller: { value: '55.00', currency: 'EUR' } }, totalMarketplaceFee: { value: '5.00', currency: 'EUR' }, lineItems: [{ sku, legacyItemId: '9' + orderId.replace(/\D/g, ''), title: 'Paire ' + sku + ' eBay' }] });
const EBAY = [cmdEbay('E-49', 'VRM-49', 'FULFILLED'), cmdEbay('E-51', 'VRM-51', 'NOT_STARTED')];
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) }];
const lignes = () => [
  { id: 'main', data: { vinted_annonce_numeros: FICHES, vinted_sale_overrides: OV, vrm_lbc_liens: { '601': '48', '602': '50' } } },
  { id: 'lbc_ventes', data: { ventes: LBC } },
  { id: 'ebay_orders', data: { orders: EBAY, capturedAt: iso(0.1) } },
  { id: 'vrm_room', data: JSON.parse(JSON.stringify(PLAN)) },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: iso(0.1), nItems: 1, payload: { items: [ANN], pagination: { total_entries: 1, total_pages: 1 } } } },
  { id: 'harvest_111_orders_sold', data: { uid: '111', capturedAt: iso(0.1), nItems: VENTES.length, payload: { my_orders: VENTES, pagination: { total_pages: 1 } } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul'); process.exit(1); });
srv.listen(PORT);
const projette = (row, sel) => {
  if (!sel || sel === '*') return row;
  const out = {};
  for (const part of sel.split(',')) {
    const m = /^(?:([^:]+):)?(.+)$/.exec(part.trim()); if (!m) continue;
    const src = m[2], alias = m[1] || src.split(/->>|->/).pop();
    if (src === 'id') { out[alias] = row.id; continue; }
    if (src === 'data') { out[alias] = row.data; continue; }
    let v = row.data; for (const seg of src.replace(/^data(->>|->)/, '').split(/->>|->/)) v = v == null ? null : v[seg];
    out[alias] = v == null ? null : (src.includes('->>') && typeof v === 'object' ? JSON.stringify(v) : v);
  }
  return out;
};

async function rendre(b, vp, { ventesKO = false } = {}) {
  const L = lignes();
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const req = route.request();
    const u = decodeURIComponent(metaVersData(req.url()));
    const j = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (req.method() !== 'GET') {
      if (/\/rest\/v1\/app_data/.test(u)) { try { const body = JSON.parse(req.postData() || '[]'); for (const r of (Array.isArray(body) ? body : [body])) { if (!r || !r.id) continue; const i = L.findIndex((x) => x.id === r.id); if (i >= 0) L[i] = { id: r.id, data: r.data }; else L.push({ id: r.id, data: r.data }); } } catch (_) {} }
      return j([]);
    }
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCS);
    if (ventesKO && /orders_sold|orders_\*|orders_%/.test(u)) return route.fulfill({ status: 522, contentType: 'text/html', body: '<html>522</html>' });
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && !/^id,data|^data$|^data,/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: (r.data && r.data.capturedAt) || iso(0), cap: r.data && r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(L.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(L.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
  return { ctx, pg, errs, L };
}
const posesDuPlan = (p) => { const out = []; ((p && p.rooms) || []).forEach((r) => (r.items || []).forEach((it) => { Object.values(it.slots || {}).forEach((a) => (a || []).forEach((v) => out.push(String(v)))); (it.nums || []).forEach((v) => v && out.push(String(v))); })); return out.sort(); };
const planNuage = (L) => (L.find((r) => r.id === 'vrm_room') || {}).data;
const attendre = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, 300)); } return false; };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  for (const vp of [{ width: 1512, height: 900 }, { width: 390, height: 844 }]) {
    const T = ' [' + vp.width + ']';
    try {
      const { ctx, pg, errs, L } = await rendre(b, vp);
      const sorti = await attendre(() => { const p = posesDuPlan(planNuage(L)); return !p.includes('41') && !p.includes('48') && !p.includes('49'); }, 25000);
      await pg.waitForTimeout(800);
      const poses = posesDuPlan(planNuage(L));
      dit(sorti && !poses.includes('41'), 'N°41 (« Commande finalisée ») sort de sa case, au nuage' + T, poses.join(','));
      dit(!poses.includes('45') && poses.includes('47'), 'N°45 (« Colis livré ») sort de la pile, N°47 reste' + T, poses.join(','));
      dit(['42', '43', '44', '46'].every((n) => poses.includes(n)), 'restent : à poster (42), annulée (43), encore en ligne (44), retour (46)' + T, poses.join(','));
      dit(!poses.includes('48') && !poses.includes('49'), 'N°48 (Leboncoin « Colis envoyé ») et N°49 (eBay « Expédiée ») sortent' + T, poses.join(','));
      dit(poses.includes('50') && poses.includes('51'), 'restent : N°50 (Leboncoin à envoyer) et N°51 (eBay à expédier)' + T, poses.join(','));
      const main = (L.find((r) => r.id === 'main') || {}).data || {};
      dit(JSON.stringify((main.vinted_sale_overrides || OV)['9001']) === JSON.stringify({ numero: '41' }), 'la vente garde son numéro (41)' + T);
      await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
      const vu = await pg.waitForSelector('[data-stock-sortis]', { timeout: 30000 }).then(() => true).catch(() => false);
      const liste = vu ? await pg.$$eval('[data-stock-sorti]', (els) => els.map((e) => e.getAttribute('data-stock-sorti')).sort().join(',')) : '';
      dit(liste === '41,45,48,49', 'le Stock dit « Sortis du stock car partis » : N°41, 45, 48, 49' + T, liste);
      const tE = vu ? await pg.$eval('[data-stock-sorti="49"]', (e) => e.innerText).catch(() => '') : '';
      dit(/eBay : Expédiée/.test(tE), 'la ligne eBay dit ce que dit eBay' + T, tE.replace(/\s+/g, ' '));
      const txt = vu ? await pg.$eval('[data-stock-sorti="41"]', (e) => e.innerText) : '';
      dit(/Étagère B/.test(txt) && /Commande finalisée/.test(txt), 'la ligne dit d’où elle sort et ce que dit Vinted' + T, txt.replace(/\s+/g, ' '));
      const h = vu ? await pg.$eval('[data-stock-remettre="41"]', (e) => e.getBoundingClientRect().height) : 0;
      dit(h >= 44, '« Remettre » fait au moins 44 px' + T, String(h));
      if (vu) await pg.click('[data-stock-remettre="41"]');
      const remise = await attendre(() => posesDuPlan(planNuage(L)).includes('41'), 8000);
      dit(remise, '« Remettre » la remet dans le stock (au nuage)' + T, posesDuPlan(planNuage(L)).join(','));
      dit(!(await pg.$('[data-stock-sorti="41"]')), 'elle sort de la liste' + T);
      // Elle ne repart plus : un nouveau passage sur Ventes la laisse.
      await pg.goto(`http://localhost:${PORT}/?tab=cat_ventes`, { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(6000);
      dit(posesDuPlan(planNuage(L)).includes('41'), 'remise, elle n’est plus retirée toute seule' + T, posesDuPlan(planNuage(L)).join(','));
      dit(!errs.length, 'aucune erreur de page' + T, errs.join(' | '));
      await ctx.close();
    } catch (e) { dit(false, 'le scénario a pu s’exécuter' + T, String(e && e.message || e).split('\n')[0]); }
  }
  // « pas su » : les ventes ne se lisent pas ⇒ rien ne bouge.
  try {
    const { ctx, pg, L } = await rendre(b, { width: 1512, height: 900 }, { ventesKO: true });
    await pg.waitForTimeout(9000);
    dit(posesDuPlan(planNuage(L)).join(',') === posesDuPlan(PLAN).join(','), 'ventes illisibles : le stock ne bouge pas', posesDuPlan(planNuage(L)).join(','));
    await ctx.close();
  } catch (e) { dit(false, 'le scénario « pas su » a pu s’exécuter', String(e && e.message || e).split('\n')[0]); }
  await b.close(); srv.close();
  console.log(ko ? `❌ stock-partis : ${ko} rouge(s)` : '✅ stock-partis : un article parti sort du stock, le reste ne bouge pas');
  process.exit(ko ? 1 : 0);
})();
