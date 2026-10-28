import {suiviLeboncoin} from './suiviComptes.js';
import React, {useState} from 'react';
import {resumeReceptionLbc} from './diagnosticLeboncoin.js';
export default function DiagnosticLeboncoin({lire,couleurs}) {
  const [suivi,setSuivi]=useState(undefined);
 const [texte,setTexte]=useState(''),[charge,setCharge]=useState(false),[copie,setCopie]=useState(false);
  const verifier=async()=>{
    setCharge(true);setCopie(false);setTexte('');setSuivi(undefined);
    try {
      const [annonces,comptes,traces,transactions]=await Promise.all([
        lire('app_data?id=eq.lbc_listings&select=items:data->items'),
        lire('app_data?id=eq.lbc_accounts&select=accounts:data->accounts'),
        lire('app_data?id=eq.lbc_recon&select=schemas:data->schemas,paths:data->paths,updatedAt:data->>updatedAt'),
        lire('app_data?id=eq.lbc_ventes&select=ventes:data->ventes'),
      ]);
      setTexte(resumeReceptionLbc({annonces,comptes,traces,transactions}));
      setSuivi(suiviLeboncoin({annonces,comptes,transactions}));
    } catch (_) {setTexte('Impossible de lire le diagnostic. Réessaie dans un moment.');setSuivi(null);}
    finally {setCharge(false);}
  };
  const bouton={border:`1px solid ${couleurs.border}`,borderRadius:8,background:couleurs.card,color:couleurs.text,padding:'8px 12px',font:'inherit',cursor:'pointer'};
  return <details style={{marginBottom:14,fontSize:12,color:couleurs.muted}}>
    <summary style={{cursor:'pointer',padding:'8px 0'}}>Un problème de synchronisation Leboncoin ?</summary>
    <p>Vérifie ce qui est enregistré dans VRM. Le résumé partageable contient uniquement des compteurs et la structure technique reçue.</p>
    {suivi===null&&<p role="status">Le suivi par compte n’a pas pu être lu : aucun compte n’est supposé vide.</p>}
    {Array.isArray(suivi)&&<div className="vrm-suivi-comptes"><p>Seuls les comptes dont une session a été observée sont listés. Les ventes sans correspondance exacte avec une annonce ne sont pas attribuées au hasard.</p>{suivi.map(c=><section key={c.id}><h4>{c.nom}</h4><p>{c.annonces} annonce(s) attribuée(s) · {c.avecPhoto} avec une photo fournie · {c.ventes} vente(s) reliée(s) par identifiant.</p>{c.sansPhoto>0&&<p>{c.sansPhoto} annonce(s) capturée(s) sans URL de photo reçue. Ouvre « Mes annonces » sur le bon compte Leboncoin puis actualise. Une URL présente ne garantit pas le chargement de la photo.</p>}</section>)}</div>}
    <button type="button" disabled={charge} onClick={verifier} style={bouton}>{charge?'Vérification…':'Vérifier la réception Leboncoin'}</button>
    {texte&&<><pre role="status" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,lineHeight:1.6}}>{texte}</pre>
      <button type="button" style={bouton} onClick={async()=>{try{await navigator.clipboard.writeText(texte);setCopie(true);}catch(_){setCopie(false);}}}>{copie?'Diagnostic copié':'Copier le diagnostic'}</button>
    </>}
  </details>;
}
