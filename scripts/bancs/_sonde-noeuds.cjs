// Sonde (latence, 22 nov.) : où sont les nœuds d'un écran. node scripts/bancs/_sonde-noeuds.cjs <dist> <onglet> [port]  FORMAT=tel|ordi
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2]); const TAB = process.argv[3] || 'achats'; const PORT = +(process.argv[4] || 20000 + Math.floor(Math.random() * 9000));
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
http.createServer((q, r) => { let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html'; const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p)); }).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const tel = (process.env.FORMAT || 'tel') === 'tel';
  const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR' } : { viewport: { width: 1512, height: 945 }, locale: 'fr-FR' });
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) }); });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }));
  const pg = await ctx.newPage();
  await pg.goto(`http://localhost:${PORT}/?tab=${TAB}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForSelector(`[data-attente-ecran="${TAB}"][data-attente="pret"]`, { timeout: 90000, state: 'attached' }).catch(() => console.log('pas prêt'));
  await attendre(Number(process.env.ATTENTE || 12000));
  const r = await pg.evaluate(() => {
    const out = []; const n = (e) => e.getElementsByTagName('*').length;
    const desc = (e) => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + [...e.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 3).map((a) => `[${a.name}=${a.value.slice(0, 20)}]`).join('');
    const main = document.querySelector('.vrm-main') || document.body;
    const visiter = (e, prof) => { const kids = [...e.children]; const big = kids.filter((k) => n(k) > 150);
      if (kids.length > 15) { const cls = new Map(); for (const k of kids) { const d = desc(k).replace(/\[data-[^\]]*id[^\]]*\]/g, ''); cls.set(d, (cls.get(d) || 0) + 1); } out.push('  '.repeat(prof) + desc(e) + ' : ' + n(e) + ' nœuds, ' + kids.length + ' enfants · ' + [...cls].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => v + '× ' + k + ' (~' + Math.round(n(kids.find((x) => desc(x).replace(/\[data-[^\]]*id[^\]]*\]/g, '') === k)) + 1) + ')').join(' ; ')); return; }
      for (const k of big) { out.push('  '.repeat(prof) + desc(k) + ' : ' + n(k)); if (prof < 14) visiter(k, prof + 1); } };
    out.push('TOTAL ' + document.getElementsByTagName('*').length + ' · main ' + n(main) + ' · hauteur ' + main.scrollHeight);
    visiter(main, 0); return out.join('\n');
  });
  console.log(r); await nav.close(); process.exit(0);
})();
