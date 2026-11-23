require('./_porte-banc.cjs');
// ═════════════════════════════════════════════════════════════════════════════
//  BANC « CHAMP NOMBRE » (20 nov., chasse-bugs-2) — la saisie d'un nombre dans Automatisations
//  (`ChampNombre`, src/natif/ecrans/Automatisations.jsx), RENDUE et TAPÉE au clavier comme au doigt.
//  Mesuré : vider un palier de négociation posait 1 aussitôt (`Number('') || 1`) — impossible d'écrire « 5 »
//  seul (on obtenait « 15 ») ; un champ à minimum (≥ 5) ramenait « 1 » à 5 pendant qu'on tapait « 10 ».
//  Règle : la saisie est LIBRE, la validation se fait à la SORTIE du champ (blur / Entrée) ; ce qui sort du
//  champ est toujours dans [min, max] ; un champ qui n'admet pas le vide revient à sa valeur d'avant.
//  Le composant est empaqueté tel quel (esbuild) dans une page minimale, aucune donnée, aucun réseau.
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const R = path.join(__dirname, '..', '..');
const { chromium } = require('playwright');
const esbuild = require(path.join(R, 'node_modules', 'esbuild'));
let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d !== '' ? ' — ' + d : ''}`); };

(async () => {
  const D = fs.mkdtempSync(path.join(os.tmpdir(), 'banc-champ-nombre-'));
  const entree = path.join(D, 'entree.jsx');
  fs.writeFileSync(entree, `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChampNombre } from ${JSON.stringify(path.join(R, 'src', 'natif', 'ecrans', 'Automatisations.jsx'))};
function Banc() {
  const [paliers, setPaliers] = React.useState([100, 90]);
  const [mini, setMini] = React.useState('30');
  const [marge, setMarge] = React.useState('20');
  window.__etat = { paliers, mini, marge };
  return <div>
    <div id="p0"><ChampNombre valeur={String(paliers[0])} libelle="palier 1" unite="%" min={1} max={100} videPermis={false}
      onChange={(v) => setPaliers((l) => l.map((q, j) => (j === 0 ? (Number(v) || 1) : q)))}/></div>
    <div id="mini"><ChampNombre valeur={mini} libelle="mini" min={5} max={720} onChange={setMini}/></div>
    <div id="marge"><ChampNombre valeur={marge} libelle="marge" min={0} max={89} onChange={setMarge}/></div>
    <button id="ailleurs">ailleurs</button>
  </div>;
}
createRoot(document.getElementById('r')).render(<Banc/>);
`);
  await esbuild.build({ entryPoints: [entree], bundle: true, outfile: path.join(D, 'b.js'), jsx: 'automatic', loader: { '.js': 'jsx', '.css': 'empty', '.png': 'empty', '.svg': 'empty' },
    define: { 'process.env.NODE_ENV': '"development"', __BUILD__: '"banc"' }, nodePaths: [path.join(R, 'node_modules')], logLevel: 'error' });
  fs.writeFileSync(path.join(D, 'i.html'), '<!doctype html><meta charset="utf-8"><div id="r"></div><script src="b.js"></script>');
  const nav = await chromium.launch({ executablePath: process.env.BANC_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--no-proxy-server'] });
  try {
    for (const vp of [{ width: 390, height: 844, isMobile: true, hasTouch: true }, { width: 1512, height: 950 }]) {
      const T = vp.width < 600 ? '390' : '1512';
      const ctx = await nav.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
      const pg = await ctx.newPage();
      const erreurs = []; pg.on('pageerror', (e) => erreurs.push(String(e))); pg.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
      await pg.goto('file://' + path.join(D, 'i.html'));
      const champ = (id) => pg.locator(`#${id} input`);
      const etat = () => pg.evaluate(() => window.__etat);
      // 1) Palier : vider puis taper 5 ⇒ 5 (jamais 15), le champ montre 5 pendant la saisie.
      await champ('p0').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Backspace');
      dit(await champ('p0').inputValue() === '', `[${T}] palier vidé : le champ reste vide pendant la saisie`, await champ('p0').inputValue());
      await pg.keyboard.type('5');
      dit(await champ('p0').inputValue() === '5', `[${T}] palier : « 5 » tapé après l'avoir vidé se lit 5 (jamais 15)`, await champ('p0').inputValue());
      await champ('p0').press('Tab');
      dit((await etat()).paliers[0] === 5, `[${T}] palier : 5 enregistré à la sortie du champ`, JSON.stringify((await etat()).paliers));
      // 2) Palier vidé puis quitté ⇒ revient à sa valeur d'avant (le vide n'est pas permis), jamais 1.
      await champ('p0').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Backspace'); await champ('p0').press('Tab');
      dit(await champ('p0').inputValue() === '5' && (await etat()).paliers[0] === 5, `[${T}] palier vidé puis quitté : il revient à 5 (jamais 1)`, `${await champ('p0').inputValue()} · ${JSON.stringify((await etat()).paliers)}`);
      // 3) Champ à minimum 5 : taper « 10 » passe par « 1 » sans être ramené à 5.
      await champ('mini').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.type('10');
      dit(await champ('mini').inputValue() === '10', `[${T}] minimum 5 : « 10 » se tape (« 1 » n'est pas ramené à 5 en route)`, await champ('mini').inputValue());
      await pg.locator('#ailleurs').click();
      dit((await etat()).mini === '10', `[${T}] minimum 5 : 10 enregistré`, (await etat()).mini);
      // 4) Hors bornes à la sortie : ramené dans [min, max], dit dans le champ.
      await champ('mini').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.type('2'); await pg.keyboard.press('Enter'); await pg.locator('#ailleurs').click();
      dit(await champ('mini').inputValue() === '5' && (await etat()).mini === '5', `[${T}] « 2 » sous le minimum : ramené à 5 à la sortie`, `${await champ('mini').inputValue()} · ${(await etat()).mini}`);
      await champ('marge').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.type('95'); await pg.locator('#ailleurs').click();
      dit(await champ('marge').inputValue() === '89' && (await etat()).marge === '89', `[${T}] « 95 » au-dessus du maximum : ramené à 89 à la sortie`, `${await champ('marge').inputValue()} · ${(await etat()).marge}`);
      // 5) Un champ qui admet le vide (marge : « aucune ») le garde.
      await champ('marge').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.press('Backspace'); await pg.locator('#ailleurs').click();
      dit((await etat()).marge === '' && await champ('marge').inputValue() === '', `[${T}] marge vidée : « aucune » gardé (le vide est permis ici)`, JSON.stringify((await etat()).marge));
      // 6) Lettres ignorées ; une valeur changée ailleurs se relit dans le champ.
      await champ('mini').click(); await pg.keyboard.press('Control+a'); await pg.keyboard.type('1a2'); await pg.locator('#ailleurs').click();
      dit(await champ('mini').inputValue() === '12' && (await etat()).mini === '12', `[${T}] lettres ignorées (« 1a2 » ⇒ 12)`, await champ('mini').inputValue());
      dit(!erreurs.length, `[${T}] aucune erreur console`, erreurs.join(' ¦ '));
      await ctx.close();
    }
  } finally { await nav.close(); try { fs.rmSync(D, { recursive: true, force: true }); } catch (_) {} }
  console.log(`\n${ok} OK · ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ le banc a pu jouer — ' + (e && e.message)); process.exit(1); });
