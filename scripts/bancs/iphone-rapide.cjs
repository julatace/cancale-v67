// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'APP RAPIDE SUR IPHONE » (20 nov. — Julien : « on peut faire l'app iPhone mais elle est trop lente »).
//  Récit et chiffres : docs/passation/2026-11-20-iphone-rapide.md.
//
//    node scripts/bancs/iphone-rapide.cjs <dist> [port]
//    CPU=4 (×4 par défaut ; 6 = un iPhone plus ancien) · JSON=<fichier> (relevé complet) · TOURS=1 · ETAPES=demarrage,onglets,defilement
//
//  COMME UN IPHONE : Chromium, 390 × 844, densité 3, tactile, mobile, processeur ×CPU (CDP), réseau 4G réaliste pour les
//  fichiers de l'app (CDP : 150 ms d'aller-retour, 9 Mbit/s descendant, 3 Mbit/s montant) ; la base est servie par le banc
//  avec le même aller-retour et le même débit (150 ms + taille / 9 Mbit/s). Service worker AUTORISÉ (c'est lui qui sert
//  les ouvertures suivantes). Base INVENTÉE au volume de Julien (`_base-volume`) : 7 comptes, ≈ 1 200 annonces,
//  1 500 ventes, 800 achats, 350 conversations, bordereaux avec PDF. Rien de réel ; aucune écriture ne sort.
//
//  Ce qui est mesuré (dans la page, depuis le début de la navigation, `performance.now()`) :
//    · démarrage à froid (appareil neuf, rien en cache) puis ouverture suivante (même appareil, service worker actif,
//      page neuve) : 1re peinture · coque (barre d'onglets) · écran utile (`data-attente="pret"` d'Aujourd'hui) ·
//      chiffres d'Aujourd'hui lus (`data-v2-chiffres="lu"`) ; octets de JS/CSS reçus ; tâches longues avant l'écran utile ;
//    · changement d'onglet (les 5 onglets, deux tours, + « Plus », + une fiche d'Annonces et le retour) : TEMPS DE FIL du
//      fil principal (somme des `tdur` des tâches de la trace Chrome, du toucher au calme — c'est le CPU, ralentissement
//      compris, insensible à la charge de la machine partagée), plus longue tâche, temps jusqu'à l'écran visé (mur) ;
//    · défilement d'Annonces et de Ventes (geste tactile synthétisé, 6 balayages) : images par seconde, tâches longues
//      (> 50 ms) et la plus longue ;
//    · mémoire : tas JS utilisé et nœuds du document après chaque étape (CDP Performance.getMetrics).
//  Il ne juge rien : il RAPPORTE (« un banc ne meurt pas, il rapporte »). Les objectifs du chantier sont rappelés à côté.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const CPU = +(process.env.CPU || 4);
const RTT = 150, DEBIT = Number(process.env.MBIT || 9) * 1e6 / 8;   // octets/s (MBIT=1.6 : la 4G lente de Lighthouse)
const RESEAU = { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: Math.min(3e6, DEBIT * 8 / 2) / 8 };
let LECTURES = []; let T_NAV = 0;
const ETAPES = String(process.env.ETAPES || 'demarrage,onglets,defilement').split(',');
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Les fichiers de l'app, comme Vercel : compressés, /assets immuables, index.html jamais en cache ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const gz = new Map();
let servis = [];
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { if (process.env.DEBUG) console.log('  (404 ' + q.url + ')'); r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) {
    if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 9 }));
    const b = gz.get(p); servis.push({ f, o: b.length, sw: q.headers['service-worker'] === 'script' || q.headers['sec-fetch-dest'] === 'empty' });
    r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(b);
  }
  const b = fs.readFileSync(p); servis.push({ f, o: b.length });
  r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(b);
}).listen(PORT);

