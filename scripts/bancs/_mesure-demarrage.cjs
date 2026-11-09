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
//  PROFIL=<préfixe> (9 nov.) : profil CPU (CDP, 500 µs) du démarrage jusqu'au calme,
//  agrégé par fonction:ligne (propre et inclusif) dans <préfixe>-<onglet>.json — build
//  NON minifié pour des noms lisibles (npx vite build --minify false --outDir …).
//  PROFIL_BRUT=1 : écrit aussi le profil brut (<préfixe>-<onglet>.cpuprofile, DevTools).
//  TRACE=<préfixe> (9 nov.) : trace Chrome du démarrage (<préfixe>-<onglet>.json).
//  RENDUS=1 (9 nov.) : crochet React posé avant l'app — chaque rendu validé et chaque
//  rendu de `Comptabilite` (le moteur de Ma journée) avant « prêt », avec son heure
//  (diagnostic : le parcours de l'arbre à chaque validation ralentit la page).
//  COMPLET=1 (9 nov.) : ouvert au plafond (~2,5 s), l'heure où TOUTES ses données
//  essentielles sont arrivées (`complet_ms`, l'attribut passe à « pret »).
//  JALONS=1 (9 nov.) : les marques `vrm:*` posées par l'app (performance.mark) et les
//  tâches longues avant « prêt », dans le résultat.
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
function agreger(profil) {
  const parId = new Map(); for (const n of profil.nodes) parId.set(n.id, n);
  const propre = new Map(), inclusif = new Map();
  const dt = profil.timeDeltas || []; const echant = profil.samples || [];
  const parent = new Map(); for (const n of profil.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const nom = n => (n.callFrame.functionName || '(anonyme)') + ':' + (n.callFrame.lineNumber + 1) + '@' + path.basename(n.callFrame.url || '?').replace(/-[A-Za-z0-9_-]{8}\.js$/, '');
  for (let i = 0; i < echant.length; i++) {
    const ms = (dt[i + 1] || dt[i] || 0) / 1000; let id = echant[i]; const n0 = parId.get(id);
    if (!n0 || /^\((idle|program|garbage collector)\)$/.test(n0.callFrame.functionName)) continue;
    propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms);
    const vus = new Set();
    while (id != null) { const n = parId.get(id); const k = nom(n); if (!vus.has(k)) { vus.add(k); inclusif.set(k, (inclusif.get(k) || 0) + ms); } id = parent.get(id); }
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, ms]) => [f, Math.round(ms)]);
  return { propre: top(propre, 60), inclusif: top(inclusif, 150) };
}

async function ouvrir(ctx, tab, etiquette) {
  const pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  if (process.env.PILE) { await cdp.send('Debugger.enable'); await cdp.send('Debugger.setAsyncCallStackDepth', { maxDepth: 40 }); }
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  if (process.env.PROFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  if (process.env.TRACE) await ctx.browser().startTracing(pg, { path: process.env.TRACE + '-' + etiquette + '.json', categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8.execute', 'v8', 'disabled-by-default-v8.compile'] });
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
  // COMPLET=1 (9 nov.) : ouvert au plafond, quand TOUTES ses données essentielles sont-elles là ?
  let tComplet = etat === 'pret' ? tPret : null;
  if (process.env.COMPLET && etat === 'plafond') { while (Date.now() < fin + 20000) { const e3 = await pg.evaluate(() => { const ae = document.querySelector('[data-attente]'); return ae ? ae.getAttribute('data-attente') : '-'; }).catch(() => '?'); if (e3 === 'pret') { tComplet = Date.now() - t0; break; } await attendre(100); } }
  let n = reqs.length, tCalme = Date.now();
  while (Date.now() - tCalme < 3000 && Date.now() < fin + 30000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tCalme = Date.now(); } }
  const m = await pg.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const js = res.filter(r => /\.(js|css)(\?|$)/.test(r.name)).reduce((a, r) => a + (r.encodedBodySize || 0), 0);
    return { jsKo: Math.round(js / 1024), lt: window.__lt || [] };
  });
  if (process.env.TRACE) await ctx.browser().stopTracing();
  if (process.env.PROFIL) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL + '-' + etiquette + '.json', JSON.stringify(agreger(profile), null, 1)); if (process.env.PROFIL_BRUT) fs.writeFileSync(process.env.PROFIL + '-' + etiquette + '.cpuprofile', JSON.stringify(profile)); }
  const jalons = process.env.JALONS ? await pg.evaluate((tp) => ({ marques: performance.getEntriesByType('mark').filter(m => /^vrm:/.test(m.name)).map(m => m.name.replace(/^vrm:/, '') + '@' + Math.round(m.startTime)).join(' '), longues: (window.__lt || []).filter(x => tp == null || x[0] < tp).map(x => x[0] + '+' + x[1]).join(' ') }), tPret).catch(() => null) : null;
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
  if (jalons) res.jalons = jalons;
  if (process.env.COMPLET) res.complet_ms = tComplet;
  if (process.env.RENDUS) res.rendus = await pg.evaluate((tp) => ({ commits: (window.__commits || []).filter(t => t <= tp).length, compta: (window.__compta || []).filter(t => parseInt(t, 10) <= tp).join(' ') }), tPret || 1e9).catch(() => null);
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
    if (process.env.JALONS) await ctx.addInitScript(() => { window.addEventListener('vrm:save', (e) => { try { const k = e && e.detail && e.detail.k; if (k) performance.mark('vrm:save:' + (e.detail.distant ? '~' : '') + k); } catch (_) {} }); });
    if (process.env.RENDUS) await ctx.addInitScript(() => {
      window.__commits = []; window.__compta = [];
      const estCompta = (p) => p && typeof p === 'object' && 'only' in p && 'accounts' in p && 'garageGrid' in p;
      const vus = new WeakMap();
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), isDisabled: false, inject() { return 1; }, checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
        onCommitFiberRoot(id, root) { const t = Math.round(performance.now()); window.__commits.push(t); try { const pile = [root.current]; while (pile.length) { const f = pile.pop(); if (!f) continue; if (f.child) pile.push(f.child); if (f.sibling) pile.push(f.sibling); if (estCompta(f.memoizedProps)) { const av = vus.has(f) ? vus.get(f) : (f.alternate && vus.has(f.alternate) ? vus.get(f.alternate) : undefined); if (av === undefined || av !== f.memoizedState) window.__compta.push(t + (av === undefined ? 'm' : '')); vus.set(f, f.memoizedState); if (f.alternate) vus.set(f.alternate, f.memoizedState); } } } catch (_) {} } };
    });
    console.log(JSON.stringify(await ouvrir(ctx, tab, tab)));
    if (process.env.REPRISE) console.log(JSON.stringify(await ouvrir(ctx, tab, tab + '-2e')));
    await ctx.close();
  }
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });
