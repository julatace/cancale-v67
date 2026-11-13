// LE VRAI CODE D'IMPRESSION, extrait d'App.jsx pour les bancs qui le rendent dans
// Chromium (rien n'est recopié) — (11 nov., lot thermique).
//   · `regles` : src/impression/thermique.js et src/impression/bordereauExemple.js,
//     sans leurs `export` (déclarations ordinaires dans le script de la page) ;
//   · `impression(APP)` : d'« IMPRIMANTE NORMALE OU THERMIQUE » jusqu'au morceau
//     fin du bloc `poserBordereau` — zoneEtiquette, la pose sur le papier
//     choisi, poserBordereau ; sur un arbre d'AVANT (sans ces repères), la liste
//     des blocs d'origine.
const path = require('path'), fs = require('fs');
const RACINE = path.join(__dirname, '..', '..');
const sansExport = (s) => s.replace(/^export\s+(?=(const|function|async|let|class)\b)/gm, '');
const lireRegle = (f) => { const p = path.join(RACINE, 'src', 'impression', f); return fs.existsSync(p) ? sansExport(fs.readFileSync(p, 'utf8')) : ''; };
const regles = () => [lireRegle('thermique.js'), lireRegle('bordereauExemple.js')].join('\n');
function impression(APP) {
  // (La fin : le bloc `poserBordereau` entier — le repère `⟦→ ecrans/…⟧` qui le suit est
  // remplacé par l'écran lui-même quand `_source-app.cjs` recolle App.jsx.)
  const D = '// ── IMPRIMANTE NORMALE OU THERMIQUE', P = 'const poserBordereau = async';
  const a = APP.indexOf(D), p = a >= 0 ? APP.indexOf(P, a) : -1, b = p > 0 ? APP.indexOf('\n};', p) : -1;
  if (a >= 0 && b > p && APP.includes('const analyserZone = async')) return APP.slice(a, b + 3);
  return null;
}
module.exports = { regles, impression, sansExport, RACINE };
