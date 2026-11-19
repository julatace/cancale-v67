// ════════════════════════════════════════════════════════════════════════════
//  ONGLETS RAPIDES (17 nov. — Julien, sur iPhone en production : « beaucoup trop long entre les onglets,
//  c'est catastrophique »).
//
//    node scripts/bancs/onglets-rapides.cjs <dist> [port]
//    VENTES=2000 · ANNONCES=1000 · CPU=4 · SHOTS=<dossier> · JSON=<fichier> · SEUILS=0 (mesure sans juger)
//
//  Téléphone 390 px TACTILE, processeur ×4, 4G (9 Mb/s, 60 ms), base INVENTÉE au poids réel (_base-volume).
//  Chaque onglet de la barre du bas est d'abord ouvert une fois (premier montage : mesuré, dit, pas jugé) ;
//  puis CHAQUE PAIRE d'onglets, dans les deux sens (5 onglets ⇒ 20 paires) : aller sur A, attendre le calme,
//  toucher B. Mesuré comme l'INP du navigateur (Event Timing : du toucher à l'image qui suit) et jusqu'à
//  l'écran UTILE (`.vrm-main[data-ecran]` changé et son attente posée, « pret » ou « plafond », visible).
//  Visé (17 nov.) : première réponse < 100 ms, écran utile < 300 ms — DIT paire par paire. JUGÉ : les médianes ne
//  dépassent pas celles de la PR #1250 + 20 % (`onglets-rapides.reference.json`) ; `vrm_avis_bas` et
//  `panel_num_reserves` au plus une lecture par geste et au démarrage. Rien de réel ; aucune écriture ne sort.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: Number(process.env.VENTES || 2000), annonces: Number(process.env.ANNONCES || 1000) });
const DIST = process.argv[2] || path.join(RACINE, 'dist'), PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const TOURS = Math.max(1, Number(process.env.TOURS || 2));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-onglets-rapides');
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
    window.__ev = []; window.__lt = [];
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) window.__ev.push({ s: e.startTime, d: e.duration, id: e.interactionId }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (_) {}
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
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
    const rq = route.request(); reqs.push({ t: Date.now(), m: rq.method(), u: decodeURIComponent(rq.url()) });
    if (rq.method() !== 'GET') return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    const h = await rq.allHeaders(); const rep = repondre(rq.url(), h.range, base);
    await attendre(80);
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.headers || {}) }, body: JSON.stringify(rep.body) });
  });
  await pg.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit' });
  // L'écran montré : `.vrm-main[data-ecran]`, et SON attente posée (« pret » ou « plafond »), visible.
  const ecranIci = () => pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); const m = document.querySelector('.vrm-app-shell > .vrm-main'); const e = m && m.getAttribute('data-ecran'); const a = e && [...document.querySelectorAll(`[data-attente-ecran="${e}"]`)].find((x) => x.getClientRects().length); return { e, pret: !d && !!a && /pret|plafond/.test(a.getAttribute('data-attente') || '') }; }).catch(() => ({ e: null, pret: false }));
  while (Date.now() - t0 < 120000 && !(await ecranIci()).pret) await attendre(150);
  const calme = async (max = 30000) => { const f = Date.now() + max; let n = reqs.length, tc = Date.now(); while (Date.now() - tc < 2500 && Date.now() < f) { await attendre(250); if (reqs.length !== n) { n = reqs.length; tc = Date.now(); } } await attendre(600); };
  await calme(60000);
  const charge = os.loadavg()[0].toFixed(1);
  console.log(`démarrage ${Date.now() - t0} ms · charge de la machine ${charge} sur ${os.cpus().length} cœurs`);
  const onglets = await pg.evaluate(() => [...document.querySelectorAll(':is(.vrm-tabbar .vrm-tab, [data-n-onglets] .n-onglet)[data-nav-entree]')].filter((x) => x.getClientRects().length).map((x) => x.getAttribute('data-nav-entree')));
  console.log('onglets : ' + onglets.join(', '));
  // Les lignes lues EN DOUBLE (chasse aux bugs, 17 nov.) : chacune au plus une fois par changement d'onglet.
  const SUIVIES = { avis_bas: /id=eq\.vrm_avis_bas&/, reserves: /id=eq\.panel_num_reserves&/ };
  const compter = (depuisI) => { const o = {}; for (const [k, re] of Object.entries(SUIVIES)) o[k] = reqs.slice(depuisI).filter((r) => r.m === 'GET' && re.test(r.u)).length; return o; };
  console.log('    lectures au démarrage : ' + JSON.stringify(compter(0)));
  // Au démarrage, `panel_num_reserves` est lue deux fois à des moments DIFFÉRENTS (la numérotation, puis Ma journée) : la
  // lecture en vol ne partage que des lectures simultanées (rien n'est gardé au-delà : un N° réservé n'est jamais masqué).
  if (JUGER) { const c = compter(0); dit(c.avis_bas <= 1 && c.reserves <= 2, 'démarrage : `vrm_avis_bas` lue au plus une fois, `panel_num_reserves` au plus deux', JSON.stringify(c)); }
  const toucher = async (id, fenetre) => {
    const depuis = (await ecranIci()).e; const i0 = reqs.length;
    await pg.evaluate((depuis) => { window.__g0 = performance.now(); window.__ev = []; window.__utile = null;
      const z = () => { if (window.__utile != null) return; const d = document.getElementById('vrm-demarrage'); const m = document.querySelector('.vrm-app-shell > .vrm-main'); const e = m && m.getAttribute('data-ecran'); const a = e && e !== depuis && [...document.querySelectorAll(`[data-attente-ecran="${e}"]`)].find((x) => x.getClientRects().length && !x.closest('.vrm-attente-cache'));
        if (!d && a && /pret|plafond/.test(a.getAttribute('data-attente') || '')) { window.__utile = performance.now() - window.__g0; return; } requestAnimationFrame(z); };
      requestAnimationFrame(z); }, depuis);
    await pg.locator(`:is(.vrm-tabbar .vrm-tab, [data-n-onglets] .n-onglet)[data-nav-entree="${id}"]`).first().tap();
    const fin = Date.now() + fenetre; while (Date.now() < fin && !(await pg.evaluate(() => window.__utile != null))) await attendre(100);
    await attendre(700);
    return pg.evaluate(() => { const g0 = window.__g0; const ev = window.__ev.filter((e) => e.s >= g0 - 5); const par = new Map(); for (const e of ev) par.set(e.id, Math.max(par.get(e.id) || 0, e.d));
      const lt = window.__lt.filter((x) => x[0] >= g0 - 5);
      return { reponse: par.size ? Math.round(Math.max(...par.values())) : (window.__utile != null ? 16 : null), utile: window.__utile == null ? null : Math.round(window.__utile), longues: Math.round(lt.reduce((a, x) => a + x[1], 0)) }; }).then((r) => ({ ...r, lectures: compter(i0) }));
  };
  // Échauffement : chaque onglet ouvert une fois (le premier montage, dit, pas jugé ici).
  const res = { premiers: {}, paires: [] };
  for (const id of [...onglets.filter((t) => t !== 'journee'), 'journee']) { const r = await toucher(id, 20000); res.premiers[id] = r; console.log(`    1re ouverture ${id} — réponse ${r.reponse ?? '—'} ms · utile ${r.utile ?? '—'} ms · longues ${r.longues} ms · ${JSON.stringify(r.lectures)}`);
    if (JUGER) dit(r.lectures.avis_bas <= 1 && r.lectures.reserves <= 1, `1re ouverture ${id} : \`vrm_avis_bas\` et \`panel_num_reserves\` lues au plus une fois chacune`, JSON.stringify(r.lectures)); await calme(15000); }
  // Chaque paire, dans les deux sens : aller sur A (sans mesure), puis toucher B (mesuré).
  for (const a of onglets) for (const bb of onglets) {
    if (a === bb) continue;
    await pg.locator(`:is(.vrm-tabbar .vrm-tab, [data-n-onglets] .n-onglet)[data-nav-entree="${a}"]`).first().tap();
    { const f = Date.now() + 20000; while (Date.now() < f && !(await ecranIci()).pret) await attendre(150); } await calme(8000);
    const r = await toucher(bb, 15000); res.paires.push({ de: a, vers: bb, ...r });
    const txt = `réponse ${r.reponse ?? '—'} ms · utile ${r.utile ?? '—'} ms · longues ${r.longues} ms`;
    // Les seuils visés (100 / 300 ms) sont DITS paire par paire ; le banc juge la non-régression (médianes, plus bas).
    console.log(`    ${r.reponse != null && r.reponse < S_REPONSE && r.utile != null && r.utile < S_UTILE ? 'visé ' : 'loin '} ${a} → ${bb} — ${txt}`);
    if (JUGER && r.lectures) dit(r.lectures.avis_bas <= 1 && r.lectures.reserves <= 1, `${a} → ${bb} : \`vrm_avis_bas\` et \`panel_num_reserves\` lues au plus une fois`, JSON.stringify(r.lectures));
  }
  await pg.screenshot({ path: path.join(SHOTS, 'onglets-fin.png') });
  const med = (l) => { const s = l.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const pire = (l) => (l.some((x) => x == null) ? null : Math.max(...l));
  // LA GARDE DU GAIN (17 nov., PR #1250) : les médianes ne repassent pas au-dessus de celles de la PR + 20 %
  // (scripts/bancs/onglets-rapides.reference.json, mesurées sur la même base, la même machine de banc).
  const REF = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'onglets-rapides.reference.json'), 'utf8')); } catch (_) { return null; } })();
  const mR = med(res.paires.map((p) => p.reponse)), mU = med(res.paires.map((p) => p.utile));
  if (JUGER) {
    dit(!!REF, 'la référence des médianes existe (onglets-rapides.reference.json)');
    if (REF) {
      dit(mR != null && mR <= REF.reponse_mediane * 1.2, `médiane de la première réponse ≤ référence + 20 % (${Math.round(REF.reponse_mediane * 1.2)} ms)`, `${mR} ms`);
      dit(mU != null && mU <= REF.utile_mediane * 1.2, `médiane de l’écran utile ≤ référence + 20 % (${Math.round(REF.utile_mediane * 1.2)} ms)`, `${mU} ms`);
    }
    dit(res.paires.every((p) => p.utile != null), 'chaque paire arrive à son écran utile', res.paires.filter((p) => p.utile == null).map((p) => p.de + '→' + p.vers).join(', ') || 'toutes');
  }
  console.log(`\nMÉDIANES (paires, ${res.paires.length}) : réponse ${med(res.paires.map((p) => p.reponse))} ms (pire ${pire(res.paires.map((p) => p.reponse)) ?? '—'}) · utile ${med(res.paires.map((p) => p.utile))} ms (pire ${pire(res.paires.map((p) => p.utile)) ?? 'jamais'})`);
  if (erreurs.length) dit(false, 'aucune erreur de page', erreurs.slice(0, 3).join(' | '));
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify({ charge, ...res }, null, 1));
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  await b.close(); srv.close();
  process.exit(ko && JUGER ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
