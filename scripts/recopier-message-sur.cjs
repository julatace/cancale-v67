// Recopie la règle « les mots qui font bannir un compte » (src/messageSur.js, son SEUL propriétaire, §11)
// dans l'extension (`<message-sur-regle>` de vinted-sync-extension/background.js), enfermée dans une
// fonction (aucun nom ne fuit dans le service worker). Jamais modifiée à la main : `node scripts/recopier-message-sur.cjs`.
// `--verifier` : rend 1 si la copie de l'extension n'est plus celle que fabrique ce script.
const fs = require('fs'), path = require('path');
const RACINE = path.join(__dirname, '..');
const SRC = path.join(RACINE, 'src', 'messageSur.js');
const BG = path.join(RACINE, 'vinted-sync-extension', 'background.js');
function fabriquer(src) {
  const a = src.indexOf('export const NOMS_SITES'), b = src.indexOf('// Les phrases (≤ 12 mots).');
  if (a < 0 || b < a) throw new Error('src/messageSur.js : bornes introuvables');
  const coeur = src.slice(a, b).replace(/^export /gm, '').trimEnd();
  return '// <message-sur-regle> — COPIE FABRIQUÉE de src/messageSur.js par scripts/recopier-message-sur.cjs (ne pas modifier à la main)\n'
    + 'const MESSAGE_SUR = (() => {\n' + coeur + '\nreturn { risquesMessage, messageAutoPermis };\n})();\n'
    + "function texteSurVinted(texte) { const r = MESSAGE_SUR.risquesMessage(texte, 'vinted'); return { ok: !r.length, motifs: r.map((x) => x.code) }; }\n"
    + '// </message-sur-regle>';
}
function blocActuel(bg) {
  const a = bg.indexOf('// <message-sur-regle>'), b = bg.indexOf('// </message-sur-regle>');
  return a < 0 || b < a ? null : { a, b: b + '// </message-sur-regle>'.length, texte: bg.slice(a, b + '// </message-sur-regle>'.length) };
}
module.exports = { fabriquer, blocActuel };
if (require.main === module) {
  const src = fs.readFileSync(SRC, 'utf8'), bg = fs.readFileSync(BG, 'utf8');
  const voulu = fabriquer(src), x = blocActuel(bg);
  if (process.argv.includes('--verifier')) { const ok = x && x.texte === voulu; console.log(ok ? '✅ <message-sur-regle> : la copie de l’extension est celle de src/messageSur.js' : '❌ <message-sur-regle> : copie absente ou modifiée — node scripts/recopier-message-sur.cjs'); process.exit(ok ? 0 : 1); }
  if (!x) throw new Error('background.js : bloc <message-sur-regle> introuvable');
  fs.writeFileSync(BG, bg.slice(0, x.a) + voulu + bg.slice(x.b));
  console.log('recopié');
}
