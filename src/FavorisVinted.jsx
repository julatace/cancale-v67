import React from 'react';
import {lireFavorisVinted,preparerMessageFavori,ageFavori,contactFavori} from './favorisVinted.js';
import {lireReglagesFavoris,sauverReglagesFavoris,validerReglagesFavoris} from './reglagesFavoris.js';
import {controleOuvertureFavori} from './favorisOuverture.js';
import AutomatisationFavoris from './AutomatisationFavoris.jsx';
// La photo vient du CDN de Vinted : elle passe par `PhotoVinted` (sans référent,
// secours par l'extension, pictogramme), fourni par l'app. Sans lui, aucune
// image : une photo Vinted affichée hors de la règle partirait cassée.
const PictoFavori = <span className="vrm-favoris-photo" aria-label="Photo indisponible">♡</span>;
function PhotoNotification({src, PhotoVinted}) {
  return src&&PhotoVinted?<PhotoVinted src={src} alt="Photo de la notification" loading="lazy" repli={PictoFavori}/>:PictoFavori;
}


export default function FavorisVinted({uid,owner,ownerActuel,base,headers,nomCompte,executerFavori,favorisDisponible=false,favorisRaison='',verifierExtension,recupererPage,ouvrirFavori,chargementAutomatique=false,PhotoVinted=null}) {
  const [etat,setEtat]=React.useState({}),[selection,setSelection]=React.useState([]),[message,setMessage]=React.useState(''),[retour,setRetour]=React.useState(''),[max,setMax]=React.useState(50);
  const [reduction,setReduction]=React.useState(''),[intervalle,setIntervalle]=React.useState('6'),[reglages,setReglages]=React.useState({});
  const [historique,setHistorique]=React.useState(null),[filtre,setFiltre]=React.useState('tous'),[recherche,setRecherche]=React.useState(''),[maintenant,setMaintenant]=React.useState(Date.now()),[importation,setImportation]=React.useState(false);
  const [ouverture,setOuverture]=React.useState(''),[verifications,setVerifications]=React.useState({}),[controle,setControle]=React.useState(null),[controleEnvoi,setControleEnvoi]=React.useState(null),[erreurOuverture,setErreurOuverture]=React.useState(''),[revisionVerification,setRevisionVerification]=React.useState(0);
  const ouvrirEnCours=React.useRef(false),retourVinted=React.useRef(false);
  const importEnCours=React.useRef(false),annulerImport=React.useRef(false);
  const reglagesLus=React.useRef(false),edition=React.useRef(0),sauvegarde=React.useRef(false);
  const change=()=>{edition.current++;setRetour('');setReglages(x=>x.prets?{...x,enregistres:false,erreur:''}:x);};
  const apercu=preparerMessageFavori(message,reduction);
  const requete=React.useRef(0),occupe=React.useRef(false);
  const scope=owner+':'+uid, data=etat.scope===scope?etat.data:undefined;
  React.useEffect(()=>{requete.current++;occupe.current=false;setEtat({});setHistorique(null);setImportation(false);setOuverture('');setVerifications({});setControle(null);setControleEnvoi(null);setErreurOuverture('');ouvrirEnCours.current=false;retourVinted.current=false;setFiltre('tous');setRecherche('');annulerImport.current=true;setSelection([]);setMessage('');setReduction('');setIntervalle('6');setReglages({});reglagesLus.current=false;edition.current=0;sauvegarde.current=false;setRetour('');setMax(50);return()=>{requete.current++;};},[uid,owner]);
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
  const autoLu=React.useRef('');
  React.useEffect(()=>{if(chargementAutomatique&&uid&&owner&&autoLu.current!==scope){autoLu.current=scope;charger();}},[chargementAutomatique,scope]);
  const lignes=data?.lignes||[],jobs=historique?.scope===scope?historique.vue.jobs:undefined;
  const statut=x=>contactFavori(x,jobs),bloque=x=>['envoye','ignore','incertain','verifie','reserve','attente'].includes(statut(x)?.etat);
  const filtrees=lignes.filter(x=>(filtre==='tous'||filtre==='envoyes'&&statut(x)?.etat==='envoye'||filtre==='contacter'&&!bloque(x))&&(!recherche.trim()||`${x.nom} ${x.body}`.toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr'))));
  const visibles=filtrees.slice(0,max);
  const cibleVerification=selection.length?selection.map(id=>lignes.find(x=>x.id===id)).find(x=>x?.lien&&!bloque(x)):visibles.find(x=>x.lien&&!bloque(x));
  React.useEffect(()=>{if(!data)return;setMaintenant(Date.now());const t=setInterval(()=>setMaintenant(Date.now()),60000);return()=>clearInterval(t);},[data]);
  React.useEffect(()=>{if(!jobs)return;setSelection(anciens=>{const nouveaux=anciens.filter(id=>{const x=lignes.find(n=>n.id===id);return x&&!['envoye','ignore','incertain','verifie'].includes(contactFavori(x,jobs)?.etat);});return nouveaux.length===anciens.length?anciens:nouveaux;});},[historique,data]);
  const importer=async()=>{
    if(importEnCours.current||occupe.current||sauvegarde.current)return;
    if(!recupererPage){setRetour('La récupération des pages nécessite l’extension 5.218.');return;}
    const generation=requete.current;importEnCours.current=true;annulerImport.current=false;setImportation(true);setSelection([]);setRetour('Connexion à Vinted…');
    const ancien=data?.archive?.sync,cycle=ancien&&!ancien.complete?ancien.id:(globalThis.crypto?.randomUUID?.()||'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.floor(Math.random()*16);return (c==='x'?r:(r&3)|8).toString(16);}));let nouveau=!ancien||ancien.complete,texteFinal='';
    try{
      for(let i=0;i<30;i++){
        if(annulerImport.current||generation!==requete.current||ownerActuel()!==owner)break;
        const r=await recupererPage({cycle,nouveau});
        if(!r?.ok)throw Error(r?.data?.message||r?.error||'La lecture a été interrompue. Les pages déjà reçues restent conservées.');
        const d=r.data||{};if(!Number.isSafeInteger(d.pagesLues)||!Number.isSafeInteger(d.totalPages)||d.pagesLues<1||d.totalPages<d.pagesLues||typeof d.complete!=='boolean')throw Error('La progression de lecture n’est pas reconnue. Les favoris déjà reçus sont conservés.');setRetour(`${d.pagesLues||0} / ${d.totalPages||'?'} pages récupérées…`);nouveau=false;
        if(d.limite){texteFinal='La capacité de l’archive est atteinte. Les pages lues restent conservées, mais la liste n’est pas exhaustive.';break;}
        if(d.complete){texteFinal='Toutes les pages disponibles ont été récupérées.';break;}
        if(i===29)texteFinal='Une première partie est conservée. Clique à nouveau pour reprendre les pages restantes.';
      }
      if(annulerImport.current)texteFinal='Lecture arrêtée. Les pages déjà reçues restent conservées.';
    }catch(e){texteFinal=e.message;}
    finally{
      importEnCours.current=false;
      if(generation===requete.current&&ownerActuel()===owner){await charger();if(generation+1===requete.current){setImportation(false);setRetour(texteFinal);}}
    }
  };
  const tester=async()=>{if(!verifierExtension)return;setRetour('Vérification de la connexion…');try{const r=await verifierExtension();if(ownerActuel()===owner)setRetour(r.disponible?`Connexion vérifiée · ${r.canal||'extension'}`:r.raison);}catch{if(ownerActuel()===owner)setRetour('La vérification n’a pas abouti. Réessaie dans ce profil Chrome.');}};

  const ouvrir=async x=>{
    if(ouvrirEnCours.current||importEnCours.current||historique?.vue?.active||ownerActuel()!==owner)return;
    ouvrirEnCours.current=true;setRevisionVerification(v=>v+1);retourVinted.current=false;setErreurOuverture('');setControle(null);setControleEnvoi(null);const n=requete.current;setOuverture(x.id);setVerifications(v=>({...v,[x.id]:'en_attente'}));setRetour('Ouverture du favori dans Vinted…');
    try{const r=await ouvrirFavori(x);if(ownerActuel()!==owner||n!==requete.current)return;
      setControle(controleOuvertureFavori(r));
      if(!r?.ok)throw Error(r?.data?.message||r?.error||'L’ouverture n’a pas été confirmée.');
      setVerifications(v=>({...v,[x.id]:r.data?.preuve||'en_attente'}));
      retourVinted.current=true;setRetour(r.data?.preuve==='confirmee'?'Le lien natif a été enregistré. Reviens ici pour actualiser la sélection. Aucun message envoyé.':'Vinted est ouvert. La capture n’est pas encore confirmée. Reviens ici après le chargement. Aucun message envoyé.');
    }catch(e){if(ownerActuel()===owner&&n===requete.current){setErreurOuverture(e.message||'La vérification n’a pas abouti.');setVerifications(v=>({...v,[x.id]:'non_confirmee'}));setControle(c=>c||controleOuvertureFavori({ok:false,controleOuverture:{etape:'exception'}}));setRetour('');}}
    finally{if(ownerActuel()===owner&&n===requete.current){ouvrirEnCours.current=false;setOuverture('');if(retourVinted.current&&document.visibilityState==='visible'&&document.hasFocus())setTimeout(()=>{if(retourVinted.current&&!ouvrirEnCours.current&&ownerActuel()===owner&&n===requete.current){retourVinted.current=false;charger();}},600);}}
  };
  React.useEffect(()=>{const retour=()=>{if(retourVinted.current&&!ouvrirEnCours.current&&ownerActuel()===owner){retourVinted.current=false;charger();}};window.addEventListener('focus',retour);return()=>window.removeEventListener('focus',retour);},[owner,uid]);

  const choisir=id=>{setRetour('');setSelection(s=>s.includes(id)?s.filter(x=>x!==id):s.length<10?[...s,id]:s);};
  const copier=async()=>{if(ownerActuel()!==owner||apercu.erreur||!apercu.message)return;const n=requete.current;try{await navigator.clipboard.writeText(apercu.message);if(n===requete.current)setRetour('Message copié. Tu peux le coller dans la conversation sur Vinted.');}catch{if(n===requete.current)setRetour('Copie indisponible : sélectionne le texte de l’aperçu.');}};
  const enregistrer=async()=>{
    if(sauvegarde.current||occupe.current||!reglagesLus.current||ownerActuel()!==owner)return;
    let contenu;try{contenu=validerReglagesFavoris({message,pourcentage:reduction,intervalleMinutes:intervalle});}catch(e){setReglages(x=>({...x,erreur:e.message}));return;}
    sauvegarde.current=true;const n=requete.current,e=edition.current;setReglages(x=>({...x,sauvegarde:true,erreur:''}));setRetour('');
    try{
      await sauverReglagesFavoris({uid,owner,ownerActuel,base,headers:headers()},contenu);
      if(n===requete.current&&ownerActuel()===owner){setReglages({prets:true,enregistres:e===edition.current});setRetour(e===edition.current?'Réglages enregistrés pour ce compte. Ils seront utilisés au prochain lancement.':'La version précédente est enregistrée. Tes dernières modifications restent à enregistrer.');if(e===edition.current)return contenu;}
    }catch(e){if(n===requete.current&&ownerActuel()===owner){reglagesLus.current=false;setReglages({prets:false,erreur:e.message});}}
    finally{if(n===requete.current)sauvegarde.current=false;}
  };
  const preparerReglages=async()=>{
    if(!reglages.prets||!reglagesLus.current)throw Error(reglages.erreur||'Actualise les favoris pour lire les réglages de ce compte.');
    const contenu=validerReglagesFavoris({message,pourcentage:reduction,intervalleMinutes:intervalle});
    if(reglages.enregistres)return contenu;
    const sauves=await enregistrer();
    if(!sauves)throw Error('Enregistrement non confirmé ou texte modifié pendant la sauvegarde. Vérifie ton message avant de relancer.');
    return sauves;
  };
  return <section className="vrm-favoris-liste" aria-label="Favoris reçus">
    <header><div><h3>Favoris reçus</h3><small>{nomCompte||(uid?'Compte Vinted sélectionné':'Choisis le compte à consulter')}</small></div><div className="vrm-favoris-actions"><button type="button" onClick={charger} disabled={!uid||!owner||etat.charge||reglages.sauvegarde||importation}>{etat.charge?'Lecture…':data?'Actualiser':'Afficher les favoris'}</button>{data&&<button type="button" disabled={reglages.sauvegarde||importation} onClick={()=>{requete.current++;occupe.current=false;setEtat({});setSelection([]);setRetour('');}}>Masquer</button>}</div></header>
    {!uid&&<p className="vrm-favoris-note">Choisis un compte Vinted dans le sélecteur au-dessus pour afficher ses favoris.</p>}
    {etat.scope===scope&&etat.erreur&&<p role="alert">{etat.erreur}</p>}
    {erreurOuverture&&<p role="alert" className="vrm-favoris-note"><strong>Vérification interrompue : </strong>{erreurOuverture}</p>}
    {retour&&<p role="status">{retour}</p>}
    {(controleEnvoi||controle&&controle.preuve!=='confirmee')&&<button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(JSON.stringify({...(controle||{diagnostic:'VRM-favoris-controle-v1'}),...(controleEnvoi?{lancement:controleEnvoi}:{})},null,2));setRetour('Contrôle copié, sans identifiant, lien ni message privé.');}catch{setRetour('Copie indisponible dans ce navigateur.');}}}>Copier le contrôle</button>}
    {data&&<>
      <p className="vrm-favoris-note">{data.reception==='absente'?'Aucune capture reçue pour ce compte. Ouvre la cloche Vinted avec l’extension connectée, puis actualise.':`${lignes.length} favori${lignes.length>1?'s':''} reçu${lignes.length>1?'s':''}. ${data.archive?.sync?.complete&&!data.archive?.limite?'Toutes les pages de la dernière lecture sont conservées.':'Historique à compléter.'}`}{data.totalPages>1?` Vinted indique ${data.totalPages} pages de notifications.`:''}</p>
      {ouvrirFavori&&<p className="vrm-favoris-note">La vérification active Vinted, ouvre la cloche puis recherche ce favori avant d’ouvrir sa conversation. Aucun message n’est envoyé.</p>}
      <div className="vrm-favoris-outils">{ouvrirFavori&&<button type="button" onClick={()=>cibleVerification&&ouvrir(cibleVerification)} disabled={!cibleVerification||!!ouverture||importation||etat.charge||historique?.vue?.active}>{ouverture?'Vérification…':selection.length?'Vérifier le premier sélectionné':'Vérifier un favori'}</button>}{recupererPage&&<button type="button" onClick={importer} disabled={importation||etat.charge||historique?.vue?.active}>{importation?'Récupération…':data.archive?.sync&&!data.archive.sync.complete?'Compléter les pages restantes':'Récupérer toutes les pages'}</button>}{importation&&<button type="button" onClick={()=>{annulerImport.current=true;}}>Arrêter la lecture</button>}{verifierExtension&&<button type="button" onClick={tester} disabled={importation}>Tester la connexion</button>}</div>
      {!!lignes.length&&<><div className="vrm-favoris-filtres"><label>Rechercher un favori<input type="search" value={recherche} onChange={e=>{setRecherche(e.target.value);setMax(50);}} placeholder="Nom, article…"/></label><div role="group" aria-label="Filtrer les favoris">{[['tous','Tous'],['contacter','À contacter'],['envoyes','Déjà envoyés']].map(([id,label])=><button type="button" key={id} aria-pressed={filtre===id} onClick={()=>{setFiltre(id);setMax(50);}}>{label}{id==='tous'?` (${lignes.length})`:id==='envoyes'?` (${lignes.filter(x=>statut(x)?.etat==='envoye').length})`:''}</button>)}</div></div><div className="vrm-favoris-selection"><span>{selection.length} sélectionné{selection.length>1?'s':''} · 10 maximum par préparation</span><button type="button" onClick={()=>{setSelection(visibles.filter(x=>!bloque(x)).slice(0,10).map(x=>x.id));setRetour('');}}>Sélectionner les 10 premiers</button>{!!selection.length&&<button type="button" onClick={()=>setSelection([])}>Tout décocher</button>}</div>
      <div className="vrm-favoris-rows">{visibles.map(x=><article key={x.id} className={selection.includes(x.id)?'is-selected':''}>
        <label className="vrm-favoris-check"><input type="checkbox" aria-label={`Sélectionner ${x.nom||x.body.slice(0,100)}`} checked={selection.includes(x.id)} disabled={importation||bloque(x)||!selection.includes(x.id)&&selection.length>=10} onChange={()=>choisir(x.id)}/></label>
        <PhotoNotification src={x.photo} PhotoVinted={PhotoVinted}/>
        <div className="vrm-favoris-texte">{x.nom&&<strong title={x.nom}>{x.nom}</strong>}<p title={x.body}>{x.nom&&x.body.startsWith(x.nom+' ')?x.body.slice(x.nom.length).trim():x.body}</p><div className="vrm-favoris-meta"><time dateTime={x.date||undefined} title={x.date?'Date indiquée par la notification : '+new Date(x.date).toLocaleString('fr-FR'):undefined}>{ageFavori(x.date,maintenant)}</time>{verifications[x.id]&&!['envoye','ignore'].includes(statut(x)?.etat)&&<span className="vrm-favoris-badge">{verifications[x.id]==='confirmee'?'Lien enregistré':verifications[x.id]==='non_confirmee'?'Capture non confirmée':'Capture en attente'}</span>}{statut(x)?.etat==='envoye'?<span className="vrm-favoris-badge is-envoye" title={statut(x).envoyeLe?`Envoi confirmé le ${new Date(statut(x).envoyeLe).toLocaleString('fr-FR')}`:'Envoi VRM confirmé'}>Message déjà envoyé</span>:statut(x)?.etat==='ignore'?<span className="vrm-favoris-badge">Conversation commencée</span>:statut(x)?.etat==='incertain'?<span className="vrm-favoris-badge">Envoi à vérifier</span>:['attente','reserve'].includes(statut(x)?.etat)?<span className="vrm-favoris-badge">Dans la file</span>:null}</div></div>
        {x.lien&&ouvrirFavori?<button className="vrm-favoris-ouvrir" type="button" disabled={!!ouverture||importation||historique?.vue?.active} onClick={()=>ouvrir(x)} aria-label={`Ouvrir ce favori pour vérifier sur Vinted${x.nom?' · '+x.nom:''}`}><span>{ouverture===x.id?'Ouverture…':'Vérifier sur Vinted'}</span><svg className="vrm-favoris-ouvrir-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg></button>:x.lien?<a href={x.lien} target="_blank" rel="noreferrer" aria-label="Ouvrir la notification sur Vinted"><span>Ouvrir sur Vinted</span><svg className="vrm-favoris-ouvrir-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg></a>:<small>Lien indisponible</small>}
      </article>)}</div>
      {!visibles.length&&<p>Aucun favori ne correspond à ce filtre.</p>}{visibles.length<filtrees.length&&<button type="button" onClick={()=>setMax(x=>x+50)}>Afficher les suivants</button>}
      {!!selection.length&&<div className="vrm-favoris-compose"><h4>Préparer le message · {selection.length} destinataire{selection.length>1?'s':''}</h4><details className="vrm-favoris-parametres" open={!reglages.enregistres}><summary>{reglages.enregistres?'Réglages enregistrés · modifier':'Paramétrer ce compte'}</summary><label>Ton message<textarea maxLength={2000} rows={3} value={message} onChange={e=>{setMessage(e.target.value);change();}} placeholder="Écris ton message personnalisé…"/></label>
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
    {uid&&owner&&executerFavori&&<AutomatisationFavoris revisionVerification={revisionVerification} onErreur={setControleEnvoi} masquerSansSelection key={scope} uid={uid} owner={owner} ownerActuel={ownerActuel} headers={headers} selection={selection} reglagesPrets={!!reglages.enregistres&&!reglages.sauvegarde} reglages={{message,pourcentage:reduction,intervalleMinutes:intervalle}} preparerReglages={preparerReglages} executer={executerFavori} disponible={favorisDisponible} raisonExtension={favorisRaison} verifierExtension={verifierExtension} onEtat={vue=>setHistorique({scope,vue})}/>}

  </section>;
}
