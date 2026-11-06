// La frise « Fusion » : quatre segments de 5 px, un libellé sous chacun.
// Franchi = trait bleu (le seul bleu de la ligne avec le bouton principal) ; le
// MOT à l'encre seulement sur la dernière étape faite (`data-derniere`, 5 nov.) ;
// en cours = gris, ou ambre si un geste est à faire ; à venir = gris. Rien n'est calculé
// ici : les étapes viennent de src/design/friseFusion.js (projection des règles).
// `data-fu-frise` porte l'identité (n° de transaction), chaque segment son
// `data-fu-etape`, `data-fait` (1/0), `data-preuve`, `data-cours` : le banc juge
// la règle sur ces attributs, jamais sur un libellé.
import React from 'react';

export default function Frise({ etapes, cle = '', label = 'Où en est-elle', className = '' }) {
  if (!Array.isArray(etapes) || !etapes.length) return null;
  return (
    <ol className={'vrm-fu-frise' + (className ? ' ' + className : '')} data-fu-frise={cle} aria-label={label}>
      {etapes.map((e) => (
        <li key={e.cle} className="vrm-fu-seg" data-fu-etape={e.cle} data-fait={e.fait ? '1' : '0'} data-preuve={e.preuve || ''}
          data-cours={e.cours ? '' : undefined} data-ton={e.cours ? e.ton : undefined} data-derniere={e.derniere ? '' : undefined}
          aria-current={e.cours ? 'step' : undefined}>
          <i aria-hidden="true" />
          <span>{e.label}<span className="vrm-fu-sr">{e.fait ? ' : fait' : e.cours ? ' : en cours' : ' : à venir'}</span></span>
        </li>
      ))}
    </ol>
  );
}
