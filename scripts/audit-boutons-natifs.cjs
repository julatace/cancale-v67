// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES BOUTONS PASSENT PAR LE BOUTON NATIF (20 nov., chantier « boutons natifs »).
//
//  Julien, 20 nov. : « des boutons pas très beaux, pas fiables, améliore ça ». Le bouton de l'app est
//  `src/natif/Bouton.jsx` (plein · teinté · texte · destructif ; compact ; icône ; chargement ; indisponible AVEC sa raison).
//  Ce que l'audit tient (chaque règle a sa mutation, `--mutation` les joue toutes et chacune doit rougir) :
//    A. les fichiers PROPRES (écrans natifs et relais) n'ont AUCUN `<button` brut ni classe de bouton d'avant
//       (.sb-btn-plein, .sb-touche, .sb-rond, .sb-lien, .vrm-b-*, .vrm-btn, .v2b) — sauf les EXCEPTIONS nommées ;
//    B. les RELAIS d'avant dessinent le bouton natif : `BoutonBase` (tous les `<Bouton>` et `Btn` des anciens écrans),
//       `Btn`, `BoutonV2`, `BoutonIconeV2`, l'icône de `BarreOutils` — aucun `<button` dans leur corps ;
//    C. la FIABILITÉ est dans le bouton : un geste à la fois (garde SYNCHRONE avant le rendu), la promesse tient
//       « en cours », son résultat est dit ; le dessin natif est posé partout sans `!important` ;
//    D. dans les fichiers propres, un `<Bouton … indisponible>` porte sa `raison` (jamais un gris muet) ;
//    E. ailleurs (les grands écrans d'avant, convertis au fil des lots), le nombre de `<button` bruts et de classes
//       d'avant NE MONTE PAS (plafonds ci-dessous : on les baisse quand un lot en retire, jamais l'inverse) ;
//    F. EXÉCUTÉ dans Chromium (esbuild + React) : double toucher sur un geste qui rend une promesse ⇒ UN appel, « en
//       cours » pendant, la phrase rendue affichée ; un échec dit sa raison ; un indisponible ne part pas et dit pourquoi.
//  `node scripts/audit-boutons-natifs.cjs` · `--mutation` · `--sans-navigateur` (A–E seulement).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, (m, a) => a + ' '.repeat(m.length - a.length));

const ANCIENNES = /\b(sb-btn-plein|sb-touche|sb-rond|sb-lien|vrm-b-(?:primaire|secondaire|discret|danger|petit|plein|icone)|vrm-btn|v2b(?:-[a-z]+)?)\b/;

