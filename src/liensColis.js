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
const suivisAchatCalc=(achat,index={})=>{
 const t=entreeIndexAchat(achat,index)||{};
 const uid=String(achat?._acc?.vinted_user_id||achat?._acc||'');
 if(t.uid&&uid&&String(t.uid)!==uid)return [];
 return [...new Set([t.suivi,...(Array.isArray(t.suivis)?t.suivis:[])].map(normaliserSuivi).filter(Boolean))];
};
// (9 nov., vitesse) MÉMOIRE D'UN SEUL CALCUL SYNCHRONE (la règle de `memoRendu`, App.jsx) :
// un rendu de Colis ou de Ma journée appelle `achatDuColis` pour chaque colis, qui relisait
// TOUS les achats et leurs n° de suivi (colis × achats, ~0,8 s du démarrage au téléphone).
// Les mêmes `achats` et le même `index` (mêmes objets) donnent le même résultat : il est gardé
// jusqu'à la microtâche suivante, jamais au-delà (aucun résultat d'avant une écriture).
// La règle ne change pas : `achatDuColisCalc` reste la référence (scripts/tests/liens-colis-memo).
let memo=null;
const memoire=()=>{ if(!memo){ memo={suivis:new WeakMap(),parListe:new WeakMap()}; const vider=()=>{ memo=null; }; try{ queueMicrotask(vider); }catch(_){ Promise.resolve().then(vider); } } return memo; };
export const suivisAchat=(achat,index={})=>{
 if(!achat||typeof achat!=='object'||!index||typeof index!=='object')return suivisAchatCalc(achat,index);
 const m=memoire();let parIndex=m.suivis.get(index);if(!parIndex){ parIndex=new WeakMap(); m.suivis.set(index,parIndex); }
 if(parIndex.has(achat))return parIndex.get(achat).slice();
 const r=suivisAchatCalc(achat,index);parIndex.set(achat,r);return r.slice();
};
export function achatDuColisCalc(colis,achats,index={}){
 const suivi=normaliserSuivi(colis?.suivi),tx=String(colis?.transaction||colis?.transactionId||'');
 if(!suivi&&!tx)return null;
 const candidats=new Map();
 for(const a of achats||[]){
  const id=String(a?.transaction_id||'');if(!id)continue;
  if(tx?id===tx:suivisAchatCalc(a,index).includes(suivi))candidats.set(String(a._acc?.vinted_user_id||a._acc||'')+':'+id,a);
 }
 return candidats.size===1?[...candidats.values()][0]:null;
}
// L'index des achats par transaction et par n° de suivi : les MÊMES candidats que la boucle
// de `achatDuColisCalc`, dans le même ordre (une clé « compte:transaction » vue deux fois
// garde le DERNIER achat, comme `Map.set`).
const indexAchats=(achats,index)=>{
 const parTx=new Map(),parSuivi=new Map();
 const poser=(m,k,cle,a)=>{ let c=m.get(k); if(!c){ c=new Map(); m.set(k,c); } c.set(cle,a); };
 for(const a of achats){
  const id=String(a?.transaction_id||'');if(!id)continue;
  const cle=String(a._acc?.vinted_user_id||a._acc||'')+':'+id;
  poser(parTx,id,cle,a);
  for(const su of suivisAchatCalc(a,index))poser(parSuivi,su,cle,a);
 }
 return {parTx,parSuivi};
};
export function achatDuColis(colis,achats,index={}){
 if(!Array.isArray(achats)||!index||typeof index!=='object')return achatDuColisCalc(colis,achats,index);
 const suivi=normaliserSuivi(colis?.suivi),tx=String(colis?.transaction||colis?.transactionId||'');
 if(!suivi&&!tx)return null;
 const m=memoire();let parIndex=m.parListe.get(achats);if(!parIndex){ parIndex=new WeakMap(); m.parListe.set(achats,parIndex); }
 let ix=parIndex.get(index);if(!ix){ ix=indexAchats(achats,index); parIndex.set(index,ix); }
 const c=tx?ix.parTx.get(tx):ix.parSuivi.get(suivi);
 return c&&c.size===1?[...c.values()][0]:null;
}
