// Les quelques icônes dont les composants partagés ont besoin, au MÊME trait que
// `Icon` / `ICON_PATHS` de src/App.jsx (24×24, trait 1,7, bouts ronds) — mêmes
// tracés, recopiés ici parce qu'un composant hors d'App.jsx ne peut pas lire
// `ICON_PATHS` (non exporté). Une icône absente rend `null` (jamais un carré vide).
import React from 'react';

const TRACES = {
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m15.8 15.8 4.4 4.4"/></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/><path d="M8.5 21h7"/></>,
  image: <><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="10" r="1.8"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/></>,
};

export function IconeComposant({ nom, taille = 18, trait = 1.7 }) {
  const d = TRACES[nom]; if (!d) return null;
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={trait} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      style={{ display: 'block', flexShrink: 0 }}>{d}</svg>
  );
}
