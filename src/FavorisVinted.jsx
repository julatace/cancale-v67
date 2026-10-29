import React from 'react';
import {createPortal} from 'react-dom';
import {lireFavorisVinted,preparerMessageFavori,ageFavori,indexerContactsFavoris,articleFavoriVendu,executerFavoriDisponible} from './favorisVinted.js';
import {lireReglagesFavoris,sauverReglagesFavoris,validerReglagesFavoris,offreFavori,MESSAGE_PAR_DEFAUT} from './reglagesFavoris.js';
import {personnaliserMessageFavori,prixOffreFavori,aDesVariablesFavori} from './favorisMessage.js';
import {controleOuvertureFavori,echecVerificationFavori} from './favorisOuverture.js';
import AutomatisationFavoris from './AutomatisationFavoris.jsx';
import DiagnosticFavoris from './DiagnosticFavoris.jsx';
import {RAISONS_FAVORIS,progressionFavoris,dureeFavoris} from './favorisProgression.js';
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

export default function FavorisVinted({uid,owner,ownerActuel,base,headers,nomCompte,executerFavori,favorisDisponible=false,favorisRaison='',favorisPerso=false,verifierExtension,recupererPage,ouvrirFavori,chargementAutomatique=false,PhotoVinted=null,ecranActif=true,FermeAuRetour=null,articlesVendus=AUCUN_ARTICLE_VENDU}) {
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
  React.useEffect(()=>{requete.current++;occupe.current=false;setEtat({});setHistorique(null);setPreparation(false);setImportation(false);setOuverture('');setVerifications({});setControle(null);setControleEnvoi(null);setErreurOuverture('');ouvrirEnCours.current=false;retourVinted.current=false;setFiltre('tous');setRecherche('');annulerImport.current=true;setSelection([]);setMessage('');setReduction('');setOffreChoix('aucune');setTypeDim('pct');setMontantOffre('');setArrondi(false);setIntervalle('6');setRythme('fixe');setIntervalleMax('12');setReglages({});setFeuille(false);setEtape('choix');reglagesLus.current=false;edition.current=0;sauvegarde.current=false;setRetour('');setMax(50);return()=>{requete.current++;};},[uid,owner]);
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
  const tester=async()=>{if(!verifierExtension)return;setRetour('Vérification de la connexion…');try{const r=await verifierExtension();if(ownerActuel()===owner)setRetour(r.disponible?`Connexion vérifiée · ${r.canal||'extension'}`:r.raison);}catch{if(ownerActuel()===owner)setRetour('La vérification n’a pas abouti. Réessaie dans ce profil Chrome.');}};

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
  const nomFavori=x=>x.nom||x.body.slice(0,60);
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
              <div role="group" aria-label="Type de baisse" className="vrm-favoris-segment"><button type="button" data-favoris-offre-type="pct" disabled={preparation} aria-label="Baisse en pourcentage" aria-pressed={typeDim==='pct'} onClick={()=>{setTypeDim('pct');change();}}>%</button><button type="button" data-favoris-offre-type="euros" disabled={preparation} aria-label="Baisse en euros" aria-pressed={typeDim==='euros'} onClick={()=>{setTypeDim('euros');change();}}>€</button></div>
              {typeDim==='pct'?<div className="vrm-favoris-remise"><label>Baisse (%)<input data-favoris-offre-valeur disabled={preparation} type="text" inputMode="numeric" maxLength={6} value={reduction} onChange={e=>{setReduction(e.target.value);change();}} placeholder="10"/></label><div role="group" aria-label="Pourcentages de baisse">{[5,10,15,20].map(v=><button type="button" disabled={preparation} key={v} aria-pressed={offre?.pourcentage===v} onClick={()=>{setReduction(String(v));change();}}>−{v} %</button>)}</div></div>
                :<label>Baisse (€)<input data-favoris-offre-valeur disabled={preparation} type="text" inputMode="decimal" maxLength={9} value={montantOffre} onChange={e=>{setMontantOffre(e.target.value);change();}} placeholder="5"/></label>}
            </>}
            {offreChoix==='fixer'&&<label>Prix de l’offre (€)<input data-favoris-offre-valeur disabled={preparation} type="text" inputMode="decimal" maxLength={9} value={montantOffre} onChange={e=>{setMontantOffre(e.target.value);change();}} placeholder="45"/></label>}
            {offreChoix!=='aucune'&&<label className="vrm-favoris-arrondi"><input type="checkbox" data-favoris-arrondi disabled={preparation} checked={arrondi} onChange={e=>{setArrondi(e.target.checked);change();}}/>Arrondir à l’euro inférieur</label>}
            {offreChoix!=='aucune'&&!erreurOffre&&<small data-favoris-offre-exemple>{offreChoix==='fixer'?`Offre à ${prixFixeTexte} € sur chaque article. Si l’annonce coûte ce prix ou moins, aucune offre : le message part seul.`:`Exemple : une annonce à 50,00 € reçoit une offre à ${exempleOffre?exempleOffre.replace('.',','):'—'} €.`} Une vraie offre Vinted est faite juste avant le message. Si le prix de l’annonce ne peut pas être lu, le message part sans offre.</small>}
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
            <small>{rythme==='aleatoire'?'Avant chaque message, un temps est tiré au hasard entre ces deux bornes. ':''}Le premier message part tout de suite. Les messages partent de l’onglet vinted.fr ouvert dans ce Chrome, comme Vintex : garde-le ouvert pendant l’envoi.</small>
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
        {etape==='message'&&<button type="button" className="is-principal" disabled={!selection.length||!apercu.message||!!apercu.erreur} onClick={()=>setEtape('envoi')}>Continuer</button>}
      </div>
    </div>
  </div>;

  return <section className="vrm-favoris-liste" aria-label="Favoris reçus">
    <header><div><h3>Favoris reçus</h3><small>{nomCompte||(uid?'Compte Vinted sélectionné':'Choisis le compte à consulter')}</small></div><div className="vrm-favoris-actions"><button type="button" onClick={charger} disabled={preparation||!uid||!owner||etat.charge||reglages.sauvegarde||importation}>{etat.charge?'Lecture…':data?'Actualiser':'Afficher les favoris'}</button></div></header>
    {!uid&&<p className="vrm-favoris-note">Choisis un compte Vinted dans le sélecteur au-dessus pour afficher ses favoris.</p>}
    {!feuille&&alertes}
    {data&&<>
      <p className="vrm-favoris-note">{data.reception==='absente'?'Aucune capture reçue pour ce compte. Ouvre la cloche Vinted avec l’extension connectée, puis actualise.':`${lignes.length} favori${lignes.length>1?'s':''} reçu${lignes.length>1?'s':''}. ${data.archive?.sync?.complete&&!data.archive?.limite?'Toutes les pages de la dernière lecture sont conservées.':'Historique à compléter.'}`}{data.totalPages>1?` Vinted indique ${data.totalPages} pages de notifications.`:''}</p>
      <div className="vrm-favoris-resume" data-favoris-resume><span><b>{compter('contacter')}</b> à contacter</span><span><b>{compter('envoyes')}</b> déjà envoyé{compter('envoyes')>1?'s':''}</span><span><b>{compter('contactes')}</b> en conversation</span></div>
    </>}
    {(fileActive||!!p.total)&&<div className="vrm-favoris-file-resume" data-favoris-file={fileActive?'active':'finie'} role="status">{fileActive?<>Envoi en cours : <b>{p.termines} / {p.total}</b> traités · {p.envoyes} envoyé{p.envoyes>1?'s':''}{p.secondes>0?` · prochain dans ${dureeFavoris(p.secondes)}`:''}{rythmeTexte?` · ${rythmeTexte}`:''}</>:<>Dernier envoi : {p.envoyes} envoyé{p.envoyes>1?'s':''} sur {p.total}{p.incertains?` · ${p.incertains} à vérifier sur Vinted`:''}{p.refuses?` · ${p.refuses} interrompu${p.refuses>1?'s':''}`:''}</>}</div>}
    {uid&&owner&&<div className="vrm-favoris-outils">
      <button type="button" className="is-principal" data-favoris-ouvrir disabled={importation} onClick={ouvrirFeuille}>{fileActive?'Suivre l’envoi en cours':'Envoyer un message aux favoris'}</button>
    </div>}
    {uid&&owner&&(typeof document!=='undefined'?createPortal(contenuFeuille,document.body):contenuFeuille)}
    {!feuille&&assistance}
  </section>;
}
