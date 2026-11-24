#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « AUCUN ORANGE DANS LES SOURCES » (24 nov., lot sauts-orange)
//  Récit : docs/passation/2026-11-24-sauts-orange.md
//
//  Décision de Julien du 23 nov. (passation générale §3) : gris clair étagé, accent ardoise, AUCUN orange ni
//  ambre, le jour et la nuit ; « à faire » = gras + accent ; le rouge au seul doublon de N°. Le 24 nov. il restait
//  ~650 couleurs orange écrites à la main dans les feuilles des écrans d'hier : un écran pas rendu par un banc les
//  gardait. Cet audit lit CHAQUE feuille et CHAQUE source de src/ et public/ (css, js, jsx, mjs, html) et refuse tout littéral orange
//  ou ambre (#rgb, #rrggbb, #rrggbbaa, rgb()/rgba() ; règle : scripts/_couleurs-orange.cjs), hors commentaires.
//  « À faire » s'écrit avec les jetons : var(--n-ambre) (l'ardoise le jour, l'encre claire la nuit), --n-ambre-fond,
//  --n-ambre-bord, --n-sur-ambre (src/natif/jetons.css).
//
//  Seules exceptions, NOMMÉES là où elles sont : une MARQUE (logo d'un transporteur, d'un site, de Google), un objet
//  réel dessiné (bois et carton du stock 3D), une couleur choisie PAR LUI (sa facture, un visuel, la couleur d'une
//  paire). Le marqueur `orange-permis : <raison>` sur la ligne (ou la ligne d'avant), ou `orange-permis-fichier :
//  <raison>` dans les 3 premières lignes du fichier. Un marqueur sans raison ne vaut rien.
//
//  `--liste` : chaque littéral refusé (fichier:ligne). Le banc rendu est scripts/bancs/sans-orange.cjs.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const R = require('./_couleurs-orange.cjs');
const RACINE = path.join(__dirname, '..');
const LISTE = process.argv.includes('--liste');

function* fichiers(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) { if (!/^(node_modules|dist)$/.test(f.name)) yield* fichiers(p); }
    else if (/\.(css|jsx?|mjs|html)$/.test(f.name)) yield p;
  }
}
// Retire les commentaires en gardant les lignes (les numéros restent justes). JS : `//` en début de ligne ou après
// un blanc (jamais « https:// ») ; CSS et JS : /* … */ ; JSX : {/* … */} est un /* … */.
const sansCommentaires = (src, css) => {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  if (!css) s = s.split('\n').map((l) => l.replace(/(^|[\s;,{}()])\/\/.*$/, '$1')).join('\n');
  return s;
};
const MARQUEUR = /orange-permis\s*:\s*\S.{8,}/;
const MARQUEUR_FICHIER = /orange-permis-fichier\s*:\s*\S.{8,}/;

const refus = [];
let nFichiers = 0, nPermis = 0, nFichiersPermis = 0;
for (const f of [...fichiers(path.join(RACINE, 'src')), ...fichiers(path.join(RACINE, 'public'))]) {
  nFichiers++;
  const rel = path.relative(RACINE, f);
  const src = fs.readFileSync(f, 'utf8');
  const brut = src.split('\n');
  if (brut.slice(0, 3).some((l) => MARQUEUR_FICHIER.test(l))) { nFichiersPermis++; continue; }
  const lignes = sansCommentaires(src, /\.(css|html)$/.test(f)).split('\n');
  lignes.forEach((l, i) => {
    R.RE_COULEUR.lastIndex = 0; let m;
    while ((m = R.RE_COULEUR.exec(l))) {
      if (!R.estOrange(R.lire(m[0]))) continue;
      if (MARQUEUR.test(brut[i]) || (i > 0 && MARQUEUR.test(brut[i - 1]))) { nPermis++; continue; }
      refus.push(`${rel}:${i + 1}  ${m[0]}  ${brut[i].trim().slice(0, 110)}`);
    }
  });
}

// La règle elle-même : elle DOIT reconnaître l'orange d'hier et laisser le rouge du doublon, l'ardoise, l'encre.
const temoins = [['#B25000', true], ['#FFC266', true], ['#FFF4E5', true], ['rgba(255,149,0,.16)', true], ['rgb(255 196 0 / .12)', true], ['#E08A12', true], ['#764300', true], ['#AD9658', true],
  ['#BF2A21', false], ['#FF7A6E', false], ['#3D4B5B', false], ['#F4F4F5', false], ['#1D1D1F', false], ['#DFE1E5', false], ['rgba(255,149,0,.05)', false], ['#9A846C', false], ['#2A2116', false]];
const regleOk = temoins.every(([t, o]) => { R.RE_COULEUR.lastIndex = 0; const m = R.RE_COULEUR.exec(t); return m && m[0] === t && R.estOrange(R.lire(t)) === o; });

console.log(`\n${regleOk ? '✅' : '❌'} la règle reconnaît l'orange d'hier (#B25000, #FFC266, #FFF4E5…) et laisse le rouge du doublon, l'ardoise, l'encre`);
console.log(`${refus.length ? '❌' : '✅'} aucun orange ni ambre écrit dans src/ ni public/ (${nFichiers} fichiers lus ; ${nPermis} marque(s) nommée(s) sur leur ligne, ${nFichiersPermis} fichier(s) de marques)`);
if (refus.length) { console.log(`   ${refus.length} littéral(aux) refusé(s)${LISTE ? '' : ' — `--liste` pour tous'} :`); for (const r of refus.slice(0, LISTE ? 1e9 : 25)) console.log('   · ' + r); }
if (!regleOk || refus.length) process.exitCode = 1;
