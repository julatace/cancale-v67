import {preparerMessageFavori} from './favorisVinted.js';
const BASE={message:'',pourcentage:null,offreMode:null,offreValeur:null,arrondi:false,intervalleMinutes:6,intervalleMaxMinutes:null};
function identite({uid,owner,ownerActuel}) {
  if(!owner||ownerActuel()!==owner||!/^\d{1,20}$/.test(String(uid||'')))throw Error('Le compte et la session doivent être confirmés.');
  return `vrm_favoris_reglages_${uid}`;
}
// Temps entre deux messages : fixe (intervalleMaxMinutes null) ou tiré au
// hasard par le SERVEUR entre le minimum et le maximum (28 oct., sa demande :
// « le temps aléatoire comme pour les republications »).
// L'offre Vinted jointe au message (29 oct., comme Vintex) : « Diminuer » d'un
// pourcentage (`pourcentage`, forme d'avant) ou d'un montant en euros, ou
// « Fixer à » un prix ; arrondi à l'euro inférieur en option. Rien = pas d'offre.
export const MESSAGE_PAR_DEFAUT='Bonjour ! Tu as mis cet article en favori : je te propose une offre dessus.';
const MONTANT=/^\d{1,5}(?:[.,]\d{1,2})?$/;
export function offreFavori({pourcentage=null,offreMode=null,offreValeur=null,arrondi=false}={}){
  const mode=offreMode==null||offreMode===''||offreMode==='aucune'?(String(pourcentage??'').trim()?'pct':null):offreMode;
  if(mode==null)return {pourcentage:null,offreMode:null,offreValeur:null,arrondi:false};
  if(!['pct','euros','prix'].includes(mode))throw Error('Type d’offre inconnu.');
  if(arrondi!=null&&typeof arrondi!=='boolean')throw Error('Arrondi invalide.');
  if(mode==='pct'){
    const brut=String(pourcentage??'').trim();
    if(!/^\d{1,6}$/.test(brut)||Number(brut)<1||Number(brut)>99)throw Error('Saisis un pourcentage entier entre 1 et 99.');
    return {pourcentage:Number(brut),offreMode:'pct',offreValeur:null,arrondi:arrondi===true};
  }
  const brut=String(offreValeur??'').trim().replace(/\s|€/g,'');
  if(!MONTANT.test(brut))throw Error(mode==='euros'?'Saisis le montant à retirer en euros (par exemple 5 ou 4,50).':'Saisis le prix de l’offre en euros (par exemple 45 ou 44,90).');
  const v=Math.round(Number(brut.replace(',','.'))*100)/100;
  if(mode==='euros'&&!(v>=0.01&&v<=9999))throw Error('Le montant à retirer doit être entre 0,01 € et 9 999 €.');
  if(mode==='prix'&&!(v>=1&&v<=99999))throw Error('Le prix de l’offre doit être d’au moins 1 €.');
  return {pourcentage:null,offreMode:mode,offreValeur:v,arrondi:arrondi===true};
}
export function validerReglagesFavoris({message='',pourcentage=null,offreMode=null,offreValeur=null,arrondi=false,intervalleMinutes,intervalleMaxMinutes=null}) {
  if(typeof message!=='string')throw Error('Le message doit être du texte.');
  const intervalle=String(intervalleMinutes??'').trim();
  // 0 = « comme Vintex » (6 à 10 s, tiré par le serveur) ; sinon des minutes entières.
  if(!/^\d{1,6}$/.test(intervalle)||Number(intervalle)>1440)throw Error('Choisis un intervalle entier entre 0 et 1 440 minutes (0 = comme Vintex).');
  const maxTexte=String(intervalleMaxMinutes??'').trim();let max=null;
  if(maxTexte&&Number(intervalle)>0){
    if(!/^\d{1,6}$/.test(maxTexte)||Number(maxTexte)<1||Number(maxTexte)>1440)throw Error('Choisis un maximum entier entre 1 et 1 440 minutes.');
    if(Number(maxTexte)<Number(intervalle))throw Error('Le maximum doit être au moins égal au minimum.');
    if(Number(maxTexte)>Number(intervalle))max=Number(maxTexte);
  }
  const o=offreFavori({pourcentage,offreMode,offreValeur,arrondi});
  // (29 oct., « tout à l'heure ça marchait ») Avant la 5.281, un message VIDE avec une
  // réduction partait avec « Je te propose une réduction… ». Message vide + offre ⇒ ce
  // texte par défaut (sans variable : toute extension sait l'envoyer). Sans offre, un
  // message vide n'a rien à envoyer : refusé.
  const texte=message.trim()?message:(o.offreMode?MESSAGE_PAR_DEFAUT:'');
  const m=preparerMessageFavori(texte,o.pourcentage);
  if(m.erreur)throw Error(m.erreur);
  if(!m.message)throw Error('Écris un message, ou choisis une offre : sans l’un ni l’autre, il n’y a rien à envoyer.');
  return {version:1,message:texte.trim(),...o,intervalleMinutes:Number(intervalle),intervalleMaxMinutes:max,envoisActifs:false};
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
  if(d?.version!==1||d.envoisActifs!==false||typeof d.message!=='string'||!(d.pourcentage===null||Number.isInteger(d.pourcentage))||!(d.offreMode==null||['pct','euros','prix'].includes(d.offreMode))||!(d.offreValeur==null||typeof d.offreValeur==='number')||!(d.arrondi==null||typeof d.arrondi==='boolean')||!Number.isInteger(d.intervalleMinutes)||!(d.intervalleMaxMinutes==null||Number.isInteger(d.intervalleMaxMinutes)))throw Error('Le format des réglages enregistrés doit être vérifié avant de les remplacer.');
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
