// (10 nov., lot K) « Vu à 14:32 · pas relu » : des listes gardées sur l'appareil
// n'ont pas pu être relues (src/copieLignes.js). Discret, neutre (ni ambre ni
// rouge : aucun geste à faire), jamais « à jour ». Rien quand tout est relu.
import React from 'react';
import './styles-copie.css';
import { ecouterCopies, etatCopies, heureVu } from './copieLignes.js';

export default function MentionCopie() {
  const [etat, setEtat] = React.useState(() => etatCopies());
  React.useEffect(() => ecouterCopies(() => setEtat(etatCopies())), []);
  if (!etat) return null;
  const h = heureVu(etat.vuA);
  return <div className="vrm-copie-hote" role="status">
    <div className="vrm-copie" data-copie-pas-relu={etat.n} data-copie-vu={Number.isFinite(etat.vuA) ? etat.vuA : undefined}>
      <span className="vrm-copie-point" aria-hidden="true"/>
      <span>{h ? `Vu à ${h} · pas relu` : 'Pas relu'}</span>
    </div>
  </div>;
}
