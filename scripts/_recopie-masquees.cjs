// ═══════════════════════════════════════════════════════════════════════════
// LA RÈGLE DES MASQUÉES, RECOPIÉE POUR LE SERVEUR (15 nov., lot fiabilite-auto)
//   node scripts/_recopie-masquees.cjs            → vérifie (code 1 si différent)
//   node scripts/_recopie-masquees.cjs --recopie  → refabrique api/_lib/masquees-regle.js
// Le contrôle de nuit (api/_lib/controle-nuit.js) compte « deux paires PRÉSENTES sous un
// N° » : en ligne ET masquées par Vinted (§5). La règle des masquées a UN propriétaire,
// src/App.jsx (bloc `<masquees-regle>`) : ce fichier en tient une copie EXACTE, refaite
// ici, jamais modifiée à la main (le même principe que api/_lib/ventes-regle.js).
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const RACINE = process.env.RECOPIE_RACINE || path.join(__dirname, '..');
const APP = path.join(RACINE, 'src', 'App.jsx');
const LIB = path.join(RACINE, 'api', '_lib', 'masquees-regle.js');

function blocApp() {
  const s = fs.readFileSync(APP, 'utf8');
  const i = s.indexOf('function masqueeSurVinted(');
  const j = s.indexOf('// </masquees-regle>', i);
  if (i < 0 || j < 0) throw new Error('bloc <masquees-regle> introuvable dans src/App.jsx');
  return s.slice(i, j).trimEnd() + '\n';
}
const TETE = `// api/_lib/masquees-regle.js — ⚠️ NE PAS MODIFIER À LA MAIN.
// Copie EXACTE du bloc \`<masquees-regle>\` de src/App.jsx (les annonces masquées par Vinted
// sont PRÉSENTES : la paire est toujours chez lui, §5), refabriquée par
// \`node scripts/_recopie-masquees.cjs --recopie\` ; \`scripts/audit-fiabilite-auto.cjs\` exige
// qu'elle soit identique et l'exécute à côté de l'originale.
import { cleNum } from './numerotation.js';
import { supprimeeApres } from './enligne-regle.js';
// <copie>
`;
const PIED = `// </copie>
export { masqueeSurVinted, masqueesDuCompte, annonceDeclareePartie, masqueesPresentes };
`;
const fabrique = () => TETE + blocApp() + PIED;
function copieLib() {
  if (!fs.existsSync(LIB)) return null;
  const s = fs.readFileSync(LIB, 'utf8');
  const i = s.indexOf('// <copie>\n'), j = s.indexOf('// </copie>');
  return i < 0 || j < 0 ? null : s.slice(i + 11, j);
}
module.exports = { blocApp, copieLib, fabrique, LIB };
if (require.main === module) {
  if (process.argv.includes('--recopie')) { fs.writeFileSync(LIB, fabrique()); console.log('✅ ' + path.relative(RACINE, LIB) + ' refabriqué'); }
  else { const ok = copieLib() === blocApp(); console.log(ok ? '✅ copie identique' : '❌ copie différente de src/App.jsx — node scripts/_recopie-masquees.cjs --recopie'); process.exit(ok ? 0 : 1); }
}
