import React from 'react';
import {createPortal} from 'react-dom';
import {lireFavorisVinted,preparerMessageFavori,ageFavori,indexerContactsFavoris,articleFavoriVendu,executerFavoriDisponible} from './favorisVinted.js';
import {lireReglagesFavoris,sauverReglagesFavoris,validerReglagesFavoris,offreFavori,MESSAGE_PAR_DEFAUT} from './reglagesFavoris.js';
import {personnaliserMessageFavori,prixOffreFavori,aDesVariablesFavori} from './favorisMessage.js';
import {controleOuvertureFavori,echecVerificationFavori} from './favorisOuverture.js';
import AutomatisationFavoris from './AutomatisationFavoris.jsx';
import ModeAutoFavoris from './ModeAutoFavoris.jsx';
import DiagnosticFavoris from './DiagnosticFavoris.jsx';
import {RAISONS_FAVORIS,progressionFavoris,dureeFavoris} from './favorisProgression.js';
import {articlesFavoris,filtrerArticles,apercuMessageFavori,texteEtatPersonne,pseudoFavori,PERIODES_FAVORIS,FILTRES_ARTICLES} from './favorisEcran.js';
import CarteMois from './design/CarteMois.jsx';
// La photo vient du CDN de Vinted : elle passe par `PhotoVinted` (sans référent,
// secours par l'extension, pictogramme), fourni par l'app. Sans lui, aucune
// image : une photo Vinted affichée hors de la règle partirait cassée.
const AUCUN_ARTICLE_VENDU=new Set();
const PictoFavori = <span className="vrm-favoris-photo" aria-label="Photo indisponible">♡</span>;
function PhotoNotification({src, PhotoVinted}) {
  return src&&PhotoVinted?<PhotoVinted src={src} alt="Photo de la notification" loading="lazy" repli={PictoFavori}/>:PictoFavori;
}
// ── MESSAGES AUX FAVORIS, EN UNE FENÊTRE (28 octobre) ─────────────────────
// Julien : « fais comme pour les republications, un onglet qui s'ouvre avec
// les paramètres, les réductions, le temps aléatoire… enlève ce qui existe et
// restructure ». L'écran ne garde qu'un résumé et UN bouton ; tout le reste se
// fait dans la fenêtre, en trois étapes : 1. Choisir · 2. Message · 3. Envoi.
// Le moteur (`AutomatisationFavoris`) reste monté fenêtre fermée : une file en
// cours continue tant que l'écran des favoris est ouvert, comme avant.
const ETAPES=[['choix','1. Choisir'],['message','2. Message'],['envoi','3. Envoi']];
const ETAT_ENVOI={attente:'En attente',reserve:'En cours…',envoye:'Envoyé',ignore:'Conversation déjà commencée — rien envoyé',incertain:'À vérifier sur Vinted',annule:'Annulé — non envoyé',verifie:'Clôturé après vérification',refuse:'Interrompu'};

