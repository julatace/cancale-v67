// ════════════════════════════════════════════════════════════════════════════
//  BANC — L'OUVERTURE INSTANTANÉE (14 nov., proposition 84 choisie par Julien :
//  « l'app s'ouvre en moins d'une seconde sur tes dernières données, même sans
//  réseau, puis se met à jour »).
//
//    npm run build && node scripts/bancs/ouverture-instantanee.cjs [dist]
//    BANC_PORT=…  SHOTS=<dossier>  PASSES=3 (ouvertures mesurées après la 2e)
//    MESURE=1 : imprime les mesures en JSON (pour le récit), sans rien juger de plus.
//
//  Base INVENTÉE à son volume (le dépôt est public) : 10 comptes, 2 000 ventes,
//  2 500 achats, 1 000 annonces (_base-volume.cjs). Téléphone 390 px tactile,
//  service worker ACTIF (l'app installée), processeur ×4 (CDP), réseau « Fast 3G »
//  simulé AU SERVEUR (562,5 ms d'aller-retour, 1,44 Mb/s descendant partagé) pour
//  TOUT : les fichiers de l'app, la base, /api/ — une requête servie par le cache
//  du service worker ne paie rien, comme sur le téléphone.
//
//  « Premier écran utile » de Ma journée = l'écran de démarrage parti ET des
//  chiffres de Ma journée peints : les cases de l'instantané (`data-ji-case`) ou
//  celles de l'écran vrai prêt (`data-fu-case="vendu-mois"`). Jamais le squelette.
//
//  Contrôles :
//   1  1re ouverture (réseau normal) : l'écran vrai ; l'instantané est rangé pour
//      CET uid, le service worker contrôle la page.
//   2  2e ouverture, CPU ×4, Fast 3G : premier écran utile < 1 s ; la date de
//      l'instantané est dite (« Mis à jour il y a … ») ; puis l'écran vrai prend
//      la place ; lectures de la base : nombre, poids, et AUCUNE `select=data`
//      sur une ligne lourde ; JS téléchargé / analysé ; tâches longues.
//   3  Hors ligne (réseau coupé, service worker seul) : Ma journée peinte avec la
//      date de l'instantané, rien n'est demandé à la base.
//   4  Lecture réseau ratée (la base répond 503) : l'instantané RESTE, la panne
//      est dite à côté de sa date, aucune écriture ne part vers la base.
//   5  Un AUTRE compte VRM sur le même appareil : aucun instantané du précédent
//      n'est montré, ni gardé (stockage relu).
//  Données inventées ; rien ne sort de la machine (garde réseau des bancs).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));
const DIST = process.argv[2] || process.env.BANC_DIST || path.join(RACINE, 'dist');
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ouverture-instantanee');
const PASSES = Math.max(1, Number(process.env.PASSES) || 3);
const MESURE = process.env.MESURE === '1';
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
const UID = '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b';   // la session de banc (_porte-banc.cjs)
const AUTRE = '0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c';

const base = fabriquer({ comptes: 10, volumeReel: true, ventes: 2000, achats: 2500, annonces: 1000 });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le contrôle a pu s’exécuter', String(e && e.message || e).split('\n')[0].slice(0, 220)); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const mediane = (l) => { const s = l.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };

// ── « Fast 3G » (préréglage de DevTools) : 562,5 ms d'aller-retour, 1,44 Mb/s descendant ──
// Un tuyau PARTAGÉ : deux réponses ne descendent pas plus vite ensemble qu'une seule.
const reseau = { lent: false, coupe: false, tuyau: 0 };
const RTT = 562.5, DEBIT = 1.6e6 / 8 * 0.9;   // octets par seconde
function delai(octets) {
  if (!reseau.lent) return 0;
  const now = Date.now();
  const debut = Math.max(now + RTT, reseau.tuyau);
  reseau.tuyau = debut + (octets / DEBIT) * 1000;
  return reseau.tuyau - now;
}