// ── Dans la page, avant tout script : les jalons et les tâches longues ──
function jalons() {
  const J = { coque: null, utile: null, chiffres: null, fcp: null, longues: [] };
  window.__vrmIphone = J;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) J.longues.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') J.fcp = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true }); } catch (_) {}
  const voir = () => {
    const t = Math.round(performance.now());
    if (J.coque == null && document.querySelector('[data-n-onglets] [data-n-onglet]')) J.coque = t;
    if (J.utile == null && document.querySelector('[data-attente-ecran="journee"][data-attente="pret"], [data-attente-ecran="journee"][data-attente="plafond"]')) J.utile = t;
    if (J.chiffres == null && document.querySelector('[data-v2-chiffres="lu"], [data-vendu-mois]:not([data-vendu-mois=""])')) J.chiffres = t;
  };
  // Les chiffres d'Aujourd'hui (« Vendu · mois » suivi d'un montant) : lus dans le texte, toutes les 100 ms.
  const iv = setInterval(() => { if (J.chiffres != null) return clearInterval(iv); const m = document.querySelector('main') || document.body; if (m && /Vendu\s*·\s*mois\s*[\d\s\u202f\u00a0]+(,\d+)?\s*€/.test(m.innerText || '')) J.chiffres = Math.round(performance.now()); }, 100);
  document.addEventListener('DOMContentLoaded', () => { voir(); new MutationObserver(voir).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-attente', 'data-v2-chiffres'] }); });
}

async function preparer(ctx) {
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await ctx.addInitScript(jalons);
  // Photos de Vinted : coupées (le banc ne joint rien) ; l'app montre son pictogramme.
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') { await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    const debut = Date.now() - T_NAV;
    await attendre(RTT + Math.round(body.length / DEBIT * 1000));
    LECTURES.push({ u: decodeURIComponent(rq.url().replace(/^.*\/rest\/v1\//, '')).slice(0, 140), o: body.length, d: debut, f: Date.now() - T_NAV });
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
  });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
}
async function cdpDe(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RESEAU);
  await cdp.send('Performance.enable');
  return cdp;
}
async function memoire(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { tasMo: Math.round(m.JSHeapUsedSize / 1048576 * 10) / 10, noeuds: m.Nodes, ecouteurs: m.JSEventListeners };
}

// Profil CPU agrégé par fonction (propre et inclusif) — PROFIL=<fichier> PROFIL_QUAND=froid|'chaud 2'.
function agreger(profil) {
  const parId = new Map(); for (const n of profil.nodes) parId.set(n.id, n);
  const parent = new Map(); for (const n of profil.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const propre = new Map(), inclusif = new Map();
  const nom = (n) => (n.callFrame.functionName || '(anonyme)') + ':' + (n.callFrame.lineNumber + 1) + ':' + (n.callFrame.columnNumber + 1) + '@' + path.basename(n.callFrame.url || '?');
  const dt = profil.timeDeltas || [], ech = profil.samples || [];
  for (let i = 0; i < ech.length; i++) {
    const ms = (dt[i + 1] || dt[i] || 0) / 1000; let id = ech[i]; const n0 = parId.get(id);
    if (!n0 || /^\((idle|program)\)$/.test(n0.callFrame.functionName)) continue;
    propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms);
    const vus = new Set();
    while (id != null) { const n = parId.get(id); const k = nom(n); if (!vus.has(k)) { vus.add(k); inclusif.set(k, (inclusif.get(k) || 0) + ms); } id = parent.get(id); }
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, ms]) => [f, Math.round(ms)]);
  return { propre: top(propre, 80), inclusif: top(inclusif, 200) };
}

