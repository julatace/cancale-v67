// (3 nov., Julien, capture de Ma journée : « les couleurs, tout ça j'aime pas trop ; il faut
// que ce soit les PHOTOS en tout petit — s'il y en a plusieurs, des photos SUPERPOSÉES pour
// qu'on voie de quoi il s'agit ») LA VIGNETTE D'UNE LIGNE « À FAIRE ».
//
// Une photo (44 px, rayon 10) ; plusieurs : une pile de 2 ou 3 vignettes décalées (bord de la
// couleur de la carte, ombre légère) et, s'il y a plus d'articles que de vignettes, le reste en
// petite pastille NEUTRE (« +4 »). Aucune photo connue : une tuile neutre et une icône sobre.
//
// ⚠️ CE COMPOSANT NE CHERCHE AUCUNE PHOTO. Chaque `src` lui est passée par l'écran, qui la tient
// de L'IDENTITÉ de l'article (sa vente, sa transaction, son N°, son annonce — §5) ; jamais d'un
// titre. `srcs` peut contenir des trous (null) : ils sont ignorés, jamais remplacés.
// Banc : scripts/bancs/journee-photos.cjs (data-pile-*, data-vignette-src).
import React from 'react';

export const PILE_MAX = 3;

// Les photos à montrer : sans trou, sans doublon, au plus trois, dans l'ordre reçu (le plus
// pressé d'abord, l'ordre de la liste de l'écran).
export function photosDePile(srcs, mortes) {
  const vues = new Set(), out = [];
  for (const s of srcs || []) {
    const u = typeof s === 'string' ? s.trim() : '';
    if (!u || vues.has(u) || (mortes && typeof mortes.has === 'function' && mortes.has(u))) continue;
    vues.add(u); out.push(u);
    if (out.length >= PILE_MAX) break;
  }
  return out;
}

export function PileVignettes({ srcs, n = 0, Photo, icone = null, mortes, onMorte, className = '', ...attrs }) {
  const photos = photosDePile(srcs, mortes);
  const total = Math.max(0, Number(n) || 0);
  // Le reste : les articles que la pile ne montre pas (jamais négatif ; sans photo, la tuile
  // n'en porte pas — le titre de la ligne dit le nombre).
  const reste = photos.length ? Math.max(0, total - photos.length) : 0;
  return (
    <span className={'vrm-pile' + (photos.length > 1 ? ' is-pile' : '') + (photos.length ? '' : ' is-vide') + (className ? ' ' + className : '')}
      aria-hidden="true" data-pile="" data-pile-n={String(total)} data-pile-photos={String(photos.length)} data-pile-plus={String(reste)} {...attrs}>
      {photos.length
        ? photos.map((src, k) => (
            <span key={src} className="vrm-pile-v" data-vignette-src={src} style={{ '--k': k, zIndex: PILE_MAX - k }}>
              {Photo ? <Photo src={src} alt="" loading="lazy" decoding="async" onError={onMorte ? () => onMorte(src) : undefined}/> : <img src={src} alt="" data-vrm-vignette="" loading="lazy"/>}
            </span>
          ))
        : <span className="vrm-pile-v is-tuile">{icone}</span>}
      {reste > 0 ? <span className="vrm-pile-plus" data-pile-reste={String(reste)}>{reste > 999 ? '999+' : '+' + reste}</span> : null}
    </span>
  );
}
