// ════════════════════════════════════════════════════════════════════════════
//  LE GESTE DE LA FICHE « DANS UNE AUTRE TAILLE » (14 nov., idée 157) — rangé parmi les
//  outils de la fiche de la paire, à côté de « Dupliquer ». Une touche, jamais un plein
//  (le plein de la fiche est le geste du contexte). Pas d'annonce à copier ⇒ pas de touche.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { tr } from '../i18n/index.js';
import AutreTaille from './AutreTaille.jsx';
import '../paireHistoire/idees.css';

export default function OutilsFiche({ numero = '', source = null, bloque = '', onCreerTaille, Retour = null }) {
  const [ouvert, setOuvert] = React.useState(false);
  if (!source || !onCreerTaille) return null;
  return (
    <span className="vrm-idees vrm-idees-outils">
      <button type="button" className="sb-touche" data-fiche-autre-taille={numero} onClick={() => setOuvert(true)}>{tr('at.bouton')}</button>
      {ouvert ? <AutreTaille src={source} numero={numero} bloque={bloque} Retour={Retour} onFermer={() => setOuvert(false)}
        onCreer={async (champs) => { const r = await onCreerTaille(champs); if (r && r.ok) setOuvert(false); return r; }}/> : null}
    </span>
  );
}
