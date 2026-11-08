// ════════════════════════════════════════════════════════════════════════════
//  Mesure du DÉMARRAGE (8 nov., chantier « démarrage-lectures »).
//  node scripts/bancs/_mesure-demarrage.cjs <dist> [port]
//  Téléphone 390 px tactile, 4G (9 Mb/s, 60 ms), processeur ×4 (CPU=n pour changer),
//  base inventée au poids réel (_base-volume, fabriquer({volumeReel:true})).
//  Prêt = `[data-attente]` vaut « pret » (ou « plafond ») et l'écran de démarrage
//  est parti — le signal du banc `chargement.cjs`. Calme = aucune lecture depuis 3 s.
//  TABS=journee,colis,ventes ; DETAIL=<préfixe> écrit la liste des requêtes (URL,
//  octets, départ, arrivée, pile d'appel) dans <préfixe>-<onglet>.json.
//  REPRISE=1 : ouvre l'onglet DEUX fois dans le même navigateur (2e ouverture).
//  Rien de réel : la base est inventée ; aucune écriture n'arrive nulle part.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: process.env.QR !== '0' });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || 9610);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
}).listen(PORT);
const court = u => { try { return decodeURIComponent(u.replace(/^.*\/rest\/v1\//, '')); } catch { return u; } };
const attendre = ms => new Promise(r => setTimeout(r, ms));

async function ouvrir(ctx, tab, etiquette) {
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  if (process.env.PILE) { await cdp.send('Debugger.enable'); await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 40 }); }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  const init = {};
  cdp.on('Network.requestWillBeSent', e => {
    if (!/rest\/v1/.test(e.request.url)) return;
    const fr = []; let s = e.initiator && e.initiator.stack;
    while (s && fr.length < 16) { for (const c of s.callFrames || []) if (c.functionName) fr.push(c.functionName + ':' + (c.lineNumber + 1)); s = s.parent; }
    (init[e.request.url] = init[e.request.url] || []).push(fr.slice(0, 16));
  });
  const reqs = []; const t0 = Date.now();
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, r => r.abort());
  await pg.route('**/rest/v1/**', async route => {
    const rq = route.request(); const rec = { t: Date.now() - t0, m: rq.method(), u: rq.url() }; reqs.push(rec);
    if (rq.method() !== 'GET') { try { const j = JSON.parse(rq.postData() || 'null'); rec.u += ' ⇐ ' + (Array.isArray(j) ? j : [j]).map(x => x && x.id).join(','); } catch (_) {} rec.o = 2; rec.f = rec.t; return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }); }
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body); rec.o = Buffer.byteLength(body);
    await attendre(80); rec.f = Date.now() - t0;
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body });
  });
  await pg.route('**/api/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`, { waitUntil: 'commit' });
  let tPret = null, etat = ''; const etats = []; const fin = t0 + 90000;
  while (Date.now() < fin) {
    const e2 = await pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const ae = document.querySelector('[data-attente]'); return [(d ? 'D' : '') + (ae ? ae.getAttribute('data-attente') : '-'), ae ? (ae.getAttribute('data-attente-manque') || '') : '']; }).catch(() => ['?', '']);
    if (e2.join('|') !== etats.length && (etats[etats.length - 1] || {}).e !== e2.join('|')) etats.push({ t: Date.now() - t0, e: e2.join('|') });
    etat = e2[0];
    if (etat === 'pret' || etat === 'plafond') { tPret = Date.now() - t0; break; }
    await attendre(100);
  }
  let n = reqs.length, tCalme = Date.now();
  while (Date.now() - tCalme < 3000 && Date.now() < fin + 30000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tCalme = Date.now(); } }
  const m = await pg.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const js = res.filter(r => /\.(js|css)(\?|$)/.test(r.name)).reduce((a, r) => a + (r.encodedBodySize || 0), 0);
    return { jsKo: Math.round(js / 1024), lt: window.__lt || [] };
  });
  const avant = reqs.filter(r => tPret != null && r.t <= tPret);
  const lec = reqs.filter(r => r.m === 'GET');
  const res = {
    tab: etiquette, etat, pret_ms: tPret, calme_ms: tCalme - t0,
    lectures: lec.length, ecritures: reqs.length - lec.length,
    Ko: Math.round(lec.reduce((a, r) => a + (r.o || 0), 0) / 1024),
    lecturesAvantPret: avant.filter(r => r.m === 'GET').length,
    KoAvantPret: Math.round(avant.filter(r => r.m === 'GET').reduce((a, r) => a + (r.o || 0), 0) / 1024),
    lecturesIdentiques: lec.length - new Set(lec.map(r => r.u)).size,
    premiereLecture: (reqs[0] || {}).t, jsKo: m.jsKo, longues_ms: m.lt.reduce((a, x) => a + x[1], 0), longues_n: m.lt.length, plusLongue: Math.max(0, ...m.lt.map(x => x[1])),
  };
  if (process.env.EVAL) res.eval = await pg.evaluate(process.env.EVAL).catch(e => String(e));
  if (process.env.ETATS) res.etats = etats.map(x => x.t + ':' + x.e).join(' ; ');
  if (process.env.DETAIL) {
    const det = reqs.map(r => ({ t: r.t, f: r.f, m: r.m, o: r.o, u: court(r.u), qui: (init[r.u] || []).shift() }));
    fs.writeFileSync(process.env.DETAIL + '-' + etiquette + '.json', JSON.stringify(det, null, 1));
  }
  await pg.close();
  return res;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  for (const tab of (process.env.TABS || 'journee,colis,ventes').split(',')) {
    const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => {
      localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
      window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true });
    });
    console.log(JSON.stringify(await ouvrir(ctx, tab, tab)));
    if (process.env.REPRISE) console.log(JSON.stringify(await ouvrir(ctx, tab, tab + '-2e')));
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
