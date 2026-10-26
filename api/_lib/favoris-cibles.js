import {favorisDepuisNotifications,lienFavoriVinted} from '../../src/favorisVinted.js';
import {RefusFavoris} from './favoris-file.js';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v)?v:Number.isSafeInteger(v)&&v>0?String(v):null;
function lien(n,domain){
 const s=lienFavoriVinted(n?.link,domain);if(!s)return null;
 const u=new URL(s),m=/^\/items\/([1-9]\d{0,19})\/([a-z_-]{1,40})\/new\/?$/.exec(u.pathname);
 if(!m)return null;u.hash='';u.pathname=u.pathname.replace(/\/$/,'');u.hostname=u.hostname.replace(/^www\./,'');u.searchParams.sort();
 return {itemId:m[1],forme:u.hostname+'/'+m[2]+'?'+[...u.searchParams.keys()].sort().join('&'),url:u.href,params:u.searchParams};
}
function corpsNatif(trace,uid){
 if(String(trace?.uid)!==String(uid)||trace?.method!=='POST'||trace?.path!=='/api/v2/conversations')return null;
 let c;try{c=typeof trace.body==='string'&&trace.body.length<=100000?JSON.parse(trace.body):null;}catch{}
 return c&&Object.keys(c).sort().join(',')==='initiator,item_id,opposite_user_id'&&id(c.item_id)&&id(c.opposite_user_id)&&id(c.opposite_user_id)!==String(uid)&&typeof c.initiator==='string'&&c.initiator&&c.initiator.length<=80?{itemId:id(c.item_id),recipientId:id(c.opposite_user_id),initiator:c.initiator}:null;
}
// Native item/member pairs prove the role of user_id; an observed native link
// can instead prove its recipient parameter, or that exact notification alone.
// No identity is guessed from text, title, photo, username or parameter names.
export function resoudreCiblesFavoris({uid,capture,trace,selection,conversations=[],traces=[],lectures=[]}){
 if(capture?.type!=='notifications'||String(capture.uid)!==String(uid)||String(trace?.uid)!==String(uid)||trace?.method!=='POST'||trace?.path!=='/api/v2/conversations')throw new RefusFavoris('Ouvre un favori sur Vinted avec ce compte, puis actualise : le raccordement natif doit être confirmé.');
 const corps=corpsNatif(trace,uid);if(!corps)throw new RefusFavoris('La création native de conversation ne confirme pas le format attendu.');
 if(!Array.isArray(selection)||!selection.length||selection.length>10||new Set(selection).size!==selection.length||selection.some(x=>typeof x!=='string'||!x||x.length>160))throw new RefusFavoris('Sélectionne de 1 à 10 favoris différents.',400);
 const notifications=capture.payload?.notifications,favoris=favorisDepuisNotifications(capture.payload,capture.domain),idsFavoris=new Set(favoris.lignes.map(x=>x.id));
 const candidats=(Array.isArray(notifications)?notifications:[]).filter(n=>idsFavoris.has(n.id));
 const infos=candidats.map(n=>({n,l:lien(n,capture.domain),user:id(n.user_id)})),parUrl=new Map(),parId=new Map();
 for(const info of infos){const ids=parId.get(info.n.id)||[];ids.push(info);parId.set(info.n.id,ids);if(info.l){const urls=parUrl.get(info.l.url)||[];urls.push(info);parUrl.set(info.l.url,urls);}}
 const natifs=[trace,...(Array.isArray(traces)?traces.slice(-100):[])].map(t=>{const c=corpsNatif(t,uid);return c?{...c,contexte:lien({link:t.contexteFavori},capture.domain)}:null;}).filter(Boolean);
 for(const l of (Array.isArray(lectures)?lectures.slice(-50):[])){
  const conv=id(l?.conversationId),item=id(l?.itemId),recipient=id(l?.recipientId);
  if(String(l?.uid)!==String(uid)||!item||!recipient||recipient===String(uid))continue;
  const contexte=lien({link:l.contexteFavori},capture.domain);if(!contexte||contexte.itemId!==item)continue;
  if(l?.method==='NAV'){
   // The tab showed Vinted's own receiver_id/item_id route for this favorite.
   // It counts only if receiver_id equals the single numeric parameter of the
   // captured link (identity, not a translated name) and the path is a
   // messaging route of that article.
   const path=String(l.path||''),ks=[...contexte.params.keys()];
   if(!/^\/(?:inbox|conversations?|messages?)(?:\/[a-z_-]{1,40}){0,2}$/.test(path)&&!new RegExp('^/items/'+item+'/[a-z_-]{1,40}(?:/new)?$').test(path))continue;
   if(ks.length!==1||contexte.params.getAll(ks[0]).length!==1||id(contexte.params.get(ks[0]))!==recipient||recipient===item)continue;
  }else if(l?.method!=='GET'||!conv||!new RegExp('^/api/v[0-9]+/conversations/'+conv+'$').test(String(l.path||'')))continue;
  natifs.push({itemId:item,recipientId:recipient,initiator:corps.initiator,contexte});
 }
 const paires=new Set(conversations.filter(c=>String(c.uid)===String(uid)&&id(c.conversationId)&&id(c.itemId)&&id(c.recipientId)&&id(c.recipientId)!==String(uid)).map(c=>id(c.itemId)+':'+id(c.recipientId)));
 for(const c of natifs)paires.add(c.itemId+':'+c.recipientId);
 const formes=new Set(infos.filter(({l,user})=>l&&user&&paires.has(l.itemId+':'+user)).map(({l})=>l.forme));
 if(formes.size>1)throw new RefusFavoris('Plusieurs formes de favoris se contredisent. Aucun envoi lancé.');
 const exacts=new Map();let parametres=[];
 for(const c of natifs){
  if(!c.contexte||c.contexte.itemId!==c.itemId)continue;
  const ns=parUrl.get(c.contexte.url)||[];
  // A shared URL for different actors cannot establish a unique recipient.
  if(ns.length!==1)continue;
  const liste=exacts.get(c.contexte.url)||[];liste.push(c);exacts.set(c.contexte.url,liste);
  const clefs=[...c.contexte.params.keys()].filter(k=>/^[a-zA-Z_][a-zA-Z0-9_.-]{0,79}$/.test(k)&&c.contexte.params.getAll(k).length===1&&id(c.contexte.params.get(k))===c.recipientId);
  if(clefs.length===1&&c.itemId!==c.recipientId)parametres.push({forme:c.contexte.forme,cle:clefs[0],initiator:c.initiator,recipientId:c.recipientId,source:c.contexte.url});
 }
 // A contradictory native binding cannot train a parameter for other rows.
 parametres=parametres.filter(p=>new Set((exacts.get(p.source)||[]).map(x=>x.recipientId)).size===1);
 const parForme=new Map();for(const p of parametres){if(!parForme.has(p.forme))parForme.set(p.forme,new Set());parForme.get(p.forme).add(p.cle);}
 parametres=parametres.filter(p=>parForme.get(p.forme).size===1);
 // Two different native recipients must establish an unknown parameter before
 // it can address favorites that have never been opened natively.
 parametres=parametres.filter(p=>new Set(parametres.filter(q=>q.forme===p.forme&&q.cle===p.cle).map(q=>q.recipientId)).size>=2);
 const erreurRaccordement=(message,code)=>{const e=new RefusFavoris(message);e.code=code;e.diagnostic={notifications:candidats.length,tracesNatives:natifs.length,pairesNatives:paires.size,formesUserId:formes.size,liensExacts:exacts.size,parametresConfirmes:new Set(parametres.map(p=>p.forme+':'+p.cle)).size,selection:selection.length};return e;};
 if(!formes.size&&!exacts.size&&!parametres.length){throw erreurRaccordement('Le lien du favori n’est pas confirmé. Utilise « Vérifier sur Vinted » sur sa ligne, puis vérifie que « Lien enregistré » apparaît avant de relancer. Aucun message envoyé.','favoris_preuve_absente');}
 return selection.map(notificationId=>{
  const ns=parId.get(notificationId)||[],n=ns[0]?.n,l=ns[0]?.l;
  if(ns.length!==1||!l)throw new RefusFavoris('Un favori sélectionné n’a pas de destinataire confirmé. Aucun envoi lancé.');
  const preuves=[...(exacts.get(l.url)||[])];
  if(formes.has(l.forme)&&id(n.user_id))preuves.push({recipientId:id(n.user_id),initiator:corps.initiator});
  for(const p of parametres)if(p.forme===l.forme&&l.params.getAll(p.cle).length===1&&id(l.params.get(p.cle)))preuves.push({recipientId:id(l.params.get(p.cle)),initiator:p.initiator});
  const personnes=new Set(preuves.map(p=>p.recipientId));
  if(personnes.size!==1||personnes.has(String(uid)))throw erreurRaccordement('Un favori sélectionné n’a pas de destinataire unique confirmé. Aucun envoi lancé.','favoris_identite_non_unique');
  return {notificationId,itemId:l.itemId,recipientId:[...personnes][0],initiator:preuves[0].initiator};
 });
}
