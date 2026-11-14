// IDÉE 153 — le bloc « Ce que demande {plateforme} » (règle : consignesColis.js). Court, repliable,
// une fois par plateforme ; le délai LU pour ce colis s'il existe, sinon la règle de la plateforme.
import React from 'react';
import { tr } from '../i18n/index.js';
import { consignesPour } from './consignesColis.js';
import './expedition.css';

export default function ConsignesColis({ site, limite = '', ouvert: ouvertDepart = false }) {
  const c = consignesPour(site, limite);
  const [ouvert, setOuvert] = React.useState(!!ouvertDepart);
  if (!c) return null;
  return (
    <div className="vrm-exp vrm-exp-consignes" data-consignes={site} data-consignes-ouvert={ouvert ? '1' : '0'}>
      <button type="button" className="sb-lien" aria-expanded={ouvert ? 'true' : 'false'} onClick={() => setOuvert((v) => !v)}>
        {tr(c.titre)}<span aria-hidden="true">{ouvert ? ' ˄' : ' ›'}</span>
      </button>
      {ouvert ? <ul className="vrm-exp-consignes-liste">
        {c.lignes.map((k) => <li key={k} data-consigne={k}>{tr(k)}</li>)}
        <li data-consigne-delai={c.delai.cle}>{tr(c.delai.cle, c.delai.vars)}</li>
      </ul> : null}
    </div>
  );
}
