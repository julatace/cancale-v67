// Une rangée qui défile au doigt (`.vrm-rangee`, `.vrm-defile`) dit qu'elle
// défile : le fondu du bord droit (styles-coque.css) ne s'affiche que si la
// rangée DÉBORDE et n'est pas encore défilée jusqu'au bout. On MESURE, on ne
// suppose pas : une rangée qui tient en entier n'a aucun fondu.
// Revue du 16 octobre : « Finalisée », « Annulées », « Dernières ventes »
// coupés net, sans indice qu'il y avait une suite.
const SEL = '.vrm-rangee, .vrm-defile, .vrm-carrousel';

function juger(el) {
  try {
    const reste = el.scrollWidth - el.clientWidth - el.scrollLeft;
    const suite = el.scrollWidth > el.clientWidth + 2 && reste > 2;
    if (suite) { if (el.getAttribute('data-defile') !== 'suite') el.setAttribute('data-defile', 'suite'); }
    else if (el.hasAttribute('data-defile')) el.removeAttribute('data-defile');
  } catch (_) {}
}

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
    try { document.querySelectorAll(SEL).forEach((el) => { if (!el.closest('[data-ecran-cache]')) juger(el); }); } catch (_) {}
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
