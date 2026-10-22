import React, {useState} from 'react';
import {resumeReceptionLbc} from './diagnosticLeboncoin.js';
export default function DiagnosticLeboncoin({lire,couleurs}) {
  const [texte,setTexte]=useState(''),[charge,setCharge]=useState(false),[copie,setCopie]=useState(false);
  const verifier=async()=>{
    setCharge(true);setCopie(false);
    try {
      const [annonces,comptes,traces,transactions]=await Promise.all([
        lire('app_data?id=eq.lbc_listings&select=items:data->items'),
        lire('app_data?id=eq.lbc_accounts&select=accounts:data->accounts'),
        lire('app_data?id=eq.lbc_recon&select=schemas:data->schemas,paths:data->paths,updatedAt:data->>updatedAt'),
        lire('app_data?id=eq.lbc_ventes&select=ventes:data->ventes'),
      ]);
      setTexte(resumeReceptionLbc({annonces,comptes,traces,transactions}));
    } catch (_) {setTexte('Impossible de lire le diagnostic. Réessaie dans un moment.');}
    finally {setCharge(false);}
  };
  const bouton={border:`1px solid ${couleurs.border}`,borderRadius:8,background:couleurs.card,color:couleurs.text,padding:'8px 12px',font:'inherit',cursor:'pointer'};
  return <details style={{marginBottom:14,fontSize:12,color:couleurs.muted}}>
    <summary style={{cursor:'pointer',padding:'8px 0'}}>Un problème de synchronisation Leboncoin ?</summary>
    <p>Vérifie ce qui est enregistré dans VRM. Le résumé partageable contient uniquement des compteurs et la structure technique reçue.</p>
    <button type="button" disabled={charge} onClick={verifier} style={bouton}>{charge?'Vérification…':'Vérifier la réception Leboncoin'}</button>
    {texte&&<><pre role="status" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,lineHeight:1.6}}>{texte}</pre>
      <button type="button" style={bouton} onClick={async()=>{try{await navigator.clipboard.writeText(texte);setCopie(true);}catch(_){setCopie(false);}}}>{copie?'Diagnostic copié':'Copier le diagnostic'}</button>
    </>}
  </details>;
}
