// ── src/natif/modaleAccessible.js — les anciennes fenêtres modales, accessibles (28 nov., lot boutons-donnees) ─────────
// L'audit d'accessibilité du 28 nov. (O1, WCAG 2.1.2 / 2.4.3 / 4.1.2) : des fenêtres faites main (`<div position:fixed>` +
// voile) sans `role="dialog"`, sans `aria-modal`, sans piège de focus — au clavier ou au lecteur d'écran on se perdait sous le
// voile. Leur passage à `Feuille` (src/natif/Feuille.jsx) est l'objectif ; en attendant, CE crochet leur donne le même
// comportement que `Feuille`, sans toucher leur dessin :
//   · le focus ENTRE dans la fenêtre à l'ouverture (le 1er contrôle, sinon la fenêtre elle-même) ;
//   · Tab / Maj+Tab restent DEDANS (piège) ;
//   · Échap la ferme (si `onFermer`) ;
//   · à la fermeture, le focus revient à l'élément d'où elle a été ouverte.
// Usage : const ref = useModaleAccessible(onFermer);  <div ref={ref} role="dialog" aria-modal="true" aria-label="…">
import React from 'react';

const FOCALISABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
const visibles = (el) => [...el.querySelectorAll(FOCALISABLES)].filter((x) => x.getClientRects().length && !x.closest('[inert], [hidden]'));

export function useModaleAccessible(onFermer, actif = true) {
  const ref = React.useRef(null);
  const fermer = React.useRef(onFermer);
  fermer.current = onFermer;
  React.useEffect(() => {
    if (!actif || typeof document === 'undefined') return undefined;
    const el = ref.current; if (!el) return undefined;
    const avant = document.activeElement;
    // Le nom de la fenêtre : celui posé par l'appelant, sinon son titre (le 1er titre, sinon la 1re ligne de texte).
    if (!el.getAttribute('aria-label') && !el.getAttribute('aria-labelledby')) {
      const t = el.querySelector('h1, h2, h3, [data-titre-modale]');
      const nom = ((t && t.textContent) || (el.innerText || '').split('\n').find((x) => x.trim()) || '').trim().slice(0, 80);
      if (nom) el.setAttribute('aria-label', nom);
    }
    if (!el.contains(document.activeElement)) {
      const premier = visibles(el)[0];
      if (premier) { try { premier.focus({ preventScroll: true }); } catch (_) {} }
      else { if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); try { el.focus({ preventScroll: true }); } catch (_) {} }
    }
    const touche = (e) => {
      if (e.key === 'Escape' && fermer.current) { e.stopPropagation(); e.preventDefault(); fermer.current(); return; }
      if (e.key !== 'Tab') return;
      const xs = visibles(el); if (!xs.length) { e.preventDefault(); return; }
      const a = xs[0], z = xs[xs.length - 1];
      if (e.shiftKey && (document.activeElement === a || !el.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (document.activeElement === z || !el.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
    };
    el.addEventListener('keydown', touche);
    return () => {
      el.removeEventListener('keydown', touche);
      if (avant && avant.isConnected && typeof avant.focus === 'function') setTimeout(() => { try { avant.focus({ preventScroll: true }); } catch (_) {} }, 0);
    };
  }, [actif]);
  return ref;
}
export default useModaleAccessible;

// Le même comportement en composant, pour une fenêtre rendue sous condition au milieu d'un grand écran (aucun crochet à
// poser en tête du composant) : <ModaleAccessible onFermer={f} label="…" style={…} onClick={f}>…</ModaleAccessible>.
export function ModaleAccessible({ onFermer, label = '', children, ...reste }) {
  const ref = useModaleAccessible(onFermer);
  return React.createElement('div', { ref, role: 'dialog', 'aria-modal': 'true', 'aria-label': label || undefined, ...reste }, children);
}
