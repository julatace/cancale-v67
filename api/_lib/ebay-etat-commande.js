// Règle partagée entre liste, préparation et écriture du suivi.
export function etatCommandeEbay(order){
 const payment=String(order?.orderPaymentStatus || '').toUpperCase();
 const fulfillment=String(order?.orderFulfillmentStatus || '').toUpperCase();
 const cancel=String(order?.cancelStatus?.cancelState || '').toUpperCase();
 const state=(label,kind,peutExpedier=false,expedie=false)=>({label,kind,peutExpedier,expedie});
 if(cancel==='CANCELED')return state('Annulée','cancelled');
 if(payment==='FULLY_REFUNDED')return state('Remboursée','refunded');
 if(cancel && !['NONE_REQUESTED','CANCEL_REJECTED'].includes(cancel))return state('Annulation à vérifier','review');
 if(payment!=='PAID')return state(payment?'Paiement à vérifier':'Paiement à confirmer','payment',false,['FULFILLED','SHIPPED'].includes(fulfillment));
 if(['FULFILLED','SHIPPED'].includes(fulfillment))return state('Expédiée','shipped',false,true);
 if(fulfillment==='IN_PROGRESS')return state('Expédition partielle','partial',true);
 if(fulfillment==='NOT_STARTED')return state('À expédier','pending',true);
 return state('Expédition à confirmer','review');
}
