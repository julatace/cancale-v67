// (10 nov., lot N) L'ATELIER dans Organisation : une colonne par étape, une carte par
// paire (par IDENTITÉ : achat ou N°), glisser ou toucher pour avancer. Règles :
// src/operations/atelier.js ; écritures : la route Organisation (`atelier.*`).
// Rien n'est envoyé à Vinted.
import React,{useMemo,useState} from 'react';
import {atelierDe,attendTrop,joursAttente,resumeAtelier,idNumero,lireAchatsAtelier,ETAPES_MAX,NOM_ETAPE_MAX,ATTENTE_JOURS} from './atelier.js';

const jours=j=>j==null?'':j===0?'aujourd’hui':j===1?'depuis 1 j':`depuis ${j} j`;
const SORTIR='__sortir';

function Etapes({etapes,onSauver,onFermer,occupe}){
 const [l,setL]=useState(()=>etapes.map(e=>({...e}))),[erreur,setErreur]=useState('');
 const bouge=(i,d)=>setL(x=>{const y=[...x],j=i+d;if(j<0||j>=y.length)return x;[y[i],y[j]]=[y[j],y[i]];return y;});
 return <form className="ops-form atl-etapes" data-atelier-etapes="" onSubmit={async e=>{e.preventDefault();setErreur('');try{if(await onSauver(l.map(x=>({...(x.id?{id:x.id}:{}),nom:x.nom}))))onFermer();}catch(err){setErreur(err.message);}}}>
  <div className="ops-form-head"><h3>Mes étapes</h3><button type="button" onClick={onFermer} disabled={occupe}>Fermer</button></div>
  <ol className="atl-etapes-liste">{l.map((x,i)=><li key={x.id||'n'+i}>
   <input aria-label={`Étape ${i+1}`} value={x.nom} maxLength={NOM_ETAPE_MAX} required onChange={e=>{const v=e.target.value;setL(y=>y.map((z,k)=>k===i?{...z,nom:v}:z));}}/>
   <button type="button" aria-label="Monter" disabled={occupe||i===0} onClick={()=>bouge(i,-1)}>↑</button>
   <button type="button" aria-label="Descendre" disabled={occupe||i===l.length-1} onClick={()=>bouge(i,1)}>↓</button>
   <button type="button" aria-label="Retirer cette étape" disabled={occupe||l.length<=2} onClick={()=>setL(y=>y.filter((_,k)=>k!==i))}>✕</button>
  </li>)}</ol>
  {l.length<ETAPES_MAX&&<button type="button" disabled={occupe} onClick={()=>setL(y=>[...y,{nom:''}])}>+ Une étape</button>}
  {erreur&&<p role="alert" className="ops-erreur">{erreur}</p>}
  <button className="ops-primaire" type="submit" disabled={occupe}>Enregistrer</button>
 </form>;
}

