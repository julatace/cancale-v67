require('./_porte-banc.cjs');
// ═══════════════════════════════════════════════════════════════════════════
// UN SEUL GRAND TITRE PAR ÉCRAN (23 nov., audit démo)
// ═══════════════════════════════════════════════════════════════════════════
// À l'ordinateur, Aujourd'hui affichait « Aujourd'hui » DEUX fois : le grand titre
// de la coque (`h1.n-grand-titre`, posé le 22 nov. par bugs-totale) puis celui de
// l'écran (`h1.n-tb-titre` avec la date, posé le même soir par style-clarte ;
// `h1.sj-titre` pour un compte neuf). Au téléphone : un seul.
//
// Ici, l'app d'exemple (« Découvrir avec des exemples », aucune requête vers la
// base) est ouverte à 390 et 1512 px, clair et sombre ; sur chaque écran
// principal on compte les h1 VISIBLES dans la zone de l'écran (rect non vide,
// opacité > 0, pas aria-hidden) : exactement un, et pour Aujourd'hui il dit
// « Aujourd'hui ». Aucun libellé jugé ailleurs.
// `BANC_DIST`, `BANC_PORT`, `SHOTS`, `LARGEURS`, `THEMES`, `ECRANS`.
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const DIST = process.env.BANC_DIST || path.join(__dirname, '..', '..', 'dist');
const PORT = Number(process.env.BANC_PORT) || 10527;
const SHOTS = process.env.SHOTS || '';
const liste = (v, d) => String(process.env[v] || d).split(',').map((x) => x.trim()).filter(Boolean);
const LARGEURS = liste('LARGEURS', '390,1512').map(Number);
const THEMES = liste('THEMES', 'clair,sombre');
const ECRANS = liste('ECRANS', 'journee,annonces,ventes,achats,compta,messages');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.wasm': 'application/wasm' };

let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK  ' : 'KO  '}${quoi}${!bon && det ? ' — ' + String(det).slice(0, 400) : ''}`); };

const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0]; if (f === '/' || !path.extname(f)) f = '/index.html';
  const p = path.join(DIST, f); if (!p.startsWith(DIST) || !fs.existsSync(p) || !fs.statSync(p).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

(async () => {
  await new Promise((ok) => srv.listen(PORT, ok));
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined), args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const W of LARGEURS) for (const theme of THEMES) {
      const tel = W < 600, sombre = theme === 'sombre', T = `[${W} ${theme}]`;
      const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris', serviceWorkers: 'block' });
      const pg = await ctx.newPage();
      const erreurs = [];
      pg.on('pageerror', (e) => erreurs.push(String(e.message || e).slice(0, 200)));
      await pg.addInitScript((sombre) => { try { sessionStorage.setItem('vrm_mode_exemple', '1'); localStorage.setItem('vinted_dark', sombre ? 'true' : 'false'); } catch (_) {} }, sombre);
      await pg.route('**/*', (route) => { const u = route.request().url(); return u.startsWith(`http://localhost:${PORT}/`) ? route.fallback() : route.abort(); });
      await pg.goto(`http://localhost:${PORT}/?tab=journee`, { waitUntil: 'domcontentloaded' });
      await pg.waitForFunction(() => document.querySelector('.vrm-main'), null, { timeout: 30000 }).catch(() => {});
      await pg.waitForTimeout(4000);
      for (let i = 0; i < 4; i++) {   // les feuilles d'accueil d'un compte neuf : « Plus tard »
        const p = pg.locator('[data-configuration-plus-tard], [data-parcours-fermer]').first();
        if (!(await p.isVisible().catch(() => false))) break;
        await p.click().catch(() => {}); await pg.waitForTimeout(500);
      }
      for (const e of ECRANS) {
        await pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:aller', { detail: x })), e);
        await pg.waitForTimeout(2500);
        const h = await pg.evaluate(() => [...document.querySelectorAll('.vrm-main h1')].filter((x) => {
          if (!x.getClientRects().length || x.closest('[aria-hidden="true"], [hidden]')) return false;
          for (let n = x; n; n = n.parentElement) { const s = getComputedStyle(n); if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false; }
          const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !(r.width <= 1 && r.height <= 1);
        }).map((x) => `${x.className || x.tagName}:${(x.textContent || '').trim().slice(0, 30)}`));
        dit(h.length === 1, `${T} ${e} : un seul grand titre`, JSON.stringify(h));
        if (e === 'journee') dit(h.length >= 1 && /Aujourd/.test(h[0]), `${T} journee : le titre dit « Aujourd'hui »`, JSON.stringify(h));
        if (SHOTS && (e === 'journee' || h.length !== 1)) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, `titre-${W}-${theme}-${e}.png`) }); }
      }
      dit(!erreurs.length, `${T} aucune erreur JavaScript`, erreurs.join(' | '));
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  console.log(ko ? `\n❌ titre-unique : ${ko} rouge(s)` : '\n✅ titre-unique : un seul grand titre partout');
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
