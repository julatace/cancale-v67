// ── src/natif/Puce.jsx — la PUCE d'une rangée de filtres (24 nov., visuel-annonces) ──────────────────────────────
// Un filtre qu'on allume et éteint (`presse` : vrai / faux ⇒ aria-pressed), ou un menu (`presse` absent, `attrs`
// porte aria-haspopup). Le dessin vient de la classe donnée par l'écran (ex. `n-ad-puce`) : la puce ne décide que du
// geste et de l'accessibilité. Les écrans propres passent par elle, jamais par un <button> brut (audit-boutons-natifs).
import React from 'react';
import { cx } from './outils.js';

export function Puce({ presse, onClick, className = '', attrs = null, children }) {
  return (
    <button type="button" className={cx(className)} aria-pressed={presse === undefined ? undefined : (presse ? 'true' : 'false')} onClick={onClick} {...(attrs || {})}>
      {children}
    </button>
  );
}
export default Puce;
