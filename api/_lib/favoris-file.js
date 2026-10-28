// State machine only. The HTTP adapter authenticates the owner and resolves
// recipients from native captures before passing targets here. No network IO
// inside a CAS decision: a retry must never repeat a Vinted request.
export class RefusFavoris extends Error { constructor(message,status=409){super(message);this.status=status;} }
const entier=v=>typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v);
const clone=v=>structuredClone(v);
export function initialiserFile(d){
  if(d==null)return {version:1,groupes:{},tentatives:[],enCours:null};
  if(d.version!==1||!d.groupes||!Array.isArray(d.tentatives))throw new RefusFavoris('Le format de la file nécessite une vérification.');
  return clone(d);
}
export function vueFile(d,owner){
  const g=d?.groupes?.[owner];
  return g?{active:g.active,raison:g.raison||'',lot:g.lot||null,intervalleMinutes:g.intervalleMinutes,prochain:d.enCours?null:Math.max(g.prochain||0,d.prochainGlobal||0,(d.tentatives||[]).length>=10?d.tentatives[d.tentatives.length-10]+3600000:0),jobs:g.jobs.map(({id,notificationId,etat,raison,lot,traiteLe,envoyeLe})=>({id,notificationId,etat,lot,traiteLe,envoyeLe,...(raison?{raison}:{})}))}:{active:false,raison:'',prochain:null,jobs:[]};
}
export function lancerFile(d,{owner,targets,message,intervalleMinutes,maintenant,lot=String(maintenant)}){
  d=initialiserFile(d);
  if(!Array.isArray(targets)||!targets.length||targets.length>10||typeof message!=='string'||!message.trim()||message.length>2000||!Number.isInteger(intervalleMinutes)||intervalleMinutes<1||intervalleMinutes>1440)throw new RefusFavoris('Sélection ou réglages invalides.',400);
  if(!Number.isSafeInteger(maintenant)||maintenant<0)throw new RefusFavoris('Horloge indisponible.',503);
  for(const t of targets)if(!t||!entier(t.itemId)||!entier(t.recipientId)||typeof t.notificationId!=='string'||!t.notificationId||t.notificationId.length>160||typeof t.initiator!=='string'||!t.initiator||t.initiator.length>80)throw new RefusFavoris('Le destinataire du favori n’est pas confirmé.');
  const g=d.groupes[owner]||{jobs:[],active:false,prochain:0};
  if(g.active||g.jobs.some(x=>x.etat==='reserve'))throw new RefusFavoris('Une file est déjà en cours pour ce compte.');
  if(g.jobs.some(x=>x.etat==='incertain'))throw new RefusFavoris('Vérifie les envois incertains sur Vinted avant de préparer une nouvelle file.');
  // A new launch is exactly its new selection, never an old paused remainder.
  for(const j of g.jobs)if(j.etat==='attente')j.etat='annule';
  const connus=new Set(Object.values({...d.groupes,[owner]:g}).flatMap(x=>x.jobs).filter(x=>!['annule','refuse'].includes(x.etat)).map(x=>x.itemId+':'+x.recipientId));
  const nouveaux=[];
  for(const t of targets){const cle=t.itemId+':'+t.recipientId;if(!connus.has(cle)){connus.add(cle);nouveaux.push({...t,id:t.itemId+':'+t.recipientId,etat:'attente',message,intervalleMinutes,lot});}}
  if(!nouveaux.length)throw new RefusFavoris('Ces destinataires ont déjà été préparés pour ces articles. Aucun nouvel envoi.');
  const anciens=g.jobs.filter(x=>!nouveaux.some(n=>n.id===x.id));
  if(anciens.length+nouveaux.length>500)throw new RefusFavoris('La file a atteint sa capacité. Aucun historique de dédoublonnage n’a été effacé.');
  d.groupes[owner]={...g,jobs:[...anciens,...nouveaux],active:true,raison:'',lot,intervalleMinutes};
  d.proprietaires=Object.keys(d.groupes);
  if(JSON.stringify(d).length>1500000)throw new RefusFavoris('La file a atteint sa capacité.');
  return {data:d,valeur:vueFile(d,owner)};
}
export function reserverFile(d,{owner,maintenant,jeton,suivi=''}){
  d=initialiserFile(d);const g=d.groupes[owner];
  if(!g?.active)return {valeur:{vue:vueFile(d,owner)}};
  if(Object.values(d.groupes).some(x=>x.jobs.some(j=>j.etat==='incertain')))return {valeur:{vue:{...vueFile(d,owner),raison:'Une tentative sur ce compte doit être vérifiée sur Vinted avant la suite.'}}};
  if(d.enCours){
    if(maintenant-d.enCours.at>120000){
      const autre=d.groupes[d.enCours.owner],j=autre?.jobs.find(x=>x.id===d.enCours.id);
      if(j)j.etat='incertain';if(autre){autre.active=false;autre.raison='Réponse interrompue : vérifie la conversation sur Vinted. Aucun renvoi automatique.';}
      // Keep the token: a late, exact receipt may still settle this attempt.
      return {data:d,valeur:{vue:vueFile(d,owner)}};
    }
    return {valeur:{vue:vueFile(d,owner)}};
  }
  const t=d.tentatives.filter(x=>x>maintenant-3600000);
  const prochain=Math.max(g.prochain||0,d.prochainGlobal||0,t.length>=10?t[0]+3600000:0);
  if(maintenant<prochain)return {valeur:{vue:{...vueFile(d,owner),prochain}}};
  const j=g.jobs.find(x=>x.etat==='attente');
  if(!j){g.active=false;return {data:d,valeur:{vue:vueFile(d,owner)}};}
  j.etat='reserve';d.enCours={owner,id:j.id,jeton,suivi,at:maintenant,prochainAvant:g.prochain||0,globalAvant:d.prochainGlobal||0};d.tentatives=[...t,maintenant];
  g.prochain=maintenant+j.intervalleMinutes*60000;
  d.prochainGlobal=g.prochain;
  return {data:d,valeur:{vue:vueFile(d,owner),travail:{...j,jeton,suivi}}};
}
export function terminerFile(d,{owner,jeton,resultat,maintenant,raison}){
  d=initialiserFile(d);const e=d.enCours,g=d.groupes[owner];
  if(!e||e.owner!==owner||e.jeton!==jeton)return {valeur:vueFile(d,owner)};
  const j=g.jobs.find(x=>x.id===e.id);
  if(!j)throw new RefusFavoris('La tentative enregistrée nécessite une vérification.');
  if(!['envoye','ignore','refuse','incertain'].includes(resultat))throw new RefusFavoris('Accusé invalide.',400);
  if(['envoye','ignore'].includes(resultat)&&!e.autorise)throw new RefusFavoris('Cette tentative n’a pas été autorisée par le serveur.');
  const fin=Math.max(e.at,Number.isSafeInteger(maintenant)?maintenant:e.at);
  if(resultat==='ignore'){
    d.tentatives=d.tentatives.filter(t=>t!==e.at);g.prochain=e.prochainAvant||0;d.prochainGlobal=e.globalAvant||0;
  }else{d.tentatives=d.tentatives.map(t=>t===e.at?fin:t);g.prochain=Math.max(g.prochain||0,fin+j.intervalleMinutes*60000);d.prochainGlobal=g.prochain;}
  const raisons=['article_vendu','ecran_inactif','compte_vinted_absent','quota_extension','pause_vinted','conversation_deja_contactee','historique_non_verifie','identite_non_confirmee','autorisation_expiree','compte_vinted_different','extension_indisponible','session_extension','vinted_refus','creation_non_confirmee','reponse_inconnue'];
  if(raisons.includes(raison))j.raison=raison;
  j.etat=resultat;d.enCours=null;
  j.traiteLe=fin;if(resultat==='envoye')j.envoyeLe=fin;
  if(!['envoye','ignore'].includes(resultat)){g.active=false;g.raison=raison==='article_vendu'?'Article vendu : aucun message envoyé pour cette tentative. Les messages restants ne sont pas envoyés.':raison==='ecran_inactif'?'Écran des favoris quitté avant le départ. Les messages restants ne sont pas envoyés.':resultat==='incertain'?'Réponse incertaine : vérifie la conversation sur Vinted. Aucun renvoi automatique.':'Vinted ou l’extension a interrompu la file. Les messages restants ne sont pas envoyés.';}
  else {if(!g.jobs.some(x=>x.etat==='attente'))g.active=false;if(!g.active)g.raison='Sélection traitée ou file arrêtée.';}
  return {data:d,valeur:vueFile(d,owner)};
}
export function consommerFile(d,{owner,jeton,maintenant}){
  d=initialiserFile(d);const e=d.enCours,g=d.groupes[owner];
  if(!e||e.owner!==owner||e.jeton!==jeton||e.autorise||!g?.active||maintenant<e.at||maintenant-e.at>60000)throw new RefusFavoris('L’autorisation d’envoi n’est plus disponible. Aucun renvoi automatique.');
  const j=g.jobs.find(x=>x.id===e.id);if(j?.etat!=='reserve')throw new RefusFavoris('La tentative n’est plus disponible.');
  e.autorise=true;
  return {data:d,valeur:{suivi:e.suivi,travail:{itemId:j.itemId,recipientId:j.recipientId,initiator:j.initiator,message:j.message}}};
}
export function verifierReservation(d,{owner,jeton,maintenant}){
  d=initialiserFile(d);const e=d.enCours;
  if(!e||e.owner!==owner||e.jeton!==jeton||!e.autorise||!d.groupes[owner]?.active||maintenant<e.at||maintenant-e.at>90000)throw new RefusFavoris('La file est arrêtée ou l’autorisation a expiré.');
  return {valeur:{autorise:true}};
}
export function arreterFile(d,owner){
  d=initialiserFile(d);const g=d.groupes[owner];if(!g)return {valeur:vueFile(d,owner)};
  g.active=false;g.raison='File arrêtée. Une tentative déjà partie peut encore aboutir.';
  for(const j of g.jobs)if(j.etat==='attente')j.etat='annule';
  return {data:d,valeur:vueFile(d,owner)};
}
export function cloreIncertains(d,{owner,maintenant}){
  d=initialiserFile(d);const g=d.groupes[owner];
  if(!g||g.active)throw new RefusFavoris('Arrête la file avant de clôturer la vérification.');
  if(!g.jobs.some(x=>['incertain','reserve'].includes(x.etat)))throw new RefusFavoris('Aucune tentative incertaine à clôturer.');
  const intervalle=Math.max(...g.jobs.filter(x=>['incertain','reserve'].includes(x.etat)).map(x=>x.intervalleMinutes));
  if(d.enCours?.owner===owner){
    if(maintenant-d.enCours.at<=120000)throw new RefusFavoris('La tentative peut être encore en cours. Attends deux minutes avant de la clôturer.');
    d.enCours=null;
  }
  for(const j of g.jobs){if(['incertain','reserve'].includes(j.etat))j.etat='verifie';else if(j.etat==='attente')j.etat='annule';}
  if(d.tentatives.length)d.tentatives[d.tentatives.length-1]=Math.max(d.tentatives[d.tentatives.length-1],maintenant);
  g.prochain=Math.max(g.prochain||0,maintenant+intervalle*60000);d.prochainGlobal=Math.max(d.prochainGlobal||0,g.prochain);
  g.raison='Vérification clôturée. Ces destinataires ne seront pas recontactés automatiquement pour ces articles.';
  return {data:d,valeur:vueFile(d,owner)};
}
