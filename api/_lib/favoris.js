import {createHash,randomUUID} from 'node:crypto';
import {vendeurExige,lireCommeVendeur} from './session.js';
import {modifierNeutre} from './neutre-cas.js';
import {resoudreCiblesFavoris} from './favoris-cibles.js';
import {initialiserFile,vueFile,lancerFile,reserverFile,terminerFile,arreterFile,consommerFile,verifierReservation,cloreIncertains,RefusFavoris} from './favoris-file.js';
import {validerReglagesFavoris} from '../../src/reglagesFavoris.js';
import {preparerMessageFavori} from '../../src/favorisVinted.js';

// The neutral row cannot be edited by the browser (RLS). One row per Vinted
// UID, including the rolling quota shared across all devices and VRM owners.
// This endpoint NEVER calls Vinted. Only the seller's extension dispatches.
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
        const rows=await lireCommeVendeur(req,`app_data?owner=eq.${owner}&id=in.(${[...ids,archiveId].join(',')})&select=id,owner,data`);
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
        const targets=resoudreCiblesFavoris({uid,capture:{...capture,payload:{...capture.payload,notifications:[...parId.values()]}},trace:lire(ids[1]),selection:c.selection});
        const lot=randomUUID();decision=d=>lancerFile(d,{owner,targets,message,intervalleMinutes:p.intervalleMinutes,maintenant,lot});
      }else if(c.action==='suivant'){
        const jeton=randomUUID(),suivi=randomUUID();decision=d=>reserverFile(d,{owner,maintenant,jeton,suivi});
      }else if(c.action==='terminer'){
        if(typeof c.jeton!=='string'||!/^[0-9a-f-]{36}$/.test(c.jeton))throw new RefusFavoris('Tentative invalide.',400);
        decision=d=>terminerFile(d,{owner,jeton:c.jeton,resultat:c.resultat,raison:c.raison,maintenant});
      }else if(c.action==='consommer'){
        const v=typeof c.version==='string'&&c.version.length<32?/^(\d+)\.(\d+)\.(\d+)$/.exec(c.version):null;
        if(!v||!(Number(v[1])>5||Number(v[1])===5&&Number(v[2])>=217))throw new RefusFavoris('Recharge l’extension 5.217 pour vérifier l’historique avant tout envoi.');
        if(typeof c.jeton!=='string'||!/^[0-9a-f-]{36}$/.test(c.jeton))throw new RefusFavoris('Tentative invalide.',400);
        decision=d=>consommerFile(d,{owner,jeton:c.jeton,maintenant});
      }else if(c.action==='verifier'){
        if(typeof c.jeton!=='string'||!/^[0-9a-f-]{36}$/.test(c.jeton))throw new RefusFavoris('Tentative invalide.',400);
        decision=d=>verifierReservation(d,{owner,jeton:c.jeton,maintenant});
      }else if(c.action==='arreter')decision=d=>arreterFile(d,owner);
      else if(c.action==='clore')decision=d=>cloreIncertains(d,{owner,maintenant});
      else throw new RefusFavoris('Commande inconnue.',400);
    }
    const r=await modifierNeutre(cle,decision);
    if(!r)throw new RefusFavoris('État non confirmé. Actualise la file : aucun nouvel envoi ne doit être lancé.',503);
    return res.status(200).json({ok:true,uid,...(['suivant','consommer','verifier'].includes(req.body?.action)?r.valeur:{vue:r.valeur}),serveur:maintenant});
  }catch(e){return res.status(e instanceof RefusFavoris?e.status:503).json({message:e instanceof RefusFavoris?e.message:'La file n’a pas pu être confirmée. Actualise avant toute nouvelle action.'});}
}
