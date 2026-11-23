// ════════════════════════════════════════════════════════════════════════════
//  L'EMPREINTE DU DESIGN (23 nov., Julien : « tous les tutos doivent ressembler à
//  l'application, même l'écran d'accueil »).
//  Ce qui MONTRE l'app hors de l'app (captures de la page d'accueil, du centre d'aide,
//  image de partage) porte, à sa fabrication, l'empreinte des fichiers qui DÉCIDENT
//  de l'apparence de l'app : les jetons (`src/natif/jetons.css`) et leur copie pour le
//  code d'avant (`src/themeMineral.js`). `audit-captures-a-jour.cjs` rougit dès que ces
//  fichiers changent sans que les images soient refaites : une capture ne peut plus
//  montrer un ancien design en silence.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RACINE = path.join(__dirname, '..');
const FICHIERS_DESIGN = ['src/natif/jetons.css', 'src/themeMineral.js'];
// Les fins de ligne ne comptent pas (une copie Windows ne doit pas rougir).
function empreinteDesign(racine = RACINE) {
  const h = crypto.createHash('sha256');
  for (const f of FICHIERS_DESIGN) h.update(f + '\0' + fs.readFileSync(path.join(racine, f), 'utf8').replace(/\r\n/g, '\n') + '\0');
  return h.digest('hex').slice(0, 16);
}
module.exports = { empreinteDesign, FICHIERS_DESIGN };
