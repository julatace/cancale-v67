// ════════════════════════════════════════════════════════════════════════════
//  Mesure des CHANGEMENTS D'ONGLET (8 nov., chantier « vitesse-calcul-partage »).
//  node scripts/bancs/_mesure-onglets.cjs <dist> [port]
//  Téléphone 390 px tactile, 4G (9 Mb/s, 60 ms), processeur ×4 (CPU=n), base inventée
//  au poids réel (_base-volume, fabriquer({volumeReel:true, qr:true})) — la méthode de
//  docs/passation/2026-11-07-vitesse.md et de _mesure-demarrage.cjs.
//  Ouvre Ma journée, attend « prêt » puis le calme, puis touche la barre du bas dans
//  l'ordre SUITE (défaut : Colis, Ventes, Annonces, Journée, Colis, Ventes, Annonces,
//  Journée — deux tours : le 2e tour revient sur des écrans DÉJÀ VUS).
//  Par toucher : `affiche_ms` = du toucher à la première image où l'écran visé est
//  posé (`[data-attente-ecran=<onglet>]` à « pret »/« plafond », visible) ;
//  `squelette` = un squelette est apparu pendant ce changement ; `longues_ms` = tâches
//  longues cumulées dans la fenêtre (FENETRE ms, défaut 6000) ; `calme_ms` = fin de la
//  dernière tâche longue de la fenêtre.
//  PROFIL=<fichier> : profil CPU (CDP, 500 µs) de chaque changement, agrégé par
//  fonction:ligne (temps propre et inclusif), écrit en JSON (build NON minifié pour
//  des noms lisibles : npx vite build --minify false --outDir …).
//  REDUIT=1 : « réduire les animations » (ni fondu, ni fondu enchaîné : le calcul seul).
//  Rien de réel : la base est inventée ; aucune écriture n'arrive nulle part.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: process.env.QR !== '0' });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || 9620);
const SUITE = (process.env.SUITE || 'cat_bord,ventes,annonces,journee,cat_bord,ventes,annonces,journee').split(',');
const FENETRE = +(process.env.FENETRE || 6000);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
}).listen(PORT);
const attendre = ms => new Promise(r => setTimeout(r, ms));

