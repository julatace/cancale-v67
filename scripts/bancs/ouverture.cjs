// ════════════════════════════════════════════════════════════════════════════
//  BANC « OUVERTURE » (15 nov.) — Julien : « L'app bug quand je l'ouvre, je veux
//  que tu améliores l'onglet de chargement. » Le même jour, une dizaine de mises
//  en ligne : l'app posée sur l'iPhone rouvre une version GARDÉE (service worker)
//  qui réclame des morceaux que le serveur n'a plus.
//
//    node scripts/bancs/ouverture.cjs <dist-A> <dist-B>
//      deux builds DIFFÉRENTS du même arbre (deux `npx vite build --outDir …` de
//      suite : l'horodatage du build change les empreintes) — A est « l'ancienne
//      mise en ligne », B « la nouvelle ». Sans arguments : BANC_DIST_A / BANC_DIST_B.
//    BANC_PORT=…  SHOTS=<dossier> (captures)  SEUL=<n° de scénario>  DEBUG=1
//
//  Tout est servi par de VRAIS serveurs locaux (aucune route Playwright : une route
//  coupe le cache HTTP et le service worker verrait chaque ouverture comme un
//  rechargement forcé — ouverture-instantanee.cjs l'a mesuré). La base est
//  INVENTÉE (_base-volume.cjs, 1 000 annonces) et servie sous son vrai nom vers
//  127.0.0.1 ; un serveur « Vercel » sert le dossier de la mise en ligne COURANTE
//  et répond 404 à un fichier qu'il n'a pas (comme Vercel : aucune « Skew
//  Protection » sur le plan Hobby).
//
//  Scénarios (iPhone 390 tactile, service worker actif) :
//   1  ouverture à froid (version A) : Ma journée, aucune erreur ; l'écran de
//      chargement porte le dégradé « Verre dépoli » et la coque le même fond ;
//      la transition (une image par rAF) ne passe jamais par le blanc.
//   2  A rangée par le service worker, puis mise en ligne de B, l'app rouverte :
//      B s'affiche, AUCUNE erreur « default » / « preload CSS » / « dynamically
//      imported module », AUCUN garde-fou d'écran, au plus UN rechargement.
//   3  l'app restée ouverte sur A pendant la mise en ligne, puis un écran jamais
//      ouvert (morceau à la demande absent du serveur) : UN rechargement, puis B,
//      jamais un écran tombé ni une boucle.
//   4  un morceau à la demande qui rate pour de vrai (même version en ligne) :
//      l'écran « Mettre à jour VRM » avec UN bouton, aucun rechargement tout seul
//      — jamais `undefined … default` ni « Cet écran a un souci ».
//   8  la transition ralentie dix fois : une capture au milieu du fondu.
//   5  sombre : l'écran de chargement en bleu-nuit, la barre d'état assortie.
//   6  réseau lent (> 8 s) : une phrase utile et UN geste « Recharger ».
//   7  `prefers-reduced-motion` : rien ne bouge, la sortie est immédiate.
//   9  (16 nov.) app ouverte et visible pendant la mise en ligne : rechargée au calme (Ventes gardé, une fois),
//      jamais sous une feuille ni une saisie (la pilule à la place).
//  Données inventées ; rien ne sort de la machine (garde réseau des bancs).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));

const DIST_A = path.resolve(process.argv[2] || process.env.BANC_DIST_A || '');
const DIST_B = path.resolve(process.argv[3] || process.env.BANC_DIST_B || '');
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-ouverture');
const SEUL = process.env.SEUL ? String(process.env.SEUL).split(',') : null;
const DEBUG = !!process.env.DEBUG;
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}

const base = fabriquer({ comptes: 4, volumeReel: true, annonces: 1000 });

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le scénario a pu s’exécuter', String(e && e.message || e).split('\n')[0].slice(0, 220)); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const veut = (n) => !SEUL || SEUL.includes(String(n));

