import React,{useState,useEffect} from 'react';
import {createPortal} from 'react-dom';
import {choisirAvatar} from './identiteProfil.js';
// ── LA PHOTO DE PROFIL ET « MASQUER MON NOM » ─────────────────────────────────
// Une ligne PRIVÉE par compte (`profil_avatar_*`, api/_lib/profil-avatar.js) : la
// photo téléversée (PNG ≤ 256 px, jamais dans `main`) et `nomMasque`. (11 nov., lot
// DJ6) La photo de l'identité Discord/Google reliée prend la place de l'initiale
// (src/profil/identiteProfil.js) ; la fiche GoTrue est lue par `poserLecteurFiche`.
const cache=new Map(),enVol=new Map(),abonnes=new Set();
const publier=(owner,v)=>{v={...(cache.get(owner)||{}),...v,luAt:Date.now()};cache.set(owner,v);for(const f of abonnes)f(owner,v);};
async function charger(owner,headers){
 if(!owner)return null;if(enVol.has(owner))return enVol.get(owner);
 // (11 nov., lot DJ6) La photo déjà en mémoire ⇒ `si=<empreinte>` : le serveur répond
 // `inchange` sans la renvoyer (relue à chaque retour sur l'onglet, §4.4).
 const avant=cache.get(owner),si=avant&&avant.lu&&avant.image&&/^[0-9a-f]{64}$/.test(avant.hash||'')?'&si='+avant.hash:'';
 const p=(async()=>{try{const r=await fetch('/api/compte?mode=profil-avatar'+si,{headers:headers(),cache:'no-store',signal:AbortSignal.timeout(20000)});const j=await r.json();if(r.ok&&j.ok){if(j.inchange===true&&si&&j.hash===avant.hash)publier(owner,{partageCarte:j.partageCarte===true,nomMasque:j.nomMasque===true,lu:true});else publier(owner,{image:j.image||'',hash:j.hash||'',partageCarte:j.partageCarte===true,nomMasque:j.nomMasque===true,lu:true});return j;}}catch(_){}return null;})();enVol.set(owner,p);try{return await p;}finally{enVol.delete(owner);}
}
// La fiche GoTrue (identités reliées), lue par l'app (App.jsx pose le lecteur).
let lecteurFiche=null;const fiches=new Map(),fichesVol=new Map(),abonnesFiche=new Set();
export function poserLecteurFiche(fn){lecteurFiche=typeof fn==='function'?fn:null;}
export function relireFiche(owner){fiches.delete(owner);return chargerFiche(owner);}
async function chargerFiche(owner){
 if(!owner||!lecteurFiche)return null;if(fichesVol.has(owner))return fichesVol.get(owner);
 const p=(async()=>{try{const f=await lecteurFiche();if(f&&typeof f==='object'){fiches.set(owner,{fiche:f,luAt:Date.now()});for(const g of abonnesFiche)g(owner,f);return f;}}catch(_){}return null;})();
 fichesVol.set(owner,p);try{return await p;}finally{fichesVol.delete(owner);}
}
export function useFiche(owner){
 const[f,setF]=useState(()=>fiches.get(owner)?.fiche||null);
 useEffect(()=>{setF(fiches.get(owner)?.fiche||null);const g=(u,v)=>{if(u===owner)setF(v);};abonnesFiche.add(g);const e=fiches.get(owner);if(!e||Date.now()-e.luAt>60000)chargerFiche(owner);return()=>{abonnesFiche.delete(g);};},[owner]);
 return f;
}
function usePhoto(owner,headers){
 const[p,setP]=useState(()=>cache.get(owner)||null);
 useEffect(()=>{setP(cache.get(owner)||null);const f=(u,v)=>{if(u===owner)setP(v);};abonnes.add(f);const relire=()=>{if(!cache.has(owner)||Date.now()-(cache.get(owner).luAt||0)>60000)charger(owner,headers);};relire();window.addEventListener('focus',relire);return()=>{abonnes.delete(f);window.removeEventListener('focus',relire);};},[owner]);return p;
}
export const useProfilCompte=usePhoto;
// `true` / `false` (lu) · `undefined` (pas encore lu : on ne montre PAS le nom en attendant).
export function useNomMasque(owner,headers){const p=usePhoto(owner,headers);return p&&p.lu?p.nomMasque===true:undefined;}
export async function poserNomMasque(owner,headers,masque){
 const r=await fetch('/api/compte?mode=profil-avatar',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({nomMasque:!!masque}),signal:AbortSignal.timeout(20000)});
 const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.message||'Le réglage n’est pas confirmé. Réessaie.');
 publier(owner,{image:j.image||'',hash:j.hash||'',partageCarte:j.partageCarte===true,nomMasque:j.nomMasque===true,lu:true});return j.nomMasque===true;
}
// La photo à montrer et sa source (data-avatar-source : televersee · discord · google · initiale).
export function AvatarCompte({owner,headers,lettre='V'}){
 const p=usePhoto(owner,headers),fiche=useFiche(owner),[rate,setRate]=useState('');
 const a=choisirAvatar({televersee:p?.image,fiche});const url=a.url&&a.url!==rate?a.url:'';
 return <span data-avatar-source={url?a.source:'initiale'} style={{display:'contents'}}>{url?<img alt="" src={url} referrerPolicy="no-referrer" onError={()=>setRate(a.url)} style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:'inherit'}}/>:lettre}</span>;
}
function lireFichier(file){
 return (async()=>{
  if(!file||file.size>6*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choisis une photo JPEG, PNG ou WebP de moins de 6 Mo.');
  const octets=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const raster=(octets[0]===255&&octets[1]===216)||(octets[0]===137&&octets[1]===80&&octets[2]===78&&octets[3]===71)||(String.fromCharCode(...octets.slice(0,4))==='RIFF'&&String.fromCharCode(...octets.slice(8,12))==='WEBP');
  if(!raster)throw Error('Ce fichier n’est pas une photo JPEG, PNG ou WebP.');
  const objet=URL.createObjectURL(file);
  try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(Error('Photo illisible.'));i.src=objet;});if(!img.naturalWidth||!img.naturalHeight)throw Error('Photo illisible.');return {img,objet};}
  catch(e){URL.revokeObjectURL(objet);throw e;}
 })();
}
// Le carré choisi (zoom ≥ 1, décalage en fraction de la marge) → PNG ≤ 256 px, < 106 000 caractères.
export function rendreCarre(img,{zoom=1,dx=0,dy=0}={}){
 const w=img.naturalWidth||img.width,h=img.naturalHeight||img.height,cote=Math.min(w,h)/Math.max(1,zoom);
 const sx=(w-cote)/2*(1+Math.max(-1,Math.min(1,dx))),sy=(h-cote)/2*(1+Math.max(-1,Math.min(1,dy)));
 for(const taille of [256,224,192,160,128,96]){const c=document.createElement('canvas');c.width=c.height=taille;const ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(img,sx,sy,cote,cote,0,0,taille,taille);const data=c.toDataURL('image/png');if(data.length<106000)return data;}
 throw Error('Cette photo est trop volumineuse. Choisis-en une autre.');
}
// Le RECADRAGE : un carré, glisser pour placer, curseur pour zoomer. Rien n'est envoyé avant « Enregistrer ».
function Recadrage({source,theme:t,onAnnuler,onValider}){
 const[zoom,setZoom]=useState(1),[pos,setPos]=useState({dx:0,dy:0}),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 const glisse=React.useRef(null),CADRE=240;
 const img=source.img,w=img.naturalWidth,h=img.naturalHeight,cote=Math.min(w,h)/zoom,ech=CADRE/cote;
 const sx=(w-cote)/2*(1+pos.dx),sy=(h-cote)/2*(1+pos.dy);
 const bouger=(e)=>{const g=glisse.current;if(!g)return;const mx=(w-cote)/2,my=(h-cote)/2;const ddx=(e.clientX-g.x)/ech,ddy=(e.clientY-g.y)/ech;setPos({dx:mx>0?Math.max(-1,Math.min(1,g.dx-ddx/mx)):0,dy:my>0?Math.max(-1,Math.min(1,g.dy-ddy/my)):0});};
 useEffect(()=>{const k=e=>{if(e.key==='Escape')onAnnuler();};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k);},[onAnnuler]);
 return createPortal(<div data-recadrage="" role="dialog" aria-modal="true" aria-label="Recadrer ta photo" onClick={onAnnuler} onPointerDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onMouseDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} style={{position:'fixed',inset:0,zIndex:2147483000,background:'rgba(0,0,0,.45)',display:'grid',placeItems:'center',padding:16}}>
  <div onClick={e=>e.stopPropagation()} style={{background:t.card,color:t.text,borderRadius:18,padding:20,width:'min(100%,320px)',boxSizing:'border-box',display:'grid',gap:14,justifyItems:'center'}}>
   <b style={{fontSize:17}}>Recadrer ta photo</b>
   <div data-recadrage-cadre="" onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);glisse.current={x:e.clientX,y:e.clientY,...pos};}} onPointerMove={bouger} onPointerUp={()=>{glisse.current=null;}} onPointerCancel={()=>{glisse.current=null;}}
    style={{width:CADRE,height:CADRE,borderRadius:'50%',overflow:'hidden',position:'relative',touchAction:'none',cursor:'grab',background:t.bg,boxShadow:`0 0 0 1px ${t.border}`}}>
    <img alt="" src={source.objet} draggable={false} style={{position:'absolute',left:-sx*ech,top:-sy*ech,width:w*ech,height:h*ech,maxWidth:'none',userSelect:'none',pointerEvents:'none'}}/>
   </div>
   <label style={{display:'flex',alignItems:'center',gap:10,width:'100%',fontSize:13,color:t.muted}}>Zoom<input type="range" min="1" max="3" step="0.05" value={zoom} aria-label="Zoom" onChange={e=>setZoom(Number(e.target.value))} style={{flex:1,minHeight:44}}/></label>
   {err&&<p role="alert" style={{fontSize:13,margin:0}}>{err}</p>}
   <div style={{display:'flex',gap:10,width:'100%'}}>
    <button type="button" className="vrm-b vrm-b-discret" style={{flex:1}} disabled={busy} onClick={onAnnuler}>Annuler</button>
    <button type="button" className="vrm-b vrm-b-primaire" style={{flex:1}} data-recadrage-valider="" disabled={busy} onClick={async()=>{setBusy(true);setErr('');try{await onValider(rendreCarre(img,{zoom,...pos}));}catch(e){setErr(e.message);setBusy(false);}}}>{busy?'Enregistrement…':'Enregistrer'}</button>
   </div>
  </div>
 </div>,document.body);
}
// Le bouton « Ajouter / Changer de photo » + recadrage + « Retirer ma photo ».
export function ChoixPhoto({owner,headers,theme,surFait,compact=false}){
 const p=usePhoto(owner,headers),[busy,setBusy]=useState(false),[msg,setMsg]=useState(''),[source,setSource]=useState(null);const t=theme;
 useEffect(()=>()=>{if(source)URL.revokeObjectURL(source.objet);},[source]);
 async function enregistrer(image,partageCarte,retirer=false){
  setBusy(true);setMsg('');try{const r=await fetch('/api/compte?mode=profil-avatar',{method:'POST',headers:{...headers(),'Content-Type':'application/json'},body:JSON.stringify({image,partageCarte,retirer}),signal:AbortSignal.timeout(25000)});const j=await r.json();if(!r.ok||!j.ok)throw Error(j.message||'L’enregistrement de la photo n’est pas confirmé. Réessaie.');publier(owner,{image:j.image||'',hash:j.hash||'',partageCarte:j.partageCarte===true,nomMasque:j.nomMasque===true,lu:true});setMsg(retirer?'Photo retirée.':'Photo enregistrée.');surFait?.();}catch(e){setMsg(e.name==='TimeoutError'?'L’enregistrement n’est pas confirmé. Rouvre cet écran pour vérifier avant de recommencer.':e.message);throw e;}finally{setBusy(false);}
 }
 return <>
  <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
   <label className="vrm-b vrm-b-secondaire" style={{cursor:busy?'wait':'pointer',position:'relative',overflow:'hidden'}}>{busy?'Enregistrement…':p?.image?'Changer de photo':'Ajouter une photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} aria-label="Choisir une photo de profil" style={{position:'absolute',inset:0,opacity:0,cursor:'inherit',width:'100%',height:'100%'}} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;setMsg('');try{setSource(await lireFichier(f));}catch(err){setMsg(err.message);}}}/></label>
   {p?.image&&<button type="button" className="vrm-b vrm-b-discret" disabled={busy} data-photo-retirer="" onClick={()=>enregistrer('',false,true).catch(()=>{})}>Retirer ma photo</button>}
  </div>
  {!compact&&p?.image&&<label style={{display:'flex',gap:9,fontSize:12,color:t.muted,lineHeight:1.5,marginTop:14}}><input type="checkbox" checked={p.partageCarte===true} disabled={busy} onChange={e=>enregistrer(p.image,e.target.checked).catch(()=>{})}/><span>Utiliser cette photo sur la carte et le classement si j’y suis inscrit. Sinon, garder mon avatar Discord.</span></label>}
  {msg&&<p role="status" style={{fontSize:12,color:t.muted,marginBottom:0}}>{msg}</p>}
  {source&&<Recadrage source={source} theme={t} onAnnuler={()=>setSource(null)} onValider={async image=>{await enregistrer(image,p?.partageCarte===true);setSource(null);}}/>}
 </>;
}
// (5 nov., chantier H — revue 2.31) `nu` : posée DANS la carte du profil, sans sa
// propre carte ni son avatar (il était dessiné deux fois sur « Mon compte »).
export default function PhotoProfil({owner,headers,theme,lettre='V',nu=false}){
 const t=theme;
 return <section data-photo-profil={nu?'nu':''} style={nu?{margin:'14px 0 0',paddingTop:14,borderTop:`1px solid ${t.border}`,color:t.text}:{margin:'16px 0',padding:16,border:`1px solid ${t.border}`,borderRadius:14,background:t.card,color:t.text}}>{nu?null:<div style={{display:'flex',alignItems:'center',gap:14,marginBottom:12}}><span style={{display:'grid',placeItems:'center',width:54,height:54,borderRadius:'50%',background:t.bg,overflow:'hidden',flexShrink:0,fontSize:17}}><AvatarCompte owner={owner} headers={headers} lettre={lettre}/></span><div><b style={{fontSize:15}}>Ta photo de profil</b><p style={{fontSize:12,color:t.muted,margin:'4px 0'}}>Facultative.</p></div></div>}<ChoixPhoto owner={owner} headers={headers} theme={t}/></section>;
}
