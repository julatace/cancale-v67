// ════════════════════════════════════════════════════════════════════════════
//  BANC « TOUT BEAUCOUP PLUS FLUIDE » (22 nov. — Julien : « je veux que tout soit beaucoup plus fluide »).
//  Récit : docs/passation/2026-11-22-apres-finale-app.md §2 bis.
//    node scripts/bancs/fluidite-generale.cjs <dist> [port]     FORMATS=tel,ordi · CPU=4 · JSON=<fichier>
//  Comme chez lui : iPhone simulé 390 × 844 densité 3, tactile, CPU ×4, 4G (150 ms, 9 Mbit/s) pour les fichiers ET la
//  base (servie par le banc, base INVENTÉE au volume de la sienne, `_base-volume`) ; ordinateur 1512 × 945.
//  Il JUGE :
//    L. lectures répétées : à l'ouverture de Ma journée (40 s), la MÊME lecture (même ligne, même projection) ne part
//       qu'une fois — et une même ligne au plus 2 fois (deux projections différentes) ;
//    I. réponse au toucher (Event Timing API, `interactionId`, durée = du toucher à l'image suivante) < 100 ms pour les
//       onglets (2e tour, données déjà là), les segments (Ventes, Annonces, Messages) ; changement d'onglet jusqu'au
//       contenu utile (`data-attente="pret"` visible) < 300 ms quand la donnée est déjà là ;
//    D. défilement d'Annonces et de Ventes au doigt : images par seconde ≥ 50 (cible 60), aucune tâche > 100 ms.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 4796);
const CPU = +(process.env.CPU || 4);
const RTT = 150, DEBIT = 9e6 / 8;
const FORMATS = String(process.env.FORMATS || 'tel,ordi').split(',');
const SEUIL_INP = Number(process.env.SEUIL_INP || 100), SEUIL_ONGLET = Number(process.env.SEUIL_ONGLET || 300), SEUIL_FPS = Number(process.env.SEUIL_FPS || 50);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0, ko = 0; const KO = []; const sortie = {};
const dit = (bon, quoi) => { if (bon) ok++; else { ko++; KO.push(quoi); } console.log((bon ? '  ✅ ' : '  ❌ ') + quoi); };
const PHOTO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGOs6FnAQApgIkn1qIZRDUNKAwA3KwHEWgvY/wAAAABJRU5ErkJggg==', 'base64');

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webp': 'image/webp' };
const gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 6 })); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(gz.get(p)); }
  r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(fs.readFileSync(p));
}).listen(PORT);

