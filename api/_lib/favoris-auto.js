// ══════════════════════════════════════════════════════════════════════════════
// MODE AUTOMATIQUE DES MESSAGES AUX FAVORIS — LA DÉCISION SERVEUR (2 nov. 2026)
// ══════════════════════════════════════════════════════════════════════════════
// Julien, « Oui, mode auto » : quand quelqu'un met une annonce en favori, VRM lui
// écrit tout seul. Règles pures : src/favorisAuto.js. Ici :
//   · `etatAuto`   : ce que la file permet MAINTENANT (éteint, pause, horaires,
//                    quotas, espacement, un envoi en cours…) — sans rien lire
//                    d'autre que la ligne neutre ;
//   · `choisirAuto`: les favoris éligibles, un par un (identité PROUVÉE par
//                    `resoudreCiblesFavoris`, paire en vente, jamais contactée) ;
//   · `ajouterAuto`: dans le comparer-et-échanger, revérifie TOUT sur l'état
//                    relu et pose au plus UN message dans la file existante
//                    (autorisation à usage unique, dédoublonnage, `consommer`).
// Le serveur ne contacte jamais Vinted : c'est l'extension, depuis l'onglet
// vinted.fr de CE compte, qui envoie (comme pour un envoi sur son clic).
// « Pas su » ne vaut pas « oui » : toute lecture ratée ⇒ rien n'est ajouté.
import {initialiserFile,vueFile,RefusFavoris} from './favoris-file.js';
import {AUTO_ESSAIS,DEMANDES_AUTO,ETATS_DEMANDE,validerAutoFavoris,dansPlageAuto,limiteJourAuto,attenteFavoriMs,AUTO_FAVORI_MAX_MS,AUTO_RECONTACT_MS,AUTO_AVANT_ECRITURE,AUTO_JOUR_MS,AUTO_HEURE_MS,etatDressingAuto,etatAnnonceAuto} from '../../src/favorisAuto.js';
import {gardeRefuse} from '../../src/offresGarde.js';
import {favorisDepuisNotifications} from '../../src/favorisVinted.js';

