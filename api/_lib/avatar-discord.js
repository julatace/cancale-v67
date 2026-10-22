import crypto from 'node:crypto';
import {identiteDiscord,urlAvatarDiscord,avatarDiscordPermis} from '../../src/communaute/avatarDiscord.js';
import {sbCle} from './cle.js';
const secret=()=>String(process.env.DISCORD_CLIENT_SECRET||'');
const mac=(genre,...v)=>crypto.createHmac('sha256','vrm-discord-avatar|'+genre+'|'+secret()).update(v.map(String).join('|')).digest('hex');
const egal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&crypto.timingSafeEqual(x,y);};
export function signerIdentiteDiscord(owner,pseudo,identite,maintenant=Date.now()){
 const p=identiteDiscord(identite);if(!p||!secret())return '';
 const charge=Buffer.from(JSON.stringify({at:maintenant,...p})).toString('base64url');
 return 'a1.'+charge+'.'+mac('oauth',owner.toLowerCase(),pseudo,charge);
}
export function lireIdentiteDiscord(preuve,owner,pseudo,maintenant=Date.now()){
 if(!secret()||typeof preuve!=='string'||preuve.length>600)return null;
 const m=/^a1\.([A-Za-z0-9_-]+)\.([0-9a-f]{64})$/.exec(preuve);if(!m||!egal(mac('oauth',String(owner).toLowerCase(),pseudo,m[1]),m[2]))return null;
 try{const d=JSON.parse(Buffer.from(m[1],'base64url').toString()),age=maintenant-d.at;return age>=-60000&&age<=15*60000?identiteDiscord(d):null;}catch(_){return null;}
}
export function signerAvatarPublic(owner,discord,pid,avatar){
 if(!secret()||!avatarDiscordPermis(avatar))return '';
 return mac('public',owner,discord,pid||'',avatar);
}
export function avatarPublicVerifie(owner,d){
 return !!(secret()&&d&&avatarDiscordPermis(d.avatar)&&typeof d.signatureAvatar==='string'&&egal(signerAvatarPublic(owner,d.discord,d.pid,d.avatar),d.signatureAvatar));
}
// Données projetées seulement, bornées par les PID déjà autorisés par la RPC.
// Une ligne écrite par un client ne devient jamais une preuve d'identité.
export async function ajouterAvatars(profils,f=fetch){
 const cle=process.env.SUPABASE_SERVICE_KEY;if(!cle||!secret()||!Array.isArray(profils))return profils;
 const pids=[...new Set(profils.map(p=>String(p.pid||'')).filter(p=>/^[0-9a-f-]{36}$/i.test(p)))];
 const cartes=new Map();const url=process.env.SUPABASE_URL||'https://lgonxzrzjcqthjtbdpzo.supabase.co';
 // Quatre requêtes au plus en vol, 100 profils par requête (jusqu'à 2000).
 for(let i=0;i<pids.length;i+=400){await Promise.all(pids.slice(i,i+400).reduce((a,p,j)=>{if(j%100===0)a.push([]);a[a.length-1].push(p);return a;},[]).map(async lot=>{
  try{const r=await f(`${url}/rest/v1/app_data?id=eq.vrm_discord&data->>pid=in.(${lot.join(',')})&select=owner,discord:data->>discord,pid:data->>pid,avatar:data->>avatar,signatureAvatar:data->>signatureAvatar&limit=1000`,{headers:sbCle(cle),signal:AbortSignal.timeout(6000)});if(!r.ok)return;const rows=await r.json();if(!Array.isArray(rows))return;
   for(const d of rows){if(lot.includes(d.pid)&&avatarPublicVerifie(d.owner,d))cartes.set(d.pid,{avatar:d.avatar,discord:d.discord});}
  }catch(_){} // L'avatar est facultatif : une panne ne cache pas la carte.
 }));}
 return profils.map(p=>{const d=cartes.get(p.pid);return d&&(!p.discord||p.discord===d.discord)?{...p,avatar:d.avatar}:p;});
}
export {urlAvatarDiscord};
