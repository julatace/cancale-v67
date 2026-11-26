// ════════════════════════════════════════════════════════════════════════════
//  BANC « DÉMARRAGE : À FROID ET AU RETOUR » (23 nov., latence-2 — Julien : « l'app prend encore du temps à charger »).
//    node scripts/bancs/demarrage-retour.cjs [dist] [port]     PASSES=3 · CPU=4 · JSON=<fichier>
//  iPhone simulé 390 × 844, tactile, CPU ×4, 4G (150 ms, 9 Mbit/s) pour les fichiers ET la base (base INVENTÉE au volume de la
//  sienne, `_base-volume` ; rien de réel, aucune écriture ne sort), fichiers servis comme Vercel (compressés, /assets immuables).
//  Chaque passe, un navigateur NEUF :
//    FROID  : première ouverture de Ma journée — premier écran utile (`data-attente="pret"` visible, vrais chiffres), la COPIE
//             montrée avant (src/copieEcran.js, s'il y en a), le JS/CSS téléchargé, les lectures base (nombre, octets JSON) et le
//             travail bloquant (tâches > 50 ms) avant l'écran utile ;
//    RETOUR : la même page rouverte (même navigateur : cache HTTP, IndexedDB `copieLignes`, copies d'écran) — les mêmes mesures.
//  Il RAPPORTE (médianes) ; il JUGE seulement l'absence d'erreur de page. Seuils de Julien (23 nov.) : < 1,5 s à froid, < 0,5 s au retour.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 20000 + Math.floor(Math.random() * 9000));
const PASSES = +(process.env.PASSES || 3), CPU = +(process.env.CPU || 4), RTT = 150, DEBIT = 9e6 / 8;
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp' };
const gz = new Map(); let FICHIERS = [];
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 6 })); const b = gz.get(p); FICHIERS.push({ f, o: b.length, t }); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(b); }
  const b = fs.readFileSync(p); FICHIERS.push({ f, o: b.length, t }); r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(b);
}).listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const med = (L) => { const a = L.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  const R = { froid: [], retour: [] }; const erreurs = [];
  try {
    for (let p = 0; p < PASSES; p++) {
      const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR', serviceWorkers: 'block' });
      await ctx.addInitScript(() => {
        try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {}
        window.__lt = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
        window.__copie = null; window.__pret = null;
        const v = () => { const t = performance.now();
          if (window.__copie == null && document.querySelector('[data-copie-ecran]')) window.__copie = t;
          const e = [...document.querySelectorAll('[data-attente-ecran="journee"][data-attente="pret"]')].find((x) => x.getClientRects().length && x.getBoundingClientRect().height > 50);
          if (e && !document.getElementById('vrm-demarrage')) { window.__pret = t; return; } requestAnimationFrame(v); };
        requestAnimationFrame(v);
      });
      let LECT = [];
      await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
      await ctx.route('**/rest/v1/**', async (route) => { const rq = route.request(); if (rq.method() !== 'GET') { await attendre(RTT); return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }).catch(() => {}); }
        const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base); const body = JSON.stringify(rep.body); LECT.push({ t: Date.now(), o: body.length });
        await attendre(RTT + Math.round(body.length / DEBIT * 1000)); return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body }).catch(() => {}); });
      await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true}' }).catch(() => {}));
      const pg = await ctx.newPage(); pg.on('pageerror', (e) => erreurs.push(e.message.slice(0, 160)));
      const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: 3e6 / 8 });
      for (const sorte of ['froid', 'retour']) {
        FICHIERS = []; LECT = []; const t0 = Date.now();
        if (process.env.PROFIL === sorte) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
        await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit', timeout: 120000 });
        const f = Date.now() + 90000; let m = null;
        while (Date.now() < f) { m = await pg.evaluate(() => ({ pret: window.__pret, copie: window.__copie })).catch(() => null); if (m && m.pret != null) break; await attendre(100); }
        const tPret = m && m.pret != null ? Math.round(m.pret) : null;
        if (process.env.PROFIL === sorte) { const { profile: P } = await cdp.send('Profiler.stop'); const parId = new Map(P.nodes.map((n) => [n.id, n])); const parent = new Map(); for (const n of P.nodes) for (const c of n.children || []) parent.set(c, n.id);
          const nom = (n) => (n.callFrame.functionName || '(anon)') + '@' + String(n.callFrame.url || '').split('/').pop().replace(/-[A-Za-z0-9_-]{8}\.js$/, '') + ':' + (n.callFrame.lineNumber + 1);
          const incl = new Map(), propre = new Map(); const dt = P.timeDeltas || [];
          (P.samples || []).forEach((id, i) => { const ms = (dt[i + 1] || 0) / 1000; const n0 = parId.get(id); if (!n0) return; propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms); const vus = new Set(); for (let x = id; x != null; x = parent.get(x)) { const k = nom(parId.get(x)); if (!vus.has(k)) { vus.add(k); incl.set(k, (incl.get(k) || 0) + ms); } } });
          console.log('    PROPRE : ' + [...propre].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => Math.round(v) + ' ' + k).join(' | '));
          console.log('    INCLUSIF (A-Z) : ' + [...incl].filter(([k]) => /^[A-Z]/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => Math.round(v) + ' ' + k).join(' | ')); }
        const avant = await pg.evaluate((tp) => ({ longues: Math.round((window.__lt || []).filter((x) => tp == null || x[0] < tp).reduce((a, x) => a + x[1], 0)) }), tPret).catch(() => ({}));
        const lectAvant = LECT.filter((l) => tPret != null && l.t - t0 <= tPret + 50);
        const js = FICHIERS.filter((x) => /javascript/.test(x.t)), css = FICHIERS.filter((x) => /css/.test(x.t));
        const r = { pret: tPret, copie: m && m.copie != null ? Math.round(m.copie) : null, longues: avant.longues, lectures: lectAvant.length, lecturesKo: Math.round(lectAvant.reduce((a, l) => a + l.o, 0) / 1024),
          js: js.length, jsKo: Math.round(js.reduce((a, x) => a + x.o, 0) / 1024), css: css.length, cssKo: Math.round(css.reduce((a, x) => a + x.o, 0) / 1024) };
        R[sorte].push(r);
        console.log(`  passe ${p + 1} · ${sorte} : écran utile ${r.pret} ms · copie ${r.copie ?? '—'} ms · tâches longues avant ${r.longues} ms · ${r.lectures} lectures (${r.lecturesKo} Ko) · JS ${r.js} fichiers ${r.jsKo} Ko · CSS ${r.css} ${r.cssKo} Ko (compressés, téléchargés)`);
        await attendre(9000);   // les copies d'écran et `copieLignes` se rangent au repos
      }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  const resume = (L) => Object.fromEntries(Object.keys(L[0] || {}).map((k) => [k, med(L.map((x) => x[k]))]));
  const out = { froid: resume(R.froid), retour: resume(R.retour), charge: os.loadavg()[0].toFixed(1) };
  console.log(`MÉDIANES (${PASSES} passes, charge ${out.charge}) · froid ${JSON.stringify(out.froid)} · retour ${JSON.stringify(out.retour)}`);
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ ...out, R }, null, 1));
  console.log(erreurs.length ? `❌ erreurs de page : ${[...new Set(erreurs)].slice(0, 3).join(' | ')}` : '✅ aucune erreur de page');
  process.exitCode = erreurs.length ? 1 : 0;
})();
