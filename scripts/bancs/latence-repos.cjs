// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'APP AU REPOS NE FAIT RIEN » (22 nov., latence-totale — Julien : « l'app bug beaucoup trop » ;
//  « regarde absolument toutes les raisons de pourquoi il y a de la latence »). Récit : docs/passation/2026-11-22-latence-totale.md.
//    node scripts/bancs/latence-repos.cjs <dist> [port]     REPOS=30 · TOURS=10 · CPU=4 · FORMAT=tel|ordi · JSON=<fichier>
//  Comme chez lui : iPhone simulé 390 × 844 densité 3, tactile, CPU ×4, 4G (150 ms, 9 Mbit/s) pour les fichiers ET la base
//  (base INVENTÉE au volume de la sienne, `_base-volume`, servie par le banc ; rien de réel, aucune écriture ne sort).
//  Il MESURE et JUGE, sur Ma journée ouverte, toutes les données déjà là, l'app laissée au repos REPOS secondes :
//    R1. rendus React au repos : validations (commits) ≤ SEUIL_COMMITS (une horloge « il y a N min » par minute est permise) ;
//        et, avec un build NON minifié, les composants rendus (nom ⇒ nombre) — c'est la liste à lire ;
//    R2. lectures réseau au repos (base + /api + fichiers) ≤ SEUIL_RESEAU ; chacune nommée ;
//    R3. minuteries au repos : rappels de setInterval/setTimeout exécutés, par lieu de création (pile), nommés ;
//    R4. tâches longues (> 50 ms) au repos : aucune ;
//    M.  mémoire : tas JS (après ramasse-miettes) après 1 tour d'onglets et après TOURS tours : croissance ≤ SEUIL_FUITE_MO.
//  Il RAPPORTE aussi le démarrage (coque, écran prêt) et les lectures à l'ouverture (nombre, octets, doublons).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 4799);
const CPU = +(process.env.CPU || 4);
const REPOS = +(process.env.REPOS || 30) * 1000;
const TOURS = +(process.env.TOURS || 10);
const TEL = (process.env.FORMAT || 'tel') === 'tel';
const RTT = 150, DEBIT = 9e6 / 8;
const SEUIL_COMMITS = +(process.env.SEUIL_COMMITS || 2), SEUIL_RESEAU = +(process.env.SEUIL_RESEAU || 1), SEUIL_FUITE_MO = +(process.env.SEUIL_FUITE_MO || 25);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0; const KO = []; const sortie = {};
const dit = (bon, quoi) => { if (bon) ok++; else { ko++; KO.push(quoi); } console.log((bon ? '  ✅ ' : '  ❌ ') + quoi); };
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGOs6FnAQApgIkn1qIZRDUNKAwA3KwHEWgvY/wAAAABJRU5ErkJggg==', 'base64');
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const gz = new Map();
const FICHIERS = [];
const srv = http.createServer((q, r) => {
  FICHIERS.push({ t: Date.now(), u: q.url });
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 6 })); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(gz.get(p)); }
  r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(fs.readFileSync(p));
}).listen(PORT);

