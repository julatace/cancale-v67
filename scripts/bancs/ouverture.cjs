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
//   4  un morceau à la demande qui rate pour de vrai (réseau) : relancé une fois ;
//      rate encore ⇒ l'écran « Mettre à jour VRM » avec UN bouton — jamais
//      `undefined … default`.
//   5  sombre : l'écran de chargement en bleu-nuit, la barre d'état assortie.
//   6  réseau lent (> 8 s) : une phrase utile et UN geste « Recharger ».
//   7  `prefers-reduced-motion` : rien ne bouge, la sortie est immédiate.
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
  const fondEn = (x, y) => {
    let el = document.elementFromPoint(x, y);
    while (el) {
      const cs = getComputedStyle(el);
      const img = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : '';
      const c = cs.backgroundColor;
      const opaque = c && !/rgba\(.*,\s*0\)$/.test(c) && c !== 'transparent';
      const op = Number(cs.opacity);
      if ((img && /gradient/.test(img)) || opaque) return { tag: el.id || el.className && String(el.className).slice(0, 40) || el.tagName, c, img: img ? img.slice(0, 60) : '', op };
      el = el.parentElement;
    }
    const b = getComputedStyle(document.body || document.documentElement);
    return { tag: 'body', c: b.backgroundColor, img: b.backgroundImage.slice(0, 60), op: 1 };
  };
  const tick = () => {
    const t = Math.round(performance.now());
    try {
      if (document.body) {
        const d = document.getElementById('vrm-demarrage');
        const parti = !d || d.hasAttribute('data-sortie');
        if (parti && o.demarrageParti == null) o.demarrageParti = t;
        const f = fondEn(Math.round(innerWidth / 2), 6);
        const fd = d ? getComputedStyle(d) : null;
        o.images.push({ t, d: d ? (parti ? 'sortie' : 'la') : 'non', dop: fd ? Number(fd.opacity) : null, f });
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

  // ── 1. Ouverture à froid ───────────────────────────────────────────────────
  if (veut(1)) await essaie('1 ouverture à froid', async () => {
    site.dist = DIST_A;
    const ctx = await contexte();
    const { pg, vu } = await nouvellePage(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await attendre(250); await shot(pg, '1-chargement-clair');
    const t = await attendrePret(pg);
    dit(t != null, '1 Ma journée s’affiche', t == null ? (await etatPage(pg)).texte.slice(0, 200) : t + ' ms');
    juger(1, vu, await etatPage(pg));
    await ctx.close();
  });

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

  await nav.close(); srv.close(); srvBase.close();
  console.log(ko ? `\n❌ ouverture : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ ouverture : ${ok} vert(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('KO  ' + (e && e.stack || e)); process.exit(1); });
