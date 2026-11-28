// ════════════════════════════════════════════════════════════════════════════
//  BANC « L'APP RAPIDE SUR IPHONE » (20 nov. — Julien : « on peut faire l'app iPhone mais elle est trop lente »).
//  Récit et chiffres : docs/passation/2026-11-20-iphone-rapide.md.
//
//    node scripts/bancs/iphone-rapide.cjs <dist> [port]
//    CPU=4 (×4 par défaut ; 6 = un iPhone plus ancien) · JSON=<fichier> (relevé complet) · TOURS=1 · ETAPES=demarrage,onglets,defilement,gestes
//    (28 nov., vitesse-fluide) LARGEUR=1512 : l'ordinateur (1512 × 945, souris, barre latérale) au lieu de l'iPhone ; le
//    réseau et le processeur restent ceux réglés. ETAPES=…,gestes : l'INP (Event Timing : du geste à l'image suivante) d'une
//    frappe dans la recherche d'Annonces et de Ventes, d'une case cochée, de l'ouverture d'une fiche. Chaque changement
//    d'onglet rapporte aussi son INP (`inp`).
//
//  COMME UN IPHONE : Chromium, 390 × 844, densité 3, tactile, mobile, processeur ×CPU (CDP), réseau 4G réaliste pour les
//  fichiers de l'app (CDP : 150 ms d'aller-retour, 9 Mbit/s descendant, 3 Mbit/s montant) ; la base est servie par le banc
//  avec le même aller-retour et le même débit (150 ms + taille / 9 Mbit/s). Service worker AUTORISÉ (c'est lui qui sert
//  les ouvertures suivantes). Base INVENTÉE au volume de Julien (`_base-volume`) : 7 comptes, ≈ 1 200 annonces,
//  1 500 ventes, 800 achats, 350 conversations, bordereaux avec PDF. Rien de réel ; aucune écriture ne sort.
//
//  Ce qui est mesuré (dans la page, depuis le début de la navigation, `performance.now()`) :
//    · démarrage à froid (appareil neuf, rien en cache) puis ouverture suivante (même appareil, service worker actif,
//      page neuve) : 1re peinture · coque (barre d'onglets) · écran utile (`data-attente="pret"` d'Aujourd'hui) ·
//      chiffres d'Aujourd'hui lus (`data-v2-chiffres="lu"`) ; octets de JS/CSS reçus ; tâches longues avant l'écran utile ;
//    · changement d'onglet (les 5 onglets, deux tours, + « Plus », + une fiche d'Annonces et le retour) : TEMPS DE FIL du
//      fil principal (somme des `tdur` des tâches de la trace Chrome, du toucher au calme — c'est le CPU, ralentissement
//      compris, insensible à la charge de la machine partagée), plus longue tâche, temps jusqu'à l'écran visé (mur) ;
//    · défilement d'Annonces et de Ventes (geste tactile synthétisé, 6 balayages) : images par seconde, tâches longues
//      (> 50 ms) et la plus longue ;
//    · mémoire : tas JS utilisé et nœuds du document après chaque étape (CDP Performance.getMetrics).
//  Il ne juge rien : il RAPPORTE (« un banc ne meurt pas, il rapporte »). Les objectifs du chantier sont rappelés à côté.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const base = fabriquer({ volumeReel: true, qr: true, ventes: 1500, achats: 800, annonces: 1200 });
// (20 nov., lectures-legeres) `FORME=reelle` : les commandes à la forme et au poids de SA base (`_commandes-forme` :
// mêmes champs, mêmes longueurs, ~2 Mo — sans le `'x'.repeat` qui fausserait une compression). `SESSION=1` : l'app
// ouvre comme lui, connectée (session, base cloisonnée), et la route `/api/compte?mode=commandes-lire` est la VRAIE
// (api/_lib/commandes-lecture.js EXÉCUTÉE ici, loi 10), servie au même débit sur ses octets COMPRESSÉS.
if (process.env.FORME === 'reelle') require(path.join(__dirname, '_commandes-forme.cjs')).formeReelle(base);
const SESSION = process.env.SESSION ? { access_token: 'aaa.bbb.banc', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: '11111111-2222-3333-4444-555555555555', email: 'banc@exemple.fr' } } : null;
const routeCommandesDuBanc = SESSION ? require(path.join(__dirname, '_route-commandes.cjs')).routeCommandes({ base, repondre, uid: SESSION.user.id, panne: process.env.ROUTE === 'panne' ? 'base' : null }) : null;
const DIST = path.resolve(process.argv[2] || path.join(RACINE, 'dist'));
const PORT = +(process.argv[3] || process.env.BANC_PORT || (21000 + Math.floor(Math.random() * 9000)));
const CPU = +(process.env.CPU || 4);
const RTT = 150, DEBIT = Number(process.env.MBIT || 9) * 1e6 / 8;   // octets/s (MBIT=1.6 : la 4G lente de Lighthouse)
const RESEAU = { offline: false, latency: RTT, downloadThroughput: DEBIT, uploadThroughput: Math.min(3e6, DEBIT * 8 / 2) / 8 };
let LECTURES = []; let T_NAV = 0;
const ETAPES = String(process.env.ETAPES || 'demarrage,onglets,defilement').split(',');
const ORDI = Number(process.env.LARGEUR || 390) >= 1000;
// Un toucher au téléphone, un clic à l'ordinateur ; un onglet est dans la barre du bas OU dans la barre latérale.
const TAP = (loc, o) => (ORDI ? loc.click(o) : loc.tap(o));
const SEL_ONGLET = (cle) => `[data-n-onglet="${cle}"], [data-n-laterale] [data-n-entree="${cle}"]`;
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Les fichiers de l'app, comme Vercel : compressés, /assets immuables, index.html jamais en cache ──
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };
const gz = new Map();
let servis = [];
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p)) { if (process.env.DEBUG) console.log('  (404 ' + q.url + ')'); r.writeHead(404); return r.end(); }
  const t = types[path.extname(p)] || 'application/octet-stream';
  const cache = /^\/assets\//.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache';
  if (/javascript|css|html|json|svg/.test(t)) {
    if (!gz.has(p)) gz.set(p, zlib.gzipSync(fs.readFileSync(p), { level: 9 }));
    const b = gz.get(p); servis.push({ f, o: b.length, sw: q.headers['service-worker'] === 'script' || q.headers['sec-fetch-dest'] === 'empty' });
    r.writeHead(200, { 'content-type': t, 'content-encoding': 'gzip', 'cache-control': cache }); return r.end(b);
  }
  const b = fs.readFileSync(p); servis.push({ f, o: b.length });
  r.writeHead(200, { 'content-type': t, 'cache-control': cache }); r.end(b);
}).listen(PORT);

