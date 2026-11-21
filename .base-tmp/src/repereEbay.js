// (6 nov., vitesse 2) Sorti tel quel de src/ebayRecherche.jsx : l'app s'en sert
// sans charger l'écran de recherche eBay (chargé à la demande). Règle PURE.
// (30 oct., revue) Le repère du modèle seulement quand il ne trompe pas : pas
// sur une clé GÉNÉRIQUE (« air max » couvre 90, 95, 270, TN… à des prix sans
// rapport), pas sur un accessoire (lacets, boîte vide, semelles…) ni une taille
// enfant. Mieux vaut un blanc qu'un faux.
const MODELES_GENERIQUES = new Set(['air max', 'dunk', 'blazer', 'forum', 'chuck']);
const PAS_UNE_PAIRE = /\b(lacets?|boites?|box|vides?|semelles?|insoles?|chaussettes?|porte cles?|stickers?|embouts?|enfants?|bebes?|kids?|junior|toddler|gs|td|ps|replica|repliques?)\b/;
export function repereAdmis(titre, modele) {
  if (!modele || MODELES_GENERIQUES.has(modele)) return false;
  const t = String(titre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ');
  return !PAS_UNE_PAIRE.test(t);
}