const ENVOI_FAIT=['envoye','incertain','reserve','verifie','ignore'];
// Ce couple article/personne a-t-il déjà été traité (pour toujours) ? Seuls un
// favori annulé avant départ, et un refus CERTAIN avant toute écriture chez Vinted
// (l'extension 5.309 dit `ecrits: 0`), laissent le mode auto le reprendre.
// (2 nov., 13 h) Jamais de boucle : un favori refusé avant toute écriture n'est
// repris que tant qu'il lui reste un essai (AUTO_ESSAIS en tout), puis il est traité.
export const reprenable=j=>j.etat==='annule'||j.etat==='refuse'&&j.ecrits===0&&AUTO_AVANT_ECRITURE.includes(j.raison)&&(Number(j.essais)||1)<AUTO_ESSAIS;
export function coupleDejaTraite(d,itemId,recipientId){
  const id=itemId+':'+recipientId;
  return Object.values(d?.groupes||{}).some(g=>(g.jobs||[]).some(j=>j.id===id&&!reprenable(j)));
}
// LA DEMANDE À JULIEN (2 nov., 13 h) : un geste de sa part débloquerait le mode
// auto. Posée une fois (`nouvelle` vrai la première fois : la route envoie alors
// une notification), elle reste affichée tant que le problème dure, et tombe
// d'elle-même dès qu'un tour repart (message posé, ou plus rien qui bloque).
export function noterDemande(g,code,maintenant){
  if(!g?.auto||!DEMANDES_AUTO[code])return false;
  if(g.auto.demande?.code===code)return false;
  g.auto.demande={code,at:maintenant};return true;
}
// Cette personne a-t-elle reçu (ou pu recevoir) un message de ce compte Vinted ces 30 jours ?
export function contacteRecemment(d,recipientId,maintenant){
  return Object.values(d?.groupes||{}).some(g=>(g.jobs||[]).some(j=>j.recipientId===recipientId&&(ENVOI_FAIT.includes(j.etat)||j.etat==='refuse'&&j.ecrits!==0)&&maintenant-(Number(j.traiteLe||j.envoyeLe)||maintenant)<AUTO_RECONTACT_MS));
}
// Ce que la file permet maintenant, sans aucune autre lecture.
export function etatAuto(d,owner,maintenant){
  d=initialiserFile(d);const g=d.groupes[owner],a=g?.auto;
  if(!a?.reglages?.actif)return {etat:'eteint'};
  const pause=Number(d.pauseAutoJusqua)||0;
  if(pause>maintenant)return {etat:'pause',jusqua:pause};
  if(Object.values(d.groupes).some(x=>(x.jobs||[]).some(j=>j.etat==='incertain')))return {etat:'a_verifier'};
  if(d.enCours||Object.values(d.groupes).some(x=>x.active))return {etat:'occupe'};
  if(!dansPlageAuto(a.reglages,maintenant))return {etat:'hors_horaires'};
  const env=(Array.isArray(d.autoEnvois)?d.autoEnvois:[]).filter(t=>t>maintenant-AUTO_JOUR_MS);
  if(env.filter(t=>t>maintenant-AUTO_HEURE_MS).length>=a.reglages.parHeure)return {etat:'quota_heure',jusqua:Math.min(...env.filter(t=>t>maintenant-AUTO_HEURE_MS))+AUTO_HEURE_MS};
  const lim=limiteJourAuto(a.reglages,a.allumeLe,maintenant);
  if(env.length>=lim)return {etat:'quota_jour',limite:lim,jusqua:Math.min(...env)+AUTO_JOUR_MS};
  const prochain=Math.max(g.prochain||0,d.prochainGlobal||0);
  if(prochain>maintenant)return {etat:'espacement',jusqua:prochain};
  return {etat:'libre',limite:lim};
}
// Allumer, régler ou éteindre. L'allumage exige `confirme` (l'app a montré le
// risque) et pose `allumeLe` (montée progressive, favoris d'avant jamais repris).
export function reglerAuto(d,{owner,reglages,confirme,maintenant}){
  d=initialiserFile(d);
  let r;try{r=validerAutoFavoris(reglages);}catch(e){throw new RefusFavoris(e.message,400);}
  const g=d.groupes[owner]||{jobs:[],active:false,prochain:0};
  const avant=g.auto?.reglages?.actif===true;
  if(r.actif&&!avant&&confirme!==true)throw new RefusFavoris('Confirme l’allumage du mode automatique.',400);
  const allumeLe=r.actif?(avant&&Number.isSafeInteger(g.auto?.allumeLe)?g.auto.allumeLe:maintenant):(g.auto?.allumeLe||null);
  g.auto={...(g.auto||{}),reglages:r,allumeLe,journal:g.auto?.journal||[]};
  if(!r.actif)arreterAutoGroupe(g,maintenant);
  d.groupes[owner]=g;d.proprietaires=Object.keys(d.groupes);
  return {data:d,valeur:vueFile(d,owner)};
}
function arreterAutoGroupe(g,maintenant){
  for(const j of g.jobs)if(j.auto&&j.etat==='attente'){j.etat='annule';j.raison='auto_arrete';j.traiteLe=maintenant;}
  if(!g.jobs.some(x=>x.etat==='attente'))g.active=false;
}
// Stop immédiat : éteint, et retire le message auto pas encore parti.
export function stopAuto(d,{owner,maintenant}){
  d=initialiserFile(d);const g=d.groupes[owner];
  if(!g?.auto)return {valeur:vueFile(d,owner)};
  g.auto.reglages={...g.auto.reglages,actif:false};arreterAutoGroupe(g,maintenant);
  return {data:d,valeur:vueFile(d,owner)};
}
// Les favoris de la capture, avec ce que le mode auto en pense — avant toute
// lecture réseau supplémentaire (dates, attente, déjà traité, identité).
// `resoudre(notificationId)` rend la cible prouvée ou lève (jamais devinée).
export function trierFavorisAuto({lignes,d,owner,maintenant,resoudre}){
  const a=d.groupes[owner]?.auto,allumeLe=Number(a?.allumeLe)||Infinity;
  const sauts=[],prets=[];let prochainFavori=null;
  for(const l of [...lignes].sort((x,y)=>(Date.parse(x.date)||0)-(Date.parse(y.date)||0))){
    const t=Date.parse(l.date||'');
    if(!Number.isFinite(t)||t<allumeLe)continue;                    // avant l'allumage, ou date inconnue : jamais repris
    if(maintenant-t>AUTO_FAVORI_MAX_MS){sauts.push({l,raison:'expire'});continue;}
    const quand=t+attenteFavoriMs(l.id,a.reglages);
    if(quand>maintenant){prochainFavori=prochainFavori==null?quand:Math.min(prochainFavori,quand);continue;}
    let cible;try{cible=resoudre(l.id);}catch{sauts.push({l,raison:'destinataire_non_prouve'});continue;}
    if(coupleDejaTraite(d,cible.itemId,cible.recipientId))continue;   // déjà fait : rien à dire de neuf
    if(contacteRecemment(d,cible.recipientId,maintenant)){sauts.push({l,cible,raison:'contacte_30j'});continue;}
    prets.push({l,cible});
  }
  return {sauts,prets,prochainFavori};
}
// Dans le comparer-et-échanger : revérifie sur l'état RELU et pose au plus un
// message. `choisi` = { l, cible } (ou null), `sauts` = à noter au journal.
export function ajouterAuto(d,{owner,maintenant,choisi,sauts=[],message,offre,prochainFavori=null,extension=null,demande=null}){
  d=initialiserFile(d);const g=d.groupes[owner];
  const e=etatAuto(d,owner,maintenant);
  if(!g?.auto)return {valeur:{...e,vue:vueFile(d,owner)}};
  const journal=g.auto.journal||[];const vus=new Set(journal.map(x=>x.notificationId+'\u0000'+x.raison));
  let change=false;
  for(const s of sauts){
    const k=s.l.id+'\u0000'+s.raison;if(vus.has(k))continue;vus.add(k);change=true;
    journal.unshift({at:maintenant,notificationId:s.l.id,...(s.cible?{itemId:s.cible.itemId}:{}),...(s.l.nom?{nom:String(s.l.nom).slice(0,80)}:{}),etat:'saute',raison:s.raison});
  }
  g.auto.journal=journal.slice(0,200);
  let ajoute=false,etat=e.etat,nouvelle=false;
  const pret=e.etat==='libre'&&choisi&&!coupleDejaTraite(d,choisi.cible.itemId,choisi.cible.recipientId)&&!contacteRecemment(d,choisi.cible.recipientId,maintenant);
  // Un message est prêt, mais l'extension ne peut pas l'envoyer (onglet, compte,
  // version) : rien n'est posé (aucun essai gâché), et VRM DEMANDE le geste.
  if(pret&&extension&&extension.disponible!==true){etat='extension';nouvelle=noterDemande(g,DEMANDES_AUTO[extension.code]?extension.code:'extension_indisponible',maintenant);change=change||nouvelle;}
  else if(pret){
    const t=choisi.cible,id=t.itemId+':'+t.recipientId,ancien=g.jobs.find(x=>x.id===id);
    const essais=(ancien&&ancien.etat==='refuse'?Number(ancien.essais)||1:0)+1;
    g.jobs=[...g.jobs.filter(x=>x.id!==id),{id,notificationId:t.notificationId,itemId:t.itemId,recipientId:t.recipientId,initiator:t.initiator,etat:'attente',auto:true,essais,message,intervalleMinutes:0,...(offre?{offre}:{}),lot:'auto',...(choisi.l.nom?{nom:String(choisi.l.nom).slice(0,80)}:{})}];
    if(g.jobs.length>500){const sansAuto=g.jobs.filter(x=>!(x.auto&&['annule','refuse'].includes(x.etat)&&x.ecrits===0));if(sansAuto.length>500)throw new RefusFavoris('La file a atteint sa capacité. Aucun historique de dédoublonnage n’a été effacé.');g.jobs=sansAuto;}
    g.active=true;g.raison='';ajoute=true;change=true;etat='pret';
  }else if(e.etat==='libre')etat=prochainFavori?'attente_favori':'veille';
  // La demande : un état de la file qui attend un geste, ou une demande calculée par
  // le tour (identité jamais prouvée) ; sinon, plus rien ne bloque ⇒ elle tombe.
  if(ETATS_DEMANDE.includes(e.etat)){nouvelle=noterDemande(g,e.etat,maintenant)||nouvelle;change=true;}
  else if(demande&&!ajoute){nouvelle=noterDemande(g,demande,maintenant)||nouvelle;change=change||nouvelle;}
  else if(etat!=='extension'&&g.auto.demande&&(ajoute||['veille','attente_favori'].includes(etat))){delete g.auto.demande;change=true;}
  const prochain=e.jusqua||(etat==='attente_favori'?prochainFavori:null);
  if(g.auto.etat!==etat||g.auto.prochain!==prochain){g.auto.etat=etat;g.auto.prochain=prochain;change=true;}
  d.proprietaires=Object.keys(d.groupes);
  if(JSON.stringify(d).length>1500000)throw new RefusFavoris('La file a atteint sa capacité.');
  return {...(change?{data:d}:{}),valeur:{etat,ajoute,...(nouvelle?{nouvelleDemande:g.auto.demande.code}:{}),vue:vueFile(d,owner)}};
}
// Un tour arrêté AVANT le comparer-et-échanger final (lecture qui demande un geste :
// dressing, garde, boîte, capture, réglages) : la demande est posée quand même.
export function demanderAuto(d,{owner,code,maintenant}){
  d=initialiserFile(d);const g=d.groupes[owner];
  if(!g?.auto?.reglages?.actif||!noterDemande(g,code,maintenant))return {valeur:{nouvelle:false}};
  return {data:d,valeur:{nouvelle:true}};
}
// La fusion archive + capture, exactement comme le lancement sur clic.
export function notificationsCompletes(capture,archive){
  const parId=new Map();
  for(const n of [...(archive?.payload?.notifications||[]),...(capture?.payload?.notifications||[])]){
    const avant=parId.get(n.id);
    if(avant&&(String(avant.user_id)!==String(n.user_id)||avant.link!==n.link))throw new RefusFavoris('Une notification a changé d’identité.');
    parId.set(n.id,{...avant,...n});
  }
  return {...capture,payload:{...capture.payload,notifications:[...parId.values()]}};
}
export {favorisDepuisNotifications,etatDressingAuto,etatAnnonceAuto,gardeRefuse};
