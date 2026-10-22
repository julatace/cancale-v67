import React, { useEffect, useState } from 'react';
export default function BordereauxAuto({owner,lire,sauver}) {
  const [active,setActive]=useState(false), [pret,setPret]=useState(false), [attente,setAttente]=useState(false), [erreur,setErreur]=useState('');
  useEffect(()=>{let vivant=true; lire(owner).then(v=>{if(vivant){setActive(v);setPret(true);}}).catch(()=>{if(vivant)setErreur('Réglage indisponible. Recharge la page pour réessayer.');});return()=>{vivant=false;};},[owner,lire]);
  const changer=async()=>{setAttente(true);setErreur('');try{await sauver(owner,!active);setActive(!active);}catch{setErreur('Modification non enregistrée. Réessaie.');}finally{setAttente(false);}};
  // Une ligne, au doigt comme à la souris : l'état dans le bouton, la précision
  // en petit à côté (sans « extension 5.204 », du vocabulaire d'informaticien).
  return <div style={{marginBottom:8,fontSize:12,display:'flex',gap:'4px 10px',alignItems:'center',flexWrap:'wrap'}}>
    <button type="button" role="switch" className="vrm-switch-texte" aria-checked={active} disabled={!pret||attente} onClick={changer} style={{font:'inherit',padding:'7px 11px',border:'1px solid currentColor',borderRadius:8,background:'transparent',color:'inherit',cursor:'pointer'}}>
      Bordereaux auto : {attente?'enregistrement…':!pret?'chargement…':active?'activés':'désactivés'}
    </button>
    <span style={{opacity:.72,fontSize:11.5}} title="Avec l'extension VRM 5.204 ou plus récente.">Tu peux toujours générer un bordereau toi-même.</span>
    {erreur&&<span role="alert">{erreur}</span>}
  </div>;
}
