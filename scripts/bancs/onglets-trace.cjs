// ════════════════════════════════════════════════════════════════════════════
//  ONGLETS, DÉCOMPOSÉS PAR TRACE (19 nov. — Julien : « la chose la plus importante est que l'app ne bug plus et
//  que ça charge plus vite entre les onglets, c'est beaucoup trop lent pour l'instant »).
//
//    node scripts/bancs/onglets-trace.cjs <dist> [port]
//    VENTES=5000 · ANNONCES=1000 · CPU=4 · RENDUS=1 (compte les rendus de Comptabilite) · JSON=<fichier>
//    SUITE=court (les 5 onglets, deux tours) | liste:achats,ventes,achats (au choix) · TRACES=<dossier> (traces brutes)
//    INVALIDATIONS=1 (qui demande les recalculs de style) · PROFIL=<fichier> (profil CPU par toucher, build non minifié)
//
//  La machine des bancs est PARTAGÉE : l'horloge murale ment (une même build varie de 1 à 2,5). Ce banc juge donc
//  sur ce qui ne dépend pas de la charge :
//    · le TEMPS DE FIL du fil principal (`tdur` des traces Chrome) : le temps où le fil TRAVAILLE, sans l'attente d'un
//      cœur libre. ⚠️ Il COMPREND le ralentissement ×4 (Chrome ralentit en faisant tourner le fil à vide, mesuré :
//      fil ≈ mur sur une machine calme) : c'est déjà « le temps d'un téléphone de milieu de gamme » ;
//    · sa DÉCOMPOSITION (temps propre de chaque évènement de la trace, fil principal) : script · style · mise en page ·
//      peinture · ramasse-miettes ;
//    · des COMPTES : recalculs de style et éléments restylés, mises en page, nœuds, lectures, rendus de `Comptabilite`
//      (RENDUS=1), l'écran revenu est-il le MÊME nœud (gardé) ou un neuf (remonté).
//  L'horloge murale est donnée à côté (réponse = Event Timing du toucher ; écran = première image de l'écran visé ;
//  utile = son attente « pret » ou « plafond »), pour mémoire.
//
//  Parcours : démarrage sur Ma journée ; 1er passage sur chaque écran (Annonces, Achats, Ventes, Argent par la barre ;
//  Messages, Stock, Paramètres par le menu du haut) ; puis les 20 paires des 5 onglets de la barre dans les deux sens
//  (un circuit : chaque toucher est mesuré) ; puis Ma journée ⇄ Messages, Stock, Paramètres.
//  Base INVENTÉE (_base-volume). Rien de réel ; aucune écriture ne sort.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: Number(process.env.VENTES || 5000), annonces: Number(process.env.ANNONCES || 1000) });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const CPU = +(process.env.CPU || 4);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p))); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(gz.get(p)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(fs.readFileSync(p)); }
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

