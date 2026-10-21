// ════════════════════════════════════════════════════════════════════════════
//  OUVERTURE EN 4G — ce que coûte l'app AVANT le premier écran (21 octobre).
//
//  `vitesse.cjs` ralentit les lectures de NOTRE base, pas le code de l'app : il
//  ne voit donc pas le poids du morceau `App-*.js`. Ici, TOUT passe par un même
//  « tuyau » 4G (RTT 150 ms, 1,6 Mo/s partagés entre les requêtes, octets
//  COMPRESSÉS en gzip comme les sert Vercel) : le code de l'app, ses styles, et
//  la base inventée au volume de la sienne (`_base-volume.cjs`, aucune donnée
//  réelle). Téléphone 390 px, processeur ×4. Ouverture À FROID (aucun cache).
//  On mesure, médiane de trois ouvertures :
//    · le temps jusqu'au héros de Ma journée (`data-vendu-mois`) ;
//    · le code JS téléchargé AVANT ce héros (compressé) ;
//    · le nombre de lectures de la base (doit rester celui d'avant) ;
//  et on exige : aucun morceau d'écran découpé (`src/ecrans/*`) téléchargé avant
//  le héros, et ces morceaux préchargés ensuite (au repos), sans erreur.
//  Lancer : npm run build && node scripts/bancs/ouverture-4g.cjs
//  `PORT=…` change le port ; `OUVERTURE_JSON=f` écrit les mesures.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { fabriquer, repondre } = require('./_base-volume.cjs');
const DIST = path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.PORT) || 4891;
const RTT = 150, DEBIT = 1_600_000, CPU = 4;
const base = fabriquer();
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
let tuyau = 0; // l'heure où le tuyau 4G est libre (partagé entre toutes les réponses)
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function passer(octets) {
  const maintenant = Date.now();
  const debut = Math.max(maintenant + RTT / 2, tuyau);
  tuyau = debut + (octets / DEBIT) * 1000;
  await attendre(tuyau + RTT / 2 - maintenant);
}
const gzTaille = new Map();
const tailleGz = (p) => { if (!gzTaille.has(p)) { const b = fs.readFileSync(p); gzTaille.set(p, /\.(js|css|html|json|svg|webmanifest)$/.test(p) ? zlib.gzipSync(b).length : b.length); } return gzTaille.get(p); };
let journal = null; // [{f, t, gz}]
const srv = http.createServer(async (q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  const gz = tailleGz(p);
  await passer(gz);
  if (journal) journal.push({ f, t: Date.now(), gz });
  r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(r);
});
srv.on('error', (e) => { console.log('❌ le port ' + PORT + ' est pris (' + e.code + ')'); process.exit(1); });
srv.listen(PORT);
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const morceauxEcrans = () => { try { return fs.readdirSync(path.join(__dirname, '..', '..', 'src', 'ecrans')).map((x) => x.replace(/\.jsx$/, '')); } catch (_) { return []; } };

async function ouvrir(b) {
  tuyau = 0; journal = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  await pg.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (['image', 'media', 'font'].includes(r.request().resourceType()) ? r.abort() : r.continue()));
  const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  let lectures = 0;
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    if (rq.method() !== 'GET') { await passer(200); return route.fulfill({ status: 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    lectures++;
    const h = await rq.allHeaders();
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    await passer(zlib.gzipSync(body).length);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"pret":true,"devices":1}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  let heros = null;
  try { await pg.waitForFunction(() => !!document.querySelector('[data-vendu-mois]'), null, { timeout: 60000, polling: 50 }); heros = Date.now(); } catch (_) {}
  const lecturesHeros = lectures;
  // Le calme : plus rien ne passe pendant 4 s (le préchargement au repos compris).
  let dernier = Date.now();
  for (let i = 0; i < 120; i++) { const n = journal.length + lectures; await attendre(500); if (journal.length + lectures !== n) dernier = Date.now(); else if (Date.now() - dernier > 4000) break; }
  const tombe = await pg.evaluate(() => /pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText));
  await ctx.close();
  const js = journal.filter((x) => /\.js$/.test(x.f));
  const avant = heros ? js.filter((x) => x.t <= heros) : js;
  const apres = heros ? js.filter((x) => x.t > heros) : [];
  return { heros: heros ? heros - t0 : null, jsAvant: avant.reduce((a, x) => a + x.gz, 0), morceauxAvant: avant.map((x) => x.f), morceauxApres: apres.map((x) => x.f), lectures: lecturesHeros, lecturesFin: lectures, errs, tombe };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const app = fs.readdirSync(path.join(DIST, 'assets')).filter((f) => /^App-.*\.js$/.test(f));
  const tailleApp = app.map((f) => tailleGz(path.join(DIST, 'assets', f))).reduce((a, x) => a + x, 0);
  console.log(`morceau App : ${app.join(', ')} — ${Math.round(tailleApp / 1024)} Ko compressés`);
  const rs = [];
  try {
    for (let k = 0; k < 3; k++) {
      const r = await ouvrir(b); rs.push(r);
      console.log(`  ouverture ${k + 1} : héros à ${r.heros ?? '—'} ms · JS avant le héros ${Math.round(r.jsAvant / 1024)} Ko · ${r.lectures} lectures avant le héros, ${r.lecturesFin} au calme · morceaux après : ${r.morceauxApres.map((f) => f.replace(/^\/assets\//, '')).join(' ') || '—'}`);
    }
  } finally { await b.close(); srv.close(); }
  const med = (k) => { const v = rs.map((r) => r[k]).filter((x) => x != null).sort((a, c) => a - c); return v.length === rs.length ? v[1] : null; };
  const m = { app: tailleApp, heros: med('heros'), jsAvant: med('jsAvant'), lectures: med('lectures'), lecturesFin: med('lecturesFin') };
  console.log(`\nMÉDIANE : héros ${m.heros} ms · JS avant le héros ${Math.round(m.jsAvant / 1024)} Ko · ${m.lectures} lectures avant le héros, ${m.lecturesFin} au calme`);
  dit(rs.every((r) => r.heros != null && !r.errs.length && !r.tombe), 'Ma journée s\'affiche, sans erreur, aux trois ouvertures', rs.map((r) => r.errs.join(' | ')).join(' / ').slice(0, 300));
  const ecrans = morceauxEcrans();
  const motif = (f) => ecrans.some((n) => new RegExp('/assets/' + n + '-[^/]+\\.js$').test(f));
  dit(rs.every((r) => !r.morceauxAvant.some(motif)), 'aucun morceau d\'écran découpé (src/ecrans) téléchargé avant le héros', rs.map((r) => r.morceauxAvant.filter(motif).join(' ')).join(' / '));
  if (ecrans.length) dit(rs.every((r) => ecrans.every((n) => r.morceauxApres.some((f) => new RegExp('/assets/' + n + '-').test(f)))), 'chaque morceau d\'écran est préchargé APRÈS le héros, au repos', ecrans.join(', '));
  if (process.env.OUVERTURE_JSON) fs.writeFileSync(process.env.OUVERTURE_JSON, JSON.stringify(m));
  process.exit(ko ? 1 : 0);
})();
