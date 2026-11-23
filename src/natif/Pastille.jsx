// ── src/natif/Pastille.jsx — un compte ou un état court, dans une pilule ─────────────────
// Props :
//   ton       'neutre' (défaut) | 'accent' | 'ambre' | 'ambre-plein' | 'doublon'
//             ambre = un geste à faire ; doublon = SEULEMENT deux paires sous un N° (CLAUDE.md §7).
//   libelle   ce que dit le lecteur d'écran quand le contenu est un nombre nu (« 3 messages non lus »)
//   children  le nombre ou le mot (« 3 », « 99+ », « À envoyer »)
// Un nombre nul ou absent ne dessine RIEN (pas de pastille « 0 »).
// Exemple :
//   <Pastille ton="ambre">À envoyer</Pastille>
//   <Pastille ton="ambre-plein" libelle="3 messages non lus">{3}</Pastille>
import React from 'react';
import { cx } from './outils.js';

// Un compte au-delà de 99 s'écrit « 99+ » : la pastille garde sa taille.
export const comptePastille = (n) => (typeof n === 'number' ? (n > 99 ? '99+' : String(n)) : n);

export function Pastille({ ton = 'neutre', libelle = '', className = '', children }) {
  if (children == null || children === false || children === 0 || children === '') return null;
  return (
    <span className={cx('n-pastille', className)} data-n-ton={ton} aria-label={libelle || undefined} role={libelle ? 'img' : undefined}>
      {comptePastille(children)}
    </span>
  );
}

export default Pastille;
