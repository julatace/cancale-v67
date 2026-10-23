import React, {useState} from 'react';
import './recus-email.css';
export default function RecusEmail({recus,autres=0,onOuvrir,onActualiser}) {
 const [recherche,setRecherche]=useState(''),[max,setMax]=useState(10);
 const q=recherche.trim().toLocaleLowerCase('fr');
 const liste=Array.isArray(recus)?recus.filter(r=>[r.article,r.subject,r.account,r.transaction].some(v=>String(v||'').toLocaleLowerCase('fr').includes(q))).slice().sort((a,b)=>(Date.parse(b.receivedAt)||0)-(Date.parse(a.receivedAt)||0)):[];
 return <details className="vrm-recus-email" data-recus-email=""><summary>Reçus d’achat par email{Array.isArray(recus)?` · ${recus.length}`:''}</summary>
 <p>Tous tes comptes · Ces justificatifs restent accessibles même sans synchronisation Vinted.</p>
 {recus===undefined ? <p role="status">Lecture des reçus…</p> : recus===null ? <div role="status">Les reçus n’ont pas pu être lus.<button type="button" onClick={onActualiser}>Réessayer</button></div> : <>
 <button type="button" onClick={onActualiser}>Actualiser les reçus</button>
 {recus.length>0&&<input type="search" aria-label="Rechercher un reçu par email" value={recherche} onChange={e=>{setRecherche(e.target.value);setMax(10);}} placeholder="Article, compte ou transaction"/>}
 {!liste.length&&<p>{recus.length?'Aucun reçu pour cette recherche.':'Aucun reçu d’achat reçu par email pour le moment.'}</p>}
 {autres>0&&<p data-recus-autres={autres}>{autres===1?'1 autre email de commande (mise à jour, confirmation, retour) n’est pas un reçu : il n’est pas listé ici.':`${autres} autres emails de commande (mises à jour, confirmations, retours) ne sont pas des reçus : ils ne sont pas listés ici.`}</p>}
 <ul>{liste.slice(0,max).map((r,i)=><li key={r._emailId||i}><button type="button" onClick={()=>onOuvrir(r)}><span><strong>{r.article||r.subject||'Reçu d’achat Vinted'}</strong><small>{[r.account,r.receivedAt&&Number.isFinite(Date.parse(r.receivedAt))?new Date(r.receivedAt).toLocaleDateString('fr-FR'):'',r.transaction?`Transaction ${r.transaction}`:''].filter(Boolean).join(' · ')||'Compte non identifié dans l’email'}</small></span><span aria-hidden="true">Voir ›</span></button></li>)}</ul>
 {liste.length>max&&<button type="button" onClick={()=>setMax(n=>n+10)}>Afficher les reçus suivants ({liste.length-max})</button>}
 </>}
 </details>;
}