// ── La trace : temps PROPRE de chaque évènement du fil principal, rangé par famille ─────────────
const FAMILLE = (n) => {
  if (/^(UpdateLayoutTree|RecalculateStyles|ParseAuthorStyleSheet|ScheduleStyleRecalculation|StyleRecalcInvalidationTracking|Document::updateStyle|StyleEngine)/.test(n)) return 'style';
  if (/^(Layout|UpdateLayerTree|IntersectionObserverController::computeIntersections|HitTest|ResizeObserver|LocalFrameView::layout)/.test(n)) return 'page';
  if (/^(PrePaint|Paint|PaintImage|Layerize|Commit|CompositeLayers|UpdateLayer|Decode|ImageDecode|Raster|Draw|LocalFrameView::RunPaintLifecyclePhase|LocalFrameView::RunPrePaintLifecyclePhase)/.test(n)) return 'peinture';
  if (/^(MinorGC|MajorGC|V8\.GC|BlinkGC|CppGC)/.test(n)) return 'miettes';
  if (/^(FunctionCall|EvaluateScript|v8\.|V8\.|EventDispatch|TimerFire|FireAnimationFrame|RunMicrotasks|FireIdleCallback|XHR|ProfileCall|CompileScript|CacheScript|ResourceReceive|ResourceFinish|ResourceSend|WebSocket|ParseHTML)/.test(n)) return 'script';
  return 'autre';
};
function lireTrace(tampon) {
  let ev; try { const j = JSON.parse(tampon.toString('utf8')); ev = Array.isArray(j) ? j : j.traceEvents; } catch (_) { return null; }
  if (!Array.isArray(ev)) return null;
  const marque = (nom) => ev.filter((e) => e.name === nom && /user_timing/.test(e.cat || '')).sort((a, b) => a.ts - b.ts);
  const tap = marque('vrm-banc-toucher')[0];
  if (!tap) return null;
  const ecran = marque('vrm-banc-ecran')[0], utile = marque('vrm-banc-utile')[0];
  const fil = ev.filter((e) => e.pid === tap.pid && e.tid === tap.tid && e.ph === 'X' && e.ts >= tap.ts - 2000).sort((a, b) => a.ts - b.ts || (b.dur || 0) - (a.dur || 0));
  const avecThread = fil.filter((e) => e.tdur != null).length > fil.length / 2;
  const vide = () => ({ script: 0, style: 0, page: 0, peinture: 0, miettes: 0, autre: 0 });
  const zones = { ecran: vide(), utile: vide(), tout: vide() };
  const mur = { ecran: vide(), utile: vide(), tout: vide() };
  const compte = { styles: 0, elements: 0, pages: 0, longues: 0, longues_ms: 0, plusLongue: 0, plusGrandStyle: 0, plusGrandStyle_ms: 0 };
  const pile = [];
  const fermer = (x) => {
    const propre = Math.max(0, (x.e.tdur != null ? x.e.tdur : (avecThread ? 0 : x.e.dur || 0)) - x.enfants), propreMur = Math.max(0, (x.e.dur || 0) - x.enfantsMur);
    const f = FAMILLE(x.e.name);
    zones.tout[f] += propre; mur.tout[f] += propreMur;
    if (utile && x.e.ts < utile.ts) { zones.utile[f] += propre; mur.utile[f] += propreMur; }
    if (ecran && x.e.ts < ecran.ts) { zones.ecran[f] += propre; mur.ecran[f] += propreMur; }
  };
  for (const e of fil) {
    while (pile.length && e.ts >= pile[pile.length - 1].fin) fermer(pile.pop());
    if (pile.length) { pile[pile.length - 1].enfants += (e.tdur != null ? e.tdur : (avecThread ? 0 : e.dur || 0)); pile[pile.length - 1].enfantsMur += e.dur || 0; }
    pile.push({ e, fin: e.ts + (e.dur || 0), enfants: 0, enfantsMur: 0 });
    if (e.name === 'UpdateLayoutTree' || e.name === 'RecalculateStyles') { compte.styles++; const n = (e.args && (e.args.elementCount != null ? e.args.elementCount : (e.args.beginData && e.args.beginData.elementCount))) || 0; compte.elements += n; if (n > compte.plusGrandStyle) { compte.plusGrandStyle = n; compte.plusGrandStyle_ms = Math.round((e.tdur != null ? e.tdur : e.dur || 0) / 100) / 10; } }
    if (e.name === 'Layout') compte.pages++;
    if (e.name === 'RunTask' && (e.dur || 0) >= 50000) { compte.longues++; compte.longues_ms += e.dur / 1000; compte.plusLongue = Math.max(compte.plusLongue, e.dur / 1000); }
  }
  while (pile.length) fermer(pile.pop());
  const ms = (o) => { const r = {}; let s = 0; for (const k of Object.keys(o)) { r[k] = Math.round(o[k] / 100) / 10; s += o[k]; } r.total = Math.round(s / 100) / 10; return r; };
  return { thread: avecThread, cpu: { ecran: ecran ? ms(zones.ecran) : null, utile: utile ? ms(zones.utile) : null, tout: ms(zones.tout) }, mur: { utile: utile ? ms(mur.utile) : null, tout: ms(mur.tout) },
    ecran_ms: ecran ? Math.round((ecran.ts - tap.ts) / 1000) : null, utile_ms: utile ? Math.round((utile.ts - tap.ts) / 1000) : null,
    compte: { ...compte, longues_ms: Math.round(compte.longues_ms), plusLongue: Math.round(compte.plusLongue) },
    invalidations: process.env.INVALIDATIONS ? resumerInvalidations(ev, tap) : undefined };
}
// INVALIDATIONS=1 : ce qui a demandé un recalcul de style (catégorie invalidationTracking) — par raison et par sélecteur.
function resumerInvalidations(ev, tap) {
  const par = new Map();
  for (const e of ev) {
    if (e.pid !== tap.pid || e.ts < tap.ts) continue;
    if (!/InvalidationTracking|StyleInvalidatorInvalidationTracking|StyleRecalcInvalidationTracking/.test(e.name)) continue;
    const d = (e.args && e.args.data) || {};
    const k = e.name.replace('InvalidationTracking', '') + ' · ' + (d.reason || d.extraData || '') + ' · ' + (d.nodeName || '') + (d.selectors ? ' · ' + d.selectors.map((s) => s.selector).slice(0, 2).join(' | ').slice(0, 160) : '') + (d.subtree ? ' · sous-arbre' : '');
    par.set(k, (par.get(k) || 0) + 1);
  }
  return [...par].sort((a, b) => b[1] - a[1]).slice(0, 40);
}

