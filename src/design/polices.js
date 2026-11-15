// ── src/design/polices.js — précharger les deux polices du Studio (14 nov.) ─────────
// Importé par src/App.jsx : il ne part qu'avec le morceau de l'APP (jamais pour un visiteur
// de la page d'accueil). Les deux fichiers sont ceux que studio-polices.css nomme (même
// fichier, même nom calculé par Vite : un seul téléchargement). Précharger évite le saut de
// police au premier écran ; `crossorigin` est exigé pour une police, même servie d'ici.
import inter from './polices/inter-latin-wght-normal.woff2?url';

export const POLICES = Object.freeze([inter]);   // (15 nov.) Inter seule : Urbanist retirée

export function prechargerPolices(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || !doc.head) return 0;
  let n = 0;
  for (const href of POLICES) {
    try {
      if (doc.head.querySelector(`link[rel="preload"][href="${href}"]`)) continue;
      const l = doc.createElement('link');
      l.rel = 'preload'; l.as = 'font'; l.type = 'font/woff2'; l.href = href; l.crossOrigin = 'anonymous';
      l.setAttribute('data-sb-police', '');
      doc.head.appendChild(l); n++;
    } catch (_) { /* un document sans <head> accessible ne doit rien casser */ }
  }
  return n;
}
prechargerPolices();
