// ════════════════════════════════════════════════════════════════════════════
//  LA DOUCHETTE — l'écoute de toute l'app (14 nov., proposition 99)
//  Montée UNE fois (AppCoeur). Elle écoute le clavier de la page, jamais dans un champ
//  de saisie (src/douchette.js) ; un code lu va à l'écran qui sait le résoudre (Ventes,
//  enregistré par `enregistrerResolveur`) ; sans lui, le code attend une minute et l'app
//  ouvre Ventes, qui le reprend. Aucune règle d'identité ici : `venteDuCode`.
//  L'Entrée de la douchette est retenue (`preventDefault`) : elle n'active jamais le
//  bouton qui avait le focus.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { creerDetecteur, estChampSaisie, resolveurActif, DEMANDE_DOUCHETTE } from './douchette.js';

export function useDouchette(onCode) {
  const ref = React.useRef(onCode); ref.current = onCode;
  React.useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const d = creerDetecteur();
    const k = (e) => {
      const code = d.touche({ key: e.key, t: (e.timeStamp > 0 ? e.timeStamp : (typeof performance !== 'undefined' ? performance.now() : Date.now())), champ: estChampSaisie(e.target) || e.isComposing, mod: e.ctrlKey || e.metaKey || e.altKey });
      if (code) { e.preventDefault(); e.stopPropagation(); try { ref.current(code); } catch (_) {} }
    };
    window.addEventListener('keydown', k, true);
    return () => window.removeEventListener('keydown', k, true);
  }, []);
}

// `ouvrirVentes()` : mène à l'écran Ventes (l'app le fournit) quand aucun écran ne résout.
export function DouchetteGlobale({ ouvrirVentes }) {
  useDouchette((code) => {
    try { document.documentElement.setAttribute('data-douchette-lu', code.slice(0, 64)); } catch (_) {}
    const f = resolveurActif();
    if (f) { f(code); return; }
    DEMANDE_DOUCHETTE.code = code; DEMANDE_DOUCHETTE.at = Date.now();
    if (ouvrirVentes) ouvrirVentes();
  });
  return null;
}
export default DouchetteGlobale;
