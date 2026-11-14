// ── src/design/densite.js — la DENSITÉ des listes, au choix (14 nov., idée 149 de Julien) ─────────
// Paramètres → Affichage → Densité des listes : « Serrées » (rangées de 56 px : 12 paires ou plus sur
// un écran d'iPhone), « Normales » (64, le Studio), « Aérées » (72 : 8 paires). Un réglage PAR APPAREIL
// (le téléphone et l'ordinateur n'ont pas le même écran) : `localStorage` seulement, jamais le nuage.
// La racine porte `data-densite` ; studio.css en tire `--sb-rangee-h`, que `.sb-rangee` (et la famille
// `--d-h-rangee` des listes d'hier) lisent : toutes les listes suivent. La cible reste la rangée ENTIÈRE
// (56 ≥ 44 px au doigt). Posé AVANT le premier rendu par public/demarrage-theme.js (aucun saut).
export const CLE_DENSITE = 'vrm_densite';
export const DENSITES = Object.freeze(['serree', 'normale', 'aeree']);
export const HAUTEUR_RANGEE = Object.freeze({ serree: 56, normale: 64, aeree: 72 });

export function lireDensite(stockage = typeof localStorage !== 'undefined' ? localStorage : null) {
  try { const v = stockage ? JSON.parse(stockage.getItem(CLE_DENSITE) || 'null') : null; return DENSITES.includes(v) ? v : 'normale'; } catch (_) { return 'normale'; }
}
export function poserDensite(v, { stockage = typeof localStorage !== 'undefined' ? localStorage : null, racine = typeof document !== 'undefined' ? document.documentElement : null } = {}) {
  const d = DENSITES.includes(v) ? v : 'normale';
  try { if (stockage) { if (d === 'normale') stockage.removeItem(CLE_DENSITE); else stockage.setItem(CLE_DENSITE, JSON.stringify(d)); } } catch (_) { /* navigation privée : le choix vaut pour la visite */ }
  try { if (racine) { if (d === 'normale') racine.removeAttribute('data-densite'); else racine.setAttribute('data-densite', d); } } catch (_) {}
  return d;
}
