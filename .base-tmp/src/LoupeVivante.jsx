// ── LA LOUPE, REDESSINÉE SEULE À LA FRAPPE (6 nov., v36) ────────────────────
// `Vivant` s'abonne au fil de la loupe (src/rechercheEcran.js) : à chaque lettre,
// SEUL ce composant se redessine (le champ, ou le panneau des résultats) — la coque
// et l'écran derrière ne bougent pas. `rendre(etat, qLent)` reçoit l'état du fil et
// le texte DIFFÉRÉ (React calcule les résultats quand il a le temps : la lettre
// tapée s'affiche d'abord).
import React from 'react';
import { FIL_RECHERCHE } from './rechercheEcran.js';

export function useFilRecherche() {
  return React.useSyncExternalStore(FIL_RECHERCHE.abonner, FIL_RECHERCHE.lire, FIL_RECHERCHE.lire);
}
export function Vivant({ rendre }) {
  const s = useFilRecherche();
  const qLent = React.useDeferredValue(s.q);
  const r = rendre(s, qLent);
  return r === undefined ? null : r;
}
