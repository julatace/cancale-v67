// ── src/natif/icones.jsx — les icônes du design natif sont CELLES DE L'APP ───────────────
// Le natif n'invente aucune icône : il dessine avec `Icon` (src/App.jsx, `ICON_PATHS`).
//   • Une icône de CONTENU (onglet, rangée, état vide) se passe en prop, déjà faite :
//       <Rangee icone={<Icon name="box" size={22}/>} …/>
//   • Les SEPT glyphes que les composants dessinent eux-mêmes (chevron, coche, loupe, croix,
//     « ⋯ », scanner, image) viennent du même `Icon`, posé UNE fois par l'app :
//       import { poserIcone } from './natif/index.js';   poserIcone(Icon);
//     Rien de posé (un composant monté seul, sans l'app) ⇒ le glyphe ne dessine rien et ne lève rien.
// Noms utilisés (tous présents dans ICON_PATHS) : chevron · check · search · close · more · scan · image · pencil · trash · plus.
import React from 'react';

let _Icon = null;
export function poserIcone(C) { _Icon = typeof C === 'function' ? C : null; }
export function iconePosee() { return !!_Icon; }

export const GLYPHES = Object.freeze(['chevron', 'check', 'search', 'close', 'more', 'scan', 'image', 'pencil', 'trash', 'plus']);   // (20 nov.) + crayon, corbeille, plus : les boutons d'icône des écrans natifs (jamais un emoji)

export function Glyphe({ nom, taille = 20, className = '' }) {
  const C = _Icon;
  return (
    <span className={'n-glyphe' + (className ? ' ' + className : '')} data-n-glyphe={nom} aria-hidden="true">
      {C ? <C name={nom} size={taille}/> : null}
    </span>
  );
}
