import { sbCle } from './cle.js';
import { cleCompteDe, modifierDonnee } from './ebay.js';
import { commandeMinimale } from './ebay-commandes.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID=/^ebay_orders(?:_[0-9a-f]{16})?$/;
// Seule l'identité du compte SIGNÉE par eBay sélectionne les lignes.
// Les premières lectures rendent des clés de lignes, jamais leurs jetons.
export async function anonymiserCompteEbay(payload) {
  const d=payload && payload.notification && payload.notification.data;
  if(!d || payload.metadata?.topic!=='MARKETPLACE_ACCOUNT_DELETION') return false;
  const service=process.env.SUPABASE_SERVICE_KEY;
  if(!service) return false;
  const base=process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
  const eias=typeof d.eiasToken==='string' && d.eiasToken.length>=8 && d.eiasToken.length<=4096 ? d.eiasToken : '';
  const pseudo=typeof d.username==='string' && d.username.length<=64 ? d.username : '';
  const cle=eias ? cleCompteDe(eias) : '';
  const debut=Date.now();
  async function clesLignes(filtre) {
    const rows=[];
    for(let offset=0;offset<2000;offset+=100) {
      const r=await fetch(`${base}/rest/v1/app_data?${filtre}&select=owner,id&order=owner.asc,id.asc&limit=100&offset=${offset}`,{headers:sbCle(service),signal:AbortSignal.timeout(5000)});
      if(!r.ok) return null;
      const j=await r.json();if(!Array.isArray(j)) return null;
      rows.push(...j);if(j.length<100) return rows;
      if(Date.now()-debut>20000) return null;
    }
    return null;
  }
  try {
    const registres=cle ? await clesLignes(`id=eq.ebay_comptes&data->comptes=cs.${encodeURIComponent(JSON.stringify([{cle}]))}`) : [];
    const commandes=pseudo ? await clesLignes(`id=like.ebay_orders*&data->orders=cs.${encodeURIComponent(JSON.stringify([{buyer:{username:pseudo}}]))}`) : [];
    if(registres===null || commandes===null) return false;
    for(const r of registres) {
      if(!UUID.test(r.owner || '') || r.id!=='ebay_comptes') return false;
      let matching=[];
      // Lecture gardée : une reconnexion concurrente à un autre compte ne se perd pas.
      const w=await modifierDonnee('ebay_comptes',r.owner,data=>{
        if(!data || !Array.isArray(data.comptes)) return undefined;
        matching=data.comptes.filter(c=>c && c.cle===cle);
        return {...data,comptes:data.comptes.map(c=>c && c.cle===cle ? {...c,pseudo:'',deconnecteLe:Date.now()} : c)};
      });
      if(w!==true) return false;
      for(const c of matching) {
        const id='ebay_tokens'+(c.principal?'':'_'+cle);
        if(await modifierDonnee(id,r.owner,()=>({refresh_token:'',deconnecteLe:Date.now()}))!==true) return false;
        // Le coffre et le titulaire seront libérés par K4 via la même identité.
      }
      if(Date.now()-debut>20000) return false;
    }
    for(const r of commandes) {
      if(!UUID.test(r.owner || '') || !ID.test(r.id || '')) return false;
      const w=await modifierDonnee(r.id,r.owner,data=>{
        if(!data || !Array.isArray(data.orders)) return undefined;
        return {...data,orders:data.orders.map(o=>{
          const minimal=commandeMinimale(o);if(!minimal) return null;
          if(minimal.buyer && minimal.buyer.username===pseudo) delete minimal.buyer;
          return minimal;
        }).filter(Boolean)};
      });
      if(w!==true) return false;
      if(Date.now()-debut>20000) return false;
    }
    return true;
  }catch(_){return false;}
}
