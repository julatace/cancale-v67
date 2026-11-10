// (10 nov., textes courts 4e série) « Pourquoi ? » replié, pour les modules qui
// ne lisent pas App.jsx (Favoris, Organisation, Communauté : chargés à la demande,
// sans import circulaire). Même classe que le `Pourquoi` d'App.jsx (`vrm-pourquoi`
// écrit) : une phrase courte reste à l'écran, le détail d'avant est ici, entier.
import React from 'react';

export default function PourquoiReplie({ children, label = 'Pourquoi ?', ...rest }) {
  return <details className="vrm-pourquoi vrm-pourquoi-ecrit" data-pourquoi="" {...rest}>
    <summary>ⓘ {label}</summary>
    <div>{children}</div>
  </details>;
}
