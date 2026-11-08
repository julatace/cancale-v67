import React,{useState,useEffect,useRef} from 'react';
import { rythme } from './rythmeLectures.js';
export default function PorteConfidentialite({session,onVerifier,onDeconnexion,theme,children}){
 const signature = session.user?.id || '';
 const [controle,setControle]=useState({signature:'',etat:'verification'}),[tour,setTour]=useState(0);
 const valide=useRef(onVerifier);valide.current=onVerifier;
 const etat=controle.signature===signature?controle.etat:'verification';
 useEffect(()=>{
  let stop=false,enCours=false;let dernier=0;const ac=new AbortController();
  const verifier=async()=>{
   if(enCours||stop)return;enCours=true;dernier=Date.now();
   const delai=setTimeout(()=>ac.abort(),15000);
   try{
    const r=await fetch('/api/compte?mode=confidentialite',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store',signal:ac.signal});
    const j=await r.json();if(stop)return;
    if(r.ok&&j.ok===true&&j.uid===session.user?.id){valide.current?.(j.uid);setControle({signature,etat:'ok'});}
    else setControle({signature,etat:j.raison==='separation-non-confirmee'?'protection':'indisponible'});
   }catch(_){if(!stop)setControle({signature,etat:'indisponible'});}
   finally{clearTimeout(delai);enCours=false;}
  };
  verifier();
  const reveil=()=>{if(document.visibilityState!=='hidden'&&Date.now()-dernier>60000)verifier();};
  // (6 nov., charge) Le contrôle périodique suit le rythme commun
  // (src/rythmeLectures.js) : chaque minute quand on s'en sert, toutes les 5 min
  // quand personne n'y touche depuis 10 min, jamais onglet caché ; le retour sur
  // l'onglet (focus, visibilité) et le geste qui revient le refont aussitôt.
  const minute=setInterval(()=>{if(rythme().doitLire('confidentialite',60000))reveil();},60000);
  const finReveil=rythme().surReveil(reveil);
  window.addEventListener('focus',reveil);document.addEventListener('visibilitychange',reveil);
  return()=>{stop=true;ac.abort();clearInterval(minute);finReveil();window.removeEventListener('focus',reveil);document.removeEventListener('visibilitychange',reveil);};
 },[signature,tour,session.access_token,session.user?.id]);
 if(etat==='ok')return children;
 return <main data-confidentialite={etat} style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:theme.bg,color:theme.text,padding:20,boxSizing:'border-box'}}><section style={{maxWidth:430,width:'100%',padding:24,border:`1px solid ${theme.border}`,background:theme.card,borderRadius:14,boxSizing:'border-box'}}><img src="/vrm-icon-v5-192.png" alt="VRM" width="44" height="44" style={{borderRadius:12}}/><h1 style={{fontSize:20}}>{etat==='verification'?'Vérification de ta boutique':etat==='protection'?'Accès temporairement protégé':'Vérification indisponible'}</h1><p role="status" style={{fontSize:15,lineHeight:1.6,color:theme.muted}}>{etat==='verification'?'Nous vérifions la séparation des données avant d’ouvrir ton espace.':etat==='protection'?'La séparation des boutiques n’a pas pu être confirmée. Les données ne sont pas affichées dans cet écran. L’administrateur doit vérifier les droits de la base.':'Le contrôle d’accès n’a pas abouti. Réessaie lorsque la connexion est disponible.'}</p>{etat!=='verification'&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>setTour(t=>t+1)} style={{padding:'10px 14px',border:`1px solid ${theme.border}`,borderRadius:12,background:theme.card,color:theme.text}}>Réessayer</button><button type="button" onClick={onDeconnexion} style={{padding:'10px 14px',border:`1px solid ${theme.border}`,borderRadius:12,background:theme.card,color:theme.text}}>Se déconnecter</button></div>}</section></main>;
}
