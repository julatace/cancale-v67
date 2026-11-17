// MAQUETTE N — captures (390 tactile clair et sombre, 1512 clair) de la page autonome.
// node docs/maquettes/n/capture.cjs <dossier>   (Chromium du banc : /opt/pw-browsers/chromium)
// Mesures rapportées : boutons pleins visibles (≤ 1), cibles < 44 px, débordement horizontal, « undefined/NaN ».
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '../../../node_modules/playwright'));
const OUT = process.argv[2] || path.join(require('os').tmpdir(), 'maquette-n');
const PAGE = 'file://' + path.join(__dirname, 'index.html');
const ECRANS = [['afaire', 'ecran=afaire'], ['ventes', 'ecran=commandes&vue=ventes'], ['achats', 'ecran=commandes&vue=achats'], ['annonces', 'ecran=annonces'], ['argent', 'ecran=argent']];
const EXTRA = [['rien', 'ecran=afaire&fait=tout'], ['retirer', 'ecran=afaire&focus=' + encodeURIComponent('retirer-Super U Cleunay')], ['offre', 'ecran=afaire&focus=offre-C52999000301']];
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const un = async (nom, hash, W, sombre) => {
    const ctx = await nav.newContext({ viewport: { width: W, height: W < 600 ? 844 : 950 }, deviceScaleFactor: W < 600 ? 2 : 1, hasTouch: W < 600, isMobile: W < 600, colorScheme: sombre ? 'dark' : 'light' });
    const pg = await ctx.newPage(); const err = []; pg.on('pageerror', (e) => err.push(e.message));
    await pg.goto(PAGE + '#' + hash); await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(500);
    const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}.png`); await pg.screenshot({ path: f });
    const m = await pg.evaluate((tel) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight; };
      const t = [...document.querySelectorAll('button, a, input')].filter(vis);
      return { pleins: [...document.querySelectorAll('[data-plein]')].filter(vis).length, petites: tel ? t.filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText || x.placeholder || '').slice(0, 24)) : [],
        deborde: document.documentElement.scrollWidth > innerWidth + 1, mauvais: /\bundefined\b|\bNaN\b/.test(document.body.innerText), police: document.fonts.check('16px "Grotesk N"') };
    }, W < 600);
    console.log(path.basename(f), JSON.stringify(m), err.join(' | '));
    await ctx.close();
  };
  for (const [n, h] of ECRANS) { await un(n, h, 390, false); await un(n, h, 390, true); await un(n, h, 1512, false); }
  for (const [n, h] of EXTRA) await un(n, h, 390, false);
  await un('rien', 'ecran=afaire&fait=tout', 390, true);
  await nav.close();
})();
