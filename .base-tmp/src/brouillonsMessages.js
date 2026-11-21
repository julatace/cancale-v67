const cle=(owner,compte,id)=>'vrm_ebay_brouillon:'+JSON.stringify([owner,compte,String(id)]);
export function lireBrouillon(owner,compte,id,storage){
 if(!owner || id==null)return '';
 try{storage=storage || globalThis.sessionStorage;const v=JSON.parse(storage.getItem(cle(owner,compte,id)) || 'null');return typeof v?.body==='string'?v.body:'';}catch(_){return '';}
}
export function sauverBrouillon(owner,compte,id,body,storage){
 if(!owner || id==null)return false;
 try{storage=storage || globalThis.sessionStorage;if(body)storage.setItem(cle(owner,compte,id),JSON.stringify({body,at:Date.now()}));else storage.removeItem(cle(owner,compte,id));return true;}catch(_){return false;}
}
export function effacerBrouillonSiIdentique(owner,compte,id,texte,storage){
 return lireBrouillon(owner,compte,id,storage)===texte?sauverBrouillon(owner,compte,id,'',storage):false;
}
