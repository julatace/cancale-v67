import crypto from 'node:crypto';
import { jetonApplication } from './ebay.js';
import { sbCle } from './cle.js';

// Contrat : eBay/event-notification-nodejs-sdk, lib/validator.js (SHA1/ECDSA).
// Corps brut d'abord ; re-sérialisation JSON en repli, comme le SDK officiel.
const cles = new Map(), enVol = new Map();
const nouveauxKids = [];
const HEURE = 3600000;
const URL_BASE = () => process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const service = () => process.env.SUPABASE_SERVICE_KEY || '';
const pemPropre = cle => {
  if (typeof cle !== 'string' || cle.length > 4096) return null;
  try { const m = /^\s*-----BEGIN PUBLIC KEY-----([a-zA-Z0-9+/=\s]+)-----END PUBLIC KEY-----\s*$/.exec(cle); if (!m) return null; const b64=m[1].replace(/\s/g,''); const k = crypto.createPublicKey('-----BEGIN PUBLIC KEY-----\n'+b64.match(/.{1,64}/g).join('\n')+'\n-----END PUBLIC KEY-----\n');
    return k.asymmetricKeyType === 'ec' ? k : null;
  } catch (_) { return null; }
};
async function lireCleBase(kid) {
  if (!service()) return null;
  try {
    const r = await fetch(`${URL_BASE()}/rest/v1/vrm_ebay_cles_publiques?kid=eq.${encodeURIComponent(kid)}&select=pem,lu&limit=1`, {headers:sbCle(service()), signal:AbortSignal.timeout(5000)});
    if (!r.ok) return null;
    const j = await r.json(); const x = Array.isArray(j) && j[0];
    return x && Date.parse(x.lu) > Date.now() - HEURE && pemPropre(x.pem) ? x.pem : null;
  } catch (_) { return null; }
}
async function rangerCle(kid,pem) {
  if (!service()) return;
  try { await fetch(`${URL_BASE()}/rest/v1/vrm_ebay_cles_publiques?on_conflict=kid`, {method:'POST', headers:{...sbCle(service()),'content-type':'application/json',Prefer:'resolution=merge-duplicates'}, body:JSON.stringify({kid,pem,lu:new Date().toISOString()}),signal:AbortSignal.timeout(5000)}); } catch (_) {}
}
async function clePublique(kid) {
  const t=Date.now(), memo=cles.get(kid);
  if (process.env.EBAY_NOTIF_PUBLIC_KEY_KID === kid && pemPropre(process.env.EBAY_NOTIF_PUBLIC_KEY_PEM)) return {status:200,pem:process.env.EBAY_NOTIF_PUBLIC_KEY_PEM};
  if (memo && memo.jusqua>t) return memo;
  if (enVol.has(kid)) return enVol.get(kid);
  const p=(async()=>{
    const cache=await lireCleBase(kid);
    if (cache) { const r={status:200,pem:cache,jusqua:t+HEURE};cles.set(kid,r);return r; }
    while(nouveauxKids.length && nouveauxKids[0]<t-HEURE) nouveauxKids.shift();
    if(nouveauxKids.length>=10) return {status:412};
    nouveauxKids.push(t);
    let resultat={status:500};
    try {
      const at=await jetonApplication();
      if(at.ok && at.token) {
        const r=await fetch(`https://api.ebay.com/commerce/notification/v1/public_key/${encodeURIComponent(kid)}`,{headers:{Authorization:`Bearer ${at.token}`,Accept:'application/json'},signal:AbortSignal.timeout(10000)});
        const j=await r.json().catch(()=>null);
        if(r.ok && j && pemPropre(j.key)) { resultat={status:200,pem:j.key};await rangerCle(kid,j.key); }
        else resultat={status:r.status===404?412:500};
      }
    } catch (_) {}
    resultat.jusqua=t+(resultat.status===500?30000:HEURE);cles.set(kid,resultat);
    while(cles.size>100) cles.delete(cles.keys().next().value);
    return resultat;
  })();
  enVol.set(kid,p);
  try{return await p;}finally{enVol.delete(kid);}
}
export async function verifierEvenementEbay(brut, entete, lireCle=clePublique) {
  if(!Buffer.isBuffer(brut) || !brut.length || brut.length>262144 || typeof entete!=='string' || entete.length>4096 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(entete)) return {ok:false,status:412};
  let sig,payload;
  try {
    sig=JSON.parse(Buffer.from(entete,'base64').toString('utf8'));
    payload=JSON.parse(brut.toString('utf8'));
  } catch (_) {return {ok:false,status:412};}
  if(!sig || String(sig.alg).toLowerCase()!=='ecdsa' || sig.digest!=='SHA1' || typeof sig.kid!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(sig.kid) || typeof sig.signature!=='string' || !/^[a-zA-Z0-9+/]+={0,2}$/.test(sig.signature) || sig.signature.length>256) return {ok:false,status:412};
  const cle=await lireCle(sig.kid);
  if(!cle || cle.status!==200) return {ok:false,status:cle && cle.status===412?412:500};
  const key=pemPropre(cle.pem);if(!key) return {ok:false,status:500};
  try {
    const signature=Buffer.from(sig.signature,'base64');
    const ok=crypto.verify('sha1',brut,key,signature) || crypto.verify('sha1',Buffer.from(JSON.stringify(payload)),key,signature);
    return ok ? {ok:true,status:204,payload} : {ok:false,status:412};
  }catch(_){return {ok:false,status:412};}
}
export function defiEbay(code, endpoint) {
  return crypto.createHash('sha256').update(String(code)).update(process.env.EBAY_VERIF_TOKEN || '').update(endpoint).digest('hex');
}
