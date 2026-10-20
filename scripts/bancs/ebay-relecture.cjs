// ═══════════════════════════════════════════════════════════════════════════
// BANC : eBAY SE RELIT TOUT SEUL (20 octobre)
//        (node scripts/bancs/ebay-relecture.cjs — après `npm run build` ;
//         BANC_PORT pour changer de port, 8061 par défaut)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « pour eBay ça doit se relire tout seul ou se rafraîchir à
// l'ouverture de l'app, mais je dois rien avoir à faire ». Données INVENTÉES
// (le banc vit dans le dépôt, public), faux /api/ebay, session VRM, horloge
// pilotée (`page.clock`). Aux deux tailles (390 px tactile, 1512 px) :
//   A. commandes eBay rangées il y a 2 h (E-1) ⇒ à l'ouverture de Colis, la
//      relecture part SANS CLIC, une seule fois ; la vente neuve E-NEW apparaît
//      dans Colis sans recharger ; 5 min plus tard (5 tics, un `focus`) : pas
//      de second appel ; onglet caché 11 min : rien ; retour au premier plan
//      (> 10 min) : elle repart ;
//   B. capture rangée il y a 2 min (un autre appareil vient de relire) ⇒ AUCUN
//      appel à l'ouverture (l'âge se juge sur la base, pas sur l'onglet) ;
//   C. eBay en panne (503) ⇒ E-1 reste affichée (rien n'est vidé), et on ne
//      martèle pas : 5 min plus tard toujours 1 appel ; après le recul de
//      10 min, un nouvel essai.
// Mutation attendue rouge : la borne de 10 min retirée ⇒ appels multiples.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 8061;

const H = 3600000, J = 24 * H, MIN = 60000;
const ACCOUNTS = [{ id: 1, vinted_user_id: '111', login: 'compte_a', domain: 'www.vinted.fr', updated_at: new Date().toISOString() }];
const SESSION = { access_token: 'jeton-de-l-app', refresh_token: 'jeton-renouv', expires_at: Date.now() + 24 * H,
  user: { id: '11111111-2222-3333-4444-555555555555', email: 'vendeur@exemple.test' } };
const cmd = (id, sku) => ({
  orderId: id, creationDate: new Date(Date.now() - 5 * H).toISOString(), orderPaymentStatus: 'PAID', orderFulfillmentStatus: 'NOT_STARTED',
  cancelStatus: { cancelState: 'NONE_REQUESTED' }, fulfillmentStartInstructions: [{ fulfillmentInstructionsType: 'SHIP_TO' }],
  pricingSummary: { total: { value: '80.00', currency: 'EUR' } }, buyer: { username: 'acheteur_' + id },
  lineItems: [{ lineItemId: 'L' + id, title: 'eBay Paire ' + id, sku, legacyItemId: '55' + id.length, quantity: 1,
    lineItemCost: { value: '80.00', currency: 'EUR' }, lineItemFulfillmentInstructions: { shipByDate: new Date(Date.now() + 2 * J).toISOString() } }],
});

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance le banc seul (BANC_PORT=…)'); process.exit(1); });
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
    out[alias] = v == null ? null : (/->>/.test(src) && typeof v !== 'string' ? String(v) : v);
  }
  return out;
};