// ── Le serveur « Vercel » : le dossier de la mise en ligne COURANTE ─────────────
const site = { dist: DIST_A, lent: 0, coupe: false, refuse: null, journal: [] };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const servi = (r, statut, entetes, corps) => { try { r.writeHead(statut, entetes); r.end(corps); } catch (_) {} };
const srv = http.createServer((q, r) => {
  if (site.coupe) { r.destroy(); return; }
  let f = decodeURIComponent(q.url.split('?')[0]);
  if (f.startsWith('/api/')) {
    q.resume();
    const corps = /mode=equipe/.test(q.url) ? { ok: true, equipe: [], invitations: [], membreDe: [], aBoutique: true }
      : /mode=abonnement/.test(q.url) ? { ok: true, acces: true, statut: 'active', configure: true }
      : { ok: true, pret: true };
    return servi(r, 200, { 'content-type': 'application/json', 'cache-control': 'no-store' }, JSON.stringify(corps));
  }
  if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(site.dist, f);
  const absent = !p.startsWith(site.dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory();
  site.journal.push({ t: Date.now(), u: f, s: absent ? 404 : 200 });
  if (site.bloque && site.bloque.test(f)) return;   // la requête reste pendue (réseau qui n'avance plus)
  if (absent || (site.refuse && site.refuse.test(f))) return setTimeout(() => servi(r, 404, { 'content-type': 'text/plain' }, 'The page could not be found'), site.lent ? 200 : 0);
  const t = types[path.extname(p)] || 'application/octet-stream'; let b = fs.readFileSync(p);
  // « Comme Safari peut le faire » : un rechargement de la page qui n'arrive PAS au service worker marqué
  // `no-cache` (le mode de cache d'une navigation rechargée n'est pas le même partout). Le service worker
  // servi est le vrai, à une ligne près : il ne distingue plus un rechargement d'une ouverture.
  if (f === '/sw.js' && site.rechargementSimple) b = Buffer.from(String(b).replace(/const voulueFraiche = [^;]+;/, 'const voulueFraiche = false;'));
  const gz = /javascript|css|html|json|svg/.test(t);
  if (gz) b = zlib.gzipSync(b, { level: 4 });
  const cc = f.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
  setTimeout(() => servi(r, 200, { 'content-type': t, ...(gz ? { 'content-encoding': 'gzip' } : {}), 'cache-control': cc }, b), site.lent);
});

// ── La base inventée sous son vrai nom (https, certificat jetable) ──────────────
const HOTE_BASE = 'lgonxzrzjcqthjtbdpzo.supabase.co';
const PORT_BASE = PORT < 50000 ? PORT + 15000 : PORT - 15000;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, range-unit, x-client-info, accept-profile, content-profile, x-vrm-equipe', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS, HEAD', 'access-control-expose-headers': 'Content-Range' };
function certificat() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-ouv-'));
  const k = path.join(dir, 'cle.pem'), c = path.join(dir, 'cert.pem');
  require('child_process').execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', '/CN=' + HOTE_BASE, '-addext', 'subjectAltName=DNS:' + HOTE_BASE], { stdio: 'ignore' });
  const x = { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return x;
}
const srvBase = require('https').createServer(certificat(), (q, r) => {
  if (site.coupe) { r.destroy(); return; }
  if (q.method === 'OPTIONS') return servi(r, 204, CORS, '');
  if (/\/auth\/v1\//.test(q.url)) { q.resume(); return servi(r, 200, { ...CORS, 'content-type': 'application/json' }, '{}'); }
  if (!/\/rest\/v1\//.test(q.url)) { q.resume(); return servi(r, 404, CORS, ''); }
  let recu = ''; q.on('data', (d) => { recu += d; });
  q.on('end', () => {
    if (q.method !== 'GET' && q.method !== 'HEAD') {
      let d = []; try { const x = JSON.parse(recu || '[]'); d = Array.isArray(x) ? x : [x]; } catch (_) {}
      return servi(r, 201, { ...CORS, 'content-type': 'application/json' }, JSON.stringify(d));
    }
    const rep = repondre('https://' + HOTE_BASE + q.url, q.headers.range, base);
    servi(r, rep.status, { ...CORS, ...(rep.headers || {}), 'content-type': 'application/json', 'content-encoding': 'gzip' }, zlib.gzipSync(JSON.stringify(rep.body)));
  });
});

// ── Ce que la page voit : posé AVANT tout script ─────────────────────────────
// Chaque image (rAF) : la couleur du fond À L'ÉCRAN au centre-haut de la page (celle de l'élément le plus
// haut sous le point, en remontant jusqu'à un fond opaque — sinon `body`/`html`), l'écran de démarrage
// présent ou parti, et le premier « Ma journée » utile.
const SONDE = () => {
  const o = window.__ouv = { images: [], pret: null, demarrageParti: null, erreurs: [], nav: performance.now() };
  addEventListener('error', (e) => { try { o.erreurs.push(String((e && (e.message || (e.error && e.error.message))) || 'erreur').slice(0, 200)); } catch (_) {} }, true);
  addEventListener('unhandledrejection', (e) => { try { o.erreurs.push(String((e && e.reason && (e.reason.message || e.reason)) || 'rejet').slice(0, 200)); } catch (_) {} });
  // Ce qui est SOUS l'écran de démarrage en (x, y) : le premier élément (hors de lui) qui peint un fond
  // opaque ou un dégradé, sinon le fond du document (`body`, puis `html`). C'est ce qui transparaît pendant
  // son fondu : un blanc pur ici = un éclair blanc à la sortie.
  const peint = (el) => {
    const cs = getComputedStyle(el);
    const img = cs.backgroundImage && cs.backgroundImage !== 'none' && /gradient|url\(/.test(cs.backgroundImage) ? cs.backgroundImage : '';
    const c = cs.backgroundColor;
    const opaque = c && !/rgba\([^)]*,\s*0\)$/.test(c) && c !== 'transparent';
    return (img || opaque) ? { tag: (el.id ? '#' + el.id : String(el.className || el.tagName).split(' ')[0]).slice(0, 40), c, img: img ? img.slice(0, 50) : '' } : null;
  };
  const sousDemarrage = (x, y) => {
    const boot = document.getElementById('vrm-demarrage');
    for (const el of document.elementsFromPoint(x, y)) {
      if (boot && (el === boot || boot.contains(el))) continue;
      if (el === document.body || el === document.documentElement) break;
      const f = peint(el); if (f) return f;
    }
    return peint(document.body) || peint(document.documentElement) || { tag: 'canevas', c: 'rgb(255, 255, 255)', img: '' };
  };
  const tick = () => {
    const t = Math.round(performance.now());
    try {
      if (document.body) {
        const d = document.getElementById('vrm-demarrage');
        const parti = !d || d.hasAttribute('data-sortie');
        if (parti && o.demarrageParti == null) o.demarrageParti = t;
        const fd = d ? getComputedStyle(d) : null;
        o.images.push({ t, d: d ? (parti ? 'sortie' : 'la') : 'non', dop: fd ? Number(fd.opacity) : null,
          haut: sousDemarrage(Math.round(innerWidth / 2), 6), centre: sousDemarrage(Math.round(innerWidth / 2), Math.round(innerHeight / 2)) });
        if (o.images.length > 900) o.images.splice(0, 300);
      }
      const pret = document.querySelector('[data-attente-ecran="journee"][data-attente="pret"], [data-attente-ecran="journee"][data-attente="plafond"]');
      if (pret && o.pret == null && (!document.getElementById('vrm-demarrage') || document.getElementById('vrm-demarrage').hasAttribute('data-sortie'))) o.pret = t;
    } catch (_) {}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const MAUVAIS = /reading 'default'|evaluating '[\w$.]*\.default'|_result\.default|is not an object \(evaluating 'e\.|Unable to preload CSS|dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type/i;

async function nouvellePage(ctx, quoi = {}) {
  const pg = await ctx.newPage();
  const vu = { erreurs: [], console: [], navs: 0, versions: [] };
  pg.on('pageerror', (e) => vu.erreurs.push(String(e.message).slice(0, 200)));
  pg.on('console', (m) => { if (m.type() === 'error') vu.console.push(m.text().slice(0, 200)); });
  // Un CHARGEMENT de document (pas un `pushState` de l'app) : l'événement `load` de la page.
  pg.on('load', () => { vu.navs++; versionDe(pg).then((v) => vu.versions.push(v)); });
  if (quoi.cpu) { const cdp = await ctx.newCDPSession(pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: quoi.cpu }); }
  await pg.addInitScript(SONDE);
  // Le film de l'ouverture, vu de dehors : chaque changement de (version chargée, écran de démarrage, Ma
  // journée prête, écran sur lequel on est) avec son heure — ce que Julien VOIT, chargement après chargement.
  vu.film = []; const t0 = Date.now(); let dernier = '';
  vu.arret = setInterval(async () => {
    const x = await pg.evaluate(() => { const s = document.querySelector('script[src*="/assets/index-"]'); const d = document.getElementById('vrm-demarrage');
      return (s ? s.getAttribute('src').slice(14, 22) : '?') + (d && !d.hasAttribute('data-sortie') ? ' démarrage' : ' app') + (window.__ouv && window.__ouv.pret != null ? ' journée' : '') + (document.querySelector('[data-garde-ecran],[data-garde-feuille]') ? ' TOMBÉ' : '') + (document.querySelector('[data-maj-dispo]') ? ' pilule' : ''); }).catch(() => null);
    if (x && x !== dernier) { dernier = x; vu.film.push((Date.now() - t0) + 'ms ' + x); }
  }, 100);
  pg.on('close', () => clearInterval(vu.arret));
  return { pg, vu };
}
function versionDe(pg) { return versionDe0(pg); }
const versionDe0 = (pg) => pg.evaluate(() => { const s = document.querySelector('script[src*="/assets/index-"]'); return s ? s.getAttribute('src') : null; }).catch(() => null);
async function attendrePret(pg, max = 90000) {
  const fin = Date.now() + max;
  while (Date.now() < fin) {
    const o = await pg.evaluate(() => window.__ouv && window.__ouv.pret).catch(() => null);
    if (o != null) return o;
    await attendre(200);
  }
  return null;
}
const etatPage = (pg) => pg.evaluate(() => ({
  texte: (document.body && document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 600),
  garde: [...document.querySelectorAll('[data-garde-ecran],[data-garde-feuille]')].map((e) => e.getAttribute('data-garde-ecran') || e.getAttribute('data-garde-feuille')),
  majEcran: !!document.querySelector('[data-mettre-a-jour-vrm]'),
  filet: /n’a pas pu démarrer|n'a pas pu démarrer/.test(document.body && document.body.innerText || ''),
  erreurs: (window.__ouv && window.__ouv.erreurs) || [],
})).catch(() => ({ texte: '', garde: [], majEcran: false, filet: false, erreurs: [] }));
async function coquilleRangee(pg, max = 30000) {
  const fin = Date.now() + max;
  while (Date.now() < fin) {
    const n = await pg.evaluate(async () => { try { const c = await caches.open('vrm-shell-v6'); const r = await c.match('/'); if (!r) return null; const t = await r.text(); const m = t.match(/\/assets\/index-[\w-]+\.js/); return m ? m[0] : null; } catch (_) { return null; } }).catch(() => null);
    if (n) return n;
    await attendre(300);
  }
  return null;
}
const shot = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); } catch (_) {} };
const aller = (pg, tab) => pg.evaluate((t) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })), tab).catch(() => {});