const LECTURES = [];
async function preparer(ctx) {
  await ctx.addInitScript(() => {
    try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {}
    if (window.name === 'garde-debug' || /garde-debug/.test(location.hash)) window.__vrmGardeDebug = true;
    // Les interactions (Event Timing) : durée du toucher à l'image suivante.
    window.__vrmInter = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__vrmInter.push({ t: Math.round(e.startTime), d: Math.round(e.duration), nom: e.name, cible: e.target && e.target.getAttribute ? (e.target.closest('[data-n-onglet],[data-nav-entree],[role=radio],[role=tab],button') || e.target).getAttribute('data-n-onglet') || e.target.textContent.trim().slice(0, 24) : '' }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (_) {}
    // Du doigt posé à l'image qui suit la réponse : un rAF posé pendant le `click` (capture) court APRÈS les gestionnaires
    // de ce clic et le rendu synchrone de React, juste avant l'image suivante. (L'Event Timing de Chromium ne voit pas les
    // touchers synthétisés par Playwright.)
    window.__vrmTap = []; let tDown = 0;
    addEventListener('pointerdown', () => { tDown = performance.now(); }, true);
    addEventListener('click', () => { const t0 = tDown || performance.now(); requestAnimationFrame(() => { window.__vrmTap.push(Math.round(performance.now() - t0)); }); }, true);
    window.__vrmLongues = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vrmLongues.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  });
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route(/^https:\/\/images\d*\.vinted\.net\//i, async (r) => { await attendre(RTT); return r.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: PHOTO }).catch(() => {}); });
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') { await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }).catch(() => {}); }
    LECTURES.push({ t: Date.now(), u: decodeURIComponent(rq.url()).replace(/^.*\/rest\/v1\//, ''), range: (await rq.allHeaders()).range || '' });
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    await attendre(RTT + Math.round(body.length / DEBIT * 1000));
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body }).catch(() => {});
  });
  await ctx.route('**/api/**', async (r) => { const u = r.request().url();
    const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }).catch(() => {}); });
}
async function cdpDe(pg) { const cdp = await pg.context().newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 }); return cdp; }
const pret = (pg, id, ms = 60000) => pg.waitForSelector(`.vrm-main [data-attente-ecran="${id}"][data-attente="pret"], .vrm-main [data-attente-ecran="${id}"][data-attente="plafond"]`, { timeout: ms, state: 'attached' }).catch(() => {});
const calme = (pg, sans = 1500, max = 25000) => pg.evaluate(([sans, max]) => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > sans || performance.now() - t0 > max) { clearInterval(iv); ok(); } }, 100); }), [sans, max]).catch(() => {});
const ONGLETS = ['annonces', 'ventes', 'achats', 'compta', 'journee'];
const selOnglet = (o) => (o === 'annonces' ? '[data-n-onglet="paires"]:visible, [data-n-onglet="annonces"]:visible, [data-nav-entree="annonces"]:visible' : `[data-n-onglet="${o}"]:visible, [data-nav-entree="${o}"]:visible`);
const cle = (u) => { const id = (/[?&]id=([^&]+)/.exec(u) || [])[1] || (/(vinted_accounts)/.exec(u) || [])[1] || '?'; const sel = (/[?&]select=([^&]+)/.exec(u) || [])[1] || ''; return { id, sel, tout: u.replace(/&?(limit|offset)=\d+/g, '') }; };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  console.log(`Banc fluidite-generale · ${path.relative(process.cwd(), DIST) || DIST} · CPU ×${CPU} · 4G`);
  try {
    for (const fmt of FORMATS) {
      const tel = fmt === 'tel';
      const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', serviceWorkers: 'allow' }
        : { viewport: { width: 1512, height: 945 }, locale: 'fr-FR', serviceWorkers: 'allow' });
      await preparer(ctx);
      const pg = await ctx.newPage(); const cdp = await cdpDe(pg);
      if (process.env.GARDE_DEBUG) await pg.addInitScript(() => { window.__vrmGardeDebug = true; });
      pg.on('console', (m) => { const t = m.text(); if (/^dbg/.test(t)) console.log('      ' + t.slice(0, 260)); });
      // ── L. Lectures à l'ouverture de Ma journée ──
      LECTURES.length = 0;
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await pret(pg, 'journee', 120000); await calme(pg, 2000, 40000); await attendre(4000);
      const par = new Map(), parId = new Map();
      for (const l of LECTURES) { const k = cle(l.u); const kk = k.tout + '|' + l.range; par.set(kk, (par.get(kk) || 0) + 1); parId.set(k.id, (parId.get(k.id) || 0) + 1); }
      // Les lignes des SITES (annonces, commandes, ventes des autres plateformes, transactions) : lourdes, et sans raison
      // d'être relues pendant l'ouverture (rien ne les écrit). Une relecture après une écriture de la ligne est permise (2).
      const SITE = /^(eq\.(ebay_(listings|orders|programmees)|vc_(listings|ventes)|lbc_(ventes|accounts|listings)|vinted_lbc_posted)|in\.\((vc|lbc|ebay)_)/;
      const doubles = [...par.entries()].filter(([k, n]) => n > 2 && SITE.test(cle(k).id)).sort((a, b) => b[1] - a[1]);
      const lourds = [...parId.entries()].filter(([k, n]) => n > 3 && SITE.test(k)).sort((a, b) => b[1] - a[1]);
      console.log('  [' + fmt + '] lignes les plus lues : ' + [...parId.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => n + '× ' + k).join(' ; '));
      console.log(`  [${fmt}] ${LECTURES.length} lectures à l'ouverture de Ma journée`);
      dit(!doubles.length, `${fmt} L1 une même lecture d'une ligne de site part 2 fois au plus (${doubles.slice(0, 6).map(([k, n]) => n + '× ' + k.slice(0, 70)).join(' ; ')})`);
      dit(!lourds.length, `${fmt} L2 une ligne de site lue 3 fois au plus, toutes projections (${lourds.slice(0, 8).map(([k, n]) => n + '× ' + k).join(' ; ')})`);
      sortie[fmt] = { lectures: LECTURES.length, doubles: doubles.slice(0, 20), parId: [...parId.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20) };
      // Une visite de chaque onglet (les données arrivent, les écrans se gardent)
      for (const o of ONGLETS) { await pg.locator(selOnglet(o)).first()[tel ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {}); await pret(pg, o); await calme(pg, 1500, 20000); }
      // ── I. Toucher d'onglet, données déjà là (2e tour) ──
      const tours = [];
      const NT = Number(process.env.TOURS || 5);
      for (let tour = 0; tour < NT; tour++) for (const o of ONGLETS) {
        const perimes = await pg.evaluate(() => { const L = (window.__vrmPerimes || []).slice(); window.__vrmPerimes = []; return L; });
        if (perimes.length) console.log('      écrans gardés rendus périmés avant ' + o + ' par : ' + [...new Set(perimes)].join(', '));
        // Une feuille ouverte par l'écran d'avant (« Nouveau », une série…) couvre la barre : il la refermerait d'abord (Échap).
        for (let k = 0; k < 3; k++) { const f = await pg.locator('.n-feuille:visible, [role="dialog"][aria-modal="true"]:visible').count().catch(() => 0); if (!f) break; if (k === 0) console.log('      feuille ouverte avant ' + o + ' : refermée'); await pg.keyboard.press('Escape').catch(() => {}); await attendre(400); }
        await pg.evaluate(() => { window.__vrmInter = []; window.__vrmTap = []; });
        if (process.env.PROFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
        const t0 = await pg.evaluate(() => performance.now());
        await pg.locator(selOnglet(o)).first()[tel ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {});
        const tU = await pg.evaluate((id) => new Promise((ok) => { const t0 = performance.now(); const v = () => { const m = document.getElementById('vrm-contenu') || document.querySelector('#root .vrm-main'); const e = m && m.getAttribute('data-ecran'); const vise = id === 'annonces' ? /annonces|paires/ : id === 'compta' ? /compta|argent|dashboard/ : new RegExp(id); if (!e || !vise.test(e)) { if (performance.now() - t0 > 8000) { console.log('dbg ecran', id, e); return ok(null); } return requestAnimationFrame(v); } const att = m.querySelector(`[data-attente-ecran="${e}"][data-attente="pret"], [data-attente-ecran="${e}"][data-attente="plafond"]`); const gardes = [...m.querySelectorAll('.vrm-ecran-vivant')].filter((x) => x.getClientRects().length); const a = (att && [...att.children].reverse().find((c) => !c.classList.contains('vrm-attente-cache'))) || gardes.find((x) => x.getBoundingClientRect().height > 50); const r = a && a.getBoundingClientRect(); if (r && r.height > 50 && r.top < innerHeight && r.bottom > 0) return ok(performance.now()); if (!window.__vrmDbgU && performance.now() - t0 > 7900) { window.__vrmDbgU = 1; console.log('dbg', id, !!att, att && att.outerHTML.slice(0, 200)); } if (performance.now() - t0 > 8000) return ok(null); requestAnimationFrame(v); }; v(); }), o === 'annonces' ? 'annonces' : o);
        if (tU == null && process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${fmt}-pas-vu-${o}-${tour}.png`) }).catch(() => {}); }
        await calme(pg, 1000, 8000);
        if (process.env.PROFIL) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const parId = new Map(profile.nodes.map((n) => [n.id, n]));
          const dt = profile.timeDeltas || []; const cnt = new Map(); (profile.samples || []).forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
          for (const [id, us] of cnt) { const n = parId.get(id); const f = n.callFrame; const k = (f.functionName || '(anon)') + ' ' + String(f.url || '').split('/').pop() + ':' + f.lineNumber; self.set(k, (self.get(k) || 0) + us); }
          console.log('      profil ' + o + ' : ' + [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, us]) => Math.round(us / 1000) + 'ms ' + k).join(' | ')); }
        const inter = await pg.evaluate(() => window.__vrmInter.map((x) => x.d).concat(window.__vrmTap));
        const inp = inter.length ? Math.max(...inter) : null;
        const mur = tU == null ? null : Math.round(tU - t0);
        tours.push({ o, inp, mur });
        console.log(`      tour ${tour + 1} · ${o} : toucher ${inp} ms · contenu ${mur} ms`);
        if (process.env.GARDE_DEBUG) { const e = await pg.evaluate(() => { const L = (window.__vrmGardeEcarts || []).slice(); window.__vrmGardeEcarts = []; return L; }); if (e.length) console.log('      écarts du rendu gardé : ' + [...new Set(e)].slice(0, 6).join(' || ').slice(0, 1200)); }
      }
      // La MÉDIANE de chaque onglet sur NT tours (la machine partagée fait varier une mesure seule d'un facteur 10).
      const med = (L) => { const a = L.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
      for (const o of ONGLETS) {
        const T = tours.filter((x) => x.o === o);
        const mi = med(T.map((x) => x.inp)), mm = med(T.map((x) => x.mur));
        const pasVus = T.filter((x) => x.mur == null).length;
        (sortie.medianes = sortie.medianes || {})[fmt + ':' + o] = { toucher: mi, contenu: mm, pasVus, n: T.length };
        dit(mi != null && mi < SEUIL_INP, `${fmt} I onglet ${o} : réponse au toucher, médiane de ${T.length} = ${mi} ms < ${SEUIL_INP}`);
        dit(mm != null && mm < SEUIL_ONGLET && pasVus <= T.length / 2, `${fmt} I onglet ${o} : contenu utile, médiane = ${mm} ms < ${SEUIL_ONGLET} (données déjà là ; ${pasVus} tour(s) sans contenu en 8 s)`);
      }
      // Segments
      const segs = [['ventes', '[data-vn-segment], [data-n-segmente] [role=radio], .n-segmente button'], ['annonces', '[data-eg-segment]'], ['compta', '.n-segmente button, [data-n-segmente] [role=radio]']];
      for (const [o, sel] of segs) {
        await pg.locator(selOnglet(o)).first()[tel ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {}); await pret(pg, o); await calme(pg, 1000, 10000);
        const L = pg.locator(sel + ':visible'); const n = await L.count();
        for (let i = 1; i < Math.min(n, 3); i++) {
          await pg.evaluate(() => { window.__vrmInter = []; window.__vrmTap = []; });
          await L.nth(i)[tel ? 'tap' : 'click']({ timeout: 5000 }).catch(() => {});
          await calme(pg, 800, 6000);
          const inter = await pg.evaluate(() => window.__vrmInter.map((x) => x.d).concat(window.__vrmTap));
          const inp = inter.length ? Math.max(...inter) : null;
          dit(inp != null && inp < SEUIL_INP, `${fmt} I segment ${o} n°${i} : réponse ${inp} ms < ${SEUIL_INP}`);
        }
        if (n > 1) { await L.nth(0)[tel ? 'tap' : 'click']({ timeout: 5000 }).catch(() => {}); await calme(pg, 800, 6000); }
      }
      // ── D. Défilement ──
      for (const o of ['annonces', 'ventes']) {
        await pg.locator(selOnglet(o)).first()[tel ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {}); await pret(pg, o); await calme(pg, 1000, 10000);
        await pg.evaluate(() => { window.__vrmLongues = []; window.__vrmImg = 0; window.__vrmOn = true; const f = () => { if (!window.__vrmOn) return; window.__vrmImg++; requestAnimationFrame(f); }; requestAnimationFrame(f); });
        if (process.env.PROFIL_DEFILE) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
        const t0 = Date.now();
        for (let k = 0; k < 6; k++) {
          if (tel) { await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 600, yDistance: -600, speed: 1200, gestureSourceType: 'touch' }).catch(() => {}); }
          else await pg.mouse.wheel(0, 700);
          await attendre(150);
        }
        const d = (Date.now() - t0) / 1000;
        if (process.env.PROFIL_DEFILE) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const parId = new Map(profile.nodes.map((n) => [n.id, n]));
          const dt = profile.timeDeltas || []; const cnt = new Map(); (profile.samples || []).forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
          for (const [id, us] of cnt) { const n = parId.get(id); const f = n.callFrame; const k = (f.functionName || '(anon)') + ' ' + String(f.url || '').split('/').pop() + ':' + f.lineNumber + ':' + f.columnNumber; self.set(k, (self.get(k) || 0) + us); }
          // Qui appelle les fonctions natives coûteuses (querySelector, getBoundingClientRect…) : le parent dans l'arbre d'appels.
          const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n);
          const appelants = new Map();
          for (const [id, us] of cnt) { const n = parId.get(id); if (!/^(querySelector|querySelectorAll|getBoundingClientRect|matches|getComputedStyle|closest)$/.test(n.callFrame.functionName)) continue; let p = parent.get(id); const ch = []; for (let k = 0; k < 3 && p; k++) { const f = p.callFrame; ch.push((f.functionName || '(anon)') + '@' + String(f.url || '').split('/').pop() + ':' + f.lineNumber + ':' + f.columnNumber); p = parent.get(p.id); } const kk = n.callFrame.functionName + ' ← ' + ch.join(' ← '); appelants.set(kk, (appelants.get(kk) || 0) + us); }
          console.log('      appelants ' + o + ' : ' + [...appelants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, us]) => Math.round(us / 1000) + 'ms ' + k).join(' || '));
          console.log('      profil défilement ' + o + ' : ' + [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, us]) => Math.round(us / 1000) + 'ms ' + k).join(' | ')); }
        const r = await pg.evaluate(() => { window.__vrmOn = false; return { img: window.__vrmImg, longues: window.__vrmLongues.map((x) => x.d) }; });
        const fps = Math.round(r.img / d), maxL = r.longues.length ? Math.max(...r.longues) : 0;
        dit(fps >= SEUIL_FPS, `${fmt} D défilement ${o} : ${fps} images/s ≥ ${SEUIL_FPS}`);
        dit(maxL <= 100, `${fmt} D défilement ${o} : plus longue tâche ${maxL} ms ≤ 100`);
        await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); });
      }
      sortie[fmt].onglets = tours;
      await cdp.detach().catch(() => {}); await ctx.close();
    }
  } catch (e) { dit(false, 'banc interrompu : ' + String(e && e.stack || e).slice(0, 300)); }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(sortie, null, 1));
  await nav.close(); srv.close();
  console.log(`\n${ko ? '❌' : '✅'} banc fluidite-generale : ${ok} OK · ${ko} KO`);
  if (KO.length) console.log(KO.map((x) => '   · ' + x).join('\n'));
  process.exit(ko ? 1 : 0);
})();
