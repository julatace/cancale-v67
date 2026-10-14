import {randomUUID} from 'node:crypto';
// Préparation uniquement : une tâche ouvre l'écran d'action et ses confirmations.
export function preparerAgentEbay({orders,messages,offres,journal},now=Date.now()) {
 const tasks=[],sources=[];
 const date=v=>{const n=Date.parse(v);return Number.isFinite(n)?n:null;};
 const titre=v=>typeof v==='string'?v.slice(0,160):'';
 const deadline=t=>t!=null?{deadline:new Date(t).toISOString(),urgent:t<=now+86400000}:{};
 const add=(section,items,make)=>{for(const x of items){const t=make(x);if(t)tasks.push({section,...t});}};
 const known=Array.isArray(orders?.orders);
 sources.push({nom:'Commandes',ok:known,at:orders?.capturedAt || null,partiel:true,ancien:known && (!Number.isFinite(Number(orders?.capturedAt)) || Number(orders.capturedAt)<=0 || now-Number(orders.capturedAt)>86400000)});
 if(known)add('ventes',orders.orders,o=>o.orderId && o.orderPaymentStatus==='PAID' && ['NOT_STARTED','IN_PROGRESS'].includes(o.orderFulfillmentStatus) && (!o.cancelStatus?.cancelState || ['NONE_REQUESTED','CANCEL_REJECTED'].includes(o.cancelStatus.cancelState))?{id:'order:'+o.orderId,label:'Préparer l’expédition',ref:o.orderId,title:titre(o.lineItems?.[0]?.title),...deadline(o.lineItems?.map(l=>date(l.fulfillmentInstructions?.shipByDate)).filter(t=>t!=null).sort((a,b)=>a-b)[0] ?? null)}:null);
 for(const [nom,section,r,key,make] of [
  ['Messages','messages',messages,'messages',m=>['Unanswered','Pending'].includes(m.status)?{id:'message:'+m.id,label:'Répondre au message',ref:m.itemId,title:titre(m.titre || m.subject)}:null],
  ['Offres','offres',offres,'offres',o=>['Pending','Active'].includes(o.status) && (!o.expiresAt || (date(o.expiresAt)!=null && date(o.expiresAt)>now))?{id:'offer:'+o.id,label:'Étudier l’offre',ref:o.itemId,title:titre(o.titre),price:o.price,currency:o.currency,...deadline(date(o.expiresAt))}:null],
 ]){const ok=r?.body?.ok===true && Array.isArray(r.body[key]);sources.push({nom,ok,partiel:ok && (r.body.totalPages==null || r.body.totalPages>1)});if(ok)add(section,r.body[key],make);}
 return {status:200,body:{ok:true,tasks:[...new Map(tasks.map(t=>[t.id,t])).values()].sort((a,b)=>(b.urgent===true)-(a.urgent===true) || (date(a.deadline) ?? Infinity)-(date(b.deadline) ?? Infinity)),sources,journal:Array.isArray(journal?.items)?journal.items:[],journalLisible:journal!==undefined,capturedAt:now}};
}
export async function executerAvecJournal({action,b,execute,modifier}) {
 const entry={id:randomUUID(),action,entityId:String(b.messageId || b.offerId || b.orderId || b.itemId || '').slice(0,64),ref:String(b.orderId || b.itemId || '').slice(0,64),at:Date.now(),etat:'en_cours'};
 let saved;try{saved=await modifier(d=>({...d,items:[entry,...(Array.isArray(d?.items)?d.items:[])].slice(0,100)}));}catch(_){saved=false;}
 if(saved!==true)return {status:503,body:{ok:false,error:'Le suivi de cette action n’a pas pu être préparé. Réessaie plus tard ; rien n’a été envoyé.',reason:'journal'}};
 let r;try{r=await execute();}catch(_){r={status:504,body:{ok:false,reason:'incertain',error:'État incertain : relis les données eBay avant de recommencer.'}};}
 const etat=r.body?.ok?'reussi':r.body?.reason==='incertain'?'incertain':'refuse';
 let completed;try{completed=await modifier(d=>({...d,items:(d?.items || []).map(x=>x.id===entry.id?{...x,etat,termineAt:Date.now()}:x)}));}catch(_){completed=false;}
 // Un échec du journal après l'envoi ne transforme pas une réussite en échec.
 return {...r,body:{...r.body,journalId:entry.id,...(completed!==true?{journalAvertissement:'Résultat non enregistré : relis eBay avant toute nouvelle tentative.'}:{})}};
}
