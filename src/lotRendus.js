// ════════════════════════════════════════════════════════════════════════════
//  UNE RÉPONSE PAR RENDU (16 nov., lot vitesse-volume)
//  Mesuré à 20 000 ventes (téléphone 390, processeur ×4) : des constructions sans argument du moteur
//  `Comptabilite` (`cartesColis`, `colisAEnvoyerBase`, `listeEnvoyes`) étaient refaites jusqu'à cinq fois
//  PAR RENDU, pour les mêmes valeurs. `unParRendu(fn)` rend la première réponse aux appels suivants du
//  MÊME rendu ; hors d'un rendu (un geste, un effet) elle recalcule toujours. La mémoire part à la fin
//  du calcul synchrone (microtâche) : jamais la réponse d'un rendu d'avant.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';

const internes = (() => { try { return React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED || null; } catch (_) { return null; } })();
// Pendant le rendu d'un composant, le distributeur de crochets est celui du rendu (ses `useMemo` et
// `useCallback` sont deux fonctions). Hors rendu, c'est celui qui refuse tout (une seule fonction pour
// tous), ou aucun. Pas su (React sans ces internes) ⇒ « hors rendu » : on recalcule, comme avant.
export const pendantUnRendu = () => {
  try {
    const d = internes && internes.ReactCurrentDispatcher && internes.ReactCurrentDispatcher.current;
    return !!(d && d.useMemo !== d.useCallback);
  } catch (_) { return false; }
};

export function unParRendu(fn) {
  let pris = false, v;
  return function () {
    if (!pendantUnRendu()) return fn.apply(this, arguments);
    if (pris) return v;
    v = fn.apply(this, arguments); pris = true;
    queueMicrotask(() => { pris = false; v = undefined; });
    return v;
  };
}
