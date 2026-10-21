import React, { useEffect, useState } from 'react';
export default function BordereauxAuto({owner,lire,sauver}) {
  const [active,setActive]=useState(false), [pret,setPret]=useState(false), [attente,setAttente]=useState(false), [erreur,setErreur]=useState('');
  useEffect(()=>{let vivant=true; lire(owner).then(v=>{if(vivant){setActive(v);setPret(true);}}).catch(()=>{if(vivant)setErreur('Réglage indisponible. Recharge la page pour réessayer.');});return()=>{vivant=false;};},[owner,lire]);
  const changer=async()=>{setAttente(true);setErreur('');try{await sauver(owner,!active);setActive(!active);}catch{setErreur('Modification non enregistrée. Réessaie.');}finally{setAttente(false);}};
  return <div style={{marginBottom:12,fontSize:12,display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
    <button type="button" role="switch" aria-checked={active} disabled={!pret||attente} onClick={changer} style={{font:'inherit',padding:'7px 11px',border:'1px solid currentColor',borderRadius:8,background:'transparent',color:'inherit',cursor:'pointer'}}>
      Bordereaux automatiques · {attente?'Enregistrement…':!pret?'Chargement…':active?'Activés':'Désactivés'}
    </button>
    <span>Génération manuelle toujours disponible · extension 5.204 minimum</span>
    {erreur&&<span role="alert">{erreur}</span>}
  </div>;
}
