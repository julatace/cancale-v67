// Captures de la maquette J2 (page autonome) : 390 tactile clair + sombre, 1512 clair.
// node docs/maquettes/j2/captures.cjs <dossier de sortie>
// Mesures rapportées : ≤ 1 bouton plein visible, cibles ≥ 44 px, tailles de texte, aucun « … » ni texte coupé, aucun undefined/NaN.
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const OUT = process.argv[2] || path.join(__dirname, 'captures');
const PAGE = 'file://' + path.join(__dirname, 'index.html');
const ECRANS = (process.env.ECRANS || 'journee,ventes,ventes-glisse,achats,annonces,annonces-liste,argent,fiche').split(',');
const hashDe = (e) => ({ 'annonces-liste': 'ecran=annonces&mode=liste', 'ventes-glisse': 'ecran=ventes&glisse=1', fiche: 'ecran=ventes&fiche=23999000001' }[e] || 'ecran=' + e);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--allow-file-access-from-files'] });
  const cas = [];
  for (const theme of ['sombre', 'clair']) for (const e of ECRANS) cas.push({ W: 390, theme, e });
  for (const e of ECRANS.filter((x) => !['annonces-liste', 'ventes-glisse', 'fiche'].includes(x))) cas.push({ W: 1512, theme: 'clair', e });
  for (const c of cas) {
    const tel = c.W < 600;
    const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: c.theme === 'clair' ? 'light' : 'dark' } : { viewport: { width: 1512, height: 950 }, deviceScaleFactor: 1 });
    const pg = await ctx.newPage(); const erreurs = [];
    pg.on('pageerror', (e) => erreurs.push(String(e.message)));
    await pg.goto(`${PAGE}?theme=${c.theme}#${hashDe(c.e)}`);
    await pg.waitForSelector('[data-pret]'); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
    const f = path.join(OUT, `j2-${c.e}-${c.W}-${c.theme}.png`);
    await pg.screenshot({ path: f });
    const m = await pg.evaluate((tel) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).display !== 'none'; };
      const tailles = new Set(); for (const el of document.querySelectorAll('#app *')) if (vis(el) && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) tailles.add(getComputedStyle(el).fontSize);
      const petits = tel ? [...document.querySelectorAll('#app a, #app button')].filter(vis).filter((x) => { const r = x.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 24)) : [];
      const l1 = document.querySelector('.k-ligne, .k-tuile, .k-pass.is-devant, .k-bande-paire');
      const coupes = [...document.querySelectorAll('#app *')].filter(vis).filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow === 'hidden' && !el.matches('.k-tuile-photo,.k-vignette,.k-bande,.k-ligne-cadre,.k-porcelaine,.k-bande-photo,.k-pass')).length;
      return { pleins: [...document.querySelectorAll('[data-plein]')].filter(vis).length, tailles: [...tailles].sort(), petits, ligne1: l1 ? Math.round(l1.getBoundingClientRect().top) : null, coupes, debord: document.documentElement.scrollWidth > innerWidth, mauvais: /undefined|NaN|\[object/.test(document.body.innerText), troisPoints: /…/.test(document.body.innerText) };
    }, tel);
    console.log(path.basename(f), JSON.stringify(m), erreurs.length ? 'ERREURS ' + erreurs.join(' | ') : '');
    await ctx.close();
  }
  await nav.close();
})();
