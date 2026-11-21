// ── src/design/ondulation.js — le changement d'espace (Studio bleu clair, 14 nov.) ──────
// Un anneau de lumière part de la pastille touchée et s'élargit à tout l'écran en s'effaçant
// (560 ms), pendant que le contenu glisse de 12 px en fondu (320 ms). Le bleu ne change pas :
// c'est la lumière qui passe. Rien de métier : un dessin posé sur <body>, retiré à la fin.
// Mouvement réduit : ni anneau ni glissé — un fondu court du contenu (studio.css §8).
// Le toucher ne lit AUCUNE mise en page de l'écran qui arrive : seulement le rectangle de
// l'onglet touché (déjà dessiné) et la taille de la fenêtre.
const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

// (17 nov., lot vitesse-cache — Julien : « toute l'application doit être beaucoup plus fluide ») L'ANNEAU N'EST PLUS
// INSÉRÉ À CHAQUE TOUCHER. Mesuré (banc latence-gestes, 390 tactile, ×4, trace Chrome) : insérer un nœud sous <body>
// réveille les règles `html:has(…)` / `body:has(…)` de la feuille (« Affected by :has() » ⇒ tout le document
// restylé) — 2,5 à 4,2 s de recalcul de style dans l'image qui suit le toucher, puis encore à son retrait (620 ms
// après). Désormais UN anneau, posé une fois (au premier toucher ou au repos de l'app) et gardé : chaque changement
// d'espace ne pose que SA géométrie (style en ligne : lui seul est restylé) et rejoue SON animation (Web Animations :
// aucune relecture de mise en page). Même dessin, même durée, même courbe (studio.css) ; `data-sb-onde` compte les
// ondulations (bancs). L'entrée du contenu (`data-sb-entree`) se rejoue de même, sans `offsetWidth` forcé.
let anneau = null;
const poserAnneau = () => {
  if (anneau && anneau.isConnected) return anneau;
  const o = document.createElement('div');
  o.className = 'sb-onde'; o.setAttribute('aria-hidden', 'true'); o.setAttribute('data-sb-onde', '0');
  o.style.left = '-10px'; o.style.top = '-10px'; o.style.width = '1px'; o.style.height = '1px';
  document.body.appendChild(o);
  anneau = o;
  return o;
};
// Au repos de l'app (après le démarrage), l'anneau est posé d'avance : le premier toucher ne l'insère pas.
export function preparerOndulation() {
  if (typeof document === 'undefined' || !document.body) return;
  const ric = typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback : (f) => setTimeout(f, 3000);
  ric(() => { try { if (!reduit()) poserAnneau(); } catch (_) {} }, { timeout: 8000 });
}
const rejouer = (el, nom) => {
  try {
    const anims = typeof el.getAnimations === 'function' ? el.getAnimations().filter((a) => !nom || a.animationName === nom) : [];
    if (!anims.length) return false;
    for (const a of anims) { a.cancel(); a.play(); }
    return true;
  } catch (_) { return false; }
};

export function onduler(depuis, main = typeof document !== 'undefined' ? document.querySelector('.vrm-app-shell > .vrm-main') : null) {
  if (typeof document === 'undefined' || !document.body) return false;
  const doux = reduit();
  if (main) {
    // Rejouer l'entrée même si un changement précédent n'a pas fini (un double toucher rapide) — sans lecture de mise en page.
    clearTimeout(main.__sbEntree);
    if (!(main.hasAttribute('data-sb-entree') && rejouer(main))) main.setAttribute('data-sb-entree', '');
    main.__sbEntree = setTimeout(() => { try { main.removeAttribute('data-sb-entree'); } catch (_) {} }, 360);
  }
  if (doux || !depuis || !depuis.getBoundingClientRect) return !!main;
  try {
    const q = depuis.getBoundingClientRect();
    const x = q.left + q.width / 2, y = q.top + q.height / 2;
    const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const o = poserAnneau();
    o.style.left = (x - R) + 'px'; o.style.top = (y - R) + 'px'; o.style.width = (2 * R) + 'px'; o.style.height = (2 * R) + 'px';
    o.setAttribute('data-sb-onde', String((Number(o.getAttribute('data-sb-onde')) || 0) + 1));
    rejouer(o, 'sb-onde');
    return true;
  } catch (_) { return false; }
}
