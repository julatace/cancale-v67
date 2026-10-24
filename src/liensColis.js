import {normaliserSuivi} from '../api/_lib/etat-colis-email.js';
// Les n° de suivi d'un achat (23 oct.) : ceux de SON entrée d'index — la ligne
// de suivi Vinted relevée par l'extension (`suivi`) et ceux qu'il a reliés à la
// main (`suivis`). ⚠️ Les champs `tracking_code` / `tracking_number` de la
// commande et de sa transaction ne sont plus lus : mesuré, aucune commande et
// 0 transaction sur 1 290 n'en portent — une lecture morte. Une entrée d'un
// AUTRE compte (même n° de transaction lu ailleurs) ne relie rien : l'entrée se
// cherche d'abord sous « compte:transaction » (une transaction Vinted est vue
// des DEUX côtés, acheteur et vendeur : deux de ses comptes peuvent la porter),
// puis sous la transaction seule (la photo, une entrée sans compte).
export const entreeIndexAchat=(achat,index={})=>{
 const tx=String(achat?.transaction_id||'');const uid=String(achat?._acc?.vinted_user_id||achat?._acc||'');
 return (uid&&index[uid+':'+tx])||index[tx]||null;
};
export const suivisAchat=(achat,index={})=>{
 const t=entreeIndexAchat(achat,index)||{};
 const uid=String(achat?._acc?.vinted_user_id||achat?._acc||'');
 if(t.uid&&uid&&String(t.uid)!==uid)return [];
 return [...new Set([t.suivi,...(Array.isArray(t.suivis)?t.suivis:[])].map(normaliserSuivi).filter(Boolean))];
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
