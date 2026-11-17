// ════════════════════════════════════════════════════════════════════════════
//  LA LATENCE DES GESTES (17 nov., lot vitesse-cache — Julien, sur iPhone :
//  « ouvrir une vente ça prend du temps, ça bug » ; « toute l'application doit
//  être beaucoup plus fluide »).
//
//    node scripts/bancs/latence-gestes.cjs <dist> [port]
//    VENTES=2000 (défaut) · ANNONCES=1000 · CPU=4 · TOURS=2 · SHOTS=<dossier>
//    JSON=<fichier> : écrit les mesures ; SEUILS=0 : mesure sans juger.
//
//  Téléphone 390 px TACTILE, processeur ×4, 4G (9 Mb/s, 60 ms), base INVENTÉE
//  (_base-volume, poids réel). Chaque geste est mesuré comme l'INP du navigateur
//  (Event Timing : du toucher à l'image qui suit — « la première réponse »), et
//  jusqu'au contenu UTILE (sélecteur posé et visible). Gestes :
//    T  chaque onglet de la barre du bas (TOURS tours : 1er = jamais vu, 2e = revu) ;
//    P  « ⋯ » (Plus) : la feuille et ses tuiles ;
//    F  une vente touchée dans Ventes (« Toutes ») ⇒ SA fiche (`[data-fiche-paire]`)
//       avec le détail de la ligne (`[data-fiche-depuis-ligne]`) ; puis fermée ;
//       trois ventes différentes ;
//    D  défiler Ventes (« Toutes ») : 30 pas de 400 px ; images longues (LoAF) cumulées.
//  Seuils (Julien, 17 nov.) : première réponse < 100 ms, contenu utile < 300 ms
//  (au ×4 ; une machine de banc encombrée est dite par sa charge, imprimée).
//  Rien de réel : base inventée ; aucune écriture ne sort de la machine.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: Number(process.env.VENTES || 2000), annonces: Number(process.env.ANNONCES || 1000) });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const TOURS = Math.max(1, Number(process.env.TOURS || 2));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-latence-gestes');
const JUGER = process.env.SEUILS !== '0';
const S_REPONSE = 100, S_UTILE = 300;
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// PROFIL=<fichier> : profil CPU (500 µs) de chaque geste, agrégé par fonction:ligne (build NON minifié).
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
  return { propre: top(propre, 40), inclusif: top(inclusif, 100) };
}
const profils = [];
// Une image d'un pixel pour les photos (un banc qui coupe les photos mesure des échecs, pas une liste).
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const juge = (m, r) => {
  if (!r) { if (JUGER) dit(false, m, 'pas mesuré'); return; }
  const txt = `réponse ${r.reponse ?? '—'} ms · utile ${r.utile ?? '—'} ms · longues ${r.longues} ms (plus longue ${r.plusLongue})`;
  if (!JUGER) { console.log('    ' + m + ' — ' + txt); return; }
  dit(r.reponse != null && r.reponse < S_REPONSE && r.utile != null && r.utile < S_UTILE, m + ` : première réponse < ${S_REPONSE} ms et contenu utile < ${S_UTILE} ms`, txt);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    window.__ev = []; window.__lt = []; window.__loaf = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ n: e.name, s: e.startTime, d: e.duration, id: e.interactionId, p: e.processingEnd - e.processingStart }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (_) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__loaf.push([e.startTime, e.duration, e.blockingDuration || 0]); }).observe({ type: 'long-animation-frame', buffered: true }); } catch (_) {}
  });
  // MISES=1 : chaque lecture de mise en page (clientWidth/Height, offset*, getBoundingClientRect, scroll*) qui
  // prend plus de 8 ms est notée (une mise en page FORCÉE) : qui l'a demandée (classe, pile courte) et combien.
  if (process.env.MISES) await ctx.addInitScript(() => {
    window.__mises = [];
    const envelopper = (proto, nom, getter) => { const d = Object.getOwnPropertyDescriptor(proto, nom); if (!d) return; const f = getter ? d.get : d.value; if (typeof f !== 'function') return;
      const w = function (...a) { const t = performance.now(); const r = f.apply(this, a); const ms = performance.now() - t; if (ms > 8) window.__mises.push({ t: Math.round(t), ms: Math.round(ms), quoi: nom, el: (this.className && String(this.className).slice(0, 40)) || this.tagName, pile: (new Error().stack || '').split('\n').slice(2, 6).map((x) => x.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\/assets\//, '').slice(0, 60)).join(' < ') }); return r; };
      Object.defineProperty(proto, nom, getter ? { ...d, get: w } : { ...d, value: w }); };
    for (const n of ['clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight', 'scrollTop', 'offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft']) envelopper(Element.prototype, n, true) || envelopper(HTMLElement.prototype, n, true);
    for (const n of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft']) envelopper(HTMLElement.prototype, n, true);
    for (const n of ['getBoundingClientRect', 'getClientRects']) envelopper(Element.prototype, n, false);
    const gcs = window.getComputedStyle; window.getComputedStyle = function (...a) { return gcs.apply(this, a); };
  });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  const reqs = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/\.(jpe?g|png|webp)(\?|$)/i.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }) : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); reqs.push({ t: Date.now(), m: rq.method(), u: rq.url() });
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    await attendre(80);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  const ecranPret = (tab) => pg.evaluate((t) => { const d = document.getElementById('vrm-demarrage'); const e = [...document.querySelectorAll(`[data-attente-ecran="${t}"]`)].find((x) => x.getClientRects().length); return !d && !!e && /pret|plafond/.test(e.getAttribute('data-attente') || ''); }, tab).catch(() => false);
  while (Date.now() - t0 < 120000 && !(await ecranPret('journee'))) await attendre(150);
  const calme = async (max = 30000) => { const f = Date.now() + max; let n = reqs.length, tc = Date.now(); while (Date.now() - tc < 3000 && Date.now() < f) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tc = Date.now(); } } await attendre(800); };
  await calme(60000);
  const charge = os.loadavg()[0].toFixed(1);
  console.log(`démarrage ${Date.now() - t0} ms · charge de la machine ${charge} sur ${os.cpus().length} cœurs`);

  // Un geste : `agir` touche ; `utileSel` (fonction évaluée dans la page) dit quand le contenu utile est là.
  async function geste(etiquette, agir, utile, fenetre = 2500) {
    await pg.evaluate(() => { window.__g0 = performance.now(); window.__ev = []; window.__utile = null; });
    await pg.evaluate((src) => { const f = new Function('return (' + src + ')()'); const z = () => { if (window.__utile != null) return; let v = false; try { v = f(); } catch (_) {} if (v) { window.__utile = performance.now() - window.__g0; return; } requestAnimationFrame(z); }; requestAnimationFrame(z); }, utile.toString());
    const tracer = process.env.TRACE_GESTE && new RegExp(process.env.TRACE_GESTE).test(etiquette);
    if (tracer) await b.startTracing(pg, { path: path.join(SHOTS, 'trace-' + etiquette.replace(/\W+/g, '-') + '.json'), categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink', 'v8.execute', 'blink.user_timing', 'disabled-by-default-devtools.timeline.frame', 'disabled-by-default-devtools.timeline.invalidationTracking'] });
    if (process.env.PROFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    await agir();
    await attendre(fenetre);
    if (tracer) await b.stopTracing();
    if (process.env.PROFIL) { const { profile } = await cdp.send('Profiler.stop'); profils.push({ geste: etiquette, ...agreger(profile) }); }
    return pg.evaluate((etq) => {
      const g0 = window.__g0;
      const ev = window.__ev.filter((e) => e.s >= g0 - 5);
      const parId = new Map(); for (const e of ev) parId.set(e.id, Math.max(parId.get(e.id) || 0, e.d));
      const reponse = parId.size ? Math.round(Math.max(...parId.values())) : (window.__utile != null ? 16 : null);   // < 16 ms : pas d'entrée (seuil de l'API)
      const lt = window.__lt.filter((x) => x[0] >= g0 - 5);
      const mises = (window.__mises || []).filter((m) => m.t >= g0 - 5);
      return { mises_n: mises.length, mises_ms: Math.round(mises.reduce((a, m) => a + m.ms, 0)), mises: mises.sort((a, b) => b.ms - a.ms).slice(0, 8), geste: etq, reponse, utile: window.__utile == null ? null : Math.round(window.__utile), longues: Math.round(lt.reduce((a, x) => a + x[1], 0)), plusLongue: Math.round(Math.max(0, ...lt.map((x) => x[1]))), traitement: Math.round(Math.max(0, ...ev.map((e) => e.p))) };
    }, etiquette);
  }
  const res = [];
  // ── T : les onglets de la barre du bas ──
  const onglets = await pg.evaluate(() => [...document.querySelectorAll('.vrm-tabbar .vrm-tab[data-nav-entree]')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-nav-entree')));
  console.log('onglets : ' + onglets.join(', '));
  const ordre = [...onglets.filter((t) => t !== 'journee'), 'journee'];
  for (let tour = 1; tour <= TOURS; tour++) {
    for (const tab of ordre) {
      const r = await geste(`T${tour} ${tab}`, () => pg.locator(`.vrm-tabbar .vrm-tab[data-nav-entree="${tab}"]`).first().tap(),
        new Function(`return () => { const e = [...document.querySelectorAll('[data-attente-ecran="${tab}"]')].find((x) => x.getClientRects().length); return !!e && /pret|plafond/.test(e.getAttribute('data-attente') || ''); }`)(), tour === 1 ? 6000 : 2500);
      if (process.env.MISES) console.log(JSON.stringify({ n: r.mises_n, ms: r.mises_ms, top: r.mises }));
      res.push(r); juge(`T onglet ${tab} (${tour === 1 ? 'première fois' : 'revu'})`, r);
      if (tour === 1) await calme(15000);
    }
  }
  // ── P : « ⋯ » ──
  if (await pg.locator('.vrm-nav-more:visible').count()) {
    const r = await geste('P plus', () => pg.locator('.vrm-nav-more:visible').first().tap(), () => [...document.querySelectorAll('.vrm-plus-tuile,.vrm-sheet-row[data-nav-entree]')].some((x) => x.getClientRects().length && x.getBoundingClientRect().bottom > 0));
    res.push(r); juge('P « ⋯ » ouvre ses tuiles', r);
    await pg.screenshot({ path: path.join(SHOTS, 'P-plus.png') });
    await pg.keyboard.press('Escape'); await attendre(600);
    if (await pg.evaluate(() => document.querySelector('.vrm-tabbar[data-plus-ouvert="1"]') != null)) { await pg.locator('.vrm-nav-more:visible').first().tap(); await attendre(600); }
  } else console.log('    P : pas de « ⋯ » dans la barre du bas');
  // ── Ventes : « Toutes » ──
  await pg.locator('.vrm-tabbar .vrm-tab[data-nav-entree="ventes"]').first().tap();
  { const f = Date.now() + 20000; while (Date.now() < f && !(await ecranPret('ventes'))) await attendre(150); }
  const seg = pg.locator('[data-ventes-seg-choix="toutes"]').first();
  if (await seg.count()) { await seg.tap(); await attendre(1500); }
  await calme(15000);
  const nLignes = await pg.evaluate(() => document.querySelectorAll('[data-fiche-ligne][data-fl-ctx="vente"]').length);
  console.log(`Ventes « Toutes » : ${nLignes} lignes de vente · ${await pg.evaluate(() => document.querySelectorAll('*').length)} nœuds`);
  if (process.env.SONDE_JS) { console.log('SONDE_JS ' + JSON.stringify(await pg.evaluate(process.env.SONDE_JS).catch((e) => String(e)))); if (process.env.SONDE_SEULE) { await b.close(); srv.close(); process.exit(0); } }
  if (process.env.SONDE) { console.log(JSON.stringify(await pg.evaluate(() => { const o = []; let e = [...document.querySelectorAll('main *')].find((x) => x.children.length === 0 && /^Vendue$/.test(x.textContent.trim()) && x.getClientRects().length); while (e && o.length < 9) { o.push(e.tagName + '.' + String(e.className).slice(0, 60) + ' ' + [...e.attributes].filter((a) => a.name.startsWith('data-') || a.name === 'role').map((a) => a.name + '=' + a.value.slice(0, 30)).join(' ')); e = e.parentElement; } return o; }), null, 1)); }
  // ── F : une vente ⇒ sa fiche ──
  for (let k = 0; k < 3; k++) {
    const cle = await pg.evaluate((k) => { const l = [...document.querySelectorAll('[data-fiche-ligne][data-fl-ctx="vente"]')].filter((x) => { const r = x.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 120; }); const x = l[k] || l[0]; return x ? x.getAttribute('data-fiche-ligne') : null; }, k);
    if (!cle) { dit(false, 'F une vente visible à toucher', 'aucune'); break; }
    const sel = `[data-fiche-ligne="${cle.replace(/"/g, '\\"')}"]`;
    const r = await geste(`F vente ${k + 1}`, async () => { const bx = await pg.locator(sel).first().locator('.vrm-ledger-sale-title, .vrm-fu-vente-txt').first().boundingBox(); await pg.touchscreen.tap(bx.x + Math.min(40, bx.width / 2), bx.y + bx.height / 2); },
      () => { const f = document.querySelector('[data-fiche-paire]'); return !!f && !!f.getClientRects().length && !!f.querySelector('[data-fiche-depuis-ligne]'); });
    res.push(r); juge(`F vente ${k + 1} touchée ⇒ sa fiche avec son détail`, r);
    if (k === 0) await pg.screenshot({ path: path.join(SHOTS, 'F-fiche-vente.png') });
    await pg.evaluate(() => { const x = document.querySelector('[data-fiche-fermer]'); if (x) x.click(); }); await attendre(1200);
  }
  // ── D : défiler Ventes ──
  {
    await pg.evaluate(() => { window.__d0 = performance.now(); });
    for (let i = 0; i < 30; i++) { await pg.mouse.move(195, 500); await pg.mouse.wheel(0, 400); await attendre(120); }
    await attendre(1200);
    const d = await pg.evaluate(() => { const l = window.__loaf.filter((x) => x[0] >= window.__d0); return { images_longues: l.length, longues_ms: Math.round(l.reduce((a, x) => a + x[1], 0)), bloquant_ms: Math.round(l.reduce((a, x) => a + x[2], 0)), plusLongue: Math.round(Math.max(0, ...l.map((x) => x[1]))), duree_ms: Math.round(performance.now() - window.__d0) }; });
    res.push({ geste: 'D defiler', ...d });
    await pg.screenshot({ path: path.join(SHOTS, 'D-ventes-defile.png') });
    const txt = `${d.images_longues} images longues · ${d.longues_ms} ms (bloquant ${d.bloquant_ms}) sur ${d.duree_ms} ms · plus longue ${d.plusLongue}`;
    if (JUGER) dit(d.plusLongue < 200 && d.bloquant_ms < 2000, 'D défiler 30 × 400 px dans Ventes : aucune image > 200 ms, moins de 2 s bloquées', txt); else console.log('    D — ' + txt);
  }
  if (erreurs.length) dit(false, 'aucune erreur de page', erreurs.slice(0, 3).join(' | '));
  if (process.env.PROFIL) fs.writeFileSync(process.env.PROFIL, JSON.stringify(profils, null, 1));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ charge, res }, null, 1));
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  await b.close(); srv.close();
  process.exit(ko && JUGER ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
