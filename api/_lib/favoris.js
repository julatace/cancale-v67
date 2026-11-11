import {createHash,randomUUID} from 'node:crypto';
import {vendeurExige,lireCommeVendeur} from './session.js';
import {modifierNeutre} from './neutre-cas.js';
import {resoudreCiblesFavoris} from './favoris-cibles.js';
import {lirePreuvesConversationsFavoris} from './favoris-preuves.js';
import {initialiserFile,vueFile,lancerFile,reserverFile,terminerFile,arreterFile,consommerFile,verifierReservation,cloreIncertains,RefusFavoris} from './favoris-file.js';
import {validerReglagesFavoris} from '../../src/reglagesFavoris.js';
import {sendPushToAll,pushCategorieActive} from './push.js';
import {contexteVendeur} from './owner.js';
import {DESTINATIONS} from './lien-notif.js';
import {preparerMessageFavori} from '../../src/favorisVinted.js';
import {AUTO_FAVORI_MAX_MS} from '../../src/favorisAuto.js';
import {DEMANDES_AUTO} from '../../src/favorisAuto.js';
import {demanderAuto,etatAuto,reglerAuto,stopAuto,trierFavorisAuto,ajouterAuto,notificationsCompletes,favorisDepuisNotifications,etatDressingAuto,etatAnnonceAuto,gardeRefuse} from './favoris-auto.js';

// (11 nov., M82 de la revue serveur) Jamais `select=data` sur une capture : les
// lignes `harvest_{uid}_notifications`, `…_favoris_archive` et la trace
// `…_wreq_api_v2_conversations` sont lues PROJETÉES sur les seuls champs que la
// résolution des cibles et la file lisent (favoris-cibles.js, favoris-auto.js) :
// la liste des notifications, l'identité de la capture, les traces natives.
// Les réglages (`vrm_favoris_reglages_{uid}`, une petite ligne) restent lus entiers.
export const SEL_FAVORIS='id,owner,type:data->type,uid:data->uid,domain:data->domain,notifs:data->payload->notifications,archiveVersion:data->archiveVersion,creations:data->creations,lecturesLiees:data->lecturesLiees,method:data->method,path:data->path,body:data->body,contexteFavori:data->contexteFavori';
const CHAMPS_FAVORIS=['type','uid','domain','archiveVersion','creations','lecturesLiees','method','path','body','contexteFavori'];
export function ligneFavorisProjetee(x){
  const d={};for(const k of CHAMPS_FAVORIS)if(x[k]!=null)d[k]=x[k];
  if(x.notifs!=null)d.payload={notifications:x.notifs};
  return {id:x.id,owner:x.owner,data:Object.keys(d).length?d:null};
}
// `lire(chemin)` rend un tableau ou null (pas su) ; les réglages à part, entiers.
async function lireLignesFavoris(lire,owner,lourdes,reglages){
  const a=await lire(`app_data?owner=eq.${owner}&id=in.(${lourdes.join(',')})&select=${SEL_FAVORIS}`);
  if(!Array.isArray(a))return null;
  const b=reglages?await lire(`app_data?owner=eq.${owner}&id=eq.${reglages}&select=id,owner,data`):[];
  if(!Array.isArray(b))return null;
  return [...a.map(ligneFavorisProjetee),...b];
}
// The neutral row cannot be edited by the browser (RLS). One row per Vinted
// UID, including the rolling quota shared across all devices and VRM owners.
// This endpoint NEVER calls Vinted. Only the seller's extension dispatches.
// Les paramètres de lien (« offering_id = destinataire ») prouvés par les
// ouvertures natives des AUTRES comptes de ce vendeur (jamais d'un autre
// vendeur : owner filtré, RLS). Lecture ratée ⇒ [] (rien n'est envoyé).
async function parametresDesAutresComptes(req,{owner,uid}){
  const lues=await lireCommeVendeur(req,`app_data?owner=eq.${owner}&or=(id.like.harvest_*_favoris_archive,id.like.harvest_*_wreq_api_v2_conversations)&select=${SEL_FAVORIS}`);
  if(!Array.isArray(lues))return [];
  const rows=lues.map(ligneFavorisProjetee);
  const vus=new Map();
  for(const r of rows){
    const m=/^harvest_([1-9]\d{0,19})_favoris_archive$/.exec(String(r.id||''));if(!m||m[1]===uid||r.owner!==owner)continue;
    const a=r.data,trace=rows.find(x=>x.id===`harvest_${m[1]}_wreq_api_v2_conversations`&&x.owner===owner)?.data;
    if(!a||a.archiveVersion!==1||String(a.uid)!==m[1]||!trace)continue;
    try{for(const p of resoudreCiblesFavoris({uid:m[1],capture:{...a,type:'notifications'},trace,selection:['x'],traces:a.creations||[],lectures:a.lecturesLiees||[],parametresSeuls:true}))vus.set(p.forme+'\u0000'+p.cle,p);}catch{}
  }
  // Deux clés différentes pour une même forme : ça se contredit, rien.
  const parForme=new Map();for(const p of vus.values())parForme.set(p.forme,(parForme.get(p.forme)||0)+1);
  return [...vus.values()].filter(p=>parForme.get(p.forme)===1);
}

