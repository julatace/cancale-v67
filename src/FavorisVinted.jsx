import React from 'react';
import {lireFavorisVinted,preparerMessageFavori} from './favorisVinted.js';
import {lireReglagesFavoris,sauverReglagesFavoris,validerReglagesFavoris} from './reglagesFavoris.js';
import AutomatisationFavoris from './AutomatisationFavoris.jsx';
function PhotoNotification({src}) {
  const [ko,setKo]=React.useState(false);
  React.useEffect(()=>setKo(false),[src]);
  return src&&!ko?<img src={src} alt="Photo de la notification" loading="lazy" referrerPolicy="no-referrer" onError={()=>setKo(true)}/>:<span className="vrm-favoris-photo" aria-label="Photo indisponible">♡</span>;
}


export default function FavorisVinted({uid,owner,ownerActuel,base,headers,nomCompte,executerFavori,favorisDisponible=false}) {
  const [etat,setEtat]=React.useState({}),[selection,setSelection]=React.useState([]),[message,setMessage]=React.useState(''),[retour,setRetour]=React.useState(''),[max,setMax]=React.useState(50);
  const [reduction,setReduction]=React.useState(''),[intervalle,setIntervalle]=React.useState('6'),[reglages,setReglages]=React.useState({});
  const reglagesLus=React.useRef(false),edition=React.useRef(0),sauvegarde=React.useRef(false);
  const change=()=>{edition.current++;setRetour('');setReglages(x=>x.prets?{...x,enregistres:false,erreur:''}:x);};
  const apercu=preparerMessageFavori(message,reduction);
  const requete=React.useRef(0),occupe=React.useRef(false);
  const scope=owner+':'+uid, data=etat.scope===scope?etat.data:undefined;
  React.useEffect(()=>{requete.current++;occupe.current=false;setEtat({});setSelection([]);setMessage('');setReduction('');setIntervalle('6');setReglages({});reglagesLus.current=false;edition.current=0;sauvegarde.current=false;setRetour('');setMax(50);return()=>{requete.current++;};},[uid,owner]);
  const charger=async()=>{
    if(occupe.current||sauvegarde.current)return;
    const n=++requete.current;occupe.current=true;setEtat({scope,charge:true});setSelection([]);setRetour('');
    try{
      const opts={uid,owner,ownerActuel,base,headers:headers()};
      const [favoris,prefs]=await Promise.allSettled([lireFavorisVinted(opts),reglagesLus.current?Promise.resolve(null):lireReglagesFavoris(opts)]);
      if(n!==requete.current||ownerActuel()!==owner)return;
      if(prefs.status==='fulfilled'&&prefs.value){
        reglagesLus.current=true;setReglages({prets:true,enregistres:prefs.value.enregistres&&edition.current===0});
        if(edition.current===0){setMessage(prefs.value.message);setReduction(prefs.value.pourcentage==null?'':String(prefs.value.pourcentage));setIntervalle(String(prefs.value.intervalleMinutes));}
      }else if(prefs.status==='rejected')setReglages({erreur:prefs.reason?.message||'Lecture des réglages impossible.'});
      if(favoris.status==='rejected')throw favoris.reason;
      setEtat({scope,data:favoris.value});
    }
    catch(e){if(n===requete.current&&ownerActuel()===owner)setEtat({scope,erreur:e.message});}
    finally{if(n===requete.current)occupe.current=false;}
  };
  const lignes=data?.lignes||[],visibles=lignes.slice(0,max);
  const choisir=id=>{setRetour('');setSelection(s=>s.includes(id)?s.filter(x=>x!==id):s.length<10?[...s,id]:s);};
  const copier=async()=>{if(ownerActuel()!==owner||apercu.erreur||!apercu.message)return;const n=requete.current;try{await navigator.clipboard.writeText(apercu.message);if(n===requete.current)setRetour('Message copié. Tu peux le coller dans la conversation sur Vinted.');}catch{if(n===requete.current)setRetour('Copie indisponible : sélectionne le texte de l’aperçu.');}};
  const enregistrer=async()=>{
    if(sauvegarde.current||occupe.current||!reglagesLus.current||ownerActuel()!==owner)return;
    let contenu;try{contenu=validerReglagesFavoris({message,pourcentage:reduction,intervalleMinutes:intervalle});}catch(e){setReglages(x=>({...x,erreur:e.message}));return;}
    sauvegarde.current=true;const n=requete.current,e=edition.current;setReglages(x=>({...x,sauvegarde:true,erreur:''}));setRetour('');
    try{
      await sauverReglagesFavoris({uid,owner,ownerActuel,base,headers:headers()},contenu);
      if(n===requete.current&&ownerActuel()===owner){setReglages({prets:true,enregistres:e===edition.current});setRetour(e===edition.current?'Réglages enregistrés pour ce compte. Ils seront utilisés au prochain lancement.':'La version précédente est enregistrée. Tes dernières modifications restent à enregistrer.');}
    }catch(e){if(n===requete.current&&ownerActuel()===owner){reglagesLus.current=false;setReglages({prets:false,erreur:e.message});}}
    finally{if(n===requete.current)sauvegarde.current=false;}
  };
  return <section className="vrm-favoris-liste" aria-label="Favoris reçus">
    <header><div><h3>Favoris reçus</h3><small>{nomCompte||(uid?'Compte Vinted sélectionné':'Choisis le compte à consulter')}</small></div><div className="vrm-favoris-actions"><button type="button" onClick={charger} disabled={!uid||!owner||etat.charge||reglages.sauvegarde}>{etat.charge?'Lecture…':data?'Actualiser':'Afficher les favoris'}</button>{data&&<button type="button" disabled={reglages.sauvegarde} onClick={()=>{requete.current++;occupe.current=false;setEtat({});setSelection([]);setRetour('');}}>Masquer</button>}</div></header>
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
      {!!selection.length&&<div className="vrm-favoris-compose"><details className="vrm-favoris-parametres" open={!reglages.enregistres}><summary>{reglages.enregistres?'Réglages enregistrés · modifier':'Paramétrer ce compte'}</summary><label>Ton message<textarea maxLength={2000} rows={3} value={message} onChange={e=>{setMessage(e.target.value);change();}} placeholder="Écris ton message personnalisé…"/></label>
        <div className="vrm-favoris-remise"><label>Réduction proposée (%)<input type="text" inputMode="numeric" maxLength={6} value={reduction} onChange={e=>{setReduction(e.target.value);change();}} placeholder="Facultative"/></label><div role="group" aria-label="Pourcentages de réduction">{[5,10,15,20].map(p=><button type="button" key={p} aria-pressed={apercu.pourcentage===p} onClick={()=>{setReduction(String(p));change();}}>−{p} %</button>)}{reduction&&<button type="button" onClick={()=>{setReduction('');change();}}>Sans réduction</button>}</div></div>
        <small>La remise est proposée dans le texte. Le prix de l’annonce reste inchangé et aucune offre de prix Vinted n’est créée.</small>
        {apercu.erreur&&<p role="alert">{apercu.erreur}</p>}
        <label className="vrm-favoris-cadence">Intervalle minimum prévu (minutes)<input type="text" inputMode="numeric" maxLength={6} value={intervalle} onChange={e=>{setIntervalle(e.target.value);change();}}/></label>
        <small>Cadence fixe choisie par toi. Le plafond de 10 messages sur 60 minutes reste prioritaire. Un refus, une demande de ralentissement ou une réponse incertaine interrompt la file.</small>
        {reglages.erreur&&<p role="alert">{reglages.erreur} {!reglagesLus.current&&'Actualise la liste pour relire les réglages.'}</p>}
        <button type="button" disabled={!reglages.prets||reglages.sauvegarde||!apercu.message||!!apercu.erreur} onClick={enregistrer}>{reglages.sauvegarde?'Enregistrement…':'Enregistrer mes réglages'}</button></details>
        {!!apercu.message&&<div className="vrm-favoris-apercu"><strong>Aperçu du message</strong><output aria-label="Aperçu du message">{apercu.message}</output></div>}

        <button type="button" disabled={!apercu.message||!!apercu.erreur} onClick={copier}>Copier le message</button></div>}
      </>}
    </>}
    {uid&&owner&&executerFavori&&<AutomatisationFavoris key={scope} uid={uid} owner={owner} ownerActuel={ownerActuel} headers={headers} selection={selection} reglagesPrets={!!reglages.enregistres&&!reglages.sauvegarde} reglages={{message,pourcentage:reduction,intervalleMinutes:intervalle}} executer={executerFavori} disponible={favorisDisponible}/>}
    {retour&&<p role="status">{retour}</p>}
  </section>;
}
