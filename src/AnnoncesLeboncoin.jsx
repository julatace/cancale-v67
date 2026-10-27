import React,{useMemo,useState} from 'react';
import {etatAnnonceLeboncoin,lienAnnonceLeboncoin} from './etatAnnonceLeboncoin.js';
import './annonces-leboncoin.css';
const euros = n => n != null && n !== '' && /^\d+(\.\d+)?$/.test(String(n)) && Number.isFinite(Number(n)) ? new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(n)) : '—';
function Photo({src}) {
 const [ko,setKo]=useState(false);
 let url='';try {const u=new URL(src);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href;}catch{}
 return url&&!ko ? <img src={url} alt="" loading="lazy" onError={()=>setKo(true)}/> : <span aria-label="Photo indisponible" className="vrm-lbc-catalog-photo-empty">—</span>;
}
export default function AnnoncesLeboncoin({annonces=[],ventes={},lectureKO=false}) {
 const [recherche,setRecherche]=useState(''),[filtre,setFiltre]=useState('toutes');
 const lignes=useMemo(()=>annonces.map(ad=>({ad,...etatAnnonceLeboncoin(ad,ventes)})),[annonces,ventes]);
 const choix=[['toutes','Toutes'],['active','Actives'],['pause','En pause'],['vendue','Vendues'],['autres','Autres états']];
 const visibles=lignes.filter(l=>(filtre==='toutes'||(filtre==='autres'?!['active','pause','vendue'].includes(l.etat):l.etat===filtre))
  && [l.ad.subject,l.ad.title,l.ad.accountName,l.ad.ref].join(' ').toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr')));
 return <section className="vrm-lbc-catalog" aria-label="Mes annonces Leboncoin">
  <header><div><h2>Mes annonces</h2></div><span>{lectureKO?'Lecture indisponible':`${lignes.length} reçue${lignes.length>1?'s':''}`}</span></header>
  {lectureKO?<p role="status">Impossible de relire tes annonces. L’historique reste conservé.</p>:<>
   <input type="search" aria-label="Rechercher une annonce Leboncoin" placeholder="Rechercher un article, un compte…" value={recherche} onChange={e=>setRecherche(e.target.value)}/>
   <div className="vrm-lbc-catalog-filtres" role="group" aria-label="État des annonces Leboncoin">{choix.map(([id,nom])=><button key={id} type="button" aria-pressed={filtre===id} onClick={()=>setFiltre(id)}>{nom}<span>{id==='toutes'?lignes.length:lignes.filter(l=>id==='autres'?!['active','pause','vendue'].includes(l.etat):l.etat===id).length}</span></button>)}</div>
   {!visibles.length?<p className="vrm-lbc-catalog-vide">{lignes.length?'Aucune annonce dans cette sélection.':'Aucune annonce reçue pour le moment. Ouvre « Mes annonces » sur Leboncoin avec l’extension.'}</p>:
    <ul>{visibles.map(({ad,etat,label,livraison,suivi})=>{const lien=lienAnnonceLeboncoin(ad);return <li key={ad.id} data-lbc-catalog-id={ad.id} data-lbc-catalog-etat={etat}>
     <Photo key={ad.images?.[0]||ad.id} src={ad.images?.[0]}/><div className="vrm-lbc-catalog-info"><strong>{ad.subject||ad.title||'Annonce sans titre'}</strong><small>{ad.accountName||'Compte sans nom'}{ad.ref?` · ${ad.ref}`:''}</small><div><span data-etat={etat}>{label}</span>{suivi&&<small>{livraison?'Livraison':'Vente'} · {suivi}</small>}</div></div>
     <b>{euros(ad.price)}</b>{lien&&<a href={lien} target="_blank" rel="noreferrer" aria-label={`Gérer l’annonce : ${ad.subject||ad.title||ad.id}`}>Gérer <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg></a>}
    </li>;})}</ul>}
   <details className="vrm-pourquoi vrm-lbc-catalog-note" data-pourquoi><summary aria-label="D’où viennent ces états ?" title="D’où viennent ces états ?">ⓘ</summary><div>Les états reflètent la dernière lecture. « Gérer » ouvre l’annonce sur Leboncoin ; une annonce absente d’une page n’est pas supprimée de ton historique.</div></details>
  </>}
 </section>;
}
