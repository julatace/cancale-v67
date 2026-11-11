// BANC — VRM INSTALLÉE SUR L'IPHONE ET ANDROID (11 nov., lot app-installable)
//
// S. LE SERVICE WORKER (vrai public/sw.js, « déploiements » synthétiques) :
//   S1. 2e ouverture INSTANTANÉE : le serveur répond en 3 s, la page arrive < 1 s ;
//   S2. lien profond hors ligne (`/?tab=ventes`) : l'app s'ouvre, l'adresse intacte ;
//   S3. une page statique (`/statut.html`) ne remplace jamais l'app en cache ;
//   S4. « Mettre à jour » (location.reload) sert la NOUVELLE version tout de suite.
// A. LA VRAIE APP (dist/, 390 × 844 tactile, Chromium ; WebKit si NAVIGATEUR=webkit) :
//   A1. nouvelle version vue en cours d'usage ⇒ « Mettre à jour » en haut, dans
//       l'écran, sans recharger ; × ⇒ plus jamais pour CETTE version ;
//   A2. iPhone Safari, 2e ouverture, 20 s ⇒ aide en 2 gestes, au-dessus de la
//       barre du bas ; rouverte ⇒ absente (une seule fois) ;
//   A3. installée (navigator.standalone) ⇒ aucune aide ;
//   A4. Android : l'invite du navigateur ⇒ « Installer » appelle prompt() ;
//   A5. la racine refuse le rechargement au tirer (overscroll-behavior: none).
// Données inventées ; aucune base réelle. `CAPTURES=<dossier>` garde les captures.
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs'), http = require('http');
const PW = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { lancer } = require('./_navigateur.cjs');
const RACINE = path.join(__dirname, '..', '..');
const DIST = path.join(RACINE, 'dist');
const SW = fs.readFileSync(path.join(RACINE, 'public', 'sw.js'), 'utf8');
const CAPTURES = process.env.CAPTURES || '';
let ko = 0, okN = 0;
const dit = (c, m, d) => { if (c) okN++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (!c && d !== undefined ? ' — ' + String(d).slice(0, 300) : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e.message || e).slice(0, 200)); } };
const OPTS = { executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] };
const capture = async (pg, nom) => { if (!CAPTURES) return; try { await pg.clock.runFor(600); } catch (_) {} fs.mkdirSync(CAPTURES, { recursive: true }); await pg.screenshot({ path: path.join(CAPTURES, nom + '.png'), animations: 'disabled' }); };
const ecouter = (srv) => new Promise((ok) => srv.listen(0, '127.0.0.1', () => ok('http://127.0.0.1:' + srv.address().port)));