function agreger(profil) {
  const parId = new Map(); for (const n of profil.nodes) parId.set(n.id, n);
  const propre = new Map(), inclusif = new Map();
  const dt = profil.timeDeltas || []; const echant = profil.samples || [];
  const parent = new Map(); for (const n of profil.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const nom = n => (n.callFrame.functionName || '(anonyme)') + ':' + (n.callFrame.lineNumber + 1) + (/App-/.test(n.callFrame.url) ? '' : '@' + path.basename(n.callFrame.url || '?').replace(/-[A-Za-z0-9_]{8}\.js$/, ''));
  for (let i = 0; i < echant.length; i++) {
    const ms = (dt[i + 1] || dt[i] || 0) / 1000; let id = echant[i]; const n0 = parId.get(id);
    if (!n0 || /^\((idle|program|garbage collector)\)$/.test(n0.callFrame.functionName)) continue;
    propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms);
    const vus = new Set();
    while (id != null) { const n = parId.get(id); const k = nom(n); if (!vus.has(k)) { vus.add(k); inclusif.set(k, (inclusif.get(k) || 0) + ms); } id = parent.get(id); }
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, ms]) => [f, Math.round(ms)]);
  return { propre: top(propre, 40), inclusif: top(inclusif, 80) };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: process.env.REDUIT ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((DEBUG_GARDE) => {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
    window.__sq = 0; window.__saves = [];
    if (DEBUG_GARDE) window.__vrmGardeDebug = true;
    window.addEventListener('vrm:save', (e) => { const d = e && e.detail; if (d && d.k) window.__saves.push((d.distant ? '~' : '') + d.k); });
    new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) { if (n instanceof Element && (n.matches('[data-demarrage-attente]') || n.querySelector('[data-demarrage-attente]'))) window.__sq++; } }).observe(document, { childList: true, subtree: true });
  }, !!process.env.DEBUG_GARDE);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', e => erreurs.push(e.message));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  if (process.env.PROFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); }
  const reqs = []; const ecritures = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, r => r.abort());
  await pg.route('**/rest/v1/**', async route => {
    const rq = route.request(); reqs.push({ t: Date.now(), m: rq.method(), u: rq.url() });
    if (rq.method() !== 'GET') { let ids = ''; try { const j = JSON.parse(rq.postData() || 'null'); ids = (Array.isArray(j) ? j : [j]).map(x => x && x.id).join(','); } catch (_) {} ecritures.push({ t: Date.now(), u: rq.url().replace(/^.*\/rest\/v1\//, ''), ids }); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    await attendre(80);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  const pret = async (tab, fin) => { while (Date.now() < fin) { const ok = await pg.evaluate((t) => { const d = document.getElementById('vrm-demarrage'); const e = [...document.querySelectorAll(`[data-attente-ecran="${t}"]`)].find(x => !x.closest('[hidden],[data-ecran-cache]') && x.style.display !== 'none'); return !d && !!e && /pret|plafond/.test(e.getAttribute('data-attente') || ''); }, tab).catch(() => false); if (ok) return true; await attendre(100); } return false; };
  await pret('journee', t0 + 90000);
  const demarrage = Date.now() - t0;
  // calme : aucune lecture depuis 3 s
  let n = reqs.length, tc = Date.now(); while (Date.now() - tc < 3000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tc = Date.now(); } }
  await attendre(1500);
  console.log(JSON.stringify({ demarrage_ms: demarrage, lectures_demarrage: reqs.filter(r => r.m === 'GET').length }));
  const resultats = []; const profils = [];
  for (let i = 0; i < SUITE.length; i++) {
    const tab = SUITE[i];
    const r0 = reqs.length, e0 = ecritures.length;
    if (process.env.PROFIL) await cdp.send('Profiler.start');
    const tracer = process.env.TRACE && i === SUITE.length - 1 - (+process.env.TRACE_RECUL || 0);
    if (tracer) await b.startTracing(pg, { path: process.env.TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink'] });
    await pg.evaluate((t) => {
      window.__sq = 0; window.__tf = null; window.__saves = []; window.__lt0 = performance.now();
      const visee = t;
      const regarder = () => { const e = [...document.querySelectorAll(`[data-attente-ecran="${visee}"]`)].find(x => !x.closest('[hidden],[data-ecran-cache]') && x.style.display !== 'none'); if (e && /pret|plafond/.test(e.getAttribute('data-attente') || '')) { window.__tf = performance.now() - window.__lt0; return; } requestAnimationFrame(regarder); };
      requestAnimationFrame(regarder);
    }, tab);
    await pg.locator(`.vrm-tabbar [data-nav-entree="${tab}"]`).click();
    await attendre(FENETRE);
    if (tracer) await b.stopTracing();
    if (process.env.PROFIL) { const { profile } = await cdp.send('Profiler.stop'); profils.push({ tab, i, ...agreger(profile) }); }
    const m = await pg.evaluate(() => { const lt = window.__lt.filter(x => x[0] >= window.__lt0 - 5); return { affiche_ms: window.__tf == null ? null : Math.round(window.__tf), squelettes: window.__sq, longues_ms: Math.round(lt.reduce((a, x) => a + x[1], 0)), plusLongue: Math.round(Math.max(0, ...lt.map(x => x[1]))), calme_ms: lt.length ? Math.round(Math.max(...lt.map(x => x[0] + x[1])) - window.__lt0) : 0, saves: [...new Set(window.__saves)].join(' ') }; });
    const lec = reqs.slice(r0).filter(r => r.m === 'GET').length;
    const res = { tour: i < SUITE.length / 2 ? 1 : 2, tab, ...m, lectures: lec, ecritures: ecritures.slice(e0).map(e => e.ids || e.u).join(' ') };
    resultats.push(res); console.log(JSON.stringify(res));
  }
  if (process.env.EVAL) console.log('EVAL ' + JSON.stringify(await pg.evaluate(process.env.EVAL).catch(e => String(e))));
  if (process.env.PROFIL) fs.writeFileSync(process.env.PROFIL, JSON.stringify(profils, null, 1));
  if (erreurs.length) console.log('ERREURS ' + JSON.stringify(erreurs.slice(0, 5)));
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
