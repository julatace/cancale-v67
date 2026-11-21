// Le lien React de la traduction : `useLangue()` rend la langue courante et
// redessine le composant quand elle change (src/i18n/index.js).
// La racine (src/main.jsx) l'appelle : tout l'arbre se redessine au changement ;
// un composant mémorisé (React.memo, useMemo d'un libellé) l'appelle lui-même.
import React from 'react';
import { abonnerLangue, langueCourante, tr } from './index.js';
export function useLangue() {
  return React.useSyncExternalStore(abonnerLangue, langueCourante, langueCourante);
}

// (11 nov., lot 2) Une PHRASE avec des morceaux vivants : `trj('ventes.retours', { n, x: <b>…</b> })`.
// Le texte entier est UNE clé (l'ordre des mots change d'une langue à l'autre) ; chaque {var}
// reçoit sa valeur TELLE QUE React l'aurait rendue : un nombre ou un texte tel quel (jamais de
// séparateur de milliers : un N° reste « 1234 »), rien pour null / undefined / true / false,
// et un élément React reste un élément (le résultat est alors une liste de morceaux).
const rendu = (v) => (v == null || typeof v === 'boolean' ? '' : v);
export function trj(cle, vars) {
  if (!vars) return tr(cle);
  const prim = {}; const objets = {};
  for (const [k, v] of Object.entries(vars)) { const r = rendu(v); if (typeof r === 'object') objets[k] = r; else prim[k] = String(r); }
  // Le pluriel se choisit sur `n` (texte d'un nombre : choisirPluriel le relit en nombre).
  const texte = tr(cle, prim);
  if (!Object.keys(objets).length) return texte;
  // Un élément reste un élément : le texte est coupé à ses marqueurs `{k}` (tr() ne les a pas remplis).
  return texte.split(/\{(\w+)\}/).map((m, i) => (i % 2
    ? (m in objets ? React.createElement(React.Fragment, { key: 'v' + i }, objets[m]) : `{${m}}`)
    : m));
}
