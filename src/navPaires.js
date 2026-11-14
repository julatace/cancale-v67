// ════════════════════════════════════════════════════════════════════════════
//  « PAIRES » — un onglet de la barre du bas qui réunit trois écrans (14 nov.,
//  choix n° 61 de Julien : quatre onglets en bas au lieu de cinq — Aujourd'hui ·
//  Paires · Ventes · Argent — et le reste dans un menu qui s'ouvre en haut).
//
//  Paires = Annonces · Stock · Achats. Les trois écrans restent TELS QUELS (mêmes
//  identifiants d'onglet `annonces`, `garage`, `achats` : liens profonds, ⌘K,
//  reprise, notifications inchangés) ; on ne fait que les regrouper sous un
//  onglet, avec un sélecteur segmenté en tête (téléphone).
//  `paires` n'est JAMAIS un écran : c'est un alias qui ouvre le dernier des trois.
//  Fonctions pures (aucun React) : la coque (src/App.jsx) et les bancs les lisent.
// ════════════════════════════════════════════════════════════════════════════
export const ID_PAIRES = 'paires';
export const ECRANS_PAIRES = ['annonces', 'garage', 'achats'];
const CLE_DERNIER = 'vrm_paires_dernier';

export const estPaires = (tab) => ECRANS_PAIRES.includes(tab);

// Le dernier des trois écrans ouvert sur CET appareil (une commodité : sans stockage, Annonces).
export function dernierePaire(stockage) {
  try { const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null); const v = s && s.getItem(CLE_DERNIER); return estPaires(v) ? v : 'annonces'; } catch (_) { return 'annonces'; }
}
export function noterPaire(tab, stockage) {
  if (!estPaires(tab)) return;
  try { const s = stockage || (typeof localStorage !== 'undefined' ? localStorage : null); if (s) s.setItem(CLE_DERNIER, tab); } catch (_) {}
}

// L'onglet de la barre qui reste allumé pour un écran (Paires pour les trois ; sinon la règle d'avant).
export const groupeBarre = (tab, barGroupe = {}) => (estPaires(tab) ? ID_PAIRES : (barGroupe[tab] || tab));

// La pastille de « Paires » : la SOMME des nombres connus de ses écrans (ambre = un geste) — jamais un 0
// deviné (rien de connu ⇒ null). Sur un écran de Paires, le sélecteur segmenté porte déjà chaque nombre :
// l'onglet se tait (le même nombre ne s'écrit jamais deux fois sur un écran, §7).
export function badgePaires(badges, tab) {
  if (!badges || estPaires(tab)) return null;
  let s = 0, connu = false;
  for (const k of ECRANS_PAIRES) { const v = badges[k]; if (typeof v === 'number' && v > 0) { s += v; connu = true; } }
  return connu ? s : null;
}
