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

let prevu = false;
function toutJuger() {
  if (prevu) return;
  prevu = true;
  requestAnimationFrame(() => {
    prevu = false;
    try { document.querySelectorAll(SEL).forEach(juger); } catch (_) {}
  });
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
