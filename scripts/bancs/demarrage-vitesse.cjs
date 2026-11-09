// ════════════════════════════════════════════════════════════════════════════
//  BANC « DÉMARRAGE-VITESSE » (9 nov., chantier « vitesse-demarrage »).
//  node scripts/bancs/demarrage-vitesse.cjs [dist] [port]
//
//  Le profil des mesures de vitesse (docs/passation/2026-11-07-vitesse.md) :
//  téléphone 390 px tactile, 4G (9 Mb/s, 60 ms), processeur ×4, base inventée au
//  poids réel (_base-volume, `volumeReel`, `qr`), aucun service worker. Ouvre Ma
//  journée PASSES fois (défaut 3, un navigateur neuf à chaque fois) et juge :
//
//   D1  médiane de « prêt » (écran de démarrage parti, Ma journée posée) ≤ SEUIL_PRET_MS ;
//   D2  médiane des tâches longues avant « prêt » ≤ SEUIL_LONGUES_MS (le processeur,
//       moins sensible au réseau que D1) ;
//   D3  le cache des ventes (`sessionStorage` `vrm_acct_cache`, ~1,5 Mo) n'est JAMAIS
//       écrit avant « prêt » (mesuré : ~0,5 s d'un bloc pendant l'ouverture) ;
//   D4  formats de date créés avant « prêt » (`new Intl.DateTimeFormat` et chaque
//       `toLocale…String(locale, options)`, qui en crée un) ≤ SEUIL_FORMATS
//       (mesuré : des centaines quand chaque appel refaisait le sien) ;
//   D5  aucune erreur de page.
//
//  Les seuils viennent des mesures de la passation (2026-11-09-vitesse-demarrage.md),
//  avec une marge pour un conteneur partagé ; ils se changent par l'environnement
//  (SEUIL_PRET_MS, SEUIL_LONGUES_MS, SEUIL_FORMATS). D1/D2 dépendent de la charge
//  de la machine : un rouge sur D1/D2 seul ⇒ regarder la charge (`uptime`) et
//  relancer. D3/D4 ne dépendent pas de la charge.
//  PILES=1 : d'où viennent les formats de date (les appels les plus fréquents).
//  Rien de réel : la base est inventée ; aucune écriture n'arrive nulle part.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || 9641);
const PASSES = +(process.env.PASSES || 3);
const SEUIL_PRET_MS = +(process.env.SEUIL_PRET_MS || 6500);
const SEUIL_LONGUES_MS = +(process.env.SEUIL_LONGUES_MS || 5500);
const SEUIL_FORMATS = +(process.env.SEUIL_FORMATS || 60);
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream'; const b = fs.readFileSync(p);
  if (/javascript|css|html|json|svg/.test(t)) { r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip' }); r.end(zlib.gzipSync(b)); }
  else { r.writeHead(200, { 'content-type': t }); r.end(b); }
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const mediane = (l) => { const s = l.filter((x) => x != null).slice().sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

// Posé AVANT l'app : tâches longues, écritures du cache, formats de date créés.
function sondes() {
  localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
  window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  window.__cache = []; window.__formats = [];
  const setItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === 'vrm_acct_cache' && this === window.sessionStorage) window.__cache.push([performance.now(), String(v).length]); return setItem.call(this, k, v); };
  const DTF = Intl.DateTimeFormat;
  const pile = () => { if (!window.__pileFormats) return; try { const l = String(new Error().stack).split('\n').slice(3, 6).map((x) => x.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\/assets\//, '(')).join(' < '); window.__piles[l] = (window.__piles[l] || 0) + 1; } catch (_) {} };
  window.__piles = {};
  const Enrobe = function (...a) { window.__formats.push(performance.now()); pile(); return new.target ? Reflect.construct(DTF, a, new.target === Enrobe ? DTF : new.target) : DTF(...a); };
  Enrobe.prototype = DTF.prototype; Enrobe.supportedLocalesOf = DTF.supportedLocalesOf.bind(DTF);
  try { Object.defineProperty(Intl, 'DateTimeFormat', { value: Enrobe, writable: true, configurable: true }); } catch (_) {}
  for (const nom of ['toLocaleDateString', 'toLocaleString', 'toLocaleTimeString']) {
    const f = Date.prototype[nom];
    Date.prototype[nom] = function (...a) { if (a.length) { window.__formats.push(performance.now()); pile(); } return f.apply(this, a); };
  }
}

async function passe(b, i) {
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  if (process.env.PILES) await ctx.addInitScript(() => { window.__pileFormats = true; });
  await ctx.addInitScript(sondes);
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    await attendre(80);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  let pret = null;
  while (Date.now() - t0 < 60000) {
    const ok = await pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const e = document.querySelector('[data-attente-ecran="journee"]'); return !d && !!e && /pret|plafond/.test(e.getAttribute('data-attente') || '') ? Math.round(performance.now()) : null; }).catch(() => null);
    if (ok != null) { pret = ok; break; }
    await attendre(50);
  }
  await attendre(1500);
  const m = await pg.evaluate((tp) => ({
    longues: Math.round(window.__lt.filter((x) => tp == null || x[0] < tp).reduce((a, x) => a + Math.min(x[1], tp == null ? x[1] : tp - x[0]), 0)),
    cacheAvant: window.__cache.filter((x) => tp == null || x[0] < tp).length,
    formatsAvant: window.__formats.filter((x) => tp == null || x < tp).length,
    journee: !!document.querySelector('.vrm-fu-journee'),
    piles: window.__pileFormats ? Object.entries(window.__piles).sort((a, b) => b[1] - a[1]).slice(0, 12) : undefined,
  }), pret).catch(() => ({}));
  if (i === 0 && process.env.CAPTURE) await pg.screenshot({ path: process.env.CAPTURE });
  await ctx.close();
  return { pret, ...m, erreurs };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const res = [];
  for (let i = 0; i < PASSES; i++) { const r = await passe(b, i); res.push(r); console.log('    passe ' + (i + 1) + ' ' + JSON.stringify({ ...r, erreurs: r.erreurs.length })); }
  await b.close(); srv.close();
  const ko = [];
  const juger = (id, ok, txt) => { console.log((ok ? 'OK  ' : 'KO  ') + id + '  ' + txt); if (!ok) ko.push(id); };
  const mP = mediane(res.map((r) => r.pret)), mL = mediane(res.map((r) => r.longues));
  juger('D1', mP != null && mP <= SEUIL_PRET_MS && res.every((r) => r.journee), `Ma journée prête en ${mP} ms (médiane de ${PASSES}) ≤ ${SEUIL_PRET_MS} ms`);
  juger('D2', mL != null && mL <= SEUIL_LONGUES_MS, `tâches longues avant « prêt » ${mL} ms (médiane) ≤ ${SEUIL_LONGUES_MS} ms`);
  const cache = res.map((r) => r.cacheAvant);
  juger('D3', cache.every((n) => n === 0), `cache des ventes écrit avant « prêt » : ${cache.join(', ')} fois (attendu 0)`);
  const fm = res.map((r) => r.formatsAvant);
  juger('D4', fm.every((n) => n != null && n <= SEUIL_FORMATS), `formats de date créés avant « prêt » : ${fm.join(', ')} (≤ ${SEUIL_FORMATS})`);
  const err = res.flatMap((r) => r.erreurs);
  juger('D5', err.length === 0, err.length ? 'erreurs : ' + err.slice(0, 3).join(' | ') : 'aucune erreur de page');
  console.log(ko.length ? `\n${ko.length} contrôle(s) en échec : ${ko.join(', ')}` : '\nTout est vert.');
  process.exit(ko.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
