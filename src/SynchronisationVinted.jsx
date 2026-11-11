import React from 'react';
import {lireSynchronisationVinted} from './synchronisationVinted.js';
import { tr } from './i18n/index.js';
export default function SynchronisationVinted({comptes,owner,ownerActuel,lire,connexion,ecouter,verifier,relire,onFavoris}){
 const [,maj]=React.useReducer(n=>n+1,0);React.useEffect(()=>ecouter?.(maj),[ecouter]);
 const [etat,setEtat]=React.useState({}),generation=React.useRef(0),busy=React.useRef(false),ouvert=React.useRef(false),recharger=React.useRef(null);
 const source=React.useRef({comptes,owner,ownerActuel,lire});source.current={comptes,owner,ownerActuel,lire};
 const cle=JSON.stringify([owner,comptes.map(c=>String(c.uid)).sort()]);
 const charger=async()=>{if(busy.current)return;const n=++generation.current,s=source.current;if(!s.owner)return;busy.current=true;setEtat({cle,charge:true});try{const items=await lireSynchronisationVinted({uids:s.comptes.map(c=>c.uid),owner:s.owner,ownerActuel:s.ownerActuel,lire:s.lire});if(n===generation.current&&s.ownerActuel()===s.owner)setEtat({cle,items});}catch(e){if(n===generation.current&&s.ownerActuel()===s.owner)setEtat({cle,erreur:e.message});}finally{if(n===generation.current)busy.current=false;}};
 recharger.current=charger;
 React.useEffect(()=>{generation.current++;busy.current=false;setEtat({});charger();let timer;const actualiser=()=>{if(ouvert.current&&!document.hidden)recharger.current?.();};const signal=e=>{if(['maj','favoris'].includes(e.detail?.type)&&source.current.comptes.some(c=>String(c.uid)===String(e.detail.uid))){clearTimeout(timer);timer=setTimeout(actualiser,500);}};const interval=setInterval(actualiser,60000);window.addEventListener('vrm:ext',signal);return()=>{generation.current++;clearTimeout(timer);clearInterval(interval);window.removeEventListener('vrm:ext',signal);};},[cle]);
 const vue=etat.cle===cle?etat:{};
 const aVerifier=vue.items?.filter(c=>['messages','favoris'].some(type=>!!c[type].action)).length||0;
 if(!owner||!comptes.length)return null;
 return <details className="vrm-sync-comptes vrm-sync-claire" data-sync-total={vue.items?.length} data-sync-verifier={vue.items?aVerifier:undefined} onToggle={e=>{ouvert.current=e.currentTarget.open;if(ouvert.current)recharger.current?.();}}><summary>{tr('messages.comptesVinted')}{vue.charge?tr('messages.verification'):vue.items?` · ${vue.items.length} compte${vue.items.length>1?'s':''}${aVerifier?` · ${aVerifier} à vérifier`:''}`:vue.erreur?tr('messages.lectureIndisponible2'):''}</summary>
  <div className="vrm-sync-commandes">{verifier&&<button type="button" onClick={()=>{verifier();maj();}}>{tr('messages.verifierConnexionExtension')}</button>}{relire&&<button type="button" onClick={relire}>{tr('messages.mettreJourDonnees')}</button>}<button type="button" disabled={vue.charge} onClick={charger}>{tr('messages.actualiserEtat')}</button></div>
  {vue.erreur&&<p role="alert">{vue.erreur}</p>}
  <div className="vrm-sync-lignes">{vue.items?.map(c=>{
    const etat=connexion?.(c.uid);const probleme=['messages','favoris'].some(type=>!!c[type].action);
    return <article key={c.uid} data-sync-compte={c.uid}><header><strong className="vrm-sensible" data-stream-type="compte">{comptes.find(x=>String(x.uid)===c.uid)?.nom||tr('annonces.compteVinted')}</strong><span data-sync-probleme={probleme?'1':'0'}>{probleme?tr('messages.lectureCompleter'):tr('messages.capturesRecues')}</span></header>
    {etat&&<p className="vrm-sync-connexion"><b>{etat.titre}</b>{etat.action&&<span>{etat.action}</span>}</p>}
    <dl>{['messages','favoris'].map(type=><div key={type} data-sync-source={type}><dt>{type==='messages'?tr('nav.messages'):tr('messages.favoris3')}</dt><dd><span>{c[type].libelle}</span><time dateTime={c[type].date?new Date(c[type].date).toISOString():undefined}>{c[type].date?new Date(c[type].date).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):tr('messages.dateIndisponible')}</time></dd>{c[type].action&&(type==='favoris'&&onFavoris?<button type="button" onClick={()=>onFavoris(c.uid)}>{tr('messages.completerFavoris')}</button>:<a href={type==='messages'?'https://www.vinted.fr/inbox':'https://www.vinted.fr'} target="_blank" rel="noreferrer" aria-label={`Ouvrir Vinted : ${type==='messages'?'messagerie':'favoris'}`}>{tr('annonces.ouvrirVinted')}</a>)}{c[type].action&&<small>{c[type].action}</small>}</div>)}</dl></article>;
  })}</div>
  <details className="vrm-sync-explication"><summary>{tr('messages.comprendreCesDates')}</summary><p>{tr('messages.datesCapturesEnregistrees')}</p></details>
  <a className="vrm-sync-ouvrir" href="https://www.vinted.fr" target="_blank" rel="noreferrer">{tr('messages.ouvrirVintedCompleter')}</a>
 </details>;
}
