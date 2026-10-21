import {normaliserSuivi} from '../api/_lib/etat-colis-email.js';
export const suivisAchat=(achat,index={})=>{
 const t=index[String(achat?.transaction_id||'')]||{};
 return [...new Set([achat?.tracking_code,achat?.tracking_number,achat?.suivi,achat?.shipment?.tracking_code,achat?.shipment?.tracking_number,t.suivi,t.suivi2,t.suivi3].map(normaliserSuivi).filter(Boolean))];
};
export function achatDuColis(colis,achats,index={}){
 const suivi=normaliserSuivi(colis?.suivi),tx=String(colis?.transaction||colis?.transactionId||'');
 if(!suivi&&!tx)return null;
 const candidats=new Map();
 for(const a of achats||[]){
  const id=String(a?.transaction_id||'');if(!id)continue;
  if(tx?id===tx:suivisAchat(a,index).includes(suivi))candidats.set(String(a._acc?.vinted_user_id||a._acc||'')+':'+id,a);
 }
 return candidats.size===1?[...candidats.values()][0]:null;
}