// ── Dans la page, avant tout script : les jalons et les tâches longues ──
function jalons() {
  const J = { coque: null, utile: null, chiffres: null, fcp: null, longues: [] };
  window.__vrmIphone = J;
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) J.longues.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') J.fcp = Math.round(e.startTime); }).observe({ type: 'paint', buffered: true }); } catch (_) {}
  // (28 nov.) Event Timing : chaque interaction (toucher, clic, frappe) — durée du geste à l'image suivante (c'est l'INP).
  J.evts = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.interactionId) J.evts.push({ n: e.name, d: Math.round(e.duration), t: Math.round(e.startTime), p: Math.round(e.processingEnd - e.processingStart) }); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (_) {}
  const voir = () => {
    const t = Math.round(performance.now());
    if (J.coque == null && document.querySelector('[data-n-onglets] [data-n-onglet]')) J.coque = t;
    if (J.utile == null && document.querySelector('[data-attente-ecran="journee"][data-attente="pret"], [data-attente-ecran="journee"][data-attente="plafond"]')) J.utile = t;
    if (J.chiffres == null && document.querySelector('[data-v2-chiffres="lu"], [data-vendu-mois]:not([data-vendu-mois=""])')) J.chiffres = t;
  };
  // Les chiffres d'Aujourd'hui (« Vendu · mois » suivi d'un montant) : lus dans le texte, toutes les 100 ms.
  const iv = setInterval(() => { if (J.chiffres != null) return clearInterval(iv); const m = document.querySelector('main') || document.body; if (m && /Vendu\s*·\s*mois\s*[\d\s\u202f\u00a0]+(,\d+)?\s*€/.test(m.innerText || '')) J.chiffres = Math.round(performance.now()); }, 100);
  document.addEventListener('DOMContentLoaded', () => { voir(); new MutationObserver(voir).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-attente', 'data-v2-chiffres'] }); });
}

async function preparer(ctx) {
  if (SESSION) await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_session', JSON.stringify(s)); localStorage.setItem('vrm_local_owner', s.user.id); localStorage.setItem('schema_cloisonne', '1'); } catch (_) {} }, SESSION);
  else await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); } catch (_) {} });
  await ctx.addInitScript(jalons);
  // (22 nov.) `COMMITS=1` : chaque validation de React, et les composants dont un ÉTAT a changé (crochet n°, début du code) —
  // pour trouver une boucle de rendu (un effet qui pose un état à chaque validation).
  if (ETAPES.includes('argent')) await ctx.addInitScript(() => { window.__vrmSignauxEtiq = 0; window.addEventListener('vrm:etiquette-lue-ici', () => { window.__vrmSignauxEtiq++; }); });
  if (process.env.COMMITS || ETAPES.includes('argent')) await ctx.addInitScript((marcher) => {
    window.__vrmCommits = { n: 0, par: {} };
    // Les poseurs d'état de React (`dispatchSetState.bind(null, fibre, file)`) : enveloppés pour noter la PILE d'un appel
    // sur une file marquée (celle d'un état qui change à chaque validation).
    window.__vrmPiles = {};
    window.__vrmPdf = {};
    const f0 = window.fetch;
    window.fetch = function (u, o) { try { const x = String(u && u.url || u); if (/pdfB64|data-%3E%3EpdfB64/.test(x)) { const id = (/id=eq\.([^&]+)/.exec(x) || [])[1] || '?'; const P = window.__vrmPdf; (P[id] = P[id] || { n: 0, pile: '' }); P[id].n++; if (!P[id].pile) P[id].pile = String(new Error().stack).split('\n').slice(2, 7).join(' | '); } } catch (_) {} return f0.apply(this, arguments); };
    const bind0 = Function.prototype.bind;
    if (marcher) Function.prototype.bind = function (...a) {
      const f = bind0.apply(this, a);
      const q = a[2];
      if (a.length === 3 && a[0] === null && a[1] && typeof a[1] === 'object' && 'memoizedState' in a[1] && q && typeof q === 'object' && 'pending' in q) {
        return function (...x) { if (q.__vrmMarque) { const k = q.__vrmMarque; const P = window.__vrmPiles; (P[k] = P[k] || []); if (P[k].length < 6) P[k].push(String(new Error().stack).split('\n').slice(1, 9).join(' | ')); } return f.apply(this, x); };
      }
      return f;
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), inject() { return 1; }, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {},
      onCommitFiberRoot(_id, root) {
        const C = window.__vrmCommits; C.n++; if (!marcher) return;   // (l'étape « argent » seule : on compte, sans parcourir l'arbre — la sonde pèserait sur la mesure)
        const pile = [root.current]; let vus = 0;
        while (pile.length && vus < 200000) { const f = pile.pop(); vus++;
          if (f.child) pile.push(f.child); if (f.sibling) pile.push(f.sibling);
          if (typeof f.type !== 'function' || !f.alternate) continue;
          let h = f.memoizedState, h0 = f.alternate.memoizedState, i = 0;
          while (h && h0 && i < 400) { if (h.queue && h.memoizedState !== h0.memoizedState) { const k = (f.type.name || '?') + '#' + i + ' ' + String(f.type).slice(0, 90).replace(/\s+/g, ' '); C.par[k] = (C.par[k] || 0) + 1; if (C.par[k] > 3) h.queue.__vrmMarque = k.slice(0, 30); const ex = (C.ex = C.ex || {}); (ex[k] = ex[k] || []); if (ex[k].length < 4) { let v; try { v = JSON.stringify(h.memoizedState); } catch (_) { v = String(h.memoizedState); } let v0; try { v0 = JSON.stringify(h0.memoizedState); } catch (_) { v0 = String(h0.memoizedState); } ex[k].push(String(v0).slice(0, 160) + ' => ' + String(v).slice(0, 160)); } } h = h.next; h0 = h0.next; i++; }
        }
      } };
  }, !!process.env.COMMITS);
  // (22 nov.) `ECRITURES=1` : les sauvegardes (`vrm:save`, par clé) pendant chaque geste — pour trouver une boucle d'écriture.
  if (process.env.ECRITURES) await ctx.addInitScript(() => { window.__vrmEcrits = {}; window.addEventListener('vrm:save', (e) => { const k = (e && e.detail && e.detail.k) || '?'; window.__vrmEcrits[k] = (window.__vrmEcrits[k] || 0) + 1; }); });
  // Photos de Vinted : coupées (le banc ne joint rien) ; l'app montre son pictogramme.
  await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => r.abort());
  await ctx.route('**/rest/v1/**', async (route) => {
    const rq = route.request();
    // (20 nov., lectures-legeres) En SESSION, un PATCH gardé (`data->>rev=eq.`, `return=representation`) rend la
    // ligne écrite, comme Supabase quand l'échange réussit : avec `[]`, l'app se croyait devancée et relisait
    // `main` en boucle (×35 en 40 s, 3 Mo) — une boucle du BANC, pas de l'app. Rien n'est rangé (base figée).
    if (rq.method() !== 'GET') { await attendre(RTT); const idP = SESSION && rq.method() === 'PATCH' ? (/[?&]id=eq\.([^&]+)/.exec(rq.url()) || [])[1] : null; return route.fulfill({ status: idP ? 200 : 201, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: idP ? JSON.stringify([{ id: decodeURIComponent(idP) }]) : '[]' }); }
    const h = await rq.allHeaders();
    if (SESSION && /select=owner\b/.test(decodeURIComponent(rq.url()))) { await attendre(RTT); return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' }); }
    const rep = repondre(rq.url(), h.range, base);
    const body = JSON.stringify(rep.body);
    const debut = Date.now() - T_NAV;
    await attendre(RTT + Math.round(body.length / DEBIT * 1000));
    const plein = decodeURIComponent(rq.url().replace(/^.*\/rest\/v1\//, ''));
    LECTURES.push({ u: plein.slice(0, 140), plein: plein + '\n' + (h.range || ''), o: body.length, d: debut, f: Date.now() - T_NAV });
    return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...(rep.headers || {}) }, body });
  });
  // (20 nov., instantane) Les routes que le démarrage lit, à LEUR forme (comme le banc ouverture-instantanee) : un vendeur
  // abonné, sa propre boutique — c'est ce qui permet à l'app de peindre avant d'être chargée (porte hors ligne).
  await ctx.route('**/api/**', (r) => { const u = r.request().url();
    // (lectures-legeres) Connecté (`SESSION=1`) : la porte de confidentialité, l'abonnement du propriétaire, l'équipe non installée.
    if (SESSION) return r.fulfill({ status: 200, contentType: 'application/json', body: u.includes('mode=confidentialite') ? JSON.stringify({ ok: true, uid: SESSION.user.id })
      : u.includes('mode=abonnement') ? JSON.stringify({ ok: true, proprietaire: true, acces: true, statut: 'active', configure: true })
      : u.includes('mode=equipe') ? JSON.stringify({ ok: false, erreur: 'non-installe' }) : '{"pret":true,"devices":1}' });
    const corps = /mode=equipe/.test(u) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true }
      : /mode=abonnement/.test(u) ? { ok: true, acces: true, statut: 'active', configure: true } : { pret: true, devices: 1 };
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(corps) }); });
  if (SESSION) {
    await ctx.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(/\/auth\/v1\/user/.test(r.request().url()) ? { id: SESSION.user.id, email: SESSION.user.email, aud: 'authenticated', role: 'authenticated', email_confirmed_at: '2026-01-01T00:00:00Z', identities: [], app_metadata: { provider: 'email' }, user_metadata: {} } : /factors|aal/.test(r.request().url()) ? { currentLevel: 'aal1', nextLevel: 'aal1', all: [], totp: [] } : { access_token: SESSION.access_token, refresh_token: 'r', expires_in: 3600, user: SESSION.user }) }));
    // La VRAIE route des commandes (enregistrée après `**/api/**` : Playwright prend la dernière d'abord).
    await ctx.route('**/api/compte?mode=commandes-lire*', async (route) => {
      const rq = route.request(); const h = await rq.allHeaders();
      const debut = Date.now() - T_NAV;
      const rep = await routeCommandesDuBanc(rq.url(), { authorization: h.authorization, 'accept-encoding': 'br, gzip', 'if-none-match': h['if-none-match'] });
      await attendre(RTT + Math.round(rep.octets / DEBIT * 1000));
      LECTURES.push({ u: 'ROUTE ' + decodeURIComponent(rq.url().replace(/^.*\/api\//, '')).slice(0, 130), o: rep.octets, d: debut, f: Date.now() - T_NAV });
      // Playwright remet le corps tel quel : on le donne DÉCOMPRESSÉ (le temps a été compté sur les octets compressés).
      return route.fulfill({ status: rep.status, contentType: 'application/json', headers: { ...(rep.etag ? { etag: rep.etag } : {}), ...(rep.cache ? { 'cache-control': rep.cache } : {}) }, body: rep.status === 304 ? '' : rep.clair });
    });
  }
}
async function cdpDe(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', RESEAU);
  await cdp.send('Performance.enable');
  return cdp;
}
async function memoire(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics');
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]));
  return { tasMo: Math.round(m.JSHeapUsedSize / 1048576 * 10) / 10, noeuds: m.Nodes, ecouteurs: m.JSEventListeners };
}

