import {useState} from 'react';
const memo=new Map();
const cle=(owner,compte,id)=>'vrm_ebay_reponse_incertaine:'+JSON.stringify([owner,compte,String(id)]);
export function lireReponseIncertaine(owner,compte,id,storage){
 if(!owner || id==null)return false;
 const key=cle(owner,compte,id);
 try{return memo.get(key) ?? (storage || globalThis.sessionStorage).getItem(key)==='1';}catch(_){return memo.get(key) || false;}
}
export function marquerReponseIncertaine(owner,compte,id,value,storage){
 if(!owner || id==null)return false;
 const key=cle(owner,compte,id);memo.set(key,!!value);
 try{const target=storage || globalThis.sessionStorage;if(value)target.setItem(key,'1');else target.removeItem(key);return true;}catch(_){return false;}
}
export function useReponseIncertaine(owner,compte,id){
 const key=JSON.stringify([owner,compte,String(id)]);
 const [state,setState]=useState(()=>({key,value:lireReponseIncertaine(owner,compte,id)}));
 const value=state.key===key?state.value:lireReponseIncertaine(owner,compte,id);
 const marquer=value=>{marquerReponseIncertaine(owner,compte,id,value);setState({key,value});};
 return {value,marquer};
}
