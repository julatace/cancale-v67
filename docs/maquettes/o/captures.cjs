// ════════════════════════════════════════════════════════════════════════════
//  CAPTURES — MAQUETTE O « GALERIE » (page autonome, données inventées).
//  SHOTS=/tmp/o node docs/maquettes/o/captures.cjs
//  390 tactile (dsf 2) clair et sombre + 1512 clair : Ma journée, Annonces, la fiche, Ventes, Achats, Argent.
//  Mesures rapportées (un banc ne meurt pas, il rapporte) : boutons pleins visibles (≤ 1), cibles < 44 px
//  au téléphone, 1re vignette/ligne (≤ 422 px), textes tronqués ou hors de l'écran, tailles de texte, mots cassés.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), http = require('http'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'playwright'));
const ICI = __dirname, OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'maquette-o');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0].split('#')[0]; if (f === '/') f = '/index.html';
  const p = path.join(ICI, f); if (!p.startsWith(ICI) || !fs.existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' }); r.end(fs.readFileSync(p));
});

async function capture(nav, { W, sombre, hash, nom, apres }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ ...(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1512, height: 950 } }), colorScheme: sombre ? 'dark' : 'light', locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const pg = await ctx.newPage(); const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e.message)));
  await pg.goto(`http://localhost:${srv.address().port}/?theme=${sombre ? 'sombre' : 'clair'}#${hash}`);
  await pg.waitForTimeout(500);
  if (apres) { await apres(pg); await pg.waitForTimeout(500); }
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`);
  await pg.screenshot({ path: f });
  const m = await pg.evaluate((tel) => {
    const vis = (el) => { if (el.closest('[data-sous-feuille]') && innerWidth < 600) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none'; };
    const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
    const petites = tel ? [...document.querySelectorAll('button:not(.ga), input')].filter(vis).filter((b) => b.getBoundingClientRect().height < 43.5 || b.getBoundingClientRect().width < 43.5).map((b) => (b.innerText || b.getAttribute('aria-label') || '').slice(0, 24)) : [];
    const l1 = [...document.querySelectorAll('.grille li, .ecran .carte li, .passe')].find(vis);
    const feuilles = [...document.querySelectorAll('body *')].filter((el) => vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    const tronques = feuilles.filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible').map((el) => el.textContent.trim().slice(0, 30));
    const debordent = feuilles.filter((el) => !el.closest('.bande, .passes, .rg.is-glisse')).filter((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; }).map((el) => el.textContent.trim().slice(0, 30));
    const tailles = [...new Set(feuilles.filter((el) => !el.closest('.onglets, .lateral, .tag, .pastille, .feuille-gestes')).map((el) => getComputedStyle(el).fontSize))];
    return { pleins, petites, premier: l1 ? Math.round(l1.getBoundingClientRect().top) : null, tronques, debordent, tailles, sansPhoto: document.querySelectorAll('[data-sans-photo]').length, mauvais: /undefined|NaN|\[object/.test(document.body.innerText) };
  }, tel);
  console.log(path.basename(f), JSON.stringify(m), erreurs.length ? 'ERREURS ' + erreurs.join(' | ') : '');
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => srv.listen(0, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const THEMES = (process.env.THEMES || 'clair,sombre').split(',');
  try {
    for (const t of THEMES) {
      const sombre = t === 'sombre';
      for (const e of ['journee', 'annonces', 'ventes', 'achats', 'argent']) await capture(nav, { W: 390, sombre, hash: 'e=' + e, nom: e });
      await capture(nav, { W: 390, sombre, hash: 'e=annonces', nom: 'fiche-annonce', apres: (pg) => pg.click('.grille li:nth-child(5) .case') });
      await capture(nav, { W: 390, sombre, hash: 'e=ventes&f=v:23999000001&d=grande', nom: 'fiche-vente' });
      await capture(nav, { W: 390, sombre, hash: 'e=achats&f=c:XR700000100FR&d=grande', nom: 'fiche-colis' });
      await capture(nav, { W: 390, sombre, hash: 'e=ventes&g=v:23999000002', nom: 'ventes-glisse' });
    }
    if (!process.env.SANS_ORDI) {
      for (const e of ['journee', 'annonces', 'ventes', 'achats', 'argent']) await capture(nav, { W: 1512, sombre: false, hash: 'e=' + e, nom: 'o-' + e });
      await capture(nav, { W: 1512, sombre: false, hash: 'e=annonces&f=a:a7700005', nom: 'o-annonces-fiche' });
    }
  } finally { await nav.close(); srv.close(); }
})();
