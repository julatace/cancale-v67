// ═══════════════════════════════════════════════════════════════════════════
// LA VIGNETTE SANS PHOTO — un seul dessin (5 nov., revue de cohérence 2.8)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. sur Annonces : quatre vignettes « sans photo » (texte
// « pas de photo », carré vide, cœur, icône d'image de 20 px dans une case
// de 44) selon la carte. Une seule désormais : la case du gris des photos
// (`--vrm-photo`, #F2F2F7 / #2C2C2E), l'icône d'image au trait, centrée, à
// ~40 % de la case, en gris secondaire atténué. Aucun mot dedans (la ligne dit
// déjà ce qu'est l'article) ; le nom lu est « Pas de photo ».
// API : <PhotoVide taille? rayon? remplir? titre? className? style? {...data-*}>
//   · taille : côté en px (défaut 56) ; `remplir` : prend toute la place du parent
//     (une case de grille, un `position:absolute; inset:0`) ;
//   · rayon : défaut 14 (--r-case, les vignettes), 12 sous 44 px.
// Porte `data-photo-vide` (le sélecteur que styles-vitrine.css connaît déjà).
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';
import { IconeComposant } from './icones.jsx';

export function PhotoVide({ taille = 56, rayon, remplir = false, titre = 'Pas de photo', className = '', style, ...rest }) {
  const cote = remplir ? null : Math.max(16, Number(taille) || 56);
  const r = rayon != null ? rayon : (cote != null && cote < 44 ? 12 : 14);
  const icone = Math.round(Math.max(14, Math.min(32, (cote || 72) * 0.4)));
  return (
    <span role="img" aria-label={titre} data-photo-vide="" className={`vrm-photo-vide${remplir ? ' vrm-photo-vide-remplir' : ''}${className ? ' ' + className : ''}`}
      style={{ ...(cote != null ? { width: cote, height: cote } : {}), borderRadius: r, ...(style || {}) }} {...rest}>
      <IconeComposant nom="image" taille={icone} trait={1.6}/>
    </span>
  );
}

export default PhotoVide;
