import React,{useState,useEffect} from 'react';
// (5 nov., chantier H) `nu` : posée dans une liste de Réglages — une LIGNE par compte,
// sans sa propre carte (plus de carte dans la carte).
// (11 nov., lot DJ6) Google ET Discord : « Relier » rattache l'identité au compte
// CONNECTÉ (liaison manuelle de Supabase, `preparerLiaisonOAuth`) — jamais un nouveau
// compte. Relié ⇒ « Délier » (sur son clic, confirmé ; refusé s'il ne reste aucune
// autre façon de se connecter). `lire` rend [{fournisseur,id}] · null (pas su).
const normaliser=v=>Array.isArray(v)?v.map(x=>typeof x==='string'?{fournisseur:x,id:''}:x).filter(x=>x&&x.fournisseur):v;
export default function ConnexionsCompte({theme:C,providers,enabled,relier,lire,delier,icone,retour,nu=false}){
 const[busy,setBusy]=useState(''),[message,setMessage]=useState(retour||''),[associes,setAssocies]=useState(undefined),[tour,setTour]=useState(0);
 useEffect(()=>{let stop=false;Promise.resolve(lire?.()).then(v=>{if(!stop)setAssocies(v==null?null:normaliser(v))}).catch(()=>{if(!stop)setAssocies(null)});return()=>{stop=true}},[lire,tour]);
 const autres=Array.isArray(associes)?associes.length:0;
 return <section aria-label="Connexions à VRM">{providers.map(pr=>{const actif=enabled(pr.id),ident=Array.isArray(associes)?associes.find(a=>a.fournisseur===pr.id):null,lie=!!ident;
  const delierIci=async()=>{setBusy(pr.id);setMessage('');try{const r=await delier(pr.id,ident.id,autres);if(r&&r.ok){setMessage(`${pr.label} n’est plus relié à ton compte VRM.`);setTour(t=>t+1);}else if(r&&r.error)setMessage(r.error);}catch(_){setMessage('Le retrait n’a pas pu être confirmé. Réessaie.');}finally{setBusy('');}};
  return <div key={pr.id} data-connexion-compte={pr.id} data-connexion-etat={associes===undefined?'lecture':associes===null?'pas-su':lie?'relie':'aucun'} style={nu?{padding:'10px 14px 10px 16px',minHeight:56,boxSizing:'border-box',color:C.text,display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'center',gap:10}:{padding:14,border:`1px solid ${C.border}`,borderRadius:12,background:C.card,color:C.text,marginBottom:8,display:'grid',gridTemplateColumns:'minmax(0,1fr) auto',alignItems:'center',gap:10}}>
   <div style={{display:'flex',alignItems:'center',gap:10,minWidth:0}}><span aria-hidden="true" style={{width:32,height:32,display:'grid',placeItems:'center',borderRadius:12,background:C.bg}}>{icone?.(pr.id)}</span><span><b style={{fontSize:nu?15:13,fontWeight:nu?600:700}}>{pr.label}</b><span style={{display:'block',fontSize:nu?13:11,color:C.muted,marginTop:2}}>{associes===null?'— pas su (réessaie plus tard)':lie?'Relié : connexion et photo de profil':'Pour te connecter et ta photo de profil'}</span></span></div>
   {lie?(delier?<button type="button" className="vrm-b vrm-b-discret" data-connexion-delier={pr.id} disabled={!!busy} onClick={delierIci}>{busy===pr.id?'…':'Délier'}</button>:<span style={{fontSize:12,color:C.muted}}>Relié</span>)
    :!actif?<span data-connexion-indispo={pr.id} style={{fontSize:12,color:C.muted,fontWeight:600}}>Bientôt</span>
    :associes===null?null
    :<button type="button" className="vrm-b vrm-b-secondaire" data-connexion-relier={pr.id} disabled={!!busy||associes===undefined} onClick={async()=>{setBusy(pr.id);setMessage('');try{const r=await relier(pr.id);if(!r.ok)setMessage(r.error);}catch(_){setMessage('La liaison n’a pas pu démarrer. Réessaie.');}finally{setBusy('');}}} >{busy===pr.id?'Ouverture…':`Relier ${pr.label}`}</button>}
  </div>})}{message&&<p role="alert" style={{fontSize:12,color:C.text,margin:'4px 16px 8px'}}>{message}</p>}</section>;
}