// ── Une ouverture : de la navigation à l'écran utile, puis au calme ──
async function ouvrirApp(ctx, quand) {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('crash', () => console.log('  ⚠️ la page a planté (' + quand + ')'));
  if (process.env.DEBUG) { pg.on('close', () => console.log('  (page fermée : ' + quand + ')')); pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) console.log('  (navigation : ' + f.url() + ')'); }); pg.on('requestfailed', (q) => { if (q.resourceType() !== 'image') console.log('  (échec ' + q.resourceType() + ' ' + q.url().slice(0, 140) + ' ' + ((q.failure() || {}).errorText || '') + ')'); }); pg.on('response', (x) => { if (x.status() >= 400) console.log('  (' + x.status() + ' ' + x.url().slice(0, 140) + ')'); }); }
  const cdp = await cdpDe(pg);
  servis = []; LECTURES = []; T_NAV = Date.now();
  const profiler = process.env.PROFIL && quand === process.env.PROFIL_QUAND;
  if (profiler) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  const aller = async () => { await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 }); };
  const pretO = () => { const J = window.__vrmIphone; return J && J.utile != null && J.chiffres != null; };
  let traceO = null;
  if (process.env.OUVERTURE_NOMS && quand === process.env.OUVERTURE_NOMS) { traceO = await tracer(pg, cdp, aller, pretO); console.log('  (trace de l\'ouverture ' + quand + ' : CPU ' + traceO.cpu + ' ms · style ' + traceO.style + ' · mise en page ' + traceO.page + ')'); }
  else {
    await aller();
    if (profiler && process.env.PROFIL_COQUE) { await pg.waitForFunction(() => window.__vrmIphone && window.__vrmIphone.coque != null, null, { timeout: 120000, polling: 50 }).catch(() => {}); const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL, JSON.stringify(agreger(profile), null, 1)); }
    await pg.waitForFunction(pretO, null, { timeout: 120000, polling: 100 }).catch(() => {});
  }
  const J = await pg.evaluate(() => window.__vrmIphone);
  if (profiler && !process.env.PROFIL_COQUE) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL, JSON.stringify(agreger(profile), null, 1)); }
  if (process.env.JALONS) console.log('  (jalons ' + quand + ' : ' + JSON.stringify(await pg.evaluate(() => ({ marques: performance.getEntriesByType('mark').map((m) => m.name + '@' + Math.round(m.startTime)).slice(0, 40), longues: window.__vrmIphone.longues.slice(0, 40), coque: window.__vrmIphone.coque, chiffres: window.__vrmIphone.chiffres, ressources: performance.getEntriesByType('resource').filter((r) => /\.(js|css)$/.test(r.name)).map((r) => r.name.split('/').pop() + '@' + Math.round(r.startTime) + '-' + Math.round(r.responseEnd)).slice(0, 30) }))) + ')');
  if (process.env.DEBUG) console.log('  (états : ' + JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-v2-chiffres],[data-attente-ecran]')].map((e) => (e.getAttribute('data-v2-chiffres') || '') + '/' + (e.getAttribute('data-attente-ecran') || '') + ':' + (e.getAttribute('data-attente') || '')))) + ')');
  if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, 'ouverture-' + quand.replace(/\s+/g, '') + '.png') }).catch(() => {}); }
  await attendre(4000);   // le calme (lectures de fond, rangement du service worker)
  const sw = await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)).catch(() => false);
  const fichiers = servis.filter((x) => /\.(js|css)$/.test(x.f) && !x.sw);
  const r = {
    quand, fcp: J.fcp, coque: J.coque, utile: J.utile, chiffres: J.chiffres, mur: Date.now() - t0,
    jsKo: Math.round(fichiers.reduce((a, x) => a + x.o, 0) / 1024), fichiers: fichiers.length,
    longuesAvantUtile: J.longues.filter(([t]) => J.utile == null || t < J.utile).length,
    longuesMsAvantUtile: J.longues.filter(([t]) => J.utile == null || t < J.utile).reduce((a, [, d]) => a + d, 0),
    plusLongue: J.longues.reduce((m, [, d]) => Math.max(m, d), 0),
    controlee: sw, erreurs: errs.slice(0, 3), memoire: await memoire(cdp),
    base: { lectures: LECTURES.length, ko: Math.round(LECTURES.reduce((a, x) => a + x.o, 0) / 1024), avantPret: LECTURES.filter((x) => J.utile == null || x.d < J.utile).length,
      koAvantPret: Math.round(LECTURES.filter((x) => J.utile == null || x.d < J.utile).reduce((a, x) => a + x.o, 0) / 1024),
      doublons: LECTURES.length - new Set(LECTURES.map((x) => x.u)).size, lourdes: LECTURES.slice().sort((a, b) => b.o - a.o).slice(0, 8).map((x) => `${Math.round(x.o / 1024)} Ko ${x.d}→${x.f} ms ${x.u}`) },
  };
  if (process.env.LECTURES) { console.log(`  (base ${quand} : ${r.base.lectures} lectures, ${r.base.ko} Ko ; avant « prêt » ${r.base.avantPret} / ${r.base.koAvantPret} Ko ; ${r.base.doublons} en double)`); for (const x of r.base.lourdes) console.log('     ' + x); }
  return { pg, cdp, r };
}

