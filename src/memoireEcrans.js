// ════════════════════════════════════════════════════════════════════════════
//  LA MÉMOIRE DES ÉCRANS (6 nov., « de vrais écrans de chargement »).
//
//  Revenir sur un écran déjà vu : il remontait à vide et relisait tout — le
//  guide de démarrage, les bordereaux reçus par e-mail… arrivaient une seconde
//  après le reste, et l'écran sautait. Ce qu'une lecture a RENDU (jamais un échec,
//  jamais « rien lu ») est gardé ici, en mémoire de la page, par vendeur, 3 min
//  (la durée du cache des lectures de comptes) : l'écran remonte avec, puis la
//  lecture repart et remplace EN PLACE. Rien n'est écrit sur l'appareil.
// ════════════════════════════════════════════════════════════════════════════
export const MEMOIRE_TTL_MS = 180000;
const M = new Map();

export function souvenir(cle, owner) {
  const e = M.get(cle);
  if (!e || e.owner !== String(owner || '') || Date.now() - e.ts >= MEMOIRE_TTL_MS) return undefined;
  return e.v;
}
// Seulement une valeur LUE : `undefined` (en cours) et `null` (pas su) ne s'y gardent pas.
export function retenir(cle, owner, v) {
  if (v === undefined || v === null) return;
  M.set(cle, { v, owner: String(owner || ''), ts: Date.now() });
}
export function oublierTout() { M.clear(); }
