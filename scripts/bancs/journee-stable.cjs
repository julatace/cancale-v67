// ════════════════════════════════════════════════════════════════════════════
//  MA JOURNÉE NE BOUGE PAS EN CHARGEANT (17 nov. — Julien, deux captures de son iPhone à la même minute :
//  « Quand ça charge tout bouge bizarrement »).
//
//    node scripts/bancs/journee-stable.cjs <dist> [port]     SEUILS=0 (mesure sans juger) · JSON=<fichier>
//
//  Téléphone 390 px TACTILE, processeur ×4, 4G rapide (9 Mb/s, 60 ms), base INVENTÉE au poids réel. Ma journée
//  est ouverte deux fois dans le même navigateur : SANS copie sur l'appareil (1re ouverture), puis AVEC (2e : son
//  instantané est montré pendant la relecture). Sur TOUT le chargement (jusqu'à l'écran prêt + 3 s de calme), les
//  décalages de mise en page (`layout-shift`, sans geste) sont additionnés : le CLS. Seuil : < 0,02 (règle du
//  17 nov. : l'état qui charge a la MÊME structure, le même ordre, les mêmes tailles que l'état chargé).
//  Les nœuds qui bougent le plus sont nommés. Captures : pendant (instantané) et après. Rien de réel.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: Number(process.env.VENTES || 2000), annonces: Number(process.env.ANNONCES || 1000) });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const TOURS = Math.max(1, Number(process.env.TOURS || 2));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-journee-stable');
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



const S_CLS = 0.02;
// L'ordre VISUEL (de gauche à droite) des sortes de chiffres du mois : l'instantané (`[data-ji-case]`) ou l'écran vrai.
const STRUCT = () => {
  const ji = document.querySelector('[data-journee-instantane]');
  const cases = ji ? [...ji.querySelectorAll('[data-ji-case]')] : [...document.querySelectorAll('.sj-t-mois [data-fu-case]')].filter((x) => x.getClientRects().length && !x.closest('.vrm-attente-cache'));
  const sorte = (x) => x.getAttribute('data-carte-chiffre') || String(x.getAttribute('data-ji-case') || x.getAttribute('data-fu-case') || '').split('-')[0];
  return { ordre: cases.map((x) => [x.getBoundingClientRect().left, sorte(x)]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).join(',') };
};
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const ctx = await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1');
    window.__cls = [];
    const nom = (n) => { if (!n || !n.nodeType) return '?'; const e = n.nodeType === 1 ? n : n.parentElement; if (!e) return '?'; const d = [...e.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 2).map((a) => a.name).join(','); return e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '') + (d ? '[' + d + ']' : ''); };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ t: Math.round(e.startTime), v: e.value, s: (e.sources || []).map((s) => nom(s.node)).slice(0, 3) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
  });
  const erreurs = [];
  const res = {};
  for (const etiq of ['sans-copie', 'avec-copie']) {
    const pg = await ctx.newPage(); pg.on('pageerror', (e) => erreurs.push(e.message));
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
    const t0 = Date.now();
    await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
    let vuInstantane = false, tPret = null, structPendant = null;
    while (Date.now() - t0 < 120000) {
      const e = await pg.evaluate(() => { const a = [...document.querySelectorAll('[data-attente-ecran="journee"]')].find((x) => x.getClientRects().length); return { ji: !!document.querySelector('[data-journee-instantane]'), pret: !document.getElementById('vrm-demarrage') && !!a && a.getAttribute('data-attente') === 'pret' }; }).catch(() => ({}));
      if (e.ji && !vuInstantane) { vuInstantane = true; await attendre(300); await pg.screenshot({ path: path.join(SHOTS, `${etiq}-pendant.png`) }); structPendant = await pg.evaluate(STRUCT).catch(() => null); }
      if (e.pret) { tPret = Date.now() - t0; break; }
      await attendre(120);
    }
    let n = reqs.length, tc = Date.now(); while (Date.now() - tc < 3000 && Date.now() - t0 < 150000) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tc = Date.now(); } }
    await pg.screenshot({ path: path.join(SHOTS, `${etiq}-apres.png`) });
    const structApres = await pg.evaluate(STRUCT).catch(() => null);
    if (etiq === 'avec-copie' && JUGER && structPendant) {
      // La STRUCTURE (17 nov.) : un remplacement n'est pas un « décalage » pour le CLS — l'ordre des chiffres du mois et la
      // place de leur tuile sont comparés entre l'instantané et l'écran vrai.
      dit(!!structApres && structPendant.ordre === structApres.ordre, 'avec la copie : les chiffres du mois dans le MÊME ordre pendant et après', `pendant « ${structPendant.ordre} » · après « ${structApres && structApres.ordre} »`);
    }
    const c = await pg.evaluate(() => window.__cls);
    const cls = c.reduce((a, x) => a + x.v, 0);
    const parNoeud = {}; for (const x of c) for (const s of x.s) parNoeud[s] = (parNoeud[s] || 0) + x.v;
    const top = Object.entries(parNoeud).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k} ${v.toFixed(3)}`);
    res[etiq] = { cls: Math.round(cls * 10000) / 10000, decalages: c.length, pret_ms: tPret, instantane: vuInstantane, top };
    const txt = `CLS ${cls.toFixed(4)} (${c.length} décalages) · prêt ${tPret ?? '—'} ms · instantané ${vuInstantane ? 'montré' : 'non'} · ${top.join(' | ')}`;
    if (JUGER) dit(cls < S_CLS && tPret != null, `${etiq === 'sans-copie' ? 'sans copie sur l’appareil' : 'avec la copie (instantané)'} : Ma journée ne bouge pas en chargeant (CLS < ${S_CLS})`, txt); else console.log('    ' + etiq + ' — ' + txt);
    if (etiq === 'avec-copie' && JUGER) dit(vuInstantane, 'avec la copie : l’instantané est bien montré pendant la relecture (sinon ce contrôle ne mesure rien)');
    await pg.close();
  }
  if (erreurs.length) dit(false, 'aucune erreur de page', erreurs.slice(0, 3).join(' | '));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(res, null, 1));
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  await b.close(); srv.close();
  process.exit(ko && JUGER ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