export default function FavorisVinted({uid,owner,ownerActuel,base,headers,nomCompte,executerFavori,favorisDisponible=false,favorisRaison='',favorisPerso=false,verifierExtension,recupererPage,ouvrirFavori,chargementAutomatique=false,PhotoVinted=null,ecranActif=true,FermeAuRetour=null,articlesVendus=AUCUN_ARTICLE_VENDU,extensionAuto=null,articleFavori=null}) {
  const [vueAuto,setVueAuto]=React.useState(null),[periode,setPeriode]=React.useState('30'),[filtreChoisi,setFiltreArticles]=React.useState(null),[maxArticles,setMaxArticles]=React.useState(20),[detail,setDetail]=React.useState(null);
  const [etat,setEtat]=React.useState({}),[selection,setSelection]=React.useState([]),[message,setMessage]=React.useState(''),[retour,setRetour]=React.useState(''),[max,setMax]=React.useState(50);
  // L'offre (29 oct., comme Vintex) : aucune · diminuer (% ou €) · fixer à un prix ; arrondi à l'euro.
  const [offreChoix,setOffreChoix]=React.useState('aucune'),[typeDim,setTypeDim]=React.useState('pct'),[montantOffre,setMontantOffre]=React.useState(''),[arrondi,setArrondi]=React.useState(false),champMessage=React.useRef(null);
  const [reduction,setReduction]=React.useState(''),[intervalle,setIntervalle]=React.useState('6'),[rythme,setRythme]=React.useState('fixe'),[intervalleMax,setIntervalleMax]=React.useState('12'),[reglages,setReglages]=React.useState({});
  const [historique,setHistorique]=React.useState(null),[filtre,setFiltre]=React.useState('tous'),[recherche,setRecherche]=React.useState(''),[maintenant,setMaintenant]=React.useState(Date.now()),[importation,setImportation]=React.useState(false);
  const [ouverture,setOuverture]=React.useState(''),[verifications,setVerifications]=React.useState({}),[controle,setControle]=React.useState(null),[controleEnvoi,setControleEnvoi]=React.useState(null),[erreurOuverture,setErreurOuverture]=React.useState(''),[revisionVerification,setRevisionVerification]=React.useState(0);
  const [preparation,setPreparation]=React.useState(false),[feuille,setFeuille]=React.useState(false),[etape,setEtape]=React.useState('choix');
  const ouvrirEnCours=React.useRef(false),retourVinted=React.useRef(false);
  const importEnCours=React.useRef(false),annulerImport=React.useRef(false);
  const reglagesLus=React.useRef(false),edition=React.useRef(0),sauvegarde=React.useRef(false);
  const change=()=>{edition.current++;setRetour('');setReglages(x=>x.prets?{...x,enregistres:false,erreur:''}:x);};
  const offreMode=offreChoix==='fixer'?'prix':offreChoix==='diminuer'?typeDim:null;
  const champsOffre={pourcentage:offreMode==='pct'?reduction:null,offreMode,offreValeur:offreMode==='euros'||offreMode==='prix'?montantOffre:null,arrondi:!!offreMode&&arrondi};
  let offre=null,erreurOffre='';try{offre=offreFavori(champsOffre);}catch(e){erreurOffre=e.message;}
  const apercu0=preparerMessageFavori(message,null),apercu={...apercu0,erreur:apercu0.erreur||erreurOffre};
  const configuration={message,...champsOffre,intervalleMinutes:rythme==='vintex'?'0':intervalle,intervalleMaxMinutes:rythme==='aleatoire'?intervalleMax:null};
  let erreurRythme='';try{validerReglagesFavoris({...configuration,message:apercu.message?message:'x',...(erreurOffre?{pourcentage:null,offreMode:null,offreValeur:null,arrondi:false}:{})});}catch(e){erreurRythme=e.message;}
  // Variables ou offre en euros / arrondie : l'extension 5.281 seulement.
  const exigePerso=aDesVariablesFavori(message)||!!offreMode&&(offreMode!=='pct'||arrondi);
  const offreObjet=offre?.offreMode?{mode:offre.offreMode,valeur:offre.offreMode==='pct'?offre.pourcentage:offre.offreValeur,arrondi:offre.arrondi}:null;
  const exempleOffre=offreObjet?prixOffreFavori(50,offreObjet):null;
  const prixFixeTexte=offreObjet?.mode==='prix'?(offreObjet.arrondi?Math.floor(offreObjet.valeur):offreObjet.valeur).toFixed(2).replace('.',','):'';
  const inserer=t=>{const el=champMessage.current,a=el?.selectionStart??message.length,b=el?.selectionEnd??message.length;const suite=(message.slice(0,a)+t+message.slice(b)).slice(0,2000);setMessage(suite);change();requestAnimationFrame(()=>{try{el?.focus();el?.setSelectionRange(a+t.length,a+t.length);}catch{}});};
  const requete=React.useRef(0),occupe=React.useRef(false);
  const scope=owner+':'+uid, data=etat.scope===scope?etat.data:undefined;
  React.useEffect(()=>{requete.current++;occupe.current=false;setEtat({});setHistorique(null);setPreparation(false);setImportation(false);setOuverture('');setVerifications({});setControle(null);setControleEnvoi(null);setErreurOuverture('');ouvrirEnCours.current=false;retourVinted.current=false;setFiltre('tous');setRecherche('');annulerImport.current=true;setSelection([]);setMessage('');setReduction('');setOffreChoix('aucune');setTypeDim('pct');setMontantOffre('');setArrondi(false);setIntervalle('6');setRythme('fixe');setIntervalleMax('12');setReglages({});setFeuille(false);setEtape('choix');reglagesLus.current=false;edition.current=0;sauvegarde.current=false;setRetour('');setMax(50);setVueAuto(null);setPeriode('30');setFiltreArticles(null);setMaxArticles(20);setDetail(null);return()=>{requete.current++;};},[uid,owner]);
  const charger=async()=>{
    if(occupe.current||sauvegarde.current)return;
    const n=++requete.current;occupe.current=true;setEtat({scope,charge:true});setSelection([]);setRetour('');
    try{
      const opts={uid,owner,ownerActuel,base,headers:headers()};
      const [favoris,prefs]=await Promise.allSettled([lireFavorisVinted(opts),reglagesLus.current?Promise.resolve(null):lireReglagesFavoris(opts)]);
      if(n!==requete.current||ownerActuel()!==owner)return;
      if(prefs.status==='fulfilled'&&prefs.value){
        reglagesLus.current=true;setReglages({prets:true,enregistres:prefs.value.enregistres&&edition.current===0});
        if(edition.current===0){const v=prefs.value;setMessage(v.message);setReduction(v.pourcentage==null?'':String(v.pourcentage));setOffreChoix(v.offreMode==='prix'?'fixer':v.offreMode?'diminuer':'aucune');setTypeDim(v.offreMode==='euros'?'euros':'pct');setMontantOffre(v.offreValeur==null?'':String(v.offreValeur).replace('.',','));setArrondi(v.arrondi===true);if(v.intervalleMinutes===0){setRythme('vintex');setIntervalle('6');setIntervalleMax('12');}else{setIntervalle(String(v.intervalleMinutes));if(v.intervalleMaxMinutes){setRythme('aleatoire');setIntervalleMax(String(v.intervalleMaxMinutes));}else{setRythme('fixe');setIntervalleMax(String(v.intervalleMinutes*2));}}}
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
  const vendus=React.useMemo(()=>new Set([...articlesVendus].map(String)),[articlesVendus]);
  const vendusActuels=React.useRef(vendus);vendusActuels.current=vendus;
  const vendue=x=>articleFavoriVendu(x,vendus);
  const statut=React.useMemo(()=>indexerContactsFavoris(jobs),[jobs]);
  const bloque=x=>vendue(x)||['envoye','ignore','incertain','verifie','reserve','attente'].includes(statut(x)?.etat);
  const correspond=(x,f)=>f==='tous'||f==='envoyes'&&statut(x)?.etat==='envoye'||f==='contacter'&&!bloque(x)||f==='contactes'&&statut(x)?.etat==='ignore'||f==='encours'&&['attente','reserve'].includes(statut(x)?.etat)||f==='verifier'&&statut(x)?.etat==='incertain'||f==='clos'&&statut(x)?.etat==='verifie'||f==='selection'&&selection.includes(x.id)||f==='interrompus'&&['refuse','annule'].includes(statut(x)?.etat)||f==='vendus'&&vendue(x);
  const filtrees=lignes.filter(x=>correspond(x,filtre)&&(!recherche.trim()||`${x.nom} ${x.body}`.toLocaleLowerCase('fr').includes(recherche.trim().toLocaleLowerCase('fr'))));
  const visibles=filtrees.slice(0,max);
  const selectionnees=selection.map(id=>lignes.find(x=>x.id===id)).filter(Boolean);
  const horsVue=selectionnees.filter(x=>!visibles.some(v=>v.id===x.id)).length;
  const vueFile=historique?.scope===scope?historique.vue:null;
  const fileActive=vueFile?.active===true;
  const selectionVerrouillee=fileActive||preparation;
  const cibleVerification=selection.length?selection.map(id=>lignes.find(x=>x.id===id)).find(x=>x?.lien&&!bloque(x)):visibles.find(x=>x.lien&&!bloque(x));
  React.useEffect(()=>{if(!data&&!fileActive)return;setMaintenant(Date.now());const t=setInterval(()=>setMaintenant(Date.now()),fileActive?1000:60000);return()=>clearInterval(t);},[data,fileActive]);
  React.useEffect(()=>{setSelection(anciens=>{const nouveaux=anciens.filter(id=>{const x=lignes.find(n=>n.id===id);return x&&!vendue(x)&&!['envoye','ignore','incertain','verifie'].includes(statut(x)?.etat);});return nouveaux.length===anciens.length?anciens:nouveaux;});},[historique,data,vendus]);
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
  const tester=async()=>{if(!verifierExtension)return;setRetour('Vérification de la connexion…');try{const r=await verifierExtension();if(ownerActuel()===owner)setRetour(r.disponible?`Connexion vérifiée · ${r.canal||'extension'}`:r.raison);}catch{if(ownerActuel()===owner)setRetour('La vérification n’a pas abouti. Réessaie dans le navigateur où est l’extension VRM.');}};

  const ouvrir=async x=>{
    if(vendue(x)){setRetour('Article vendu : aucun message ni ouverture de conversation.');return;}
    if(ouvrirEnCours.current||importEnCours.current||fileActive||ownerActuel()!==owner)return;
    ouvrirEnCours.current=true;setRevisionVerification(v=>v+1);retourVinted.current=false;setErreurOuverture('');setControle(null);setControleEnvoi(null);const n=requete.current;setOuverture(x.id);setVerifications(v=>({...v,[x.id]:'en_attente'}));setRetour('Ouverture du favori dans Vinted…');
    try{const r=await ouvrirFavori(x);if(ownerActuel()!==owner||n!==requete.current)return;
      setControle(controleOuvertureFavori(r));
      if(!r?.ok)throw Error(r?.data?.message||r?.error||'L’ouverture n’a pas été confirmée.');
      setVerifications(v=>({...v,[x.id]:r.data?.preuve||'en_attente'}));
      const echec=echecVerificationFavori(r);
      if(echec){retourVinted.current=false;setErreurOuverture(echec);setRetour('');}
      else{retourVinted.current=true;setRetour(r.data?.preuve==='confirmee'?'Le lien natif a été enregistré. Reviens ici pour actualiser la sélection. Aucun message envoyé.':'Vinted est activé, mais la page n’a pas encore confirmé la liaison avec ce favori. Aucun message envoyé.');}
    }catch(e){if(ownerActuel()===owner&&n===requete.current){setErreurOuverture(e.message||'La vérification n’a pas abouti.');setVerifications(v=>({...v,[x.id]:'non_confirmee'}));setControle(c=>c||controleOuvertureFavori({ok:false,controleOuverture:{etape:'exception'}}));setRetour('');}}
    finally{if(ownerActuel()===owner&&n===requete.current){ouvrirEnCours.current=false;setOuverture('');if(retourVinted.current&&document.visibilityState==='visible'&&document.hasFocus())setTimeout(()=>{if(retourVinted.current&&!ouvrirEnCours.current&&ownerActuel()===owner&&n===requete.current){retourVinted.current=false;charger();}},600);}}
  };
  React.useEffect(()=>{const retour=()=>{if(retourVinted.current&&!ouvrirEnCours.current&&ownerActuel()===owner){retourVinted.current=false;charger();}};window.addEventListener('focus',retour);return()=>window.removeEventListener('focus',retour);},[owner,uid]);

  const choisir=id=>{if(selectionVerrouillee||vendue(lignes.find(x=>x.id===id)))return;setRetour('');setSelection(s=>s.includes(id)?s.filter(x=>x!==id):s.length<10?[...s,id]:s);};
  const copier=async()=>{if(ownerActuel()!==owner||apercu.erreur||!apercu.message)return;const n=requete.current;try{await navigator.clipboard.writeText(personnaliserMessageFavori(apercu.message,'',()=>0));if(n===requete.current)setRetour('Message copié. Tu peux le coller dans la conversation sur Vinted.');}catch{if(n===requete.current)setRetour('Copie indisponible : sélectionne le texte de l’aperçu.');}};
  const enregistrer=async()=>{
    if(sauvegarde.current||occupe.current||!reglagesLus.current||ownerActuel()!==owner)return;
    let contenu;try{contenu=validerReglagesFavoris(configuration);}catch(e){setReglages(x=>({...x,erreur:e.message}));return;}
    sauvegarde.current=true;const n=requete.current,e=edition.current;setReglages(x=>({...x,sauvegarde:true,erreur:''}));setRetour('');
    try{
      await sauverReglagesFavoris({uid,owner,ownerActuel,base,headers:headers()},contenu);
      if(n===requete.current&&ownerActuel()===owner){setReglages({prets:true,enregistres:e===edition.current});if(e===edition.current)return contenu;}
    }catch(e){if(n===requete.current&&ownerActuel()===owner){reglagesLus.current=false;setReglages({prets:false,erreur:e.message});}}
    finally{if(n===requete.current)sauvegarde.current=false;}
  };
  const preparerReglages=async()=>{
    if(selection.some(id=>!lignes.some(x=>x.id===id&&!bloque(x))))throw Error('Un favori sélectionné n’est plus disponible pour un nouvel envoi. Actualise la liste et vérifie ta sélection.');
    if(!reglages.prets||!reglagesLus.current)throw Error(reglages.erreur||'Actualise les favoris pour lire les réglages de ce compte.');
    const contenu=validerReglagesFavoris(configuration);
    if(reglages.enregistres)return contenu;
    const sauves=await enregistrer();
    if(!sauves)throw Error('Enregistrement non confirmé ou texte modifié pendant la sauvegarde. Vérifie ton message avant de relancer.');
    return sauves;
  };
  const ouvrirFeuille=()=>{if(!data&&!etat.charge)charger();setEtape(fileActive?'envoi':'choix');setFeuille(true);};
  const fermerFeuille=()=>{if(!preparation)setFeuille(false);};
  // Ce qui part (ou est parti) : la sélection, sinon les favoris du dernier lot.
  const lot=vueFile?.lot,dansLot=lot?lignes.filter(x=>statut(x)?.lot===lot):[];
  const destinataires=selectionnees.length?selectionnees:dansLot;
  const p=progressionFavoris(vueFile,maintenant);
  const compter=f=>lignes.filter(x=>correspond(x,f)).length;
  const nomFavori=x=>pseudoFavori(x)||x.body.slice(0,60);
  const sansNom=x=>x.nom&&x.body.startsWith(x.nom+' ')?x.body.slice(x.nom.length).trim():x.body;
  const rythmeTexte=vueFile?.intervalleMinutes===0?'6 à 10 s entre deux, comme Vintex':vueFile?.intervalleMaxMinutes?`entre ${vueFile.intervalleMinutes} et ${vueFile.intervalleMaxMinutes} min, au hasard`:vueFile?.intervalleMinutes?`toutes les ${vueFile.intervalleMinutes} min`:'';

  const blocDestinataires=!!selectionnees.length&&<div className="vrm-favoris-destinataires" aria-label="Destinataires sélectionnés"><strong>{selection.length} destinataire{selection.length>1?'s':''} · {nomCompte||'ce compte Vinted'}</strong><ul>{selectionnees.map(x=><li key={x.id}><div><b>{x.nom||'Nom indisponible'}</b><span>{sansNom(x)}</span></div><button type="button" disabled={selectionVerrouillee} aria-label={`Retirer ${x.nom||'ce favori'} de la sélection`} onClick={()=>choisir(x.id)}>Retirer</button></li>)}</ul></div>;
  const assistance=<DiagnosticFavoris uid={uid} owner={owner} ownerActuel={ownerActuel} base={base} headers={headers} controle={controle} controleEnvoi={controleEnvoi} copierControle={(controleEnvoi||controle&&controle.preuve!=='confirmee')?async()=>{try{await navigator.clipboard.writeText(JSON.stringify({...(controle||{diagnostic:'VRM-favoris-controle-v1'}),...(controleEnvoi?{lancement:controleEnvoi}:{})},null,2));setRetour('Contrôle copié, sans identifiant, lien ni message privé.');}catch{setRetour('Copie indisponible dans ce navigateur.');}}:null}/>;
  const alertes=<>
    {etat.scope===scope&&etat.erreur&&<p role="alert">{etat.erreur}</p>}
    {erreurOuverture&&<p role="alert" className="vrm-favoris-note"><strong>Vérification interrompue : </strong>{erreurOuverture}</p>}
    {retour&&<p role="status">{retour}</p>}

  </>;
  const ligneFavori=(x,coche)=><article key={x.id} className={selection.includes(x.id)?'is-selected':''} data-favori={x.id}>
    {coche?<label className="vrm-favoris-check"><input type="checkbox" aria-label={`Sélectionner ${x.nom||x.body.slice(0,100)}`} checked={selection.includes(x.id)} disabled={selectionVerrouillee||importation||bloque(x)||!selection.includes(x.id)&&selection.length>=10} onChange={()=>choisir(x.id)}/></label>:<span aria-hidden="true"/>}
    <PhotoNotification src={x.photo} PhotoVinted={PhotoVinted}/>
    <div className="vrm-favoris-texte">{x.nom&&<strong title={x.nom}>{x.nom}</strong>}<p title={x.body}>{sansNom(x)}</p><div className="vrm-favoris-meta">{vendue(x)&&<span className="vrm-favoris-badge is-vendu">Article vendu</span>}<time dateTime={x.date||undefined} title={x.date?'Date indiquée par la notification : '+new Date(x.date).toLocaleString('fr-FR'):undefined}>{ageFavori(x.date,maintenant)}</time>{verifications[x.id]&&!['envoye','ignore'].includes(statut(x)?.etat)&&<span className="vrm-favoris-badge">{verifications[x.id]==='confirmee'?'Lien enregistré':verifications[x.id]==='non_confirmee'?'Capture non confirmée':'Capture en attente'}</span>}{statut(x)?.etat==='envoye'?<span className="vrm-favoris-badge is-envoye" title={statut(x).envoyeLe?`Envoi confirmé le ${new Date(statut(x).envoyeLe).toLocaleString('fr-FR')}`:'Envoi VRM confirmé'}>Message déjà envoyé</span>:statut(x)?.etat==='ignore'?<span className="vrm-favoris-badge">Conversation commencée</span>:statut(x)?.etat==='incertain'?<span className="vrm-favoris-badge">Envoi à vérifier</span>:['attente','reserve'].includes(statut(x)?.etat)?<span className="vrm-favoris-badge">Dans la file</span>:statut(x)?.etat==='verifie'?<span className="vrm-favoris-badge">Clôturé manuellement · envoi non confirmé</span>:statut(x)?.etat==='refuse'?<span className="vrm-favoris-badge" title={RAISONS_FAVORIS[statut(x).raison]||'La tentative a été interrompue.'}>Envoi interrompu</span>:statut(x)?.etat==='annule'?<span className="vrm-favoris-badge">Annulé dans la file · non envoyé</span>:null}</div>{statut(x)?.etat==='refuse'&&<small className="vrm-favoris-raison">{RAISONS_FAVORIS[statut(x).raison]||'La tentative a été interrompue. Consulte le résultat dans la file avant de relancer.'}</small>}</div>
    {vendue(x)?<small className="vrm-favoris-vendu-action" aria-label="Message indisponible : article vendu">—</small>:x.lien&&ouvrirFavori?<button className="vrm-favoris-ouvrir" type="button" disabled={!!ouverture||importation||selectionVerrouillee} onClick={()=>ouvrir(x)} aria-label={`Ouvrir ce favori pour vérifier sur Vinted${x.nom?' · '+x.nom:''}`}><span>{ouverture===x.id?'Ouverture…':'Vérifier sur Vinted'}</span><svg className="vrm-favoris-ouvrir-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg></button>:x.lien?<a href={x.lien} target="_blank" rel="noreferrer" aria-label="Ouvrir la notification sur Vinted"><span>Ouvrir sur Vinted</span><svg className="vrm-favoris-ouvrir-icon" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg></a>:<small>Lien indisponible</small>}
  </article>;

  const contenuFeuille=<div className="vrm-favoris-voile" data-noswipe="1" hidden={!feuille} onClick={fermerFeuille}>
    {feuille&&FermeAuRetour&&<FermeAuRetour fermer={fermerFeuille}/>}
    <div className="vrm-favoris-liste vrm-favoris-feuille" role="dialog" aria-modal="true" aria-label="Message aux favoris" data-favoris-feuille data-favoris-etape={etape} onClick={e=>e.stopPropagation()}>
      <div className="vrm-favoris-feuille-tete">
        <div><strong>Message aux favoris</strong><small>{nomCompte||'Compte Vinted sélectionné'}</small><div className="vrm-favoris-etapes">{ETAPES.map(([k,l])=><span key={k} aria-current={etape===k?'step':undefined}>{l}</span>)}</div></div>
        <button type="button" className="vrm-favoris-fermer" aria-label="Fermer" disabled={preparation} onClick={fermerFeuille}>×</button>
      </div>
      <div className="vrm-favoris-feuille-corps">
        {etat.charge&&!data&&<p role="status">Lecture des favoris…</p>}
        {feuille&&alertes}{feuille&&assistance}

        {etape==='choix'&&data&&<>
          <p className="vrm-favoris-note">Choisis jusqu’à 10 favoris. Ceux déjà contactés (ou en conversation) ne peuvent pas être recochés.</p>
          {ouvrirFavori&&<p className="vrm-favoris-note">« Vérifier sur Vinted » ouvre la cloche puis la conversation de ce favori, pour que VRM apprenne à qui écrire. Aucun message n’est envoyé.</p>}
          <div className="vrm-favoris-outils">
            {recupererPage&&<button type="button" onClick={importer} disabled={importation||etat.charge||selectionVerrouillee}>{importation?'Récupération…':data.archive?.sync&&!data.archive.sync.complete?'Compléter les pages restantes':'Récupérer toutes les pages'}</button>}
            {importation&&<button type="button" onClick={()=>{annulerImport.current=true;}}>Arrêter la lecture</button>}
            {ouvrirFavori&&<button type="button" onClick={()=>cibleVerification&&ouvrir(cibleVerification)} disabled={!cibleVerification||!!ouverture||importation||etat.charge||selectionVerrouillee}>{ouverture?'Vérification…':selection.length?'Vérifier le premier sélectionné':'Vérifier un favori'}</button>}
            {verifierExtension&&<button type="button" onClick={tester} disabled={importation}>Tester la connexion</button>}
          </div>
          <div className="vrm-favoris-filtres"><label>Rechercher un favori<input type="search" value={recherche} onChange={e=>{setRecherche(e.target.value);setMax(50);}} placeholder="Nom, article…"/></label><div role="group" aria-label="Filtrer les favoris">{[['tous','Tous'],['contacter','À contacter'],['envoyes','Déjà envoyés'],['contactes','Conversation commencée'],['encours','Dans la file'],['verifier','Envoi à vérifier'],['clos','Clôturés'],['interrompus','Interrompus'],['vendus','Articles vendus'],['selection','Sélection']].filter(([id])=>id!=='selection'||selection.length>0||filtre==='selection').map(([id,label])=><button type="button" key={id} aria-pressed={filtre===id} onClick={()=>{setFiltre(id);setMax(50);}}>{label}{` (${compter(id)})`}</button>)}</div></div>
          <div className="vrm-favoris-selection"><span data-favoris-choisis={selection.length}>{selection.length} choisi{selection.length>1?'s':''} · 10 au plus par envoi</span><button type="button" disabled={selectionVerrouillee||importation||!visibles.some(x=>!bloque(x))} onClick={()=>{setSelection(visibles.filter(x=>!bloque(x)).slice(0,10).map(x=>x.id));setRetour('');}}>Les 10 premiers</button>{!!selection.length&&<button type="button" disabled={selectionVerrouillee} onClick={()=>setSelection([])}>Aucun</button>}</div>
          {horsVue>0&&<div className="vrm-favoris-hors-vue" role="status">{horsVue} favori{horsVue>1?'s':''} sélectionné{horsVue>1?'s':''} hors de cette vue.<button type="button" onClick={()=>{setRecherche('');setFiltre('selection');setMax(50);}}>Voir toute ma sélection</button></div>}
          <div className="vrm-favoris-rows">{visibles.map(x=>ligneFavori(x,true))}</div>
          {!visibles.length&&<p>Aucun favori ne correspond à ce filtre.</p>}{visibles.length<filtrees.length&&<button type="button" onClick={()=>setMax(x=>x+50)}>Afficher les suivants</button>}
          {blocDestinataires}
        </>}

        {etape==='message'&&<div className="vrm-favoris-compose">
          {blocDestinataires}
          <label>Ton message<textarea ref={champMessage} data-favoris-message disabled={preparation} maxLength={2000} rows={4} value={message} onChange={e=>{setMessage(e.target.value);change();}} placeholder="Bonjour {username}, merci pour ton favori !"/></label>
          <div className="vrm-favoris-variables" role="group" aria-label="Variables du message"><button type="button" data-favoris-variable="username" disabled={preparation} onClick={()=>inserer('{username}')}>{'{username}'}</button><button type="button" data-favoris-variable="variante" disabled={preparation} onClick={()=>inserer('{Bonjour|Salut}')}>{'{a|b}'} variante</button></div>
          <small>{'{username}'} : le pseudo de la personne. {'{Bonjour|Salut}'} : un des choix, tiré au hasard pour chaque message.</small>
          {!message.trim()&&offreChoix!=='aucune'&&<small data-favoris-message-defaut>Message vide : VRM enverra « {MESSAGE_PAR_DEFAUT} » avec ton offre.</small>}
          <div className="vrm-favoris-offre" data-favoris-offre={offreChoix}>
            <strong>Offre de prix Vinted</strong>
            <div role="group" aria-label="Offre de prix" className="vrm-favoris-segment">{[['aucune','Sans offre'],['diminuer','Diminuer'],['fixer','Fixer à']].map(([id,l])=><button type="button" key={id} data-favoris-offre-choix={id} disabled={preparation} aria-pressed={offreChoix===id} onClick={()=>{setOffreChoix(id);change();}}>{l}</button>)}</div>
            {offreChoix==='diminuer'&&<>
              <div role="group" aria-label="Type de baisse" className="vrm-favoris-segment"><button type="button" data-favoris-offre-type="pct" aria-label="Baisse en pourcentage" disabled={preparation} aria-pressed={typeDim==='pct'} onClick={()=>{setTypeDim('pct');change();}}>%</button><button type="button" data-favoris-offre-type="euros" aria-label="Baisse en euros" disabled={preparation} aria-pressed={typeDim==='euros'} onClick={()=>{setTypeDim('euros');change();}}>€</button></div>
              {typeDim==='pct'?<div className="vrm-favoris-remise"><label>Baisse (%)<input data-favoris-offre-valeur disabled={preparation} type="text" inputMode="numeric" maxLength={6} value={reduction} onChange={e=>{setReduction(e.target.value);change();}} placeholder="10"/></label><div role="group" aria-label="Pourcentages de baisse">{[5,10,15,20].map(v=><button type="button" disabled={preparation} key={v} aria-pressed={offre?.pourcentage===v} onClick={()=>{setReduction(String(v));change();}}>−{v}&nbsp;%</button>)}</div></div>
                :<label>Baisse (€)<input data-favoris-offre-valeur disabled={preparation} type="text" inputMode="decimal" maxLength={9} value={montantOffre} onChange={e=>{setMontantOffre(e.target.value);change();}} placeholder="5"/></label>}
            </>}
            {offreChoix==='fixer'&&<label>Prix de l’offre (€)<input data-favoris-offre-valeur disabled={preparation} type="text" inputMode="decimal" maxLength={9} value={montantOffre} onChange={e=>{setMontantOffre(e.target.value);change();}} placeholder="45"/></label>}
            {offreChoix!=='aucune'&&<label className="vrm-favoris-arrondi"><input type="checkbox" data-favoris-arrondi disabled={preparation} checked={arrondi} onChange={e=>{setArrondi(e.target.checked);change();}}/>Arrondir à l’euro inférieur</label>}
            {offreChoix!=='aucune'&&!erreurOffre&&<small data-favoris-offre-exemple>{offreChoix==='fixer'?`Offre à ${prixFixeTexte}\u00a0€ sur chaque article. Si l’annonce coûte ce prix ou moins, aucune offre : le message part seul.`:`Exemple : une annonce à 50,00\u00a0€ reçoit une offre à ${exempleOffre?exempleOffre.replace('.',','):'—'}\u00a0€.`} Une vraie offre Vinted est faite juste avant le message. Si le prix de l’annonce ne peut pas être lu, le message part sans offre.</small>}
          </div>
          {apercu.erreur&&<p role="alert">{apercu.erreur}</p>}
          {exigePerso&&!favorisPerso&&<p role="alert" data-favoris-maj>Ces variables ou cette offre demandent l’extension 5.281. Mets-la à jour puis recharge-la (⟳) avant de lancer.</p>}
          {!!apercu.message&&<div className="vrm-favoris-apercu"><strong>Aperçu{destinataires[0]?.nom&&aDesVariablesFavori(message)?` pour ${destinataires[0].nom}`:''}</strong><output aria-label="Aperçu du message" data-favoris-apercu>{personnaliserMessageFavori(apercu.message,destinataires[0]?.nom||'',()=>0)}</output>{/\{[^{}]*\|/.test(message)&&<small>Les variantes changent à chaque message ; l’aperçu montre la première.</small>}</div>}
          <button type="button" disabled={!apercu.message||!!apercu.erreur} onClick={copier}>Copier le message</button>
        </div>}

        {etape==='envoi'&&<div className="vrm-favoris-envoi">
          <div className="vrm-favoris-rythme" data-favoris-rythme={rythme}>
            <strong>Temps entre deux messages</strong>
            <div role="group" aria-label="Temps entre deux messages" className="vrm-favoris-segment"><button type="button" disabled={selectionVerrouillee} aria-pressed={rythme==='fixe'} onClick={()=>{setRythme('fixe');change();}}>Fixe</button><button type="button" disabled={selectionVerrouillee} aria-pressed={rythme==='aleatoire'} onClick={()=>{setRythme('aleatoire');change();}}>Aléatoire</button><button type="button" data-favoris-rythme-vintex disabled={selectionVerrouillee} aria-pressed={rythme==='vintex'} onClick={()=>{setRythme('vintex');change();}}>Comme Vintex</button></div>
            {rythme==='vintex'?<p className="vrm-favoris-cadence">Un message toutes les 6 à 10 secondes environ, tiré au hasard : le rythme mesuré chez Vintex.</p>:rythme==='fixe'?<label className="vrm-favoris-cadence">Un message toutes les<input disabled={selectionVerrouillee} aria-label="Minutes entre deux messages" type="text" inputMode="numeric" maxLength={4} value={intervalle} onChange={e=>{setIntervalle(e.target.value);change();}}/>minutes</label>
              :<div className="vrm-favoris-cadence"><span>Entre</span><input disabled={selectionVerrouillee} aria-label="Minimum (minutes)" type="text" inputMode="numeric" maxLength={4} value={intervalle} onChange={e=>{setIntervalle(e.target.value);change();}}/><span>et</span><input disabled={selectionVerrouillee} aria-label="Maximum (minutes)" type="text" inputMode="numeric" maxLength={4} value={intervalleMax} onChange={e=>{setIntervalleMax(e.target.value);change();}}/><span>minutes</span></div>}
            <small>{rythme==='aleatoire'?'Avant chaque message, un temps est tiré au hasard entre ces deux bornes. ':''}Le premier message part tout de suite. Les messages partent de l’onglet vinted.fr ouvert dans le navigateur où est l’extension VRM, comme Vintex : garde-le ouvert pendant l’envoi.</small>
            {erreurRythme&&!selectionVerrouillee&&<p role="alert">{erreurRythme}</p>}
          </div>
          {!!destinataires.length&&<div className="vrm-favoris-compte-rendu" data-favoris-compte-rendu aria-label="Compte rendu par favori"><strong>{selectionnees.length?`${destinataires.length} favori${destinataires.length>1?'s':''} à contacter`:'Dernier envoi'}</strong><ul>{destinataires.map(x=>{const j=statut(x),e=selectionnees.includes(x)&&!j?'pret':j?.etat||'pret';const attenteIci=fileActive&&e==='attente'&&p.secondes>0&&x.id===destinataires.find(y=>statut(y)?.etat==='attente')?.id;return <li key={x.id} data-favoris-envoi={e}><span>{nomFavori(x)}</span><b {...(attenteIci?{'data-favoris-attente':p.secondes}:{})}>{attenteIci?`Attente ${p.secondes<60?p.secondes+' s':dureeFavoris(p.secondes)}…`:e==='pret'?'Prêt':e==='refuse'?(RAISONS_FAVORIS[j.raison]||ETAT_ENVOI.refuse):ETAT_ENVOI[e]||e}</b></li>;})}</ul></div>}
          <p className="vrm-favoris-note">Garde cet écran ouvert et visible, avec l’extension à jour et le bon compte Vinted connecté. Une conversation qui contient déjà des messages est ignorée. Aucune garantie contre un blocage Vinted.</p>
          {reglages.erreur&&<p role="alert">{reglages.erreur} {!reglagesLus.current&&'Actualise la liste pour relire les réglages.'}</p>}
          {reglages.prets&&!reglages.enregistres&&!fileActive&&<button type="button" data-favoris-enregistrer disabled={reglages.sauvegarde||preparation||!apercu.message||!!apercu.erreur||!!erreurRythme} onClick={async()=>{if(await enregistrer())setRetour('Message, réduction et rythme enregistrés pour ce compte. Rien n’est envoyé.');}}>{reglages.sauvegarde?'Enregistrement…':'Enregistrer sans envoyer'}</button>}
        </div>}
        {uid&&owner&&executerFavori&&<div hidden={etape!=='envoi'}><AutomatisationFavoris onPreparation={setPreparation} ecranActif={ecranActif} revisionVerification={revisionVerification} onErreur={setControleEnvoi} key={scope} uid={uid} owner={owner} ownerActuel={ownerActuel} headers={headers} selection={selection} reglagesPrets={!!reglages.enregistres&&!reglages.sauvegarde} reglages={configuration} preparerReglages={preparerReglages} executer={t=>executerFavoriDisponible(t,vendusActuels.current,executerFavori)} disponible={favorisDisponible&&(!exigePerso||favorisPerso)} raisonExtension={favorisDisponible&&exigePerso&&!favorisPerso?'Ces variables ou cette offre demandent l’extension 5.281. Mets-la à jour puis recharge-la (⟳).':favorisRaison} verifierExtension={verifierExtension} onEtat={vue=>setHistorique({scope,vue})}/></div>}
      </div>
      <div className="vrm-favoris-feuille-pied">
        {etape!=='choix'?<button type="button" disabled={selectionVerrouillee} onClick={()=>setEtape(etape==='envoi'?'message':'choix')}>← Retour</button>:<span/>}
        {etape==='choix'&&<button type="button" className="is-principal" disabled={!selection.length} onClick={()=>setEtape('message')}>Continuer · {selection.length}</button>}
        {etape==='message'&&(selection.length?<button type="button" className="is-principal" disabled={!apercu.message||!!apercu.erreur} onClick={()=>setEtape('envoi')}>Continuer</button>
          :<button type="button" className="is-principal" data-favoris-enregistrer-message disabled={!reglages.prets||reglages.sauvegarde||!apercu.message||!!apercu.erreur||!!erreurRythme} onClick={async()=>{if(await enregistrer()){setRetour('Message enregistré. Rien n’est envoyé.');setFeuille(false);}}}>{reglages.sauvegarde?'Enregistrement…':'Enregistrer'}</button>)}
      </div>
    </div>
  </div>;

  // ── L'ÉCRAN « FUSION » (3 nov., sa demande : « fais une meilleure interface pour les
  // messages aux favoris » — premium, peu de couleur, AUCUN texte explicatif, des photos,
  // « article » et pas « paire »). La carte sombre (combien de favoris, envoyés, vendus,
  // en attente, et le mode auto), « Ton message » tel qu'il partira, puis UNE carte par
  // ARTICLE (photo, titre, N°, prix, qui l'a mis en favori, UN état, UN geste). Le
  // rangement est pur (`articlesFavoris`, src/favorisEcran.js) ; rien ne part sans SON
  // clic : « Envoyer » choisit les favoris de CET article et ouvre la feuille d'envoi,
  // où « Lancer » reste son geste (le mode auto, s'il l'a allumé, suit ses garde-fous).
  const journalAuto=(vueAuto?.auto||vueFile?.auto)?.journal||[];
  const ligneParId=new Map(lignes.map(x=>[x.id,x]));
  const lireArticle=id=>{try{return articleFavori?.(id)||null;}catch{return null;}};
  const {cartes,resume}=data?articlesFavoris({lignes,statut,journal:journalAuto,vendue,article:lireArticle,maintenant,periode}):{cartes:[],resume:null};
  // Le filtre : son choix ; sans choix, « À envoyer » s'il y a quelque chose à faire, sinon « Tous ».
  const filtreArticles=filtreChoisi||(filtrerArticles(cartes,'afaire').length?'afaire':'tous');
  const visiblesArticles=filtrerArticles(cartes,filtreArticles);
  const PAR_PAGE=20;
  const articlesVus=visiblesArticles.slice(0,maxArticles);
  const modifierMessage=()=>{if(!data&&!etat.charge)charger();setEtape('message');setFeuille(true);};
  const ouvrirEnvoi=()=>{if(!data&&!etat.charge)charger();setEtape('envoi');setFeuille(true);};
  const messageAffiche=message.trim()||(offreChoix!=='aucune'?MESSAGE_PAR_DEFAUT:'');
  // L'exemple de l'aperçu : un VRAI favori (le premier à envoyer, sinon le plus récent),
  // son pseudo tel que Vinted l'écrit et le prix de SON article quand VRM le connaît.
  const exempleCarte=cartes.find(c=>c.geste==='envoyer')||cartes[0]||null;
  const exemplePersonne=exempleCarte?.personnes.find(x=>x.etat==='a_envoyer'&&x.pseudo)||exempleCarte?.personnes.find(x=>x.pseudo)||null;
  const apercuEcran=apercuMessageFavori({message:messageAffiche,offre:offreObjet,exemple:{pseudo:exemplePersonne?.pseudo||'',prix:exempleCarte?.prix},personnaliser:personnaliserMessageFavori,prixOffre:prixOffreFavori});
  const envoyerArticle=c=>{
    if(fileActive||preparation||importation)return;
    const ids=c.personnes.filter(x=>x.etat==='a_envoyer').map(x=>x.id).filter(id=>{const l=ligneParId.get(id);return l&&!bloque(l);}).slice(0,10);
    if(!ids.length)return;
    setSelection(ids);setRetour('');setDetail(null);
    setEtape(reglages.enregistres&&apercu.message&&!apercu.erreur?'envoi':'message');setFeuille(true);
  };
  const ouvrirPersonne=x=>{const l=ligneParId.get(x.id);if(l)ouvrir(l);};
  const gesteCarte=c=>c.geste==='envoyer'?()=>envoyerArticle(c):c.geste==='verifier'?ouvrirEnvoi:c.geste==='ouvrir'&&ouvrirFavori?()=>ouvrirPersonne(c.personnes.find(x=>x.ouvrir)):null;
  const LIBELLE_GESTE={envoyer:'Envoyer',verifier:'Vérifier',ouvrir:'Ouvrir'};
  const vignette=(c,taille)=>{const vide=<span className="vrm-fa-photo-vide" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/></svg></span>;
    return <span className="vrm-fa-photo" style={{'--t':taille+'px'}}>{c.photo&&PhotoVinted?<PhotoVinted src={c.photo} alt="" loading="lazy" repli={vide}/>:vide}</span>;};
  const pile=c=>{const n=c.personnes.length,vus=c.personnes.slice(0,3);
    return <span className="vrm-fa-pile" data-fav-personnes={n} aria-label={`${n} favori${n>1?'s':''}`}>{vus.map(x=><i key={x.id} className={x.initiale?'':'is-vide'} title={x.pseudo||undefined} data-fav-initiale={x.initiale||''}>{x.initiale}</i>)}{n>3&&<i className="is-plus">+{n-3}</i>}</span>;};
  const prixTexte=v=>v==null?'':Number(v).toFixed(2).replace('.',',').replace(/,00$/,'')+'\u00a0€';
  const carteDetail=detail?cartes.find(c=>c.cle===detail)||null:null;
  const chargeEnCours=etat.charge&&!data;
  const sansCompte=!uid||!owner;
  const enteteCarte=<div className="vrm-fa-carte-haut">
    <span className="vrm-fu-surtitre" data-fav-compte-nom>{nomCompte||'Favoris'}</span>
    <div className="vrm-fa-seg vrm-fa-seg-sombre" role="group" aria-label="Période">{PERIODES_FAVORIS.map(([k,l])=><button key={k} type="button" aria-pressed={periode===k} data-fav-periode={k} onClick={()=>{setPeriode(k);setMaxArticles(20);}}>{l}</button>)}</div>
  </div>;
  const plur=(n,m)=>n>1?m+'s':m;
  return <section className="vrm-fa vrm-fu-ecran" aria-label="Favoris reçus" data-fav-ecran data-fav-fusion>
    <CarteMois className="vrm-fa-carte" enHaut={enteteCarte}
      valeur={resume?<span data-fav-total={resume.favoris}>{resume.favoris}<span className="vrm-fa-unite"> {plur(resume.favoris,'favori')}</span></span>:null}
      sous={resume?<span data-fav-articles={resume.articles}>{resume.articles>0?`sur ${resume.articles} ${plur(resume.articles,'article')}`:'Aucun favori sur cette période'}</span>:null}
      cases={[
        {cle:'envoyes',n:resume?resume.envoyes:null,l:plur(resume?.envoyes||0,'envoyé'),attrs:{'data-fav-case':'envoyes','data-n':resume?resume.envoyes:''}},
        {cle:'vendus',n:resume?resume.vendus:null,l:plur(resume?.vendus||0,'vendu'),attrs:{'data-fav-case':'vendus','data-n':resume?resume.vendus:''}},
        {cle:'attente',n:resume?resume.attente:null,l:'en attente',attrs:{'data-fav-case':'attente','data-n':resume?resume.attente:''}},
      ]}>
      {!sansCompte&&<ModeAutoFavoris variante="carte" FermeAuRetour={FermeAuRetour} uid={uid} owner={owner} ownerActuel={ownerActuel} headers={headers} nomCompte={nomCompte} extensionAuto={extensionAuto} onVue={setVueAuto}/>}
    </CarteMois>

    {sansCompte&&<p className="vrm-fa-ligne" data-fav-vide="compte">Choisis un compte Vinted au-dessus.</p>}

    {!sansCompte&&<div className="vrm-fa-message vrm-fu-blanc" data-fav-message={!reglages.prets?(reglages.erreur?'erreur':'lecture'):messageAffiche?'pret':'vide'}>
      <div className="vrm-fa-message-tete"><h4>Ton message</h4><button type="button" className="vrm-fa-lien" data-fav-message-modifier disabled={preparation||fileActive} onClick={modifierMessage}>Modifier</button></div>
      {!reglages.prets?<p className="vrm-fa-gris" role={reglages.erreur?'alert':'status'}>{reglages.erreur||'Lecture…'}</p>
        :messageAffiche?<>
          <p className="vrm-fa-bulle" data-fav-message-texte>{apercuEcran.texte}</p>
          {(apercuEcran.offre||!reglages.enregistres)&&<div className="vrm-fa-message-pied">
            {apercuEcran.offre&&<span className="vrm-fa-puce" data-fav-message-offre>{apercuEcran.offre}</span>}
            {!reglages.enregistres&&<span className="vrm-fa-puce is-geste" data-fav-message-brouillon>Pas enregistré</span>}
          </div>}
        </>
        :<button type="button" className="vrm-fa-geste" data-fav-geste onClick={modifierMessage}>Écrire ton message</button>}
    </div>}

    {!sansCompte&&<div className="vrm-fa-barre">
      <div className="vrm-fa-seg" role="group" aria-label="Filtrer les articles">{FILTRES_ARTICLES.map(([k,l])=><button key={k} type="button" aria-pressed={filtreArticles===k} data-fav-filtre={k} onClick={()=>{setFiltreArticles(k);setMaxArticles(20);}}>{l}</button>)}</div>
      <button type="button" className="vrm-fa-rond" aria-label={etat.charge?'Lecture…':'Actualiser'} title="Actualiser" data-fav-actualiser onClick={charger} disabled={preparation||etat.charge||reglages.sauvegarde||importation}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={etat.charge?'is-tourne':''}><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/></svg></button>
      <button type="button" className="vrm-fa-rond" aria-label="Envoyer un message aux favoris" title="Choisir des favoris" data-favoris-ouvrir disabled={importation} onClick={ouvrirFeuille}><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg></button>
    </div>}

    {!feuille&&!detail&&alertes}
    {!sansCompte&&chargeEnCours&&<div className="vrm-fa-liste" aria-busy="true" data-fav-chargement>{[0,1,2].map(i=><div key={i} className="vrm-fa-article vrm-fu-blanc is-squelette"><span className="vrm-fa-photo" style={{'--t':'56px'}}/><span className="vrm-fa-sq"/></div>)}</div>}
    {data&&data.reception==='absente'&&<p className="vrm-fa-ligne is-geste" data-fav-geste data-fav-vide="absente">Ouvre la cloche de Vinted sur ce compte.</p>}
    {data&&data.reception!=='absente'&&!lignes.length&&<p className="vrm-fa-ligne" data-fav-vide="aucun">Aucun favori pour l’instant.</p>}
    {data&&!!lignes.length&&!visiblesArticles.length&&<p className="vrm-fa-ligne" data-fav-vide="filtre">{filtreArticles==='afaire'?'Rien à envoyer.':filtreArticles==='envoyes'?'Aucun message envoyé.':'Aucun favori sur cette période.'}</p>}
    {!!articlesVus.length&&<ul className="vrm-fa-liste" data-fav-liste>{articlesVus.map(c=>{const g=gesteCarte(c);
      return <li key={c.cle} className="vrm-fa-article vrm-fu-blanc" data-fav-article={c.itemId||''} data-fav-etat={c.puce.code} data-fav-geste-article={c.geste||''} {...(c.numero?{'data-fav-numero':c.numero}:{})}>
        <button type="button" className="vrm-fa-article-corps" data-fav-detail onClick={()=>setDetail(c.cle)} aria-label={`${c.titre||'Article'}${c.numero?' · N° '+c.numero:''} · ${c.personnes.length} ${plur(c.personnes.length,'favori')} · ${c.puce.texte}`}>
          {vignette(c,56)}
          <span className="vrm-fa-article-texte">
            <span className="vrm-fa-titre" data-fav-titre>{c.titre||'Article'}</span>
            <span className="vrm-fa-meta">{c.numero&&<span className="vrm-fu-num" data-fav-num>N°{c.numero}</span>}{c.prix!=null&&<span className="vrm-fa-prix" data-fav-prix>{prixTexte(c.prix)}</span>}</span>
            <span className="vrm-fa-bas">{pile(c)}<span className={'vrm-fa-puce'+(c.puce.ton==='geste'?' is-geste':'')} data-fav-puce={c.puce.code}>{c.puce.texte}</span></span>
          </span>
        </button>
        {g&&<button type="button" className={c.geste==='envoyer'?'vrm-fa-envoyer':'vrm-fa-second'} data-fav-action={c.geste} disabled={fileActive||preparation||importation||(c.geste==='ouvrir'&&!!ouverture)} onClick={g}>{c.geste==='ouvrir'&&ouverture?'…':LIBELLE_GESTE[c.geste]}</button>}
      </li>;})}</ul>}
    {visiblesArticles.length>articlesVus.length&&<button type="button" className="vrm-fa-plus" data-fav-plus onClick={()=>setMaxArticles(n=>n+PAR_PAGE)}>Voir plus</button>}

    {carteDetail&&(()=>{const c=carteDetail,g=gesteCarte(c),fermer=()=>setDetail(null);
      const corps=<div className="vrm-favoris-voile vrm-fa-voile" data-noswipe="1" onClick={fermer}>
        {FermeAuRetour&&<FermeAuRetour fermer={fermer}/>}
        <div className="vrm-fa-feuille" role="dialog" aria-modal="true" aria-label={c.titre||'Article'} data-fav-detail-feuille={c.itemId||''} onClick={e=>e.stopPropagation()}>
          <div className="vrm-fa-feuille-tete">
            {vignette(c,48)}
            <div className="vrm-fa-feuille-titre"><strong>{c.titre||'Article'}</strong><span className="vrm-fa-meta">{c.numero&&<span className="vrm-fu-num">N°{c.numero}</span>}{c.prix!=null&&<span className="vrm-fa-prix">{prixTexte(c.prix)}</span>}</span></div>
            <button type="button" className="vrm-fa-fermer" aria-label="Fermer" onClick={fermer}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
          </div>
          {alertes}
          <ul className="vrm-fa-feuille-corps vrm-fa-personnes">{c.personnes.map(x=><li key={x.id} data-fav-personne={x.id} data-fav-etat={x.etat} {...(x.raison?{'data-fav-raison':x.raison}:{})} {...(x.dateEnvoi?{'data-fav-envoye-le':x.dateEnvoi}:{})}>
            <i className={'vrm-fa-avatar'+(x.initiale?'':' is-vide')} aria-hidden="true">{x.initiale}</i>
            <span className="vrm-fa-personne-texte"><b data-fav-pseudo>{x.pseudo||'Pseudo non lu'}</b><small>{x.detail}</small></span>
            {x.ouvrir&&ouvrirFavori?<button type="button" className="vrm-fa-second" data-fav-ouvrir disabled={!!ouverture||importation||fileActive} onClick={()=>ouvrirPersonne(x)}>{ouverture===x.id?'…':'Ouvrir'}</button>
              :<span className={'vrm-fa-puce'+(x.etat==='a_verifier'?' is-geste':'')} data-fav-etat-texte>{texteEtatPersonne(x)}</span>}
          </li>)}</ul>
          {g&&c.geste!=='ouvrir'&&<div className="vrm-fa-feuille-pied"><button type="button" className="vrm-fa-envoyer is-large" data-fav-action={c.geste} disabled={fileActive||preparation||importation} onClick={g}>{LIBELLE_GESTE[c.geste]}</button></div>}
        </div>
      </div>;
      return typeof document!=='undefined'?createPortal(corps,document.body):corps;})()}
    {uid&&owner&&(typeof document!=='undefined'?createPortal(contenuFeuille,document.body):contenuFeuille)}
    {!feuille&&assistance}
  </section>;
}
