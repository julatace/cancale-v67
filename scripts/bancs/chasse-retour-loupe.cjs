// Repro : Annonces → 1re rangée → Échap → la loupe s'ouvre-t-elle avec le N° ? Puis Argent.
// node repro-loupe.cjs <racine du dépôt> <dist> <largeur> <préfixe des captures>
const path = require('path');
const RAC = process.argv[2];
require(path.join(RAC, 'scripts/bancs/_porte-banc.cjs'));
const http = require('http'), fs = require('fs'); const { chromium } = require(path.join(RAC, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(RAC, 'scripts/bancs/_base-volume.cjs'));
const DIST = process.argv[3]; const W = Number(process.argv[4] || 390); const OUT = process.argv[5];
const srv = http.createServer((q, r) => { let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.webp': 'image/webp', '.wasm': 'application/wasm', '.mjs': 'text/javascript' }[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r); });
(async () => {
  await new Promise((r) => srv.listen(0, r)); const U = 'http://localhost:' + srv.address().port;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const base = fabriquer({ volumeReel: true, annonces: 1000 });
  const ctx = await nav.newContext({ viewport: { width: W, height: W < 600 ? 844 : 950 }, isMobile: W < 600, hasTouch: W < 600, locale: 'fr-FR', serviceWorkers: 'block' }); const pg = await ctx.newPage();
  await pg.addInitScript(() => { localStorage.setItem('vrm_acces_direct', '1'); });
  await pg.route(/^https?:\/\/(?!localhost)/, (r) => (/supabase/.test(r.request().url()) ? r.fallback() : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') return route.fulfill({ status: 201, body: '[]', contentType: 'application/json' }); const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }); });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: /abonnement/.test(r.request().url()) ? '{"ok":true,"acces":true,"statut":"active","configure":true}' : '{"pret":true,"devices":1}' }));
  await pg.goto(U + '/?tab=journee'); await pg.waitForTimeout(8000); await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=annonces' }))); await pg.waitForTimeout(4000); await pg.screenshot({ path: OUT + '-avant.png' });
  const loupe = () => pg.evaluate(() => { const i = [...document.querySelectorAll('input')].find((x) => x.value && /\d/.test(x.value)); return i ? i.value : ''; });
  const rang = pg.locator('.vrm-main [data-vn-rang], .vrm-main [data-fiche-ligne], .vrm-main .n-rangee[role="button"], .vrm-main [data-eg-article]').filter({ visible: true }).first();
  console.log('rangée :', await rang.evaluate((e) => e.outerHTML.slice(0, 160)).catch(() => '?'));
  await rang.click(); await pg.waitForTimeout(1500); console.log('après clic, loupe =', JSON.stringify(await loupe()));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(1200); console.log('après Échap, loupe =', JSON.stringify(await loupe()));
  await pg.screenshot({ path: OUT + '-echap.png' });
  await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=compta' }))); await pg.waitForTimeout(2500);
  console.log('sur Argent, loupe =', JSON.stringify(await loupe()));
  await pg.screenshot({ path: OUT + '-argent.png' });
  await nav.close(); srv.close();
})();
