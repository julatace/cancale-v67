import React,{useState,useEffect} from 'react';
const cache=new Map(),enVol=new Map(),abonnes=new Set();
const publier=(owner,v)=>{v={...v,luAt:Date.now()};cache.set(owner,v);for(const f of abonnes)f(owner,v);};
async function charger(owner,headers){
 if(!owner)return null;if(enVol.has(owner))return enVol.get(owner);
 const p=(async()=>{try{const r=await fetch('/api/compte?mode=profil-avatar',{headers:headers(),cache:'no-store',signal:AbortSignal.timeout(20000)});const j=await r.json();if(r.ok&&j.ok){publier(owner,j);return j;}}catch(_){}return null;})();enVol.set(owner,p);try{return await p;}finally{enVol.delete(owner);}
}
function usePhoto(owner,headers){
 const[p,setP]=useState(()=>cache.get(owner)||null);
 useEffect(()=>{setP(cache.get(owner)||null);const f=(u,v)=>{if(u===owner)setP(v);};abonnes.add(f);const relire=()=>{if(!cache.has(owner)||Date.now()-(cache.get(owner).luAt||0)>60000)charger(owner,headers);};relire();window.addEventListener('focus',relire);return()=>{abonnes.delete(f);window.removeEventListener('focus',relire);};},[owner]);return p;
}
export function AvatarCompte({owner,headers,lettre='V'}){
 const p=usePhoto(owner,headers),[rate,setRate]=useState('');const image=p?.image;
 return <>{image&&image!==rate?<img alt="" src={image} onError={()=>setRate(image)} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>:lettre}</>;
}
async function convertirPhoto(file){
 if(!file||file.size>6*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choisis une photo JPEG, PNG ou WebP de moins de 6 Mo.');
 const octets=new Uint8Array(await file.slice(0,16).arrayBuffer());
 const raster=(octets[0]===255&&octets[1]===216)||(octets[0]===137&&octets[1]===80&&octets[2]===78&&octets[3]===71)||(String.fromCharCode(...octets.slice(0,4))==='RIFF'&&String.fromCharCode(...octets.slice(8,12))==='WEBP');
 if(!raster)throw Error('Ce fichier n’est pas une photo JPEG, PNG ou WebP.');
 let source,objet;
 try{if(typeof createImageBitmap==='function')source=await createImageBitmap(file);else{objet=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Photo illisible.'));i.src=objet;});}
  const w=source.width,h=source.height,cote=Math.min(w,h);if(!cote)throw Error('Photo illisible.');
  for(const taille of [160,128,96]){const c=document.createElement('canvas');c.width=c.height=taille;const ctx=c.getContext('2d');ctx.drawImage(source,(w-cote)/2,(h-cote)/2,cote,cote,0,0,taille,taille);const data=c.toDataURL('image/png');if(data.length<106000)return data;}
  throw Error('Cette photo est trop volumineuse. Choisis-en une autre.');
 }finally{source?.close?.();if(objet)URL.revokeObjectURL(objet);}
}
export default function PhotoProfil({owner,headers,theme}){
 const p=usePhoto(owner,headers),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');const t=theme;
 async function enregistrer(image,partageCarte,retirer=false){
  setBusy(true);setMsg('');try{const r=await fetch('/api/compte?mode=profil-avatar',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({image,partageCarte,retirer}),signal:AbortSignal.timeout(25000)});const j=await r.json();if(!r.ok||!j.ok)throw Error(j.message||'L’enregistrement de la photo n’est pas confirmé. Réessaie.');publier(owner,j);setMsg(retirer?'Photo retirée.':'Photo enregistrée.');}catch(e){setMsg(e.name==='TimeoutError'?'L’enregistrement n’est pas confirmé. Rouvre cet écran pour vérifier avant de recommencer.':e.message);}finally{setBusy(false);}
 }
 return <section data-photo-profil style={{margin:'16px 0',padding:16,border:`1px solid ${t.border}`,borderRadius:14,background:t.card,color:t.text}}><div style={{display:'flex',alignItems:'center',gap:14}}><span style={{display:'grid',placeItems:'center',width:54,height:54,borderRadius:'50%',background:t.bg,overflow:'hidden',flexShrink:0,fontSize:18}}><AvatarCompte owner={owner} headers={headers}/></span><div><b style={{fontSize:14}}>Ta photo de profil</b><p style={{fontSize:12,color:t.muted,margin:'4px 0'}}>Facultative.</p></div></div><div style={{display:'flex',alignItems:'center',gap:12,marginTop:12}}><label className="vrm-b vrm-b-secondaire" style={{cursor:busy?'wait':'pointer',position:'relative',overflow:'hidden'}}>{busy?'Enregistrement…':p?.image?'Changer de photo':'Ajouter une photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Choisir une photo de profil" style={{position:'absolute',inset:0,opacity:0,cursor:'inherit',width:'100%',height:'100%'}} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{setBusy(true);const image=await convertirPhoto(f);await enregistrer(image,p?.partageCarte===true);}catch(err){setMsg(err.message);}finally{setBusy(false);}}}/></label>{p?.image&&<button type="button" className="vrm-b vrm-b-discret" disabled={busy} onClick={()=>enregistrer('',false,true)}>Retirer</button>}</div>{p?.image&&<label style={{display:'flex',gap:9,fontSize:12,color:t.muted,lineHeight:1.5,marginTop:14}}><input type="checkbox" checked={p.partageCarte===true} disabled={busy} onChange={e=>enregistrer(p.image,e.target.checked)}/><span>Utiliser cette photo sur la carte et le classement si j’y suis inscrit. Sinon, garder mon avatar Discord.</span></label>}{msg&&<p role="status" style={{fontSize:12,color:t.muted,marginBottom:0}}>{msg}</p>}</section>;
}
