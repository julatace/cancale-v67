// Banc : LE STOCK, UN ARTICLE UNE FOIS — ET LES ARTICLES DE TOUTES LES PLATEFORMES
// (28 octobre). Données INVENTÉES. Julien : « il faut qu'il n'y ait que les
// articles différents de toutes les plateformes » — les deux sens :
//  1. N°44 en vente sur Vinted ET eBay (SKU VRM-44) n'apparaît qu'UNE fois dans
//     « À ranger » ; N°45 (autre annonce Vinted, MÊME photo exacte) est la même
//     paire : un seul élément, « N°44 · N°45 » ;
//  2. N°60 (seulement sur eBay, SKU VRM-60 — sa fiche VRM reste, son annonce
//     Vinted est partie) et N°61 (seulement sur Leboncoin,
//     référence VRM-61) y apparaissent, avec leur plateforme ;
//  3. jamais : N°62 (annonce Leboncoin vendue), N°63 (vendue sur Vinted, colis
//     parti, l'annonce eBay VRM-63 encore en ligne), une annonce eBay sans SKU.
// À 1512 px et 390 px tactile. Le Stock est ouvert après Ventes (l'écran qui
// publie la liste des paires présentes).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 7191;
const CHROME = '/opt/pw-browsers/chromium';
const now = Date.now();
const iso = (h) => new Date(now - h * 3600e3).toISOString();
const MUT = process.env.BANC_MUTATION || '';

const PLAN = { rooms: [{ id: 'r1', name: 'Garage', room: { w: 6, h: 5, wallH: 3 }, items: [
  { id: 'm1', type: 'metal', name: 'Étagère B', x: 0.2, y: 0.1, w: 1.2, h: 0.5, rows: 4, cols: 3, h3d: 1.25, slots: { '0_0': ['46'] } },
] }], active: 'r1' };
const ph = (f) => ({ url: 'https://images1.vinted.net/t/01_aa/f800/' + f + '.jpeg?s=x', high_resolution: { timestamp: Math.floor(now / 1000) - 3600 } });
const ann = (id, titre, f) => ({ id, title: titre, price: { amount: '50.0', currency_code: 'EUR' }, is_closed: false, is_draft: false, is_hidden: false, photo: ph(f), status: 'Très bon état', nPhotos: 3 });
const ANNS = [ann(7044, 'Nike Air Max noir 42', 'PHOTOA'), ann(7045, 'Nike Air Max noir 42 republiée', 'PHOTOA'), ann(7047, 'Adidas Samba blanche 41', 'PHOTOC')];
const FICHES = {
  '7044': { numero: '44', title: 'Nike Air Max noir 42', photo: ph('PHOTOA').url },
  '7045': { numero: '45', title: 'Nike Air Max noir 42 republiée', photo: ph('PHOTOA').url },
  '7046': { numero: '46', title: 'Déjà rangée', photo: ph('PHOTOR').url },
  '7047': { numero: '47', title: 'Adidas Samba blanche 41', photo: ph('PHOTOC').url },
  '7060': { numero: '60', title: 'Samba (annonce Vinted supprimée)', photo: ph('PHOTOE').url },
  '7063': { numero: '63', title: 'Asics vendue', photo: ph('PHOTOV').url },
};
const VENTES = [{ transaction_id: 9063, title: 'Asics vendue', status: 'Commande finalisée', price: { amount: '40.0', currency_code: 'EUR' }, date: iso(48), photo: ph('PHOTOV') }];
const EBAY = [
  { itemId: '111', sku: 'VRM-44', title: 'Air Max noir eBay', photo: null },
  { itemId: '112', sku: 'VRM-60', title: 'Samba seule sur eBay', photo: null },
  { itemId: '113', sku: '', title: 'Annonce eBay sans SKU', photo: null },
  { itemId: '114', sku: 'VRM-63', title: 'Asics encore sur eBay', photo: null },
];
const LBC_ITEMS = { '701': { id: '701', subject: 'Spezial seule sur Leboncoin', customRef: 'VRM-61', status: 'active', seenAt: iso(1) },
  '702': { id: '702', subject: 'Gazelle vendue sur Leboncoin', ref: '62', status: 'active', seenAt: iso(1) } };
