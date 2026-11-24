// ════════════════════════════════════════════════════════════════════════════
//  BANC « MORCEAUX PÉRIMÉS » (24 nov.) — le défaut que Julien voit le plus :
//  l'app restée ouverte sur l'iPhone pendant une mise en ligne, puis un écran
//  jamais ouvert ⇒ « ça bug » (la page repart, ou « Mettre à jour VRM »).
//  Mesuré en base : 10 à 20 « morceaux » par jour, presque tous au téléphone.
//  Mesuré en production (24 nov.) : un fichier `/assets/` de la mise en ligne
//  d'AVANT répond 404 sur vrm.center (aucune « Skew Protection » sur le plan
//  Hobby) — et ce 404 porte `cache-control: public, max-age=31536000,
//  immutable` (l'en-tête de vercel.json vaut pour toute adresse /assets/).
//  Seul l'appareil peut donc garder les fichiers de la version qu'une page ouverte
//  fait tourner : le service worker.
//
//    node scripts/bancs/morceaux-perimes.cjs <dist-A>
//      un build (`npx vite build --outDir …`). La « mise en ligne » B est FABRIQUÉE
//      à partir de A : chaque fichier /assets/ change de nom (empreinte nouvelle,
//      références réécrites partout), et le service worker de B change d'un octet
//      (il s'installe et s'active, comme une vraie mise en ligne qui le touche).
//      Le serveur « Vercel » ne sert que la mise en ligne COURANTE : un fichier de A
//      répond 404 une fois B en ligne (mesuré ci-dessus).
//    BANC_PORT=…  SHOTS=<dossier>  SEUL=P1,P2…  DEBUG=1
//    Chromium seulement ici (WebKit absent de ce conteneur ; la base inventée est
//    servie sous son vrai nom par --host-resolver-rules, que WebKit n'a pas).
//
//  Scénarios (iPhone 390 tactile, le VRAI service worker) :
//   P1  ouverte longtemps (la réserve du service worker a fini), mise en ligne de B,
//       la page relit sa version (la minute), puis des écrans JAMAIS ouverts :
//       chacun s'affiche, AUCUN rechargement, aucune erreur de morceau, aucun
//       « Mettre à jour VRM », aucun garde-fou ; rien demandé au serveur en 404.
//   P2  la même, mais DEUX mises en ligne (B puis C) et une AUTRE page qui s'ouvre
//       sur C entre-temps (un 2e onglet) : le service worker range C et fait son
//       ménage — la page restée sur A doit continuer comme en P1.
//   P3  la mise en ligne tombe AVANT que la réserve ait fini (page ouverte depuis
//       quelques secondes) : un écran dont le fichier n'existe plus nulle part.
//       Au plus UN rechargement, sans « Mettre à jour VRM » ni écran tombé, qui
//       arrive sur l'écran demandé, en B ; jamais une boucle.
//   P4  un texte EN COURS DE SAISIE quand un préchargement de fond rate (après la
//       mise en ligne) : AUCUN rechargement, le texte reste ; la page se relit
//       quand elle passe en arrière-plan (invisible), sur le même écran.
//   P5  page fermée, plus aucune page sur A, deux mises en ligne plus tard : le
//       ménage a eu lieu — les fichiers de A ne restent pas sur le téléphone.
//   P6  comme P1, mais le service worker « endormi » avant sa réserve (iOS le fait
//       quand il veut : sa réserve attend 15 s puis range ≈ 340 fichiers un à un) :
//       la page ouverte depuis 90 s doit avoir ses fichiers quand même.
//  P1, P2, P6 vident le cache HTTP avant d'ouvrir les écrans : Safari l'évince vite,
//  seule la réserve du service worker est une garantie.
//  Données inventées ; rien ne sort de la machine (garde réseau des bancs).
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http'), zlib = require('zlib'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(RACINE, 'node_modules', 'playwright'));
const { fabriquer, repondre } = require(path.join(__dirname, '_base-volume.cjs'));

const DIST_A = path.resolve(process.argv[2] || process.env.BANC_DIST_A || '');
const PORT = Number(process.env.BANC_PORT || (20000 + Math.floor(Math.random() * 20000)));
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'banc-morceaux-perimes');
const SEUL = process.env.SEUL ? String(process.env.SEUL).split(',') : null;
const DEBUG = !!process.env.DEBUG;
try { fs.mkdirSync(SHOTS, { recursive: true }); } catch (_) {}
const veut = (n) => !SEUL || SEUL.includes(n);

