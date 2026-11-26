// (24 nov., vitesse) LA LETTRE D'ABORD, LA LISTE APRÈS — le champ de recherche natif (src/natif/Page.jsx `ChampRecherche`).
// Récit : docs/passation/2026-11-24-vitesse.md. EXÉCUTE le vrai composant dans Chromium (esbuild), sous un écran LOURD.
//   node scripts/tests/recherche-lettre-interface.cjs            ⇒ la règle d'aujourd'hui (verte)
//   PAGE=<chemin d'un autre Page.jsx> node …                     ⇒ un autre code (celui d'avant : rouge — preuve que le contrôle voit)
// Juge la RÈGLE, pas un temps :
//   0. la 1re lettre va à l'écran pendant le geste (comme avant) et APPREND qu'il est lourd (rendu > 50 ms) ;
//   1. sur un écran lourd, une lettre tapée est DANS le champ sans que l'écran soit appelé pendant le geste ;
//   2. l'écran reçoit la valeur ensuite, une fois ; des lettres tapées d'un coup lui arrivent ENSEMBLE (la dernière seule) ;
//   3. une valeur posée par l'écran (effacée) remplace celle du champ ; la croix envoie '' tout de suite ; Entrée envoie
//      la valeur en attente avant `onEnvoyer` ; la sortie du champ envoie ce qui attend ;
//   4. le champ « porte » (`onOuvrir`) reste tel qu'avant (l'écran est appelé tout de suite) ;
//   5. un écran redevenu léger (rendu < 25 ms) reçoit de nouveau chaque lettre pendant le geste.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const { build } = require(path.join(root, 'node_modules', 'esbuild'));
const { chromium } = require(path.join(root, 'node_modules', 'playwright'));
const PAGE = path.resolve(process.env.PAGE || path.join(root, 'src/natif/Page.jsx'));
(async () => {
  // Un autre Page.jsx (code d'avant) est copié À CÔTÉ du vrai : mêmes imports relatifs.
  let page = './src/natif/Page.jsx', copie = null;
  if (PAGE !== path.join(root, 'src/natif/Page.jsx')) { copie = path.join(root, 'src/natif/.Page-essai.jsx'); fs.copyFileSync(PAGE, copie); page = './src/natif/.Page-essai.jsx'; }
  let bundle;
  try {
    bundle = await build({
      stdin: { resolveDir: root, loader: 'jsx', contents: `
import fr from './src/i18n/langues/fr.js'; import { ajouterSourceApp } from './src/i18n/index.js'; ajouterSourceApp(fr);
import React from 'react'; import { createRoot } from 'react-dom/client'; import { ChampRecherche } from '${page}';
window.appels = []; window.envois = []; window.lourd = 150;
function Ecran({ porte }) {
  const [q, setQ] = React.useState('');
  window.poser = setQ;
  const t0 = performance.now(); while (performance.now() - t0 < window.lourd) {}   // un écran qui coûte à rendre
  return <div><ChampRecherche valeur={q} onChange={(v) => { window.appels.push(v); setQ(v); }} onEnvoyer={(v) => window.envois.push(v)} onOuvrir={porte ? () => {} : null} placeholder="Chercher"/><p id="liste">{q}</p></div>;
}
const r = createRoot(document.getElementById('root')); window.monter = (porte) => r.render(<Ecran porte={porte}/>); window.monter(false);
` },
      bundle: true, write: false, format: 'iife', logLevel: 'silent', outdir: '/tmp/recherche-lettre', loader: { '.css': 'empty' },
    });
  } finally { if (copie) fs.rmSync(copie, { force: true }); }
  const nav = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--no-sandbox'] });
  let n = 0; const ok = (v, m) => { assert.ok(v, m); n++; console.log('  ✅ ' + m); };
  try {
    const p = await nav.newPage(); const err = []; p.on('pageerror', (e) => err.push(e.message));
    await p.setContent('<div id="root"></div>');
    await p.addScriptTag({ content: bundle.outputFiles.find((x) => x.path.endsWith('.js')).text });
    await p.waitForSelector('input[type=search]');
    const attendre = (ms) => p.waitForTimeout(ms);
    // Une lettre « tapée » comme le navigateur le fait : la valeur, puis l'événement `input`, dans UNE tâche.
    const taper = (vals) => p.evaluate((vals) => { const i = document.querySelector('input[type=search]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      const avant = window.appels.length; for (const v of vals) { set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); } return { pendant: window.appels.length - avant, champ: i.value }; }, vals);
    const r0 = await taper(['x']);
    ok(r0.pendant === 1, `0. la 1re lettre va à l'écran pendant le geste, comme avant (${r0.pendant})`);
    await attendre(300); await p.evaluate(() => { window.poser(''); }); await attendre(300); await p.evaluate(() => { window.appels = []; });
    const r1 = await taper(['s']);
    ok(r1.pendant === 0, `1. la lettre ne passe pas par l'écran pendant le geste (appels pendant le geste : ${r1.pendant})`);
    await p.waitForFunction(() => document.querySelector('input[type=search]').value === 's', null, { timeout: 2000 });
    ok(true, '1. la lettre est dans le champ');
    await attendre(600);
    ok(JSON.stringify(await p.evaluate(() => window.appels)) === '["s"]', `2. l'écran reçoit « s » ensuite, une fois (${JSON.stringify(await p.evaluate(() => window.appels))})`);
    await p.evaluate(() => { window.appels = []; });
    const r2 = await taper(['sa', 'sam', 'samb']);
    ok(r2.pendant === 0 && r2.champ === 'samb', '2. trois lettres d\'un coup : champ « samb », écran pas appelé pendant');
    await attendre(600);
    ok(JSON.stringify(await p.evaluate(() => window.appels)) === '["samb"]', `2. trois lettres d'un coup arrivent ENSEMBLE (${JSON.stringify(await p.evaluate(() => window.appels))})`);
    ok((await p.textContent('#liste')) === 'samb', '2. l\'écran montre « samb »');
    await p.evaluate(() => window.poser(''));
    await p.waitForFunction(() => document.querySelector('input[type=search]').value === '', null, { timeout: 2000 }).catch(() => {});
    ok((await p.inputValue('input[type=search]')) === '', '3. une valeur posée par l\'écran (effacée) remplace celle du champ');
    await taper(['nike']); await attendre(600); await p.evaluate(() => { window.appels = []; });
    await p.evaluate(() => { const b = document.querySelector('button.n-recherche-bouton'); if (b) b.click(); });
    ok(JSON.stringify(await p.evaluate(() => window.appels)) === '[""]', `3. la croix envoie '' tout de suite (${JSON.stringify(await p.evaluate(() => window.appels))})`);
    await p.evaluate(() => { window.appels = []; window.envois = []; });
    await p.evaluate(() => { const i = document.querySelector('input[type=search]'); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'vans'); i.dispatchEvent(new Event('input', { bubbles: true })); i.form.requestSubmit(); });
    ok(JSON.stringify(await p.evaluate(() => [window.appels, window.envois])) === '[["vans"],["vans"]]', `3. Entrée envoie la valeur en attente puis « onEnvoyer » (${JSON.stringify(await p.evaluate(() => [window.appels, window.envois]))})`);
    await p.evaluate(() => { window.appels = []; const i = document.querySelector('input[type=search]'); i.focus(); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(i, 'vansx'); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); });
    ok(JSON.stringify(await p.evaluate(() => window.appels)) === '["vansx"]', `3. la sortie du champ envoie ce qui attend (${JSON.stringify(await p.evaluate(() => window.appels))})`);
    await p.evaluate(() => { window.appels = []; window.lourd = 0; }); await attendre(200);
    await taper(['a']); await attendre(600);
    const r5 = await taper(['ab']);
    ok(r5.pendant === 1, `5. un écran redevenu léger reçoit la lettre pendant le geste (${r5.pendant}, appels ${JSON.stringify(await p.evaluate(() => window.appels))})`);
    await p.evaluate(() => { window.appels = []; window.monter(true); }); await attendre(400);
    const r3 = await taper(['x']);
    ok(r3.pendant === 1, `4. le champ « porte » appelle l'écran tout de suite, comme avant (${r3.pendant})`);
    ok(!err.length, 'aucune erreur de page ' + err.join(' | '));
  } catch (e) { console.log('  ❌ ' + e.message.split('\n')[0]); process.exitCode = 1; }
  finally { await nav.close(); }
  console.log(process.exitCode ? `recherche-lettre : ROUGE (${n} verts avant l'échec)` : `recherche-lettre : ${n} verts`);
})();
