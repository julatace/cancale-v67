import crypto from 'node:crypto';
import {utilisateurDe} from './session.js';import {lirePrive,casPrive,prendreQuota,empreintePrivee,requetePrivee} from './stockage-prive.js';
const idDe=u=>'profil_avatar_'+empreintePrivee(u),uuid=/^[0-9a-f-]{36}$/i;
export function pngProfilValide(data){
 if(typeof data!=='string'||data.length>110000||!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))return null;
 const b=Buffer.from(data.slice(22),'base64');if(b.length>80000||b.length<45||!b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))return null;
 if(b.toString('ascii',12,16)!=='IHDR'||b.readUInt32BE(8)!==13)return null;
 const w=b.readUInt32BE(16),h=b.readUInt32BE(20);if(w<1||h<1||w>256||h>256)return null;
 let i=8,fin=false;while(i+12<=b.length){const n=b.readUInt32BE(i);if(n>b.length-i-12)return null;const t=b.toString('ascii',i+4,i+8);i+=n+12;if(t==='IEND'){fin=n===0&&i===b.length;break;}}
 return fin?b:null;
}
const signature=(pid,v,exp)=>crypto.createHmac('sha256','vrm-avatar-public|'+String(process.env.SUPABASE_SERVICE_KEY||'')).update([pid,v,exp].join('|')).digest('hex');
export function urlPhotoPublique(pid,v,maintenant=Date.now()){
 if(!uuid.test(pid)||!/^[0-9a-f]{64}$/.test(v)||!process.env.SUPABASE_SERVICE_KEY)return '';
 const exp=Math.ceil(maintenant/300000)*300000+300000;return`/api/compte?mode=avatar-public&pid=${pid}&v=${v}&exp=${exp}&signature=${signature(pid,v,exp)}`;
}
export function verifierUrlPhoto(q,maintenant=Date.now()){
 const p=String(q?.pid||''),v=String(q?.v||''),e=String(q?.exp||''),s=String(q?.signature||'');
 if(!process.env.SUPABASE_SERVICE_KEY||!uuid.test(p)||!/^[0-9a-f]{64}$/.test(v)||!/^\d{13}$/.test(e)||!(/^[0-9a-f]{64}$/.test(s))||Number(e)<=maintenant||Number(e)>maintenant+600000)return false;
 return crypto.timingSafeEqual(Buffer.from(s),Buffer.from(signature(p,v,e)));
}
export async function lierPhotoAuProfil(owner,pid){
 if(!uuid.test(pid||''))return;const id=idDe(owner),d=await lirePrive(id);
 if(!d?.image||!d.partageCarte||d.pid===pid)return;await casPrive(id,d,{...d,pid});
}
export async function retirerPhotoDeCarte(owner){const id=idDe(owner),d=await lirePrive(id);if(d?.pid)await casPrive(id,d,{...d,pid:''});}
export async function ajouterPhotosPersonnelles(profils){
 if(!process.env.SUPABASE_SERVICE_KEY||!Array.isArray(profils))return profils;const photos=new Map(),pids=[...new Set(profils.map(p=>p.pid).filter(p=>uuid.test(p||'')))];
 for(let i=0;i<pids.length;i+=100){try{const rows=await requetePrivee(`id=like.profil_avatar_*&data->>pid=in.(${pids.slice(i,i+100).join(',')})&data->>partageCarte=eq.true&select=pid:data->>pid,hash:data->>hash&limit=100`);for(const d of rows){const u=urlPhotoPublique(d.pid,d.hash);if(u)photos.set(d.pid,u);}}catch(_){}}
 return profils.map(p=>photos.has(p.pid)?{...p,avatar:photos.get(p.pid)}:p);
}
export async function routeAvatarPublic(req,res){
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 if(req.method!=='GET'||!verifierUrlPhoto(req.query))return res.status(404).end();
 try{const q=req.query,rows=await requetePrivee(`id=like.profil_avatar_*&data->>pid=eq.${encodeURIComponent(q.pid)}&data->>hash=eq.${q.v}&data->>partageCarte=eq.true&select=data&limit=2`);const d=rows.length===1?rows[0].data:null;const image=pngProfilValide(d?.image);
  if(!image||empreintePrivee(image)!==q.v)return res.status(404).end();
  res.setHeader('Cache-Control','public,max-age=60,s-maxage=60');res.setHeader('Content-Type','image/png');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");return res.status(200).end(image);
 }catch(_){return res.status(503).end();}
}
export async function routeProfilAvatar(req,res){
 res.setHeader('Cache-Control','no-store');if(!['GET','POST'].includes(req.method))return res.status(405).json({ok:false});
 const u=await utilisateurDe(req);if(!u)return res.status(401).json({ok:false});
 try{const id=idDe(u.id);if(req.method==='GET'){const d=await lirePrive(id);return res.status(200).json({ok:true,image:pngProfilValide(d?.image)?d.image:'',partageCarte:d?.partageCarte===true});}
  let b;try{b=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch(_){}if(!b||(!b.retirer&&!pngProfilValide(b.image)))return res.status(400).json({ok:false,message:'Choisis une photo PNG, JPEG ou WebP depuis ton appareil.'});
  const q=await prendreQuota(u.id+'|profil-avatar',{max:12});if(!q.ok){res.setHeader('Retry-After',String(q.reessayer));return res.status(429).json({ok:false,message:'Trop de changements de photo. Réessaie plus tard.'});}
  const image=b.retirer?'':b.image,hash=image?empreintePrivee(pngProfilValide(image)):'';
  for(let i=0;i<6;i++){const d=await lirePrive(id);const next=await casPrive(id,d,{image,hash,partageCarte:!b.retirer&&b.partageCarte===true,pid:d?.pid||'',at:new Date().toISOString()});if(next)return res.status(200).json({ok:true,image,partageCarte:next.partageCarte});}
  return res.status(503).json({ok:false,message:'La photo a changé au même moment. Réessaie.'});
 }catch(_){return res.status(503).json({ok:false,message:'La photo n’a pas pu être enregistrée. Réessaie dans un moment.'});}
}

export const lignesPriveesProfil=owner=>[idDe(owner),'quota_v1_'+empreintePrivee(owner+'|profil-avatar'),'discord_attente_'+empreintePrivee(owner)];
