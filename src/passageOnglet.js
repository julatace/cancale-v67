// ════════════════════════════════════════════════════════════════════════════
//  LE PASSAGE D'UN ONGLET À L'AUTRE (8 nov., Julien : « des petites animations
//  entre chaque onglet, que ce soit vraiment fluide, pas robotique »).
//
//  · Le nouvel écran arrive en FONDU (opacité seule, 200 ms, courbe douce ;
//    à l'ordinateur 0,9 → 1 en 180 ms), joué par Web Animations sur `<main>` :
//    le compositeur s'en charge, aucun style recalculé, aucun `transform` sur
//    `<main>` (§7). Pendant ce temps la pastille de la barre du bas GLISSE vers
//    l'onglet touché (BottomBar, styles-ecrans-gardes.css).
//  · ⚠️ Mesuré le 8 nov. (CPU ×4, trace Chrome) et écarté : poser une classe sur
//    `<main>` (l'ancienne `vrm-ecran-anime`) faisait recalculer le style de TOUT
//    l'écran (5 300 éléments, ~0,8 s au téléphone) ; un fondu enchaîné par View
//    Transitions en ajoutait un SECOND à la fin du fondu (~0,7 s) — plus lent que
//    ce qu'il embellit. Ne pas les remettre sans remesurer (`_mesure-onglets.cjs`).
//  · « Réduire les animations » : rien ne bouge, rien ne fond.
//  Le geste est fréquent : court, jamais un délai avant de répondre.
// ════════════════════════════════════════════════════════════════════════════

export const DUREE_FONDU_MS = 200;
export const COURBE_FONDU = 'cubic-bezier(.22, 1, .36, 1)';
export const mouvementReduit = () => {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
};

// Le nouvel écran arrive en fondu.
export function fonduEntree(el) {
  if (!el || mouvementReduit() || typeof el.animate !== 'function') return null;
  // Sur ordinateur, à peine (la zone de travail ne s'éteint pas) : 0,9 → 1 en 180 ms (comme avant).
  let bureau = false; try { bureau = window.matchMedia('(min-width: 1024px), (min-width: 768px) and (hover: hover) and (pointer: fine)').matches; } catch (_) {}
  try { return el.animate([{ opacity: bureau ? 0.9 : 0 }, { opacity: 1 }], { duration: bureau ? 180 : DUREE_FONDU_MS, easing: bureau ? 'ease' : COURBE_FONDU }); } catch (_) { return null; }
}
