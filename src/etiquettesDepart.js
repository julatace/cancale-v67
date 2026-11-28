// (11 nov., lot DJ3 — Julien : « Tout imprimer » proposait encore une paire DÉJÀ DÉPOSÉE)
// La règle du n° d'étiquette vit dans api/_lib/depart-vente.js (`bordsAvecEtiquettes`, `suiviDuBord`) :
// la même pour l'app, le widget et les rappels. Ici, ce que l'écran en déduit.
// Parti par une preuve qui ne vient pas de « Colis fait » (celle-là garde sa carte « posté »).
export const partiParPreuve = (r) => !!(r && r.type !== 'colis-fait');
// (28 nov., « expédié sans l'extension ») Parti VU HORS DE SES MAINS : un e-mail (n° de suivi de SON bordereau,
// ou n° de SA transaction), la prise en charge lue chez le transporteur, ou la vente finalisée. Ce que la liste
// « Envoyés » montre avec sa phrase, et ce qui fait d'un « coché posté » un colis vu partir.
export const TYPES_VU_PARTIR = ['email', 'transporteur', 'email-tx', 'finalisee'];
export const vuPartir = (r) => !!(r && TYPES_VU_PARTIR.includes(r.type));
