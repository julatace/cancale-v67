// ═══════════════════════════════════════════════════════════
//  BANC — LA GRILLE VIRTUALISÉE MONTE TOUTES SES RANGÉES QUAND ELLE BOUGE SANS DÉFILEMENT (26 nov. 2026)
//  Capture de Julien : Annonces → Vestiaire, « Sans compte · 3 » et UNE seule rangée sous une place vide pour trois.
//  src/natif/visuel/GrilleInventaire.jsx ne recalculait ses rangées montées qu'au défilement ou au redimensionnement de la
//  fenêtre : posée sous l'écran (un grand bloc au-dessus), puis remontée quand ce bloc rétrécit, elle gardait une seule rangée.
//  Construit la VRAIE GrilleInventaire (esbuild) dans une page : un bloc de 3000 px, une liste de 3 rangées de 72 px ; le bloc
//  passe à 40 px SANS défilement. Mesures (data-* et nombres) :
//   W1 avant : la grille est sous l'écran (rien à exiger) ;  W2 après : 3 rangées montées sur 3, chacune visible ;
//   W3 la hauteur réservée est celle de 3 rangées (216 px).  Sur l'arbre d'avant le 26 nov., W2 doit ROUGIR.
// ═══════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const RACINE = path.join(__dirname, '..', '..');
const NM = path.join(RACINE, 'node_modules');
if (!fs.existsSync(path.join(NM, 'esbuild'))) { console.log('❌ esbuild introuvable (node_modules absent)'); process.exit(1); }
try { require(path.join(__dirname, '_porte-banc.cjs')); } catch (_) {}
const { chromium } = require(path.join(NM, 'playwright'));
const esbuild = require(path.join(NM, 'esbuild'));
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-grille-fenetre-'));
let rouges = 0, verts = 0;
const dit = (ok, quoi, d) => { if (ok) { verts++; console.log('  ✅ ' + quoi); } else { rouges++; console.log('  ❌ ' + quoi + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } };
const entree = path.join(DOSSIER, 'entree.jsx');
fs.writeFileSync(entree, `import React from 'react'; import { createRoot } from 'react-dom/client';
import GrilleInventaire from ${JSON.stringify(path.join(RACINE, 'src/natif/visuel/GrilleInventaire.jsx'))};
const items = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }];
function Page() { const [h, setH] = React.useState(3000); window.__retrecir = () => setH(40);
  return <div><div id="haut" style={{ height: h }}/><GrilleInventaire items={items} ligne={72} gap={0} cle={(x) => x.cle} rendu={(x) => <div data-rangee={x.cle} style={{ height: 72, background: '#ddd' }}>{x.cle}</div>}/></div>; }
createRoot(document.getElementById('r')).render(<Page/>);`);
esbuild.buildSync({ entryPoints: [entree], bundle: true, outfile: path.join(DOSSIER, 'b.js'), loader: { '.jsx': 'jsx', '.js': 'jsx', '.css': 'empty' }, jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [NM], logLevel: 'silent' });
(async () => {
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.setContent(`<!doctype html><html><body style="margin:0"><div id="r"></div><script>${fs.readFileSync(path.join(DOSSIER, 'b.js'), 'utf8')}</script></body></html>`);
  await p.waitForTimeout(300);
  const mesure = () => p.evaluate(() => { const g = document.querySelector('[data-inv-grille]'); const r = g.getBoundingClientRect();
    return { top: Math.round(r.top), h: Math.round(r.height), n: Number(g.getAttribute('data-inv-n')), montees: document.querySelectorAll('[data-rangee]').length,
      visibles: [...document.querySelectorAll('[data-rangee]')].filter((x) => { const q = x.getBoundingClientRect(); return q.bottom > 0 && q.top < innerHeight; }).length }; });
  const avant = await mesure();
  dit(avant.top > 844, `W1 avant : la grille est sous l'écran (haut ${avant.top} px)`, avant);
  await p.evaluate(() => window.__retrecir());
  await p.waitForTimeout(400);
  const apres = await mesure();
  dit(apres.montees === 3 && apres.visibles === 3, `W2 après le rétrécissement du bloc au-dessus (sans défilement) : ${apres.montees} rangée(s) montée(s) sur 3, ${apres.visibles} visible(s)`, apres);
  dit(apres.h === 216, `W3 hauteur réservée : ${apres.h} px (3 × 72)`, apres);
  await b.close();
  console.log(`\n${rouges ? '❌' : '✅'} grille-fenetre : ${verts} vert(s), ${rouges} rouge(s)`);
  process.exitCode = rouges ? 1 : 0;
})().catch((e) => { console.log('❌ ' + (e && e.message)); process.exitCode = 1; });
