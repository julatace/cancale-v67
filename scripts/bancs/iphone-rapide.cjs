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
const RTT = 150, DEBIT = 9e6 / 8;   // octets/s
const RESEAU = { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 };
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
    if (J.chiffres == null && document.querySelector('[data-v2-chiffres="lu"]')) J.chiffres = t;
  };
  document.addEventListener('DOMContentLoaded', () => { voir(); new MutationObserver(voir).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-attente', 'data-v2-chiffres'] }); });
}

async function preparer(ctx) {
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await ctx.addInitScript(jalons);
  // Photos de Vinted : coupées (le banc ne joint rien) ; l'app montre son pictogramme.
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) || /vinted\.net\//i.test(r.request().url()) ? r.abort() : r.continue()));
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') { await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    await attendre(RTT + Math.round(body.length / DEBIT * 1000));
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

// ── Une ouverture : de la navigation à l'écran utile, puis au calme ──
async function ouvrirApp(ctx, quand) {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('crash', () => console.log('  ⚠️ la page a planté (' + quand + ')'));
  if (process.env.DEBUG) { pg.on('close', () => console.log('  (page fermée : ' + quand + ')')); pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) console.log('  (navigation : ' + f.url() + ')'); }); pg.on('console', (m) => { if (/error|warn/.test(m.type())) console.log('  (console ' + m.type() + ' : ' + m.text().slice(0, 160) + ')'); }); }
  const cdp = await cdpDe(pg);
  servis = [];
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await pg.waitForFunction(() => { const J = window.__vrmIphone; return J && J.utile != null && J.chiffres != null; }, null, { timeout: 120000, polling: 100 }).catch(() => {});
  const J = await pg.evaluate(() => window.__vrmIphone);
  if (process.env.DEBUG) console.log('  (états : ' + JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-v2-chiffres],[data-attente-ecran]')].map((e) => (e.getAttribute('data-v2-chiffres') || '') + '/' + (e.getAttribute('data-attente-ecran') || '') + ':' + (e.getAttribute('data-attente') || '')))) + ')');
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
  };
  return { pg, cdp, r };
}

// ── La trace d'un geste : temps de fil (CPU) du fil principal, du geste au calme ──
async function tracer(pg, cdp, geste, pret) {
  const evts = [];
  const surDonnees = (d) => { for (const e of d.value) evts.push(e); };
  cdp.on('Tracing.dataCollected', surDonnees);
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,toplevel,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  await attendre(150);
  const t0 = Date.now();
  await geste();
  let mur = null;
  try { await pg.waitForFunction(pret, null, { timeout: 30000, polling: 16 }); mur = Date.now() - t0; } catch (_) {}
  await attendre(1500);
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
  const cpu = miennes.reduce((a, e) => a + td(e), 0);
  const plusLongue = miennes.reduce((m, e) => Math.max(m, e.dur / 1000), 0);
  const longues = miennes.filter((e) => e.dur / 1000 > 50).length;
  const style = evts.filter((e) => e.ph === 'X' && e.name === 'UpdateLayoutTree' && fil && e.pid + ':' + e.tid === fil[0]);
  const pireStyle = style.reduce((m, e) => Math.max(m, td(e)), 0);
  return { cpu: Math.round(cpu), plusLongue: Math.round(plusLongue), longues, mur, pireStyle: Math.round(pireStyle * 10) / 10 };
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
      const m = await tracer(pg, cdp, toucher(id), surEcran(id));
      sortie.push({ geste: `${t === 1 ? '1er' : '2e'} → ${id}`, ...m, memoire: await memoire(cdp) });
      console.log(`  ${t === 1 ? '1er' : '2e'} → ${id.padEnd(8)} CPU ${String(m.cpu).padStart(5)} ms · plus longue ${m.plusLongue} ms · ${m.longues} longue(s) · écran ${m.mur} ms · style max ${m.pireStyle} ms`);
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
    await pg.locator(`[data-n-onglet="paires"]`).first().tap({ timeout: 30000 }); await attendre(2500);
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
  await pg.locator(`[data-n-onglet="${CLE(id)}"]`).first().tap({ timeout: 30000 }); await attendre(3000);
  await pg.evaluate(() => { window.__vrmImages = []; window.__vrmLongues = []; const boucle = (t) => { window.__vrmImages.push(t); window.__vrmRaf = requestAnimationFrame(boucle); }; window.__vrmRaf = requestAnimationFrame(boucle);
    try { window.__vrmObsL = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vrmLongues.push(Math.round(e.duration)); }); window.__vrmObsL.observe({ type: 'longtask' }); } catch (_) {} });
  const t0 = Date.now();
  for (let i = 0; i < 6; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -1400, speed: 1600, gestureSourceType: 'touch', repeatCount: 1 });
  const duree = Date.now() - t0;
  const r = await pg.evaluate(() => { cancelAnimationFrame(window.__vrmRaf); try { window.__vrmObsL.disconnect(); } catch (_) {} const im = window.__vrmImages; const ecarts = im.slice(1).map((t, i) => t - im[i]);
    const s = (document.querySelector('.n-coque-ecran') || document.scrollingElement); return { images: im.length, duree: im.length > 1 ? im[im.length - 1] - im[0] : 0, pireImage: ecarts.length ? Math.round(Math.max(...ecarts)) : 0, saccades: ecarts.filter((x) => x > 50).length, longues: window.__vrmLongues, haut: Math.round((s && s.scrollTop) || window.scrollY), noeuds: document.getElementsByTagName('*').length }; });
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
    console.log(`iPhone 390 × 844 @3 · CPU ×${CPU} · 4G (150 ms, 9 Mbit/s) · ${path.relative(process.cwd(), DIST) || DIST}`);
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
    if (ETAPES.includes('defilement')) { console.log('Défilement'); sortie.defilement = [await defiler(chaud.pg, chaud.cdp, 'annonces'), await defiler(chaud.pg, chaud.cdp, 'ventes'), await defiler(chaud.pg, chaud.cdp, 'achats')]; }
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
