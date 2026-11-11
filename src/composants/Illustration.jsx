// ═══════════════════════════════════════════════════════════════════════════
// LES PETITS DESSINS DES ÉTATS VIDES (6 nov., v36-visuel-2)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « je veux quelque chose de parfait et de beau ». Un écran vide n'est
// pas un trou : un dessin au trait, sobre, toujours le même dessin pour la même
// idée (une basket, un colis, un sac, un maillon, une étiquette, une enveloppe),
// une phrase, le geste. Une seule écriture pour tous : trait de 1,75 à l'encre
// atténuée (`currentColor`), aplats au gris des cases (`--vrm-card2`), une ombre
// au sol. AUCUNE couleur (§7) ; décoratif (`aria-hidden`), la phrase dit tout.
// Les noms d'icônes de l'app y mènent (`depuisIcone`), un nom inconnu ⇒ la basket.
// ═══════════════════════════════════════════════════════════════════════════
import React from 'react';

const T = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };
const A = { fill: 'var(--vrm-card2, #F2F2F7)' };

const DESSINS = {
  // Une basket de profil, posée.
  basket: (<g transform="translate(0 14)">
    <path {...A} d="M22 58c0-8 3-14 11-15l13-2 10-11c2-2 4-2 6 0l5 6c6 7 15 10 26 12 6 1 9 4 9 10v4H22z" />
    <path {...T} d="M22 58c0-8 3-14 11-15l13-2 10-11c2-2 4-2 6 0l5 6c6 7 15 10 26 12 6 1 9 4 9 10v4H22z" />
    <path {...T} d="M22 62h80M46 41l5 4M52 36l5 4M58 32l4 4" />
  </g>),
  // Un colis fermé, son ruban.
  boite: (<>
    <path {...A} d="M60 22 92 34v30L60 76 28 64V34z" />
    <path {...T} d="M60 22 92 34v30L60 76 28 64V34z" />
    <path {...T} d="M28 34l32 12 32-12M60 46v30M44 28l32 12v10" />
  </>),
  // Un sac d'achat.
  sac: (<>
    <path {...A} d="M34 36h52l-4 38H38z" />
    <path {...T} d="M34 36h52l-4 38H38z" />
    <path {...T} d="M48 42v-8a12 12 0 0 1 24 0v8" />
  </>),
  // Deux maillons qui se cherchent.
  lien: (<>
    <rect {...A} x="24" y="40" width="40" height="22" rx="11" transform="rotate(-20 44 51)" />
    <rect {...T} x="24" y="40" width="40" height="22" rx="11" transform="rotate(-20 44 51)" />
    <rect {...T} x="56" y="30" width="40" height="22" rx="11" transform="rotate(-20 76 41)" />
  </>),
  // Une étiquette de prix et son fil.
  etiquette: (<>
    <path {...A} d="M40 30h28l22 22-24 24-26-26z" />
    <path {...T} d="M40 30h28l22 22-24 24-26-26z" />
    <circle {...T} cx="52" cy="42" r="3.5" />
    <path {...T} d="M49 39c-8-8-18-6-20 2" />
  </>),
  // Une enveloppe.
  courrier: (<>
    <rect {...A} x="28" y="30" width="64" height="42" rx="6" />
    <rect {...T} x="28" y="30" width="64" height="42" rx="6" />
    <path {...T} d="m30 33 30 22 30-22" />
  </>),
};
const PAR_ICONE = { bag: 'sac', cart: 'sac', link: 'lien', tag: 'etiquette', box: 'boite', truck: 'boite', doc: 'boite', mail: 'courrier', chat: 'courrier' };
export const depuisIcone = (icone) => PAR_ICONE[icone] || 'basket';
export const NOMS_ILLUSTRATIONS = Object.keys(DESSINS);
// (11 nov., lot DJ2) Julien : « arrête de faire allusion à des chaussures ». La basket
// n'est dessinée que pour un vendeur de sneakers ; sinon l'étiquette (un article).
export const dessinDe = (nom, vend) => { const n = DESSINS[nom] ? nom : 'basket'; return n === 'basket' && vend !== 'sneakers' ? 'etiquette' : n; };

export default function Illustration({ nom = 'basket', taille = 120, className = '', vend = 'sneakers' }) {
  const n = dessinDe(nom, vend);
  const d = DESSINS[n];
  return (
    <svg className={'vrm-illustration ' + className} data-illustration={n} width={taille} height={Math.round(taille * 0.75)} viewBox="0 0 120 90" aria-hidden="true" focusable="false">
      <ellipse cx="60" cy="80" rx="38" ry="4.5" fill="currentColor" opacity=".08" />
      {d}
    </svg>
  );
}
