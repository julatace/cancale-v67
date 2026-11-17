// Captures de la maquette I « L'épure » (page autonome) : 390 tactile clair et sombre, 1512 clair,
// les feuilles (appui long, codes), la variante « bleu très léger ».
// SHOTS=<dossier> node docs/maquettes/i/capture.cjs
// Mesures rapportées : ≤ 1 bouton plein visible, cibles ≥ 44 px (390), 1re rangée ≤ 50 % de 844,
// au plus 3 tailles de texte dans la page, aucun « … », aucun undefined/NaN, aucune capsule (rayon ≥ hauteur/2 sur un bouton).
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', '..', 'node_modules', 'playwright'));
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'maquette-i');
const URL0 = 'file://' + path.join(__dirname, 'index.html');
const ECR = ['jour', 'ventes', 'achats', 'annonces', 'argent'];

async function capture(nav, { W, sombre, hash, nom, fond }) {
  const tel = W < 600;
  const ctx = await nav.newContext({ viewport: { width: W, height: tel ? 844 : 945 }, deviceScaleFactor: tel ? 2 : 1, hasTouch: tel, isMobile: tel, colorScheme: sombre ? 'dark' : 'light' });
  const pg = await ctx.newPage(); const erreurs = [];
  pg.on('pageerror', (e) => erreurs.push(e.message));
  await pg.goto(`${URL0}?theme=${sombre ? 'sombre' : 'clair'}${fond ? '&fond=' + fond : ''}#${hash}`);
  await pg.waitForTimeout(700);
  const f = path.join(OUT, `${nom}-${W}-${sombre ? 'sombre' : 'clair'}${fond ? '-' + fond : ''}.png`);
  await pg.screenshot({ path: f });
  const mes = await pg.evaluate((tel) => {
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden'; };
    const btn = [...document.querySelectorAll('button')].filter(vis);
    const petites = tel ? btn.filter((x) => x.getBoundingClientRect().height < 43.5).map((x) => (x.innerText || x.getAttribute('aria-label') || '').slice(0, 24)) : [];
    const capsules = btn.filter((x) => { const r = x.getBoundingClientRect(); return parseFloat(getComputedStyle(x).borderTopLeftRadius) >= r.height / 2 - 1 && r.width > r.height * 1.5; }).length;
    const tailles = new Set(); const coupes = [];
    for (const el of document.querySelectorAll('.main *')) {
      if (!vis(el)) continue; const cs = getComputedStyle(el);
      if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) tailles.add(cs.fontSize);
      if (cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth) coupes.push(el.innerText.slice(0, 24));
    }
    const l1 = document.querySelector('.page .rangee');
    return { pleins: document.querySelectorAll('[data-plein]').length, petites, capsules, tailles: [...tailles], coupes, ligne1: l1 ? Math.round(l1.getBoundingClientRect().top) : null, mauvais: /\bundefined\b|\bNaN\b/.test(document.body.innerText) };
  }, tel);
  console.log(path.basename(f), JSON.stringify(mes), erreurs.length ? 'ERREURS ' + erreurs.join(' | ') : '');
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  try {
    for (const e of ECR) await capture(nav, { W: 390, sombre: false, hash: 'ecran=' + e, nom: 'i-' + e });
    for (const e of ECR) await capture(nav, { W: 390, sombre: true, hash: 'ecran=' + e, nom: 'i-' + e });
    for (const e of ECR) await capture(nav, { W: 1512, sombre: false, hash: 'ecran=' + e, nom: 'i-' + e });
    await capture(nav, { W: 390, sombre: false, hash: 'ecran=annonces&feuille=annonce:a7700131', nom: 'i-appui-long' });
    await capture(nav, { W: 390, sombre: false, hash: 'ecran=ventes&feuille=vente:tx124', nom: 'i-vente' });
    await capture(nav, { W: 390, sombre: false, hash: 'ecran=achats&feuille=codes:482100', nom: 'i-codes' });
    await capture(nav, { W: 390, sombre: true, hash: 'ecran=achats&feuille=codes:482100', nom: 'i-codes' });
    await capture(nav, { W: 390, sombre: false, hash: 'ecran=jour', nom: 'i-jour', fond: 'bleu' });
  } finally { await nav.close(); }
})();
