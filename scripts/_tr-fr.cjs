// ═══════════════════════════════════════════════════════════════════════════
// (11 nov., vert-11nov) Lire un texte d'écran passé par tr() — pour les audits.
// ═══════════════════════════════════════════════════════════════════════════
// Depuis la traduction (11 nov.), les écrans écrivent `tr('reglages.groupe.aide')`
// au lieu de 'Aide'. Le français reste la SOURCE (src/i18n/langues/fr.js, mot
// pour mot) : un audit qui jugeait un libellé le juge désormais dans fr.js, par
// la clé que l'écran pose. Rien n'est deviné : une clé absente de fr.js reste
// telle quelle (`tr('…')`), et l'audit qui cherchait le texte rougit.
//
//   const { francais, enFrancais } = require('./_tr-fr.cjs');
//   francais('reglages.groupe.aide')   → 'Aide' (ou null)
//   enFrancais(source)                 → la source où chaque tr('clé') SANS variable
//                                        est remplacé par le texte français entre '…'
'use strict';
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
let _dico = null;
function dico() {
  if (_dico) return _dico;
  _dico = {};
  for (const f of ['fr.js', 'fr-accueil.js']) {
    const p = path.join(RACINE, 'src', 'i18n', 'langues', f);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    for (const m of t.matchAll(/^\s*"([^"\n]+)":\s*"((?:[^"\\\n]|\\.)*)",?\s*$/gm)) {
      try { _dico[m[1]] = JSON.parse('"' + m[2] + '"'); } catch (_) { /* valeur illisible : ignorée */ }
    }
  }
  return _dico;
}
const francais = (cle) => (Object.prototype.hasOwnProperty.call(dico(), cle) ? dico()[cle] : null);
const enFrancais = (src) => String(src).replace(/\btr\(\s*'([a-zA-Z0-9_.-]+)'\s*\)/g, (tout, cle) => {
  const v = francais(cle);
  return v == null ? tout : "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
});
module.exports = { francais, enFrancais };
