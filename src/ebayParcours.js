import {centimes,beneficePaire} from './beneficePaire.js';
export function cibleEbay(compte,t){
 if(!t || !['ventes','messages','offres','annonces'].includes(t.section))return null;
 const id=t.targetId || (typeof t.id==='string' && t.id.includes(':')?t.id.slice(t.id.indexOf(':')+1):null);
 return id?{compte:compte || 'principal',section:t.section,id:String(id),itemId:t.ref?String(t.ref):null}:null;
}
export function bilanCommandeEbay(order,costs={}){
 if(order?.cancelStatus?.cancelState==='CANCELED' || order?.orderPaymentStatus==='FULLY_REFUNDED')return {benefice:null,raison:'Commande annulée ou intégralement remboursée : résultat à vérifier avec les remboursements.'};
 const lines=order?.lineItems;
 if(!Array.isArray(lines) || lines.length!==1 || lines[0].quantity!==1)return {benefice:null,raison:'Le bénéfice par article nécessite une commande avec un seul article et une quantité de 1.'};
 const line=lines[0];
 // `total` peut inclure le port payé par l’acheteur. Utiliser le prix
 // de l’article après remise, et refuser une remise dont le résultat manque.
 const price=line.discountedLineItemCost || (line.discounts?.length?null:line.lineItemCost);
 if(price?.currency!=='EUR' || centimes(price?.value)==null)return {benefice:null,raison:'Prix de l’article en euros non fourni par eBay.'};
 const fee=order.totalMarketplaceFee;
 const commissionAuto=fee?.currency==='EUR' && centimes(fee?.value)!=null?fee.value:null;
 const entry={...costs,...(commissionAuto!=null?{commission:commissionAuto,fraisComplets:costs.fraisComplets===true && centimes(costs.commissionLueConfirmee)===centimes(commissionAuto)}:{})};
 const bilan=beneficePaire(price.value,entry);
 return {...bilan,entry,commissionAuto,prixArticle:centimes(price.value)/100,raison:bilan.achat==null?'Prix d’achat à renseigner.':null};
}
export function codesRetraitEbay(messages){
 const found=new Set();
 for(const body of messages){
  if(typeof body!=='string')continue;
  const re=/(?:code\s+(?:de\s+retrait|d[’']ouverture)|pickup\s+code|\bPIN)\s*[:：=-]?\s*([A-Z0-9]{4,16})(?![A-Z0-9])/gi;
  for(const m of body.matchAll(re))found.add(m[1]);
 }
 return [...found];
}
