#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LES RÈGLES DE L'APP DANS L'EXTENSION, SUR VINTED (11 nov., lot AA, ext. 5.339)
//  `vinted-sync-extension/vrm-regles-achat.js` est une COPIE REFABRIQUÉE PAR CE
//  SCRIPT — jamais modifiée à la main (CLAUDE.md §5 « une seule règle par
//  notion ») :
//   · la calculette d'achat (`calculer`, `eurosCalc`, `SITES_CALCULETTE` de
//     src/calculetteAchat.js → `cascadeVente`, src/coutVente.js) ;
//   · « déjà N paires de ce modèle » (`pairesDuModele`, src/dejaEnStock.js, lot F) ;
//   · (14 nov., 5.376) « dans ta liste de recherche » (`correspondances`, src/listeRecherche.js)
//     et « déjà achetée » (`achatsDeLAnnonce`, src/achatMemeAnnonce.js) ;
//   · la marque, le modèle, les couleurs (`extractBrand`, `extractModel`,
//     `extractColors` de src/App.jsx) et le prix d'achat SAISI (`prixAchatDe`),
//     recopiés TELS QUELS depuis App.jsx.
//  L'extension ne peut pas importer src/ (scripts de contenu classiques) : on
//  assemble ces modules en un seul fichier (esbuild, format iife, global
//  `__vrmReglesAchat`).
//  Sans option : VÉRIFIE que la copie est à jour (rouge sinon, avec le geste).
//  `--recopie` : réécrit la copie (puis `node scripts/zip-extension.cjs`).
//  `--src <arbre>` : juge un autre arbre (preuve sur le code d'avant, §6.1).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const iSrc = process.argv.indexOf('--src');
const RACINE = iSrc > 0 ? path.resolve(process.argv[iSrc + 1]) : path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'vinted-sync-extension', 'vrm-regles-achat.js');
const NOMS_APP = ['KNOWN_BRANDS', 'extractBrand', 'COULEURS', 'extractColors', 'KNOWN_MODELS', 'extractModel', 'contientModele', 'prixAchatDe'];

// Une déclaration de haut niveau d'App.jsx, entière : `function nom(…){…}` ou
// `const nom = …;` (le littéral ou la flèche, accolades/crochets équilibrés).
function declaration(src, nom) {
  const re = new RegExp('^(?:function\\s+' + nom + '\\s*\\(|const\\s+' + nom + '\\s*=)', 'm');
  const m = re.exec(src); if (!m) throw new Error(`déclaration « ${nom} » introuvable dans src/App.jsx`);
  let i = m.index, prof = 0, vu = false;
  const estFonction = m[0].startsWith('function');
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "'" || c === '"' || c === '`') { const q = c; for (i++; i < src.length && src[i] !== q; i++) if (src[i] === '\\') i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (!estFonction && c === ';' && prof === 0) { i++; break; }   // `const … ;` : la fin de l'instruction
    if (estFonction ? c === '{' : (c === '{' || c === '[' || c === '(')) { prof++; vu = true; }
    else if (estFonction ? c === '}' : (c === '}' || c === ']' || c === ')')) { prof--; if (estFonction && vu && prof === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

async function fabriquer() {
  const app = fs.readFileSync(path.join(RACINE, 'src', 'App.jsx'), 'utf8');
  const decl = NOMS_APP.map((n) => declaration(app, n)).join('\n');
  const entree = [
    "export { calculer, eurosCalc, SITES_CALCULETTE, fraisSite } from './src/calculetteAchat.js';",
    "export { pairesDuModele, memeModele } from './src/dejaEnStock.js';",
    "export { correspondances, correspond, resumeRecherche } from './src/listeRecherche.js';   // (14 nov., 5.376) ta liste de recherche",
    "export { achatsDeLAnnonce } from './src/achatMemeAnnonce.js';   // (14 nov., 5.376) déjà achetée",
    '// ── recopié de src/App.jsx ──',
    decl,
    'export { extractBrand, extractModel, extractColors, prixAchatDe };',
  ].join('\n');
  const esbuild = require(path.join(__dirname, '..', 'node_modules', 'esbuild'));
  const r = await esbuild.build({ stdin: { contents: entree, resolveDir: RACINE, sourcefile: 'regles-achat-entree.js', loader: 'js' },
    absWorkingDir: RACINE, bundle: true, format: 'iife', globalName: '__vrmReglesAchat', write: false, legalComments: 'none', charset: 'utf8', target: 'es2019' });
  return '// vrm-regles-achat.js — COPIE REFABRIQUÉE de src/calculetteAchat.js, src/dejaEnStock.js et de\n'
    + '// extractBrand/extractModel/extractColors/prixAchatDe (src/App.jsx) par\n'
    + '// scripts/regles-achat-extension.cjs --recopie. NE PAS MODIFIER ICI (§5 : une règle, un propriétaire).\n'
    + r.outputFiles[0].text;
}

(async () => {
  let texte;
  try { texte = await fabriquer(); } catch (e) { console.log('❌ ' + (e && e.message)); process.exit(1); }
  if (process.argv.includes('--recopie')) { fs.writeFileSync(SORTIE, texte); console.log('✅ vrm-regles-achat.js refabriqué'); return; }
  let actuel = null; try { actuel = fs.readFileSync(SORTIE, 'utf8'); } catch (_) {}
  const ok = actuel === texte;
  console.log(`  ${ok ? '✅' : '❌'} vrm-regles-achat.js est la copie à jour des règles de l'app${ok ? '' : ' — ' + (actuel == null ? 'absente' : 'différente') + ' : lancer node scripts/regles-achat-extension.cjs --recopie'}`);
  process.exit(ok ? 0 : 1);
})();
