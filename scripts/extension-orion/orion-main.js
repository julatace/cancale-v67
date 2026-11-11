// Legacy WebExtensions do not provide declarative world:MAIN. Load the existing
// passive captor in the page; never run inject.js in the isolated world.
//
// ⚠️ 5.361 (revue de robustesse, « canal privé moins sûr sur Orion ») — Sur
//    Chrome, inject.js est posé par le manifeste AVANT tout script de la page :
//    le canal privé qu'il remet à content.js est forcément le bon. Ici, une
//    balise `<script src>` se charge PLUS TARD : un script de la page qui
//    tournerait avant pourrait proposer un faux canal le premier. Aucun secret ne
//    peut l'en empêcher (tout ce qu'inject.js sait, un script arrivé avant lui
//    dans la page le sait aussi). La parade sûre :
//    1. d'abord le capteur EN LIGNE (`textContent`, la source copiée dans ce
//       fichier à la fabrication du paquet) : il s'exécute à l'instant même, à
//       document_start, avant toute page — son canal est sûr. On le CONSTATE (une
//       marque tirée au hasard, posée par le capteur, relue aussitôt) ;
//    2. refusé (règle de sécurité de la page) ou pas posé tout de suite ⇒ la
//       balise `<script src>` comme avant, et `__vrmCanalInline = false` :
//       content.js marque alors chaque message « douteux » et le fond refuse
//       tout ce qui écrirait une preuve ou un état (bordereau, suppression,
//       recette, fiche, publication…).
(function(){
 'use strict';
 const SOURCES=null;/*__VRM_SOURCES_PAGE__*/
 const h=location.hostname;
 const fichier=/^(?:www\.)?vinted\.(fr|com|it|de)$/.test(h)?'inject.js':/(^|\.)leboncoin\.fr$/.test(h)?'lbc-inject.js':/(^|\.)vestiairecollective\.com$/.test(h)?'vc-inject.js':null;
 if(!fichier||globalThis.__vrmOrionMain)return;
 globalThis.__vrmOrionMain=true;
 globalThis.__vrmCanalInline=false;
 let observateur=null;
 const enLigne=(racine)=>{
  const src=SOURCES&&typeof SOURCES[fichier]==='string'?SOURCES[fichier]:null;
  const doc=document.documentElement;
  if(!src||!doc)return false;
  const marque='data-vrm-'+Math.random().toString(36).slice(2,12);
  let ok=false;
  try{
   const s=document.createElement('script');
   s.textContent='document.documentElement.setAttribute('+JSON.stringify(marque)+',"1");\n'+src;
   racine.appendChild(s);
   ok=doc.getAttribute(marque)==='1';
   doc.removeAttribute(marque);s.remove();
  }catch(_){ok=false;}
  return ok;
 };
 const poser=(immediat)=>{
  const racine=document.head||document.documentElement;if(!racine)return false;
  observateur?.disconnect();
  if(enLigne(racine)){globalThis.__vrmCanalInline=immediat===true;return true;}
  const s=document.createElement('script');
  s.src=chrome.runtime.getURL(fichier);s.onload=()=>s.remove();
  s.onerror=()=>{s.remove();console.warn('VRM : le capteur de page n’a pas pu être chargé dans ce navigateur.');};
  racine.appendChild(s);return true;
 };
 if(!poser(true)){observateur=new MutationObserver(()=>poser(false));observateur.observe(document,{childList:true,subtree:true});}
})();
