// Une lecture partielle ajoute les commandes lues sans effacer l'historique.
const MAX_OFFSET=10000;
function suite(data,offset,count){
 const step=Number.isInteger(data.limit) && data.limit>0?data.limit:count;
 const expected=offset+step;
 if(data.next){
  try{const u=new URL(data.next),next=Number(u.searchParams.get('offset'));
   if(u.origin!=='https://api.ebay.com' || u.pathname!=='/sell/fulfillment/v1/order' || u.username || u.password || !u.searchParams.has('offset') || !Number.isInteger(next) || next!==expected || next<=offset || next>MAX_OFFSET)return {nextOffset:null,issue:'pagination'};
   return {nextOffset:next,issue:null};
  }catch(_){return {nextOffset:null,issue:'pagination'};}
 }
 if(Number.isInteger(data.total) && expected<data.total){
  if(!count || expected>MAX_OFFSET)return {nextOffset:null,issue:'pagination'};
  return {nextOffset:expected,issue:null};
 }
 return {nextOffset:null,issue:null};
}
export function fusionPageCommandesEbay(previous,data,offset,now,generation){
 if(!Number.isInteger(offset) || offset<0 || offset>MAX_OFFSET || !Array.isArray(data?.orders) || data.orders.some(o=>!o || typeof o.orderId!=='string' || !o.orderId.trim()))return null;
 if(data.offset!=null && data.offset!==offset)return null;
 if(offset>0 && (!previous?.pagination || previous.pagination.generation!==generation || previous.pagination.nextOffset!==offset))return null;
 const orders=new Map((Array.isArray(previous?.orders)?previous.orders:[]).filter(o=>typeof o?.orderId==='string').map(o=>[o.orderId,o]));
 for(const o of data.orders)orders.set(o.orderId,{...orders.get(o.orderId),...o,_capturedAt:now});
 const total=Number.isInteger(data.total) && data.total>=0?data.total:null;
 const before=offset===0?null:previous.pagination;
 const ids=[...new Set([...(before?.ids || []),...data.orders.map(o=>o.orderId)])];
 const moving=before?.moving===true || !!(before && before.total!==total);
 const next=suite(data,offset,data.orders.length);
 const complete=total!=null && ids.length===total && !data.next && next.nextOffset==null && !next.issue && !moving;
 const issue=next.issue || (moving || next.nextOffset==null && !complete?'liste-changee':null);
 return {...previous,orders:[...orders.values()],capturedAt:now,lues:data.orders.length,total,complet:complete,pagination:{generation,ids,lues:ids.length,total,lastOffset:offset,nextOffset:issue?null:next.nextOffset,complete,moving,issue}};
}
export function fusionCommandesEbay(previous,data,now,generation='lecture-'+now){
 return fusionPageCommandesEbay(previous,data,0,now,generation);
}
