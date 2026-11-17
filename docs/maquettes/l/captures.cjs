// Captures de la maquette L (page autonome) : SHOTS=<dossier> node docs/maquettes/l/captures.cjs
// 390 tactile (clair, sombre) + 1512 clair. Mesures rapportées : textes coupés, tailles de police, cibles < 44, actions pleines visibles.
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'playwright'));
const RACINE = __dirname;
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'maquette-l');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const srv = http.createServer((q, r) => {
  let f = decodeURIComponent(q.url.split('?')[0].split('#')[0]); if (f === '/') f = '/index.html';
  const p = path.join(RACINE, f); if (!p.startsWith(RACINE) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});
const ECRANS = [['afaire', ''], ['enligne', 'f=enligne'], ['achats', 'f=achats'], ['vendues', 'f=vendues'], ['argent', 'e=argent'], ['fiche-envoyer', 'p=p201'], ['fiche-retirer', 'p=a'], ['fiche-doublon', 'p=d']];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => srv.listen(0, r));
  const port = srv.address().port;
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const voulus = (process.env.ECRANS || '').split(',').filter(Boolean);
  const passes = [[390, 'clair'], [390, 'sombre'], [1512, 'clair']];
  try {
    for (const [W, theme] of passes) for (const [nom, h0] of ECRANS) {
      if (voulus.length && !voulus.includes(nom)) continue;
      if (W > 600 && !['afaire', 'argent', 'fiche-envoyer', 'fiche-retirer', 'enligne'].includes(nom)) continue;
      const tel = W < 600;
      const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: theme === 'sombre' ? 'dark' : 'light' } : { viewport: { width: 1512, height: 950 }, colorScheme: 'light' });
      const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(String(e.message)));
      await pg.goto(`http://localhost:${port}/`, { waitUntil: 'load' });
      await pg.waitForSelector('html[data-pret]');
      // La clé du 1er achat à retirer et d'une paire du N° en double (lues dans la page).
      let h = h0;
      if (h === 'p=a') h = 'p=' + await pg.evaluate(() => document.querySelector('[data-etat="retirer"]')?.getAttribute('href').match(/p=([^&]+)/)[1]);
      if (h === 'p=d') h = 'p=' + await pg.evaluate(() => document.querySelector('.n.rouge')?.closest('a').getAttribute('href').match(/p=([^&]+)/)[1]);
      if (h) await pg.evaluate((x) => { location.hash = x; }, h);
      await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(700);
      const f = path.join(OUT, `${nom}-${W}-${theme}.png`);
      await pg.screenshot({ path: f });
      const m = await pg.evaluate((tel) => {
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && !el.closest('[inert]'); };
        const tous = [...document.querySelectorAll('#app *')].filter(vis);
        const coupes = tous.filter((x) => x.children.length === 0 && x.textContent.trim() && !x.classList.contains('nom') && x.scrollWidth > x.clientWidth + 1).map((x) => x.textContent.slice(0, 30));
        const nomsCoupes = tous.filter((x) => x.classList.contains('nom') && x.scrollHeight > x.clientHeight + 1).map((x) => x.textContent.slice(0, 30));
        const tailles = {}; for (const x of tous) if ([...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) { const s = getComputedStyle(x).fontSize; tailles[s] = (tailles[s] || 0) + 1; }
        const petites = tel ? tous.filter((x) => x.matches('a.filtre, a.onglet, button, .action, .fermer')).filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => x.textContent.trim().slice(0, 20) || x.getAttribute('aria-label')) : [];
        return { coupes, nomsCoupes, tailles, petites, actions: tous.filter((x) => x.matches('.action')).length, polices: [...document.fonts].filter((x) => x.status === 'loaded').map((x) => x.family) };
      }, tel);
      console.log(path.basename(f), JSON.stringify(m), err.length ? 'ERREURS ' + err.join(' | ') : '');
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
})();
