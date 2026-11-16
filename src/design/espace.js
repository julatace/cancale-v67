// ── src/design/espace.js — l'ESPACE d'un écran (Studio bleu clair, 14 nov.) ─────────
// Quatre espaces portent la barre du bas : journee · paires · ventes · argent ; tout le reste
// est « autres ». La coque pose `data-espace` sur la racine de l'app, sur <main> et sur la
// racine de chaque écran gardé (src/ecransGardes.jsx) ; studio.css ne fait varier que l'APLAT
// (±2 points de luminosité, jamais une autre teinte). Une seule règle : l'onglet de la barre
// qui reste allumé pour cet écran (`groupeBarre`, src/navPaires.js) — la même que la barre.
import { groupeBarre, ID_PAIRES } from '../navPaires.js';

export const ESPACES = Object.freeze(['journee', 'paires', 'ventes', 'argent', 'autres']);
// (16 nov., barre-achats) Achats a son onglet dans la barre ; son aplat reste celui des paires (aucune teinte de plus).
const PAR_ONGLET = Object.freeze({ journee: 'journee', [ID_PAIRES]: 'paires', achats: 'paires', ventes: 'ventes', compta: 'argent' });

// `barGroupe` : la table de la coque (BAR_GROUPE, src/App.jsx) — sans elle, les écrans
// « annexes » (Ma semaine, Litiges…) tombent dans « autres », jamais dans un faux espace.
export function espaceDe(tab, barGroupe = {}) {
  return PAR_ONGLET[groupeBarre(String(tab || ''), barGroupe || {})] || 'autres';
}
