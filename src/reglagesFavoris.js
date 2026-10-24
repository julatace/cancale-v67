import {preparerMessageFavori} from './favorisVinted.js';
const BASE={message:'',pourcentage:null,intervalleMinutes:6};
function identite({uid,owner,ownerActuel}) {
  if(!owner||ownerActuel()!==owner||!/^\d{1,20}$/.test(String(uid||'')))throw Error('Le compte et la session doivent être confirmés.');
  return `vrm_favoris_reglages_${uid}`;
}
export function validerReglagesFavoris({message='',pourcentage=null,intervalleMinutes}) {
  if(typeof message!=='string')throw Error('Le message doit être du texte.');
  const intervalle=String(intervalleMinutes??'').trim();
  if(!/^\d{1,6}$/.test(intervalle)||Number(intervalle)<1||Number(intervalle)>1440)throw Error('Choisis un intervalle entier entre 1 et 1 440 minutes.');
  const m=preparerMessageFavori(message,pourcentage);
  if(m.erreur)throw Error(m.erreur);
  if(!m.message)throw Error('Ajoute un message ou une réduction avant d’enregistrer.');
  return {version:1,message:message.trim(),pourcentage:m.pourcentage,intervalleMinutes:Number(intervalle),envoisActifs:false};
}
export async function lireReglagesFavoris(opts) {
  const id=identite(opts),{owner,ownerActuel,base,headers,fetcher=fetch}=opts;
  const r=await fetcher(`${base}/rest/v1/app_data?id=eq.${id}&owner=eq.${encodeURIComponent(owner)}&select=id,owner,data`,{headers,cache:'no-store'});
  if(!r.ok)throw Error('Les réglages enregistrés n’ont pas pu être lus. Réessaie avant de les modifier.');
  const rows=await r.json();
  if(ownerActuel()!==owner)throw Error('La session a changé. Recharge les réglages.');
  if(!Array.isArray(rows)||rows.length>1||rows.some(x=>x?.owner!==owner||x.id!==id))throw Error('Les réglages ne confirment pas le compte attendu.');
  if(!rows.length)return {...BASE,enregistres:false};
  const d=rows[0].data;
  if(d?.version!==1||d.envoisActifs!==false||typeof d.message!=='string'||!(d.pourcentage===null||Number.isInteger(d.pourcentage))||!Number.isInteger(d.intervalleMinutes))throw Error('Le format des réglages enregistrés doit être vérifié avant de les remplacer.');
  return {...validerReglagesFavoris(d),enregistres:true};
}
export async function sauverReglagesFavoris(opts,reglages) {
  const id=identite(opts),data=validerReglagesFavoris(reglages),{owner,ownerActuel,base,headers,fetcher=fetch}=opts;
  const r=await fetcher(`${base}/rest/v1/app_data?on_conflict=owner,id`,{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id,owner,data})});
  if(!r.ok)throw Error('Enregistrement non confirmé. Relis les réglages avant de réessayer.');
  const rows=await r.json();
  if(ownerActuel()!==owner)throw Error('La session a changé. Relis les réglages.');
  if(!Array.isArray(rows)||rows.length!==1||rows[0]?.owner!==owner||rows[0]?.id!==id||Object.keys(data).some(k=>rows[0].data?.[k]!==data[k]))throw Error('Enregistrement non confirmé. Relis les réglages avant de réessayer.');
  return data;
}