let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d != null && d !== '' ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom + ' — le scénario a pu s’exécuter', String(e && e.message || e).split('\n')[0].slice(0, 220)); } };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ── La mise en ligne B, fabriquée depuis A : chaque /assets/ renommé ─────────────
function fabriquerB(A, lettre = 'B') {
  const B = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-morceaux-' + lettre + '-'));
  fs.cpSync(A, B, { recursive: true });
  const noms = fs.readdirSync(path.join(B, 'assets'));
  const carte = new Map();
  for (const n of noms) { const m = /^(.*-[A-Za-z0-9_-]+)(\.[a-z0-9]+)$/.exec(n); if (m) carte.set(n, m[1] + lettre + m[2]); }
  const motif = new RegExp([...carte.keys()].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')).join('|'), 'g');
  const texte = /\.(js|css|html|json|webmanifest|map)$/;
  const parcourir = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) parcourir(p); else if (texte.test(f)) { const t = fs.readFileSync(p, 'utf8'); const t2 = t.replace(motif, (x) => carte.get(x)); if (t2 !== t) fs.writeFileSync(p, t2); } } };
  parcourir(B);
  for (const [a, b] of carte) fs.renameSync(path.join(B, 'assets', a), path.join(B, 'assets', b));
  fs.appendFileSync(path.join(B, 'sw.js'), '\n// mise en ligne ' + lettre + ' (banc morceaux-perimes)\n');
  return B;
}

// ── Le serveur « Vercel » : la mise en ligne COURANTE seulement ─────────────────
const site = { dist: DIST_A, journal: [] };
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.wasm': 'application/wasm' };
const servi = (r, statut, entetes, corps) => { try { r.writeHead(statut, entetes); r.end(corps); } catch (_) {} };
const srv = http.createServer((q, r) => {
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
  // Comme vercel.json en production : l'en-tête des /assets/ vaut AUSSI pour le 404 (mesuré le 24 nov.).
  const cc = f.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
  if (absent) return servi(r, 404, { 'content-type': 'text/plain', 'cache-control': cc }, 'The page could not be found\n\nNOT_FOUND\n');
  const t = types[path.extname(p)] || 'application/octet-stream'; let b = fs.readFileSync(p);
  // P6 : « comme iOS » — le service worker endormi avant de faire SA réserve (le vrai, à une constante près).
  if (f === '/sw.js' && site.swEndormi) b = Buffer.from(String(b).replace(/const ATTENTE_RECHAUFFE_MS = \d+;/, 'const ATTENTE_RECHAUFFE_MS = 1e9;'));
  const gz = /javascript|css|html|json|svg/.test(t);
  if (gz) b = zlib.gzipSync(b, { level: 1 });
  servi(r, 200, { 'content-type': t, ...(gz ? { 'content-encoding': 'gzip' } : {}), 'cache-control': cc }, b);
});