// PROFIL=<fichier> : profil CPU (500 µs) de chaque toucher, agrégé par fonction:ligne (build NON minifié).
function agreger(profil) {
  const parId = new Map(); for (const n of profil.nodes) parId.set(n.id, n);
  const propre = new Map(), inclusif = new Map(); const dt = profil.timeDeltas || []; const ech = profil.samples || [];
  const parent = new Map(); for (const n of profil.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const nom = (n) => (n.callFrame.functionName || '(anonyme)') + ':' + (n.callFrame.lineNumber + 1) + '@' + path.basename(n.callFrame.url || '?').replace(/-[A-Za-z0-9_-]{8}\.js$/, '');
  for (let i = 0; i < ech.length; i++) {
    const ms = (dt[i + 1] || dt[i] || 0) / 1000; let id = ech[i]; const n0 = parId.get(id);
    if (!n0 || /^\((idle|program|garbage collector)\)$/.test(n0.callFrame.functionName)) continue;
    propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms);
    const vus = new Set(); while (id != null) { const n = parId.get(id); const k = nom(n); if (!vus.has(k)) { vus.add(k); inclusif.set(k, (inclusif.get(k) || 0) + ms); } id = parent.get(id); }
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, ms]) => [f, Math.round(ms)]);
  return { propre: top(propre, 50), inclusif: top(inclusif, 120) };
}
const profils = [];
const BARRE = { journee: 'journee', annonces: 'paires', achats: 'achats', ventes: 'ventes', compta: 'compta' };
const PREMIERS = ['annonces', 'achats', 'ventes', 'compta', 'messages', 'garage', 'settings', 'journee'];
// Un circuit qui passe UNE fois par chacune des 20 paires ordonnées des 5 onglets de la barre (part de Ma journée, y revient).
const CIRCUIT = ['annonces', 'journee', 'achats', 'journee', 'ventes', 'journee', 'compta', 'annonces', 'achats', 'annonces', 'ventes', 'annonces', 'compta', 'achats', 'ventes', 'achats', 'compta', 'ventes', 'compta', 'journee'];
const MENU = ['messages', 'journee', 'garage', 'journee', 'settings', 'journee'];
const SUITES = { court: [['1er', ['annonces', 'achats', 'ventes', 'compta', 'journee']], ['2e', ['annonces', 'achats', 'ventes', 'compta', 'journee']]], complet: [['1er', PREMIERS], ['2e', CIRCUIT], ['2e', MENU]] };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript((RENDUS) => {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    window.__ev = []; window.__lt = []; window.__saves = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ s: e.startTime, d: e.duration, id: e.interactionId }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (_) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    window.addEventListener('vrm:save', (e) => { const d = e && e.detail; if (d && d.k) window.__saves.push((d.distant ? '~' : '') + d.k); });
    // Le toucher : marqué dans la trace au premier évènement du geste (capture, avant l'app).
    const marquer = () => { if (window.__attendToucher) { window.__attendToucher = false; window.__g0 = performance.now(); try { performance.mark('vrm-banc-toucher'); } catch (_) {} } };
    window.addEventListener('pointerdown', marquer, true); window.addEventListener('vrm:aller', marquer, true);
    if (RENDUS) {
      window.__commits = 0; window.__compta = 0; window.__comptaMontages = 0;
      const estCompta = (p) => p && typeof p === 'object' && 'only' in p && 'accounts' in p && 'garageGrid' in p;
      const vus = new WeakMap();
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), isDisabled: false, inject() { return 1; }, checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
        onCommitFiberRoot(id, root) { window.__commits++; try { const pile = [root.current]; while (pile.length) { const f = pile.pop(); if (!f) continue; if (f.child) pile.push(f.child); if (f.sibling) pile.push(f.sibling); if (estCompta(f.memoizedProps)) { const av = vus.has(f) ? vus.get(f) : (f.alternate && vus.has(f.alternate) ? vus.get(f.alternate) : undefined); if (av === undefined) window.__comptaMontages++; if (av === undefined || av !== f.memoizedState) window.__compta++; vus.set(f, f.memoizedState); if (f.alternate) vus.set(f.alternate, f.memoizedState); } } } catch (_) {} } };
    }
  }, !!process.env.RENDUS);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
  if (process.env.PROFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); }
  const metriques = async () => { const { metrics } = await cdp.send('Performance.getMetrics'); const o = {}; for (const m of metrics) o[m.name] = m.value; return o; };
  const reqs = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/\.(jpe?g|png|webp)(\?|$)/i.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }) : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); reqs.push({ t: Date.now(), m: rq.method(), u: decodeURIComponent(rq.url()) });
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    await attendre(80);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  const ecranIci = () => pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const m = document.querySelector('.vrm-app-shell > .vrm-main'); const e = m && m.getAttribute('data-ecran'); const a = e && [...document.querySelectorAll(`[data-attente-ecran="${e}"]`)].find((x) => x.getClientRects().length); return { e, pret: !d && !!a && /pret|plafond/.test(a.getAttribute('data-attente') || '') }; }).catch(() => ({ e: null, pret: false }));
  while (Date.now() - t0 < 180000 && !(await ecranIci()).pret) await attendre(200);
  // Le calme : ni lecture ni tâche longue depuis `ms`.
  const calme = async (ms = 1500, max = 25000) => { const f = Date.now() + max; let n = reqs.length, tc = Date.now(), l = await pg.evaluate(() => window.__lt.length).catch(() => 0); while (Date.now() - tc < ms && Date.now() < f) { await attendre(250); const l2 = await pg.evaluate(() => window.__lt.length).catch(() => l); if (reqs.length !== n || l2 !== l) { n = reqs.length; l = l2; tc = Date.now(); } } };
  await calme(3000, 90000);
  const charge0 = os.loadavg()[0];
  console.log(`démarrage ${Date.now() - t0} ms · ${reqs.filter((r) => r.m === 'GET').length} lectures · charge ${charge0.toFixed(1)} sur ${os.cpus().length} cœurs · processeur ×${CPU}`);
  const CATS = ['devtools.timeline', 'blink.user_timing', 'v8.execute', 'disabled-by-default-devtools.timeline'].concat(process.env.INVALIDATIONS ? ['disabled-by-default-devtools.timeline.invalidationTracking'] : []);
  let n = 0;
  const pas = async (passage, id) => {
    const depuis = (await ecranIci()).e; const i0 = reqs.length;
    const m0 = await metriques();
    await pg.evaluate(({ id, depuis }) => {
      window.__ev = []; window.__saves = []; window.__ecran = null; window.__utile = null; window.__g0 = null; window.__attendToucher = true;
      window.__r0 = window.__compta | 0; window.__c0 = window.__commits | 0; window.__m0 = window.__comptaMontages | 0;
      try { if (id === 'annonces') localStorage.setItem('vrm_paires_dernier', 'annonces'); } catch (_) {}
      const z = () => { if (window.__utile != null) return; if (window.__g0 != null) { const d = document.getElementById('vrm-demarrage'); const m = document.querySelector('.vrm-app-shell > .vrm-main'); const e = m && m.getAttribute('data-ecran');
        if (e === id && window.__ecran == null) { window.__ecran = performance.now() - window.__g0; try { performance.mark('vrm-banc-ecran'); } catch (_) {} }
        const a = e === id && [...document.querySelectorAll(`[data-attente-ecran="${e}"]`)].find((x) => x.getClientRects().length && !x.closest('.vrm-attente-cache'));
        if (!d && a && /pret|plafond/.test(a.getAttribute('data-attente') || '')) { window.__utile = performance.now() - window.__g0; window.__meme = !!a.__bancVu; window.__etat = a.getAttribute('data-attente'); a.__bancVu = true; try { performance.mark('vrm-banc-utile'); } catch (_) {} return; } }
        requestAnimationFrame(z); };
      requestAnimationFrame(z);
    }, { id, depuis });
    if (process.env.PROFIL) await cdp.send('Profiler.start'); else await b.startTracing(pg, { categories: CATS });
    let par = 'barre';
    if (BARRE[id]) await pg.locator(`.vrm-tabbar .vrm-tab[data-nav-entree="${BARRE[id]}"]`).first().tap();
    else {
      // Le menu du haut (l'avatar) : son ouverture n'est pas mesurée — le toucher mesuré est celui de la ligne.
      par = 'menu';
      await pg.evaluate(() => { window.__attendToucher = false; });
      const tete = pg.locator('[data-profil-tete]').first();
      let ligne = null;
      if (await tete.count()) { await tete.tap().catch(() => {}); await attendre(900); const l = pg.locator(`.vrm-profil-ligne[data-nav-entree="${id}"]`).first(); if (await l.count()) ligne = l; }
      await pg.evaluate(() => { window.__attendToucher = true; });
      if (ligne) await ligne.tap();
      else { par = 'lien'; await pg.keyboard.press('Escape').catch(() => {}); await pg.evaluate((id) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + id })), id); }
    }
    const fin = Date.now() + 40000; while (Date.now() < fin && !(await pg.evaluate(() => window.__utile != null).catch(() => false))) await attendre(100);
    await calme(1500, 20000);
    let tampon = Buffer.from('[]');
    if (process.env.PROFIL) { const { profile } = await cdp.send('Profiler.stop'); profils.push({ de: depuis, vers: id, ...agreger(profile) }); } else tampon = await b.stopTracing();
    const m1 = await metriques();
    if (process.env.TRACES) { try { fs.mkdirSync(process.env.TRACES, { recursive: true }); fs.writeFileSync(path.join(process.env.TRACES, `${String(n).padStart(2, '0')}-${depuis}-${id}.json`), tampon); } catch (_) {} }
    const t = lireTrace(tampon);
    const page = await pg.evaluate(() => { const g0 = window.__g0 || 0; const ev = window.__ev; const parI = new Map(); for (const e of ev) parI.set(e.id, Math.max(parI.get(e.id) || 0, e.d));
      const lt = window.__lt.filter((x) => x[0] >= g0 - 5);
      return { reponse: parI.size ? Math.round(Math.max(...parI.values())) : null, ecran: window.__ecran == null ? null : Math.round(window.__ecran), utile: window.__utile == null ? null : Math.round(window.__utile), meme: !!window.__meme, etat: window.__etat || null,
        longues: Math.round(lt.reduce((a, x) => a + x[1], 0)), noeuds: document.querySelectorAll('*').length, saves: [...new Set(window.__saves)].join(' '),
        rendus: window.__compta == null ? null : window.__compta - window.__r0, montages: window.__comptaMontages == null ? null : window.__comptaMontages - window.__m0, validations: window.__commits == null ? null : window.__commits - window.__c0 }; });
    const d = (k) => Math.round(((m1[k] || 0) - (m0[k] || 0)) * 10000) / 10;
    const r = { n: n++, passage, de: depuis, vers: id, par, ...page,
      thread: { tache: d('TaskDuration'), script: d('ScriptDuration'), style: d('RecalcStyleDuration'), page: d('LayoutDuration') },
      styles: (m1.RecalcStyleCount || 0) - (m0.RecalcStyleCount || 0), pages: (m1.LayoutCount || 0) - (m0.LayoutCount || 0), noeudsTous: m1.Nodes,
      lectures: reqs.slice(i0).filter((x) => x.m === 'GET').length, trace: t };
    const c = t && t.cpu.utile, tt = t && t.cpu.tout;
    console.log(`${passage} ${String(depuis).padEnd(8)} → ${id.padEnd(8)} ${r.meme ? 'gardé  ' : 'remonté'} | fil jusqu’à utile ${c ? String(c.total).padStart(6) : '     —'} ms (script ${c ? c.script : '—'} · style ${c ? c.style : '—'} · page ${c ? c.page : '—'} · peinture ${c ? c.peinture : '—'}) · jusqu’au calme ${tt ? tt.total : '—'} ms | ${t ? t.compte.styles : '—'} recalculs, ${t ? t.compte.elements : '—'} éléments restylés (le plus gros ${t ? t.compte.plusGrandStyle : '—'}) | ${r.rendus == null ? '' : r.rendus + ' rendus de Comptabilite (' + r.montages + ' montages) · '}${r.lectures} lectures · ${r.noeuds} nœuds | mur : réponse ${r.reponse ?? '—'} · écran ${r.ecran ?? '—'} · utile ${r.utile ?? '—'} ms · tâches longues ${r.longues} ms${r.saves ? ' | écrit : ' + r.saves : ''}`);
    return r;
  };
  const res = []; const vus = new Set(['journee']);
  const choix = process.env.SUITE || 'complet';
  const suite = /^liste:/.test(choix) ? choix.slice(6).split(',').filter(Boolean) : (SUITES[choix] || SUITES.complet).flatMap(([, l]) => l);
  for (const id of suite) { res.push(await pas(vus.has(id) ? '2e' : '1er', id)); vus.add(id); }
  if (process.env.PROFIL) fs.writeFileSync(process.env.PROFIL, JSON.stringify(profils, null, 1));
  const med = (l) => { const s = l.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const resume = (nom, l) => { if (!l.length) return; const u = l.map((r) => r.trace && r.trace.cpu.utile && r.trace.cpu.utile.total), t = l.map((r) => r.trace && r.trace.cpu.tout.total);
    const fam = (k) => med(l.map((r) => r.trace && r.trace.cpu.tout[k]));
    console.log(`MÉDIANE ${nom} (${l.length}) : fil (×${CPU}) jusqu’à utile ${med(u)} ms · jusqu’au calme ${med(t)} ms [script ${fam('script')} · style ${fam('style')} · page ${fam('page')} · peinture ${fam('peinture')}] · éléments restylés ${med(l.map((r) => r.trace && r.trace.compte.elements))} · mur utile ${med(l.map((r) => r.utile))} ms · réponse ${med(l.map((r) => r.reponse))} ms`); };
  console.log('');
  resume('1er passage', res.filter((r) => r.passage === '1er' && r.vers !== 'journee'));
  resume('2e passage, écran gardé', res.filter((r) => r.passage === '2e' && r.meme));
  resume('2e passage, écran remonté', res.filter((r) => r.passage === '2e' && !r.meme));
  if (erreurs.length) console.log('ERREURS DE PAGE : ' + JSON.stringify(erreurs.slice(0, 5)));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ charge: charge0, cpu: CPU, dist: DIST, erreurs, pas: res }, null, 1));
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(2); });