// ── S ───────────────────────────────────────────────────────────────────────
async function partieS(b) {
  console.log('S. le service worker');
  let version = 'A', lent = 0;
  const page = (v) => `<!doctype html><html><head><meta charset="utf-8"><title>VRM</title>
<script type="module" crossorigin src="/assets/index-${v}111.js"></script></head><body><div id="root"></div>
<script>if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');</script></body></html>`;
  const srv = http.createServer(async (q, r) => {
    const p = decodeURIComponent(q.url.split('?')[0]);
    const v = version;
    const env = (type, corps) => { r.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' }); r.end(corps); };
    if (p === '/' || p === '/index.html') { if (lent) await new Promise((ok) => setTimeout(ok, lent)); return env('text/html', page(v)); }
    if (p === '/sw.js') return env('application/javascript', SW);
    if (p === '/statut.html') return env('text/html', '<!doctype html><title>Statut</title><p id="statut">statut</p>');
    const m = /^\/assets\/index-([A-Z])111\.js$/.exec(p);
    if (m) return env('application/javascript', `window.__principal='${m[1]}';`);
    r.writeHead(404); r.end();
  });
  const base = await ecouter(srv);
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const pg = await ctx.newPage();
  try {
    await pg.goto(base + '/', { waitUntil: 'load' });
    await pg.evaluate(() => navigator.serviceWorker.ready);
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForTimeout(400);
    await essaie('S1', async () => {
      lent = 3000;
      const t0 = Date.now();
      await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });
      const ms = Date.now() - t0;
      const v = await pg.waitForFunction(() => window.__principal, null, { timeout: 2000 }).then((h) => h.jsonValue()).catch(() => null);
      dit(ms < 1000 && v === 'A', `S1 2e ouverture instantanée malgré un serveur lent (${ms} ms, version ${v})`, `${ms} ms`);
      lent = 0;
      await pg.waitForTimeout(3300);
    });
    await essaie('S2', async () => {
      await ctx.setOffline(true);
      await pg.goto(base + '/?tab=ventes&notif=3', { waitUntil: 'domcontentloaded' });
      const r = await pg.evaluate(() => ({ s: location.search, v: window.__principal || null }));
      await pg.waitForFunction(() => window.__principal, null, { timeout: 2000 }).catch(() => {});
      const v = await pg.evaluate(() => window.__principal || null);
      dit(r.s === '?tab=ventes&notif=3' && v === 'A', `S2 lien profond hors ligne : l'app s'ouvre sur ${r.s} (version ${v})`, JSON.stringify(r));
      await ctx.setOffline(false);
    });
    await essaie('S3', async () => {
      await pg.goto(base + '/statut.html', { waitUntil: 'load' });
      const coquille = await pg.evaluate(async () => { const c = await caches.open('vrm-shell-v6'); const r = await c.match('/'); return r ? r.text() : ''; });
      dit(/index-A111/.test(coquille) && !/statut/.test(coquille), 'S3 une page statique ne remplace pas l\'app en cache', coquille.slice(0, 80));
    });
    await essaie('S4', async () => {
      await pg.goto(base + '/', { waitUntil: 'load' });
      version = 'B';
      await pg.reload({ waitUntil: 'load' });
      const v = await pg.waitForFunction(() => window.__principal, null, { timeout: 3000 }).then((h) => h.jsonValue()).catch(() => null);
      dit(v === 'B', `S4 « Mettre à jour » (rechargement) sert la nouvelle version tout de suite (${v})`, v);
    });
  } finally { await ctx.close(); srv.close(); }
}