// ── LE FILM DE L'ÉCRAN : chaque image PEINTE (CDP, Page.startScreencast), décodée ici ───────────────────
// Pour chaque image : la couleur moyenne d'une bande en haut au centre (sous la barre d'état) et du centre
// de l'écran. Un « éclair blanc » = une image dont l'une des deux zones est d'un blanc PUR (≥ 250 partout) :
// ni le dégradé, ni la coque Studio (#EEF6FD : rouge 238) ne le sont ; le fond nu d'avant (#FFFFFF) l'est.
const { PNG } = require(path.join(RACINE, 'node_modules', 'playwright-core', 'lib', 'utilsBundle.js'));
function moyenne(img, x0, y0, x1, y1) {
  let r = 0, g = 0, b = 0, n = 0;
  const X0 = Math.floor(img.width * x0), X1 = Math.floor(img.width * x1), Y0 = Math.floor(img.height * y0), Y1 = Math.floor(img.height * y1);
  for (let y = Y0; y < Y1; y += 2) for (let x = X0; x < X1; x += 2) { const i = (y * img.width + x) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
  return n ? [Math.round(r / n), Math.round(g / n), Math.round(b / n)] : [0, 0, 0];
}
async function filmer(pg) {
  const cdp = await pg.context().newCDPSession(pg);
  const images = []; let garder = [];
  cdp.on('Page.screencastFrame', async (f) => {
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (_) {}
    try {
      const buf = Buffer.from(f.data, 'base64');
      const img = PNG.sync.read(buf);
      images.push({ t: Math.round((f.metadata.timestamp || 0) * 1000), haut: moyenne(img, .3, .015, .7, .05), centre: moyenne(img, .3, .45, .7, .55) });
      garder.push({ t: Math.round((f.metadata.timestamp || 0) * 1000), buf });
      if (garder.length > 120) garder = garder.slice(-120);
    } catch (_) {}
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1, maxWidth: 390, maxHeight: 844 });
  return { images, garder: () => garder, arreter: async () => { try { await cdp.send('Page.stopScreencast'); } catch (_) {} } };
}
const purBlanc = (c) => c[0] >= 250 && c[1] >= 250 && c[2] >= 250;
const bleu = (c) => c[2] - c[0] >= 40;   // le dégradé : nettement plus de bleu que de rouge
// La couleur d'une image, en [r,g,b] : « blanc » = les trois au-dessus de 235.
const rgb = (c) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(c || '')); return m ? [+m[1], +m[2], +m[3]] : null; };
const blanc = (c) => { const x = rgb(c); return !!x && x[0] > 235 && x[1] > 235 && x[2] > 235; };

