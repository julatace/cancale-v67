#!/usr/bin/env node
// recopier-gardes-extension (20 nov., ext. 5.410) — les GARDES qui précédaient SON clic dans l'app, retirées de l'app
// par le chantier actions-extension (« toute action se fait dans l'extension »), vivent maintenant dans l'extension.
// Elles ne sont JAMAIS réécrites à la main : ce script empaquette (esbuild) les fonctions de l'app telles quelles
//   · avisAcceptationManuelle (src/offresGarde.js)   — anti double-vente avant d'accepter une offre ;
//   · problemesAnnonce        (src/verifAnnonce.js)  — vérification avant publication ;
//   · photosExigeesVc         (src/photosVestiaire.js) — photos exigées par Vestiaire ;
//   · confirmationSupprimerLbc (src/actionsExtensionGardes.js) — la confirmation « sans retour » de Leboncoin ;
//   · la règle des REPUBLICATIONS PROGRAMMÉES (src/repubProgramme.js : decision, conditionsDepart, prendreDepart…)
//     et l'aperçu titre / prix d'une republication (src/republierReglages.js : apercuRepub) — la veille vit dans le fond ;
//   · validerReglagesFavoris (src/reglagesFavoris.js) et validerAutoFavoris (src/favorisAuto.js) — les réglages des
//     messages aux favoris écrits depuis le panneau passent par la règle de l'app (le serveur la reprend à l'envoi) ;
// et les pose dans background.js entre `// <gardes-app>` et `// </gardes-app>` (`const GARDES_APP`).
// `--verifie` : rouge si la copie n'est plus celle de l'app.
const fs = require('fs'), path = require('path');
const esbuild = require('esbuild');
const R = path.join(__dirname, '..');
const F_BG = path.join(R, 'vinted-sync-extension', 'background.js');
const entree = `export { avisAcceptationManuelle } from './src/offresGarde.js';
export { problemesAnnonce } from './src/verifAnnonce.js';
export { photosExigeesVc } from './src/photosVestiaire.js';
export { confirmationSupprimerLbc } from './src/actionsExtensionGardes.js';
export { programmesDe, decision, conditionsDepart, prendreDepart, marquerPasPartie, marquerFinie, pairesAuDepart, indexAttentes, LIGNE_PROGRAMME, GESTES_PAR_REPUB, ACTIONS_QUOTA } from './src/repubProgramme.js';
export { apercuRepub, photoNeutre, tirerLettre } from './src/republierReglages.js';
export { validerReglagesFavoris } from './src/reglagesFavoris.js';
export { validerAutoFavoris } from './src/favorisAuto.js';`;
const out = esbuild.buildSync({ stdin: { contents: entree, resolveDir: R, loader: 'js' }, bundle: true, format: 'iife', globalName: '__gardesApp', write: false, platform: 'neutral', target: 'es2020', legalComments: 'none', charset: 'utf8' });
const code = out.outputFiles[0].text.trim();
const bloc = `// <gardes-app> — RECOPIÉ par scripts/recopier-gardes-extension.cjs depuis l'app (jamais à la main).\n${code}\nconst GARDES_APP = __gardesApp;\n// </gardes-app>`;
const bg = fs.readFileSync(F_BG, 'utf8');
const a = bg.indexOf('// <gardes-app>'), b = bg.indexOf('// </gardes-app>');
if (a < 0 || b < 0) { console.log('❌ bloc <gardes-app> absent de background.js'); process.exit(1); }
const actuel = bg.slice(a, b + '// </gardes-app>'.length);
if (process.argv.includes('--verifie')) {
  if (actuel !== bloc) { console.log('❌ les gardes de l’extension ne sont plus celles de l’app : node scripts/recopier-gardes-extension.cjs'); process.exit(1); }
  console.log('✅ gardes de l’app recopiées à l’identique dans background.js'); process.exit(0);
}
fs.writeFileSync(F_BG, bg.slice(0, a) + bloc + bg.slice(b + '// </gardes-app>'.length));
console.log(`✅ gardes recopiées (${code.length} octets)`);