const LECTURES = [];
async function preparer(ctx) {
  // SANS_CROCHETS=1 : ni crochet React ni minuteries enrobées (pour vérifier que la mesure de mémoire ne vient pas d'eux).
  if (process.env.SANS_CROCHETS) await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} window.__vrmRendus = { commits: 0, comps: {} }; window.__vrmMinut = { par: {} }; window.__vrmLongues = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vrmLongues.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {} });
  else await ctx.addInitScript(() => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
    // ── Rendus React : un crochet « outils de développement » minimal, posé AVANT React (il le lit à son chargement). ──
    const R = window.__vrmRendus = { commits: 0, comps: {}, on: false };
    const nom = (f) => { const t = f.type; if (!t || typeof t === 'string') return null; return t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || null; };
    const parcourir = (fibre) => {
      const pile = [fibre]; let n = 0;
      while (pile.length && n < 200000) { const f = pile.pop(); n++;
        const a = f.alternate; const rendu = !a || a.memoizedProps !== f.memoizedProps || a.memoizedState !== f.memoizedState;
        // Une fibre qui n'a pas été re-rendue garde ses enfants tels quels (bailout) : on ne descend que si elle a travaillé
        // ou si un enfant a travaillé (subtreeFlags / childLanes ne sont pas fiables ici : on descend partout, borné).
        if (rendu && (f.tag === 0 || f.tag === 1 || f.tag === 11 || f.tag === 14 || f.tag === 15)) { const k = nom(f) || ('?' + f.tag); R.comps[k] = (R.comps[k] || 0) + 1; }
        if (f.sibling) pile.push(f.sibling); if (f.child) pile.push(f.child); }
    };
    // Les composants MONTÉS (par nom) : une instance qui s'accumule d'un tour à l'autre est une fuite.
    window.__vrmInstances = () => { const c = {}; if (!R.root) return c; const pile = [R.root.current]; let n = 0; while (pile.length && n < 400000) { const f = pile.pop(); n++; if (f.tag === 0 || f.tag === 1 || f.tag === 11 || f.tag === 14 || f.tag === 15) { const k = nom(f) || ('?' + f.tag); c[k] = (c[k] || 0) + 1; } if (f.sibling) pile.push(f.sibling); if (f.child) pile.push(f.child); } return c; };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), inject() { return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
      onCommitFiberRoot(id, root) { R.root = root; if (!R.on) return; R.commits++; try { parcourir(root.current); } catch (_) {} }, checkDCE() {} };
    // ── Minuteries : chaque rappel exécuté, compté par lieu de création. ──
    const T = window.__vrmMinut = { on: false, par: {} };
    const lieu = () => { const s = String(new Error().stack || '').split('\n').slice(3, 6).map((l) => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\/assets\//, '').replace(/\?[^:)]*/, '')).join(' ← '); return s.slice(0, 220); };
    const enrober = (orig, sorte) => function (fn, ms, ...r) { if (typeof fn !== 'function') return orig.call(this, fn, ms, ...r); const l = sorte + ' ' + (ms | 0) + 'ms · ' + lieu(); return orig.call(this, function (...a) { if (T.on) T.par[l] = (T.par[l] || 0) + 1; return fn.apply(this, a); }, ms, ...r); };
    window.setInterval = enrober(window.setInterval, 'interval');
    window.setTimeout = enrober(window.setTimeout, 'timeout');
    const raf = window.requestAnimationFrame; window.requestAnimationFrame = function (fn) { const l = 'raf · ' + lieu(); return raf.call(this, (t) => { if (T.on) T.par[l] = (T.par[l] || 0) + 1; return fn(t); }); };
    window.__vrmLongues = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vrmLongues.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route(/^https:\/\/images\d*\.vinted\.net\//i, async (r) => { await attendre(RTT); return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PHOTO }).catch(() => {}); });
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    const u = decodeURIComponent(rq.url()).replace(/^.*\/rest\/v1\//, '');
    if (rq.method() !== 'GET') { LECTURES.push({ t: Date.now(), u: rq.method() + ' ' + u, o: 0 }); await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {}); }
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    LECTURES.push({ t: Date.now(), u: u + (h.range ? ' [' + h.range + ']' : ''), o: body.length });
    await attendre(RTT + Math.round(body.length / DEBIT * 1000));
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body }).catch(() => {});
  });
  await ctx.route('**/api/**', async (r) => { const u = r.request().url(); LECTURES.push({ t: Date.now(), u: 'API ' + u.replace(/^.*\/api\//, ''), o: 0 });
    const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }).catch(() => {}); });
}
// ⚠️ La poignée rendue par waitForSelector est RELÂCHÉE tout de suite : gardée, elle retient l'écran (et, par ses fibres
// React, tous ses calculs) après son démontage — une fausse fuite de ~17 000 nœuds par tour d'onglets (instantané du tas :
// « (Global handles) / DevTools console »).
const pret = (pg, id, ms = 60000) => pg.waitForSelector(`.vrm-main [data-attente-ecran="${id}"][data-attente="pret"], .vrm-main [data-attente-ecran="${id}"][data-attente="plafond"]`, { timeout: ms, state: 'attached' }).then((h) => (h ? h.dispose() : null)).catch(() => {});
const calme = (pg, sans = 1500, max = 25000) => pg.evaluate(([sans, max]) => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > sans || performance.now() - t0 > max) { clearInterval(iv); ok(); } }, 100); }), [sans, max]).catch(() => {});
const ONGLETS = ['annonces', 'ventes', 'achats', 'compta', 'journee'];
const selOnglet = (o) => (o === 'annonces' ? '[data-n-onglet="paires"]:visible, [data-n-onglet="annonces"]:visible, [data-nav-entree="annonces"]:visible' : `[data-n-onglet="${o}"]:visible, [data-nav-entree="${o}"]:visible`);
const sansParam = (u) => u.replace(/([?&])(_v|t|ts)=\d+/g, '$1$2=…');

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--js-flags=--expose-gc', '--explicitly-allowed-ports=' + PORT] });
  console.log(`Banc latence-repos · ${path.basename(DIST)} · ${TEL ? '390 tactile' : '1512'} · CPU ×${CPU} · 4G · repos ${REPOS / 1000} s · ${TOURS} tours`);
  try {
    const ctx = await nav.newContext(TEL ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', serviceWorkers: 'allow' } : { viewport: { width: 1512, height: 945 }, locale: 'fr-FR', serviceWorkers: 'allow' });
    await preparer(ctx);
    const pg = await ctx.newPage();
    const cdp = await ctx.newCDPSession(pg);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 });
    await cdp.send('Performance.enable');
    const tas = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await attendre(300); await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const m = await cdp.send('Performance.getMetrics'); const g = (k) => (m.metrics.find((x) => x.name === k) || {}).value || 0; return { mo: Math.round(g('JSHeapUsedSize') / 1048576 * 10) / 10, noeuds: g('Nodes'), ecouteurs: g('JSEventListeners'), docs: g('Documents') }; };
    // ── Démarrage ──
    LECTURES.length = 0; FICHIERS.length = 0;
    const t0 = Date.now();
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await pg.waitForSelector('[data-n-onglet], [data-nav-entree]', { timeout: 120000, state: 'attached' }).then((h) => (h ? h.dispose() : null)).catch(() => {});
    const tCoque = Date.now() - t0;
    await pret(pg, 'journee', 120000);
    const tPret = Date.now() - t0;
    await calme(pg, 2500, 60000); await attendre(3000);
    const parU = new Map(); for (const l of LECTURES) parU.set(l.u, (parU.get(l.u) || 0) + 1);
    const doubles = [...parU.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
    const octets = LECTURES.reduce((s, l) => s + l.o, 0);
    const lourdes = LECTURES.slice().sort((a, b) => b.o - a.o).slice(0, 8);
    console.log(`  démarrage à froid : coque ${tCoque} ms · Ma journée prête ${tPret} ms · ${LECTURES.length} lectures (${Math.round(octets / 1024)} Ko JSON) · ${FICHIERS.length} fichiers`);
    console.log('    lectures en double : ' + doubles.slice(0, 10).map(([u, n]) => n + '× ' + u.slice(0, 110)).join('\n                         '));
    console.log('    plus lourdes : ' + lourdes.map((l) => Math.round(l.o / 1024) + ' Ko ' + l.u.slice(0, 100)).join('\n                   '));
    sortie.demarrage = { coque: tCoque, pret: tPret, lectures: LECTURES.length, octets, doubles: doubles.length, doublesListe: doubles.slice(0, 30) };
    // ── Un tour d'onglets (les écrans se gardent, les données arrivent), retour sur Ma journée ──
    // C. Le CSS coûteux sur iPhone : éléments AFFICHÉS qui portent un flou d'arrière-plan (backdrop-filter, recomposé à
    //    chaque image du défilement par Safari) ou un filtre, par écran.
    const css = {};
    for (const o of ONGLETS) { await pg.locator(selOnglet(o)).first()[TEL ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {}); await pret(pg, o); await calme(pg, 1500, 25000);
      css[o] = await pg.evaluate(() => { let bf = 0, fi = 0, n = 0, petits = 0; const petitsEx = []; const ex = {}; for (const e of document.querySelectorAll('body *')) { if (!e.getClientRects().length) continue; n++; const s = getComputedStyle(e); const b = s.backdropFilter || s.webkitBackdropFilter; if (b && b !== 'none') { bf++; const k = (e.className && String(e.className).split(' ')[0]) || e.tagName; ex[k] = (ex[k] || 0) + 1; } if (s.filter && s.filter !== 'none') fi++; if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) && !/^(checkbox|radio|range|hidden|button|submit)$/.test(e.type || '') && parseFloat(s.fontSize) < 16) { petits++; petitsEx.push((e.getAttribute('placeholder') || e.name || e.type || e.tagName).slice(0, 30) + ' ' + s.fontSize); } } return { n, bf, fi, petits, petitsEx: petitsEx.slice(0, 4), ex: Object.entries(ex).sort((a, b) => b[1] - a[1]).slice(0, 6) }; }).catch(() => null); }
    console.log('  CSS : ' + ONGLETS.map((o) => css[o] ? `${o} ${css[o].n} él. · flou ${css[o].bf} (${css[o].ex.map(([k, n]) => n + '× ' + k).join(', ')}) · filtre ${css[o].fi} · champs < 16 px (zoom iOS) ${css[o].petits} ${css[o].petitsEx.join(' / ')}` : o + ' ?').join('\n        '));
    sortie.css = css;
    await calme(pg, 3000, 40000); await attendre(5000);
    const m1 = await tas();
    const inst1 = await pg.evaluate(() => (window.__vrmInstances ? window.__vrmInstances() : {}));
    console.log(`  mémoire après 1 tour : ${m1.mo} Mo · ${m1.noeuds} nœuds · ${m1.ecouteurs} écouteurs`);
    // ── Repos ──
    LECTURES.length = 0; FICHIERS.length = 0;
    await pg.evaluate(() => { window.__vrmRendus.on = true; window.__vrmRendus.commits = 0; window.__vrmRendus.comps = {}; window.__vrmMinut.on = true; window.__vrmMinut.par = {}; window.__vrmLongues = []; });
    await attendre(REPOS);
    const rep = await pg.evaluate(() => { window.__vrmRendus.on = false; window.__vrmMinut.on = false; return { commits: window.__vrmRendus.commits, comps: window.__vrmRendus.comps, minut: window.__vrmMinut.par, longues: window.__vrmLongues.map((x) => x.d) }; });
    // DEBUG_EXPR=<expression> : évaluée dans la page après le repos et imprimée (diagnostic d'un build instrumenté à la main).
    if (process.env.DEBUG_EXPR) console.log('    debug : ' + JSON.stringify(await pg.evaluate((x) => { try { return (0, eval)(x); } catch (e) { return String(e); } }, process.env.DEBUG_EXPR)).slice(0, 2000));
    const lect = LECTURES.slice(), fich = FICHIERS.filter((f) => !/^\/assets\//.test(f.u));
    const comps = Object.entries(rep.comps).sort((a, b) => b[1] - a[1]);
    const minut = Object.entries(rep.minut).sort((a, b) => b[1] - a[1]);
    console.log(`  REPOS ${REPOS / 1000} s : ${rep.commits} validations React · ${comps.reduce((s, [, n]) => s + n, 0)} rendus de composants · ${lect.length} lectures base/api · ${fich.length} fichiers · ${minut.reduce((s, [, n]) => s + n, 0)} rappels de minuterie · ${rep.longues.length} tâches longues (max ${rep.longues.length ? Math.max(...rep.longues) : 0} ms)`);
    console.log('    composants rendus : ' + comps.slice(0, 25).map(([k, n]) => n + '× ' + k).join(' · '));
    console.log('    lectures : ' + lect.slice(0, 20).map((l) => sansParam(l.u).slice(0, 110)).join('\n               '));
    console.log('    fichiers : ' + fich.slice(0, 10).map((f) => sansParam(f.u)).join(' · '));
    console.log('    minuteries : ' + minut.slice(0, 25).map(([k, n]) => n + '× ' + k).join('\n                 '));
    sortie.repos = { commits: rep.commits, comps, lectures: lect.map((l) => l.u), fichiers: fich.map((f) => f.u), minut, longues: rep.longues };
    dit(rep.commits <= SEUIL_COMMITS, `R1 validations React au repos ${REPOS / 1000} s : ${rep.commits} ≤ ${SEUIL_COMMITS}`);
    dit(lect.length + fich.length <= SEUIL_RESEAU, `R2 requêtes au repos : ${lect.length + fich.length} ≤ ${SEUIL_RESEAU}`);
    dit(!rep.longues.length, `R4 aucune tâche longue au repos (${rep.longues.length}, max ${rep.longues.length ? Math.max(...rep.longues) : 0} ms)`);
    // ── Mémoire après TOURS tours ──
    // PROFIL_TAS=1 : l'échantillonneur du tas pendant les tours 2..TOURS — à la fin, ce qui est ENCORE vivant, par lieu d'allocation.
    if (process.env.PROFIL_TAS) await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32768 }).catch(() => {});
    for (let t = 1; t < TOURS; t++) for (const o of ONGLETS) { await pg.locator(selOnglet(o)).first()[TEL ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {}); await pret(pg, o, 20000); await calme(pg, 800, 12000); }
    await calme(pg, 3000, 40000); await attendre(5000);
    const mN = await tas();
    if (process.env.PROFIL_TAS) {
      const { profile } = await cdp.send('HeapProfiler.getSamplingProfile');
      await cdp.send('HeapProfiler.stopSampling').catch(() => {});
      const parLieu = new Map(), parChaine = new Map();
      const aller = (n, pile) => { const f = n.callFrame; const ici = (f.functionName || '(anon)') + '@' + String(f.url || '').split('/').pop() + ':' + f.lineNumber + ':' + f.columnNumber; const p2 = [ici, ...pile].slice(0, 6);
        if (n.selfSize) { parLieu.set(ici, (parLieu.get(ici) || 0) + n.selfSize); const k = p2.join(' ← '); parChaine.set(k, (parChaine.get(k) || 0) + n.selfSize); }
        for (const c of n.children || []) aller(c, p2); };
      aller(profile.head, []);
      console.log('    tas vivant alloué pendant les tours (lieu) : ' + [...parLieu.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, o]) => Math.round(o / 1048576) + ' Mo ' + k).join('\n        '));
      console.log('    (chaînes) : ' + [...parChaine.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, o]) => Math.round(o / 1048576) + ' Mo ' + k).join('\n        '));
    }
    console.log(`  mémoire après ${TOURS} tours : ${mN.mo} Mo · ${mN.noeuds} nœuds · ${mN.ecouteurs} écouteurs`);
    // INSTANTANE=<fichier> : un instantané du tas (format DevTools) après les tours — pour chercher qui retient les nœuds
    // détachés (scratchpad, jamais dans le dépôt).
    if (process.env.INSTANTANE) { const morceaux = []; const f = (e) => morceaux.push(e.chunk); cdp.on('HeapProfiler.addHeapSnapshotChunk', f); await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: false }); cdp.off('HeapProfiler.addHeapSnapshotChunk', f); fs.writeFileSync(process.env.INSTANTANE, morceaux.join('')); console.log('    instantané : ' + process.env.INSTANTANE); }
    const instN = await pg.evaluate(() => (window.__vrmInstances ? window.__vrmInstances() : {}));
    const croit = Object.keys(instN).map((k) => [k, (inst1[k] || 0), instN[k]]).filter(([, a, b]) => b > a).sort((x, y) => (y[2] - y[1]) - (x[2] - x[1]));
    console.log('    composants montés qui s\'accumulent : ' + (croit.length ? croit.slice(0, 15).map(([k, a, b]) => k + ' ' + a + '→' + b).join(' · ') : 'aucun') + ' · total ' + Object.values(inst1).reduce((s, n) => s + n, 0) + '→' + Object.values(instN).reduce((s, n) => s + n, 0));
    sortie.memoire = { un: m1, n: mN, croit };
    dit(mN.mo - m1.mo <= SEUIL_FUITE_MO, `M tas après ${TOURS} tours − après 1 tour : ${Math.round((mN.mo - m1.mo) * 10) / 10} Mo ≤ ${SEUIL_FUITE_MO}`);
    dit(mN.ecouteurs - m1.ecouteurs <= 300, `M écouteurs d'événements : ${m1.ecouteurs} → ${mN.ecouteurs} (+${mN.ecouteurs - m1.ecouteurs} ≤ 300)`);
    if (process.env.CAPTURE) await pg.screenshot({ path: process.env.CAPTURE }).catch(() => {});
    await ctx.close();
  } catch (e) { dit(false, 'banc interrompu : ' + String(e && e.stack || e).slice(0, 300)); }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(sortie, null, 1));
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc latence-repos : ${ok} OK · ${ko} KO`);
  if (KO.length) console.log(KO.map((x) => '   · ' + x).join('\n'));
  process.exit(ko ? 1 : 0);
})();