// ── La trace d'un geste : temps de fil (CPU) du fil principal, du geste au calme ──
async function tracer(pg, cdp, geste, pret) {
  const evts = [];
  const surDonnees = (d) => { for (const e of d.value) evts.push(e); };
  cdp.on('Tracing.dataCollected', surDonnees);
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,toplevel,disabled-by-default-devtools.timeline' + (process.env.SELECTEURS ? ',disabled-by-default-blink.debug' : '') + (process.env.INVAL ? ',disabled-by-default-devtools.timeline.invalidationTracking' : ''), transferMode: 'ReportEvents' });
  await attendre(150);
  if (process.env.PROFIL_ONGLETS) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  await geste();
  let mur = null;
  try { await pg.waitForFunction(pret, null, { timeout: 30000, polling: 16 }); mur = Date.now() - t0; } catch (_) {}
  await attendre(1500);
  if (process.env.PROFIL_ONGLETS) { const { profile } = await cdp.send('Profiler.stop'); (global.__profils = global.__profils || []).push(agreger(profile)); fs.writeFileSync(process.env.PROFIL_ONGLETS, JSON.stringify(global.__profils, null, 1)); }
  const fini = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end'); await fini;
  cdp.off('Tracing.dataCollected', surDonnees);
  // Le fil principal de la page : le fil « CrRendererMain » qui porte le plus de tâches.
  const noms = new Map(); for (const e of evts) if (e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain') noms.set(e.pid + ':' + e.tid, 0);
  const taches = evts.filter((e) => e.ph === 'X' && (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && noms.has(e.pid + ':' + e.tid));
  for (const e of taches) noms.set(e.pid + ':' + e.tid, noms.get(e.pid + ':' + e.tid) + 1);
  const fil = [...noms.entries()].sort((a, b) => b[1] - a[1])[0];
  const miennes = fil ? taches.filter((e) => e.pid + ':' + e.tid === fil[0]) : [];
  const td = (e) => (e.tdur != null ? e.tdur : e.dur) / 1000;
  // Seulement les tâches de PREMIER niveau (une tâche du planificateur en contient une autre : ne pas compter deux fois).
  const tri = miennes.slice().sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const hautes = []; let finHaut = -1;
  for (const e of tri) { if (e.ts >= finHaut) { hautes.push(e); finHaut = e.ts + e.dur; } }
  const cpu = hautes.reduce((a, e) => a + td(e), 0);
  const plusLongue = hautes.reduce((m, e) => Math.max(m, e.dur / 1000), 0);
  const longues = hautes.filter((e) => e.dur / 1000 > 50).length;
  const style = evts.filter((e) => e.ph === 'X' && e.name === 'UpdateLayoutTree' && fil && e.pid + ':' + e.tid === fil[0]);
  const pireStyle = style.reduce((m, e) => Math.max(m, td(e)), 0);
  const surFil = (nom) => evts.filter((e) => e.ph === 'X' && e.name === nom && fil && e.pid + ':' + e.tid === fil[0]);
  const somme = (l) => Math.round(l.reduce((a, e) => a + td(e), 0));
  if (process.env.GROS) {
    const gros = style.map((e) => ({ el: (e.args && (e.args.elementCount || (e.args.data && e.args.data.elementCount))) || 0, ms: Math.round(td(e)), pile: ((e.args && e.args.beginData && e.args.beginData.stackTrace) || []).slice(0, 4).map((f) => `${f.functionName || '?'}:${f.lineNumber}@${String(f.url || '').split('/').pop()}`).join(' < ') }))
      .filter((x) => x.ms >= 20).sort((a, b) => b.ms - a.ms).slice(0, 8);
    for (const x of gros) console.log(`      style ${x.ms} ms · ${x.el} él. · ${x.pile || '(pas forcé par du script)'}`);
    const lay = evts.filter((e) => e.ph === 'X' && e.name === 'Layout' && fil && e.pid + ':' + e.tid === fil[0]);
    const pileDe = (e) => ((e.args && e.args.beginData && e.args.beginData.stackTrace) || []).slice(0, 3).map((f) => `${f.functionName || '?'}:${f.lineNumber}`).join(' < ');
    console.log(`      mises en page : ${lay.length}, dont ${lay.filter((e) => td(e) >= 20).length} ≥ 20 ms : ` + lay.filter((e) => td(e) >= 20).sort((a, b) => td(b) - td(a)).slice(0, 6).map((e) => Math.round(td(e)) + ' ms (' + ((e.args && e.args.beginData && (e.args.beginData.dirtyObjects + '/' + e.args.beginData.totalObjects)) || '?') + ' ' + (pileDe(e) || 'non forcée') + ')').join(' · '));
  }
  if (process.env.SELECTEURS) {
    const par = global.__selecteurs = global.__selecteurs || new Map(); let total = 0;
    for (const e of evts) { if (e.name !== 'SelectorStats') continue; const l = e.args && e.args.selector_stats && e.args.selector_stats.selector_timings; if (!Array.isArray(l)) continue;
      for (const x of l) { const us = Number(x['elapsed (us)']) || 0; total += us; const k = String(x.selector || ''); const o = par.get(k) || { us: 0, essais: 0, touches: 0, rejets: 0, style: x.style_sheet_id }; o.us += us; o.essais += Number(x.match_attempts) || 0; o.touches += Number(x.match_count) || 0; o.rejets += Number(x.fast_reject_count) || 0; par.set(k, o); } }
    console.log(`      sélecteurs : ${Math.round(total / 1000)} ms mesurés`);
    fs.writeFileSync(process.env.SELECTEURS, JSON.stringify([...par.entries()].sort((a, b) => b[1].us - a[1].us).map(([k, o]) => [Math.round(o.us), o.essais, o.touches, o.rejets, k])));
  }
  if (process.env.INVAL) {
    const par = new Map();
    for (const e of evts) { if (!/InvalidationTracking/.test(e.name)) continue; const d = (e.args && e.args.data) || {}; const k = e.name.replace('InvalidationTracking', '') + ' · ' + (d.reason || '') + ' · ' + String(d.nodeName || '').slice(0, 60) + (d.changedAttribute ? ' @' + d.changedAttribute : '') + (d.changedClass ? ' .' + d.changedClass : '') + (d.subtree ? ' · SOUS-ARBRE' : ''); par.set(k, (par.get(k) || 0) + 1); }
    console.log([...par].sort((a, b) => b[1] - a[1]).filter(([k]) => /SOUS-ARBRE|HTML|BODY|n-coque|vrm-main|app-shell/.test(k)).slice(0, 14).map(([k, n]) => '        ' + n + ' × ' + k).join('\n'));
  }
  if (process.env.NOMS) {
    const xs = evts.filter((e) => e.ph === 'X' && fil && e.pid + ':' + e.tid === fil[0]).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const propre = new Map(); const pile = [];
    const fermer = (x) => propre.set(x.e.name, (propre.get(x.e.name) || 0) + Math.max(0, td(x.e) - x.enf));
    for (const e of xs) { while (pile.length && e.ts >= pile[pile.length - 1].fin) fermer(pile.pop()); if (pile.length) pile[pile.length - 1].enf += td(e); pile.push({ e, fin: e.ts + e.dur, enf: 0 }); }
    while (pile.length) fermer(pile.pop());
    console.log('      ' + [...propre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + Math.round(v)).join(' · '));
  }
  const elementsStyle = style.reduce((a, e) => a + ((e.args && (e.args.elementCount || (e.args.data && e.args.data.elementCount))) || 0), 0);
  return { cpu: Math.round(cpu), plusLongue: Math.round(plusLongue), longues, mur, pireStyle: Math.round(pireStyle * 10) / 10, style: somme(style), page: somme(surFil('Layout')), script: somme(surFil('FunctionCall').concat(surFil('EvaluateScript'), surFil('TimerFire'), surFil('EventDispatch'), surFil('FireAnimationFrame'), surFil('RunMicrotasks'))), elementsStyle };
}

const CLE = (id) => (id === 'annonces' ? 'paires' : id);
async function onglets(pg, cdp) {
  const sortie = [];
  const surEcran = (id) => new Function(`const m = document.querySelector('.vrm-main'); return !!m && m.getAttribute('data-ecran') === ${JSON.stringify(id)} && !document.querySelector('[data-attente-ecran="${id === 'compta' ? '' : id}"][data-attente="attente"]');`);
  const toucher = (id) => async () => { await pg.locator(`[data-n-onglet="${CLE(id)}"]`).first().tap({ timeout: 30000 }); };
  const ordre = ['annonces', 'ventes', 'achats', 'compta', 'journee'];
  const tours = +(process.env.TOURS || 2);
  for (let t = 1; t <= tours; t++) {
    for (const id of ordre) {
      const n0 = await pg.evaluate(() => performance.getEntriesByType('resource').length);
      const m = await tracer(pg, cdp, toucher(id), surEcran(id));
      m.morceaux = await pg.evaluate((n) => performance.getEntriesByType('resource').slice(n).filter((r) => /\.js$/.test(r.name)).map((r) => r.name.split('/').pop().replace(/-[\w-]{8}\.js$/, '')), n0);
      if (process.env.MORCEAUX && m.morceaux.length) console.log('      morceaux : ' + m.morceaux.join(' '));
      sortie.push({ geste: `${t === 1 ? '1er' : '2e'} → ${id}`, ...m, memoire: await memoire(cdp) });
      console.log(`  ${t === 1 ? '1er' : '2e'} → ${id.padEnd(8)} CPU ${String(m.cpu).padStart(5)} ms · plus longue ${m.plusLongue} ms · ${m.longues} longue(s) · écran ${m.mur} ms · style ${m.style} (max ${m.pireStyle}, ${m.elementsStyle} él.) · mise en page ${m.page} · script ≈ ${m.script}`);
    }
  }
  // « Plus » (la feuille derrière la photo du profil), puis la fermer.
  {
    const m = await tracer(pg, cdp, async () => { await pg.locator('[data-n-coque-plus]').first().tap({ timeout: 30000 }); }, () => !!document.querySelector('[data-n-feuille-plus]'));
    sortie.push({ geste: 'Plus (ouvrir)', ...m }); console.log(`  Plus (ouvrir)  CPU ${m.cpu} ms · plus longue ${m.plusLongue} ms · écran ${m.mur} ms`);
    await pg.keyboard.press('Escape').catch(() => {}); await attendre(600);
    if (await pg.evaluate(() => !!document.querySelector('[data-n-feuille-plus]'))) { await pg.locator('[data-n-coque-plus]').first().tap({ timeout: 5000 }).catch(() => {}); await attendre(600); }
  }
  // Une fiche depuis Annonces, et le retour.
  {
    await pg.locator(`[data-n-onglet="paires"]`).first().tap({ timeout: 30000 });
    await pg.waitForSelector('[data-fiche-ligne][data-fl-num], [data-eg-article]:not([data-eg-numero=""])', { timeout: 30000 }).catch(() => {}); await attendre(1500);
    const cible = await pg.evaluate(() => { for (const e of document.querySelectorAll('[data-fiche-ligne][data-fl-num], [data-eg-article]:not([data-eg-numero=""])')) { const r = e.getBoundingClientRect(); if (r.height < 30 || r.top < 110 || r.bottom > innerHeight - 110) continue; const x = r.left + Math.min(r.width / 2, 190), y = r.top + r.height / 2; if (e.contains(document.elementFromPoint(x, y))) return { x, y }; } return null; });
    if (cible) {
      const m = await tracer(pg, cdp, () => pg.touchscreen.tap(cible.x, cible.y), () => !!document.querySelector('[data-fiche-paire]'));
      sortie.push({ geste: 'fiche (ouvrir)', ...m }); console.log(`  fiche (ouvrir) CPU ${m.cpu} ms · plus longue ${m.plusLongue} ms · écran ${m.mur} ms`);
      const r = await tracer(pg, cdp, async () => { await pg.goBack().catch(() => {}); }, () => !document.querySelector('[data-fiche-paire]'));
      sortie.push({ geste: 'fiche (retour)', ...r }); console.log(`  fiche (retour) CPU ${r.cpu} ms · plus longue ${r.plusLongue} ms · écran ${r.mur} ms`);
    } else console.log('  fiche : aucune rangée à toucher');
  }
  return sortie;
}

// ── Le défilement : un balayage tactile synthétisé (CDP), images par seconde et tâches longues ──
async function defiler(pg, cdp, id) {
  // L'écran ouvert directement (ouverture suivante, service worker) : aucune feuille ni recherche restée d'une étape d'avant.
  await pg.goto(`http://localhost:${PORT}/?tab=${id}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return !!m && m.getAttribute('data-ecran') === x; }, id, { timeout: 60000 }).catch(() => {});
  // Le CALME d'abord : plus aucune tâche longue depuis 3 s (au plus 60 s) — sinon on mesurerait la fin du chargement, pas le défilement.
  await pg.evaluate(() => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > 3000 || performance.now() - t0 > 60000) { clearInterval(iv); ok(); } }, 250); }));
  await pg.evaluate(() => { window.__vrmImages = []; window.__vrmLongues = []; const boucle = (t) => { window.__vrmImages.push(t); window.__vrmRaf = requestAnimationFrame(boucle); }; window.__vrmRaf = requestAnimationFrame(boucle);
    try { window.__vrmObsL = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vrmLongues.push(Math.round(e.duration)); }); window.__vrmObsL.observe({ type: 'longtask' }); } catch (_) {} });
  const t0 = Date.now();
  // Le geste (CDP) : 6 balayages — « mouse » par défaut (le geste « touch » synthétisé ne fait pas défiler la coque native
  // sous Chromium émulé : 0 px mesuré) ; vers le bas, 1 400 px chacun à 1 600 px/s (un pouce rapide).
  for (let i = 0; i < 6; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 560, yDistance: -1400, speed: 1600, gestureSourceType: process.env.GESTE || 'mouse', repeatCount: 1, preventFling: false });
  const duree = Date.now() - t0;
  const r = await pg.evaluate(() => { cancelAnimationFrame(window.__vrmRaf); try { window.__vrmObsL.disconnect(); } catch (_) {} const im = window.__vrmImages; const ecarts = im.slice(1).map((t, i) => t - im[i]);
    let haut = window.scrollY; for (const e of document.querySelectorAll('*')) if (e.scrollTop > haut) haut = e.scrollTop; return { images: im.length, duree: im.length > 1 ? im[im.length - 1] - im[0] : 0, pireImage: ecarts.length ? Math.round(Math.max(...ecarts)) : 0, saccades: ecarts.filter((x) => x > 50).length, longues: window.__vrmLongues, haut: Math.round(haut), noeuds: document.getElementsByTagName('*').length }; });
  const ips = r.duree ? Math.round(r.images / (r.duree / 1000)) : 0;
  const out = { ecran: id, ips, pireImageMs: r.pireImage, saccades: r.saccades, longues: r.longues.length, plusLongue: r.longues.length ? Math.max(...r.longues) : 0, defile: r.haut, noeuds: r.noeuds, mur: duree, memoire: await memoire(cdp) };
  console.log(`  défilement ${id.padEnd(8)} ${ips} images/s · pire image ${r.pireImage} ms · ${r.saccades} saccade(s) > 50 ms · ${out.longues} tâche(s) longue(s) (max ${out.plusLongue} ms) · défilé ${r.haut} px · ${r.noeuds} nœuds`);
  return out;
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const sortie = { dist: DIST, cpu: CPU, reseau: '4G 150 ms · 9 Mbit/s', base: { annonces: 1200, ventes: 1500, achats: 800 } };
  try {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', serviceWorkers: 'allow' });
    await preparer(ctx);
    console.log(`iPhone 390 × 844 @3 · CPU ×${CPU} · 4G (150 ms, ${DEBIT * 8 / 1e6} Mbit/s) · ${path.relative(process.cwd(), DIST) || DIST}`);
    // 1) à froid
    const froid = await ouvrirApp(ctx, 'froid');
    const dire = (r) => console.log(`  ${r.quand.padEnd(9)} 1re peinture ${r.fcp} ms · coque ${r.coque} ms · écran utile ${r.utile} ms · chiffres ${r.chiffres} ms · JS+CSS ${r.jsKo} Ko (${r.fichiers}) · ${r.longuesAvantUtile} tâches longues avant l'écran utile (${r.longuesMsAvantUtile} ms, max ${r.plusLongue}) · tas ${r.memoire.tasMo} Mo · ${r.memoire.noeuds} nœuds${r.erreurs.length ? ' · ERREURS ' + r.erreurs.join(' | ') : ''}`);
    dire(froid.r);
    // le service worker a-t-il pris la page ? (il range la coquille à la 1re ouverture)
    await froid.pg.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
    await attendre(6000);
    await froid.pg.close();
    // 2) les ouvertures suivantes (service worker) — deux, la 2e fait foi
    const chaud1 = await ouvrirApp(ctx, 'chaud 1'); dire(chaud1.r); await chaud1.pg.close();
    const chaud = await ouvrirApp(ctx, 'chaud 2'); dire(chaud.r);
    sortie.demarrage = { froid: froid.r, chaud1: chaud1.r, chaud2: chaud.r };
    if (ETAPES.includes('onglets')) { console.log('Changements d\'onglet (temps de fil, CPU ×' + CPU + ')'); sortie.onglets = await onglets(chaud.pg, chaud.cdp); }
    if (ETAPES.includes('defilement')) { console.log('Défilement'); sortie.defilement = []; for (const id of ['annonces', 'ventes', 'achats']) { try { sortie.defilement.push(await defiler(chaud.pg, chaud.cdp, id)); } catch (e) { console.log(`  défilement ${id} : pas mesuré (${String(e.message || e).split('\n')[0].slice(0, 100)})`); } } }
    sortie.memoireFin = await memoire(chaud.cdp);
    await ctx.close();
  } finally { await nav.close(); srv.close(); }
  // Résumé
  const o = sortie.onglets || [];
  const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const deux = o.filter((x) => /^2e/.test(x.geste));
  sortie.resume = { froidUtile: sortie.demarrage.froid.utile, froidChiffres: sortie.demarrage.froid.chiffres, chaudUtile: sortie.demarrage.chaud2.utile, chaudChiffres: sortie.demarrage.chaud2.chiffres,
    jsFroidKo: sortie.demarrage.froid.jsKo, ongletCpuMed2e: med(deux.map((x) => x.cpu)), ongletCpuMax2e: Math.max(0, ...deux.map((x) => x.cpu)), ongletCpuMed1er: med(o.filter((x) => /^1er/.test(x.geste)).map((x) => x.cpu)),
    defilementPireLongue: Math.max(0, ...(sortie.defilement || []).map((x) => x.plusLongue)), tasFinMo: sortie.memoireFin && sortie.memoireFin.tasMo };
  console.log('\nRésumé : ' + JSON.stringify(sortie.resume));
  console.log('Objectifs : chaud < 1 000 ms · froid (4G) < 3 000 ms · onglet < 150 ms de CPU · aucune tâche > 50 ms au défilement');
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(sortie, null, 1));
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
