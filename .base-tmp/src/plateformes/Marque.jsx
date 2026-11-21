// ── LA MARQUE D'UNE PLATEFORME, EN LIGNE (15 nov.) ───────────────────────────
// Les tracés et leur origine : src/plateformes/marques.js (UNE source). Un <svg> en
// ligne, à la couleur du texte (`currentColor`) : net à toute taille, jamais une image
// chargée, jamais une couleur de marque. `taille` = la hauteur de la rangée (px) ; chaque
// marque y prend SA hauteur optique (`echelle`) ; `carre` la pose dans une boîte carrée
// (en ligne d'un texte : la même largeur pour les quatre).
import React from 'react';
import { marque, cadreCarre } from './marques.js';

export default function MarquePlateforme({ site, taille = 18, carre = false, className = '', style }) {
  const m = marque(site);
  if (!m) return null;
  const vb = carre ? cadreCarre(m) : m.vb;
  const h = carre ? taille : Math.round(taille * m.echelle * 10) / 10;
  const w = carre ? taille : Math.round((h * vb[2] / vb[3]) * 10) / 10;
  return (
    <svg className={'vrm-marque' + (className ? ' ' + className : '')} data-marque={site} viewBox={vb.join(' ')} width={w} height={h}
      aria-hidden="true" focusable="false" style={style}>
      {m.elements.map((e, i) => e.trait
        ? <path key={i} d={e.d} fill={e.plein ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={e.trait} strokeLinecap="round" strokeLinejoin="round"/>
        : <path key={i} d={e.d} fill="currentColor"/>)}
    </svg>
  );
}
