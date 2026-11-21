// Une rangée qui défile au doigt (`.vrm-rangee`, `.vrm-defile`) dit qu'elle
// défile : le fondu du bord droit (styles-coque.css) ne s'affiche que si la
// rangée DÉBORDE et n'est pas encore défilée jusqu'au bout. On MESURE, on ne
// suppose pas : une rangée qui tient en entier n'a aucun fondu.
// Revue du 16 octobre : « Finalisée », « Annulées », « Dernières ventes »
// coupés net, sans indice qu'il y avait une suite.
const SEL = '.vrm-rangee, .vrm-defile, .vrm-carrousel';

// (16 nov., stabilite-iphone) LIRE, PUIS ÉCRIRE. Avant, chaque rangée était lue PUIS marquée, l'une après
// l'autre : chaque marque (`data-defile`) invalidait la mise en page et la lecture de la rangée suivante la
// refaisait EN ENTIER — N rangées, N mises en page de tout l'écran. Profil de l'ouverture de Ventes (base de
// 1 000 paires, Chromium) : 1,5 s de temps propre dans cette fonction. Maintenant : toutes les mesures d'abord
// (une seule mise en page), toutes les marques ensuite.
const mesurer = (el) => {
  try { const sw = el.scrollWidth, cw = el.clientWidth; return sw > cw + 2 && sw - cw - el.scrollLeft > 2; } catch (_) { return null; }
};
const marquer = (el, suite) => {
  if (suite == null) return;
  try {
    if (suite) { if (el.getAttribute('data-defile') !== 'suite') el.setAttribute('data-defile', 'suite'); }
    else if (el.hasAttribute('data-defile')) el.removeAttribute('data-defile');
  } catch (_) {}
};
function juger(el) { marquer(el, mesurer(el)); }

// (7 nov., vitesse) Regroupé : au plus une mesure toutes les 300 ms (avant : à
// CHAQUE changement de la page, une relecture de mise en page de toutes les
// rangées — 1,1 s de gel mesuré au téléphone pendant l'ouverture de Colis).
let prevu = false;
function toutJuger() {
  if (prevu) return;
  prevu = true;
  setTimeout(() => requestAnimationFrame(() => {
    prevu = false;
    // (8 nov.) Jamais dans un écran gardé caché (src/ecransGardes.jsx) : le mesurer
    // forcerait toute sa mise en page, que `content-visibility: hidden` saute.
    try {
      const els = [...document.querySelectorAll(SEL)].filter((el) => !el.closest('[data-ecran-cache]'));
      const suites = els.map(mesurer);
      els.forEach((el, i) => marquer(el, suites[i]));
    } catch (_) {}
  }), 300);
}

export function suivreRangeesDefilantes() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.__vrmRangees) return;
  window.__vrmRangees = true;
  // Le défilement ne remonte pas : on l'écoute en capture.
  document.addEventListener('scroll', (e) => {
    const t = e.target;
    if (t && t.nodeType === 1 && t.matches && t.matches(SEL)) juger(t);
  }, { capture: true, passive: true });
  window.addEventListener('resize', toutJuger, { passive: true });
  try {
    new MutationObserver(toutJuger).observe(document.body, { childList: true, subtree: true });
  } catch (_) {}
  toutJuger();
}
