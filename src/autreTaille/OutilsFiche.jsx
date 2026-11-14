// ════════════════════════════════════════════════════════════════════════════
//  LES DEUX GESTES DE LA FICHE (14 nov., idées 156 et 157) — rangés parmi les outils
//  de la fiche de la paire (à côté de « Dupliquer ») :
//   · « Dans une autre taille » (une annonce à copier : `source`) ⇒ ./AutreTaille.jsx ;
//   · « Remplir avec un modèle » (une fiche « À publier » : `neuve`) ⇒ RemplirModele.
//  Deux touches, jamais un plein (le plein de la fiche est le geste du contexte).
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import AutreTaille from './AutreTaille.jsx';
import RemplirModele from '../modelesDescription/RemplirModele.jsx';
import '../paireHistoire/idees.css';

export default function OutilsFiche({ numero = '', neuve = null, source = null, modeles = [], reglages = {}, onCreerTaille, onPoserDescription, onGererModeles = null, Retour = null }) {
  const [ouvert, setOuvert] = React.useState('');
  return (
    <span className="vrm-idees vrm-idees-outils">
      {source && onCreerTaille ? <button type="button" className="sb-touche" data-fiche-autre-taille={numero} onClick={() => setOuvert('taille')}>{tr('at.bouton')}</button> : null}
      {neuve && onPoserDescription ? <button type="button" className="sb-touche" data-fiche-remplir-modele={neuve.numero} onClick={() => setOuvert('modele')}>{tr('md.bouton')}</button> : null}
      {ouvert === 'taille' ? <AutreTaille src={source} numero={numero} modeles={modeles} reglages={reglages} Retour={Retour} onFermer={() => setOuvert('')}
        onCreer={async (champs, finir) => { const r = await onCreerTaille(champs, finir); if (r && r.ok) setOuvert(''); return r; }}/> : null}
      {ouvert === 'modele' ? <RemplirModele fiche={neuve} modeles={modeles} reglages={reglages} Retour={Retour} onGerer={onGererModeles} onFermer={() => setOuvert('')}
        onPoser={(d) => onPoserDescription(neuve, d)}/> : null}
    </span>
  );
}
