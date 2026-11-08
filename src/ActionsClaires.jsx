import React from 'react';

export function ChoixReponses({mode,total,offres,onChoix}) {
  return <div className="vrm-reponses-choix" role="group" aria-label="Réponses à traiter">
    {[['repondre','Tout à répondre',total],['repondre-messages','Messages',Math.max(0,total-offres)],['repondre-offres','Offres',offres]].map(([cle,titre,n])=><button type="button" key={cle} aria-pressed={mode===cle} onClick={()=>onChoix(cle)}>{titre}<span>{n}</span></button>)}
  </div>;
}
export function ResumeOffre({affiche,offre,mini,fmt,photo,titre}) {
  const valeur=v=>typeof v==='number'&&Number.isFinite(v)&&v>0?fmt(v):'—';
  return <div className="vrm-offre-comparer" data-offre-comparer="">
    {photo&&<div className="vrm-offre-photo" aria-hidden="true">{photo}</div>}
    <div className="vrm-offre-comparer-corps">{titre&&<span className="vrm-offre-article">{titre}</span>}
      <dl>{[['affiche','Prix affiché',affiche],['recue','Offre reçue',offre],['mini','Ton minimum',mini]].map(([cle,label,v])=><div key={cle} data-offre-prix={cle}><dt>{label}</dt><dd data-vide={valeur(v)==='—'?'1':undefined}>{valeur(v)}</dd></div>)}</dl>
    </div>
  </div>;
}
export function CompteEmailAVerifier({ambigu,onVerifier}) {
  return <div className="vrm-mail-compte-a-verifier" data-compte-email-inconnu="">
    <span><b>{ambigu?'Compte à préciser':'Compte non identifié'}</b><small>Vérifie l’adresse de réception avant de rattacher cet e-mail.</small></span>
    {onVerifier&&<button type="button" onClick={onVerifier}>Vérifier les adresses</button>}
  </div>;
}
