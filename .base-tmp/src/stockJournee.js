import { centimes } from './beneficePaire.js';
// Annonces déjà filtrées par compte et état par l'écran. Le montant reste
// explicitement limité aux prix d'achat renseignés, jamais une valeur estimée.
const cleNumStock=(n)=>{const s=String(n==null?'':n).toUpperCase().replace(/[\s\-_.]/g,'');return /^\d+$/.test(s)?String(parseInt(s,10)):s;};
export function resumerStockJournee(annonces, numeros={}) {
 const vus=new Set();let total=0,renseignes=0,cout=0;
 for(const it of annonces || []){
  if(it?.id==null)continue;
  // (11 nov., lot DJ4 — « une seule fois si elle est sur plusieurs sites/comptes ») La même
  // règle d'identité que le Stock (`annoncesActuelles`) : une paire = SON N° (« 007 » = « 7 ») ;
  // sans N°, l'annonce elle-même (compte + id). Jamais le titre.
  const num=cleNumStock(numeros[it.id]?.numero);
  const cle=num?'n:'+num:JSON.stringify([String(it._acc?.vinted_user_id || ''),String(it.id)]);
  if(vus.has(cle))continue;vus.add(cle);total++;
  const brut=numeros[it.id]?.buyPrice;
  if(typeof brut!=='number' && typeof brut!=='string' || typeof brut==='string' && !brut.trim())continue;
  // (11 nov., revue robustesse) Les prix sont rangés avec une VIRGULE (« 25,50 »,
  // `prixAchatSaisi`) : `Number` les lisait NaN ⇒ « sans prix ». La règle du Stock
  // (`centimes`, src/beneficePaire.js) les lit en centimes exacts.
  const c=typeof brut==='number'?(Number.isFinite(brut)&&brut>=0?Math.round(brut*100):null):centimes(String(brut).replace(/[\s\u00a0€]/g,''));
  if(c==null)continue;
  renseignes++;cout+=c;
 }
 return {total,renseignes,manquants:total-renseignes,cout:cout/100};
}
