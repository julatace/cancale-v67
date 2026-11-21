// (11 nov., lot DJ3 — Julien : « Tout imprimer » proposait encore une paire DÉJÀ DÉPOSÉE)
// La règle du n° d'étiquette vit dans api/_lib/depart-vente.js (`bordsAvecEtiquettes`, `suiviDuBord`) :
// la même pour l'app, le widget et les rappels. Ici, ce que l'écran en déduit.
// Parti par une preuve qui ne vient pas de « Colis fait » (celle-là garde sa carte « posté »).
export const partiParPreuve = (r) => !!(r && r.type !== 'colis-fait');
