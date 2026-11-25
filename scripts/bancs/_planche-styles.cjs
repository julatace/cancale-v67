// Planches de revue (style-graphite, 24 nov.) : une planche par style (Ventes, Annonces, fiche × clair/sombre, 390)
// et l'« avant (actuel) / après (Graphite) » des trois écrans des captures de Julien. Lit les captures du banc
// styles-choix (`SHOTS`), écrit dans `SORTIE`. Rien dans le dépôt (les captures restent hors du dépôt public).
'use strict';
require('./_porte-banc.cjs');
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const SHOTS = process.env.SHOTS, SORTIE = process.env.SORTIE || SHOTS;
const G = require('../styles-generer.cjs');
const NOMS = { actuel: 'Actuel', graphite: 'Graphite', ardoise: 'Ardoise', pierre: 'Pierre', encre: 'Encre', papier: 'Papier', verre: 'Verre', nuit: 'Nuit', menthe: 'Menthe', studio: 'Studio', arcade: 'Arcade', monochrome: 'Monochrome', c3doux: 'C3 doux' };
const ECRANS = [['ventes', 'Ventes · À envoyer'], ['annonces', 'Annonces'], ['fiche', 'Fiche de la paire']];
const img = (f) => { const p = path.join(SHOTS, f); return fs.existsSync(p) ? 'data:image/png;base64,' + fs.readFileSync(p).toString('base64') : ''; };
const cell = (f, leg) => `<figure><div class="cad">${img(f) ? `<img src="${img(f)}">` : '<div class="manque">pas de capture</div>'}</div><figcaption>${leg}</figcaption></figure>`;
const page = (titre, sous, corps) => `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:28px;background:#ECEDEF;font:14px/1.4 -apple-system,system-ui,sans-serif;color:#1D1D1F}
h1{font-size:24px;margin:0 0 4px}p{margin:0 0 18px;color:#50535B}
.g{display:grid;grid-template-columns:repeat(var(--c),300px);gap:18px}
figure{margin:0}.cad{width:300px;height:649px;border-radius:26px;overflow:hidden;background:#fff;box-shadow:0 8px 24px -10px rgb(0 0 0/.35)}
.cad img{width:300px;display:block}figcaption{margin-top:6px;font-weight:600;font-size:13px}.manque{padding:40px;color:#888}
h2{font-size:15px;margin:22px 0 8px}</style><h1>${titre}</h1><p>${sous}</p>${corps}`;
(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const pg = await nav.newPage({ viewport: { width: 1100, height: 800 } });
  const faire = async (html, nom) => { const f = path.join(SORTIE, nom + '.html'); fs.writeFileSync(f, html); await pg.goto('file://' + f); await pg.waitForTimeout(300); await pg.screenshot({ path: path.join(SORTIE, nom + '.png'), fullPage: true }); fs.unlinkSync(f); };
  for (const st of (process.env.STYLES || G.ORDRE.join(',')).split(',')) {
    const corps = `<div class="g" style="--c:3">${['clair', 'sombre'].flatMap((th) => ECRANS.map(([e, l]) => cell(`${st}-${th}-${e}-390.png`, `${l} · ${th}`))).join('')}</div>`;
    await faire(page(`Style « ${NOMS[st]} »`, `iPhone 390 × 844, base inventée du banc — clair puis sombre.`, corps), `planche-${st}`);
  }
  if (fs.existsSync(path.join(SHOTS, 'actuel-clair-ventes-390.png'))) {
    const corps = ECRANS.map(([e, l]) => `<h2>${l}</h2><div class="g" style="--c:2">${cell(`actuel-clair-${e}-390.png`, 'avant (actuel)')}${cell(`graphite-clair-${e}-390.png`, 'après (Graphite)')}</div>`).join('');
    await faire(page('Avant (actuel) / après (Graphite)', 'Les trois écrans des captures de Julien, iPhone 390, clair.', corps), 'avant-apres-graphite');
  }
  await nav.close();
  console.log('planches écrites dans ' + SORTIE);
})();
