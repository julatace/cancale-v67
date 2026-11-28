// ── src/sneakers/sources.js — LES LECTURES DE LA FEUILLE SNEAKERS, POSÉES PAR APP.JSX (28 nov., main-vert) ──
// Sorti de src/sneakers/stockage.js pour que le DÉMARRAGE n'emporte que ce registre (quelques octets) : la lecture des
// références (reference.js), les étiquettes (tags.js) et le rangement (stockage.js) arrivent avec la feuille, la fiche ou
// la calculette qui s'en servent (budget-vitesse : +6 Ko compressés au démarrage le 28 nov.).
let sources = {};
export function poserSourcesSneakers(s) { sources = s && typeof s === 'object' ? s : {}; }
export const sourcesSneakers = () => sources;
