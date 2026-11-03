#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE « EN LIGNE SUR VINTED », CÔTÉ SERVEUR — COPIE REFABRIQUÉE (§5, §11)
//
//  La double vente app fermée (api/_lib/double-vente.js) doit savoir, sans
//  l'app, quelles annonces Vinted sont EN LIGNE. La règle a un propriétaire :
//  les blocs <supprimees-regle> et <enligne-regle> de src/App.jsx (les mêmes,
//  texte pour texte, que background.js — audit-enligne.cjs). Ce script en
//  fabrique la copie serveur `api/_lib/enligne-regle.js`, jamais modifiée à la
//  main.
//
//    node scripts/recopie-enligne-serveur.cjs            → refabrique la copie
//    node scripts/recopie-enligne-serveur.cjs --verifier → rouge si elle diffère
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const racine = path.resolve(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const APP = arg('--app', path.join(racine, 'src/App.jsx'));
const SORTIE = arg('--sortie', path.join(racine, 'api/_lib/enligne-regle.js'));

function bloc(src, nom) {
  const a = src.indexOf(`// <${nom}>`), b = src.indexOf(`// </${nom}>`);
  if (a < 0 || b < a) throw new Error(`bloc <${nom}> introuvable dans ${APP}`);
  return src.slice(a, b + `// </${nom}>`.length);
}
function fabriquer(src) {
  return [
    '// ── LA RÈGLE « EN LIGNE SUR VINTED », CÔTÉ SERVEUR — COPIE REFABRIQUÉE ──',
    '// ⚠️ NE RIEN MODIFIER ICI À LA MAIN. Les deux blocs ci-dessous sont, texte',
    '//    pour texte, ceux de src/App.jsx (eux-mêmes identiques à background.js).',
    '//    Modifier App.jsx, puis : node scripts/recopie-enligne-serveur.cjs',
    '//    `--verifier` passe au rouge si cette copie diffère.',
    '/* eslint-disable */',
    bloc(src, 'supprimees-regle'),
    bloc(src, 'enligne-regle'),
    'export { SUPPR_MARGE_MS, supprimeeApres, dateLectureDressing, ENLIGNE_FRAIS_MS, ENLIGNE_SUR_MS, ouverteSurVinted, venduePourSonVendeur, enLigneDuCompte, enLigneDesLignes };',
    '',
  ].join('\n');
}
const attendu = fabriquer(fs.readFileSync(APP, 'utf8'));
if (process.argv.includes('--verifier')) {
  const lu = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, 'utf8') : '';
  if (lu !== attendu) { console.log('✗ api/_lib/enligne-regle.js diffère de src/App.jsx — node scripts/recopie-enligne-serveur.cjs'); process.exit(1); }
  console.log('✓ api/_lib/enligne-regle.js = blocs <supprimees-regle> + <enligne-regle> de src/App.jsx');
} else {
  fs.writeFileSync(SORTIE, attendu);
  console.log('écrit', path.relative(racine, SORTIE));
}
