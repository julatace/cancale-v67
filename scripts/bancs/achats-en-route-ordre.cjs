// ── BANC : ACHATS « EN ROUTE », LE PLUS RÉCENT EN HAUT (5 nov.) ─────────────
// Julien : « je veux que dans achat en route c'est le plus récent qui s'affiche
// en haut peu importe le compte et le filtre ». Avant : le plus ANCIEN d'abord
// (après l'étape du colis), puis le compte choisi passé en tête.
// Données INVENTÉES. Mesure l'ordre des cartes `[data-achat-tx]` sous
// « En route », à 390 tactile et 1512, sans compte choisi puis avec le compte
// le plus ancien choisi (s'il y a un sélecteur de compte).
const { chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs = require('fs'), http = require('http'), path = require('path');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT || 4381);

const MAINTENANT = Date.now();
const ilYa = (j) => new Date(MAINTENANT - j * 86400000).toISOString();

// Quatre achats EN ROUTE sur deux comptes, dates mêlées (inventés). Attendu sous
// « En route » : le plus RÉCENT en haut — 9304 (1 j, 222), 9302 (2 j, 111),
// 9303 (5 j, 222), 9301 (10 j, 111) — quel que soit le compte choisi.
const enRoute = (tx, titre, j) => ({ transaction_id: tx, title: titre, price: { amount: '30', currency_code: 'EUR' },
  status: 'Le vendeur a envoyé la commande', transaction_user_status: 'waiting', date: ilYa(j) });
const A111 = [enRoute(9301, 'Paire Dix Jours taille 40', 10), enRoute(9302, 'Paire Deux Jours taille 41', 2)];
const A222 = [enRoute(9303, 'Paire Cinq Jours taille 42', 5), enRoute(9304, 'Paire Un Jour taille 43', 1)];
const ATTENDU = ['9304', '9302', '9303', '9301'];
const ACCOUNTS = [
  { id: 1, vinted_user_id: '111', login: 'compte_un', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
  { id: 2, vinted_user_id: '222', login: 'compte_deux', domain: 'www.vinted.fr', updated_at: new Date(MAINTENANT).toISOString() },
];
const ROWS = [
  { id: 'main', data: {} },
  { id: 'harvest_111_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: A111 } } },
  { id: 'harvest_222_orders_purchased', data: { capturedAt: new Date(MAINTENANT).toISOString(), payload: { my_orders: A222 } } },
];

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message).split('\n')[0].slice(0, 140)); } };

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
    out[alias] = v == null ? null : v;
  }
  return out;
};

async function preparer(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, ...(vp.width < 600 ? { isMobile: true, hasTouch: true } : {}), permissions: opts.clavierRefuse ? [] : ['clipboard-read', 'clipboard-write'] });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  if (opts.clavierRefuse) await pg.addInitScript(() => { try { Object.defineProperty(navigator, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('refusé', 'NotAllowedError')) }) }); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  await pg.route('**/rest/v1/**', (route) => {
    const u = decodeURIComponent(metaVersData(route.request().url()));
    const j = (d) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
    if (route.request().method() !== 'GET') return j([]);
    if (/select=owner/.test(u)) return route.fulfill({ status: 400, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"m":1}' });
    if (/\/rest\/v1\/vinted_accounts/.test(u)) return j(ACCOUNTS);
    const sel = (/[?&]select=([^&]*)/.exec(u) || [])[1] || null;
    const forme = (r) => (sel && sel !== 'data,updated_at,cap:data->>capturedAt' && !/^id,data/.test(sel)) ? projette(r, sel) : ({ ...r, updated_at: new Date(MAINTENANT).toISOString(), cap: r.data.capturedAt });
    const eq = /id=eq\.([^&]*)/.exec(u);
    if (eq) return j(ROWS.filter((r) => r.id === eq[1]).map(forme));
    const lk = /id=like\.([^&]*)/.exec(u);
    if (lk) { const re = new RegExp('^' + lk[1].replace(/[.]/g, '\\.').replace(/[*%]/g, '.*') + '$'); return j(ROWS.filter((r) => re.test(r.id)).map(forme)); }
    return j([]);
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  return { ctx, pg, errs };
}

async function ordreEnRoute(pg) {
  await pg.goto(`http://localhost:${PORT}/?tab=cat_achats&vue=achats`, { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(900);
  const b = pg.locator('button', { hasText: /^En route/ });
  await b.first().waitFor({ timeout: 10000 }); await b.first().click();
  await pg.locator('[data-achat-tx]').first().waitFor({ timeout: 10000 });
  await pg.waitForTimeout(400);
  return pg.evaluate(() => { const vu = []; for (const e of document.querySelectorAll('[data-achat-tx]')) { const t = e.getAttribute('data-achat-tx'); if (!vu.includes(t)) vu.push(t); } return vu; });
}

async function main() {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
    for (const vp of [{ width: 390, height: 780 }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '📱' : '🖥️';
      await essaie(`${T} ordre`, async () => {
        const { ctx, pg } = await preparer(b, vp);
        const o = await ordreEnRoute(pg);
        const vus = o.filter((x) => ATTENDU.includes(x));
        dit(vus.join(',') === ATTENDU.join(','), `${T} « En route » : le plus récent en haut, comptes mêlés`, vus.join(','));
        // Le compte du plus ANCIEN choisi : l'ordre ne change pas.
        const sel = pg.locator('select').filter({ has: pg.locator('option[value="111"]') });
        if (await sel.count()) {
          await sel.first().selectOption('111'); await pg.waitForTimeout(500);
          const o2 = (await pg.evaluate(() => { const vu = []; for (const e of document.querySelectorAll('[data-achat-tx]')) { const t = e.getAttribute('data-achat-tx'); if (!vu.includes(t)) vu.push(t); } return vu; })).filter((x) => ATTENDU.includes(x));
          dit(o2.length < 2 || o2.join(',') === ATTENDU.filter((x) => o2.includes(x)).join(','), `${T} compte choisi : toujours le plus récent en haut`, o2.join(','));
        }
        if (process.env.CAPTURES) await pg.screenshot({ path: path.join(process.env.CAPTURES, `achats-en-route-${vp.width}.png`) });
        await ctx.close();
      });
    }
  } finally { if (b) await b.close(); srv.close(); }
  console.log(ko ? `\n❌ achats en route : ${ko} rouge(s).` : `\n✅ achats en route : le plus récent en haut`);
  process.exit(ko ? 1 : 0);
}
main();
