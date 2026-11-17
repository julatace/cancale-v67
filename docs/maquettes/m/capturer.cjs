// MAQUETTE M — les captures (Playwright, Chromium du banc). `node docs/maquettes/m/capturer.cjs <dossier>`
// 390 tactile (×2) clair et sombre, 1512 clair ; + glissement, feuille de la paire, feuille du code.
// Mesures rapportées : pleins visibles (≤ 1), cibles < 44 px, 1re ligne (≤ 422), boutons dans la moitié
// haute hors « ? », textes coupés, tailles de police, « undefined/NaN ».
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(require.resolve('playwright', { paths: [path.join(__dirname, '../../..'), '/home/user/cancale-v67'] }));
const OUT = process.argv[2] || path.join(__dirname, 'captures'); fs.mkdirSync(OUT, { recursive: true });
const PAGE = 'file://' + path.join(__dirname, 'index.html');
const ECR = ['journee', 'ventes', 'achats', 'annonces', 'argent'];
const JOBS = [
  ...ECR.map((e) => ({ W: 390, t: 'light', h: 'ecran=' + e, n: e })),
  { W: 390, t: 'light', h: 'ecran=ventes&glisse=1', n: 'ventes-glisse' },
  { W: 390, t: 'light', h: 'ecran=ventes&fiche=124', n: 'ventes-fiche' },
  { W: 390, t: 'light', h: 'ecran=achats&colis=c1', n: 'achats-code' },
  { W: 390, t: 'light', h: 'ecran=ventes&menu=124', n: 'ventes-menu' },
  ...ECR.map((e) => ({ W: 390, t: 'dark', h: 'ecran=' + e, n: e })),
  { W: 390, t: 'dark', h: 'ecran=achats&colis=c1', n: 'achats-code' },
  ...ECR.map((e) => ({ W: 1512, t: 'light', h: 'ecran=' + e, n: e })),
].filter((j) => !process.env.SEUL || j.n.startsWith(process.env.SEUL));
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  for (const j of JOBS) {
    const tel = j.W < 600;
    const ctx = await nav.newContext(tel ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, colorScheme: j.t, locale: 'fr-FR', timezoneId: 'Europe/Paris' } : { viewport: { width: 1512, height: 950 }, colorScheme: j.t, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
    const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(e.message));
    await pg.goto(`${PAGE}?theme=${j.t}#${j.h}`); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(700);
    const f = path.join(OUT, `M-${j.n}-${j.W}-${j.t === 'dark' ? 'sombre' : 'clair'}.png`);
    await pg.screenshot({ path: f });
    const m = await pg.evaluate((tel) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); if (!(r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight)) return false; const t = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2))); return !!t && (el === t || el.contains(t)); };
      const pleins = [...document.querySelectorAll('[data-plein]')].filter(vis).length;
      const petites = tel ? [...document.querySelectorAll('button')].filter(vis).filter((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) < 43.5 && !b.matches('.li-geste'); }).map((b) => b.innerText.slice(0, 20) || b.getAttribute('aria-label')) : [];
      const l1 = document.querySelector('.liste .li'); const hauts = tel ? [...document.querySelectorAll('button,input')].filter(vis).filter((b) => !b.closest('.liste,.feuille,.voile') && !b.matches('.aide') && b.getBoundingClientRect().bottom < innerHeight / 2).map((b) => b.innerText.slice(0, 20)) : [];
      const coupes = [...document.querySelectorAll('.tag-n,.li-mot,.li-sous,.li-val,.li-etat,.seg-b,.plein,.onglet span,.legende,.titre,.chiffre,.gr-nom,.passe-v,.passe-lieu,.trio dd,.stats dd,.vie-d')].filter(vis).filter((x) => x.scrollWidth > x.clientWidth + 1).map((x) => x.innerText.slice(0, 30));
      const tailles = new Set(); for (const x of document.querySelectorAll('body *')) { if ([...x.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && vis(x)) tailles.add(getComputedStyle(x).fontSize); }
      const lignes = [...document.querySelectorAll('.liste .li')].filter((x) => { const r = x.getBoundingClientRect(); const p = document.querySelector('.pouce').getBoundingClientRect(); return r.top >= 0 && r.bottom <= p.top; }).length;
      return { pleins, petites, ligne1: l1 ? Math.round(l1.getBoundingClientRect().top) : null, lignesEntieres: lignes, hauts, coupes, tailles: [...tailles], mauvais: /undefined|NaN|\[object/.test(document.body.innerText) };
    }, tel);
    console.log(path.basename(f), JSON.stringify(m), err.length ? 'ERREURS ' + err.join(' | ') : '');
    await ctx.close();
  }
  await nav.close();
})();
