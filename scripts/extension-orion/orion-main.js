// Legacy WebExtensions do not provide declarative world:MAIN. Load the existing
// passive captor in the page; never run inject.js in the isolated world.
(function(){
 'use strict';
 const h=location.hostname;
 const fichier=/^(?:www\.)?vinted\.(fr|com|it|de)$/.test(h)?'inject.js':/(^|\.)leboncoin\.fr$/.test(h)?'lbc-inject.js':/(^|\.)vestiairecollective\.com$/.test(h)?'vc-inject.js':null;
 if(!fichier||globalThis.__vrmOrionMain)return;
 globalThis.__vrmOrionMain=true;
 let observateur=null;
 const poser=()=>{
  const racine=document.head||document.documentElement;if(!racine)return false;
  observateur?.disconnect();const s=document.createElement('script');
  s.src=chrome.runtime.getURL(fichier);s.onload=()=>s.remove();
  s.onerror=()=>{s.remove();console.warn('VRM : le capteur de page n’a pas pu être chargé dans ce navigateur.');};
  racine.appendChild(s);return true;
 };
 if(!poser()){observateur=new MutationObserver(poser);observateur.observe(document,{childList:true,subtree:true});}
})();