// A. Les fichiers propres et leurs exceptions — [fichier, motif de la ligne, pourquoi].
const PROPRES = [
  'src/natif/ecrans/Aujourdhui.jsx', 'src/natif/ecrans/Annonces.jsx', 'src/natif/ecrans/AnnoncesTableau.jsx', 'src/natif/ecrans/Ventes.jsx',
  'src/natif/ecrans/VentesTableau.jsx', 'src/natif/ecrans/AchatsTableau.jsx', 'src/natif/ecrans/NotificationsTableau.jsx',
  'src/natif/ecrans/Automatisations.jsx', 'src/natif/ecrans/Fiche.jsx',
  'src/composants/Bouton.jsx', 'src/designV2/BoutonV2.jsx', 'src/ui/BarreOutils.jsx', 'src/designV2/PassesRetrait.jsx', 'src/ecrans/FilsTous.jsx',
  'src/PrixPartout.jsx', 'src/ecrans/PublierAgent.jsx', 'src/extension/EcranExtension.jsx',
];
const EXCEPTIONS = [
  ['src/natif/ecrans/AchatsTableau.jsx', /className="n-eg-cellule n-tt-code"/, 'une CELLULE du tableau (le code de retrait) : la cellule entière se touche, comme une rangée'],
  ['src/natif/ecrans/Annonces.jsx', /className="n-eg-cellule"/, 'une CELLULE du tableau à égalité (prix mini, achat, N°) : elle se change en la touchant'],
  ['src/natif/ecrans/AnnoncesTableau.jsx', /className="n-eg-cellule"/, 'une CELLULE du tableau (prix mini, achat) : elle se change en la touchant'],
  ['src/natif/ecrans/AnnoncesTableau.jsx', /className="n-tt-bouton" data-tt-automatisations/, 'un outil de la barre du TABLEAU DE TRAVAIL : même dessin que ses voisins (.n-tt-bouton, src/natif/tableau.css)'],
  ['src/natif/ecrans/Aujourdhui.jsx', /className="n-ajout-carte"/, 'la CARTE vide « + Ajouter une carte » (mode Modifier) : une carte, pas un bouton'],
  ['src/natif/ecrans/Fiche.jsx', /className="nf-(prix|pastille|val-touche)"/, 'un FAIT de la fiche (prix, pastille, valeur) : il se change en le touchant (NATIF.md §3, `Faits`)'],
  ['src/natif/ecrans/Fiche.jsx', /className="nf-(photo|point|miniature)"/, 'la PHOTO de la fiche, ses points et miniatures : on touche l\'image'],
  ['src/natif/ecrans/Fiche.jsx', /className="nf-choisir"/, '« Choisir une action ▾ » : un MENU (il ouvre la feuille des gestes), dessiné comme le champ d\'un choix'],
  ['src/composants/Bouton.jsx', /className="vrm-seg-btn"/, 'SegmenteBase : un SEGMENT (aria-pressed), pas un bouton — la conversion vers le Segmente natif est un autre lot'],
  ['src/designV2/BoutonV2.jsx', /className=\{'v2-rangee /, 'RangeeTouchable : une RANGÉE entière qui se touche'],
  ['src/designV2/BoutonV2.jsx', /v2-seg|SegmentV2|role="radio"/, 'SegmentV2 : un SEGMENT'],
  ['src/designV2/BoutonV2.jsx', /'principal', 'secondaire', 'texte', 'destructif'|VERS_NATIF|data-v2b/, 'les noms de rôle et les data-v2b que les bancs lisent (pas une classe de dessin)'],
  ['src/designV2/PassesRetrait.jsx', /data-v2b': 'texte'|\(Un <div role="button">/, 'data-v2b lu par les bancs ; le commentaire qui dit pourquoi la ligne est un div'],
  ['src/ecrans/FilsTous.jsx', /className=\{'vg-fil'/, 'une CONVERSATION de la liste : la rangée entière se touche'],
];

// E. Les plafonds (mesurés le 20 nov. après ce lot ; un lot qui en retire BAISSE le chiffre ici).
const PLAFONDS = {
  'src/App.jsx': { brut: 503, ancien: null },
  'src/ecrans/Reglages.jsx': { brut: 84, ancien: null },
  'src/ecrans/Stock.jsx': { brut: 66, ancien: null },
  'src/ecrans/Compta.jsx': { brut: 61, ancien: null },
  'src/ecrans/Achats.jsx': { brut: 11, ancien: null },
  'src/ecrans/Stats.jsx': { brut: 8, ancien: null },
  'src/ecrans/Leboncoin.jsx': { brut: 38, ancien: null },
  'src/ecrans/Vestiaire.jsx': { brut: 17, ancien: null },
  'src/ecrans/Republier.jsx': { brut: 34, ancien: null },
  'src/completer/Completer.jsx': { brut: 2, ancien: null },
  'src/LiaisonSites.jsx': { brut: 1, ancien: null },
  'src/LiaisonEntree.jsx': { brut: 3, ancien: null },
};
const compter = (src) => { const s = sansCommentaires(src); return { brut: (s.match(/<button\b/g) || []).length, ancien: s.split('\n').filter((l) => ANCIENNES.test(l)).length }; };

function auditer(srcs) {
  const def = [];
  // A
  for (const f of PROPRES) {
    const s = sansCommentaires(srcs[f] || '');
    s.split('\n').forEach((l, i) => {
      const brut = /<button\b/.test(l), ancien = ANCIENNES.test(l);
      if (!brut && !ancien) return;
      if (EXCEPTIONS.some(([ef, re]) => ef === f && re.test(l))) return;
      def.push(`A ${f}:${i + 1} ${brut ? '<button brut' : 'classe d\'avant ' + (l.match(ANCIENNES) || [])[0]} — ${l.trim().slice(0, 120)}`);
    });
  }
  // B
  const corps = (src, debut) => { const i = src.indexOf(debut); if (i < 0) return null; const j = src.indexOf('\n}', i); return src.slice(i, j + 2); };
  const relais = [
    ['src/composants/Bouton.jsx', 'export function BoutonBase(', /<Bouton\b/],
    ['src/App.jsx', 'function Btn(', /<Bouton\b/],
    ['src/designV2/BoutonV2.jsx', 'export function BoutonV2(', /<Bouton\b/],
    ['src/designV2/BoutonV2.jsx', 'export function BoutonIconeV2(', /<BoutonIcone\b/],
    ['src/ui/BarreOutils.jsx', 'export function BoutonIcone(', /<BoutonIconeNatif\b/],
  ];
  for (const [f, d, doit] of relais) {
    const c = corps(sansCommentaires(srcs[f] || ''), d);
    if (!c) { def.push(`B ${f} : ${d} introuvable`); continue; }
    if (/<button\b/.test(c)) def.push(`B ${f} : ${d} rend encore un <button> brut`);
    if (!doit.test(c)) def.push(`B ${f} : ${d} ne passe pas par le bouton natif`);
  }
  // C
  const b = sansCommentaires(srcs['src/natif/Bouton.jsx'] || '');
  const geste = corps(b, 'export function useGesteUnique(') || '';
  if (!/if \(enCoursRef\.current\) \{[^}]*return; \}/.test(geste)) def.push('C Bouton : pas de garde SYNCHRONE (enCoursRef) — un double toucher lancerait deux gestes');
  if (!/enCoursRef\.current = true; setEnCours\(true\)/.test(geste)) def.push('C Bouton : la promesse ne tient pas « en cours »');
  if (!/setResultat\(\{ ton: 'echec'/.test(geste) || !/setResultat\(\{ ton: 'ok'/.test(geste)) def.push('C Bouton : le résultat (réussi / raté) n\'est pas dit');
  const corpsBouton = corps(b, 'export function Bouton(') || '';
  if (!/geste\.lancer\(onClick, e\)/.test(corpsBouton)) def.push('C Bouton : le toucher n\'appelle pas le geste gardé');
  if (!/indisponible && raison \? <span className="n-bouton-raison"/.test(corpsBouton)) def.push('C Bouton : la raison d\'un indisponible n\'est pas affichée');
  for (const css of ['src/natif/natif.css']) for (const l of sansCommentaires(srcs[css] || '').split('\n')) if (/\.n-bouton/.test(l) && /!important/.test(l)) def.push(`C ${css} : un !important sur le bouton natif — ${l.trim().slice(0, 90)}`);
  const pont = srcs['src/coque-native.css'] || '';
  const regle = (pont.match(/:is\(#vrm-contenu, html\) :is\(\.n-bouton, \.n-bouton-icone-seule[^{]*\{([^}]*)\}/) || [])[1] || '';
  if (!/background: revert-layer/.test(regle) || !/font: revert-layer/.test(regle) || !/border-radius: revert-layer/.test(regle)) def.push('C coque-native.css : le dessin natif n\'est pas rendu aux couches dans les anciens écrans (le bouton natif y serait repeint)');
  if (/!important/.test(regle)) def.push('C coque-native.css : un !important dans la règle des boutons natifs');
  // D
  for (const f of PROPRES) {
    const s = sansCommentaires(srcs[f] || '');
    for (let i = s.indexOf('<Bouton '); i >= 0; i = s.indexOf('<Bouton ', i + 1)) {
      let p = 0, k = i;
      for (; k < s.length; k++) { const c = s[k]; if (c === '{') p++; else if (c === '}') p--; else if (c === '>' && p === 0 && s[k - 1] !== '=') break; }
      const el = s.slice(i, k);
      if (/\bindisponible\b(?!=\{false\})/.test(el) && !/\braison=/.test(el)) def.push(`D ${f} : un <Bouton indisponible> sans raison — ${el.slice(0, 120)}`);
      if (/raison=\{[^}]*\? '' : ''\}/.test(el)) def.push(`D ${f} : une raison toujours vide — ${el.slice(0, 120)}`);
    }
  }
  // E
  for (const [f, pl] of Object.entries(PLAFONDS)) {
    if (srcs[f] == null) continue;
    const n = compter(srcs[f]);
    if (n.brut > pl.brut) def.push(`E ${f} : ${n.brut} <button> bruts (plafond ${pl.brut}) — passe le nouveau par <Bouton> natif`);
  }
  return def;
}

// F. Exécuté : le vrai Bouton, monté dans Chromium.
async function executer(boutonSrc) {
  const NM = path.join(RACINE, 'node_modules');
  const { chromium } = require(path.join(NM, 'playwright'));
  const esbuild = require(path.join(NM, 'esbuild'));
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-boutons-'));
  fs.mkdirSync(path.join(d, 'natif'), { recursive: true });
  fs.writeFileSync(path.join(d, 'natif', 'Bouton.jsx'), boutonSrc);
  fs.copyFileSync(path.join(RACINE, 'src', 'natif', 'outils.js'), path.join(d, 'natif', 'outils.js'));
  fs.writeFileSync(path.join(d, 'i18n.js'), "export const tr = (k) => ({ 'natif.bouton.echec': 'ECHEC_PAR_DEFAUT', 'natif.bouton.confirmer': 'CONFIRMER' }[k] || k);");
  const boutonPatch = fs.readFileSync(path.join(d, 'natif', 'Bouton.jsx'), 'utf8').replace(/from '\.\.\/i18n\/index\.js'/, "from '../i18n.js'");
  fs.writeFileSync(path.join(d, 'natif', 'Bouton.jsx'), boutonPatch);
  fs.writeFileSync(path.join(d, 'entree.jsx'), `
import React from 'react'; import { createRoot } from 'react-dom/client'; import { Bouton } from './natif/Bouton.jsx';
window.appels = { a: 0, b: 0, c: 0 }; window.finir = null;
function Banc() {
  return <div>
    <Bouton attrs={{ id: 'a' }} onClick={() => { window.appels.a++; return new Promise((ok) => { window.finir = () => ok('Imprimé : 3 bordereaux'); }); }}>A</Bouton>
    <Bouton attrs={{ id: 'b' }} onClick={() => { window.appels.b++; return Promise.reject(new Error('Vinted a refusé (429).')); }}>B</Bouton>
    <Bouton attrs={{ id: 'c' }} indisponible raison="Aucun bordereau prêt." onClick={() => { window.appels.c++; }}>C</Bouton>
  </div>;
}
createRoot(document.getElementById('r')).render(<Banc/>);`);
  esbuild.buildSync({ entryPoints: [path.join(d, 'entree.jsx')], bundle: true, outfile: path.join(d, 'e.js'), loader: { '.jsx': 'jsx', '.js': 'jsx' }, jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, nodePaths: [NM], logLevel: 'error' });
  fs.writeFileSync(path.join(d, 'index.html'), '<!doctype html><meta charset="utf-8"><div id="r"></div><script src="e.js"></script>');
  const nav = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader'] });
  const def = [];
  try {
    const pg = await (await nav.newContext()).newPage();
    await pg.goto('file://' + path.join(d, 'index.html')); await pg.waitForSelector('#a');
    await pg.evaluate(() => { const a = document.getElementById('a'); a.click(); a.click(); });   // deux touchers dans la même image
    await pg.click('#a', { force: true }); await pg.waitForTimeout(50);
    const pendant = await pg.evaluate(() => ({ n: window.appels.a, busy: document.getElementById('a').getAttribute('aria-busy') }));
    if (pendant.n !== 1) def.push(`F double toucher : ${pendant.n} appels (attendu 1)`);
    if (pendant.busy !== 'true') def.push('F pendant le geste, le bouton ne dit pas « en cours » (aria-busy)');
    await pg.evaluate(() => window.finir && window.finir()); await pg.waitForTimeout(80);
    const apres = await pg.evaluate(() => ({ busy: document.getElementById('a').getAttribute('aria-busy'), dit: (document.querySelector('[data-n-resultat="ok"]') || {}).textContent || '' }));
    if (apres.busy === 'true') def.push('F le geste fini, le bouton reste « en cours »');
    if (!/Imprimé : 3 bordereaux/.test(apres.dit)) def.push('F le résultat rendu par le geste n\'est pas dit');
    await pg.click('#a'); await pg.waitForTimeout(30);
    if ((await pg.evaluate(() => window.appels.a)) !== 2) def.push('F après la fin, le bouton ne repart pas');
    await pg.click('#b'); await pg.waitForTimeout(80);
    const echec = await pg.evaluate(() => (document.querySelector('[data-n-resultat="echec"]') || {}).textContent || '');
    if (!/Vinted a refusé \(429\)\./.test(echec)) def.push('F un échec ne dit pas sa raison (« ' + echec + ' »)');
    await pg.click('#c', { force: true });
    const c = await pg.evaluate(() => ({ n: window.appels.c, raison: (document.querySelector('[data-n-raison]') || {}).textContent || '', desc: document.getElementById('c').getAttribute('aria-describedby') }));
    if (c.n !== 0) def.push('F un indisponible est parti');
    if (!/Aucun bordereau prêt\./.test(c.raison) || !c.desc) def.push('F un indisponible ne dit pas pourquoi');
  } finally { await nav.close(); fs.rmSync(d, { recursive: true, force: true }); }
  return def;
}

const FICHIERS = [...new Set([...PROPRES, ...Object.keys(PLAFONDS), 'src/natif/Bouton.jsx', 'src/natif/natif.css', 'src/coque-native.css', 'src/App.jsx', 'src/composants/Bouton.jsx', 'src/designV2/BoutonV2.jsx', 'src/ui/BarreOutils.jsx'])];
const charger = () => Object.fromEntries(FICHIERS.map((f) => { try { return [f, lire(f)]; } catch (_) { return [f, null]; } }));

const MUTATIONS = [
  ['A <button brut dans un écran natif', (s) => { s['src/natif/ecrans/Ventes.jsx'] += '\nconst X = () => <button type="button">x</button>;'; }],
  ['A classe d\'avant dans un écran natif', (s) => { s['src/natif/ecrans/Aujourdhui.jsx'] += '\nconst Y = () => <span className="sb-btn-plein"/>;'; }],
  ['B BoutonBase rend un <button>', (s) => { s['src/composants/Bouton.jsx'] = s['src/composants/Bouton.jsx'].replace('  return <Bouton variante={vn}', '  return <button className="vrm-b"/>; <Bouton variante={vn}'); }],
  ['B Btn ne passe plus par Bouton', (s) => { s['src/App.jsx'] = s['src/App.jsx'].replace('    <Bouton variante={primaire ? \'primaire\'', '    <button variante={primaire ? \'primaire\''); }],
  ['C garde synchrone retirée', (s) => { s['src/natif/Bouton.jsx'] = s['src/natif/Bouton.jsx'].replace('if (enCoursRef.current) {', 'if (false && enCoursRef.current) {'); }],
  ['C !important dans natif.css', (s) => { s['src/natif/natif.css'] += '\n.n-bouton { color: red !important; }'; }],
  ['C pont retiré', (s) => { s['src/coque-native.css'] = s['src/coque-native.css'].replace('background: revert-layer; color: revert-layer; font: revert-layer;', 'color: revert-layer;'); }],
  ['D indisponible muet', (s) => { s['src/natif/ecrans/Automatisations.jsx'] = s['src/natif/ecrans/Automatisations.jsx'].replace("raison={!it.modifie ? tr('auto.reinit.rien') : ''}", "raison={!it.modifie ? '' : ''}"); }],
  ['E plafond dépassé', (s) => { s['src/ecrans/Stock.jsx'] += '\nconst Z = () => <button type="button">z</button>;'; }],
];

(async () => {
  const mutation = process.argv.includes('--mutation');
  const sansNav = process.argv.includes('--sans-navigateur');
  const srcs = charger();
  const def = auditer(srcs);
  if (!sansNav) def.push(...await executer(srcs['src/natif/Bouton.jsx']));
  for (const d of def) console.log('❌ ' + d);
  // Les exceptions qui ne servent plus sont DITES (pour qu'on les retire), sans faire échouer.
  for (const [f, re, pq] of EXCEPTIONS) { const s = sansCommentaires(srcs[f] || ''); if (!s.split('\n').some((l) => re.test(l))) console.log(`ℹ️  exception inutile : ${f} ${re} (${pq.slice(0, 50)}…)`); }
  const tot = Object.fromEntries(Object.keys(PLAFONDS).filter((f) => srcs[f] != null).map((f) => [f, compter(srcs[f]).brut]));
  console.log(`· plafonds : ${Object.entries(tot).map(([f, n]) => `${path.basename(f)} ${n}/${PLAFONDS[f].brut}`).join(', ')}`);
  let rouge = def.length > 0;
  if (mutation) {
    for (const [nom, muter] of MUTATIONS) {
      const s = charger(); muter(s);
      const d = auditer(s);
      if (nom.startsWith('C garde') && !sansNav) d.push(...await executer(s['src/natif/Bouton.jsx']));
      console.log(`${d.length ? '✅' : '❌'} mutation « ${nom} » : ${d.length ? 'rougit (' + d[0].slice(0, 90) + ')' : 'NE ROUGIT PAS'}`);
      if (!d.length) rouge = true;
    }
  }
  console.log(rouge ? '❌ audit-boutons-natifs : défauts' : '✅ audit-boutons-natifs : tout est vert');
  process.exitCode = rouge ? 1 : 0;
})();
