// ── (14 nov., proposition 104) Dans la loupe : « Photos bleues › » quand il tape une couleur ──
// La ligne n'apparaît que si la requête contient un mot de couleur (5 langues,
// src/couleurPhoto.js) ; elle ouvre la feuille « Chercher par couleur ». Rien n'est lu
// ici : la feuille lit les couleurs gardées sur l'appareil au toucher.
import React from 'react';
import { couleurDeRequete, nomCouleur, TEINTES } from './couleurPhoto.js';
import { tr, langueCourante } from './i18n/index.js';
import './styles-atelier-photos.css';

export default function LigneCouleurLoupe({ q, onOuvrir }) {
  const c = couleurDeRequete(q);
  if (!c) return null;
  return (
    <div className="vrm-atl-carte" style={{ margin: '8px 0 4px' }}>
      <button type="button" className="vrm-atl-rangee" data-recherche-couleur={c.famille} onClick={() => onOuvrir(c.famille)}>
        <span className="vrm-atl-pastille" style={{ background: TEINTES[c.famille] }} aria-hidden="true"/>
        <span className="vrm-atl-rangee-txt"><b className="vrm-atl-lien">{tr('atelier.couleur.loupe', { couleur: nomCouleur(c.famille, langueCourante()) })}</b><small>{tr('atelier.couleur.loupeSous')}</small></span>
      </button>
    </div>
  );
}
