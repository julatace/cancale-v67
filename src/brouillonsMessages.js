// Les brouillons de réponse, cloisonnés par vendeur VRM, compte et conversation.
// Gardés dans l'ONGLET (sessionStorage) : jamais poussés dans le nuage — c'est
// le texte d'un message privé (mode stream, §5) — et perdus à la fermeture de
// l'onglet. Effacés seulement après un envoi CONFIRMÉ (`effacerBrouillonSiIdentique`).
// Une seule règle pour eBay et Vinted (§11) : la clé porte la plateforme, et les
// clés eBay d'avant (`vrm_ebay_brouillon:`) restent lues telles quelles.
const cle=(famille,owner,compte,id)=>`vrm_${famille}_brouillon:`+JSON.stringify([owner,compte,String(id)]);
function lire(famille,owner,compte,id,storage){
 if(!owner || id==null)return '';
 try{storage=storage || globalThis.sessionStorage;const v=JSON.parse(storage.getItem(cle(famille,owner,compte,id)) || 'null');return typeof v?.body==='string'?v.body:'';}catch(_){return '';}
}
function sauver(famille,owner,compte,id,body,storage){
 if(!owner || id==null)return false;
 try{storage=storage || globalThis.sessionStorage;if(body)storage.setItem(cle(famille,owner,compte,id),JSON.stringify({body,at:Date.now()}));else storage.removeItem(cle(famille,owner,compte,id));return true;}catch(_){return false;}
}
function effacerSiIdentique(famille,owner,compte,id,texte,storage){
 return lire(famille,owner,compte,id,storage)===texte?sauver(famille,owner,compte,id,'',storage):false;
}
export function lireBrouillon(owner,compte,id,storage){return lire('ebay',owner,compte,id,storage);}
export function sauverBrouillon(owner,compte,id,body,storage){return sauver('ebay',owner,compte,id,body,storage);}
export function effacerBrouillonSiIdentique(owner,compte,id,texte,storage){return effacerSiIdentique('ebay',owner,compte,id,texte,storage);}
// Vinted (15 octobre) : « brouillons, envoyés et erreurs plus clairs ». Avant,
// changer de fil effaçait la réponse en cours (`setReplyText('')`).
export const brouillonsVinted={
 lire:(owner,compte,id,storage)=>lire('vinted',owner,compte,id,storage),
 sauver:(owner,compte,id,body,storage)=>sauver('vinted',owner,compte,id,body,storage),
 effacerSiIdentique:(owner,compte,id,texte,storage)=>effacerSiIdentique('vinted',owner,compte,id,texte,storage),
};
// ── LES ENVOIS INCERTAINS, GARDÉS COMME LES BROUILLONS (revue du 15 octobre) ──
// Un envoi sans réponse (délai, 5xx) a PU partir : le renvoi est bloqué jusqu'à
// la relecture du fil. Cette marque vivait dans un `useState` de l'écran — perdue
// dès qu'on quittait Messages ou rechargeait la page, alors que le BROUILLON
// (même texte) revenait dans le champ : une touche Entrée renvoyait le message
// (mesuré : « 1 → 2 envois »). Elle vit donc au MÊME endroit que le brouillon
// (l'onglet, jamais le nuage — c'est le texte d'un message privé), sous la même
// identité (vendeur, compte, fil). `{texte, brut, at, avant, relu?}`.
const cleIncertain=(owner,compte,id)=>'vrm_vinted_incertain:'+JSON.stringify([owner,compte,String(id)]);
export const incertainsVinted={
 lire(owner,compte,id,storage){
  if(!owner || id==null)return null;
  try{storage=storage || globalThis.sessionStorage;const v=JSON.parse(storage.getItem(cleIncertain(owner,compte,id)) || 'null');return v && typeof v.texte==='string'?v:null;}catch(_){return null;}
 },
 poser(owner,compte,id,valeur,storage){
  if(!owner || id==null)return false;
  try{storage=storage || globalThis.sessionStorage;storage.setItem(cleIncertain(owner,compte,id),JSON.stringify(valeur));return true;}catch(_){return false;}
 },
 lever(owner,compte,id,storage){
  if(!owner || id==null)return false;
  try{storage=storage || globalThis.sessionStorage;storage.removeItem(cleIncertain(owner,compte,id));return true;}catch(_){return false;}
 },
};
