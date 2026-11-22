// ════════════════════════════════════════════════════════════════════════════
//  CE QUE LE BANC « TOUT TOUCHER » ÉCARTE — ET POURQUOI (22 nov.)
//  Chaque exception est NOMMÉE avec sa raison ; une exception sans raison n'entre pas ici. `ou` = { cfg, page,
//  chemin, s (signature du contrôle), texte }.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const a = (ou, re) => re.test(ou.s);
module.exports = {
  // Un contrôle qu'on ne touche pas (le toucher sort du panneau ou n'a de sens qu'avec un fichier).
  sauter: () => false,
  // Un toucher sans effet ATTENDU.
  mort: (ou) =>
    // L'onglet de la page où l'on est déjà : y toucher ne change rien, et c'est voulu.
    new RegExp('data-onglet-b=' + ou.page + '(,|$)').test(ou.s) && !/data-accueil=/.test(ou.s),
  // Une cible plus petite que 44 px ASSUMÉE.
  petit: () => false,
  couvert: () => false,
  // Un refus de forme ATTENDU (ex. toucher « Envoyer » avec un champ vide).
  forme: () => false,
  a,
};
