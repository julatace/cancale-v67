// Sorti de src/accueil-mouvement.js le 16 nov. (lot vitesse-lectures) : la page d'accueil n'en lit que
// ces deux préférences ; le moteur de mouvement (partagé avec le film) reste un morceau à part.
import React from 'react';

// ── LES PRÉFÉRENCES DU SYSTÈME, ÉCOUTÉES EN DIRECT ──────────────────────────
const lireMedia = (requetes) => { try { return requetes.every((q) => window.matchMedia(q).matches); } catch (_) { return false; } };
function useMedia(requetes) {
  const [v, setV] = React.useState(() => lireMedia(requetes));
  React.useEffect(() => {
    const maj = () => setV(lireMedia(requetes));
    const mqs = [];
    requetes.forEach((q) => { try { const m = window.matchMedia(q); m.addEventListener('change', maj); mqs.push(m); } catch (_) {} });
    maj();
    return () => mqs.forEach((m) => { try { m.removeEventListener('change', maj); } catch (_) {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return v;
}
const MOINS = ['(prefers-reduced-motion: reduce)'];
const SANS_SOURIS = ['(pointer: coarse)', '(hover: none)'];
// « Réduire les animations » : une erreur vaut `false`.
export const useMoinsDeMouvement = () => useMedia(MOINS);
// ⚠️ LE MÊME TEST QUE `useSansSouris` D'App.jsx : `(pointer: coarse)` ET
//    `(hover: none)` — aucune souris du tout. Ne pas les laisser diverger : la
//    page et l'app doivent dire la même chose au même appareil.
export const useSansSouris = () => useMedia(SANS_SOURIS);

