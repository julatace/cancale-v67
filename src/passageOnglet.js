// ════════════════════════════════════════════════════════════════════════════
//  LE PASSAGE D'UN ONGLET À L'AUTRE (8 nov., Julien : « des petites animations
//  entre chaque onglet, que ce soit vraiment fluide, pas robotique »).
//
//  · Retour sur un écran GARDÉ (src/ecransGardes.jsx, il revient sans calcul) :
//    un FONDU ENCHAÎNÉ de l'ancien vers le nouveau (View Transitions, 200 ms,
//    courbe douce — styles-ecrans-gardes.css). La barre du bas n'est pas fondue :
//    sa pastille glisse vers l'onglet touché.
//  · Autre changement (premier passage, écran qui se calcule) : le nouvel écran
//    arrive en fondu (opacité seule, Web Animations : aucune classe posée sur
//    `<main>` — une classe changée sur `<main>` faisait recalculer le style de
//    tout l'écran, mesuré 0,8 s au téléphone ; aucun `transform` sur `<main>`).
//  · « Réduire les animations » : rien ne bouge, rien ne fond.
//  Le geste est fréquent : court (≤ 220 ms), jamais un délai avant de répondre.
// ════════════════════════════════════════════════════════════════════════════
import { flushSync } from 'react-dom';

export const DUREE_FONDU_MS = 200;
export const COURBE_FONDU = 'cubic-bezier(.22, 1, .36, 1)';
export const mouvementReduit = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
};

let enchaineEnCours = false;
export const fonduEnchaineEnCours = () => enchaineEnCours;

// Le changement `maj` (des poseurs d'état React) en fondu enchaîné, si le
// navigateur sait le faire ; sinon tout de suite. Rend vrai si le fondu part.
export function changerEnFonduEnchaine(maj) {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || typeof doc.startViewTransition !== 'function' || mouvementReduit() || doc.hidden) { maj(); return false; }
  try {
    enchaineEnCours = true;
    doc.documentElement.setAttribute('data-passage-onglet', '');
    const vt = doc.startViewTransition(() => { flushSync(maj); });
    const fin = () => { enchaineEnCours = false; try { doc.documentElement.removeAttribute('data-passage-onglet'); } catch (_) {} };
    Promise.resolve(vt.finished).then(fin, fin);
    return true;
  } catch (_) {
    enchaineEnCours = false;
    try { doc.documentElement.removeAttribute('data-passage-onglet'); } catch (_) {}
    maj();
    return false;
  }
}

// Le nouvel écran arrive en fondu (sauf pendant un fondu enchaîné, qui s'en charge).
export function fonduEntree(el) {
  if (!el || enchaineEnCours || mouvementReduit() || typeof el.animate !== 'function') return null;
  // Sur ordinateur, à peine (la zone de travail ne s'éteint pas) : 0,9 → 1 en 180 ms (comme avant).
  let bureau = false; try { bureau = window.matchMedia('(min-width: 1024px), (min-width: 768px) and (hover: hover) and (pointer: fine)').matches; } catch (_) {}
  try { return el.animate([{ opacity: bureau ? 0.9 : 0 }, { opacity: 1 }], { duration: bureau ? 180 : DUREE_FONDU_MS, easing: bureau ? 'ease' : COURBE_FONDU }); } catch (_) { return null; }
}
