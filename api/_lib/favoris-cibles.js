import {favorisDepuisNotifications,lienFavoriVinted} from '../../src/favorisVinted.js';
import {RefusFavoris} from './favoris-file.js';
const id=v=>typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v)?v:Number.isSafeInteger(v)&&v>0?String(v):null;
function lien(n,domain){
  const s=lienFavoriVinted(n?.link,domain);if(!s)return null;
  const u=new URL(s),m=/^\/items\/([1-9]\d{0,19})\/([a-z_-]{1,40})\/new\/?$/.exec(u.pathname);
  return m?{itemId:m[1],forme:m[2]+'?'+[...u.searchParams.keys()].sort().join('&')}:null;
}
// user_id is NOT assumed to be the recipient. A native creation must first
// demonstrate the exact (item, opposite_user) relationship on this capture.
// No title, photo or username matching; no values inferred from masked JSON.
export function resoudreCiblesFavoris({uid,capture,trace,selection}){
  if(capture?.type!=='notifications'||String(capture.uid)!==String(uid)||String(trace?.uid)!==String(uid)||trace?.method!=='POST'||trace?.path!=='/api/v2/conversations')throw new RefusFavoris('Ouvre un favori sur Vinted avec ce compte, puis actualise : le raccordement natif doit être confirmé.');
  let corps;try{corps=typeof trace.body==='string'&&trace.body.length<=100000?JSON.parse(trace.body):null;}catch{}
  if(!corps||Object.keys(corps).sort().join(',')!=='initiator,item_id,opposite_user_id'||!id(corps.item_id)||!id(corps.opposite_user_id)||id(corps.opposite_user_id)===String(uid)||typeof corps.initiator!=='string'||!corps.initiator||corps.initiator.length>80)throw new RefusFavoris('La création native de conversation ne confirme pas le format attendu.');
  if(!Array.isArray(selection)||!selection.length||selection.length>10||new Set(selection).size!==selection.length||selection.some(x=>typeof x!=='string'||!x||x.length>160))throw new RefusFavoris('Sélectionne de 1 à 10 favoris différents.',400);
  const notifications=capture.payload?.notifications;
  const favoris=favorisDepuisNotifications(capture.payload,capture.domain);
  const idsFavoris=new Set(favoris.lignes.map(x=>x.id));
  const candidats=(Array.isArray(notifications)?notifications:[]).filter(n=>idsFavoris.has(n.id));
  const preuves=candidats.filter(n=>lien(n,capture.domain)?.itemId===id(corps.item_id)&&id(n.user_id)===id(corps.opposite_user_id));
  const formes=new Set(preuves.map(n=>lien(n,capture.domain).forme));
  if(formes.size!==1)throw new RefusFavoris('Le lien entre favori et destinataire n’est pas encore confirmé. Ouvre un favori actuellement présent dans cette liste sur Vinted, puis actualise.');
  const forme=[...formes][0];
  return selection.map(notificationId=>{
    const ns=candidats.filter(n=>n.id===notificationId),n=ns[0],l=lien(n,capture.domain),recipientId=id(n?.user_id);
    if(ns.length!==1||!l||l.forme!==forme||!recipientId||recipientId===String(uid))throw new RefusFavoris('Un favori sélectionné n’a pas de destinataire confirmé. Aucun envoi lancé.');
    return {notificationId,itemId:l.itemId,recipientId,initiator:corps.initiator};
  });
}
