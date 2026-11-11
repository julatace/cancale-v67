import React from 'react';
import {comparaisonMinimum} from './actionsClaires.js';
import { tr } from './i18n/index.js';

export function ChoixReponses({mode,total,offres,onChoix}) {
  return <div className="vrm-reponses-choix" role="group" aria-label={tr('messages.reponsesTraiter')}>
    {[['repondre','Tout à répondre',total],['repondre-messages','Messages',Math.max(0,total-offres)],['repondre-offres','Offres',offres]].map(([cle,titre,n])=><button type="button" key={cle} aria-pressed={mode===cle} onClick={()=>onChoix(cle)}>{titre}<span>{n}</span></button>)}
  </div>;
}
export function ResumeOffre({affiche,offre,mini,fmt,photo,titre}) {
  const valeur=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?fmt(v):'—';
  const comparaison=comparaisonMinimum(offre,mini);
  return <div className="vrm-offre-comparer" data-offre-comparer="">
    {photo&&<div className="vrm-offre-photo" aria-hidden="true">{photo}</div>}
    <div className="vrm-offre-comparer-corps">{titre&&<span className="vrm-offre-article">{titre}</span>}
      <dl>{[['affiche','Prix affiché',affiche],['recue','Offre reçue',offre],['mini','Ton minimum',mini]].map(([cle,label,v])=><div key={cle} data-offre-prix={cle}><dt>{label}</dt><dd data-vide={valeur(v)==='—'?'1':undefined}>{valeur(v)}</dd></div>)}</dl>
      <p className="vrm-offre-repere" data-offre-niveau={comparaison.etat}>{comparaison.etat==='sous-minimum'?tr('messages.sousMinimum', { fmt: String(fmt(comparaison.ecart)) }):comparaison.etat==='minimum-atteint'?tr('messages.minimumAtteint'):comparaison.etat==='minimum-inconnu'?tr('messages.minimumNonRenseigne'):tr('messages.montantOffreNon')}</p>
    </div>
  </div>;
}
export function CompteEmailAVerifier({ambigu,onVerifier}) {
  return <div className="vrm-mail-compte-a-verifier" data-compte-email-inconnu="">
    <span><b>{ambigu?tr('messages.comptePreciser'):tr('messages.compteNonIdentifie')}</b><small>{tr('messages.verifieAdresseReception')}</small></span>
    {onVerifier&&<button type="button" onClick={onVerifier}>{tr('messages.verifierAdresses')}</button>}
  </div>;
}
