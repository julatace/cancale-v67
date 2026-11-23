// ════════════════════════════════════════════════════════════════════════════
//  BANC « LIGHTHOUSE » (22 nov., latence-totale) — le score Lighthouse mobile du BUILD, servi en local comme Vercel
//  (compressé, /assets immuables), base INVENTÉE au volume de la sienne (`_base-volume`) servie à la place de Supabase.
//    node scripts/bancs/lighthouse-app.cjs <dist> [port]      MODES=app,vitrine · TOURS=1 · JSON=<fichier>
//  Il faut Lighthouse et puppeteer-core quelque part : LH_MODULES=<dossier node_modules> (jamais dans le dépôt).
//  Préréglage MOBILE de Lighthouse (Moto G : CPU ×4 simulé, 4G lente 1,6 Mbit/s simulée, 412 px).
//  `app` : comme un vendeur déjà connecté (`vrm_acces_direct`), arrivée sur Aujourd'hui ; `vitrine` : la page d'accueil publique.
//  Il RAPPORTE : score, FCP, LCP, TBT, CLS, SI, et les occasions (octets gagnables, JS inutilisé…).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const LH = process.env.LH_MODULES;
if (!LH) { console.log('LH_MODULES=<dossier node_modules contenant lighthouse et puppeteer-core> manquant'); process.exit(2); }
const puppeteer = require(path.join(LH, 'puppeteer-core'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const { SCRIPT_PORTE_BANC } = require(path.join(__dirname, '_porte-banc.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || 4797);
const MODES = String(process.env.MODES || 'app,vitrine').split(',');
const TOURS = +(process.env.TOURS || 1);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const gz = new Map();
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) { if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 9 })); r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(gz.get(p)); }
  r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(fs.readFileSync(p));
}).listen(PORT);
const med = (L) => { const a = L.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : null; };

(async () => {
  const { default: lighthouse } = await import(path.join(LH, 'lighthouse', 'core', 'index.js'));
  const sortie = {};
  for (const mode of MODES) {
    const tours = [];
    for (let t = 0; t < TOURS; t++) {
      const nav = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
      const page = await nav.newPage();
      // La session de banc de `_porte-banc` (un vendeur fictif ; jamais un vrai compte) : sans elle, l'écran de connexion.
      if (mode === 'app') { await page.evaluateOnNewDocument(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} }); await page.evaluateOnNewDocument(SCRIPT_PORTE_BANC.replace(/__UID_BANC__/g, '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b')); }
      await page.emulateMediaFeatures([]).catch(() => {});
      await page.setRequestInterception(true);
      page.on('request', (rq) => {
        const u = rq.url();
        if (/^http:\/\/localhost:/.test(u)) return rq.continue();
        if (/\/rest\/v1\//.test(u)) {
          if (rq.method() === 'OPTIONS') return rq.respond({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' } });
          if (rq.method() !== 'GET') return rq.respond({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
          const rep = repondre(u, rq.headers().range, base);
          return rq.respond({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': '*', ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
        }
        if (/\/api\//.test(u)) return rq.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(/mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true } : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 }) });
        return rq.abort();
      });
      const url = `http://localhost:${PORT}/` + (mode === 'app' ? '?tab=journee' : '');
      const r = await lighthouse(url, { output: 'json', logLevel: 'error', onlyCategories: ['performance'], disableStorageReset: mode === 'app', locale: 'fr' }, undefined, page);
      const a = r.lhr.audits; const n = (k) => (a[k] && a[k].numericValue != null ? Math.round(a[k].numericValue * (k === 'cumulative-layout-shift' ? 1000 : 1)) / (k === 'cumulative-layout-shift' ? 1000 : 1) : null);
      const occ = Object.values(a).filter((x) => x.details && (x.details.type === 'opportunity' || x.details.overallSavingsMs > 0 || x.details.overallSavingsBytes > 0) && (x.score == null || x.score < 0.9)).map((x) => ({ id: x.id, titre: x.title, ms: Math.round(x.details.overallSavingsMs || 0), ko: Math.round((x.details.overallSavingsBytes || 0) / 1024), affiche: x.displayValue || '' }));
      const diag = ['mainthread-work-breakdown', 'bootup-time', 'dom-size', 'total-byte-weight', 'long-tasks', 'render-blocking-resources', 'render-blocking-insight', 'unused-javascript', 'unused-css-rules', 'font-display', 'font-display-insight', 'uses-responsive-images', 'image-delivery-insight', 'legacy-javascript', 'legacy-javascript-insight', 'duplicated-javascript', 'duplicated-javascript-insight', 'third-parties-insight', 'network-dependency-tree-insight', 'lcp-discovery-insight', 'forced-reflow-insight', 'dom-size-insight'].filter((k) => a[k]).map((k) => ({ id: k, score: a[k].score, affiche: a[k].displayValue || '', ms: a[k].numericValue != null ? Math.round(a[k].numericValue) : null }));
      const res = { score: Math.round((r.lhr.categories.performance.score || 0) * 100), FCP: n('first-contentful-paint'), LCP: n('largest-contentful-paint'), TBT: n('total-blocking-time'), CLS: n('cumulative-layout-shift'), SI: n('speed-index'), TTI: n('interactive'), occ, diag };
      if (process.env.LH_HTML) { const { ReportGenerator } = await import(path.join(LH, 'lighthouse', 'report', 'generator', 'report-generator.js')).catch(() => ({})); if (ReportGenerator) fs.writeFileSync(`${process.env.LH_HTML}-${mode}-${t}.html`, ReportGenerator.generateReport(r.lhr, 'html')); fs.writeFileSync(`${process.env.LH_HTML}-${mode}-${t}.json`, JSON.stringify(r.lhr)); }
      tours.push(res);
      console.log(`  [${mode} ${t + 1}/${TOURS}] score ${res.score} · FCP ${res.FCP} ms · LCP ${res.LCP} ms · TBT ${res.TBT} ms · CLS ${res.CLS} · SI ${res.SI} ms · TTI ${res.TTI} ms`);
      if (t === 0) { for (const o of occ) console.log(`      occasion ${o.id} : ${o.ms} ms · ${o.ko} Ko ${o.affiche}`); for (const d of diag) if (d.score != null && d.score < 0.9) console.log(`      diag ${d.id} : ${d.affiche} (score ${d.score})`); }
      await nav.close();
    }
    const m = {}; for (const k of ['score', 'FCP', 'LCP', 'TBT', 'CLS', 'SI', 'TTI']) m[k] = med(tours.map((x) => x[k]));
    sortie[mode] = { mediane: m, tours };
    console.log(`  [${mode}] MÉDIANE de ${TOURS} : score ${m.score} · FCP ${m.FCP} · LCP ${m.LCP} · TBT ${m.TBT} · CLS ${m.CLS} · SI ${m.SI} · TTI ${m.TTI}`);
  }
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(sortie, null, 1));
  srv.close(); process.exit(0);
})().catch((e) => { console.log('banc interrompu : ' + (e && e.stack || e)); srv.close(); process.exit(1); });
