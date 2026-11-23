// ── src/natif/Colonnes.jsx — deux colonnes à l'ordinateur, une seule au téléphone ─────────
// Ajouté le 19 nov. pour « Aujourd'hui » (Julien : « à l'ordinateur, la même chose en deux ou trois colonnes »).
// Au téléphone (< 1024 px) les colonnes s'effacent (`display: contents`) : les groupes se suivent comme si elles
// n'existaient pas, dans l'ordre où l'écran les a écrits (la première colonne, puis la seconde). À l'ordinateur :
// une grille de colonnes égales, chacune ses groupes de haut en bas ; le contenu est borné à 1120 px. Le plein d'une
// page à colonnes ne s'étire plus sur tout l'écran : il se pose à droite, à sa largeur (comme le bouton par défaut
// d'une fenêtre macOS).
// Props :
//   <Colonnes>   children = des <Colonne> ; attrs : data-* de l'écran
//   <Colonne>    children = des <Groupe> ; attrs
// Exemple :
//   <Page titre="Aujourd'hui" plein={…}>
//     <Colonnes>
//       <Colonne><Groupe>…chiffres…</Groupe><Groupe titre="Novembre">…</Groupe></Colonne>
//       <Colonne><Groupe titre="À envoyer">…</Groupe><Groupe titre="À retirer">…</Groupe></Colonne>
//     </Colonnes>
//   </Page>
// ⚠️ Rends <Colonnes> DIRECTEMENT dans <Page> (c'est ce qui permet au plein de se poser à droite, sans `:has()`).
import React from 'react';
import { cx } from './outils.js';
import './complements.css';

export function Colonnes({ className = '', attrs = null, children }) {
  return <div className={cx('n-colonnes', className)} {...(attrs || {})}>{children}</div>;
}

// `pleine` : la colonne traverse toute la grille à l'ordinateur (les tuiles de chiffres, en tête).
// `large` (22 nov., style-clarte) : la colonne prend DEUX colonnes de la grille d'un tableau de bord (`n-colonnes-tb`).
export function Colonne({ pleine = false, large = false, className = '', attrs = null, children }) {
  return <div className={cx('n-colonne', className)} data-n-pleine={pleine ? '' : undefined} data-n-large={large ? '' : undefined} {...(attrs || {})}>{children}</div>;
}

export default Colonnes;
