// ════════════════════════════════════════════════════════════════════════════
//  LA LETTRE D'ABORD, L'ÉCRAN ENSUITE (28 nov., vitesse-fluide) — src/composants/saisieDifferee.jsx
//
//  Un écran LOURD (chaque rendu occupe le fil 150 ms, comme `Comptabilite` au téléphone ×4) porte une recherche :
//    1. chaque lettre tapée est dans le champ AVANT que l'écran ait fini de se calculer (la lettre est peinte d'abord) ;
//    2. au bout, l'écran a EXACTEMENT ce qui a été tapé (aucune lettre perdue, aucune remise en arrière) ;
//    3. l'écran qui change la valeur lui-même (« Effacer », une valeur bornée) l'emporte : champ contrôlé ;
//    4. sans écran (aucun onChange), le champ reste celui de l'écran.
//  Pour `ChampRecherche` (src/composants/ChampRecherche.jsx) et `InputDiffere` (Achats).
//  `MUTATION=1` : l'écran reçoit la lettre en mise à jour URGENTE (l'ancien chemin) ⇒ le contrôle 1 doit rougir.
//    node scripts/tests/saisie-differee-interface.cjs
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const { build } = require('esbuild'), { chromium } = require('playwright');
const MUT = process.env.MUTATION === '1';
(async () => {
  const root = path.resolve(__dirname, '../..');
  const js = await build({ stdin: { resolveDir: root, loader: 'jsx', contents: `
    import __vrmFrApp from './src/i18n/langues/fr.js'; import { ajouterSourceApp as __vrmSource } from './src/i18n/index.js'; __vrmSource(__vrmFrApp);
    import React from 'react'; import { createRoot } from 'react-dom/client';
    import { ChampRecherche } from './src/composants/ChampRecherche.jsx';
    import { InputDiffere } from './src/composants/saisieDifferee.jsx';
    const MUT = ${MUT ? 'true' : 'false'};
    const occuper = (ms) => { const t = performance.now(); while (performance.now() - t < ms) {} };
    function Morceau({ q, i }) { occuper(25); return <span data-m={i}>{q.length}</span>; }
    function Lourd({ q }) { return <p data-ecran-q={q}>{[0, 1, 2, 3, 4, 5].map((i) => <Morceau key={i} q={q} i={i}/>)}</p>; }
    function App() {
      const [a, setA] = React.useState(''); const [b, setB] = React.useState('');
      window.setA = setA; window.setB = setB;
      const borne = (v) => setB(String(v).slice(0, 6));
      return <div>
        {MUT ? <input data-champ="a" value={a} onChange={(e) => setA(e.target.value)}/> : <ChampRecherche valeur={a} onChange={setA} label="Chercher A" data-champ-a=""/>}
        <Lourd q={a}/>
        {MUT ? <input data-champ="b" value={b} onChange={(e) => borne(e.target.value)}/> : <InputDiffere data-champ="b" value={b} onValeur={borne}/>}
        <Lourd q={'b:' + b}/>
        <InputDiffere data-champ="c" value="fixe"/>
      </div>;
    }
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic', loader: { '.js': 'jsx', '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
  const nav = await chromium.launch({ executablePath: process.env.VRM_CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  let n = 0, ko = 0; const ok = (v, m) => { if (v) { n++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m); } };
  try {
    const p = await nav.newPage({ viewport: { width: 390, height: 700 } });
    await p.setContent('<div id="root"></div>'); await p.addScriptTag({ content: js.outputFiles[0].text });
    for (const [nom, sel, ecran, attendu] of [['ChampRecherche', MUT ? '[data-champ="a"]' : '[data-champ-a] input', 'a', 'nike air'], ['InputDiffere', '[data-champ="b"]', 'b', 'nike a']]) {
      const champ = p.locator(sel); await champ.click();
      // 1. Chaque lettre : visible dans le champ au plus tard à l'image qui suit la frappe (mesuré DANS la page).
      const retards = [];
      for (const ch of 'nike air') {
        await p.evaluate(() => { window.__lettre = null; document.addEventListener('input', (ev) => { const el = ev.target; const t = ev.timeStamp; requestAnimationFrame(() => { window.__lettre = { ms: Math.round(performance.now() - t), vu: el.value }; }); }, { capture: true, once: true }); });
        await p.keyboard.type(ch);
        await p.waitForFunction(() => window.__lettre, null, { timeout: 10000 });
        retards.push({ ch, ...(await p.evaluate(() => window.__lettre)) });
        await p.waitForTimeout(60);
      }
      const prefixes = 'nike air'.split('').map((_, i) => 'nike air'.slice(0, i + 1));
      const bons = retards.filter((x, i) => (nom === 'InputDiffere' && i >= 6) || x.vu === prefixes[i]).length;
      // Lettre montrée dès l'image suivante : au plus 1 rendu lourd (150 ms) ne la sépare de la frappe.
      const lentes = retards.filter((x) => x.ms > 120).length;
      ok(lentes <= 1, `${nom} : chaque lettre peinte sans attendre l'écran (${retards.map((x) => x.ms).join('/')} ms par lettre ; > 120 ms : ${lentes})`);
      ok(bons === retards.length, `${nom} : le champ montre ce qui est tapé, lettre après lettre (${retards.map((x) => JSON.stringify(x.vu)).join(' ')})`);
      // 2. Au bout : l'écran a exactement ce qui a été tapé.
      await p.waitForFunction(([e, v]) => { const x = document.querySelector('[data-ecran-q="' + (e === 'b' ? 'b:' : '') + v + '"]'); return !!x; }, [ecran, attendu], { timeout: 10000 }).catch(() => {});
      const fin = await p.evaluate(([sel, e]) => ({ champ: document.querySelector(sel).value, ecran: [...document.querySelectorAll('[data-ecran-q]')].map((x) => x.getAttribute('data-ecran-q')).filter((x) => (e === 'b') === x.startsWith('b:'))[0] }), [sel, ecran]);
      ok(fin.champ === attendu && fin.ecran === (ecran === 'b' ? 'b:' : '') + attendu, `${nom} : au bout, le champ et l'écran disent « ${attendu} » (${JSON.stringify(fin)})`);
      // 3. L'écran change la valeur lui-même (« Effacer » de l'écran) : le champ suit.
      await p.evaluate((e) => (e === 'b' ? window.setB : window.setA)(''), ecran);
      await p.waitForFunction((sel) => document.querySelector(sel).value === '', sel, { timeout: 5000 }).catch(() => {});
      ok(await p.locator(sel).inputValue() === '', `${nom} : l'écran vide le champ ⇒ le champ est vide`);
    }
    // 4. Sans onValeur : la valeur de l'écran reste.
    if (!MUT) { await p.locator('[data-champ="c"]').click(); await p.keyboard.type('xyz'); await p.waitForTimeout(300); ok(await p.locator('[data-champ="c"]').inputValue() === 'fixe', 'sans onValeur, le champ garde la valeur de l\'écran (champ contrôlé)'); }
  } finally { await nav.close(); }
  console.log(`${n} contrôles réussis, ${ko} en échec${MUT ? ' (MUTATION : rouge attendu)' : ''}`);
  if (ko) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exitCode = 1; });