export default function Atelier({donnees,envoyer,occupe,maintenant,uid}){
 const atelier=atelierDe(donnees),{etapes,paires}=atelier;
 const resume=resumeAtelier(donnees,maintenant);
 const [edition,setEdition]=useState(false),[ajout,setAjout]=useState(false),[num,setNum]=useState(''),[erreurNum,setErreurNum]=useState(''),[survol,setSurvol]=useState('');
 const publies=useMemo(()=>lireAchatsAtelier(uid),[uid,ajout]);
 const numParId=useMemo(()=>{const m={};for(const a of (publies&&publies.l)||[])if(a.num)m[a.id]=a.num;return m;},[publies]);
 const presents=new Set(paires.map(p=>p.id));
 const aAjouter=publies?publies.l.filter(a=>!presents.has(a.id)):null;
 const ids=new Set(etapes.map(e=>e.id));
 const colonne=p=>ids.has(p.etape)?p.etape:etapes[0].id;
 const placer=(p,etape)=>etape===SORTIR?envoyer('atelier.sortir',{cible:p.id}):envoyer('atelier.placer',{cible:p.id,etape});
 const ajouter=a=>envoyer('atelier.placer',{cible:a.id,titre:a.titre||'',photo:a.photo||'',etape:etapes[0].id});
 const ajouterNum=async e=>{e.preventDefault();setErreurNum('');const id=idNumero(num);if(!id){setErreurNum('N° non reconnu (ex. 125 ou B125).');return;}if(presents.has(id)){setErreurNum('Ce N° est déjà dans l’atelier.');return;}if(await envoyer('atelier.placer',{cible:id,titre:'',photo:'',etape:etapes[0].id}))setNum('');};
 const deposer=(e,etape)=>{e.preventDefault();setSurvol('');const id=e.dataTransfer.getData('text/x-vrm-atelier');const p=paires.find(x=>x.id===id);if(p&&colonne(p)!==etape&&!occupe)placer(p,etape);};
 const nomCarte=p=>{const n=p.id.startsWith('n:')?p.id.slice(2):numParId[p.id]||'';return {n,titre:p.titre||(n?'':'Achat sans titre')};};
 return <div className="atl" data-atelier="" data-atelier-total={resume.total} data-atelier-retard={resume.enRetard}>
  <div className="atl-resume" role="list" aria-label="Paires par étape">{resume.etapes.map(e=><a key={e.id} role="listitem" href={'#atl-'+e.id} className={'atl-pastille'+(e.enRetard?' atl-ambre':'')} data-atelier-compte={e.id} data-n={e.n} onClick={ev=>{ev.preventDefault();try{document.getElementById('atl-'+e.id)?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'});}catch(_){}}}><strong>{e.n}</strong><span>{e.nom}</span></a>)}</div>
  <div className="atl-outils">
   <button className="ops-primaire" disabled={occupe} aria-expanded={ajout} onClick={()=>{setAjout(!ajout);setEdition(false);}} data-atelier-ajouter="">+ Ajouter une paire</button>
   <button disabled={occupe} aria-expanded={edition} onClick={()=>{setEdition(!edition);setAjout(false);}} data-atelier-modifier="">Modifier les étapes</button>
  </div>
  {edition&&<Etapes etapes={etapes} occupe={occupe} onFermer={()=>setEdition(false)} onSauver={l=>envoyer('atelier.etapes',{etapes:l})}/>}
  {ajout&&<div className="ops-form atl-ajout" data-atelier-achats={aAjouter?aAjouter.length:'pas-su'}>
   <h3>Tes achats</h3>
   {aAjouter===null?<p className="ops-note" data-atelier-achats-pas-su="">— Achats pas encore lus sur cet appareil. Ouvre Ma journée ou Achats.</p>
    :!aAjouter.length?<p className="ops-note">Tous tes achats récents sont déjà là.</p>
    :<ul className="atl-achats">{aAjouter.slice(0,60).map(a=><li key={a.id} data-atelier-achat={a.id}>
      {a.photo?<img src={a.photo} alt="" loading="lazy"/>:<span className="atl-photo-vide" aria-hidden="true"/>}
      <span className="atl-texte"><strong>{a.titre||'Achat sans titre'}</strong><small>{[a.num?'N°'+a.num:'',a.compte,a.date?new Date(a.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'}):''].filter(Boolean).join(' · ')}</small></span>
      <button disabled={occupe} onClick={()=>ajouter(a)}>Ajouter</button>
     </li>)}</ul>}
   <form className="atl-num" onSubmit={ajouterNum}><label><span>Ou un N°</span><input value={num} onChange={e=>setNum(e.target.value)} inputMode="text" autoCapitalize="characters" placeholder="125" maxLength={12}/></label><button disabled={occupe||!num.trim()}>Ajouter</button></form>
   {erreurNum&&<p role="alert" className="ops-erreur">{erreurNum}</p>}
  </div>}
  {!paires.length&&!ajout&&<div className="ops-vide"><strong>L’atelier est vide.</strong><p>Ajoute une paire achetée pour suivre ses étapes.</p></div>}
  <div className="atl-tableau" style={{'--atl-n':etapes.length}}>{etapes.map((e,i)=>{
   const ici=paires.filter(p=>colonne(p)===e.id).sort((a,b)=>String(a.depuis).localeCompare(String(b.depuis)));
   const suivante=etapes[i+1];
   return <section key={e.id} id={'atl-'+e.id} className={'atl-colonne'+(survol===e.id?' atl-survol':'')} aria-label={`${e.nom} · ${ici.length}`} data-atelier-colonne={e.id}
    onDragOver={ev=>{ev.preventDefault();setSurvol(e.id);}} onDragLeave={()=>setSurvol(s=>s===e.id?'':s)} onDrop={ev=>deposer(ev,e.id)}>
    <header><h3>{e.nom}</h3><span className="atl-n">{ici.length}</span></header>
    {!ici.length&&<p className="atl-vide">—</p>}
    {ici.map(p=>{const {n,titre}=nomCarte(p),j=joursAttente(p,maintenant),retard=attendTrop(p,atelier,maintenant);
     return <article key={p.id} className="atl-carte" draggable={!occupe} data-atelier-paire={p.id} data-atelier-retard={retard?'1':'0'}
      onDragStart={ev=>{ev.dataTransfer.setData('text/x-vrm-atelier',p.id);ev.dataTransfer.effectAllowed='move';}}>
      <div className="atl-carte-haut">
       {p.photo?<img src={p.photo} alt="" loading="lazy"/>:<span className="atl-photo-vide" aria-hidden="true"/>}
       <span className="atl-texte">{n&&<b className="atl-numero">N°{n}</b>}{titre&&<strong>{titre}</strong>}<small className={retard?'atl-ambre-texte':''}>{jours(j)}{retard?` · plus de ${ATTENTE_JOURS} j`:''}</small></span>
      </div>
      <div className="atl-carte-actions">
       {suivante?<button disabled={occupe} onClick={()=>placer(p,suivante.id)} data-atelier-avancer="">→ {suivante.nom}</button>:<button disabled={occupe} onClick={()=>placer(p,SORTIR)} data-atelier-sortir="">Sortir de l’atelier</button>}
       <label className="atl-choix"><span className="ops-sr">Changer d’étape</span><select aria-label="Changer d’étape" disabled={occupe} value={e.id} onChange={ev=>placer(p,ev.target.value)}>{etapes.map(x=><option key={x.id} value={x.id}>{x.nom}</option>)}<option value={SORTIR}>Sortir de l’atelier</option></select></label>
      </div>
     </article>;})}
   </section>;})}</div>
 </div>;
}