const LBC_VENTES = { V1: { txId: 'V1', itemId: '702', isSeller: true, price: 5000, stepLabel: 'Colis envoyé', title: 'Gazelle' } };
const ACCS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: iso(0), created_at: iso(500) }];
const lignes = () => [
  { id: 'main', data: { vinted_annonce_numeros: FICHES } },
  { id: 'lbc_ventes', data: { ventes: LBC_VENTES } },
  { id: 'lbc_listings', data: { items: LBC_ITEMS } },
  { id: 'ebay_listings', data: { items: EBAY, capturedAt: iso(0.1), complet: true } },
  { id: 'vrm_room', data: JSON.parse(JSON.stringify(PLAN)) },
  { id: 'harvest_111_listings', data: { uid: '111', capturedAt: iso(0.1), nItems: ANNS.length, payload: { items: ANNS, pagination: { total_entries: ANNS.length, total_pages: 1 } } } },
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
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vinted_garage_view', '"plan"'); } catch (_) {} });
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
const attendre = async (fn, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch (_) {} await new Promise((r) => setTimeout(r, 300)); } return false; };

(async () => {
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  for (const vp of [{ width: 1512, height: 900 }, { width: 390, height: 844 }]) {
    const T = ' [' + vp.width + ']';
    try {
      const { ctx, pg, errs } = await rendre(b, vp);
      const lu = () => pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vinted_nums_physiques') || 'null'); } catch (_) { return null; } });
      await attendre(async () => { const p = await lu(); return p && Array.isArray(p.autres) && p.autres.length >= 2; }, 25000);
      const pub = await lu();
      const nums = (pub && pub.nums || []).slice().sort().join(',');
      dit(/(^|,)60(,|$)/.test(nums) && /(^|,)61(,|$)/.test(nums), 'les paires vues seulement sur eBay (60) et Leboncoin (61) sont présentes' + T, nums);
      dit(!/(^|,)62(,|$)/.test(nums) && !/(^|,)63(,|$)/.test(nums), 'ni la N°62 (vendue sur Leboncoin) ni la N°63 (vendue sur Vinted, partie)' + T, nums);
      if (MUT) await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('vinted_nums_physiques')); p.autres = []; localStorage.setItem('vinted_nums_physiques', JSON.stringify(p)); });
      await pg.goto(`http://localhost:${PORT}/?tab=garage`, { waitUntil: 'domcontentloaded' });
      await pg.waitForSelector('[data-bande-a-ranger]', { timeout: 30000 }).catch(() => null);
      await pg.waitForTimeout(800);
      const bande = await pg.$$eval('[data-paire-a-ranger]', (els) => els.map((e) => ({ n: e.getAttribute('data-paire-a-ranger'), p: e.getAttribute('data-paire-plateformes') || '', a: e.getAttribute('data-paire-aussi') || '', t: e.innerText.replace(/\s+/g, ' ') })));
      const ns = bande.map((x) => x.n);
      const dbl = ns.filter((n, i) => ns.indexOf(n) !== i);
      dit(!dbl.length, 'aucun numéro deux fois dans « À ranger »' + T, ns.join(','));
      const n44 = bande.filter((x) => x.n === '44' || x.n === '45');
      dit(n44.length === 1 && (n44[0].a === '45' || n44[0].a === '44'), 'N°44 et N°45 (même photo) : UN seul article, l’autre N° dit à côté' + T, JSON.stringify(n44));
      dit(n44.length === 1 && /ebay/.test(n44[0].p) && /vinted/.test(n44[0].p), 'il sait qu’elle est aussi sur eBay' + T, JSON.stringify(n44));
      const e60 = bande.find((x) => x.n === '60'), l61 = bande.find((x) => x.n === '61');
      dit(!!e60 && /eBay/.test(e60.t) && !/vinted/.test(e60.p), 'N°60 (seulement sur eBay) est à ranger, « eBay » écrit' + T, JSON.stringify(e60 || null));
      dit(!!l61 && /Leboncoin/.test(l61.t), 'N°61 (seulement sur Leboncoin) est à ranger, « Leboncoin » écrit' + T, JSON.stringify(l61 || null));
      dit(!ns.includes('62') && !ns.includes('63') && !ns.includes('46'), 'ni 62, ni 63, ni la N°46 déjà rangée' + T, ns.join(','));
      dit(ns.includes('47'), 'la N°47 (Vinted seule) reste' + T, ns.join(','));
      dit(!errs.length, 'aucune erreur de page' + T, errs.join(' | '));
      await ctx.close();
    } catch (e) { dit(false, 'le scénario a pu s’exécuter' + T, String(e && e.message || e).split('\n')[0]); }
  }
  await b.close(); srv.close();
  console.log(ko ? `❌ stock-plateformes : ${ko} rouge(s)` : '✅ stock-plateformes : un article une fois, toutes les plateformes');
  process.exit(ko ? 1 : 0);
})();