// Profil CPU agrégé par fonction (propre et inclusif) — PROFIL=<fichier> PROFIL_QUAND=froid|'chaud 2'.
function agreger(profil) {
  const parId = new Map(); for (const n of profil.nodes) parId.set(n.id, n);
  const parent = new Map(); for (const n of profil.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const propre = new Map(), inclusif = new Map();
  const nom = (n) => (n.callFrame.functionName || '(anonyme)') + ':' + (n.callFrame.lineNumber + 1) + ':' + (n.callFrame.columnNumber + 1) + '@' + path.basename(n.callFrame.url || '?');
  const dt = profil.timeDeltas || [], ech = profil.samples || [];
  for (let i = 0; i < ech.length; i++) {
    const ms = (dt[i + 1] || dt[i] || 0) / 1000; let id = ech[i]; const n0 = parId.get(id);
    if (!n0 || /^\((idle|program)\)$/.test(n0.callFrame.functionName)) continue;
    propre.set(nom(n0), (propre.get(nom(n0)) || 0) + ms);
    const vus = new Set();
    while (id != null) { const n = parId.get(id); const k = nom(n); if (!vus.has(k)) { vus.add(k); inclusif.set(k, (inclusif.get(k) || 0) + ms); } id = parent.get(id); }
  }
  const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([f, ms]) => [f, Math.round(ms)]);
  return { propre: top(propre, 80), inclusif: top(inclusif, 200) };
}

// ── Une ouverture : de la navigation à l'écran utile, puis au calme ──
async function ouvrirApp(ctx, quand) {
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
  pg.on('crash', () => console.log('  ⚠️ la page a planté (' + quand + ')'));
  if (process.env.DEBUG) { pg.on('close', () => console.log('  (page fermée : ' + quand + ')')); pg.on('framenavigated', (f) => { if (f === pg.mainFrame()) console.log('  (navigation : ' + f.url() + ')'); }); pg.on('requestfailed', (q) => { if (q.resourceType() !== 'image') console.log('  (échec ' + q.resourceType() + ' ' + q.url().slice(0, 140) + ' ' + ((q.failure() || {}).errorText || '') + ')'); }); pg.on('response', (x) => { if (x.status() >= 400) console.log('  (' + x.status() + ' ' + x.url().slice(0, 140) + ')'); }); }
  const cdp = await cdpDe(pg);
  servis = []; LECTURES = []; T_NAV = Date.now();
  const profiler = process.env.PROFIL && quand === process.env.PROFIL_QUAND;
  if (profiler) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  const aller = async () => { await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 }); };
  const pretO = () => { const J = window.__vrmIphone; return J && J.utile != null && J.chiffres != null; };
  let traceO = null;
  if (process.env.OUVERTURE_NOMS && quand === process.env.OUVERTURE_NOMS) { traceO = await tracer(pg, cdp, aller, pretO); console.log('  (trace de l\'ouverture ' + quand + ' : CPU ' + traceO.cpu + ' ms · style ' + traceO.style + ' · mise en page ' + traceO.page + ')'); }
  else {
    await aller();
    if (profiler && process.env.PROFIL_COQUE) { await pg.waitForFunction(() => window.__vrmIphone && window.__vrmIphone.coque != null, null, { timeout: 120000, polling: 50 }).catch(() => {}); const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL, JSON.stringify(agreger(profile), null, 1)); }
    await pg.waitForFunction(pretO, null, { timeout: 120000, polling: 100 }).catch(() => {});
  }
  const J = await pg.evaluate(() => window.__vrmIphone);
  if (profiler && !process.env.PROFIL_COQUE) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL, JSON.stringify(agreger(profile), null, 1)); }
  if (process.env.JALONS) console.log('  (jalons ' + quand + ' : ' + JSON.stringify(await pg.evaluate(() => ({ marques: performance.getEntriesByType('mark').map((m) => m.name + '@' + Math.round(m.startTime)).slice(0, 40), longues: window.__vrmIphone.longues.slice(0, 40), coque: window.__vrmIphone.coque, chiffres: window.__vrmIphone.chiffres, ressources: performance.getEntriesByType('resource').filter((r) => /\.(js|css)$/.test(r.name)).map((r) => r.name.split('/').pop() + '@' + Math.round(r.startTime) + '-' + Math.round(r.responseEnd)).slice(0, 30) }))) + ')');
  if (process.env.DEBUG) console.log('  (états : ' + JSON.stringify(await pg.evaluate(() => [...document.querySelectorAll('[data-v2-chiffres],[data-attente-ecran]')].map((e) => (e.getAttribute('data-v2-chiffres') || '') + '/' + (e.getAttribute('data-attente-ecran') || '') + ':' + (e.getAttribute('data-attente') || '')))) + ')');
  if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(process.env.SHOTS, 'ouverture-' + quand.replace(/\s+/g, '') + '.png') }).catch(() => {}); }
  await attendre(4000);   // le calme (lectures de fond, rangement du service worker)
  const sw = await pg.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)).catch(() => false);
  const fichiers = servis.filter((x) => /\.(js|css)$/.test(x.f) && !x.sw);
  const r = {
    quand, fcp: J.fcp, coque: J.coque, utile: J.utile, chiffres: J.chiffres, mur: Date.now() - t0,
    jsKo: Math.round(fichiers.reduce((a, x) => a + x.o, 0) / 1024), fichiers: fichiers.length,
    longuesAvantUtile: J.longues.filter(([t]) => J.utile == null || t < J.utile).length,
    longuesMsAvantUtile: J.longues.filter(([t]) => J.utile == null || t < J.utile).reduce((a, [, d]) => a + d, 0),
    plusLongue: J.longues.reduce((m, [, d]) => Math.max(m, d), 0),
    controlee: sw, erreurs: errs.slice(0, 3), memoire: await memoire(cdp),
    base: { lectures: LECTURES.length, ko: Math.round(LECTURES.reduce((a, x) => a + x.o, 0) / 1024), avantPret: LECTURES.filter((x) => J.utile == null || x.d < J.utile).length,
      koAvantPret: Math.round(LECTURES.filter((x) => J.utile == null || x.d < J.utile).reduce((a, x) => a + x.o, 0) / 1024),
      doublons: LECTURES.length - new Set(LECTURES.map((x) => x.u)).size, lourdes: LECTURES.slice().sort((a, b) => b.o - a.o).slice(0, 8).map((x) => `${Math.round(x.o / 1024)} Ko ${x.d}→${x.f} ms ${x.u}`) },
  };
  if (process.env.LECTURES) { console.log(`  (base ${quand} : ${r.base.lectures} lectures, ${r.base.ko} Ko ; avant « prêt » ${r.base.avantPret} / ${r.base.koAvantPret} Ko ; ${r.base.doublons} en double)`); for (const x of r.base.lourdes) console.log('     ' + x); }
  if (process.env.LECTURES === '2') { const par = new Map(); for (const x of LECTURES) { const k = x.plein || x.u; (par.get(k) || par.set(k, []).get(k)).push(x); } for (const [u, l] of par) if (l.length > 1) console.log(`     ×${l.length} ${l.map((x) => x.d + '→' + x.f).join(' ')} ${l.map((x) => Math.round(x.o / 1024)).join('+')} Ko ${u.replace(/\n.*$/, '').slice(0, 110)}`);
    // (20 nov., lectures-legeres) Les octets lus EN DOUBLE (même adresse complète, même page) : tout sauf la 1re de chaque.
    let dbl = 0; for (const [, l] of par) for (const x of l.slice(1)) dbl += x.o; console.log(`     octets en double : ${Math.round(dbl / 1024)} Ko`); }
  return { pg, cdp, r };
}

