import React,{useState,useEffect,useRef} from 'react';
import { rythme } from './rythmeLectures.js';
import { tr, date as dateI18n, heure as heureI18n } from './i18n/index.js';
import { laissezPasserHorsLigne, noterVerification, effacerLaissezPasser, poserHorsLigne } from './porteHorsLigne.js';
const stockage=()=>{try{return window.localStorage;}catch(_){return null;}};
const horsReseau=()=>{try{return typeof navigator!=='undefined'&&navigator.onLine===false;}catch(_){return false;}};
const heureCourte=(ms)=>{try{const d=new Date(ms);const j=d.toDateString()===new Date().toDateString();return j?heureI18n(d):tr('porte.dateHeure',{date:dateI18n(d,{day:'numeric',month:'short'}),heure:heureI18n(d)});}catch(_){return '';}};
// (9 nov.) Hors ligne à froid : src/porteHorsLigne.js porte la règle, la garde et
// le modèle de menace. Ici : QUAND on la consulte (seulement quand la
// vérification n'a pas pu partir — aucune réponse HTTP), et ce qu'on montre.
export default function PorteConfidentialite({session,onVerifier,onDeconnexion,onRafraichir,theme,children}){
 const signature = session.user?.id || '';
 const [controle,setControle]=useState({signature:'',etat:'verification'}),[tour,setTour]=useState(0);
 // Ouvert hors ligne SANS avoir été vérifié dans cette page : au retour du réseau
 // (vérification réussie), l'app se remonte pour tout relire du serveur.
 const [montage,setMontage]=useState(0);const froid=useRef(true);
 const valide=useRef(onVerifier);valide.current=onVerifier;
 const rafraichir=useRef(onRafraichir);rafraichir.current=onRafraichir;
 const etat=controle.signature===signature?controle.etat:'verification';
 const etatRef=useRef(etat);etatRef.current=etat;
 useEffect(()=>{
  let stop=false,enCours=false;let dernier=0;const ac=new AbortController();
  const passerHorsLigne=()=>{
   const st=stockage();const d=st?laissezPasserHorsLigne({stock:st,session}):{ok:false,raison:'stockage'};
   if(d.ok){poserHorsLigne({uid:signature,at:d.at,abo:d.abo});setControle(c=>c.signature===signature&&c.etat==='ok'?{...c,etat:'hors-ligne',at:d.at,depuisOk:true}:{signature,etat:'hors-ligne',at:d.at});}
   else{poserHorsLigne(null);setControle({signature,etat:'indisponible',raison:d.raison});}
  };
  const verifier=async()=>{
   if(enCours||stop)return;enCours=true;dernier=Date.now();
   const delai=setTimeout(()=>ac.abort(),15000);
   try{
    if(horsReseau()){passerHorsLigne();return;}
    // Un jeton d'accès arrivé à son heure (1 h) n'est pas un refus : on le
    // renouvelle AVANT de demander au serveur (au retour du réseau surtout).
    // Renouvelé ⇒ la session change et l'effet repart ; refusé ⇒ l'app se
    // déconnecte (writeSession(null)) ; « pas su » ⇒ on demande quand même.
    const expire=!(Number(session.expires_at)>Date.now()+30000);
    if(expire&&rafraichir.current){const x=await rafraichir.current();if(stop||x===true||x===false)return;}
    let r;
    try{r=await fetch('/api/compte?mode=confidentialite',{headers:{Authorization:`Bearer ${session.access_token}`},cache:'no-store',signal:ac.signal});}
    catch(_){if(!stop)passerHorsLigne();return;}
    const j=await r.json().catch(()=>null);if(stop)return;
    if(r.ok&&j&&j.ok===true&&j.uid===session.user?.id){
     const st=stockage();if(st)noterVerification(st,session);
     poserHorsLigne(null);valide.current?.(j.uid);
     if(etatRef.current==='hors-ligne'&&froid.current)setMontage(n=>n+1);
     froid.current=false;setControle({signature,etat:'ok'});return;
    }
    // Le serveur a RÉPONDU non : session refusée (compte supprimé, session
    // révoquée — un jeton simplement expiré n'est pas jugé ici) ou séparation
    // non confirmée ⇒ le laissez-passer de cet appareil part. « Pas su » (503
    // `verification-indisponible`) ferme sans l'effacer.
    const refus=(r.status===401&&!expire)||(j&&j.raison==='separation-non-confirmee');
    if(refus){const st=stockage();if(st)effacerLaissezPasser(st,signature);}
    poserHorsLigne(null);
    setControle({signature,etat:j&&j.raison==='separation-non-confirmee'?'protection':'indisponible',raison:refus?'refus':'serveur'});
   }catch(_){if(!stop)passerHorsLigne();}
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
  // (9 nov.) Le réseau revient : la vérification est refaite TOUT DE SUITE.
  const enLigne=()=>{dernier=0;verifier();};
  window.addEventListener('focus',reveil);document.addEventListener('visibilitychange',reveil);window.addEventListener('online',enLigne);
  return()=>{stop=true;ac.abort();clearInterval(minute);finReveil();window.removeEventListener('focus',reveil);document.removeEventListener('visibilitychange',reveil);window.removeEventListener('online',enLigne);};
 },[signature,tour,session.access_token,session.user?.id]);
 // Démonté (déconnexion, autre compte) : plus de mode hors ligne.
 useEffect(()=>()=>poserHorsLigne(null),[]);
 // Même forme pour « ok » et « hors ligne » (le bandeau ou `false` à la même
 // place) : passer de l'un à l'autre ne remonte pas l'app.
 if(etat==='ok'||etat==='hors-ligne')return <React.Fragment key={montage}>
  {etat==='hors-ligne'&&<div role="status" className="vrm-bandeau-abo" data-hors-ligne-froid="" data-hors-ligne-depuis={controle.at||undefined} style={{position:'fixed',top:'max(8px, env(safe-area-inset-top))',left:0,right:0,maxWidth:560,margin:'0 auto',width:'calc(100% - 32px)',zIndex:70}}>
   <span className="vrm-bandeau-abo-point" aria-hidden="true"/>
   <span className="vrm-bandeau-abo-texte"><b>{tr('horsligne.froid.titre')}</b> {tr('horsligne.froid.texte',{heure:heureCourte(controle.at)})}</span>
   <button type="button" className="vrm-bandeau-abo-geste" onClick={()=>setTour(t=>t+1)}>{tr('commun.reessayer')}</button>
  </div>}
  {children}</React.Fragment>;
 return <main data-confidentialite={etat} data-confidentialite-raison={controle.raison||undefined} style={{minHeight:'100dvh',display:'grid',placeItems:'center',background:theme.bg,color:theme.text,padding:20,boxSizing:'border-box'}}><section style={{maxWidth:430,width:'100%',padding:24,border:`1px solid ${theme.border}`,background:theme.card,borderRadius:14,boxSizing:'border-box'}}><img src="/vrm-icon-v5-192.png" alt="VRM" width="44" height="44" style={{borderRadius:12}}/><h1 style={{fontSize:20}}>{tr(etat==='verification'?'porte.verification.titre':etat==='protection'?'porte.protection.titre':'porte.indisponible.titre')}</h1><p role="status" style={{fontSize:15,lineHeight:1.6,color:theme.muted}}>{tr(etat==='verification'?'porte.verification.texte':etat==='protection'?'porte.protection.texte':'porte.indisponible.texte')}</p>{etat==='indisponible'&&controle.raison==='perime'&&<p style={{fontSize:13,lineHeight:1.5,color:theme.muted}}>{tr('porte.perime')}</p>}{etat!=='verification'&&<div style={{display:'flex',gap:8,flexWrap:'wrap'}}><button type="button" onClick={()=>setTour(t=>t+1)} style={{padding:'10px 14px',border:`1px solid ${theme.border}`,borderRadius:12,background:theme.card,color:theme.text}}>{tr('commun.reessayer')}</button><button type="button" onClick={onDeconnexion} style={{padding:'10px 14px',border:`1px solid ${theme.border}`,borderRadius:12,background:theme.card,color:theme.text}}>{tr('porte.deconnecter')}</button></div>}</section></main>;
}
