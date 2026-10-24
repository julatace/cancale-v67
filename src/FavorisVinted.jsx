import React from 'react';
import {lireFavorisVinted} from './favorisVinted.js';
function PhotoNotification({src}) {
  const [ko,setKo]=React.useState(false);
  React.useEffect(()=>setKo(false),[src]);
  return src&&!ko?<img src={src} alt="Photo de la notification" loading="lazy" referrerPolicy="no-referrer" onError={()=>setKo(true)}/>:<span className="vrm-favoris-photo" aria-label="Photo indisponible">♡</span>;
}


export default function FavorisVinted({uid,owner,ownerActuel,base,headers,nomCompte}) {
  const [etat,setEtat]=React.useState({}),[selection,setSelection]=React.useState([]),[message,setMessage]=React.useState(''),[retour,setRetour]=React.useState(''),[max,setMax]=React.useState(50);
  const requete=React.useRef(0),occupe=React.useRef(false);
  const scope=owner+':'+uid, data=etat.scope===scope?etat.data:undefined;
  React.useEffect(()=>{requete.current++;occupe.current=false;setEtat({});setSelection([]);setMessage('');setRetour('');setMax(50);return()=>{requete.current++;};},[uid,owner]);
  const charger=async()=>{
    if(occupe.current)return;
    const n=++requete.current;occupe.current=true;setEtat({scope,charge:true});setSelection([]);setRetour('');
    try{const data=await lireFavorisVinted({uid,owner,ownerActuel,base,headers:headers()});if(n===requete.current&&ownerActuel()===owner)setEtat({scope,data});}
    catch(e){if(n===requete.current&&ownerActuel()===owner)setEtat({scope,erreur:e.message});}
    finally{if(n===requete.current)occupe.current=false;}
  };
  const lignes=data?.lignes||[],visibles=lignes.slice(0,max);
  const choisir=id=>{setRetour('');setSelection(s=>s.includes(id)?s.filter(x=>x!==id):s.length<10?[...s,id]:s);};
  const copier=async()=>{if(ownerActuel()!==owner)return;const n=requete.current;try{await navigator.clipboard.writeText(message.trim());if(n===requete.current)setRetour('Message copié. Tu peux le coller dans la conversation sur Vinted.');}catch{if(n===requete.current)setRetour('Copie indisponible : sélectionne le texte du message.');}};
  return <section className="vrm-favoris-liste" aria-label="Favoris reçus">
    <header><div><h3>Favoris reçus</h3><small>{nomCompte||(uid?'Compte Vinted sélectionné':'Choisis le compte à consulter')}</small></div><div className="vrm-favoris-actions"><button type="button" onClick={charger} disabled={!uid||!owner||etat.charge}>{etat.charge?'Lecture…':data?'Actualiser':'Afficher les favoris'}</button>{data&&<button type="button" onClick={()=>{requete.current++;occupe.current=false;setEtat({});setSelection([]);setRetour('');}}>Masquer</button>}</div></header>
    {!uid&&<p className="vrm-favoris-note">Choisis un compte Vinted dans le sélecteur au-dessus pour afficher ses favoris.</p>}
    {etat.scope===scope&&etat.erreur&&<p role="alert">{etat.erreur}</p>}
    {data&&<>
      <p className="vrm-favoris-note">{data.reception==='absente'?'Aucune capture reçue pour ce compte. Ouvre la cloche Vinted avec l’extension connectée, puis actualise.':`${lignes.length} favori${lignes.length>1?'s':''} reconnu${lignes.length>1?'s':''} dans la capture reçue. Historique complet non vérifié.`}{data.totalPages>1?` Vinted indique ${data.totalPages} pages de notifications.`:''}</p>
      {!!lignes.length&&<><div className="vrm-favoris-selection"><span>{selection.length} sélectionné{selection.length>1?'s':''} · 10 maximum par préparation</span><button type="button" onClick={()=>{setSelection(visibles.slice(0,10).map(x=>x.id));setRetour('');}}>Sélectionner les 10 premiers</button>{!!selection.length&&<button type="button" onClick={()=>setSelection([])}>Tout décocher</button>}</div>
      <div className="vrm-favoris-rows">{visibles.map(x=><article key={x.id} className={selection.includes(x.id)?'is-selected':''}>
        <label className="vrm-favoris-check"><input type="checkbox" aria-label={`Sélectionner ${x.nom||x.body.slice(0,100)}`} checked={selection.includes(x.id)} disabled={!selection.includes(x.id)&&selection.length>=10} onChange={()=>choisir(x.id)}/></label>
        <PhotoNotification src={x.photo}/>
        <div className="vrm-favoris-texte">{x.nom&&<strong title={x.nom}>{x.nom}</strong>}<p title={x.body}>{x.nom&&x.body.startsWith(x.nom+' ')?x.body.slice(x.nom.length).trim():x.body}</p>{x.date&&<time dateTime={x.date}>{new Date(x.date).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</time>}</div>
        {x.lien?<a href={x.lien} target="_blank" rel="noreferrer" aria-label="Ouvrir la notification sur Vinted"><span>Ouvrir sur Vinted</span><svg className="vrm-favoris-ouvrir-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg></a>:<small>Lien indisponible</small>}
      </article>)}</div>
      {visibles.length<lignes.length&&<button type="button" onClick={()=>setMax(x=>x+50)}>Afficher les suivants</button>}
      {!!selection.length&&<div className="vrm-favoris-compose"><label>Ton message<textarea maxLength={2000} rows={3} value={message} onChange={e=>{setMessage(e.target.value);setRetour('');}} placeholder="Écris ton message personnalisé…"/></label><small>Tu peux mentionner ta réduction dans le texte. Cela ne crée pas une offre de prix sur Vinted.</small><button type="button" disabled={!message.trim()} onClick={copier}>Copier le message</button><p>L’envoi direct et automatique depuis VRM n’est pas encore activé. Les liens ouvrent les destinations reçues dans les notifications Vinted.</p></div>}
      </>}
    </>}
    {retour&&<p role="status">{retour}</p>}
  </section>;
}
