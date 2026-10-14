// Une lecture partielle ajoute les commandes lues sans effacer l'historique.
export function fusionCommandesEbay(previous,data,now){
 if(!Array.isArray(data?.orders) || data.orders.some(o=>!o || typeof o.orderId!=='string' || !o.orderId.trim()))return null;
 const orders=new Map((Array.isArray(previous?.orders)?previous.orders:[]).filter(o=>typeof o?.orderId==='string').map(o=>[o.orderId,o]));
 for(const o of data.orders)orders.set(o.orderId,{...orders.get(o.orderId),...o,_capturedAt:now});
 const total=Number.isInteger(data.total) && data.total>=0?data.total:null;
 return {...previous,orders:[...orders.values()],capturedAt:now,lues:data.orders.length,total,complet:total!=null && data.orders.length>=total && !data.next};
}