// ── La trace d'un geste : temps de fil (CPU) du fil principal, du geste au calme ──
async function tracer(pg, cdp, geste, pret) {
  const evts = [];
  const surDonnees = (d) => { for (const e of d.value) evts.push(e); };
  cdp.on('Tracing.dataCollected', surDonnees);
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,toplevel,disabled-by-default-devtools.timeline' + (process.env.SELECTEURS ? ',disabled-by-default-blink.debug' : '') + (process.env.INVAL ? ',disabled-by-default-devtools.timeline.invalidationTracking' : ''), transferMode: 'ReportEvents' });
  await attendre(150);
  if (process.env.PROFIL_ONGLETS) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const p0 = await pg.evaluate(() => performance.now()).catch(() => 0);
  const t0 = Date.now();
  await geste();
  let mur = null;
  try { await pg.waitForFunction(pret, null, { timeout: 30000, polling: 16 }); mur = Date.now() - t0; } catch (_) {}
  await attendre(1500);
  if (process.env.PROFIL_ONGLETS) { const { profile } = await cdp.send('Profiler.stop'); (global.__profils = global.__profils || []).push(agreger(profile)); if (process.env.PROFIL_BRUT) fs.writeFileSync(process.env.PROFIL_BRUT + '-' + global.__profils.length + '.json', JSON.stringify(profile)); fs.writeFileSync(process.env.PROFIL_ONGLETS, JSON.stringify(global.__profils, null, 1)); }
  const fini = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end'); await fini;
  cdp.off('Tracing.dataCollected', surDonnees);
  // Le fil principal de la page : le fil « CrRendererMain » qui porte le plus de tâches.
  const noms = new Map(); for (const e of evts) if (e.ph === 'M' && e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain') noms.set(e.pid + ':' + e.tid, 0);
  const taches = evts.filter((e) => e.ph === 'X' && (e.name === 'RunTask' || e.name === 'ThreadControllerImpl::RunTask') && noms.has(e.pid + ':' + e.tid));
  for (const e of taches) noms.set(e.pid + ':' + e.tid, noms.get(e.pid + ':' + e.tid) + 1);
  const fil = [...noms.entries()].sort((a, b) => b[1] - a[1])[0];
  const miennes = fil ? taches.filter((e) => e.pid + ':' + e.tid === fil[0]) : [];
  const td = (e) => (e.tdur != null ? e.tdur : e.dur) / 1000;
  // Seulement les tâches de PREMIER niveau (une tâche du planificateur en contient une autre : ne pas compter deux fois).
  const tri = miennes.slice().sort((a, b) => a.ts - b.ts || b.dur - a.dur);
  const hautes = []; let finHaut = -1;
  for (const e of tri) { if (e.ts >= finHaut) { hautes.push(e); finHaut = e.ts + e.dur; } }
  const cpu = hautes.reduce((a, e) => a + td(e), 0);
  const plusLongue = hautes.reduce((m, e) => Math.max(m, e.dur / 1000), 0);
  const longues = hautes.filter((e) => e.dur / 1000 > 50).length;
  const style = evts.filter((e) => e.ph === 'X' && e.name === 'UpdateLayoutTree' && fil && e.pid + ':' + e.tid === fil[0]);
  const pireStyle = style.reduce((m, e) => Math.max(m, td(e)), 0);
  const surFil = (nom) => evts.filter((e) => e.ph === 'X' && e.name === nom && fil && e.pid + ':' + e.tid === fil[0]);
  const somme = (l) => Math.round(l.reduce((a, e) => a + td(e), 0));
  if (process.env.GROS) {
    const gros = style.map((e) => ({ el: (e.args && (e.args.elementCount || (e.args.data && e.args.data.elementCount))) || 0, ms: Math.round(td(e)), pile: ((e.args && e.args.beginData && e.args.beginData.stackTrace) || []).slice(0, 4).map((f) => `${f.functionName || '?'}:${f.lineNumber}@${String(f.url || '').split('/').pop()}`).join(' < ') }))
      .filter((x) => x.ms >= 20).sort((a, b) => b.ms - a.ms).slice(0, 8);
    for (const x of gros) console.log(`      style ${x.ms} ms · ${x.el} él. · ${x.pile || '(pas forcé par du script)'}`);
    const lay = evts.filter((e) => e.ph === 'X' && e.name === 'Layout' && fil && e.pid + ':' + e.tid === fil[0]);
    const pileDe = (e) => ((e.args && e.args.beginData && e.args.beginData.stackTrace) || []).slice(0, 3).map((f) => `${f.functionName || '?'}:${f.lineNumber}`).join(' < ');
    console.log(`      mises en page : ${lay.length}, dont ${lay.filter((e) => td(e) >= 20).length} ≥ 20 ms : ` + lay.filter((e) => td(e) >= 20).sort((a, b) => td(b) - td(a)).slice(0, 6).map((e) => Math.round(td(e)) + ' ms (' + ((e.args && e.args.beginData && (e.args.beginData.dirtyObjects + '/' + e.args.beginData.totalObjects)) || '?') + ' ' + (pileDe(e) || 'non forcée') + ')').join(' · '));
  }
  if (process.env.SELECTEURS) {
    const par = global.__selecteurs = global.__selecteurs || new Map(); let total = 0;
    for (const e of evts) { if (e.name !== 'SelectorStats') continue; const l = e.args && e.args.selector_stats && e.args.selector_stats.selector_timings; if (!Array.isArray(l)) continue;
      for (const x of l) { const us = Number(x['elapsed (us)']) || 0; total += us; const k = String(x.selector || ''); const o = par.get(k) || { us: 0, essais: 0, touches: 0, rejets: 0, style: x.style_sheet_id }; o.us += us; o.essais += Number(x.match_attempts) || 0; o.touches += Number(x.match_count) || 0; o.rejets += Number(x.fast_reject_count) || 0; par.set(k, o); } }
    console.log(`      sélecteurs : ${Math.round(total / 1000)} ms mesurés`);
    fs.writeFileSync(process.env.SELECTEURS, JSON.stringify([...par.entries()].sort((a, b) => b[1].us - a[1].us).map(([k, o]) => [Math.round(o.us), o.essais, o.touches, o.rejets, k])));
  }
  if (process.env.INVAL) {
    const par = new Map();
    for (const e of evts) { if (!/InvalidationTracking/.test(e.name)) continue; const d = (e.args && e.args.data) || {}; const k = e.name.replace('InvalidationTracking', '') + ' · ' + (d.reason || '') + ' · ' + String(d.nodeName || '').slice(0, 60) + (d.changedAttribute ? ' @' + d.changedAttribute : '') + (d.changedClass ? ' .' + d.changedClass : '') + (d.subtree ? ' · SOUS-ARBRE' : ''); par.set(k, (par.get(k) || 0) + 1); }
    console.log([...par].sort((a, b) => b[1] - a[1]).filter(([k]) => /SOUS-ARBRE|HTML|BODY|n-coque|vrm-main|app-shell/.test(k)).slice(0, 14).map(([k, n]) => '        ' + n + ' × ' + k).join('\n'));
  }
  if (process.env.NOMS) {
    const xs = evts.filter((e) => e.ph === 'X' && fil && e.pid + ':' + e.tid === fil[0]).sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const propre = new Map(); const pile = [];
    const fermer = (x) => propre.set(x.e.name, (propre.get(x.e.name) || 0) + Math.max(0, td(x.e) - x.enf));
    for (const e of xs) { while (pile.length && e.ts >= pile[pile.length - 1].fin) fermer(pile.pop()); if (pile.length) pile[pile.length - 1].enf += td(e); pile.push({ e, fin: e.ts + e.dur, enf: 0 }); }
    while (pile.length) fermer(pile.pop());
    console.log('      ' + [...propre.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + Math.round(v)).join(' · '));
  }
  const inp = await pg.evaluate((p0) => { const l = ((window.__vrmIphone || {}).evts || []).filter((e) => e.t >= p0 - 5); return l.length ? Math.max(...l.map((e) => e.d)) : 0; }, p0).catch(() => null);
  const elementsStyle = style.reduce((a, e) => a + ((e.args && (e.args.elementCount || (e.args.data && e.args.data.elementCount))) || 0), 0);
  return { inp, cpu: Math.round(cpu), plusLongue: Math.round(plusLongue), longues, mur, pireStyle: Math.round(pireStyle * 10) / 10, style: somme(style), page: somme(surFil('Layout')), script: somme(surFil('FunctionCall').concat(surFil('EvaluateScript'), surFil('TimerFire'), surFil('EventDispatch'), surFil('FireAnimationFrame'), surFil('RunMicrotasks'))), elementsStyle };
}

const CLE = (id) => (id === 'annonces' ? 'paires' : id);
// (22 nov.) LE DÉFAUT « ARGENT BLOQUÉ » : sur Ventes, la préparation d'avance du lot (téléphone) lit les PDF un par un ; chaque
// étiquette lue faisait recopier ET rendre TOUTES les `Comptabilite` montées (écrans gardés compris) — au toucher d'Argent,
// l'écran ne venait plus (25–35 s de calcul). Ici : Annonces, Ventes (on y ATTEND la fin des lectures de PDF), Achats, puis
// Argent ; on juge l'écran Argent atteint en moins de 20 s, et on dit les PDF lus, les signaux d'étiquette et les validations.
async function argentApresSequence(pg, cdp) {
  const surEcran = (id) => new Function(`const m = document.querySelector('.vrm-main'); return !!m && m.getAttribute('data-ecran') === ${JSON.stringify(id)};`);
  const aller = async (id) => { const t0 = Date.now(); await TAP(pg.locator(SEL_ONGLET(CLE(id))).first(), { timeout: 30000 }).catch(() => {}); const ok = await pg.waitForFunction(surEcran(id), null, { timeout: 60000, polling: 100 }).then(() => true, () => false); return ok ? Date.now() - t0 : null; };
  const compteurs = () => pg.evaluate(() => ({ pdf: Object.values(window.__vrmPdf || {}).reduce((t, x) => t + x.n, 0), signaux: window.__vrmSignauxEtiq || 0, validations: (window.__vrmCommits || {}).n || 0 }));
  const out = {};
  out.annonces = await aller('annonces'); await calme(pg, 1500, 20000);
  out.ventes = await aller('ventes');
  // la préparation d'avance a COMMENCÉ (un premier PDF lu, 60 s au plus) : on repart tout de suite, comme lui — la rafale
  // de lectures se poursuit pendant Achats et le toucher d'Argent (c'est là que l'écran ne venait plus).
  for (let i = 0; i < 120; i++) { const c = await compteurs(); if (c.pdf > 0) break; await attendre(500); }
  out.apresVentes = await compteurs();
  out.achats = await aller('achats'); await attendre(1500);
  const c0 = await compteurs();
  await pg.evaluate(() => { if (window.__vrmCommits) { window.__vrmCommits.par = {}; window.__vrmCommits.ex = {}; } window.__vrmPiles = {}; });
  if (process.env.PROFIL_BRUT) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  out.argent = await aller('compta');
  await attendre(3000);
  if (process.env.PROFIL_BRUT) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL_BRUT + '-argent.json', JSON.stringify(profile)); }
  const c1 = await compteurs();
  out.pendantArgent = { pdf: c1.pdf - c0.pdf, signaux: c1.signaux - c0.signaux, validations: c1.validations - c0.validations, ms: Date.now() - t0 };
  // Jugé : l'écran atteint en moins de 20 s, ET une rafale de lectures ne fait pas UN signal (donc un rendu de chaque
  // Comptabilite) par PDF — au plus un pour trois (le code d'avant : un par PDF, mesuré 12 à 14 pour 14 PDF).
  const pdfTot = out.apresVentes.pdf + out.pendantArgent.pdf, sigTot = out.apresVentes.signaux + out.pendantArgent.signaux;
  out.signauxOk = sigTot <= Math.max(2, Math.ceil(pdfTot / 3));
  out.ok = out.argent != null && out.argent < 20000 && out.signauxOk && pdfTot > 0;
  console.log(`  ${out.ok ? '✅' : '❌'} Argent ${out.argent == null ? 'PAS ATTEINT en 60 s' : 'atteint en ' + out.argent + ' ms'} · ${pdfTot} PDF, ${sigTot} signaux (${out.signauxOk ? 'regroupés' : 'UN PAR PDF'})${pdfTot ? '' : ' · aucune préparation de lot : mesure sans objet'} · sur Ventes : ${out.apresVentes.pdf} PDF lus, ${out.apresVentes.signaux} signal(aux) d'étiquette · pendant Argent : ${out.pendantArgent.validations} validations, ${out.pendantArgent.signaux} signal(aux)`);
  if (!out.ok || process.env.COMMITS) { const d = await pg.evaluate(() => ({ top: Object.entries((window.__vrmCommits || {}).par || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => [k.slice(0, 70), n]), ex: (() => { const C = window.__vrmCommits || {}; const top = Object.entries(C.par || {}).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k); return top.map((k) => [k.slice(0, 30), ((C.ex || {})[k] || []).map((x) => x.slice(0, 260))]); })(), piles: window.__vrmPiles || {} })).catch((e) => ({ err: e.message }));
    console.log('     états qui changent pendant Argent : ' + JSON.stringify(d.top)); console.log('     exemples : ' + JSON.stringify(d.ex)); console.log('     piles : ' + JSON.stringify(d.piles).slice(0, 6000)); }
  if (!out.ok) process.exitCode = 1;
  return out;
}
async function onglets(pg, cdp) {
  const sortie = [];
  const surEcran = (id) => new Function(`const m = document.querySelector('.vrm-main'); return !!m && m.getAttribute('data-ecran') === ${JSON.stringify(id)} && !document.querySelector('[data-attente-ecran="${id === 'compta' ? '' : id}"][data-attente="attente"]');`);
  const toucher = (id) => async () => { await TAP(pg.locator(SEL_ONGLET(CLE(id))).first(), { timeout: 30000 }); };
  const ordre = ['annonces', 'ventes', 'achats', 'compta', 'journee'];
  const tours = +(process.env.TOURS || 2);
  for (let t = 1; t <= tours; t++) {
    for (const id of ordre) {
      const n0 = await pg.evaluate(() => performance.getEntriesByType('resource').length);
      const m = await tracer(pg, cdp, toucher(id), surEcran(id));
      m.morceaux = await pg.evaluate((n) => performance.getEntriesByType('resource').slice(n).filter((r) => /\.js$/.test(r.name)).map((r) => r.name.split('/').pop().replace(/-[\w-]{8}\.js$/, '')), n0);
      if (process.env.MORCEAUX && m.morceaux.length) console.log('      morceaux : ' + m.morceaux.join(' '));
      if (process.env.CAPTURES_GESTES) { try { require('fs').mkdirSync(process.env.CAPTURES_GESTES, { recursive: true }); await pg.screenshot({ path: require('path').join(process.env.CAPTURES_GESTES, `${t}-${id}.png`), timeout: 60000 }); } catch (e) { console.log('      capture : ' + e.message.split('\n')[0]); }
        const d = await pg.evaluate(() => ({ ecran: (document.querySelector('.vrm-main') || { getAttribute: () => null }).getAttribute('data-ecran'), attente: [...document.querySelectorAll('[data-attente]')].map((e) => (e.getAttribute('data-attente-ecran') || '') + '=' + e.getAttribute('data-attente')).slice(0, 10), vivants: document.querySelectorAll('.vrm-ecran-vivant').length, noeuds: document.querySelectorAll('*').length })).catch((e) => ({ err: e.message }));
        console.log('      page : ' + JSON.stringify(d)); }
      if (process.env.COMMITS) { const c = await pg.evaluate(() => { const C = window.__vrmCommits || { n: 0, par: {} }; const top = Object.entries(C.par).sort((a, b) => b[1] - a[1]).slice(0, 12); const r = { n: C.n, top, ex: top.slice(0, 4).map(([k]) => [k.slice(0, 40), (C.ex || {})[k]]) }; window.__vrmCommits = { n: 0, par: {} }; return r; }); console.log('      validations : ' + c.n + ' ' + JSON.stringify(c.top)); console.log('      exemples : ' + JSON.stringify(c.ex)); const piles = await pg.evaluate(() => { const P = window.__vrmPiles || {}; window.__vrmPiles = {}; return P; }); const pdf = await pg.evaluate(() => { const P = window.__vrmPdf || {}; window.__vrmPdf = {}; return P; }); console.log('      pdf : ' + Object.keys(pdf).length + ' lignes, ' + Object.values(pdf).reduce((t, x) => t + x.n, 0) + ' lectures ; ' + JSON.stringify(Object.entries(pdf).slice(0, 3))); }
      if (process.env.ECRITURES) { const e = await pg.evaluate(() => { const x = window.__vrmEcrits || {}; window.__vrmEcrits = {}; return Object.entries(x).sort((a, b) => b[1] - a[1]).slice(0, 8); }); console.log('      écritures : ' + JSON.stringify(e)); }
      sortie.push({ geste: `${t === 1 ? '1er' : '2e'} → ${id}`, ...m, memoire: await memoire(cdp) });
      console.log(`  ${t === 1 ? '1er' : '2e'} → ${id.padEnd(8)} INP ${String(m.inp).padStart(4)} ms · CPU ${String(m.cpu).padStart(5)} ms · plus longue ${m.plusLongue} ms · ${m.longues} longue(s) · écran ${m.mur} ms · style ${m.style} (max ${m.pireStyle}, ${m.elementsStyle} él.) · mise en page ${m.page} · script ≈ ${m.script}`);
    }
  }
  // « Plus » (la feuille derrière la photo du profil), puis la fermer.
  {
    const m = await tracer(pg, cdp, async () => { await TAP(pg.locator('[data-n-coque-plus]').first(), { timeout: 30000 }); }, () => !!document.querySelector('[data-n-feuille-plus]'));
    sortie.push({ geste: 'Plus (ouvrir)', ...m }); console.log(`  Plus (ouvrir)  INP ${m.inp} ms · CPU ${m.cpu} ms · plus longue ${m.plusLongue} ms · écran ${m.mur} ms`);
    await pg.keyboard.press('Escape').catch(() => {}); await attendre(600);
    if (await pg.evaluate(() => !!document.querySelector('[data-n-feuille-plus]'))) { await TAP(pg.locator('[data-n-coque-plus]').first(), { timeout: 5000 }).catch(() => {}); await attendre(600); }
  }
  // Une fiche depuis Annonces, et le retour.
  {
    await TAP(pg.locator(SEL_ONGLET('paires')).first(), { timeout: 30000 });
    await pg.waitForSelector('[data-fiche-ligne][data-fl-num], [data-eg-article]:not([data-eg-numero=""])', { timeout: 30000 }).catch(() => {}); await attendre(1500);
    const cible = await pg.evaluate(() => { for (const e of document.querySelectorAll('[data-fiche-ligne][data-fl-num], [data-eg-article]:not([data-eg-numero=""])')) { const r = e.getBoundingClientRect(); if (r.height < 30 || r.top < 110 || r.bottom > innerHeight - 110) continue; const x = r.left + Math.min(r.width / 2, 190), y = r.top + r.height / 2; if (e.contains(document.elementFromPoint(x, y))) return { x, y }; } return null; });
    if (cible) {
      const m = await tracer(pg, cdp, () => (ORDI ? pg.mouse.click(cible.x, cible.y) : pg.touchscreen.tap(cible.x, cible.y)), () => !!document.querySelector('[data-fiche-paire]'));
      sortie.push({ geste: 'fiche (ouvrir)', ...m }); console.log(`  fiche (ouvrir) INP ${m.inp} ms · CPU ${m.cpu} ms · plus longue ${m.plusLongue} ms · écran ${m.mur} ms`);
      const r = await tracer(pg, cdp, async () => { await pg.goBack().catch(() => {}); }, () => !document.querySelector('[data-fiche-paire]'));
      sortie.push({ geste: 'fiche (retour)', ...r }); console.log(`  fiche (retour) INP ${r.inp} ms · CPU ${r.cpu} ms · plus longue ${r.plusLongue} ms · écran ${r.mur} ms`);
    } else console.log('  fiche : aucune rangée à toucher');
  }
  return sortie;
}

