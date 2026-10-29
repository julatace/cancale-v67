import React from 'react';
import {lireSynchronisationVinted} from './synchronisationVinted.js';
export default function SynchronisationVinted({comptes,owner,ownerActuel,lire}){
 const [etat,setEtat]=React.useState({}),generation=React.useRef(0),busy=React.useRef(false),ouvert=React.useRef(false),recharger=React.useRef(null);
 const source=React.useRef({comptes,owner,ownerActuel,lire});source.current={comptes,owner,ownerActuel,lire};
 const cle=JSON.stringify([owner,comptes.map(c=>String(c.uid)).sort()]);
 const charger=async()=>{if(busy.current)return;const n=++generation.current,s=source.current;if(!s.owner)return;busy.current=true;setEtat({cle,charge:true});try{const items=await lireSynchronisationVinted({uids:s.comptes.map(c=>c.uid),owner:s.owner,ownerActuel:s.ownerActuel,lire:s.lire});if(n===generation.current&&s.ownerActuel()===s.owner)setEtat({cle,items});}catch(e){if(n===generation.current&&s.ownerActuel()===s.owner)setEtat({cle,erreur:e.message});}finally{if(n===generation.current)busy.current=false;}};
 recharger.current=charger;
 React.useEffect(()=>{generation.current++;busy.current=false;setEtat({});charger();let timer;const actualiser=()=>{if(ouvert.current&&!document.hidden)recharger.current?.();};const signal=e=>{if(['maj','favoris'].includes(e.detail?.type)&&source.current.comptes.some(c=>String(c.uid)===String(e.detail.uid))){clearTimeout(timer);timer=setTimeout(actualiser,500);}};const interval=setInterval(actualiser,60000);window.addEventListener('vrm:ext',signal);return()=>{generation.current++;clearTimeout(timer);clearInterval(interval);window.removeEventListener('vrm:ext',signal);};},[cle]);
 const vue=etat.cle===cle?etat:{};
 const aVerifier=vue.items?.reduce((n,c)=>n+['messages','favoris'].filter(type=>c[type].libelle!=='Historique récupéré').length,0)||0;
 if(!owner||!comptes.length)return null;
 return <details className="vrm-sync-comptes" onToggle={e=>{ouvert.current=e.currentTarget.open;if(ouvert.current)recharger.current?.();}}><summary>Synchronisation par compte{vue.charge?' · vérification…':vue.items?` · ${vue.items.length} compte${vue.items.length>1?'s':''}${aVerifier?` · ${aVerifier} lecture${aVerifier>1?'s':''} à vérifier`:''}`:vue.erreur?' · lecture indisponible':''}</summary>
  <p>Dates des captures reçues, pas des derniers messages. Une lecture ne garantit pas que tout l’historique a été récupéré.</p>
  <button type="button" disabled={vue.charge} onClick={charger}>Actualiser l’état</button>
  {vue.erreur&&<p role="alert">{vue.erreur}</p>}
  <div className="vrm-sync-lignes">{vue.items?.map(c=><article key={c.uid}><strong>{comptes.find(x=>String(x.uid)===c.uid)?.nom||'Compte Vinted'}</strong>{['messages','favoris'].map(type=><div key={type}><b>{type==='messages'?'Messages':'Favoris'}</b><span>{c[type].libelle}</span><time dateTime={c[type].date?new Date(c[type].date).toISOString():undefined}>{c[type].date?new Date(c[type].date).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Date indisponible'}</time>{c[type].action&&<small>{c[type].action}</small>}</div>)}</article>)}</div>
  <a href="https://www.vinted.fr" target="_blank" rel="noreferrer">Ouvrir Vinted pour compléter une lecture ↗</a>
 </details>;
}