// ── A ───────────────────────────────────────────────────────────────────────
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/json', '.woff2': 'font/woff2' };
async function partieA(b) {
  console.log('A. la vraie app (390 tactile)');
  let autreVersion = false;
  const srv = http.createServer((q, r) => {
    const [chemin, qs] = q.url.split('?');
    let f = chemin; if (f === '/' || !path.extname(f)) f = '/index.html';
    if (f === '/sw.js') { r.writeHead(404); return r.end(); }
    const p = path.join(DIST, f);
    if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); }
    // La vérification de version (`/?_v=…`) : un « déploiement » neuf quand demandé.
    if (autreVersion && f === '/index.html' && /(^|&)_v=/.test(qs || '')) {
      r.writeHead(200, { 'content-type': 'text/html' });
      return r.end(fs.readFileSync(p, 'utf8').replace(/assets\/index-[A-Za-z0-9_-]+\.js/g, 'assets/index-NOUVELLE9.js'));
    }
    r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(r);
  });
  const base = await ecouter(srv);
  const appareil = async ({ ua, local = {}, standalone = false, sombre = false } = {}) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: ua, serviceWorkers: 'block', colorScheme: sombre ? 'dark' : 'light' });
    await ctx.addInitScript(({ loc, standalone, sombre }) => {
      try {
        if (!localStorage.getItem('__banc_pose__')) {
          localStorage.setItem('__banc_pose__', '1'); localStorage.setItem('vrm_acces_direct', '1');
          localStorage.setItem('vrm_bienvenue_vue', JSON.stringify({ at: '2026-10-01T00:00:00Z' }));
          localStorage.setItem('vrm_apparence', JSON.stringify(sombre ? 'sombre' : 'clair'));
          for (const [k, v] of Object.entries(loc || {})) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
        }
      } catch (_) {}
      if (standalone) { try { Object.defineProperty(navigator, 'standalone', { get: () => true }); } catch (_) {} }
    }, { loc: local, standalone, sombre });
    await ctx.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i, (r) => (/\/rest\/v1\//.test(r.request().url())
      ? r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' })
      : r.abort()));
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
    return ctx;
  };
  const ouvrir = async (ctx) => {
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', (e) => errs.push(e.message));
    await pg.clock.install({ time: new Date(2026, 10, 11, 15, 0).getTime() });
    await pg.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await pg.waitForFunction(() => document.querySelector('.vrm-main'), null, { timeout: 20000 }).catch(() => {});
    await pg.clock.runFor(3000);
    return { pg, errs };
  };
  const boite = (pg, sel) => pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; }, sel);
  try {
    for (const sombre of [false, true]) {
      const nom = sombre ? 'sombre' : 'clair';
      await essaie('A1 ' + nom, async () => {
        const ctx = await appareil({ ua: UA_IPHONE, sombre, local: { vrm_aide_installation: { vue: '2026-11-01T00:00:00Z' } } });
        const { pg, errs } = await ouvrir(ctx);
        dit(!!(await pg.$('.vrm-main')), `A1 (${nom}) l'app est rendue`, errs.join(' | '));
        await pg.evaluate(() => { window.__marque = 1; });
        autreVersion = true;
        await pg.evaluate(() => window.dispatchEvent(new Event('focus')));
        await pg.clock.runFor(1500);
        await pg.waitForSelector('[data-maj-dispo]', { timeout: 4000 }).catch(() => {});
        const pil = await boite(pg, '[data-maj-dispo]');
        const marque = await pg.evaluate(() => window.__marque === 1);
        dit(!!pil && marque, `A1 (${nom}) nouvelle version ⇒ « Mettre à jour » proposé, page PAS rechargée`, JSON.stringify({ pil, marque }));
        if (pil) dit(pil.y >= 0 && pil.x >= 0 && pil.r <= 390 && pil.h <= 60 && pil.b <= (await boite(pg, ".vrm-tabbar")).y + 1, `A1 (${nom}) la pilule tient dans l'écran, au-dessus de la barre (${Math.round(pil.b)} px, ${Math.round(pil.w)}×${Math.round(pil.h)})`, JSON.stringify(pil));
        await capture(pg, `maj-${nom}`);
        await pg.tap('[data-maj-geste="plus-tard"]').catch(() => {});
        await pg.clock.runFor(300);
        await pg.evaluate(() => window.dispatchEvent(new Event('focus')));
        await pg.clock.runFor(1500);
        const encore = await pg.$('[data-maj-dispo]');
        const refusee = await pg.evaluate(() => localStorage.getItem('vrm_maj_refusee'));
        dit(!encore && refusee === 'assets/index-NOUVELLE9.js', `A1 (${nom}) fermée ⇒ plus jamais pour cette version`, JSON.stringify({ encore: !!encore, refusee }));
        autreVersion = false;
        await ctx.close();
      });
    }
    for (const sombre of [false, true]) {
      const nom = sombre ? 'sombre' : 'clair';
      await essaie('A2 ' + nom, async () => {
        const ctx = await appareil({ ua: UA_IPHONE, sombre, local: { vrm_aide_installation: { visites: 1 } } });
        let { pg } = await ouvrir(ctx);
        const avant = await pg.$('[data-aide-installation]');
        await pg.clock.runFor(21000);
        await pg.waitForSelector('[data-aide-installation]', { timeout: 3000 }).catch(() => {});
        const aide = await boite(pg, '[data-aide-installation]');
        const barre = await boite(pg, '.vrm-tabbar');
        const plat = await pg.evaluate(() => (document.querySelector('[data-aide-installation]') || {}).getAttribute?.('data-aide-installation'));
        const gestes = await pg.evaluate(() => document.querySelectorAll('[data-aide-installation] .vrm-inst-gestes li').length);
        dit(!avant && !!aide && plat === 'iphone' && gestes === 2, `A2 (${nom}) iPhone Safari, 2e ouverture : aide en 2 gestes après 20 s (pas avant)`, JSON.stringify({ avant: !!avant, aide, plat, gestes }));
        if (aide && barre) dit(aide.b <= barre.y + 1 && aide.x >= 0 && aide.r <= 390, `A2 (${nom}) l'aide ne couvre pas la barre du bas (${Math.round(aide.b)} ≤ ${Math.round(barre.y)})`, JSON.stringify({ aide, barre }));
        const cibles = await pg.evaluate(() => [...document.querySelectorAll('[data-aide-installation] button')].map((x) => { const r = x.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); }));
        dit(cibles.length >= 2 && cibles.every((c) => c >= 36), `A2 (${nom}) boutons touchables (${cibles.join(', ')} px, ×  agrandi à 44 par sa zone)`, cibles.join(','));
        await capture(pg, `aide-iphone-${nom}`);
        await pg.tap('[data-inst-geste="compris"]').catch(() => {});
        await pg.close();
        ({ pg } = await ouvrir(ctx));
        await pg.clock.runFor(25000);
        dit(!(await pg.$('[data-aide-installation]')), `A2 (${nom}) rouverte : l'aide ne revient pas (une seule fois)`);
        await ctx.close();
      });
    }
    await essaie('A3', async () => {
      const ctx = await appareil({ ua: UA_IPHONE, standalone: true, local: { vrm_aide_installation: { visites: 5 } } });
      const { pg } = await ouvrir(ctx);
      await pg.clock.runFor(25000);
      dit(!(await pg.$('[data-aide-installation]')), 'A3 déjà installée (navigator.standalone) : aucune aide');
      await capture(pg, 'installee-clair');
      await ctx.close();
    });
    await essaie('A4', async () => {
      const ctx = await appareil({ ua: UA_ANDROID, local: { vrm_aide_installation: { visites: 3 } } });
      const { pg } = await ouvrir(ctx);
      await pg.evaluate(() => { const e = new Event('beforeinstallprompt', { cancelable: true }); e.prompt = () => { window.__invite = 'demandee'; return Promise.resolve(); }; window.dispatchEvent(e); });
      await pg.clock.runFor(21000);
      await pg.waitForSelector('[data-aide-installation="android"]', { timeout: 3000 }).catch(() => {});
      const vue = !!(await pg.$('[data-aide-installation="android"]'));
      await capture(pg, 'aide-android-clair');
      await pg.tap('[data-inst-geste="installer"]').catch(() => {});
      await pg.clock.runFor(300);
      const r = await pg.evaluate(() => window.__invite || null);
      dit(vue && r === 'demandee', 'A4 Android : « Installer » ouvre l\'invite du navigateur', JSON.stringify({ vue, r }));
      const ob = await pg.evaluate(() => getComputedStyle(document.documentElement).overscrollBehaviorY);
      dit(ob === 'none', `A5 la racine refuse le rechargement au tirer (overscroll-behavior-y: ${ob})`);
      await ctx.close();
    });
  } finally { srv.close(); }
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('❌ dist/ absent : npm run build'); process.exit(1); }
  const b = await lancer(PW, OPTS);
  try {
    if (!process.env.BANC_PARTIE || process.env.BANC_PARTIE === 'S') await partieS(b);
    if (!process.env.BANC_PARTIE || process.env.BANC_PARTIE === 'A') await partieA(b);
  } finally { await b.close(); }
  console.log(ko ? `\n❌ app-installable : ${ko} rouge(s), ${okN} vert(s)` : `\n✅ app-installable : ${okN} vert(s)`);
  process.exit(ko ? 1 : 0);
})();