// ── (28 nov., vitesse-fluide) LES GESTES : l'INP d'une frappe dans la recherche, d'une case cochée, d'une fiche ──
// Event Timing (`jalons`) : la durée de chaque interaction, du geste à l'image suivante (arrondie à 8 ms par le navigateur).
async function gestes(pg, cdp) {
  const out = [];
  const evtsDepuis = (p0) => pg.evaluate((p0) => ((window.__vrmIphone || {}).evts || []).filter((e) => e.t >= p0 - 5), p0).catch(() => []);
  const resumer = (nom, l, cpu) => { const d = l.map((e) => e.d).sort((a, b) => a - b); const r = { geste: nom, interactions: d.length, inp: d.length ? d[d.length - 1] : 0, mediane: d.length ? d[Math.floor(d.length / 2)] : 0, traitementMax: l.reduce((m, e) => Math.max(m, e.p), 0), cpu };
    out.push(r); console.log(`  ${nom.padEnd(30)} INP ${String(r.inp).padStart(4)} ms · médiane ${r.mediane} ms · traitement max ${r.traitementMax} ms · ${r.interactions} interaction(s)${cpu != null ? ' · CPU ' + cpu + ' ms' : ''}`); return r; };
  for (const id of ['annonces', 'ventes', 'achats']) {
    await TAP(pg.locator(SEL_ONGLET(CLE(id))).first(), { timeout: 30000 }).catch(() => {});
    await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return !!m && m.getAttribute('data-ecran') === x; }, id, { timeout: 60000 }).catch(() => {});
    await calme(pg, 2000, 30000);
    // La recherche de l'écran : le premier champ visible.
    const champ = pg.locator('.vrm-main input[type="search"]:visible').first();
    if (await champ.count()) {
      await TAP(champ, { timeout: 10000 }).catch(() => {}); await attendre(400);
      const p0 = await pg.evaluate(() => performance.now());
      const m = await tracer(pg, cdp, async () => { await pg.keyboard.type('nike', { delay: 180 }); }, () => true);
      resumer(`${id} · taper « nike »`, (await evtsDepuis(p0)).filter((e) => /^key|^input|^beforeinput/.test(e.n)), m.cpu);
      await calme(pg, 1500, 20000);
      const p1 = await pg.evaluate(() => performance.now());
      const m2 = await tracer(pg, cdp, async () => { for (let i = 0; i < 4; i++) { await pg.keyboard.press('Backspace'); await attendre(180); } }, () => true);
      resumer(`${id} · effacer`, (await evtsDepuis(p1)).filter((e) => /^key|^input|^beforeinput/.test(e.n)), m2.cpu);
      await pg.keyboard.press('Escape').catch(() => {}); await calme(pg, 1500, 20000);
    } else console.log(`  ${id} : aucun champ de recherche visible`);
    // Une case : la première case visible de la liste (sélection d'un lot).
    const cible = await pg.evaluate(() => { for (const e of document.querySelectorAll('.vrm-main input[type="checkbox"], .vrm-main [role="checkbox"]')) { const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8 || r.top < 60 || r.bottom > innerHeight - 90) continue; const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); if (h && (e === h || e.contains(h) || h.contains(e) || (h.closest && h.closest('label') && h.closest('label').contains(e)))) return { x, y }; } return null; });
    if (cible) {
      const p0 = await pg.evaluate(() => performance.now());
      const m = await tracer(pg, cdp, () => (ORDI ? pg.mouse.click(cible.x, cible.y) : pg.touchscreen.tap(cible.x, cible.y)), () => true);
      resumer(`${id} · cocher une case`, (await evtsDepuis(p0)).filter((e) => /pointer|click|touch|mouse/.test(e.n)), m.cpu);
      await (ORDI ? pg.mouse.click(cible.x, cible.y) : pg.touchscreen.tap(cible.x, cible.y)).catch(() => {}); await calme(pg, 1500, 20000);
    } else console.log(`  ${id} : aucune case visible`);
  }
  return out;
}

