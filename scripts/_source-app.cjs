// ════════════════════════════════════════════════════════════════════════════
// Le code d'App.jsx, tel que les audits le lisent (29 octobre).
// Sept écrans ont été découpés d'App.jsx (chargés à leur ouverture) : leur code
// vit maintenant dans src/Ecran*.jsx, INCHANGÉ. Un audit qui extrait une règle
// par son nom dans « App.jsx » la cherche donc aussi dans ces fichiers : on lui
// rend App.jsx suivi des écrans découpés (sans leurs imports ni leurs exports).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
function sourceApp(racine = path.join(__dirname, '..')) {
  const src = path.join(racine, 'src');
  // Les lignes `const X = lazy(() => import("./EcranY.jsx"))` d'App.jsx sont
  // retirées : X est déclaré par l'écran lui-même, juste après.
  let t = fs.readFileSync(path.join(src, 'App.jsx'), 'utf8').replace(/^const \w+ = lazy\(\(\) => import\("\.\/Ecran[A-Za-z]+\.jsx"\)\);\n/gm, '');
  let ecrans = [];
  try { ecrans = fs.readdirSync(src).filter((f) => /^Ecran[A-Za-z]+\.jsx$/.test(f)).sort(); } catch (_) {}
  // Leurs lignes d'import (ce qu'ils reprennent d'App.jsx et des mêmes modules)
  // et leur export final sont retirés : le texte rendu reste UN module valide,
  // où chaque nom n'est déclaré qu'une fois.
  for (const f of ecrans) {
    const e = fs.readFileSync(path.join(src, f), 'utf8')
      .replace(/^import [^\n]*;\n/gm, '')
      .replace(/^export default \w+;\n?/m, '')
      .replace(/^export \{[^}\n]*\};\n?/m, '');
    t += '\n' + e;
  }
  return t;
}
module.exports = { sourceApp };
