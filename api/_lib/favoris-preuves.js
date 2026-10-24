import {lireCommeVendeur} from './session.js';
import {lienFavoriVinted} from '../../src/favorisVinted.js';
import {RefusFavoris} from './favoris-file.js';
const id=v=>Number.isSafeInteger(v)&&v>0?String(v):typeof v==='string'&&/^[1-9]\d{0,19}$/.test(v)?v:null;
// Only native conversations already captured for this owner and Vinted UID.
// Read small projections, never message bodies; no request to Vinted.
export async function lirePreuvesConversationsFavoris(req,{owner,uid,capture,selection}){
 const items=new Set(),ns=capture.payload?.notifications||[];
 // Selected items first, then other retained favorites to recover a proof even
 // when the newly selected favorite has no conversation yet. Bounded query.
 for(const liste of [ns.filter(n=>selection.includes(n.id)),ns])for(const n of liste){
  if(items.size>=50)break;
  if(!/favori|favourit/i.test(String(n.body||'')))continue;
  const l=lienFavoriVinted(n.link,capture.domain);if(!l)continue;
  const m=/^\/items\/([1-9]\d{0,19})\/[a-z_-]{1,40}\/new\/?$/.exec(new URL(l).pathname);if(m)items.add(m[1]);
 }
 if(!items.size)return [];
 const liste=[...items].join(',');
 const select='id,owner,uid:data->>uid,conversationId:data->payload->conversation->>id,item:data->payload->conversation->item->>id,transactionItem:data->payload->conversation->transaction->>item_id,nestedItem:data->payload->conversation->transaction->item->>id,recipient:data->payload->conversation->opposite_user->>id';
 const q=`app_data?owner=eq.${owner}&id=like.harvest_${uid}_conv_*&or=(data->payload->conversation->item->>id.in.(${liste}),data->payload->conversation->transaction->>item_id.in.(${liste}),data->payload->conversation->transaction->item->>id.in.(${liste}))&select=${select}&order=updated_at.desc&limit=100`;
 const rows=await lireCommeVendeur(req,q);
 if(!Array.isArray(rows)||rows.length>100||rows.some(r=>r.owner!==owner))throw new RefusFavoris('Les conversations de ce compte ne peuvent pas être vérifiées maintenant.',503);
 const preuves=[];
 for(const r of rows){
  const conv=id(r.conversationId),recipient=id(r.recipient),articles=[...new Set([r.item,r.transactionItem,r.nestedItem].map(id).filter(Boolean))];
  if(String(r.uid)!==uid||!conv||r.id!==`harvest_${uid}_conv_${conv}`||!recipient||recipient===uid||articles.length!==1||!items.has(articles[0]))continue;
  preuves.push({uid,conversationId:conv,itemId:articles[0],recipientId:recipient});
 }
 return preuves;
}