// ── Le défilement : un balayage tactile synthétisé (CDP), images par seconde et tâches longues ──
async function defiler(pg, cdp, id) {
  // L'écran ouvert directement (ouverture suivante, service worker) : aucune feuille ni recherche restée d'une étape d'avant.
  await pg.goto(`http://localhost:${PORT}/?tab=${id}`, { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction((x) => { const m = document.querySelector('.vrm-main'); return !!m && m.getAttribute('data-ecran') === x; }, id, { timeout: 60000 }).catch(() => {});
  // Le CALME d'abord : plus aucune tâche longue depuis 3 s (au plus 60 s) — sinon on mesurerait la fin du chargement, pas le défilement.
  await pg.evaluate(() => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > 3000 || performance.now() - t0 > 60000) { clearInterval(iv); ok(); } }, 250); }));
  await pg.evaluate(() => { window.__vrmImages = []; window.__vrmLongues = []; const boucle = (t) => { window.__vrmImages.push(t); window.__vrmRaf = requestAnimationFrame(boucle); }; window.__vrmRaf = requestAnimationFrame(boucle);
    try { window.__vrmObsL = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__vrmLongues.push(Math.round(e.duration)); }); window.__vrmObsL.observe({ type: 'longtask' }); } catch (_) {} });
  if (process.env.PROFIL_DEFIL) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
  const t0 = Date.now();
  // Le geste (CDP) : 6 balayages — « mouse » par défaut (le geste « touch » synthétisé ne fait pas défiler la coque native
  // sous Chromium émulé : 0 px mesuré) ; vers le bas, 1 400 px chacun à 1 600 px/s (un pouce rapide).
  for (let i = 0; i < 6; i++) await cdp.send('Input.synthesizeScrollGesture', { x: 195, y: 560, yDistance: -1400, speed: 1600, gestureSourceType: process.env.GESTE || 'mouse', repeatCount: 1, preventFling: false });
  const duree = Date.now() - t0;
  if (process.env.PROFIL_DEFIL) { const { profile } = await cdp.send('Profiler.stop'); fs.writeFileSync(process.env.PROFIL_DEFIL + '-' + id + '.json', JSON.stringify(agreger(profile), null, 1)); }
  const r = await pg.evaluate(() => { cancelAnimationFrame(window.__vrmRaf); try { window.__vrmObsL.disconnect(); } catch (_) {} const im = window.__vrmImages; const ecarts = im.slice(1).map((t, i) => t - im[i]);
    let haut = window.scrollY; for (const e of document.querySelectorAll('*')) if (e.scrollTop > haut) haut = e.scrollTop; return { images: im.length, duree: im.length > 1 ? im[im.length - 1] - im[0] : 0, pireImage: ecarts.length ? Math.round(Math.max(...ecarts)) : 0, saccades: ecarts.filter((x) => x > 50).length, longues: window.__vrmLongues, haut: Math.round(haut), noeuds: document.getElementsByTagName('*').length }; });
  const ips = r.duree ? Math.round(r.images / (r.duree / 1000)) : 0;
  const out = { ecran: id, ips, pireImageMs: r.pireImage, saccades: r.saccades, longues: r.longues.length, plusLongue: r.longues.length ? Math.max(...r.longues) : 0, defile: r.haut, noeuds: r.noeuds, mur: duree, memoire: await memoire(cdp) };
  console.log(`  défilement ${id.padEnd(8)} ${ips} images/s · pire image ${r.pireImage} ms · ${r.saccades} saccade(s) > 50 ms · ${out.longues} tâche(s) longue(s) (max ${out.plusLongue} ms) · défilé ${r.haut} px · ${r.noeuds} nœuds`);
  return out;
}