(async () => {
  for (const d of [DIST_A, DIST_B]) if (!d || !fs.existsSync(path.join(d, 'index.html'))) { console.log('KO  il faut deux builds : node scripts/bancs/ouverture.cjs <dist-A> <dist-B> (' + d + ')'); process.exit(1); }
  const vA = (fs.readFileSync(path.join(DIST_A, 'index.html'), 'utf8').match(/\/assets\/index-[\w-]+\.js/) || [])[0];
  const vB = (fs.readFileSync(path.join(DIST_B, 'index.html'), 'utf8').match(/\/assets\/index-[\w-]+\.js/) || [])[0];
  if (!vA || vA === vB) { console.log('KO  les deux builds doivent être DIFFÉRENTS (' + vA + ' / ' + vB + ')'); process.exit(1); }
  await new Promise((r) => srv.listen(PORT, r));
  await new Promise((r) => srvBase.listen(PORT_BASE, '127.0.0.1', r));
  const regles = `MAP ${HOTE_BASE} 127.0.0.1:${PORT_BASE}, MAP *.supabase.co ~NOTFOUND, MAP *.supabase.in ~NOTFOUND, MAP vrm.center ~NOTFOUND, MAP *.vrm.center ~NOTFOUND, MAP * ~NOTFOUND, EXCLUDE localhost`;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles}`, '--use-angle=swiftshader'] });
  const contexte = async ({ sombre = false, reduit = false } = {}) => {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: sombre ? 'dark' : 'light', reducedMotion: reduit ? 'reduce' : 'no-preference' });
    await ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    await ctx.addInitScript((s) => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); if (s) { localStorage.setItem('vinted_dark', 'true'); localStorage.setItem('vrm_apparence', JSON.stringify('sombre')); } } catch (_) {} }, sombre);
    return ctx;
  };
  const URL0 = `http://localhost:${PORT}/?tab=journee`;
  const juger = (n, vu, e, quoi) => {
    const mauvais = [...vu.erreurs, ...vu.console, ...e.erreurs].filter((m) => MAUVAIS.test(m));
    dit(mauvais.length === 0, `${n} aucune erreur de morceau périmé (« default », « preload CSS », « dynamically imported module »)${quoi ? ' — ' + quoi : ''}`, mauvais.slice(0, 3).join(' | '));
    // Un écran tombé, même UN INSTANT avant un rechargement (la console de la page le dit : GardeEcran, DernierFilet).
    const tombes = vu.console.filter((m) => /\[VRM\] (écran|application) en erreur/.test(m));
    dit(e.garde.length === 0 && !e.filet && tombes.length === 0, `${n} aucun écran tombé, même un instant (garde-fou, dernier filet)`, [...e.garde, ...(e.filet ? ['filet'] : []), ...tombes.map((m) => m.slice(0, 110))].join(' | '));
  };

  // ── 1. Ouverture à froid (clair) et 5. en sombre : l'écran de chargement et sa sortie, image par image ──
  for (const sombre of [false, true]) {
    const n = sombre ? '5' : '1';
    if (veut(n)) await essaie(n + ' ouverture à froid' + (sombre ? ' (sombre)' : ''), async () => {
      site.dist = DIST_A;
      const ctx = await contexte({ sombre });
      const { pg, vu } = await nouvellePage(ctx);
      // Le film commence au premier octet de la page (avant : la page vierge de l'onglet, qui n'est pas VRM).
      await pg.goto(URL0, { waitUntil: 'commit' });
      const film = await filmer(pg);
      await pg.waitForSelector('#vrm-demarrage', { timeout: 20000 }).catch(() => {});
      await attendre(300);   // (pas de capture ici : avec le film en cours, elle prend des secondes — scénario 6)
      const boot = await pg.evaluate(() => {
        const d = document.getElementById('vrm-demarrage'); if (!d) return { absent: document.readyState + ' ' + location.href + ' ' + (document.body ? document.body.innerHTML.length : -1) + ' ' + performance.now() };
        const cs = getComputedStyle(d); const m = document.querySelector('meta[name="theme-color"]');
        const logo = d.querySelector('img'); const r = logo ? logo.getBoundingClientRect() : null;
        return { img: cs.backgroundImage, couleur: cs.backgroundColor, theme: m ? m.getAttribute('content') : '', racine: document.documentElement.hasAttribute('data-vrm-boot'),
          logo: r ? [Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2), Math.round(r.width)] : null, rail: !!d.querySelector('.vrm-boot-rail'),
          p: Number(d.style.getPropertyValue('--vrm-boot-p')) || null };
      }).catch((e) => { if (DEBUG) console.log("   évaluation : " + String(e).slice(0, 200)); return null; });
      // (16 nov., intégration vague B) Les valeurs FINALES de src/design/studio-verre.css (`--sv-reflet`, `--sv-haut`), plus
      // la proposition 9 : le reflet du haut et le haut du dégradé, clair puis bleu-nuit (audit-ouverture les relit dans le CSS).
      const attendu = sombre ? ['rgba(90, 140, 210, 0.08)', 'rgb(19, 52, 96)'] : ['rgba(120, 175, 235, 0.1)', 'rgb(37, 99, 168)'];
      dit(!!boot && !boot.absent && attendu.every((c) => boot.img.includes(c)) && (boot.img.match(/gradient/g) || []).length === 4, n + ' l’écran de chargement porte le dégradé « Verre dépoli »' + (sombre ? ' bleu-nuit' : ''), boot ? (boot.absent || boot.img.slice(0, 120)) : 'absent');
      dit(!!boot && boot.theme === (sombre ? '#133460' : '#2563A8'), n + ' la barre d’état (theme-color) prend le haut du dégradé pendant le démarrage', boot && boot.theme);
      dit(!!boot && boot.racine, n + ' le fond du document est le même bleu pendant le démarrage (data-vrm-boot)');
      dit(!!boot && boot.logo && Math.abs(boot.logo[0] - 195) <= 2 && boot.logo[2] >= 64, n + ' le logo VRM au centre', boot && JSON.stringify(boot.logo));
      const t = await attendrePret(pg);
      await attendre(1200);
      await film.arreter();
      dit(t != null, n + ' Ma journée s’affiche', t == null ? (await etatPage(pg)).texte.slice(0, 200) : t + ' ms');
      const fin = await pg.evaluate(() => ({ fin: window.__vrmDemarrage && window.__vrmDemarrage.fin, origine: performance.timeOrigin, racine: document.documentElement.hasAttribute('data-vrm-boot'), demarrage: !!document.getElementById('vrm-demarrage'),
        premiere: ((performance.getEntriesByName('first-paint')[0] || {}).startTime) })).catch(() => ({}));
      dit(!fin.racine && !fin.demarrage, n + ' après l’ouverture : plus d’écran de démarrage ni de fond de démarrage', JSON.stringify(fin));
      // Le film : jamais une image d'un blanc pur ; les premières images (le démarrage) bleues.
      // Les images d'AVANT la première peinture de la page sont celles de l'onglet vierge (about:blank) : sur
      // le téléphone, c'est l'image de lancement qui est là. On juge à partir de la première peinture de VRM.
      const depuis = fin.premiere != null ? fin.origine + fin.premiere - 20 : 0;
      const imgs = film.images.filter((x) => x.t >= depuis);
      if (DEBUG) console.log('   images avant la 1re peinture de VRM (onglet vierge, écartées) : ' + (film.images.length - imgs.length));
      if (DEBUG) console.log('   images : ' + film.images.map((x) => Math.round(x.t - fin.origine) + ':' + x.haut.join('.')).join(' ') + ' · fin du démarrage ' + Math.round(fin.fin));
      const blanches = imgs.filter((x) => purBlanc(x.haut) || purBlanc(x.centre));
      const premieres = imgs.slice(0, Math.min(5, imgs.length));
      dit(imgs.length >= 5 && blanches.length === 0, n + ' aucune image blanche de l’ouverture à Ma journée (' + imgs.length + ' images peintes)', blanches.slice(0, 3).map((x) => 'haut ' + x.haut + ' centre ' + x.centre).join(' | '));
      dit(premieres.length > 0 && premieres.every((x) => bleu(x.haut)), n + ' dès la première image peinte, le bleu (pas un blanc puis le bleu)', premieres.map((x) => x.haut.join(',')).join(' | '));
      // Les COUCHES, image par image (rAF, dans la page) : tant que l'écran de démarrage n'est pas entièrement
      // opaque (son fondu) ou une fois parti, ce qui est dessous ne doit jamais être un blanc pur.
      const couches = await pg.evaluate(() => (window.__ouv && window.__ouv.images) || []).catch(() => []);
      const blancPur = (f) => !!f && !f.img && /rgba?\((\d+), (\d+), (\d+)/.test(f.c) && f.c.match(/\d+/g).slice(0, 3).every((v) => Number(v) >= 250);
      const visibles = couches.filter((x) => x.d !== 'la' || (x.dop != null && x.dop < 0.98));
      const eclairs = visibles.filter((x) => (x.dop == null || x.dop < 0.98) && (blancPur(x.haut) || blancPur(x.centre)));
      const fondus = couches.filter((x) => x.d === 'sortie');
      dit(visibles.length > 0 && eclairs.length === 0, n + ' pendant le fondu et après, jamais un blanc pur sous l’écran de démarrage (' + fondus.length + ' images de fondu, ' + visibles.length + ' jugées)',
        eclairs.slice(0, 3).map((x) => x.t + 'ms op ' + x.dop + ' haut ' + x.haut.tag + ' ' + x.haut.c + ' centre ' + x.centre.tag + ' ' + x.centre.c).join(' | '));
      if (DEBUG) console.log('   sous le fondu : ' + [...new Set(fondus.map((x) => x.haut.tag + ' ' + (x.haut.img ? 'dégradé' : x.haut.c) + ' / ' + x.centre.tag + ' ' + (x.centre.img ? 'dégradé' : x.centre.c)))].join(' ; '));
      // Une image de la transition (la plus proche du départ du fondu), gardée pour la regarder.
      if (fin.fin != null) {
        const tFin = fin.origine + fin.fin + 170;
        const g = film.garder(); let best = null;
        for (const x of g) if (!best || Math.abs(x.t - tFin) < Math.abs(best.t - tFin)) best = x;
        if (best) try { fs.writeFileSync(path.join(SHOTS, n + '-transition-' + (sombre ? 'sombre' : 'clair') + '.png'), best.buf); } catch (_) {}
      }
      if (DEBUG) console.log('   chargements ' + vu.navs + ' · ' + vu.film.join(' | '));
      if (DEBUG) console.log('   film : ' + imgs.map((x) => x.haut.join('.')).filter((x, i, l) => x !== l[i - 1]).slice(0, 40).join(' > '));
      juger(n, vu, await etatPage(pg));
      await shot(pg, n + '-journee-' + (sombre ? 'sombre' : 'clair'));
      await ctx.close();
    });
  }

  // ── 2. A rangée, nouvelle mise en ligne, l'app rouverte ──────────────────────
  for (const [longue, simple] of [[false, false], [true, false], [false, true]]) {
    const n = simple ? '2c' : longue ? '2b' : '2a';
    if (veut(2)) await essaie(n + ' ancienne version gardée puis nouvelle mise en ligne', async () => {
      site.dist = DIST_A; site.rechargementSimple = simple;
      const ctx = await contexte();
      const p1 = await nouvellePage(ctx);
      await p1.pg.goto(URL0, { waitUntil: 'commit' });
      await attendrePret(p1.pg);
      const rangee = await coquilleRangee(p1.pg);
      if (longue) await attendre(17000);   // le service worker range aussi tous les morceaux (15 s après)
      if (DEBUG) console.log('   coquille rangée : ' + rangee);
      await p1.pg.close();
      site.dist = DIST_B;   // la mise en ligne : les fichiers de A n'existent plus
      // 2c : et le réseau du téléphone (300 ms par fichier) — la relecture de la coquille par le service
      // worker (≈ 40 fichiers, un par un) prend alors bien plus longtemps que la vérification de version.
      if (simple) site.lent = 300;
      const { pg, vu } = await nouvellePage(ctx);
      const t0 = Date.now();
      await pg.goto(URL0, { waitUntil: 'commit' });
      let t = await attendrePret(pg);
      await attendre(4000);   // la vérification de version (au chargement) a eu le temps de parler
      t = (await pg.evaluate(() => window.__ouv && window.__ouv.pret).catch(() => null)) != null ? t : await attendrePret(pg, 30000);
      const v = await versionDe(pg);
      if (DEBUG) console.log('   chargements ' + vu.navs + ' ' + vu.versions.join(' > ') + ' · ' + (Date.now() - t0) + ' ms\n   film : ' + vu.film.join(' | '));
      dit(t != null, n + ' Ma journée s’affiche après la mise en ligne', (await etatPage(pg)).texte.slice(0, 160));
      // Les écrans à la demande : chacun ouvert une fois.
      for (const tab of ['ventes', 'colis', 'achats', 'settings', 'stats', 'annonces']) {
        await aller(pg, tab); await attendre(2500);
      }
      await attendre(2000);
      const v2 = await versionDe(pg);
      dit(v2 === vB, n + ' la NOUVELLE version tourne (au plus tard après les écrans ouverts)', 'version ' + v2 + ' (attendue ' + vB + ')');
      dit(vu.navs <= 2, n + ' au plus UN rechargement (pas de boucle)', vu.navs + ' navigation(s)');
      juger(n, vu, await etatPage(pg));
      await shot(pg, n + '-apres');
      await ctx.close(); site.rechargementSimple = false; site.lent = 0;
    });
  }

  // ── 3. L'app restée ouverte pendant la mise en ligne ─────────────────────────
  if (veut(3)) await essaie('3 app ouverte pendant la mise en ligne', async () => {
    site.dist = DIST_A;
    const ctx = await contexte();
    const { pg, vu } = await nouvellePage(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await attendrePret(pg);
    await coquilleRangee(pg);
    site.dist = DIST_B;
    for (const tab of ['settings', 'stats', 'ventes', 'achats']) { await aller(pg, tab); await attendre(3000); }
    await attendre(3000);
    const v = await versionDe(pg);
    if (DEBUG) console.log('   chargements ' + vu.navs + ' ' + vu.versions.join(' > ') + '\n   film : ' + vu.film.join(' | '));
    dit(v === vB, '3 un écran jamais ouvert ⇒ la nouvelle version (rechargée)', 'version ' + v);
    dit(vu.navs <= 2, '3 un seul rechargement', vu.navs + ' navigation(s)');
    juger(3, vu, await etatPage(pg));
    await shot(pg, '3-apres');
    await ctx.close();
  });

  // ── 9. (16 nov., lot anti-bug) Ouverte, VISIBLE, sur Ventes, pendant la mise en ligne ─────────────────────
  //  9a  au calme (aucun geste depuis 30 s, aucune feuille) : rechargée TOUTE SEULE sur la nouvelle version,
  //      toujours sur Ventes, une seule fois, aucune erreur ;
  //  9b  la feuille du « + » ouverte : JAMAIS rechargée dessous — la pilule « Mettre à jour » à la place ;
  //  9c  un champ en cours de saisie : jamais rechargée, la pilule.
  for (const cas of ['9a', '9b', '9c']) {
    if (veut(9) || veut(cas)) await essaie(cas + ' nouvelle version, app ouverte', async () => {
      site.dist = DIST_A;
      const ctx = await contexte();
      const { pg, vu } = await nouvellePage(ctx);
      await pg.goto(URL0, { waitUntil: 'commit' });
      await attendrePret(pg);
      await aller(pg, 'ventes'); await attendre(2500);
      // 9b : la feuille du « + » de la barre du bas (une feuille de l'app : FermeAuRetour, entrée d'historique).
      if (cas === '9b') await pg.locator('.vrm-tabbar button[aria-label*="Ajouter"], .vrm-tabbar button[aria-haspopup]').first().click({ timeout: 8000 });
      if (cas === '9c') await pg.evaluate(() => { const i = document.createElement('input'); i.type = 'text'; i.setAttribute('data-banc-saisie', '1'); i.style.cssText = 'position:fixed;top:0;left:0;width:10px;height:10px;opacity:.01'; document.body.appendChild(i); i.focus(); });
      await attendre(500);
      const avant = await pg.evaluate(() => ({ ecran: (document.querySelector('main.vrm-main') || {}).getAttribute ? document.querySelector('main.vrm-main').getAttribute('data-ecran') : null, feuille: !!document.querySelector('.vrm-sheet') || !!(history.state && history.state.vrmFeuille) })).catch(() => ({}));
      site.dist = DIST_B;   // la mise en ligne
      // 35 s sans aucun geste, puis les vérifications que la page fait d'elle-même (minute, retour au premier plan).
      await attendre(35000);
      await pg.evaluate(() => window.dispatchEvent(new Event('vrm:verifier-version'))).catch(() => {});
      await attendre(8000);
      if (cas === '9a') await attendrePret(pg, 30000).catch(() => {});
      await attendre(2500);
      const v = await versionDe(pg);
      const apres = await pg.evaluate(() => ({ ecran: document.querySelector('main.vrm-main') ? document.querySelector('main.vrm-main').getAttribute('data-ecran') : null, pilule: !!document.querySelector('[data-maj-dispo]'), feuille: !!document.querySelector('.vrm-sheet') || !!(history.state && history.state.vrmFeuille), saisie: !!document.querySelector('[data-banc-saisie]') })).catch(() => ({}));
      if (DEBUG) console.log('   ' + cas + ' avant ' + JSON.stringify(avant) + ' après ' + JSON.stringify(apres) + ' chargements ' + vu.navs + ' ' + vu.versions.join(' > ') + '\n   film : ' + vu.film.join(' | '));
      if (cas === '9a') {
        dit(avant.ecran === 'ventes' && v === vB, '9a au calme, sans feuille : rechargée TOUTE SEULE sur la nouvelle version', 'version ' + v + ' (attendue ' + vB + ')');
        dit(apres.ecran === 'ventes', '9a l’écran courant est gardé (Ventes)', 'écran ' + apres.ecran);
        dit(vu.navs === 2, '9a une seule fois (pas de boucle)', vu.navs + ' chargement(s)');
      } else {
        const quoi = cas === '9b' ? 'une feuille ouverte (« + »)' : 'un champ en cours de saisie';
        dit(cas === '9b' ? avant.feuille === true : true, cas + ' la scène : ' + quoi, JSON.stringify(avant));
        dit(v === vA && vu.navs === 1, cas + ' ' + quoi + ' : JAMAIS rechargée dessous', 'version ' + v + ', ' + vu.navs + ' chargement(s)');
        dit(apres.pilule === true, cas + ' la pilule « Nouvelle version · Mettre à jour » à la place', JSON.stringify(apres));
      }
      juger(cas, vu, await etatPage(pg));
      await shot(pg, cas + '-apres');
      await ctx.close();
    });
  }

  // ── 8. La transition, ralentie dix fois (CDP Animation.setPlaybackRate) : une capture AU MILIEU du fondu ──
  for (const sombre of [false, true]) {
    if (veut(8)) await essaie('8 transition ' + (sombre ? 'sombre' : 'claire'), async () => {
      site.dist = DIST_A;
      const ctx = await contexte({ sombre });
      const { pg } = await nouvellePage(ctx);
      const cdp = await ctx.newCDPSession(pg);
      await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.03 });
      // Le retrait de l'écran (un minuteur, src/demarrage.js) ne suit pas l'horloge des animations : retardé
      // ici, DANS LE BANC SEULEMENT, du même facteur — le fondu ralenti va au bout sous nos yeux.
      await pg.addInitScript(() => { const r = Element.prototype.remove; Element.prototype.remove = function () { if (this && this.id === 'vrm-demarrage') { const el = this; setTimeout(() => r.call(el), 14000); return; } return r.call(this); }; });
      await pg.goto(URL0, { waitUntil: 'commit' });
      await pg.waitForSelector('#vrm-demarrage[data-sortie]', { timeout: 90000, state: 'attached' }).catch(() => {});
      const opacite = () => pg.evaluate(() => { const d = document.getElementById('vrm-demarrage'); return d ? Number(getComputedStyle(d).opacity) : null; }).catch(() => null);
      let op = await opacite();
      for (let i = 0; i < 200 && op != null && op > 0.6; i++) { await attendre(50); op = await opacite(); }
      await shot(pg, '8-transition-' + (sombre ? 'sombre' : 'claire'));
      op = op == null ? null : op;
      dit(op != null && op > 0.05 && op < 0.95, '8 capture au milieu du fondu (' + (sombre ? 'sombre' : 'clair') + ')', 'opacité ' + op);
      await ctx.close();
    });
  }

  // ── 4. Un morceau à la demande qui rate pour de vrai (même version en ligne) ─────────────────────────────
  if (veut(4)) await essaie('4 morceau qui rate (réseau)', async () => {
    site.dist = DIST_A;
    const nomReglages = (fs.readdirSync(path.join(DIST_A, 'assets')).find((f) => /^Reglages-[\w-]+\.js$/.test(f)) || '');
    const ctx = await contexte();
    const { pg, vu } = await nouvellePage(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await attendrePret(pg);
    site.refuse = new RegExp(nomReglages.replace(/[.-]/g, '\\$&'));
    const avant = site.journal.filter((x) => x.u.endsWith(nomReglages)).length;
    await aller(pg, 'settings');
    await pg.waitForSelector('[data-mettre-a-jour-vrm]', { timeout: 20000 }).catch(() => {});
    const e = await etatPage(pg);
    const demandes = site.journal.filter((x) => x.u.endsWith(nomReglages)).length - avant;
    dit(!!nomReglages && e.majEcran, '4 le morceau introuvable ⇒ l’écran « Mettre à jour VRM »', e.texte.slice(0, 160));
    // (La relance d'un import raté ne repart pas forcément au serveur : Chromium garde l'échec d'un module pour
    // la page. Elle sert aux navigateurs qui le relancent ; rien n'est jugé dessus ici.)
    if (DEBUG) console.log('   demandes du morceau : ' + demandes);
    const boutons = await pg.evaluate(() => { const m = document.querySelector('[data-mettre-a-jour-vrm]'); return m ? [...m.querySelectorAll('button')].map((b) => b.textContent.trim()) : []; }).catch(() => []);
    dit(boutons.length === 1, '4 UN bouton, aucune phrase technique', JSON.stringify(boutons) + ' · ' + (e.texte.match(/Failed|import|module|chunk/i) || [''])[0]);
    dit(vu.navs === 1, '4 même version en ligne : aucun rechargement tout seul', vu.navs + ' chargement(s)');
    const mauvais = [...vu.erreurs, ...e.erreurs].filter((m) => /reading 'default'|\.default'|_result\.default/.test(m));
    dit(mauvais.length === 0, '4 jamais « undefined … default »', mauvais.join(' | '));
    await shot(pg, '4-mettre-a-jour');
    site.refuse = null;
    await pg.click('[data-mettre-a-jour-geste]').catch(() => {});
    await pg.waitForEvent('load', { timeout: 20000 }).catch(() => {});
    await attendre(2500);
    dit(vu.navs === 2, '4 le bouton recharge la page', vu.navs + ' chargement(s)');
    await ctx.close();
  });

  // ── 6. Réseau lent : au-delà de 8 s, une phrase utile et UN geste ───────────────────────────────────────
  if (veut(6)) await essaie('6 réseau lent', async () => {
    site.dist = DIST_A;
    const ctx = await contexte();
    const { pg, vu } = await nouvellePage(ctx);
    site.refuse = null; site.lent = 0; site.bloque = /\/assets\/App-[\w-]+\.js$/;   // le morceau de l'app n'arrive pas
    await pg.goto(URL0, { waitUntil: 'commit' });
    await attendre(1500); await shot(pg, '6-chargement-clair');
    await attendre(3500);
    const tot = await pg.evaluate(() => { const l = document.querySelector('#vrm-demarrage .vrm-boot-lent'); return l ? getComputedStyle(l).visibility : 'absent'; }).catch(() => '?');
    await attendre(4200);
    const l = await pg.evaluate(() => {
      const el = document.querySelector('#vrm-demarrage .vrm-boot-lent'); if (!el) return null;
      const cs = getComputedStyle(el); const a = el.querySelectorAll('a,button');
      const r = a[0] ? a[0].getBoundingClientRect() : null;
      return { vis: cs.visibility, op: Number(cs.opacity), texte: el.innerText.replace(/\s+/g, ' ').trim(), gestes: a.length, h: r ? Math.round(r.height) : 0, bas: r ? Math.round(r.bottom) : 0 };
    }).catch(() => null);
    dit(tot === 'hidden', '6 avant 8 s : aucune phrase (la plupart des ouvertures n’ont rien à dire)', tot);
    dit(!!l && l.vis === 'visible' && l.op > .9, '6 après 8 s : la phrase est là', JSON.stringify(l));
    dit(!!l && l.gestes === 1 && l.h >= 44 && l.bas <= 844, '6 UN geste « Recharger », 44 px au moins, dans l’écran', l && (l.gestes + ' geste(s), ' + l.h + ' px'));
    dit(!!l && !/chunk|module|javascript|erreur|error|réseau 4|http/i.test(l.texte), '6 pas un texte technique', l && l.texte);
    await shot(pg, '6-lent-clair');
    // La même attente en sombre (bleu-nuit), pour la regarder.
    { const c2 = await contexte({ sombre: true }); const p2 = await c2.newPage(); await p2.goto(URL0, { waitUntil: 'commit' }); await attendre(1500); await shot(p2, '6-chargement-sombre'); await attendre(7500); await shot(p2, '6-lent-sombre'); await c2.close(); }
    site.bloque = null;
    await pg.click('[data-vrm-boot-recharger]').catch(() => {});
    await pg.waitForEvent('load', { timeout: 20000 }).catch(() => {});
    const t = await attendrePret(pg, 60000);
    dit(vu.navs >= 2 && t != null, '6 « Recharger » relit la page, et l’app s’ouvre', vu.navs + ' chargement(s), prêt ' + t);
    await ctx.close();
  });

  // ── 7. Moins d'animations : rien ne glisse, la sortie est immédiate ───────────────────────────────────
  if (veut(7)) await essaie('7 moins d’animations', async () => {
    site.dist = DIST_A;
    const ctx = await contexte({ reduit: true });
    const { pg, vu } = await nouvellePage(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await pg.waitForSelector('#vrm-demarrage', { timeout: 20000 }).catch(() => {});
    await attendre(300);
    const r = await pg.evaluate(() => {
      const d = document.getElementById('vrm-demarrage'); if (!d) return null;
      const rail = d.querySelector('.vrm-boot-rail > span');
      const apres = rail ? getComputedStyle(rail, '::after') : null;
      const mot = d.querySelector('.vrm-boot-mot');
      return { reflet: apres ? apres.display : '?', glisse: rail ? getComputedStyle(rail).transitionDuration : '?', mot: mot ? mot.getBoundingClientRect().width : 0, fondu: getComputedStyle(d).transitionDuration };
    }).catch(() => null);
    dit(!!r && r.reflet === 'none' && /^0s|^0\.00/.test(r.glisse) && /^0s|^0\.00/.test(r.fondu), '7 aucun reflet, aucune glissade, aucun fondu', JSON.stringify(r));
    dit(!!r && r.mot > 20, '7 « Ouverture de VRM… » dit en clair', r && r.mot);
    await attendrePret(pg);
    const sorties = (await pg.evaluate(() => (window.__ouv && window.__ouv.images) || []).catch(() => [])).filter((x) => x.d === 'sortie').length;
    dit(sorties === 0, '7 l’écran de démarrage part d’un coup (aucune image de fondu)', sorties + ' image(s) en fondu');
    juger(7, vu, await etatPage(pg));
    await ctx.close();
  });

  await nav.close(); srv.close(); srvBase.close();
  console.log(ko ? `\n❌ ouverture : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ouverture : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  ' + (e && e.stack || e)); process.exit(1); });
