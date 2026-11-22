// Sonde (latence, 22 nov.) : le coût de STYLE d'un toucher d'onglet, par sélecteur (trace « SelectorStats » de Chromium).
//   node scripts/bancs/_sonde-style.cjs <dist> <onglet> [port]   FORMAT=tel|ordi · CPU=4
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
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
  const pg = await ctx.newPage(); const cdp = await ctx.newCDPSession(pg);
  const sel = (o) => `[data-n-onglet="${o}"]:visible, [data-nav-entree="${o}"]:visible`;
  const aller = async (o) => { await pg.locator(sel(o)).first()[tel ? 'tap' : 'click']({ timeout: 20000 }); await pg.waitForSelector(`[data-attente-ecran="${o}"][data-attente="pret"]`, { timeout: 60000, state: 'visible' }).catch(() => {}); await attendre(6000); };
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForSelector(`[data-attente-ecran="journee"][data-attente="pret"]`, { timeout: 90000, state: 'attached' }).catch(() => {});
  await attendre(10000);
  await aller(TAB); await aller('journee'); await aller(TAB); await aller('journee');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  const fichier = path.join(os.tmpdir(), 'sonde-style-' + process.pid + '.json');
  await nav.startTracing(pg, { path: fichier, categories: process.env.STATS === '0' ? ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'v8.execute'] : ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'disabled-by-default-blink.debug'] });
  await aller(TAB);
  await nav.stopTracing();
  const tr = JSON.parse(fs.readFileSync(fichier, 'utf8')); const ev = tr.traceEvents || tr;
  const prin = ev.find((e) => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain'); const tid = prin && prin.tid;
  const dur = new Map(); for (const e of ev) if (e.ph === 'X' && e.dur && (!tid || e.tid === tid)) dur.set(e.name, (dur.get(e.name) || 0) + e.dur);
  if (process.env.STATS === '0') { const fn = new Map(); for (const e of ev) if (e.ph === 'X' && e.dur && e.tid === tid && e.name === 'FunctionCall' && e.args && e.args.data) { const k = (e.args.data.functionName || '?') + '@' + String(e.args.data.url || '').split('/').pop() + ':' + e.args.data.lineNumber; fn.set(k, (fn.get(k) || 0) + e.dur); } console.log('Appels JS (ms) : ' + [...fn].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + Math.round(v / 1000)).join(' · ')); }
  console.log('Durées (ms) : ' + [...dur].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => k + ' ' + Math.round(v / 1000)).join(' · '));
  const S = new Map();
  for (const e of ev) { const st = e.args && (e.args.selector_stats || (e.args.data && e.args.data.selector_stats)); if (!st) continue; for (const x of st.selector_timings || []) { const k = x.selector; const o = S.get(k) || { us: 0, essais: 0, ok: 0 }; o.us += x['elapsed (us)'] || 0; o.essais += x.match_attempts || 0; o.ok += x.match_count || 0; S.set(k, o); } }
  const tot = [...S.values()].reduce((a, x) => a + x.us, 0);
  console.log(`Sélecteurs : ${S.size} · temps de correspondance total ${Math.round(tot / 1000)} ms`);
  for (const [k, o] of [...S].sort((a, b) => b[1].us - a[1].us).slice(0, Number(process.env.TOP || 30))) console.log(`  ${Math.round(o.us / 100) / 10} ms · ${o.essais} essais · ${o.ok} ok · ${k.slice(0, 230)}`);
  try { fs.unlinkSync(fichier); } catch (_) {}
  await nav.close(); process.exit(0);
})();
