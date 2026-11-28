// ════════════════════════════════════════════════════════════════════════════
//  UNE MUTATION DU CODE, POUR PROUVER QU'UN CONTRÔLE ÉCHOUE (CLAUDE.md §6.1, 28 nov.)
//  Copie `src/` (sans les images ni les modèles) et `package.json` dans un dossier temporaire, y remplace UN texte dans UN
//  fichier (il doit y être, sinon la mutation est elle-même fausse), et rend la racine de cet arbre. L'audit rejoue ses
//  contrôles DEPUIS cette racine : au moins un doit passer au rouge.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const RACINE = path.join(__dirname, '..');
const LOURD = /\.(png|jpe?g|webp|gif|onnx|woff2?|ttf|mp4|pdf|zip)$/i;

function arbreMute(fichierRel, de, vers) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vrm-mutation-'));
  fs.cpSync(path.join(RACINE, 'src'), path.join(dir, 'src'), { recursive: true, filter: (f) => !LOURD.test(f) });
  fs.copyFileSync(path.join(RACINE, 'package.json'), path.join(dir, 'package.json'));
  const cible = path.join(dir, fichierRel);
  const t = fs.readFileSync(cible, 'utf8');
  if (!t.includes(de)) { fs.rmSync(dir, { recursive: true, force: true }); throw new Error(`mutation introuvable dans ${fichierRel} : ${de.slice(0, 60)}`); }
  fs.writeFileSync(cible, t.split(de).join(vers));
  return { racine: dir, nettoyer: () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} } };
}
module.exports = { arbreMute, RACINE };