const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/json', '.json': 'application/json', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
// ⚠️ AUCUNE ROUTE PLAYWRIGHT. Une route (même celle de la garde réseau) coupe le cache HTTP du
// navigateur : le service worker voyait alors CHAQUE ouverture comme un rechargement forcé
// (`request.cache === 'reload'`) et allait au réseau — mesuré : 650 ms de plus, une fiction.
// Ici tout est servi par de VRAIS serveurs locaux : l'app et /api/ (http://localhost), la base sous
// son vrai nom (https, `--host-resolver-rules` vers 127.0.0.1, certificat jetable) — comme session.cjs.
const HOTE_BASE = 'lgonxzrzjcqthjtbdpzo.supabase.co';
const PORT_BASE = PORT < 50000 ? PORT + 15000 : PORT - 15000;   // jamais le port du banc suivant (lancer-bancs donne base + rang)
const statiques = [];
const journal = [];
const etat = { panne: false };
const servi = (r, statut, entetes, corps) => { try { r.writeHead(statut, entetes); r.end(corps); } catch (_) {} };
const srv = http.createServer((q, r) => {
  if (reseau.coupe) { r.destroy(); return; }
  let f = q.url.split('?')[0];
  if (f === '/__diag') { if (process.env.DIAG) console.log('  SW ' + decodeURIComponent(q.url.slice(8))); return servi(r, 204, {}, ''); }
  if (f.startsWith('/api/')) {
    // La forme des routes que le démarrage lit (src/App.jsx : lireEquipe, l'abonnement) ; le reste : `{ok:true}`.
    // `mode=confidentialite` : la porte de banc (_porte-banc.cjs) y répond l'uid de la session.
    journal.push({ t: Date.now(), m: q.method, u: 'api:' + q.url.slice(5), o: 0 });
    const corps = /mode=equipe/.test(q.url) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true }
      : /mode=abonnement/.test(q.url) ? { ok: true, acces: true, statut: 'active', configure: true }
      : { ok: true, pret: true };
    q.resume();
    return setTimeout(() => servi(r, 200, { 'content-type': 'application/json', 'cache-control': 'no-store' }, JSON.stringify(corps)), delai(300));
  }
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f);
  if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return servi(r, 404, {}, '');
  const t = types[path.extname(p)] || 'application/octet-stream'; let b = fs.readFileSync(p);
  const gz = /javascript|css|html|json|svg/.test(t);
  if (gz) b = zlib.gzipSync(b, { level: 6 });
  // `fond` : une relecture DERRIÈRE l'ouverture (le service worker relit la coquille en `no-store`, le
  // navigateur vérifie `sw.js`) — rien que la page attende pour se peindre.
  statiques.push({ u: f, o: b.length, t: Date.now(), fond: /no-cache|no-store/.test(String(q.headers['cache-control'] || '') + String(q.headers.pragma || '')) || f === '/sw.js' || f === '/hors-ligne-assets.json' });
  // Les en-têtes de Vercel (vercel.json) : `/assets/` immuables, le reste revalidé.
  setTimeout(() => servi(r, 200, { 'content-type': t, ...(gz ? { 'content-encoding': 'gzip' } : {}), 'cache-control': f.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate' }, b), delai(b.length));
});
srv.on('error', (e) => { console.log('KO  le port ' + PORT + ' est pris (' + e.code + ') — relance avec BANC_PORT=…'); process.exit(1); });

// ── La base (PostgREST inventé, _base-volume.cjs) sous son vrai nom, servie avec le même réseau ──
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, range-unit, x-client-info, accept-profile, content-profile, x-vrm-equipe', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS, HEAD', 'access-control-expose-headers': 'Content-Range' };
function certificat() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-oi-'));
  const k = path.join(dir, 'cle.pem'), c = path.join(dir, 'cert.pem');
  require('child_process').execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', '/CN=' + HOTE_BASE, '-addext', 'subjectAltName=DNS:' + HOTE_BASE], { stdio: 'ignore' });
  const x = { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return x;
}
const srvBase = require('https').createServer(certificat(), (q, r) => {
  if (reseau.coupe) { r.destroy(); return; }
  if (q.method === 'OPTIONS') return servi(r, 204, CORS, '');
  const u = 'https://' + HOTE_BASE + q.url;
  if (/\/auth\/v1\//.test(q.url)) { q.resume(); return servi(r, 200, { ...CORS, 'content-type': 'application/json' }, '{}'); }
  if (!/\/rest\/v1\//.test(q.url)) { q.resume(); return servi(r, 404, CORS, ''); }
  const rec = { t: Date.now(), m: q.method, u: decodeURIComponent(q.url.replace(/^.*\/rest\/v1\//, '')), o: 0 };
  journal.push(rec);
  let corpsRecu = ''; q.on('data', (d) => { corpsRecu += d; });
  q.on('end', () => {
    if (etat.panne) return setTimeout(() => servi(r, 503, { ...CORS, 'content-type': 'application/json' }, '{"message":"indisponible"}'), delai(60));
    if (q.method !== 'GET' && q.method !== 'HEAD') {
      let d = []; try { const x = JSON.parse(corpsRecu || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {}
      return setTimeout(() => servi(r, 201, { ...CORS, 'content-type': 'application/json' }, JSON.stringify(d)), delai(200));
    }
    const rep = repondre(u, q.headers.range, base);
    const body = zlib.gzipSync(JSON.stringify(rep.body));
    rec.o = body.length;
    setTimeout(() => { rec.f = Date.now(); servi(r, rep.status, { ...CORS, ...(rep.headers || {}), 'content-type': 'application/json', 'content-encoding': 'gzip' }, body); }, delai(body.length));
  });
});

// ── L'ÉTALON DU PROCESSEUR ─────────────────────────────────────────────────────
// La machine des bancs est PARTAGÉE (mesuré le 14 nov. : charge de 20 à 49 sur 4 cœurs, la même charge de
// calcul variant de 270 à 1 400 ms dans Chromium). Un « ×4 » posé sur une machine déjà 5 fois plus lente
// mesure du ×20. Avant chaque ouverture mesurée, une charge FIXE est exécutée ici : son temps ÉCOULÉ divisé
// par son temps PROCESSEUR (process.cpuUsage, qui ne dépend pas de la file d'attente) dit combien la
// machine est encombrée à cet instant (1 = au repos). Le ralentissement posé est 4 ÷ encombrement, entre
// 1 et 4 : « ×4 » par rapport à la machine AU REPOS. Le taux posé et l'encombrement sont imprimés avec
// chaque mesure ; `CPU_MESURE=4` impose ×4 brut (sans étalon).
function encombrement() {
  const charge = () => { let x = 0; for (let i = 0; i < 2e7; i++) x = (x * 31 + i) % 1000003; const o = []; for (let i = 0; i < 1e5; i++) o.push({ a: i, b: String(i) }); return JSON.stringify(o.slice(0, 2e4)).length + (x & 0); };
  const r = [];
  for (let i = 0; i < 3; i++) { const t = process.hrtime.bigint(); const c = process.cpuUsage(); charge(); const mur = Number(process.hrtime.bigint() - t) / 1e6; const u = process.cpuUsage(c); const cpu = (u.user + u.system) / 1000; r.push(cpu > 0 ? mur / cpu : 1); }
  return Math.round(r.sort((a, b) => a - b)[1] * 100) / 100;
}
const tauxCpu = (enc) => Math.max(1, Math.min(4, Math.round((4 / Math.max(1, enc)) * 100) / 100));

// Posé avant l'app : l'heure du premier écran utile, mesurée DANS la page (rAF), et les tâches longues.
const SONDE = () => {
  window.__oi = { inst: null, vrai: null, demarrageParti: null, mention: null, panne: null, dansDemarrage: false };
  window.__lt = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
  const tick = () => {
    const o = window.__oi; const t = Math.round(performance.now());
    const d = document.getElementById('vrm-demarrage');
    const parti = document.readyState !== 'loading' && !!document.getElementById('root') && (!d || d.hasAttribute('data-sortie'));
    if (parti && o.demarrageParti == null) o.demarrageParti = t;
    // L'instantané est À L'ÉCRAN : dans la coque une fois l'écran de démarrage parti, ou peint DANS
    // l'écran de démarrage (src/OuvertureInstantanee.jsx, `#vrm-apercu`) tant qu'il est là.
    const dedans = d && !d.hasAttribute('data-sortie') ? d.querySelector('#vrm-apercu [data-journee-instantane] [data-ji-case] b') : null;
    const caseInst = dedans || (parti ? document.querySelector('[data-journee-instantane] [data-ji-case] b') : null);
    if (o.inst == null && caseInst && caseInst.textContent.trim()) { o.inst = t; o.dansDemarrage = !!dedans; }
    if (o.mention == null && document.querySelector('[data-journee-instantane] [data-ji-mention]')) o.mention = t;
    const vrai = document.querySelector('[data-attente-ecran="journee"][data-attente="pret"] [data-fu-case="vendu-mois"] b');
    if (parti && o.vrai == null && vrai && vrai.textContent.trim()) o.vrai = t;
    if (o.vrai == null || o.inst == null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
const lire = (pg) => pg.evaluate(() => {
  const res = performance.getEntriesByType('resource').filter((r) => /\.(js|mjs)(\?|$)/.test(r.name));
  const css = performance.getEntriesByType('resource').filter((r) => /\.css(\?|$)/.test(r.name));
  const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime;
  return { ...window.__oi, lt: window.__lt || [], fcp: fcp == null ? null : Math.round(fcp),
    jsN: res.length, jsReseauKo: Math.round(res.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024),
    jsAnalyseKo: Math.round(res.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024),
    cssAnalyseKo: Math.round(css.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024),
    sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller) };
});
const etatEcran = (pg) => pg.evaluate(() => {
  const inst = document.querySelector('[data-journee-instantane]');
  const m = inst && inst.querySelector('[data-ji-mention]');
  const vrai = document.querySelector('[data-attente-ecran="journee"][data-attente="pret"] [data-fu-case="vendu-mois"]');
  const p = document.querySelector('[data-instantane-panne]');
  const d = document.getElementById('vrm-demarrage');
  return { inst: !!inst, cases: inst ? inst.querySelectorAll('[data-ji-case]').length : 0, t: inst ? inst.getAttribute('data-ji-t') : null,
    mention: m ? m.textContent.replace(/\s+/g, ' ').trim() : '', vrai: !!vrai, panne: p ? p.getAttribute('data-instantane-panne') : null, panneTexte: p ? p.textContent.replace(/\s+/g, ' ').trim() : '',
    demarrage: !!(d && !d.hasAttribute('data-sortie')), texte: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400) };
});
// Le stockage de l'appareil : clés de l'instantané (localStorage) et bases IndexedDB.
const stockage = (pg) => pg.evaluate(async () => {
  const cles = Object.keys(localStorage).filter((k) => /instantan/i.test(k));
  const idb = [];
  try {
    const bases = indexedDB.databases ? await indexedDB.databases() : [];
    for (const b of bases) {
      const db = await new Promise((r) => { const q = indexedDB.open(b.name); q.onsuccess = () => r(q.result); q.onerror = () => r(null); });
      if (!db) continue;
      for (const s of [...db.objectStoreNames]) {
        const tx = db.transaction(s, 'readonly');
        const tout = await new Promise((r) => { const q = tx.objectStore(s).getAll(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
        const cl = await new Promise((r) => { const q = tx.objectStore(s).getAllKeys(); q.onsuccess = () => r(q.result); q.onerror = () => r([]); });
        idb.push({ base: b.name, store: s, cles: cl.map(String), texte: JSON.stringify(tout).slice(0, 200000) });
      }
      db.close();
    }
  } catch (_) {}
  return { cles, valeurs: cles.map((k) => localStorage.getItem(k) || ''), idb };
});

async function ouvrir(ctx, { cpu = 4, attendrePret = true, delaiMax = 60000, photo = '' } = {}) {
  const pg = await ctx.newPage();
  const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message).slice(0, 200)));
  const cdp = await ctx.newCDPSession(pg);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await pg.addInitScript(SONDE);
  // PROFIL=1 : profil CPU de la page jusqu'au premier écran utile, agrégé par fichier (diagnostic).
  if (process.env.PROFIL && photo) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
  ouvrir.vu = false;
  await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});
  const fin = Date.now() + delaiMax;
  while (Date.now() < fin) {
    const o = await pg.evaluate(() => window.__oi).catch(() => null);
    if (photo && o && o.inst != null && !ouvrir.vu) {
      ouvrir.vu = true;
      if (process.env.PROFIL) {
        const { profile } = await cdp.send('Profiler.stop');
        const parId = new Map(profile.nodes.map((n) => [n.id, n])); const par = new Map(); const fn = new Map(); const dt = profile.timeDeltas || [];
        let t = profile.startTime; const fin = profile.startTime + o.inst * 1000 + 50000;
        profile.samples.forEach((id, i) => { t += dt[i] || 0; if (t > fin) return; const n = parId.get(id); const f = (n.callFrame.url || '').replace(/^.*\//, '') || n.callFrame.functionName || '?'; par.set(f, (par.get(f) || 0) + (dt[i + 1] || dt[i] || 0) / 1000); const k = f + ':' + (n.callFrame.functionName || '?') + ':' + n.callFrame.lineNumber; fn.set(k, (fn.get(k) || 0) + (dt[i + 1] || dt[i] || 0) / 1000); });
        console.log('  PROFIL (ms, par fichier) : ' + [...par].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([f, ms]) => f + '=' + Math.round(ms)).join(' '));
        console.log('  PROFIL (ms, par fonction) : ' + [...fn].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([f, ms]) => f + '=' + Math.round(ms)).join(' '));
      }
      await shot(pg, photo + (o.dansDemarrage ? '-avant-app' : '-coque'));
    }
    if (o && (attendrePret ? o.vrai != null : (o.inst != null || o.vrai != null))) break;
    await attendre(150);
  }
  return { pg, cdp, erreurs };
}
// Le calme : plus aucune lecture depuis 2,5 s.
async function calme(journal, max = 40000) {
  let n = journal.length, t = Date.now(); const fin = Date.now() + max;
  while (Date.now() - t < 2500 && Date.now() < fin) { await attendre(250); if (journal.length !== n) { n = journal.length; t = Date.now(); } }
}
const lourde = (u) => /select=data(&|$)/.test(u) && !/id=eq\.(vinted_|vrm_|ext_|import_|journal_)/.test(u) && /(id=eq\.main|harvest_|email_bord|_label_|_txn_)/.test(u);

(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  await new Promise((r) => srvBase.listen(PORT_BASE, '127.0.0.1', r));
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('KO  pas de build dans ' + DIST); process.exit(1); }
  // La base sous son vrai nom vers le serveur local ; tout autre nom réel ne se résout pas (garde réseau).
  const regles = `MAP ${HOTE_BASE} 127.0.0.1:${PORT_BASE}, MAP *.supabase.co ~NOTFOUND, MAP *.supabase.in ~NOTFOUND, MAP vrm.center ~NOTFOUND, MAP *.vrm.center ~NOTFOUND, MAP * ~NOTFOUND, EXCLUDE localhost`;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles}`, '--use-angle=swiftshader'] });
  // LARGEUR=1512 / THEME=dark : la même ouverture sur ordinateur, en sombre (captures à regarder).
  const L = Number(process.env.LARGEUR) || 390;
  const ctx = await nav.newContext({ viewport: { width: L, height: L < 600 ? 844 : 945 }, ...(L < 600 ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}), colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light' });
  if (process.env.THEME === 'dark') await ctx.addInitScript(() => { try { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_apparence', JSON.stringify('sombre')); } catch (_) {} });
  // La route de la garde réseau coupe le cache HTTP (voir plus haut) : retirée. La garde reste : les noms
  // réels ne se résolvent pas (règles ci-dessus) et toute réponse d'un hôte réel la rend rouge.
  await ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
  await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {} });
  const routes = etat;
  const mesures = {};

  // ── 1. Première ouverture (réseau normal) : l'instantané se range, le SW s'installe ──
  let p1;
  await essaie('1 première ouverture', async () => {
    p1 = await ouvrir(ctx, { cpu: 1, delaiMax: 90000 });
    const e = await etatEcran(p1.pg);
    dit(e.vrai, '1 la 1re ouverture montre l’écran vrai de Ma journée', e.vrai ? '' : e.texte.slice(0, 160));
    await calme(journal);
    await attendre(2500);   // la capture de l'instantané (1,2 s après « prêt ») et le rangement du service worker
    await p1.pg.evaluate(() => new Promise((r) => { try { window.dispatchEvent(new Event('pagehide')); } catch (_) {} setTimeout(r, 400); }));
    const s = await stockage(p1.pg);
    const tout = s.valeurs.join('\n') + s.idb.map((x) => x.cles.join(',') + x.texte).join('\n');
    dit(tout.includes(UID) && /journee/.test(tout), '1 un instantané de Ma journée est rangé pour CET uid', s.cles.join(',') + ' · idb ' + s.idb.map((x) => x.base + '/' + x.store + ':' + x.cles.length).join(','));
    const m = await lire(p1.pg);
    dit(m.sw, '1 le service worker contrôle la page (app installée)');
    // La coquille rangée par le service worker : la page `/`, son script principal et sa feuille.
    await attendre(3000);
    const coq = await p1.pg.evaluate(async () => {
      const noms = await caches.keys(); const out = { reserves: noms };
      for (const n of noms.filter((x) => /^vrm-shell/.test(x))) {
        const c = await caches.open(n); const cles = (await c.keys()).map((r) => new URL(r.url).pathname);
        const page = await c.match('/'); const html = page ? await page.text() : '';
        const req = (html.match(/\/assets\/[A-Za-z0-9._-]+\.(?:js|css)/g) || []).filter((x) => /\/assets\/index-/.test(x));
        out[n] = { n: cles.length, page: !!page, requis: req, manquent: req.filter((x) => !cles.includes(x)), demarrage: cles.filter((x) => /^\/demarrage-/.test(x)) };
      }
      return out;
    }).catch((e) => ({ erreur: String(e) }));
    const r6 = Object.entries(coq).find(([k]) => /^vrm-shell/.test(k));
    dit(!!(r6 && r6[1].page && r6[1].requis.length && !r6[1].manquent.length), '1 la coquille de l’app est rangée dès la 1re ouverture (page, script principal, feuille)', JSON.stringify(r6 ? r6[1] : coq).slice(0, 300));
    mesures.premiere = { utile_ms: m.vrai, jsAnalyseKo: m.jsAnalyseKo, lectures: journal.filter((r) => r.m === 'GET').length };
    await shot(p1.pg, '1-premiere');
    if (process.env.DIAG_CADRE) { console.log(await p1.pg.evaluate(() => { const out = []; let e = document.querySelector('.vrm-fu-journee'); while (e && e !== document.body) { const r = e.getBoundingClientRect(); out.push(e.tagName + (e.id ? '#' + e.id : '') + ' .' + String(e.className || '').slice(0, 120) + ' ' + [...e.attributes].filter((a) => /^data-|style/.test(a.name)).map((a) => a.name + '=' + a.value.slice(0, 60)).join(' ') + ' @' + Math.round(r.top) + ',' + Math.round(r.left) + ' w' + Math.round(r.width)); e = e.parentElement; } return out.join('\n'); })); process.exit(0); }
    // Laisse le service worker finir de ranger la coquille et ses morceaux.
    await attendre(4000);
    await p1.pg.close();
  });

  // ── 2. Deuxième ouverture et suivantes : CPU ×4, Fast 3G ──
  const passes = [];
  for (let k = 0; k < 1 + PASSES; k++) {
    await essaie('2 ouverture n°' + (k + 2), async () => {
      journal.length = 0; statiques.length = 0; reseau.lent = true; reseau.tuyau = 0;
      const t0 = Date.now();
      // RAPIDE=1 : seulement jusqu'au premier écran utile (comparer deux builds vite, sans l'écran vrai).
      const enc = encombrement();
      const taux = process.env.CPU_MESURE ? Number(process.env.CPU_MESURE) : tauxCpu(enc);
      const o = await ouvrir(ctx, { cpu: taux, delaiMax: 90000, photo: k === 0 ? '2-instantane' : '', attendrePret: !process.env.RAPIDE });
      const m = await lire(o.pg);
      const utile = m.inst != null && m.vrai != null ? Math.min(m.inst, m.vrai) : (m.inst != null ? m.inst : m.vrai);
      const borne = utile == null ? Infinity : t0 + utile;
      // Les lectures AVANT le premier écran utile (heure du serveur ≈ heure de la page : même machine).
      const lec = journal.filter((r) => r.m === 'GET');
      const avant = lec.filter((r) => r.t <= borne);
      const e = await etatEcran(o.pg);
      if (process.env.RAPIDE) await attendre(1500); else await calme(journal, 60000);
      const lec2 = journal.filter((r) => r.m === 'GET');
      const p = {
        n: k + 2, taux, encombrement: enc, charge: Math.round(os.loadavg()[0] * 10) / 10, utile_ms: utile, instantane_ms: m.inst, vrai_ms: m.vrai, fcp_ms: m.fcp, demarrageParti_ms: m.demarrageParti,
        mention: m.mention != null, jsN: m.jsN, jsReseauKo: m.jsReseauKo, jsAnalyseKo: m.jsAnalyseKo, cssAnalyseKo: m.cssAnalyseKo,
        statiquesReseau: statiques.length, statiquesReseauKo: Math.round(statiques.reduce((a, x) => a + x.o, 0) / 1024),
        // Ce que la PAGE a demandé au réseau avant de se peindre (hors relectures de fond) : la coquille, ses scripts, l'écran d'ouverture.
        bloquants: statiques.filter((x) => !x.fond && x.t <= borne && /\.(js|css|html)$/.test(x.u)).map((x) => x.u),
        lecturesAvantUtile: avant.length, KoAvantUtile: Math.round(avant.reduce((a, r) => a + r.o, 0) / 1024),
        lectures: lec2.length, Ko: Math.round(lec2.reduce((a, r) => a + r.o, 0) / 1024), ecritures: journal.filter((r) => r.m !== 'GET' && r.m !== 'HEAD' && !/^api:/.test(r.u)).length,
        lourdes: lec2.filter((r) => lourde(r.u)).map((r) => r.u.slice(0, 120)),
        longuesAvantUtile_ms: m.lt.filter((x) => utile == null || x[0] < utile).reduce((a, x) => a + x[1], 0),
        longuesAvantUtile_n: m.lt.filter((x) => utile == null || x[0] < utile).length,
        plusLongueAvantUtile_ms: Math.max(0, ...m.lt.filter((x) => utile == null || x[0] < utile).map((x) => x[1])),
        mentionTexte: e.mention, dansDemarrage: m.dansDemarrage,
        decision: await o.pg.evaluate(() => window.__vrmApercu || '').catch(() => ''),
      };
      passes.push(p);
      if (k === 0) await shot(o.pg, '2-deuxieme-vrai');
      if (MESURE) console.log('MESURE ' + JSON.stringify(p));
      if (process.env.DIAG) {
        console.log('  statiques réseau : ' + statiques.map((x) => (x.t - t0) + ':' + x.u + ':' + Math.round(x.o / 1024)).join(' '));
        console.log('  requêtes : ' + journal.slice(0, 40).map((r) => (r.t - t0) + '→' + ((r.f || r.t) - t0) + ' ' + r.m + ' ' + r.u.slice(0, 70)).join('\n    '));
        console.log('  tâches longues : ' + m.lt.map((x) => x.join('+')).join(' '));
        console.log('  marques : ' + (await o.pg.evaluate(() => performance.getEntriesByType('mark').map((x) => x.name + '@' + Math.round(x.startTime)).join(' ')).catch(() => '')));
        console.log('  navigation : ' + (await o.pg.evaluate(() => { const n = performance.getEntriesByType('navigation')[0] || {}; return ['workerStart', 'fetchStart', 'responseStart', 'responseEnd', 'domInteractive', 'domContentLoadedEventEnd', 'loadEventEnd'].map((k) => k + '=' + Math.round(n[k] || 0)).join(' '); }).catch(() => '')));
        console.log('  ressources : ' + (await o.pg.evaluate(() => performance.getEntriesByType('resource').filter((r) => /\.(js|css)/.test(r.name) && r.startTime < 3000).map((r) => r.name.replace(/^.*\//, '').slice(0, 30) + ' ' + Math.round(r.startTime) + '→' + Math.round(r.responseEnd)).join(' | ')).catch(() => '')));
      }
      reseau.lent = false;
      await o.pg.close();
    });
  }
  const p2 = passes[0];
  mesures.deuxieme = p2; mesures.suivantes = passes.slice(1);
  mesures.mediane_utile_ms = mediane(passes.map((p) => p.utile_ms));
  await essaie('2 jugement', async () => {
    dit(p2 && p2.utile_ms != null && p2.utile_ms < 1000, '2 2e ouverture (CPU ×4, Fast 3G) : premier écran utile de Ma journée en moins d’1 s', p2 ? `${p2.utile_ms} ms (instantané ${p2.instantane_ms}, écran vrai ${p2.vrai_ms})` : 'pas de mesure');
    dit(mesures.mediane_utile_ms != null && mesures.mediane_utile_ms < 1000, '2 médiane des ouvertures suivantes < 1 s', passes.map((p) => p.utile_ms).join(' · ') + ' ms');
    dit(p2 && p2.mention, '2 l’instantané dit sa date (« Mis à jour il y a … »)', p2 && p2.mentionTexte);
    dit(passes.every((p) => p.vrai_ms != null), '2 l’écran vrai prend la place ensuite', passes.map((p) => p.vrai_ms).join(' · '));
    dit(passes.every((p) => !p.lourdes.length), '2 aucune lecture `select=data` sur une ligne lourde au démarrage', passes.flatMap((p) => p.lourdes).slice(0, 3).join(' | '));
    dit(p2 && !p2.bloquants.length, '2 la coque et l’écran d’ouverture viennent du cache du service worker (aucun fichier attendu du réseau avant la 1re image)', p2 && (p2.bloquants.join(' ') || `${p2.statiquesReseau} relectures de fond`));
  });

  // ── 3. Hors ligne : le service worker seul, la base coupée ──
  await essaie('3 hors ligne', async () => {
    reseau.coupe = true; await ctx.setOffline(true); journal.length = 0;
    const o = await ouvrir(ctx, { cpu: 4, attendrePret: false, delaiMax: 30000, photo: '3-hors-ligne' });
    const m = await lire(o.pg);
    // Puis l'app elle-même (porte hors ligne, Ma journée hors connexion) : l'écran de démarrage parti.
    await o.pg.waitForFunction(() => { const d = document.getElementById('vrm-demarrage'); return !d || d.hasAttribute('data-sortie'); }, null, { timeout: 40000 }).catch(() => {});
    await attendre(1500);
    const e = await etatEcran(o.pg);
    const hl = await o.pg.evaluate(() => { const x = document.querySelector('[data-journee-instantane][data-ji-etat="hors-ligne"]'); return x ? { cases: x.querySelectorAll('[data-ji-case]').length, panne: (x.querySelector('[data-instantane-panne]') || {}).textContent || '', mention: (x.querySelector('[data-ji-mention]') || {}).textContent || '', inerte: x.hasAttribute('inert') } : null; }).catch(() => null);
    mesures.horsLigne = { utile_ms: m.inst, mention: hl && hl.mention };
    dit(m.inst != null && m.inst < 1500, '3 hors ligne : les chiffres de Ma journée sont peints tout de suite (instantané)', m.inst != null ? `${m.inst} ms` : e.texte.slice(0, 200));
    dit(!!hl && hl.cases > 0 && !e.demarrage, '3 hors ligne : l’app ouverte GARDE l’instantané (daté, inerte)', hl ? `${hl.cases} cases` : e.texte.slice(0, 200));
    dit(!!hl && /Mis à jour|il y a|à l’instant/.test(hl.mention) && /Hors ligne/.test(hl.panne) && hl.inerte, '3 hors ligne : la date de l’instantané et « Hors ligne » sont dits', hl ? `${hl.mention.trim()} · ${hl.panne}` : '(rien)');
    dit(journal.filter((r) => !/^api:/.test(r.u) && r.m !== 'GET').length === 0, '3 hors ligne : aucune écriture tentée vers la base');
    await shot(o.pg, '3-hors-ligne-app');
    await o.pg.close();
    await ctx.setOffline(false); reseau.coupe = false;
  });

  // ── 4. La base répond 503 : l'instantané reste, la panne est dite, rien n'est écrit ──
  await essaie('4 lecture ratée', async () => {
    routes.panne = true; journal.length = 0;
    const o = await ouvrir(ctx, { cpu: 1, attendrePret: false, delaiMax: 30000 });
    await attendre(9000);
    const e = await etatEcran(o.pg);
    dit(e.inst && e.cases > 0, '4 base en panne : l’instantané reste à l’écran', e.inst ? '' : e.texte.slice(0, 200));
    dit(!!e.panne && /relu|panne|joindre|injoignable/i.test(e.panneTexte), '4 base en panne : la panne est dite à côté de la date', e.panneTexte || '(rien de dit)');
    const ecr = journal.filter((r) => r.m !== 'GET' && r.m !== 'HEAD' && !/^api:/.test(r.u));
    dit(ecr.length === 0, '4 base en panne : aucune écriture ne part vers la base', ecr.map((r) => r.m + ' ' + r.u.slice(0, 80)).slice(0, 3).join(' | '));
    await shot(o.pg, '4-panne');
    const s = await stockage(o.pg);
    dit(s.valeurs.join('').includes(UID) || s.idb.some((x) => x.texte.includes(UID)), '4 base en panne : l’instantané est gardé sur l’appareil');
    await o.pg.close();
    routes.panne = false;
  });

  // ── 5. Un autre compte VRM sur le même appareil ──
  await essaie('5 autre compte', async () => {
    const pv = await ctx.newPage();
    await pv.goto(`http://localhost:${PORT}/manifest.webmanifest`).catch(() => {});
    await pv.evaluate((autre) => {
      const s = JSON.parse(localStorage.getItem('vrm_session') || '{}');
      const b = (o) => btoa(JSON.stringify(o)).replace(/=+$/, '').split('+').join('-').split('/').join('_');
      s.access_token = b({ alg: 'none', typ: 'JWT' }) + '.' + b({ sub: autre, role: 'authenticated', aud: 'authenticated' }) + '.banc2';
      s.user = { id: autre, email: 'autre@vrm.test', totp: [] };
      localStorage.setItem('vrm_session', JSON.stringify(s));
    }, AUTRE);
    await pv.close();
    journal.length = 0;
    const o = await ouvrir(ctx, { cpu: 1, attendrePret: false, delaiMax: 20000 });
    await attendre(1500);
    const e = await etatEcran(o.pg);
    const m5 = await lire(o.pg);   // la sonde a vu TOUT instantané peint, même un instant (dans l'écran de démarrage compris)
    const s = await stockage(o.pg);
    const t = s.valeurs.join('\n') + s.idb.map((x) => x.cles.join(',') + x.texte).join('\n');
    dit(!e.inst && m5.inst == null, '5 autre compte : aucun instantané du précédent n’est montré, même un instant', e.inst || m5.inst != null ? `instantané peint à ${m5.inst} ms` : '');
    dit(!t.includes(UID), '5 autre compte : l’instantané du précédent n’est plus sur l’appareil', t.includes(UID) ? 'encore là' : '');
    await shot(o.pg, '5-autre-compte');
    await o.pg.close();
  });

  console.log('MESURES ' + JSON.stringify(mesures));
  console.log(`\n${ok} verts, ${ko} rouges — captures : ${SHOTS}`);
  await nav.close(); srv.close(); srvBase.close();
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
async function shot(pg, nom) { try { await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); } catch (_) {} }