export function texteFinFavoris(fin){
  const {total=0,envoyes=0,incertains=0,interrompus=0,interrompue=false}=fin||{};
  const t=interrompue?'⏸️ Messages aux favoris : file interrompue':'✅ Messages aux favoris : file terminée';
  const b=[`${envoyes} message${envoyes>1?'s':''} envoyé${envoyes>1?'s':''} sur ${total}`];
  if(incertains)b.push(`${incertains} à vérifier sur Vinted`);
  if(interrompus)b.push(`${interrompus} interrompu${interrompus>1?'s':''}`);
  return {title:t,body:b.join(' · ')+(interrompue?' — ouvre VRM pour voir pourquoi.':'.')};
}
async function notifierFinFavoris(owner,fin){
  return contexteVendeur.run({owner},async()=>{
    if(!(await pushCategorieActive('favoris')))return {envoye:false};
    const {title,body}=texteFinFavoris(fin);
    // (8 nov.) Une file finie sans souci (lancée par lui, tout envoyé) n'appelle aucun
    // geste : rangée dans la cloche, elle ne sonne plus. Interrompue, ou des messages
    // à vérifier sur Vinted : elle sonne (il y a quelque chose à faire).
    const {interrompue=false,incertains=0,interrompus=0}=fin||{};
    const discret=!interrompue&&!incertains&&!interrompus;
    return sendPushToAll({cat:'favoris',title,body,url:DESTINATIONS.favorisFile(),tag:'favoris-file-'+String(fin.lot||''),...(discret?{discret:true}:{})});
  });
}
// ── LE TOUR DU MODE AUTOMATIQUE (2 nov.) ─────────────────────────────────────
// Appelé par le pilote de l'app (VRM ouvert dans un onglet, intervalle tiré au
// hasard). 1. L'état de la file seule (éteint, pause, horaires, quotas…) : rien
// d'autre n'est lu s'il ne permet rien. 2. Les captures du vendeur, projetées.
// 3. Un favori à la fois : identité prouvée, paire en vente (dressing complet de
// moins de 24 h + garde des ventes ailleurs), aucune conversation avec cette
// personne. 4. Le comparer-et-échanger revérifie tout et pose AU PLUS un message
// dans la file existante (autorisation unique, consommée par l'extension 5.309).
// Toute lecture ratée ⇒ `lecture` : rien n'est ajouté (« pas su » ≠ « oui »).
const lecture=async(req,chemin)=>{const r=await lireCommeVendeur(req,chemin);if(!Array.isArray(r))throw Object.assign(Error('lecture'),{auto:'lecture'});return r;};
// (2 nov., 13 h) Une demande NOUVELLE à Julien part aussi en notification (catégorie
// « favoris »), une seule fois par demande : la ligne neutre la garde jusqu'à ce que
// le problème soit réglé.
async function notifierDemandeAuto(owner,code){
  return contexteVendeur.run({owner},async()=>{
    if(!(await pushCategorieActive('favoris')))return {envoye:false};
    return sendPushToAll({cat:'favoris',title:'Messages automatiques aux favoris : un geste à faire',body:DEMANDES_AUTO[code],url:DESTINATIONS.favorisFile(),tag:'favoris-auto-'+code});
  });
}
export async function tourAuto(req,{owner,uid,cle,maintenant,extension=null}){
  const avant=await modifierNeutre(cle,d=>({valeur:{e:etatAuto(d,owner,maintenant),vue:vueFile(initialiserFile(d),owner)}}));
  if(!avant)return {etat:'lecture',ajoute:false};
  if(avant.valeur.e.etat==='a_verifier'){const r=await modifierNeutre(cle,d=>demanderAuto(d,{owner,code:'a_verifier',maintenant}));return {etat:'a_verifier',ajoute:false,vue:avant.valeur.vue,...(r?.valeur?.nouvelle?{nouvelleDemande:'a_verifier'}:{})};}
  if(avant.valeur.e.etat!=='libre')return {etat:avant.valeur.e.etat,jusqua:avant.valeur.e.jusqua||null,ajoute:false,vue:avant.valeur.vue};
  // Un arrêt qui attend un geste de Julien (dressing, garde, boîte, capture,
  // réglages) : la demande est posée (une fois) avant de rendre la main.
  let nouvelleDemande=null;
  const stop=async etat=>{
    if(DEMANDES_AUTO[etat]){const r=await modifierNeutre(cle,d=>demanderAuto(d,{owner,code:etat,maintenant}));if(r?.valeur?.nouvelle)nouvelleDemande=etat;}
    return {etat,ajoute:false,vue:avant.valeur.vue,...(nouvelleDemande?{nouvelleDemande}:{})};
  };
  try{
    const ids=[`harvest_${uid}_notifications`,`harvest_${uid}_wreq_api_v2_conversations`,`vrm_favoris_reglages_${uid}`,`harvest_${uid}_favoris_archive`];
    const rows=await lireLignesFavoris(c=>lecture(req,c),owner,[ids[0],ids[1],ids[3]],ids[2]);
    if(rows.some(x=>x.owner!==owner))return await stop('lecture');
    const lire=id=>rows.find(x=>x.id===id)?.data;
    const prefs=lire(ids[2]);if(prefs?.version!==1||prefs.envoisActifs!==false)return await stop('reglages');
    let p;try{p=validerReglagesFavoris(prefs);}catch{return await stop('reglages');}
    const message=preparerMessageFavori(p.message,p.pourcentage).message;if(!message)return await stop('reglages');
    const offre=p.offreMode?{mode:p.offreMode,valeur:p.offreMode==='pct'?p.pourcentage:p.offreValeur,arrondi:p.arrondi===true}:null;
    const archive=lire(ids[3]),capture0=lire(ids[0])||archive,trace=lire(ids[1]);
    if(!capture0||capture0.type!=='notifications'||String(capture0.uid)!==uid)return await stop('capture');
    // Aucune création native observée sur ce compte : VRM ne sait encore à personne écrire.
    if(!trace)return await stop('destinataire_non_prouve');
    if(archive&&(archive.archiveVersion!==1||String(archive.uid)!==uid||!Array.isArray(archive.payload?.notifications)))return await stop('capture');
    let capture;try{capture=notificationsCompletes(capture0,archive);}catch{return await stop('capture');}
    const lignes=favorisDepuisNotifications(capture.payload,capture.domain).lignes;
    const opts={uid,capture,trace,traces:archive?.creations||[],lectures:archive?.lecturesLiees||[]};
    let conversations=null,ailleurs=null;
    const resoudre=async id=>{
      const essai=extra=>resoudreCiblesFavoris({...opts,...extra,selection:[id]})[0];
      try{return essai({});}catch(e){if(e.code!=='favoris_preuve_absente'&&e.code!=='favoris_identite_non_unique')throw e;}
      if(conversations==null)conversations=await lirePreuvesConversationsFavoris(req,{owner,uid,capture,selection:[id]}).catch(()=>[]);
      try{return essai({conversations});}catch(e){if(e.code!=='favoris_preuve_absente')throw e;}
      if(ailleurs==null)ailleurs=await parametresDesAutresComptes(req,{owner,uid}).catch(()=>[]);
      if(!ailleurs.length)throw Error('non prouvé');
      return essai({conversations,parametresAilleurs:ailleurs});
    };
    // Les cibles d'abord (synchrone sur ce qui est déjà lu), puis les lectures d'appoint.
    // Seuls les favoris arrivés APRÈS l'allumage, de moins de 3 jours, sont résolus
    // (jamais l'arriéré : un favori d'avant l'allumage n'est jamais repris).
    const allumeLe=Number(avant.valeur.vue?.auto?.allumeLe)||Infinity;
    const cibles=new Map();
    for(const l of lignes){const t=Date.parse(l.date||'');if(!Number.isFinite(t)||t<allumeLe||maintenant-t>AUTO_FAVORI_MAX_MS)continue;try{cibles.set(l.id,await resoudre(l.id));}catch{}}
    const lu=await modifierNeutre(cle,d=>({valeur:initialiserFile(d)}));if(!lu)return await stop('lecture');
    const tri=trierFavorisAuto({lignes,d:lu.valeur,owner,maintenant,resoudre:id=>{const c=cibles.get(id);if(!c)throw Error('non prouvé');return c;}});
    const sauts=[...tri.sauts];let choisi=null;
    if(tri.prets.length){
      // La paire : dressing COMPLET de moins de 24 h, et la garde des ventes ailleurs.
      const [dr]=await lecture(req,`app_data?owner=eq.${owner}&id=eq.harvest_${uid}_listings&select=cap:data->>capturedAt,pg:data->payload->pagination,items:data->payload->items`).then(r=>r.length?r:[null]);
      const ed=etatDressingAuto(dr,maintenant);if(ed)return await stop(ed);
      const m=await lecture(req,`app_data?owner=eq.${owner}&id=eq.main&select=g:data->vinted_offres_garde`);
      const garde=m[0]?.g||null;
      const gTout=gardeRefuse(garde,'0',maintenant);if(gTout&&gTout!=='vendue-ailleurs')return await stop('garde_absente');
      // La boîte de réception, lue il y a moins de 24 h (« pas su » ⇒ rien).
      const [bx]=await lecture(req,`app_data?owner=eq.${owner}&id=eq.harvest_${uid}_inbox&select=cap:data->>capturedAt`).then(r=>r.length?r:[null]);
      const cb=Date.parse(bx?.cap||'');if(!Number.isFinite(cb)||maintenant-cb>24*3600000)return await stop('boite_ancienne');
      for(const pr of tri.prets.slice(0,5)){
        const ea=etatAnnonceAuto(pr.cible.itemId,dr,gardeRefuse(garde,pr.cible.itemId,maintenant));
        if(ea){sauts.push({...pr,raison:ea});continue;}
        // Une conversation avec cette personne (n'importe quel article) : jamais.
        const n=Number(pr.cible.recipientId);if(!Number.isSafeInteger(n))continue;
        const dansBoite=await lecture(req,`app_data?owner=eq.${owner}&id=eq.harvest_${uid}_inbox&data->payload->conversations=cs.${encodeURIComponent(JSON.stringify([{opposite_user:{id:n}}]))}&select=id`);
        const fil=await lecture(req,`app_data?owner=eq.${owner}&id=like.harvest_${uid}_conv_*&data->payload->conversation->opposite_user->>id=eq.${n}&select=id&limit=1`);
        if(dansBoite.length||fil.length){sauts.push({...pr,raison:'conversation_existante'});continue;}
        choisi=pr;break;
      }
    }
    // Aucun favori prêt, et au moins un sauté faute d'identité prouvée : un geste de
    // Julien (ouvrir un favori depuis la cloche) le réglera — VRM le demande.
    const demande=!choisi&&sauts.some(x=>x.raison==='destinataire_non_prouve')?'destinataire_non_prouve':null;
    const r=await modifierNeutre(cle,d=>ajouterAuto(d,{owner,maintenant,choisi,sauts,message,offre,prochainFavori:tri.prochainFavori,extension,demande}));
    if(!r)return await stop('lecture');
    return r.valeur;
  }catch(e){if(e?.auto)return await stop(e.auto);if(e instanceof RefusFavoris)throw e;return await stop('lecture');}
}
export async function routeFavoris(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({message:'GET ou POST seulement.'});
  const u=await vendeurExige(req,res);if(!u)return;
  try{
    const uid=String(req.query?.uid||'');
    if(!/^[1-9]\d{0,19}$/.test(uid))throw new RefusFavoris('Choisis le compte Vinted.',400);
    const comptes=await lireCommeVendeur(req,`vinted_accounts?owner=eq.${u.id}&vinted_user_id=eq.${uid}&select=owner,vinted_user_id&limit=2`);
    if(!Array.isArray(comptes))throw new RefusFavoris('Le compte ne peut pas être vérifié maintenant.',503);
    if(comptes.length!==1||comptes[0].owner!==u.id||String(comptes[0].vinted_user_id)!==uid)throw new RefusFavoris('Ce compte n’est pas accessible dans ta session.',403);
    const cle='favoris_file_'+createHash('sha256').update(uid).digest('hex');
    const owner=u.id,maintenant=Date.now();let decision;
    if(req.method==='GET')decision=d=>({valeur:vueFile(initialiserFile(d),owner)});
    else{
      const c=req.body;
      if(!c||typeof c!=='object'||Array.isArray(c)||JSON.stringify(c).length>5000)throw new RefusFavoris('Commande invalide.',400);
      if(c.action==='lancer'){
        const ids=[`harvest_${uid}_notifications`,`harvest_${uid}_wreq_api_v2_conversations`,`vrm_favoris_reglages_${uid}`];
        const archiveId=`harvest_${uid}_favoris_archive`;
        const rows=await lireLignesFavoris(c=>lireCommeVendeur(req,c),owner,[ids[0],ids[1],archiveId],ids[2]);
        if(!Array.isArray(rows)||rows.some(x=>x.owner!==owner)||ids.slice(1).some(id=>rows.filter(x=>x.id===id).length!==1))throw new RefusFavoris('Capture ou réglages indisponibles. Actualise et enregistre tes réglages avant de lancer.');
        const lire=id=>rows.find(x=>x.id===id)?.data;
        const prefs=lire(ids[2]);if(prefs?.version!==1||prefs.envoisActifs!==false)throw new RefusFavoris('Relis et enregistre les réglages de ce compte.');
        const p=validerReglagesFavoris(prefs),message=preparerMessageFavori(p.message,p.pourcentage).message;
        if(!c.reglages||JSON.stringify(validerReglagesFavoris(c.reglages))!==JSON.stringify(p))throw new RefusFavoris('Les réglages ont changé dans une autre fenêtre. Actualise et vérifie l’aperçu avant de lancer.');
        const archive=rows.find(x=>x.id===archiveId)?.data,capture=lire(ids[0])||archive;
        if(!capture||capture.type!=='notifications'||String(capture.uid)!==uid)throw new RefusFavoris('La capture de ce compte doit être actualisée.');
        if(archive&&(archive.archiveVersion!==1||String(archive.uid)!==uid||!Array.isArray(archive.payload?.notifications)))throw new RefusFavoris('L’historique de ce compte doit être vérifié avant de lancer.');
        const parId=new Map();
        for(const n of [...(archive?.payload?.notifications||[]),...(capture?.payload?.notifications||[])]){
          const avant=parId.get(n.id);
          if(avant&&(String(avant.user_id)!==String(n.user_id)||avant.link!==n.link))throw new RefusFavoris('Une notification a changé d’identité. Actualise avant de lancer.');
          parId.set(n.id,{...avant,...n});
        }
        const complete={...capture,payload:{...capture.payload,notifications:[...parId.values()]}};
        const opts={uid,capture:complete,trace:lire(ids[1]),selection:c.selection,traces:archive?.creations||[],lectures:archive?.lecturesLiees||[]};let targets;
        try{targets=resoudreCiblesFavoris(opts);}catch(e){
          if(e.code!=='favoris_preuve_absente')throw e;
          const conversations=await lirePreuvesConversationsFavoris(req,{owner,uid,capture:complete,selection:c.selection});
          try{targets=resoudreCiblesFavoris({...opts,conversations});}catch(e2){
            if(e2.code!=='favoris_preuve_absente')throw e2;
            // Le paramètre du lien prouvé sur un autre compte du MÊME vendeur.
            const parametresAilleurs=await parametresDesAutresComptes(req,{owner,uid});
            if(!parametresAilleurs.length)throw e2;
            targets=resoudreCiblesFavoris({...opts,conversations,parametresAilleurs});
          }
        }
        const lot=randomUUID();const offre=p.offreMode?{mode:p.offreMode,valeur:p.offreMode==='pct'?p.pourcentage:p.offreValeur,arrondi:p.arrondi===true}:null;
        decision=d=>lancerFile(d,{owner,targets,message,intervalleMinutes:p.intervalleMinutes,intervalleMax:p.intervalleMaxMinutes,maintenant,lot,pourcentage:p.pourcentage,offre});
      }else if(c.action==='auto_regler'){
        decision=d=>reglerAuto(d,{owner,reglages:c.reglages,confirme:c.confirme===true,maintenant});
      }else if(c.action==='auto_stop'){
        decision=d=>stopAuto(d,{owner,maintenant});
      }else if(c.action==='auto'){
        // L'état de l'extension vu par l'app (onglet, compte, version) : seulement
        // pour DEMANDER un geste ; le serveur ne lui fait jamais confiance pour envoyer
        // (l'autorisation reste consommée par l'extension elle-même, version vérifiée).
        const x=c.extension&&typeof c.extension==='object'?c.extension:null;
        const extension=x?{disponible:x.disponible===true,code:typeof x.code==='string'&&DEMANDES_AUTO[x.code]?x.code:'extension_indisponible'}:null;
        const r=await tourAuto(req,{owner,uid,cle,maintenant,extension});
        if(r.nouvelleDemande)await notifierDemandeAuto(owner,r.nouvelleDemande).catch(()=>{});
        return res.status(200).json({ok:true,uid,...r,serveur:maintenant});
      }else if(c.action==='suivant'){
        const jeton=randomUUID(),suivi=randomUUID();decision=d=>reserverFile(d,{owner,maintenant,jeton,suivi});
      }else if(c.action==='terminer'){
        if(typeof c.jeton!=='string'||!/^[0-9a-f-]{36}$/.test(c.jeton))throw new RefusFavoris('Tentative invalide.',400);
        decision=d=>terminerFile(d,{owner,jeton:c.jeton,resultat:c.resultat,raison:c.raison,maintenant,ecrits:Number.isInteger(c.ecrits)?c.ecrits:null});
      }else if(c.action==='consommer'){
        const v=typeof c.version==='string'&&c.version.length<32?/^(\d+)\.(\d+)\.(\d+)$/.exec(c.version):null;
        if(!v||!(Number(v[1])>5||Number(v[1])===5&&Number(v[2])>=217))throw new RefusFavoris('Recharge l’extension 5.217 pour vérifier l’historique avant tout envoi.');
        if(typeof c.jeton!=='string'||!/^[0-9a-f-]{36}$/.test(c.jeton))throw new RefusFavoris('Tentative invalide.',400);
        const version5281=Number(v[1])>5||Number(v[1])===5&&Number(v[2])>=281;
        const version5280=Number(v[1])>5||Number(v[1])===5&&Number(v[2])>=280;
        const version5309=Number(v[1])>5||Number(v[1])===5&&Number(v[2])>=309;
        decision=d=>consommerFile(d,{owner,jeton:c.jeton,maintenant,version5281,version5280,version5309});
      }else if(c.action==='verifier'){
        if(typeof c.jeton!=='string'||!/^[0-9a-f-]{36}$/.test(c.jeton))throw new RefusFavoris('Tentative invalide.',400);
        decision=d=>verifierReservation(d,{owner,jeton:c.jeton,maintenant});
      }else if(c.action==='arreter')decision=d=>arreterFile(d,owner);
      else if(c.action==='clore')decision=d=>cloreIncertains(d,{owner,maintenant});
      else throw new RefusFavoris('Commande inconnue.',400);
    }
    const r=await modifierNeutre(cle,decision);
    if(!r)throw new RefusFavoris('État non confirmé. Actualise la file : aucun nouvel envoi ne doit être lancé.',503);
    // (28 oct., « que ça me prévienne ») La file vient de finir : une notification
    // avec le bilan (catégorie « favoris », activée par défaut). Un échec d'envoi
    // ne change rien à la réponse : la file est déjà rangée.
    if(req.method==='POST'&&req.body?.action==='terminer'&&r.valeur?.fin)await notifierFinFavoris(owner,r.valeur.fin).catch(()=>{});
    if(req.method==='POST'&&req.body?.action==='terminer'&&r.valeur?.nouvelleDemande)await notifierDemandeAuto(owner,r.valeur.nouvelleDemande).catch(()=>{});
    return res.status(200).json({ok:true,uid,...(['suivant','consommer','verifier'].includes(req.body?.action)?r.valeur:{vue:r.valeur}),serveur:maintenant});
  }catch(e){return res.status(e instanceof RefusFavoris?e.status:503).json({message:e instanceof RefusFavoris?e.message:'La file n’a pas pu être confirmée. Actualise avant toute nouvelle action.',...(e instanceof RefusFavoris&&['favoris_preuve_absente','favoris_identite_non_unique'].includes(e.code)?{code:e.code,diagnostic:e.diagnostic}:{})});}
}