// ── (20 nov., instantane) L'AFFICHAGE INSTANTANÉ : du toucher (ou de l'ouverture) au PREMIER CONTENU RÉEL ──
//  ETAPES=…,instantane · PLANCHE=<dossier> (captures 0 / 300 / 1 000 / 3 000 ms, clair et sombre) · ETIQUETTE=avant|apres.
//  « Contenu réel » = une rangée ou un chiffre de l'écran visé VISIBLE dans le premier écran (pas un squelette) : celui
//  de la copie de l'appareil (`[data-copie-ecran]`) OU celui de l'écran vrai. Règle `contenuVisible` ci-dessous.
//  Chaque mesure : une page NEUVE (service worker actif), Aujourd'hui ouvert et calme, puis le toucher de l'onglet —
//  c'est la 1re visite de l'onglet dans la page (celle qui montrait le squelette gris géant).
const ECRANS_INSTANTANE = ['annonces', 'ventes', 'achats', 'compta', 'messages', 'journee'];
function contenuVisible(id) {
  const H = innerHeight;
  // La copie peinte AVANT l'app, dans l'écran de démarrage (src/OuvertureInstantanee.jsx).
  { const z = document.querySelector('#vrm-demarrage [data-copie-ecran="' + id + '"] [data-copie-contenu]'); if (z) { const r = z.getBoundingClientRect(); if (r.height > 8 && r.top < H - 60) return 'copie-avant-app'; } }
  const m = document.querySelector('#root .vrm-main');
  if (!m || m.getAttribute('data-ecran') !== id) return null;
  const vu = (e) => { const r = e.getBoundingClientRect(); if (r.height < 8 || r.bottom < 60 || r.top > H - 60 || r.width < 40) return false; const st = getComputedStyle(e); return st.visibility !== 'hidden' && +st.opacity > 0.5 && !e.closest('.vrm-attente-cache,[aria-hidden="true"],[data-squelette],.vrm-squelette'); };
  // La copie de l'appareil : ses rangées / chiffres.
  for (const e of m.querySelectorAll('[data-copie-ecran][data-copie-contenu], [data-copie-ecran] [data-copie-contenu]')) if (vu(e)) return 'copie';
  // L'instantané d'avant (Ma journée, Ventes, Annonces : src/instantaneEcran.js), s'il est montré.
  for (const e of m.querySelectorAll('[data-attente="instantane"] .vrm-ji:not([data-copie-ecran])')) if (vu(e) && /\d/.test(e.textContent || '')) return 'instantane';
  // L'écran vrai, prêt (ou au plafond) : une rangée, une vignette ou un chiffre lu.
  const att = m.querySelector('[data-attente-ecran="' + id + '"]');
  if (att && att.getAttribute('data-attente') === 'attente') return null;
  const SEL = '[data-fiche-ligne], [data-eg-article], [data-tt-ligne], [data-n-rangee], .n-rangee, [data-v2-chiffres="lu"], [data-vendu-mois]:not([data-vendu-mois=""]), [data-achat-rangee], [data-conv], [data-vente], li, [data-msg-groupe] > :not(:first-child)';
  const zone = att && att.getAttribute('data-attente') !== 'instantane' ? att : null;
  if (!zone) return null;
  for (const e of zone.querySelectorAll(SEL)) if (vu(e) && /\S/.test(e.textContent || '')) return 'vrai';
  return null;
}
// Une page neuve (service worker actif), le thème posé avant tout script.
async function pageNeuve(ctx, theme) {
  const pg = await ctx.newPage();
  await pg.addInitScript((s) => { try { localStorage.setItem('vinted_dark', JSON.stringify(s)); localStorage.setItem('vrm_apparence', JSON.stringify(s ? 'sombre' : 'clair')); } catch (_) {} }, theme === 'sombre');
  const cdp = await cdpDe(pg);
  return { pg, cdp };
}
const calme = (pg, sans = 1500, max = 25000) => pg.evaluate(([sans, max]) => new Promise((ok) => { let der = performance.now(); try { new PerformanceObserver((l) => { if (l.getEntries().length) der = performance.now(); }).observe({ type: 'longtask' }); } catch (_) {} const t0 = performance.now(); const iv = setInterval(() => { if (performance.now() - der > sans || performance.now() - t0 > max) { clearInterval(iv); ok(); } }, 200); }), [sans, max]);
const ONGLET_DE = (id) => (id === 'annonces' ? 'paires' : id);
// La sonde posée dans la page : le premier instant (performance.now) où le contenu est visible, et qui l'a montré.
async function poserSonde(pg, id, depuisToucher) {
  await pg.evaluate(([src, id, depuisToucher]) => {
    const f = new Function('id', src); const C = window.__vrmContenu = { t0: 0, t: null, par: null };
    const boucle = () => { if (C.t != null) return; let r = null; try { r = f(id); } catch (_) {} if (r) { C.t = performance.now() - C.t0; C.par = r; return; } requestAnimationFrame(boucle); };
    if (depuisToucher) document.addEventListener('pointerdown', () => { C.t0 = performance.now(); requestAnimationFrame(boucle); }, { once: true, capture: true });
    else requestAnimationFrame(boucle);
  }, [`return (${contenuVisible.toString()})(id);`, id, depuisToucher]);
}
async function instantane(ctx) {
  const out = { ouverture: [], toucher: [] };
  const dossier = process.env.PLANCHE || '';
  const etiquette = process.env.ETIQUETTE || 'mesure';
  if (dossier) fs.mkdirSync(dossier, { recursive: true });
  const themes = String(process.env.THEMES || (dossier ? 'clair,sombre' : 'clair')).split(',');
  const ecrans = String(process.env.ECRANS || ECRANS_INSTANTANE.join(',')).split(',');
  for (const theme of themes) {
    // 0) Une visite de chaque onglet (la même avant et après) : l'app range ce qu'elle range (copies, mémoires).
    {
      const { pg, cdp } = await pageNeuve(ctx, theme);
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await pg.waitForSelector('[data-attente-ecran="journee"][data-attente="pret"]', { timeout: 120000 }).catch(() => {});
      for (const id of ecrans) {
        if (id === 'messages') await pg.evaluate(() => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: 'messages' })));
        else await TAP(pg.locator(SEL_ONGLET(ONGLET_DE(id))).first(), { timeout: 30000 }).catch(() => {});
        await pg.waitForSelector(`[data-attente-ecran="${id}"][data-attente="pret"]`, { timeout: 60000 }).catch(() => {});
        await calme(pg, 1500, 15000); await attendre(3500);
      }
      await cdp.detach().catch(() => {}); await pg.close();
    }
    // A) L'OUVERTURE sur l'écran (page neuve, `?tab=`) : de la navigation au premier contenu ; captures 0 / 300 / 1 000 / 3 000 ms.
    for (const id of ecrans) {
      const { pg, cdp } = await pageNeuve(ctx, theme);
      await pg.addInitScript(([src, id]) => {
        const f = new Function('id', src); const C = window.__vrmContenu = { t0: 0, t: null, par: null };
        const boucle = () => { if (C.t != null) return; let r = null; try { r = f(id); } catch (_) {} if (r) { C.t = performance.now(); C.par = r; return; } requestAnimationFrame(boucle); };
        requestAnimationFrame(boucle);
        try { window.__vrmEcrituresCopie = 0; } catch (_) {}
      }, [`return (${contenuVisible.toString()})(id);`, id]);
      await pg.goto(`http://localhost:${PORT}/?tab=${id}`, { waitUntil: 'commit', timeout: 120000 });
      for (const ms of [0, 300, 1000, 3000]) {
        for (let k = 0; k < 400; k++) { const n = await pg.evaluate(() => performance.now()).catch(() => 0); if (n >= ms) break; await attendre(15); }
        if (dossier) await pg.screenshot({ path: path.join(dossier, `${etiquette}-${theme}-ouverture-${id}-${ms}.png`), scale: 'css' }).catch(() => {});
        if (process.env.APERCU && ms === 3000) console.log('     (essai : ' + JSON.stringify(await pg.evaluate(() => { const h = document.querySelector('#root [data-copie-ecran]'); if (!h) return null; const pad = () => getComputedStyle(h).paddingLeft; const out = { base: pad() }; for (const a of ['aria-busy', 'inert', 'data-copie-contenu', 'data-copie-ecran', 'data-copie-etat', 'data-copie-age', 'data-copie-t']) { const v = h.getAttribute(a); if (v == null) continue; h.removeAttribute(a); out[a] = pad(); h.setAttribute(a, v); } for (const c of ['vrm-ce', 'vrm-ce-contenu', 'vrm-attente-sans-fondu']) { h.classList.remove(c); out[c] = pad(); h.classList.add(c); } out.prec = h.previousElementSibling && h.previousElementSibling.className; return out; }).catch((e) => String(e))) + ')');
        if (process.env.APERCU && ms === 3000) console.log('     (copie dans l\'app : ' + JSON.stringify(await pg.evaluate(() => { const r0 = document.querySelector('#root [data-copie-ecran] .n-rangee'); const out = []; for (let x = r0; x && x !== document.body; x = x.parentElement) { const r = x.getBoundingClientRect(); const st = getComputedStyle(x); out.push(String(x.className || x.tagName).slice(0, 34) + ':' + Math.round(r.left) + '/' + Math.round(r.width) + ':' + st.display + (st.minWidth !== 'auto' && st.minWidth !== '0px' ? ':minw=' + st.minWidth : '') + ':m=' + st.margin + ':p=' + st.padding); } return out; }).catch((e) => String(e))) + ')');
        if (process.env.APERCU && ms === 300) console.log('     (largeurs : ' + JSON.stringify(await pg.evaluate(() => { const h = document.querySelector('#vrm-apercu .vrm-ce-contenu'); if (!h) return null; const out = []; let e = h; const n0 = document.querySelector('#vrm-apercu nav [data-n-onglet], #vrm-apercu nav button, #vrm-apercu nav a') || document.querySelector('#vrm-apercu nav'); for (let x = n0; x && x !== document.body; x = x.parentElement) { const r = x.getBoundingClientRect(); const st = getComputedStyle(x); out.push((x.className || x.tagName).toString().slice(0, 30) + ':' + Math.round(r.left) + '/' + Math.round(r.width) + ':' + st.display + ':' + st.position + (st.transform !== 'none' ? ':T' : '') + (st.contain !== 'none' ? ':C' + st.contain : '') + (st.backdropFilter !== 'none' ? ':B' : '') + (st.filter !== 'none' ? ':F' : '') + ':r=' + st.borderRadius + ':o=' + st.overflow + (st.clipPath !== 'none' ? ':clip=' + st.clipPath : '') + (st.maskImage && st.maskImage !== 'none' ? ':mask=' + st.maskImage.slice(0, 60) : '') + ':op=' + st.opacity); } const n = document.querySelector('#vrm-apercu nav'); const pile = (x, y) => document.elementsFromPoint(x, y).slice(0, 6).map((e) => (e.id ? '#' + e.id : '') + String(e.className || e.tagName).slice(0, 30) + ':' + getComputedStyle(e).opacity + ':' + (getComputedStyle(e).clipPath !== 'none' ? 'clip' : '') + (getComputedStyle(e).maskImage && getComputedStyle(e).maskImage !== 'none' ? 'mask' : '')); return { pile1: pile(30, 815), pile2: pile(8, 60), chaine: out, nav: n && Math.round(n.getBoundingClientRect().width), html: document.documentElement.getAttribute('style'), vw: innerWidth }; }).catch((e) => String(e))) + ')');
      }
      await pg.waitForFunction(() => window.__vrmContenu && window.__vrmContenu.t != null, null, { timeout: 30000, polling: 50 }).catch(() => {});
      const C = await pg.evaluate(() => window.__vrmContenu).catch(() => null);
      const av = await pg.evaluate(() => [window.__vrmApercuCopie, window.__vrmApercu, (performance.getEntriesByName('vrm:apercu-copie')[0] || {}).startTime, Object.keys(localStorage).filter((k) => /porte_ok|abo_dernier|equipe_cache|copie_index|journee_inst/.test(k))]).catch(() => []);
      const r = { theme, ecran: id, premierContenuMs: C && C.t != null ? Math.round(C.t) : null, par: C && C.par, avantApp: av };
      if (process.env.DEBUG || process.env.APERCU) console.log('     (avant l\'app : ' + JSON.stringify(av) + ')');
      out.ouverture.push(r);
      console.log(`  ${theme.padEnd(6)} ouverture ?tab=${id.padEnd(8)} premier contenu ${r.premierContenuMs == null ? '— (rien en 30 s)' : r.premierContenuMs + ' ms'} (${r.par || '—'})`);
      await cdp.detach().catch(() => {}); await pg.close();
    }
    // B) LE TOUCHER de l'onglet, 1re visite dans la page (page neuve sur Aujourd'hui, calme) : du toucher au premier contenu.
    if (theme === themes[0]) for (const id of ecrans) {
      const { pg, cdp } = await pageNeuve(ctx, theme);
      const depart = id === 'journee' ? 'annonces' : 'journee';
      await pg.goto(`http://localhost:${PORT}/?tab=${depart}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
      await pg.waitForSelector('[data-n-onglet]', { timeout: 120000 }).catch(() => {});
      await calme(pg, 1500, 20000);
      await poserSonde(pg, id, id !== 'messages');
      if (id === 'messages') await pg.evaluate(() => { window.__vrmContenu.t0 = performance.now(); window.dispatchEvent(new CustomEvent('vrm:aller', { detail: 'messages' })); });
      else await TAP(pg.locator(SEL_ONGLET(ONGLET_DE(id))).first(), { timeout: 30000 }).catch(() => {});
      await pg.waitForFunction(() => window.__vrmContenu && window.__vrmContenu.t != null, null, { timeout: 30000, polling: 50 }).catch(() => {});
      const C = await pg.evaluate(() => window.__vrmContenu).catch(() => null);
      const r = { theme, ecran: id, premierContenuMs: C && C.t != null ? Math.round(C.t) : null, par: C && C.par };
      out.toucher.push(r);
      console.log(`  ${theme.padEnd(6)} toucher → ${id.padEnd(8)} premier contenu ${r.premierContenuMs == null ? '— (rien en 30 s)' : r.premierContenuMs + ' ms'} (${r.par || '—'})`);
      await cdp.detach().catch(() => {}); await pg.close();
    }
  }
  return out;
}

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server', '--explicitly-allowed-ports=' + PORT] });
  const sortie = { dist: DIST, cpu: CPU, reseau: '4G 150 ms · 9 Mbit/s', base: { annonces: 1200, ventes: 1500, achats: 800 } };
  try {
    const ctx = await nav.newContext(ORDI ? { viewport: { width: 1512, height: 945 }, screen: { width: 1512, height: 982 }, deviceScaleFactor: 2, isMobile: false, hasTouch: false, locale: 'fr-FR', serviceWorkers: 'allow' }
      : { viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'fr-FR',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1', serviceWorkers: 'allow' });
    // (22 nov.) `BANC_MAINTENANT` : l'horloge de la page posée à cette heure-là (elle avance ensuite normalement), la même
    // que celle de la base inventée (`_base-volume`).
    if (process.env.BANC_MAINTENANT) await ctx.clock.install({ time: new Date(process.env.BANC_MAINTENANT) });
    await preparer(ctx);
    console.log(`${ORDI ? 'Ordinateur 1512 × 945 @2' : 'iPhone 390 × 844 @3'} · CPU ×${CPU} · 4G (150 ms, ${DEBIT * 8 / 1e6} Mbit/s) · ${path.relative(process.cwd(), DIST) || DIST}`);
    // 1) à froid
    const froid = await ouvrirApp(ctx, 'froid');
    const dire = (r) => console.log(`  ${r.quand.padEnd(9)} 1re peinture ${r.fcp} ms · coque ${r.coque} ms · écran utile ${r.utile} ms · chiffres ${r.chiffres} ms · JS+CSS ${r.jsKo} Ko (${r.fichiers}) · ${r.longuesAvantUtile} tâches longues avant l'écran utile (${r.longuesMsAvantUtile} ms, max ${r.plusLongue}) · tas ${r.memoire.tasMo} Mo · ${r.memoire.noeuds} nœuds${r.erreurs.length ? ' · ERREURS ' + r.erreurs.join(' | ') : ''}`);
    dire(froid.r);
    // le service worker a-t-il pris la page ? (il range la coquille à la 1re ouverture)
    await froid.pg.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 30000 }).catch(() => {});
    await attendre(6000);
    await froid.pg.close();
    // 2) les ouvertures suivantes (service worker) — deux, la 2e fait foi
    const seulInstantane = ETAPES.every((e) => e === 'instantane');
    const chaud1 = seulInstantane ? null : await ouvrirApp(ctx, 'chaud 1'); if (chaud1) { dire(chaud1.r); await chaud1.pg.close(); }
    const chaud = seulInstantane ? { r: {}, pg: null, cdp: null } : await ouvrirApp(ctx, 'chaud 2'); if (chaud.pg) dire(chaud.r);
    sortie.demarrage = { froid: froid.r, chaud1: chaud1 && chaud1.r, chaud2: chaud.r };
    if (ETAPES.includes('onglets')) { console.log('Changements d\'onglet (temps de fil, CPU ×' + CPU + ')'); sortie.onglets = await onglets(chaud.pg, chaud.cdp); }
    if (ETAPES.includes('gestes')) { console.log('Gestes (INP : du geste à l\'image suivante)'); sortie.gestes = await gestes(chaud.pg, chaud.cdp); }
    if (ETAPES.includes('argent')) { console.log('Argent après Annonces → Ventes → Achats (défaut « Argent bloqué », 22 nov.)' + (process.env.BANC_MAINTENANT ? ' · horloge ' + process.env.BANC_MAINTENANT : '')); sortie.argent = await argentApresSequence(chaud.pg, chaud.cdp); }
    if (ETAPES.includes('defilement')) { console.log('Défilement'); sortie.defilement = []; for (const id of ['annonces', 'ventes', 'achats']) { try { sortie.defilement.push(await defiler(chaud.pg, chaud.cdp, id)); } catch (e) { console.log(`  défilement ${id} : pas mesuré (${String(e.message || e).split('\n')[0].slice(0, 100)})`); } } }
    if (ETAPES.includes('instantane')) { console.log('Affichage instantané (1re visite de chaque onglet, page neuve, service worker)'); sortie.instantane = await instantane(ctx); }
    sortie.memoireFin = chaud.cdp ? await memoire(chaud.cdp) : null;
    await ctx.close();
  } finally { await nav.close(); srv.close(); }
  // Résumé
  const o = sortie.onglets || [];
  const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const deux = o.filter((x) => /^2e/.test(x.geste));
  sortie.resume = { froidUtile: sortie.demarrage.froid.utile, froidChiffres: sortie.demarrage.froid.chiffres, chaudUtile: sortie.demarrage.chaud2.utile, chaudChiffres: sortie.demarrage.chaud2.chiffres,
    jsFroidKo: sortie.demarrage.froid.jsKo, ongletCpuMed2e: med(deux.map((x) => x.cpu)), ongletCpuMax2e: Math.max(0, ...deux.map((x) => x.cpu)), ongletCpuMed1er: med(o.filter((x) => /^1er/.test(x.geste)).map((x) => x.cpu)),
    defilementPireLongue: Math.max(0, ...(sortie.defilement || []).map((x) => x.plusLongue)), tasFinMo: sortie.memoireFin && sortie.memoireFin.tasMo };
  console.log('\nRésumé : ' + JSON.stringify(sortie.resume));
  console.log('Objectifs : chaud < 1 000 ms · froid (4G) < 3 000 ms · onglet < 150 ms de CPU · aucune tâche > 50 ms au défilement');
  if (process.env.JSON) fs.writeFileSync(process.env.JSON, JSON.stringify(sortie, null, 1));
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