// ── La base inventée sous son vrai nom (https, certificat jetable) ──────────────
const base = fabriquer({ comptes: 3, volumeReel: true, annonces: 300 });
const HOTE_BASE = 'lgonxzrzjcqthjtbdpzo.supabase.co';
const PORT_BASE = PORT < 50000 ? PORT + 15000 : PORT - 15000;
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type, prefer, range, range-unit, x-client-info, accept-profile, content-profile, x-vrm-equipe', 'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS, HEAD', 'access-control-expose-headers': 'Content-Range' };
function certificat() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-morc-'));
  const k = path.join(dir, 'cle.pem'), c = path.join(dir, 'cert.pem');
  require('child_process').execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', k, '-out', c, '-days', '2', '-subj', '/CN=' + HOTE_BASE, '-addext', 'subjectAltName=DNS:' + HOTE_BASE], { stdio: 'ignore' });
  const x = { key: fs.readFileSync(k), cert: fs.readFileSync(c) };
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return x;
}
const srvBase = require('https').createServer(certificat(), (q, r) => {
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

// Ce que la page voit, posé avant tout script : les erreurs, et les morceaux comptés comme en production
// (src/mesuresCollecte.js : `vite:preloadError` + rejets non gérés).
const SONDE = () => {
  const o = window.__mp = { erreurs: [], preload: 0 };
  addEventListener('error', (e) => { try { o.erreurs.push(String((e && (e.message || (e.error && e.error.message))) || 'erreur').slice(0, 200)); } catch (_) {} }, true);
  addEventListener('unhandledrejection', (e) => { try { o.erreurs.push(String((e && e.reason && (e.reason.message || e.reason)) || 'rejet').slice(0, 200)); } catch (_) {} });
  // Le rechargement de l'app (src/chargementSur.js) : sa raison et l'écran ouvert à ce moment, gardés pour l'onglet.
  addEventListener('vrm:rechargement', (e) => { try { const l = JSON.parse(sessionStorage.getItem('banc_recharges') || '[]'); l.push({ raison: e.detail && e.detail.raison, tab: history.state && history.state.vrmTab }); sessionStorage.setItem('banc_recharges', JSON.stringify(l)); } catch (_) {} });
  // Compté pour l'ONGLET (sessionStorage) : un rechargement ne remet pas le compteur à zéro.
  addEventListener('vite:preloadError', () => { o.preload++; try { sessionStorage.setItem('banc_preload', String(Number(sessionStorage.getItem('banc_preload') || 0) + 1)); } catch (_) {} });
};
const MAUVAIS = /reading 'default'|evaluating '[\w$.]*\.default'|_result\.default|Unable to preload CSS|dynamically imported module|Importing a module script failed|is not a valid JavaScript MIME type/i;

async function nouvellePage(ctx) {
  const pg = await ctx.newPage();
  const vu = { erreurs: [], console: [], navs: 0, a404: [] };
  pg.on('pageerror', (e) => vu.erreurs.push(String(e.message).slice(0, 200)));
  pg.on('console', (m) => { if (m.type() === 'error') vu.console.push(m.text().slice(0, 200)); });
  pg.on('load', () => { vu.navs++; });
  await pg.addInitScript(SONDE);
  return { pg, vu };
}
const versionDe = (pg) => pg.evaluate(() => { const s = document.querySelector('script[src*="/assets/index-"]'); return s ? s.getAttribute('src') : null; }).catch(() => null);
async function attendrePret(pg, max = 90000) {
  const fin = Date.now() + max;
  while (Date.now() < fin) {
    const o = await pg.evaluate(() => !!document.querySelector('[data-attente-ecran="journee"][data-attente="pret"], [data-attente-ecran="journee"][data-attente="plafond"]') && !(document.getElementById('vrm-demarrage') && !document.getElementById('vrm-demarrage').hasAttribute('data-sortie'))).catch(() => false);
    if (o) return true;
    await attendre(250);
  }
  return false;
}
// La réserve du service worker : combien des fichiers de la liste de A sont rangés.
async function reserve(pg, liste) {
  return pg.evaluate(async (l) => { try { const c = await caches.open('vrm-shell-v6'); let n = 0; for (const f of l) if (await c.match(f)) n++; return n; } catch (_) { return -1; } }, liste).catch(() => -1);
}
async function attendreReserve(pg, liste, max = 180000) {
  const fin = Date.now() + max; let n = 0;
  while (Date.now() < fin) { n = await reserve(pg, liste); if (n >= liste.length) return n; await attendre(1000); }
  return n;
}
const etatPage = (pg) => pg.evaluate(() => ({
  url: location.search,
  tab: history.state && history.state.vrmTab,
  recharges: (() => { try { return JSON.parse(sessionStorage.getItem('banc_recharges') || '[]'); } catch (_) { return []; } })(),
  texte: (document.body && document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  garde: [...document.querySelectorAll('[data-garde-ecran],[data-garde-feuille]')].map((e) => e.getAttribute('data-garde-ecran') || e.getAttribute('data-garde-feuille')),
  majEcran: !!document.querySelector('[data-mettre-a-jour-vrm]'),
  attente: document.querySelectorAll('[data-morceau-attente]').length,
  filet: /n’a pas pu démarrer|n'a pas pu démarrer/.test(document.body && document.body.innerText || ''),
  erreurs: (window.__mp && window.__mp.erreurs) || [],
  preload: (() => { try { return Number(sessionStorage.getItem('banc_preload') || 0); } catch (_) { return (window.__mp && window.__mp.preload) || 0; } })(),
})).catch(() => ({ url: '', texte: '', garde: [], majEcran: false, attente: 0, filet: false, erreurs: [], preload: 0 }));
const shot = async (pg, nom) => { try { await pg.screenshot({ path: path.join(SHOTS, nom + '.png') }); } catch (_) {} };
const aller = (pg, tab) => pg.evaluate((t) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: '?tab=' + t })), tab).catch(() => {});
// La minute de `autoUpdate` (src/main.jsx), sans attendre une minute.
const relireVersion = (pg) => pg.evaluate(() => window.dispatchEvent(new Event('vrm:verifier-version'))).catch(() => {});

