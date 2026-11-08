// (8 nov.) « CETTE VENTE ATTEND-ELLE ENCORE MON ENVOI ? » — côté app.
// La RÈGLE vit dans api/_lib/depart-vente.js (importée telle quelle par l'app ET
// le serveur, §11). Ici : le registre de ce que l'écran propriétaire (Colis,
// `partisVinted` dans `Comptabilite`) a calculé, pour les lecteurs qui n'ont ni
// les bordereaux ni les e-mails sous la main (Ventes toutes plateformes, la
// loupe, la fiche d'une paire) — ils disent la MÊME chose que Colis.
// Pas encore calculé ⇒ `null` (pas su) : rien n'est déduit, l'écran garde ce
// qu'il savait (« Colis fait » seul).
export { phraseRaison, raisonDepartVente, ventesPartiesParPreuve, attendEnvoi } from '../api/_lib/depart-vente.js';

let _partis = null;
export function publierDepartsVinted(m) { _partis = m instanceof Map ? m : null; }
export function raisonDepartPubliee(tx) {
  if (!_partis || tx == null) return null;
  return _partis.get(String(tx)) || null;
}
