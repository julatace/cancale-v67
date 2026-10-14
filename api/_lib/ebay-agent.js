import {randomUUID} from 'node:crypto';
// Préparation uniquement : une tâche ouvre l'écran d'action et ses confirmations.
export function preparerAgentEbay({orders,messages,offres,journal},now=Date.now()) {
 const tasks=[],sources=[];
 const add=(section,items,make)=>{for(const x of items){const t=make(x);if(t)tasks.push({section,...t});}};
 const known=Array.isArray(orders?.orders);
 sources.push({nom:'Commandes',ok:known,at:orders?.capturedAt || null,partiel:true});
 if(known)add('ventes',orders.orders,o=>o.orderPaymentStatus==='PAID' && ['NOT_STARTED','IN_PROGRESS'].includes(o.orderFulfillmentStatus) && (!o.cancelStatus?.cancelState || ['NONE_REQUESTED','CANCEL_REJECTED'].includes(o.cancelStatus.cancelState))?{id:'order:'+o.orderId,label:'Préparer l’expédition',ref:o.orderId}:null);
 for(const [nom,section,r,key,make] of [
  ['Messages','messages',messages,'messages',m=>['Unanswered','Pending'].includes(m.status)?{id:'message:'+m.id,label:'Répondre au message',ref:m.itemId}:null],
  ['Offres','offres',offres,'offres',o=>['Pending','Active'].includes(o.status) && (!o.expiresAt || Date.parse(o.expiresAt)>now)?{id:'offer:'+o.id,label:'Étudier l’offre',ref:o.itemId}:null],
 ]){const ok=r?.body?.ok===true && Array.isArray(r.body[key]);sources.push({nom,ok,partiel:ok && (r.body.totalPages==null || r.body.totalPages>1)});if(ok)add(section,r.body[key],make);}
 return {status:200,body:{ok:true,tasks,sources,journal:Array.isArray(journal?.items)?journal.items:[],journalLisible:journal!==undefined,capturedAt:now}};
}
export async function executerAvecJournal({action,b,execute,modifier}) {
 const entry={id:randomUUID(),action,ref:String(b.orderId || b.itemId || '').slice(0,64),at:Date.now(),etat:'en_cours'};
 let saved;try{saved=await modifier(d=>({...d,items:[entry,...(Array.isArray(d?.items)?d.items:[])].slice(0,100)}));}catch(_){saved=false;}
 if(saved!==true)return {status:503,body:{ok:false,error:'Le suivi de cette action n’a pas pu être préparé. Réessaie plus tard ; rien n’a été envoyé.',reason:'journal'}};
 let r;try{r=await execute();}catch(_){r={status:504,body:{ok:false,reason:'incertain',error:'État incertain : relis les données eBay avant de recommencer.'}};}
 const etat=r.body?.ok?'reussi':r.body?.reason==='incertain'?'incertain':'refuse';
 let completed;try{completed=await modifier(d=>({...d,items:(d?.items || []).map(x=>x.id===entry.id?{...x,etat,termineAt:Date.now()}:x)}));}catch(_){completed=false;}
 // Un échec du journal après l'envoi ne transforme pas une réussite en échec.
 return {...r,body:{...r.body,journalId:entry.id,...(completed!==true?{journalAvertissement:'Résultat non enregistré : relis eBay avant toute nouvelle tentative.'}:{})}};
}
