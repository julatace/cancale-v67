import {useRef,useState} from 'react';
export const OBJET_COMMANDE='À propos de votre commande';
const cle=(owner,compte,id)=>'vrm_ebay_commande_brouillon:'+JSON.stringify([owner,compte,String(id)]);
const vide=()=>({body:'',subject:OBJET_COMMANDE});
export function lireBrouillonCommande(owner,compte,id,storage){
 if(!owner || id==null)return vide();
 try{const value=JSON.parse((storage || globalThis.sessionStorage).getItem(cle(owner,compte,id)) || 'null');return {body:typeof value?.body==='string'?value.body:'',subject:typeof value?.subject==='string'?value.subject:OBJET_COMMANDE};}catch(_){return vide();}
}
export function sauverBrouillonCommande(owner,compte,id,draft,storage){
 if(!owner || id==null || typeof draft?.body!=='string' || typeof draft?.subject!=='string')return false;
 try{const target=storage || globalThis.sessionStorage;if(!draft.body && draft.subject===OBJET_COMMANDE)target.removeItem(cle(owner,compte,id));else target.setItem(cle(owner,compte,id),JSON.stringify({body:draft.body,subject:draft.subject,at:Date.now()}));return true;}catch(_){return false;}
}
export function useBrouillonCommande(owner,compte,id){
 const key=JSON.stringify([owner,compte,String(id)]);
 const [state,setState]=useState(()=>({key,...lireBrouillonCommande(owner,compte,id),saved:true}));
 const draft=state.key===key?state:{key,...lireBrouillonCommande(owner,compte,id),saved:true};
 const current=useRef(draft);current.current=draft;
 const modifier=patch=>{const next={...current.current,...patch,key};next.saved=sauverBrouillonCommande(owner,compte,id,next);current.current=next;setState(next);};
 const effacerEnvoye=sent=>{if(current.current.key!==key || current.current.body!==sent.body || current.current.subject!==sent.subject)return false;modifier(vide());return true;};
 return {...draft,modifier,effacerEnvoye};
}
