// ════════════════════════════════════════════════════════════════════════════
//  ONGLETS FROIDS (17 nov. — Julien : « les données, les onglets mettent trop de temps à s'afficher »).
//    node scripts/bancs/onglets-froids.cjs <dist> [port]      SEUILS=0 (mesure seulement) · JSON=<fichier>
//  Un appareil DÉJÀ UTILISÉ : une première visite ouvre chaque onglet jusqu'à son écran prêt (les copies de
//  l'appareil se rangent), puis la page est RECHARGÉE (même navigateur, mêmes copies) et chaque onglet est ouvert
//  une fois, « à froid » dans cette page. Par onglet : un squelette (`.vrm-sq-barre` visible) ou un écran vide
//  a-t-il été montré ? Le temps du toucher à la première image avec du CONTENU (instantané ou écran vrai), et à
//  l'écran prêt. Règle (17 nov.) : un onglet froid ne montre JAMAIS de squelette quand une copie existe.
//  390 tactile, ×4, 4G, base inventée au poids réel. Rien de réel.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: Number(process.env.VENTES || 2000), annonces: Number(process.env.ANNONCES || 1000) });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const TOURS = Math.max(1, Number(process.env.TOURS || 2));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-onglets-froids');
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
  await ctx.addInitScript(() => { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); });
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(e.message));
  const cdp = await ctx.newCDPSession(pg);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: 9e6 / 8, uploadThroughput: 3e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.env.CPU || 4) });
  const reqs = [];
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/\.(jpe?g|png|webp)(\?|$)/i.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'image/png', body: PIXEL }) : r.abort()));
  await pg.route('**/rest/v1/**', async (route) => {
    const rq = route.request(); reqs.push(Date.now());
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    await attendre(80);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const ecranIci = () => pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const m = document.querySelector('.vrm-app-shell > .vrm-main'); const e = m && m.getAttribute('data-ecran'); const a = e && [...document.querySelectorAll(`[data-attente-ecran="${e}"]`)].find((x) => x.getClientRects().length); return { e, pret: !d && !!a && /pret|plafond/.test(a.getAttribute('data-attente') || '') }; }).catch(() => ({ e: null, pret: false }));
  const calme = async (max = 30000) => { const f = Date.now() + max; let n = reqs.length, tc = Date.now(); while (Date.now() - tc < 2500 && Date.now() < f) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tc = Date.now(); } } await attendre(600); };
  const ouvrirPage = async () => { const t0 = Date.now(); await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' }); while (Date.now() - t0 < 120000 && !(await ecranIci()).pret) await attendre(150); await calme(40000); };
  await ouvrirPage();
  const onglets = await pg.evaluate(() => [...document.querySelectorAll('.vrm-tabbar .vrm-tab[data-nav-entree]')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-nav-entree')).filter((t) => t !== 'journee'));
  // 1re visite : chaque onglet jusqu'à son écran prêt (les copies se rangent).
  for (const id of onglets) { await pg.locator(`.vrm-tabbar .vrm-tab[data-nav-entree="${id}"]`).first().tap(); const f = Date.now() + 30000; await attendre(500); while (Date.now() < f && !(await ecranIci()).pret) await attendre(200); await calme(15000); await attendre(2500); }
  console.log('copies rangées : ' + JSON.stringify(await pg.evaluate(() => Object.keys(localStorage).filter((k) => /instantan/i.test(k)).map((k) => k.replace(/:[0-9a-f-]{36}$/, '')))));
  // La page RECHARGÉE : chaque onglet ouvert une fois, à froid.
  await ouvrirPage();
  const res = {};
  for (const id of onglets) {
    const depuis = (await ecranIci()).e;
    await pg.evaluate((depuis) => { window.__g0 = performance.now(); window.__sq = false; window.__vide = false; window.__contenu = null; window.__pret = null;
      const z = () => { const m = document.querySelector('.vrm-app-shell > .vrm-main'); const e = m && m.getAttribute('data-ecran'); if (e && e !== depuis) {
          const sq = [...document.querySelectorAll('.vrm-main .vrm-sq-barre')].some((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
          if (sq) window.__sq = true;
          const a = [...document.querySelectorAll(`[data-attente-ecran="${e}"]`)].find((x) => x.getClientRects().length);
          const etat = a ? a.getAttribute('data-attente') : '';
          const contenu = (etat === 'instantane' || /pret|plafond/.test(etat || '')) && !sq;
          if (contenu && window.__contenu == null) window.__contenu = performance.now() - window.__g0;
          if (!contenu && !sq && (m.innerText || '').trim().length < 20) window.__vide = true;
          if (/pret|plafond/.test(etat || '')) { window.__pret = performance.now() - window.__g0; return; } }
        requestAnimationFrame(z); };
      requestAnimationFrame(z); }, depuis);
    await pg.locator(`.vrm-tabbar .vrm-tab[data-nav-entree="${id}"]`).first().tap();
    const f = Date.now() + 30000; while (Date.now() < f && !(await pg.evaluate(() => window.__pret != null))) await attendre(150);
    const r = await pg.evaluate(() => ({ squelette: window.__sq, vide: window.__vide, contenu: window.__contenu == null ? null : Math.round(window.__contenu), pret: window.__pret == null ? null : Math.round(window.__pret) }));
    res[id] = r;
    const txt = `contenu ${r.contenu ?? '—'} ms · prêt ${r.pret ?? '—'} ms · squelette ${r.squelette ? 'MONTRÉ' : 'non'} · vide ${r.vide ? 'MONTRÉ' : 'non'}`;
    if (JUGER) dit(!r.squelette && !r.vide, `${id} à froid (copie présente) : ni squelette ni écran vide`, txt); else console.log(`    ${id} — ${txt}`);
    await pg.screenshot({ path: path.join(SHOTS, `froid-${id}.png`) });
    await calme(12000);
  }
  if (erreurs.length) dit(false, 'aucune erreur de page', erreurs.slice(0, 3).join(' | '));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(res, null, 1));
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  await b.close(); srv.close();
  process.exit(ko && JUGER ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
