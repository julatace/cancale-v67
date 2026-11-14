// ── src/design/ondulation.js — le changement d'espace (Studio bleu clair, 14 nov.) ──────
// Un anneau de lumière part de la pastille touchée et s'élargit à tout l'écran en s'effaçant
// (560 ms), pendant que le contenu glisse de 12 px en fondu (320 ms). Le bleu ne change pas :
// c'est la lumière qui passe. Rien de métier : un dessin posé sur <body>, retiré à la fin.
// Mouvement réduit : ni anneau ni glissé — un fondu court du contenu (studio.css §8).
// Le toucher ne lit AUCUNE mise en page de l'écran qui arrive : seulement le rectangle de
// l'onglet touché (déjà dessiné) et la taille de la fenêtre.
const reduit = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

export function onduler(depuis, main = typeof document !== 'undefined' ? document.querySelector('.vrm-app-shell > .vrm-main') : null) {
  if (typeof document === 'undefined' || !document.body) return false;
  const doux = reduit();
  if (main) {
    // Rejouer l'entrée même si un changement précédent n'a pas fini (un double toucher rapide).
    main.removeAttribute('data-sb-entree'); void main.offsetWidth; main.setAttribute('data-sb-entree', '');
    clearTimeout(main.__sbEntree); main.__sbEntree = setTimeout(() => { try { main.removeAttribute('data-sb-entree'); } catch (_) {} }, 360);
  }
  if (doux || !depuis || !depuis.getBoundingClientRect) return !!main;
  try {
    const q = depuis.getBoundingClientRect();
    const x = q.left + q.width / 2, y = q.top + q.height / 2;
    const R = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const o = document.createElement('div');
    o.className = 'sb-onde'; o.setAttribute('aria-hidden', 'true'); o.setAttribute('data-sb-onde', '');
    o.style.left = (x - R) + 'px'; o.style.top = (y - R) + 'px'; o.style.width = (2 * R) + 'px'; o.style.height = (2 * R) + 'px';
    document.body.appendChild(o);
    setTimeout(() => { try { o.remove(); } catch (_) {} }, 620);
    return true;
  } catch (_) { return false; }
}
