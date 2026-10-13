import { sbCle } from './cle.js';
const MOIS=30*86400000;
let enVol=null;
// Schéma officiel Sell Metadata 1.12.1, shipping/marketplace/EBAY_FR.
export async function metadataTransport(lire,obtenirJeton) {
  if(enVol) return enVol;
  enVol=(async()=>{
    const cle=process.env.SUPABASE_SERVICE_KEY;
    if(!cle) return {ok:false,error:'Métadonnées transport non configurées.'};
    const base=process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
    const url=`${base}/rest/v1/vrm_reglages?cle=eq.ebay_transport_fr&select=valeur`;
    try {
      const r=await fetch(url,{headers:sbCle(cle),signal:AbortSignal.timeout(5000)});
      if(!r.ok) return {ok:false,error:'Métadonnées transport illisibles.'};
      const j=await r.json();if(!Array.isArray(j)) return {ok:false,error:'Métadonnées transport illisibles.'};
      let ancien=null;try{ancien=j[0] && JSON.parse(j[0].valeur);}catch(_){}
      if(ancien && Number.isFinite(ancien.lu) && ancien.lu<=Date.now() && ancien.lu>Date.now()-MOIS && Array.isArray(ancien.transporteurs) && Array.isArray(ancien.services)) return {ok:true,cache:true,...ancien};
      const at=await obtenirJeton();if(!at.ok || !at.token) return {ok:false,error:'eBay ne répond pas pour les métadonnées transport.'};
      const root='https://api.ebay.com/sell/metadata/v1/shipping/marketplace/EBAY_FR/';
      const [carriers,services]=await Promise.all([lire(root+'get_shipping_carriers',at.token,{'Accept-Language':'fr-FR'}),lire(root+'get_shipping_services',at.token,{'Accept-Language':'fr-FR'})]);
      if(!carriers.ok || !services.ok || !Array.isArray(carriers.data?.shippingCarriers) || !Array.isArray(services.data?.shippingServices)) return {ok:false,error:'Table transport eBay incomplète — dernière lecture conservée.'};
      const texte=v=>typeof v==='string' ? v.slice(0,200) : null;
      const valeur={lu:Date.now(),transporteurs:carriers.data.shippingCarriers.filter(x=>x && typeof x.shippingCarrier==='string').map(x=>({code:texte(x.shippingCarrier),nom:texte(x.description)})),services:services.data.shippingServices.filter(x=>x && typeof x.shippingService==='string').map(x=>({code:texte(x.shippingService),transporteur:texte(x.shippingCarrier),nom:texte(x.description),international:typeof x.internationalService==='boolean'?x.internationalService:null,min:Number.isInteger(x.minShippingTime)?x.minShippingTime:null,max:Number.isInteger(x.maxShippingTime)?x.maxShippingTime:null}))};
      const w=await fetch(`${base}/rest/v1/vrm_reglages?on_conflict=cle`,{method:'POST',headers:{...sbCle(cle),'content-type':'application/json',Prefer:'resolution=merge-duplicates'},body:JSON.stringify({cle:'ebay_transport_fr',valeur:JSON.stringify(valeur)}),signal:AbortSignal.timeout(5000)});
      return w.ok ? {ok:true,cache:false,...valeur} : {ok:false,error:'Table transport lue mais non enregistrée.'};
    }catch(_){return {ok:false,error:'Métadonnées transport indisponibles.'};}
  })();
  try{return await enVol;}finally{enVol=null;}
}
