// (24 nov., vitesse) LA RANGÉE D'ANNONCES NE SE RE-REND QUE SI CE QU'ELLE MONTRE CHANGE — `RangeeArticleMemo`
// (src/natif/ecrans/AnnoncesCartes.jsx). Récit : docs/passation/2026-11-24-vitesse.md. EXÉCUTE le vrai composant (esbuild,
// React de développement pour compter les rendus par <Profiler>) dans Chromium.
//   node scripts/tests/rangees-gardees-interface.cjs        ·  MUTATION=1 ⇒ comparaison toujours fausse (rouge attendu)
// Juge :
//   1. un paquet de rangées en plus (l'écran se re-rend, fonctions neuves) : AUCUNE rangée déjà posée ne se re-rend ;
//   2. un article neuf (autre objet) ⇒ SA rangée se re-rend, et elle seule ; une coche ⇒ sa rangée seule ;
//   3. le texte rendu est le même que celui de la rangée sans mémoire (`RangeeArticle`).
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { build } = require(path.join(root, 'node_modules', 'esbuild'));
const { chromium } = require(path.join(root, 'node_modules', 'playwright'));
(async () => {
  const bundle = await build({
    stdin: { resolveDir: root, loader: 'jsx', contents: `
import fr from './src/i18n/langues/fr.js'; import { ajouterSourceApp } from './src/i18n/index.js'; ajouterSourceApp(fr);
import React from 'react'; import { createRoot } from 'react-dom/client'; import { RangeeArticle, RangeeArticleMemo, rangeeArticleEgale } from './src/natif/ecrans/AnnoncesCartes.jsx';
const Rangee = ${process.env.MUTATION ? 'React.memo(RangeeArticle, () => false)' : 'RangeeArticleMemo'};
const art = (i) => ({ cle: 'a' + i, titre: 'Nike Air Max taille ' + (36 + i % 10), sites: ['vinted'], annonces: [{ site: 'vinted', etat: 'enligne' }], etat: 'enligne', prix: 20 + i, numero: String(100 + i), depuis: 3, favoris: i % 4, vues: 10 + i });
window.arts = Array.from({ length: 160 }, (_, i) => art(i)); window.rendus = {};
// Les rendus comptés par l'icône (même composant à chaque rendu) : une rangée rendue dessine son ♥ et son œil, une rangée
// gardée ne dessine rien. La rangée est retrouvée par le contexte de sa clé.
const Cle = React.createContext('');
function Icon({ name }) { const k = React.useContext(Cle); window.rendus[k] = (window.rendus[k] || 0) + 1; return <i data-i={name}/>; }
const ouvrir = () => {}, gestes = () => {};
function Liste({ n, coches, sans }) {
  const R = sans ? RangeeArticle : Rangee;
  return <div>{window.arts.slice(0, n).map((a) => <Cle.Provider key={a.cle} value={a.cle}>
    <R a={a} forme="a" onOuvrir={ouvrir} onGestes={(x) => gestes(x)} euros={(v) => v + ' €'} depuisTexte={(ms) => ms + ' j'} nomSite={(s) => s}
      selection={coches ? { cochee: coches.has(a.cle), cochable: true, onBascule: () => {} } : null} Icon={Icon} attrs={{ 'data-eg-article': a.cle, 'data-eg-numero': a.numero }}/></Cle.Provider>)}</div>;
}
const r = createRoot(document.getElementById('root'));
window.poser = (p) => { window.rendus = {}; r.render(<Liste {...p}/>); };
window.art = art; window.egale = rangeeArticleEgale;
` },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', outdir: '/tmp/rangees-gardees', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"' },
  });
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox'] });
  let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; console.log('  ✅ ' + m); };
  try {
    const p = await nav.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
    await p.setContent('<div id="root"></div>');
    await p.addScriptTag({ content: bundle.outputFiles.find((x) => x.path.endsWith('.js')).text });
    const poser = async (props) => { await p.evaluate((props) => { if (props.coches) props.coches = new Set(props.coches); window.poser(props); }, props); await p.waitForTimeout(150); return p.evaluate(() => window.rendus); };
    await poser({ n: 120 });
    const r1 = await poser({ n: 144 });
    const anciennes = Object.keys(r1).filter((k) => +k.slice(1) < 120);
    ok(anciennes.length === 0 && Object.keys(r1).length === 24, `1. 24 rangées de plus : seules les 24 neuves se rendent (${Object.keys(r1).length} rendues, dont ${anciennes.length} anciennes)`);
    await p.evaluate(() => { window.arts[5] = window.art(5); window.arts[5].prix = 999; });
    const r2 = await poser({ n: 144 });
    ok(JSON.stringify(Object.keys(r2)) === '["a5"]', `2. un article neuf : sa rangée seule (${Object.keys(r2).join(',')})`);
    ok(/999/.test(await p.textContent('[data-eg-article="a5"]')), '2. et elle montre son nouveau prix');
    await poser({ n: 144, coches: [] });
    const r3 = await poser({ n: 144, coches: ['a7'] });
    ok(JSON.stringify(Object.keys(r3)) === '["a7"]', `2. une coche : sa rangée seule (${Object.keys(r3).join(',')})`);
    const texte = await p.evaluate(() => document.getElementById('root').innerHTML);
    await poser({ n: 144, coches: ['a7'], sans: true }); await p.waitForTimeout(100);
    ok(texte === await p.evaluate(() => document.getElementById('root').innerHTML), '3. même rendu que la rangée sans mémoire');
    ok(!err.length, 'aucune erreur de page ' + err.join(' | '));
  } catch (e) { console.log('  ❌ ' + e.message.split('\n')[0]); process.exitCode = 1; }
  finally { await nav.close(); }
  console.log(process.exitCode ? `rangees-gardees : ROUGE (${n} verts avant l'échec)` : `rangees-gardees : ${n} verts`);
})();