// Des écrans chargés À LA DEMANDE que l'ouverture ne précharge pas (src/App.jsx `prechargerOnglets`).
const ECRANS = ['settings', 'dashboard', 'emails', 'communaute', 'garage', 'semaine'];

(async () => {
  if (!DIST_A || !fs.existsSync(path.join(DIST_A, 'index.html'))) { console.log('KO  il faut un build : node scripts/bancs/morceaux-perimes.cjs <dist>'); process.exit(1); }
  const DIST_B = fabriquerB(DIST_A, 'B');
  const DIST_C = fabriquerB(DIST_B, 'C');   // une 2e mise en ligne (30 par jour) : le ménage du service worker garde UNE version d'avance
  const vA = (fs.readFileSync(path.join(DIST_A, 'index.html'), 'utf8').match(/\/assets\/index-[\w-]+\.js/) || [])[0];
  const vB = (fs.readFileSync(path.join(DIST_B, 'index.html'), 'utf8').match(/\/assets\/index-[\w-]+\.js/) || [])[0];
  const listeA = JSON.parse(fs.readFileSync(path.join(DIST_A, 'hors-ligne-assets.json'), 'utf8')).fichiers;
  const nomsA = new Set(fs.readdirSync(path.join(DIST_A, 'assets')).map((n) => '/assets/' + n));
  console.log(`   A ${vA} · B ${vB} · ${listeA.length} fichiers dans la liste hors ligne de A`);
  await new Promise((r) => srv.listen(PORT, r));
  await new Promise((r) => srvBase.listen(PORT_BASE, '127.0.0.1', r));
  const regles = `MAP ${HOTE_BASE} 127.0.0.1:${PORT_BASE}, MAP *.supabase.co ~NOTFOUND, MAP *.supabase.in ~NOTFOUND, MAP vrm.center ~NOTFOUND, MAP *.vrm.center ~NOTFOUND, MAP * ~NOTFOUND, EXCLUDE localhost`;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server', '--ignore-certificate-errors', `--host-resolver-rules=${regles}`, '--use-angle=swiftshader'] });
  const contexte = async () => {
    const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {});
    await ctx.addInitScript(() => { try { localStorage.setItem('vrm_acces_direct', '1'); localStorage.setItem('vrm_visite_vue', '1'); localStorage.setItem('vrm_visite_bulles_vue', '1'); } catch (_) {} });
    return ctx;
  };
  const URL0 = `http://localhost:${PORT}/?tab=journee`;
  const a404De = (depuis) => site.journal.filter((x) => x.t >= depuis && x.s === 404 && nomsA.has(x.u)).map((x) => x.u.slice(8, 40));
  const juger = (n, vu, e, { compte = true } = {}) => {
    const mauvais = [...vu.erreurs, ...vu.console, ...e.erreurs].filter((m) => MAUVAIS.test(m));
    dit(mauvais.length === 0 && (!compte || e.preload === 0), `${n} aucune erreur de morceau (ce que la production compte « morceau »)`, `preloadError ${e.preload} · ` + mauvais.slice(0, 2).join(' | '));
    const tombes = vu.console.filter((m) => /\[VRM\] (écran|application) en erreur/.test(m));
    dit(e.garde.length === 0 && !e.filet && tombes.length === 0, `${n} aucun écran tombé (garde-fou, dernier filet)`, [...e.garde, ...(e.filet ? ['filet'] : []), ...tombes.map((m) => m.slice(0, 110))].join(' | '));
  };
  // Les écrans, l'un après l'autre ; pour chacun : rechargé ? « Mettre à jour » ? attente restée ?
  async function parcourir(n, pg, vu) {
    const res = [];
    for (const tab of ECRANS) {
      const navs = vu.navs;
      await aller(pg, tab);
      await attendre(3500);
      const e = await etatPage(pg);
      res.push({ tab, recharge: vu.navs - navs, maj: e.majEcran, attente: e.attente, garde: e.garde.length });
      await shot(pg, `${n}-${tab}`);
    }
    return res;
  }

  // ── P1 / P2 : ouverte longtemps, puis la mise en ligne ─────────────────────
  for (const n of ['P1', 'P2', 'P6']) {
    if (veut(n)) await essaie(n, async () => {
      site.dist = DIST_A; site.swEndormi = n === 'P6';
      const ctx = await contexte();
      const { pg, vu } = await nouvellePage(ctx);
      await pg.goto(URL0, { waitUntil: 'commit' });
      dit(await attendrePret(pg), `${n} Ma journée s’affiche (version A)`);
      const t0 = Date.now();
      const nRes = await attendreReserve(pg, listeA, n === 'P6' ? 90000 : 180000);
      dit(nRes === listeA.length, `${n} ${n === 'P6' ? 'service worker endormi : ' : ''}toute la liste de A est rangée (la page ouverte depuis 90 s au plus)`, `${nRes}/${listeA.length} en ${Math.round((Date.now() - t0) / 1000)} s`);
      const deploie = Date.now();
      site.dist = DIST_B;   // la mise en ligne : plus un seul fichier de A sur le serveur
      if (n === 'P2') {
        // Deux mises en ligne (B puis C) et une AUTRE page qui s'ouvre (2e onglet, l'app ailleurs) : elle passe en C, le
        // service worker range C et fait son ménage — c'est la 2e mise en ligne qui retirait les fichiers de A.
        const vC = (fs.readFileSync(path.join(DIST_C, 'index.html'), 'utf8').match(/\/assets\/index-[\w-]+\.js/) || [])[0];
        const p2 = await nouvellePage(ctx);
        // L'autre page s'ouvre en B (sa réserve range B), puis C est mise en ligne et elle passe en C.
        await p2.pg.goto(URL0, { waitUntil: 'commit' });
        await attendrePret(p2.pg); await attendre(3000);
        await attendreReserve(p2.pg, JSON.parse(fs.readFileSync(path.join(DIST_B, 'hors-ligne-assets.json'), 'utf8')).fichiers, 120000);
        site.dist = DIST_C;
        await p2.pg.reload();
        await attendrePret(p2.pg); await attendre(3000);
        dit(await versionDe(p2.pg) === vC, `${n} l’autre page tourne en C`, await versionDe(p2.pg));
        await attendreReserve(p2.pg, JSON.parse(fs.readFileSync(path.join(DIST_C, 'hors-ligne-assets.json'), 'utf8')).fichiers, 120000);
        // Une 3e ouverture (C gardée) : c'est elle qui faisait le ménage (`purgerAncienneVersion`).
        await p2.pg.reload(); await attendrePret(p2.pg); await attendre(4000);
        await p2.pg.close();
        const restent = await reserve(pg, listeA);
        dit(restent === listeA.length, `${n} la page restée sur A garde ses fichiers dans la réserve (ménage différé tant qu'elle est ouverte)`, `${restent}/${listeA.length}`);
      }
      await pg.bringToFront().catch(() => {});
      // Le cache HTTP du navigateur ne garantit rien (Safari l'évince vite, surtout sur iPhone) : on le vide —
      // seule la réserve du service worker doit tenir les fichiers de A.
      try { const cdp = await ctx.newCDPSession(pg); await cdp.send('Network.clearBrowserCache'); await cdp.detach(); } catch (_) {}
      await relireVersion(pg); await attendre(1500);
      const res = await parcourir(n, pg, vu);
      if (DEBUG) console.log('   ' + JSON.stringify(res));
      const e = await etatPage(pg);
      dit(res.every((x) => x.recharge === 0) && vu.navs === 1, `${n} AUCUN rechargement en ouvrant ${ECRANS.length} écrans jamais ouverts`, res.filter((x) => x.recharge).map((x) => x.tab).join(', ') + ` · ${vu.navs} chargement(s)`);
      dit(res.every((x) => !x.maj && !x.attente), `${n} chaque écran s’affiche (ni « Mettre à jour VRM », ni attente restée)`, res.filter((x) => x.maj || x.attente).map((x) => x.tab + (x.maj ? ' maj' : ' attente')).join(', '));
      dit(await versionDe(pg) === vA, `${n} la page tourne toujours en A (rien ne l’a rechargée)`, await versionDe(pg));
      const a404 = a404De(deploie);
      dit(a404.length === 0, `${n} aucun fichier de A demandé au serveur (404)`, a404.slice(0, 4).join(', ') + (a404.length > 4 ? ` … (${a404.length})` : ''));
      juger(n, vu, e);
      await ctx.close(); site.swEndormi = false;
    });
  }

  // ── P3 : la mise en ligne tombe avant que la réserve ait fini ──────────────
  if (veut('P3')) await essaie('P3', async () => {
    const n = 'P3';
    site.dist = DIST_A;
    const ctx = await contexte();
    const { pg, vu } = await nouvellePage(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    dit(await attendrePret(pg), `${n} Ma journée s’affiche (version A)`);
    site.dist = DIST_B;   // la réserve n'a pas commencé
    await relireVersion(pg); await attendre(1500);
    const navs = vu.navs;
    await aller(pg, 'settings');
    await attendre(600);
    const voulu = await pg.evaluate(() => history.state && history.state.vrmTab).catch(() => null);   // l'écran que la coque a ouvert (Réglages)
    await attendre(8400);
    await pg.waitForLoadState('load').catch(() => {});
    await attendre(4000);
    const e = await etatPage(pg);
    const v = await versionDe(pg);
    if (DEBUG) console.log(`   ${n} : ${vu.navs} chargement(s), version ${v}, url ${e.url}, maj ${e.majEcran}, attente ${e.attente}`);
    await shot(pg, `${n}-settings`);
    dit(vu.navs - navs <= 1, `${n} au plus UN rechargement (jamais une boucle)`, `${vu.navs} chargement(s)`);
    dit(v === vB && !!voulu && e.tab === voulu && voulu !== 'journee', `${n} la page repart en B, SUR l’écran demandé (« ${voulu} »)`, `${v} · écran « ${e.tab} » · ${e.texte.slice(0, 60)} · ${JSON.stringify(e.recharges)}`);
    dit(!e.majEcran && !e.attente, `${n} l’écran s’affiche (ni « Mettre à jour VRM », ni attente restée)`, e.texte.slice(0, 120));
    const res = await parcourir(n, pg, vu);
    dit(res.every((x) => !x.recharge && !x.maj && !x.attente), `${n} en B, les autres écrans s’ouvrent sans rien de plus`, JSON.stringify(res.filter((x) => x.recharge || x.maj || x.attente)));
    dit(vu.navs - navs <= 1, `${n} toujours au plus UN rechargement après ${ECRANS.length} écrans`, `${vu.navs} chargement(s)`);
    // Les préchargements de fond de A, ratés avant le rechargement, sont comptés (la production les compte) : ici les
    // fichiers n'existent plus NULLE PART, c'est attendu ; seul ce que Julien voit est jugé.
    juger(n, vu, await etatPage(pg), { compte: false });
    await ctx.close();
  });

  // ── P4 : un texte en cours quand un préchargement de fond rate ─────────────
  // Après une mise en ligne, les préchargements « au repos » de l'app (src/App.jsx `prechargerOnglets`, …) ratent
  // à leur tour : Vite émet `vite:preloadError` — exactement ce que le banc émet ici, pendant que Julien écrit.
  if (veut('P4')) await essaie('P4', async () => {
    const n = 'P4';
    site.dist = DIST_A;
    const ctx = await contexte();
    const { pg, vu } = await nouvellePage(ctx);
    await pg.goto(`http://localhost:${PORT}/?tab=achats`, { waitUntil: 'commit' });
    await pg.waitForFunction(() => [...document.querySelectorAll('input[type="search"], input[type="text"], input:not([type]), textarea')].some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), null, { timeout: 60000 }).catch(() => {});
    await attendre(10000);   // l'écran et ses morceaux sont là, les préchargements du repos sont passés
    const ecran = await pg.evaluate(() => history.state && history.state.vrmTab).catch(() => null);
    site.dist = DIST_B;
    const champ = await pg.evaluate(() => {
      const el = [...document.querySelectorAll('input[type="search"], input[type="text"], input:not([type]), textarea')].find((x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
      if (!el) return null; el.setAttribute('data-banc-champ', '1'); el.focus(); return el.outerHTML.slice(0, 90);
    }).catch(() => null);
    dit(!!champ, `${n} un champ de texte trouvé (écran « ${ecran} »)`, champ);
    await pg.keyboard.type('Jordan 4 bleu 42', { delay: 15 });
    const navs = vu.navs;
    await pg.evaluate(() => window.dispatchEvent(Object.assign(new Event('vite:preloadError', { cancelable: true }), { payload: new Error('Unable to preload CSS for /assets/Reglages-perime.css') }))).catch(() => {});
    await attendre(6000);
    const texte = await pg.evaluate(() => { const el = document.querySelector('[data-banc-champ]'); return el ? el.value : null; }).catch(() => null);
    dit(vu.navs === navs, `${n} un texte en cours : AUCUN rechargement tout seul`, `${vu.navs - navs} rechargement(s) · ${JSON.stringify((await etatPage(pg)).recharges)}`);
    dit(texte === 'Jordan 4 bleu 42', `${n} le texte tapé est toujours là`, JSON.stringify(texte));
    await shot(pg, `${n}-texte-garde`);
    // Il a fini d'écrire et range le téléphone (l'app passe en arrière-plan) : la page se relit là, sans qu'il le voie.
    await pg.evaluate(() => { try { document.activeElement && document.activeElement.blur(); } catch (_) {} Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); }).catch(() => {});
    await attendre(6000);
    await pg.waitForLoadState('load').catch(() => {});
    await attendre(3000);
    const e = await etatPage(pg);
    dit(vu.navs === navs + 1 && await versionDe(pg) === vB, `${n} page CACHÉE, plus rien en cours : UN rechargement, invisible, vers B`, `${vu.navs - navs} rechargement(s) · ${await versionDe(pg)}`);
    dit(!!ecran && e.tab === ecran, `${n} et il revient sur le même écran (« ${ecran} »)`, `écran « ${e.tab} » · ${JSON.stringify(e.recharges)}`);
    await ctx.close();
  });

  // ── P5 : plus aucune page sur A ⇒ le ménage a lieu ─────────────────────────
  if (veut('P5')) await essaie('P5', async () => {
    site.dist = DIST_A;
    const ctx = await contexte();
    let { pg } = await nouvellePage(ctx);
    await pg.goto(URL0, { waitUntil: 'commit' });
    await attendrePret(pg);
    await attendreReserve(pg, listeA);
    await pg.close();
    // Deux mises en ligne (B, puis C) ; à chacune l'app rouverte (la 1re range la version, la 2e part d'elle et fait le ménage).
    for (const [d, lettre] of [[DIST_B, 'B'], [DIST_C, 'C']]) {
      site.dist = d;
      for (let i = 0; i < 2; i++) {
        ({ pg } = await nouvellePage(ctx));
        await pg.goto(URL0, { waitUntil: 'commit' });
        await attendrePret(pg); await attendre(4000);
        if (i === 0) await attendreReserve(pg, JSON.parse(fs.readFileSync(path.join(d, 'hors-ligne-assets.json'), 'utf8')).fichiers, 120000);
        await pg.close();
      }
    }
    ({ pg } = await nouvellePage(ctx));
    await pg.goto(`http://localhost:${PORT}/version-app.json`).catch(() => {});
    // Les MORCEAUX (.js, l'essentiel du poids). Les feuilles .css d'une « copie d'écran » du jour (src/copieEcran.js)
    // sont redemandées par la copie à l'ouverture et reviennent du cache HTTP : observé sur main comme ici, borné au jour.
    const restent = await reserve(pg, listeA.filter((f) => f.endsWith('.js')));
    if (DEBUG) console.log('   restent : ' + (await pg.evaluate(async (l) => { const c = await caches.open('vrm-shell-v6'); const r = []; for (const f of l) if (await c.match(f)) r.push(f.slice(8, 30)); return r.join(' '); }, listeA).catch(() => '')));
    dit(restent === 0, 'P5 plus aucune page sur A, deux mises en ligne plus tard : ses morceaux ont quitté la réserve (rien ne s’accumule)', `${restent} fichier(s) de A encore rangés`);
    await ctx.close();
  });

  await nav.close();
  srv.close(); srvBase.close();
  for (const d of [DIST_B, DIST_C]) try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {}
  console.log(`\n${ok} OK · ${ko} KO · captures : ${SHOTS}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
