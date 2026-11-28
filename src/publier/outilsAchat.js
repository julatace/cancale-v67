// ── LES OUTILS D'ACHAT PARTAGÉS (28 nov., « Relier à un achat » avant de publier) ─────────────────────────────────────
// La liste des achats (chargée UNE fois, `chargerAchats`), les liens déjà posés, la proposition du REÇU et l'instantané
// vivent dans l'écran Comptabilite (Annonces / Ventes / Achats). Il les publie ici pour que les autres feuilles (la fiche
// de la paire, « Publier aussi sur… ») ouvrent la MÊME feuille « Relier à un achat » avec les MÊMES règles (§11 : une
// règle, un propriétaire). Absents (écran pas encore monté) ⇒ `null` : la rangée se tait plutôt que d'inventer.
let _outils = null;
const _ecoutes = new Set();
export function poserOutilsAchat(o) { _outils = o || null; for (const f of _ecoutes) { try { f(_outils); } catch (_) {} } }
export const lireOutilsAchat = () => _outils;
export function ecouterOutilsAchat(f) { _ecoutes.add(f); return () => _ecoutes.delete(f); }
