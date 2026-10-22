// Petites lignes serveur sous le propriétaire neutre : jamais écrites avec
// un jeton navigateur. CAS par révision, partagé entre instances Vercel.
import crypto from 'node:crypto';import {sbCle} from './cle.js';import {PROPRIETAIRE_NEUTRE} from './proprietaire-email.js';
export const empreintePrivee=s=>crypto.createHash('sha256').update(Buffer.isBuffer(s)?s:String(s)).digest('hex');
export async function requetePrivee(query,opt={}){
 const cle=process.env.SUPABASE_SERVICE_KEY;if(!cle)throw Error('stockage-indisponible');
 const base=process.env.SUPABASE_URL||'https://lgonxzrzjcqthjtbdpzo.supabase.co';
 const r=await fetch(`${base}/rest/v1/app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&${query}`,{...opt,headers:{...sbCle(cle),...opt.headers},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('stockage-indisponible');const j=await r.json();if(!Array.isArray(j))throw Error('stockage-illisible');return j;
}
export async function lirePrive(id){const rows=await requetePrivee(`id=eq.${encodeURIComponent(id)}&select=data`);if(rows.length>1)throw Error('stockage-ambigu');return rows[0]?.data||null;}
export async function casPrive(id,avant,donnees){
 const data={...donnees,rev:crypto.randomUUID()};let rows;
 if(!avant){rows=await requetePrivee('on_conflict=owner,id&select=data',{method:'POST',headers:{'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify([{owner:PROPRIETAIRE_NEUTRE,id,data}])});}
 else{if(typeof avant.rev!=='string')throw Error('revision-absente');rows=await requetePrivee(`id=eq.${encodeURIComponent(id)}&data->>rev=eq.${encodeURIComponent(avant.rev)}&select=data`,{method:'PATCH',headers:{'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({data})});}
 return rows.length===1?rows[0].data:null;
}
export async function prendreQuota(cle,{max=6,fenetre=3600000,maintenant=Date.now()}={}){
 const id='quota_v1_'+empreintePrivee(cle),periode=Math.floor(maintenant/fenetre);
 for(let i=0;i<6;i++){const d=await lirePrive(id),n=d?.periode===periode?Number(d.n)||0:0;if(n>=max)return{ok:false,reessayer:Math.ceil(((periode+1)*fenetre-maintenant)/1000)};
  if(await casPrive(id,d,{periode,n:n+1}))return{ok:true};
 }throw Error('stockage-occupe');
}