// `capIl` : âge de la capture rangée (ms) · `panne` : la route relire répond 503.
async function preparer(b, vp, { capIl = 2 * H, panne = false } = {}) {
  const ROWS = [
    { id: 'main', data: { vinted_ship_done: {} } },
    { id: 'harvest_111_orders_sold', data: { capturedAt: new Date().toISOString(), payload: { my_orders: [] } } },
    { id: 'ebay_orders', data: { capturedAt: Date.now() - capIl, orders: [cmd('E-1', 'VRM-12')] } },
  ];
  const appels = [];
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.clock.install({ time: Date.now() });
  await pg.addInitScript((sess) => {
    try { localStorage.setItem('vrm_session', JSON.stringify(sess)); } catch (_) {}
    // L'onglet caché se simule : `document.visibilityState` piloté par le banc.
    window.__cache = false;
    try { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (window.__cache ? 'hidden' : 'visible') }); } catch (_) {}
    try { Object.defineProperty(document, 'hidden', { configurable: true, get: () => !!window.__cache }); } catch (_) {}
  }, SESSION);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/auth/v1/**', (r) => {
    const chemin = new URL(r.request().url()).pathname.replace(/^.*\/auth\/v1\//, '');
    const corps = chemin === 'user' ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated' } : { ...SESSION, expires_in: 3600 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) });
  });
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d, st) => route.fulfill({ status: st || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return j({ m: 1 }, 400);
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date().toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (route) => {
    const req = route.request();
    let corps = null; try { corps = JSON.parse(req.postData() || 'null'); } catch (_) {}
    if (/\/api\/ebay/.test(req.url()) && corps && corps.action === 'relire') {
      appels.push(Date.now());
      if (panne) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, reason: 'ebay', error: 'eBay n\'a pas rendu tes commandes' }) });
      const l = ROWS.find((r) => r.id === 'ebay_orders');
      if (!l.data.orders.some((o) => o.orderId === 'E-NEW')) l.data.orders.push(cmd('E-NEW', 'VRM-13'));
      l.data.capturedAt = Date.now();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, lu: { commandes: true, annonces: true, programmees: true }, commandes: { lues: l.data.orders.length } }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' });
  });
  return { ctx, pg, errs, appels };
}
const idsColis = (pg) => pg.evaluate(() => [...document.querySelectorAll('[data-colis-ebay-cmd]')].map((x) => x.getAttribute('data-colis-ebay-cmd')).sort().join(','));
const attendre = async (pg, f, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await f()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
const tic = (pg, ms) => pg.clock.runFor(ms);

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 844 }, { width: 1512, height: 950 }]) {
      console.log(`── ${vp.width} px`);
      // ── A ──
      const a = await preparer(b, vp);
      await essaie('A', async () => {
        await a.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await a.pg.waitForSelector('[data-colis-recap]', { timeout: 20000 });
        const parti = await attendre(a.pg, async () => a.appels.length >= 1);
        dit(parti && a.appels.length === 1, 'A : à l\'ouverture, la relecture eBay part SANS CLIC, une fois', `appels=${a.appels.length}`);
        const vu = await attendre(a.pg, async () => (await idsColis(a.pg)) === 'E-1,E-NEW');
        dit(vu, 'A : la vente eBay neuve apparaît dans Colis sans recharger', await idsColis(a.pg));
        const pubOk = await attendre(a.pg, async () => { const p = await a.pg.evaluate(() => { try { return JSON.parse(localStorage.getItem('vrm_colis_aposter') || 'null'); } catch (_) { return null; } }); return !!(p && p.ebay === 2); }, 6000);
        dit(pubOk, 'A : la cloche reçoit le nouveau nombre (vrm_colis_aposter, 2 ventes eBay)');
        await tic(a.pg, 5 * MIN);
        await a.pg.evaluate(() => { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
        await new Promise((r) => setTimeout(r, 1500));
        dit(a.appels.length === 1, 'A : 5 min plus tard (5 tics + un retour au premier plan) : pas de second appel', `appels=${a.appels.length}`);
        await a.pg.evaluate(() => { window.__cache = true; document.dispatchEvent(new Event('visibilitychange')); });
        await tic(a.pg, 11 * MIN);
        await new Promise((r) => setTimeout(r, 1000));
        dit(a.appels.length === 1, 'A : onglet caché 11 min : aucune relecture', `appels=${a.appels.length}`);
        await a.pg.evaluate(() => { window.__cache = false; document.dispatchEvent(new Event('visibilitychange')); });
        const repart = await attendre(a.pg, async () => a.appels.length >= 2, 8000);
        dit(repart && a.appels.length === 2, 'A : retour au premier plan après plus de 10 min : elle repart (une fois)', `appels=${a.appels.length}`);
        const r = await a.pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        dit(r.sw <= r.cw + 1, 'A : aucun débordement horizontal', `${r.sw} > ${r.cw}`);
      });
      dit(a.errs.length === 0, 'A : aucune erreur de page', a.errs.join(' | ').slice(0, 200));
      await a.ctx.close();
      // ── B ──
      const bb = await preparer(b, vp, { capIl: 2 * MIN });
      await essaie('B', async () => {
        await bb.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await bb.pg.waitForSelector('[data-colis-recap]', { timeout: 20000 });
        await new Promise((r) => setTimeout(r, 4000));
        dit(bb.appels.length === 0, 'B : capture rangée il y a 2 min (autre appareil) ⇒ aucun appel à l\'ouverture', `appels=${bb.appels.length}`);
      });
      await bb.ctx.close();
      // ── C ──
      const c = await preparer(b, vp, { panne: true });
      await essaie('C', async () => {
        await c.pg.goto(`http://localhost:${PORT}/?tab=cat_bord`, { waitUntil: 'domcontentloaded' });
        await c.pg.waitForSelector('[data-colis-recap]', { timeout: 20000 });
        await attendre(c.pg, async () => c.appels.length >= 1);
        await new Promise((r) => setTimeout(r, 1500));
        dit(c.appels.length === 1, 'C : eBay en panne : un essai à l\'ouverture', `appels=${c.appels.length}`);
        dit((await idsColis(c.pg)) === 'E-1', 'C : la vente déjà connue reste affichée (rien n\'est vidé)', await idsColis(c.pg));
        await tic(c.pg, 5 * MIN);
        await new Promise((r) => setTimeout(r, 1000));
        dit(c.appels.length === 1, 'C : on ne martèle pas (5 min plus tard, toujours un seul appel)', `appels=${c.appels.length}`);
        await tic(c.pg, 6 * MIN);
        const re = await attendre(c.pg, async () => c.appels.length >= 2, 8000);
        dit(re && c.appels.length === 2, 'C : après le recul de 10 min, un nouvel essai', `appels=${c.appels.length}`);
        dit((await idsColis(c.pg)) === 'E-1', 'C : toujours rien de vidé', await idsColis(c.pg));
      });
      dit(c.errs.length === 0, 'C : aucune erreur de page', c.errs.join(' | ').slice(0, 200));
      await c.ctx.close();
    }
  } catch (e) { dit(false, 'le banc a tourné jusqu’au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close().catch(() => {}); srv.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTous les contrôles passent — eBay se relit tout seul, borné, sans rien vider.');
  process.exit(ko ? 1 : 0);
})();
