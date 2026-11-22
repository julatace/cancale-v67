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
async function cdpDe(pg) { const cdp = await pg.context().newCDPSession(pg); await cdp.send('Performance.enable').catch(() => {}); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 }); return cdp; }
const pret = (pg, id, ms = 60000) => pg.waitForSelector(`.vrm-main [data-attente-ecran="${id}"][data-attente="pret"], .vrm-main [data-attente-ecran="${id}"][data-attente="plafond"]`, { timeout: ms, state: 'attached' }).then((h) => (h ? h.dispose() : null)).catch(() => {});   // (22 nov.) poignée relâchée : gardée, elle retenait chaque écran démonté (fausse fuite, tours de plus en plus lents)
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
      if (process.env.JOURNAL) await pg.addInitScript(() => { window.__vrmJournalSuspens = []; });
      // (22 nov., P0) Chaque promesse à laquelle React s'abonne pour REPRENDRE un rendu (`then(ping, ping)`, la même fonction
      // deux fois) est notée avec son étiquette (`__vrmAttente` : « gel », « morceau … ») ; elle sort de la liste quand elle
      // se résout. Au blocage, le banc dit celles qui attendent encore.
      if (process.env.JOURNAL) await pg.addInitScript(() => {
        const T = Promise.prototype.then; const A = window.__vrmAttentes = new Map();
        Promise.prototype.then = function (a, b) {
          if (typeof a === 'function' && a === b) { try { const p = this; let e = A.get(p);
            if (!e) { e = { at: performance.now(), n: 0, tag: p.__vrmAttente || '', pile: String(new Error().stack || '').split('\n').slice(2, 9).map((x) => x.trim().replace(/https?:\/\/[^/]+\/assets\//, '')).join(' ← ') }; A.set(p, e); const fin = () => A.delete(p); T.call(p, fin, fin); }
            e.n++; e.dernier = performance.now(); e.transition = (window.__vrmTransitionOnglet || {}).id || ''; } catch (_) {} }
          return T.call(this, a, b);
        };
      });
      // (22 nov., P0) Chaque VALIDATION de React (crochet des outils de développement, posé avant l'app) : l'heure, la priorité,
      // et les composants rendus par LEUR état (mêmes props qu'avant, travail fait) — avec la classe du premier élément du DOM
      // qu'ils dessinent, pour les retrouver dans le code. Au blocage, le banc dit qui valide sans cesse.
      if (process.env.JOURNAL) await pg.addInitScript(() => {
        const V = window.__vrmValidations = [];
        const SV = window.__vrmSauves = [];
        window.addEventListener('vrm:save', (e) => { const d = (e && e.detail) || {}; SV.push({ t: Math.round(performance.now()), k: String(d.k || '?'), i: d.inchange === true ? 1 : 0 }); if (SV.length > 500) SV.splice(0, SV.length - 500); });
        for (const ev of ['vrm:ext', 'vrm:nuage-relu', 'vrm:transp-maj', 'vrm:colis', 'storage']) window.addEventListener(ev, () => { SV.push({ t: Math.round(performance.now()), k: '«' + ev + '»', i: 0 }); });
        const nom = (f) => { const t = f.elementType || f.type; return (t && (t.displayName || t.name)) || String(f.tag); };
        const classe = (f) => { for (let x = f, i = 0; x && i < 40; x = x.child, i++) if (x.tag === 5 && x.stateNode) return (x.stateNode.getAttribute && (x.stateNode.getAttribute('class') || '').split(' ').slice(0, 2).join('.')) + Object.keys((x.stateNode.dataset) || {}).slice(0, 2).map((k) => '[data-' + k + ']').join(''); return ''; };
        // Build « profiling » (arbre de diagnostic) : React offre ses crochets de profilage — début / pause / fin de chaque rendu
        // (avec ses voies), chaque composant SUSPENDU (la fibre, la promesse, les voies), chaque validation.
        const P = window.__vrmProfil = [];
        const garde = (f) => { for (let x = f, i = 0; x && i < 200; x = x.return, i++) { const p = x.memoizedProps || x.pendingProps; if (p && typeof p.nom === 'string') return p.nom; if (p && typeof p.ecran === 'string' && x.tag !== 5) return 'ecran:' + p.ecran; } return ''; };
        const hote = (f) => { for (let x = f, i = 0; x && i < 200; x = x.return, i++) if (x.tag === 5 && x.stateNode && x.stateNode.getAttribute) { const c = x.stateNode.getAttribute('class') || ''; if (c) return c.split(' ').slice(0, 2).join('.'); } return ''; };
        const noter = (e) => { e.t = Math.round(performance.now()); P.push(e); if (P.length > 600) P.splice(0, P.length - 600); };
        const crochets = {
          markRenderStarted: (l) => noter({ e: 'rendu', l: l.toString(2) }), markRenderYielded: () => noter({ e: 'pause' }), markRenderStopped: () => noter({ e: 'fin' }),
          markRenderScheduled: (l) => noter({ e: 'prévu', l: l.toString(2) }),
          markComponentSuspended: (f, w, l) => noter({ e: 'SUSPENDU', qui: nom(f), garde: garde(f), hote: hote(f), tag: (w && w.__vrmAttente) || '', l: l.toString(2) }),
          markComponentErrored: (f) => noter({ e: 'ERREUR', qui: nom(f), garde: garde(f) }),
          markCommitStarted: (l) => noter({ e: 'validation', l: l.toString(2) }), markCommitStopped: () => {},
          markLayoutEffectsStarted() {}, markLayoutEffectsStopped() {}, markPassiveEffectsStarted() {}, markPassiveEffectsStopped() {},
          markComponentRenderStarted() {}, markComponentRenderStopped() {}, markComponentPassiveEffectMountStarted() {}, markComponentPassiveEffectMountStopped() {},
          markComponentPassiveEffectUnmountStarted() {}, markComponentPassiveEffectUnmountStopped() {}, markComponentLayoutEffectMountStarted() {}, markComponentLayoutEffectMountStopped() {},
          markComponentLayoutEffectUnmountStarted() {}, markComponentLayoutEffectUnmountStopped() {}, markStateUpdateScheduled() {}, markForceUpdateScheduled() {},
        };
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: false, supportsFiber: true, renderers: new Map(), inject(internals) { try { if (internals && typeof internals.injectProfilingHooks === 'function') { internals.injectProfilingHooks(crochets); window.__vrmProfilActif = true; } } catch (_) {} return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
          onCommitFiberRoot(id, root, prio) { try {
            const qui = []; const pile = [root.current]; let n = 0;
            while (pile.length && n < 60000 && qui.length < 6) { const f = pile.pop(); n++;
              if ((f.tag === 0 || f.tag === 1 || f.tag === 11 || f.tag === 15) && f.alternate && (f.flags & 1) && f.memoizedProps === f.alternate.memoizedProps && f.memoizedState !== f.alternate.memoizedState) qui.push(nom(f) + '⟨' + classe(f) + '⟩');
              if (f.sibling) pile.push(f.sibling); if (f.child) pile.push(f.child); }
            V.push({ t: Math.round(performance.now()), prio, qui: qui.join(' ; ') }); if (V.length > 300) V.splice(0, V.length - 300);
          } catch (_) {} } };
      });
      if (process.env.SANS_SECOURS) await pg.addInitScript(() => { window.__vrmSansSecours = true; });
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
      if (process.env.JOURNAL) { const j = await pg.evaluate(() => ({ n: window.__vrmSecoursOnglet || 0, J: (window.__vrmJournalSuspens || []).slice() })).catch(() => null);
        if (j) { const imp = j.J.filter((x) => x.sorte !== 'morceau-arrive' && x.sorte !== 'morceau-attendu' || x.transition);
          console.log('      journal de la visite (transitions rejouées ' + j.n + ') : ' + imp.map((x) => x.t + ' ' + x.sorte + ':' + x.quoi.slice(0, 60) + (x.transition ? '[' + x.transition + ']' : '')).join(' | ').slice(0, 6000));
          if (process.env.JOURNAL_FICHIER) fs.appendFileSync(process.env.JOURNAL_FICHIER, JSON.stringify({ n: j.n, J: j.J }) + '\n'); } }
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
        // (22 nov., latence) Le coût du toucher par NATURE (métriques du moteur, cumulées) : style, mise en page, script.
        const metr = async () => { try { const { metrics } = await cdp.send('Performance.getMetrics'); const m = Object.fromEntries(metrics.map((x) => [x.name, x.value])); return { style: m.RecalcStyleDuration || 0, page: m.LayoutDuration || 0, script: m.ScriptDuration || 0, noeuds: m.Nodes || 0 }; } catch (_) { return null; } };
        const m0 = await metr();
        const t0 = await pg.evaluate(() => performance.now());
        await pg.locator(selOnglet(o)).first()[tel ? 'tap' : 'click']({ timeout: 20000 }).catch(() => {});
        const tU = await pg.evaluate((id) => new Promise((ok) => { const t0 = performance.now(); const v = () => { const m = document.getElementById('vrm-contenu') || document.querySelector('#root .vrm-main'); const e = m && m.getAttribute('data-ecran'); const vise = id === 'annonces' ? /annonces|paires/ : id === 'compta' ? /compta|argent|dashboard/ : new RegExp(id); if (!e || !vise.test(e)) { if (performance.now() - t0 > 8000) { console.log('dbg ecran', id, e); return ok(null); } return requestAnimationFrame(v); } const att = m.querySelector(`[data-attente-ecran="${e}"][data-attente="pret"], [data-attente-ecran="${e}"][data-attente="plafond"]`); const gardes = [...m.querySelectorAll('.vrm-ecran-vivant')].filter((x) => x.getClientRects().length); const a = (att && [...att.children].reverse().find((c) => !c.classList.contains('vrm-attente-cache'))) || gardes.find((x) => x.getBoundingClientRect().height > 50); const r = a && a.getBoundingClientRect(); if (r && r.height > 50 && r.top < innerHeight && r.bottom > 0) return ok(performance.now()); if (!window.__vrmDbgU && performance.now() - t0 > 7900) { window.__vrmDbgU = 1; console.log('dbg', id, !!att, att && att.outerHTML.slice(0, 200)); } if (performance.now() - t0 > 8000) return ok(null); requestAnimationFrame(v); }; v(); }), o === 'annonces' ? 'annonces' : o);
        if (tU == null && process.env.JOURNAL) { const j = await pg.evaluate(() => ({ en: window.__vrmTransitionOnglet || null, J: (window.__vrmJournalSuspens || []).slice(-60) })).catch(() => null); if (j && process.env.JOURNAL_FICHIER) fs.appendFileSync(process.env.JOURNAL_FICHIER, JSON.stringify({ bloque: o, en: j.en, J: j.J }) + '\n'); if (j) console.log('      journal (onglet pas montré) : transition en cours ' + JSON.stringify(j.en) + ' · ' + j.J.map((x) => x.t + ' ' + x.sorte + ':' + x.quoi + (x.transition ? '[' + x.transition + ']' : '')).join(' | ').slice(0, 3000)); }
        if (tU == null && process.env.JOURNAL) { const f = await pg.evaluate(() => {
          // L'arbre de React, au moment du blocage : chaque morceau à la demande PAS résolu (React.lazy, _status ≠ 1) et chaque
          // composant marqué INCOMPLET (il a lancé une promesse) dans le rendu en cours (l'arbre « alternate »).
          const c = document.getElementById('root'); const k = c && Object.keys(c).find((x) => x.startsWith('__reactContainer'));
          if (!k) return 'pas de racine';
          const racine = c[k].stateNode; const out = [];
          const nom = (f) => { const t = f.elementType || f.type; if (!t) return String(f.tag); if (typeof t === 'string') return t; if (t.$$typeof === Symbol.for('react.lazy')) { const p = t._payload; return 'LAZY(' + (p && p._status) + ':' + String(p && p._result).slice(0, 120) + ')'; } return t.displayName || t.name || (t.render && (t.render.displayName || t.render.name)) || (t.type && (t.type.displayName || t.type.name)) || String(f.tag); };
          const chemin = (f) => { const L = []; for (let x = f; x && L.length < 14; x = x.return) { if (x.tag === 13) L.push('SUSPENSE[' + (x.memoizedState ? 'repli' : 'contenu') + ']'); else if (typeof (x.elementType || x.type) === 'function' || (x.type && typeof x.type === 'object')) L.push(nom(x)); } return L.join(' < '); };
          for (const [quel, tete] of [['montré', racine.current], ['en cours', racine.current.alternate]]) {
            if (!tete) continue; const pile = [tete]; let n = 0;
            while (pile.length && n < 200000) { const f = pile.pop(); n++;
              const t = f.elementType || f.type;
              if (t && t.$$typeof === Symbol.for('react.lazy') && t._payload && t._payload._status !== 1) out.push(quel + ' · ' + nom(f) + ' · ' + chemin(f));
              if (quel === 'en cours' && (f.flags & 32768) && !(f.child && (f.child.flags & 32768))) out.push(quel + ' · INCOMPLET ' + nom(f) + ' · ' + chemin(f));
              // La limite qui RETIENT la transition : dans le rendu en cours elle a capturé (DidCapture, repli à poser) alors que
              // l'arbre montré a son CONTENU — React ne cache pas un contenu montré dans une transition, il attend.
              if (quel === 'en cours' && f.tag === 13 && (f.flags & 128) && f.alternate && f.alternate.memoizedState === null && f.alternate !== f) {
                const prim = f.alternate.child; let g = prim && prim.child; const sous = []; for (let i = 0; g && i < 3; i++, g = g.child) sous.push(nom(g) + (g.memoizedProps && 'fige' in g.memoizedProps ? '{fige:' + g.memoizedProps.fige + ',tab:' + g.memoizedProps.tab + '}' : ''));
                out.push('LIMITE QUI RETIENT · ' + chemin(f) + ' · contenu montré : ' + sous.join(' > ')); }
              if (f.sibling) pile.push(f.sibling); if (f.child) pile.push(f.child); }
          }
          const att = [...(window.__vrmAttentes || new Map()).values()].filter((x) => performance.now() - x.at > 2500);
          for (const x of att.slice(0, 8)) out.push('ATTENTE depuis ' + Math.round((performance.now() - x.at) / 1000) + ' s · ' + x.n + ' abonnement(s), le dernier il y a ' + Math.round((performance.now() - x.dernier) / 1000) + ' s [' + x.transition + '] · ' + (x.tag || 'sans étiquette') + ' · ' + x.pile.slice(0, 400));
          const V = (window.__vrmValidations || []).filter((x) => performance.now() - x.t < 6000);
          const SV = (window.__vrmSauves || []).filter((x) => performance.now() - x.t < 6000); const parK = new Map(); for (const x of SV) parK.set(x.k + (x.i ? ' (inchangée)' : ''), (parK.get(x.k + (x.i ? ' (inchangée)' : '')) || 0) + 1);
          out.push('ÉCRITURES (vrm:save) des 6 dernières s : ' + SV.length + ' · ' + [...parK.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => n + '× ' + k).join(' ; ').slice(0, 1500));
          out.push('VALIDATIONS des 6 dernières s : ' + V.length + ' · ' + [...new Set(V.map((x) => 'p' + x.prio + ' ' + x.qui))].slice(0, 8).join(' || ').slice(0, 1500));
          if (window.__vrmProfilActif) { const Pr = (window.__vrmProfil || []).slice(-60); out.push('PROFIL (60 derniers) : ' + Pr.map((x) => x.t + ' ' + x.e + (x.l ? ' ' + x.l : '') + (x.qui ? ' ' + x.qui + '{' + x.garde + '|' + x.hote + '|' + x.tag + '}' : '')).join(' | ').slice(0, 5000)); }
          out.unshift('voies en attente ' + racine.pendingLanes.toString(2) + ' · suspendues ' + racine.suspendedLanes.toString(2) + ' · relancées ' + racine.pingedLanes.toString(2));
          return out.slice(0, 30).join('\n        ');
        }).catch((e) => 'diag KO ' + e.message);
          console.log('      arbre au blocage :\n        ' + f); if (process.env.JOURNAL_FICHIER) fs.appendFileSync(process.env.JOURNAL_FICHIER, JSON.stringify({ arbre: o, f }) + '\n'); }
        if (tU == null && process.env.CAPTURES) { fs.mkdirSync(process.env.CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(process.env.CAPTURES, `${fmt}-pas-vu-${o}-${tour}.png`) }).catch(() => {}); }
        await calme(pg, 1000, 8000);
        if (process.env.PROFIL) { const { profile } = await cdp.send('Profiler.stop'); const self = new Map(); const parId = new Map(profile.nodes.map((n) => [n.id, n]));
          const dt = profile.timeDeltas || []; const cnt = new Map(); (profile.samples || []).forEach((id, i) => cnt.set(id, (cnt.get(id) || 0) + (dt[i] || 0)));
          for (const [id, us] of cnt) { const n = parId.get(id); const f = n.callFrame; const k = (f.functionName || '(anon)') + ' ' + String(f.url || '').split('/').pop() + ':' + f.lineNumber; self.set(k, (self.get(k) || 0) + us); }
          { const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n);
            const tot = new Map(); for (const [id, us] of cnt) { let p = parId.get(id); const ch = []; for (let k = 0; k < 7 && p; k++) { const f = p.callFrame; ch.push((f.functionName || '(anon)') + '@' + String(f.url || '').split('/').pop() + ':' + f.lineNumber + ':' + f.columnNumber); p = parent.get(p.id); } const kk = ch.join(' ← '); tot.set(kk, (tot.get(kk) || 0) + us); }
            console.log('      chaînes ' + o + ' : ' + [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, us]) => Math.round(us / 1000) + 'ms ' + k).join(' || ')); }
          console.log('      profil ' + o + ' : ' + [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, us]) => Math.round(us / 1000) + 'ms ' + k).join(' | ')); }
        const inter = await pg.evaluate(() => window.__vrmInter.map((x) => x.d).concat(window.__vrmTap));
        const inp = inter.length ? Math.max(...inter) : null;
        const mur = tU == null ? null : Math.round(tU - t0);
        const m1 = await metr();
        const cout = m0 && m1 ? { style: Math.round((m1.style - m0.style) * 1000), page: Math.round((m1.page - m0.page) * 1000), script: Math.round((m1.script - m0.script) * 1000) } : null;
        // Le contenu montré est-il celui de la visite d'avant (écran GARDÉ revenu tel quel) ou un écran remonté ?
        const noeuds = await pg.evaluate(() => { const V = window.__vrmVusBanc || (window.__vrmVusBanc = new WeakSet()); const L = [...document.querySelectorAll('[data-attente-ecran]')].filter((x) => x.getClientRects().length);
          const r = { tout: document.getElementsByTagName('*').length, ecrans: L.map((x) => x.getAttribute('data-attente-ecran') + ':' + x.getElementsByTagName('*').length + (V.has(x) ? '(revenu)' : '(neuf)')).join(' ') }; for (const x of L) V.add(x); return r; }).catch(() => null);
        tours.push({ o, inp, mur, cout, noeuds: noeuds && noeuds.tout });
        if (cout) console.log(`      coût ${o} : style ${cout.style} ms · mise en page ${cout.page} ms · script ${cout.script} ms · ${noeuds ? noeuds.tout + ' nœuds [' + noeuds.ecrans + ']' : ''}`);
        const [secours, refus] = await pg.evaluate(() => [window.__vrmSecoursOnglet || 0, window.__vrmGelRefuse || 0]).catch(() => [0, 0]);
        console.log(`      tour ${tour + 1} · ${o} : toucher ${inp} ms · contenu ${mur} ms · transitions rejouées ${secours} · gels refusés ${refus}`);
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
