(function(){
'use strict';
  // Passive, opt-in recorder in the isolated world. No input/key listeners,
  // request interception, page text, raw URL or network payload is collected.
  let parcoursActif=null,parcoursTimer=null,parcoursObs=null,parcoursPage='';
  const parcoursRoute=v=>{try{
   const u=new URL(v,location.href);if(u.origin!==location.origin)return null;
   const p=u.pathname;
   if(/^\/api\/v\d+\/notifications\/?$/.test(p))return 'api_notifications';
   if(/^\/api\/v\d+\/conversations(?:\/|$)/.test(p))return 'api_conversations';
   if(p.startsWith('/api/'))return null;
   if(/^\/items\/[1-9]\d*\/[a-z_-]+\/new\/?$/.test(p))return 'creation_conversation';
   if(/^\/inbox\/[1-9]\d*\/?$/.test(p))return 'conversation';
   if(/notification/.test(p))return 'notifications';
   if(/^\/items\//.test(p))return 'article';
   if(/^\/member\//.test(p))return 'profil';
   return 'autre';
  }catch{return null;}};
  const parcoursSend=m=>{try{chrome.runtime.sendMessage({from:'vrm-parcours',...m},r=>{void chrome.runtime.lastError;if(r?.actif===false)arreterParcoursPage();});}catch{arreterParcoursPage();}};
  function arreterParcoursPage(){parcoursActif=null;clearInterval(parcoursTimer);parcoursTimer=null;parcoursObs?.disconnect();parcoursObs=null;document.removeEventListener('click',clicParcours,true);document.getElementById('vrm-capture-local')?.remove();}
  function releverParcours(e){if(!parcoursActif)return;if(Date.now()>parcoursActif.fin){arreterParcoursPage();return;}parcoursSend({action:'evenement',nonce:parcoursActif.nonce,evenement:e});}
  function clicParcours(e){
   if(!e.isTrusted||!parcoursActif)return;
   const t=e.target?.closest?.('a,button,[role="button"],[role="link"]')||e.target;
   if(!(t instanceof Element)||t.closest('#vrm-capture-local'))return;
   const tags=['button','a','span','div','svg','path','img','li','article'];
   const a=t.closest('a[href]'),url=a?new URL(a.href,location.href):null;
   const nom=String(t.getAttribute('aria-label')||t.getAttribute('title')||'').toLowerCase();
   const attributs=['aria-label','aria-labelledby','title','href','data-testid','role'].filter(k=>t.hasAttribute(k));
   const params=url?[...url.searchParams.keys()].map(k=>['user_id','opposite_user_id','item_id','notification_id','receiver_id','transaction_id'].includes(k)?k:'autre'):[];
   const dis=getComputedStyle(t).display;
   releverParcours({type:'clic',balise:tags.includes(t.localName)?t.localName:'autre',role:['button','link','listitem'].includes(t.getAttribute('role'))?t.getAttribute('role'):'autre',nom:/^notifications?\b/.test(nom)?'notifications':/favori/.test(nom)?'favori':'autre',affichage:['contents','block','inline','inline-block','flex','grid','none'].includes(dis)?dis:'autre',attributs,route:url?parcoursRoute(url.href)||'autre':'autre',parametres:params,ancres:Math.min(10000,t.querySelectorAll('a[href]').length),exacts:a?Math.min(10000,[...document.querySelectorAll('a[href]')].filter(x=>x.href===a.href).length):0});
  }
  function demarrerParcoursPage(c){
   if(window.top!==window||!/^https:\/\/(?:www\.)?vinted\.(fr|com|it|de)$/.test(location.origin)||typeof c.nonce!=='string'||!/^[a-f0-9-]{36}$/.test(c.nonce)||!Number.isFinite(c.fin)||c.fin<=Date.now()||c.fin>Date.now()+181000)return false;
   arreterParcoursPage();parcoursActif={nonce:c.nonce,fin:c.fin};parcoursPage=location.href;
   document.addEventListener('click',clicParcours,true);
   releverParcours({type:'page',route:parcoursRoute(location.href)||'autre'});
   parcoursTimer=setInterval(()=>{if(!parcoursActif)return;if(Date.now()>parcoursActif.fin){arreterParcoursPage();return;}if(location.href!==parcoursPage){parcoursPage=location.href;releverParcours({type:'page',route:parcoursRoute(location.href)||'autre'});}},400);
   try{parcoursObs=new PerformanceObserver(l=>{for(const r of l.getEntries()){if(!['fetch','xmlhttprequest'].includes(r.initiatorType))continue;const route=parcoursRoute(r.name);if(['api_notifications','api_conversations'].includes(route))releverParcours({type:'requete',route});}});parcoursObs.observe({type:'resource',buffered:false});}catch{}
   const afficher=()=>{if(!parcoursActif||document.getElementById('vrm-capture-local'))return;const box=document.createElement('aside');box.id='vrm-capture-local';box.style.cssText='position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#203b43;color:white;padding:10px 12px;border-radius:8px;font:13px system-ui;max-width:280px';const txt=document.createElement('span');txt.textContent='VRM Capture · Parcours local en cours ';const stop=document.createElement('button');stop.textContent='Arrêter';stop.type='button';stop.style.cssText='margin-left:8px;padding:8px';stop.onclick=()=>{const nonce=parcoursActif?.nonce;arreterParcoursPage();parcoursSend({action:'stop',nonce});};box.append(txt,stop);document.body?.append(box);};
   if(document.body)afficher();else document.addEventListener('DOMContentLoaded',afficher,{once:true});
   return true;
  }
  function traiterCommandeParcours(m,sender,reply){
   if(sender?.id!==chrome.runtime.id||window.top!==window)return false;
   if(m.action==='stop'){arreterParcoursPage();reply({ok:true});return true;}
   if(m.action==='start'){reply({ok:demarrerParcoursPage(m)});return true;}
   return false;
  }
  // Resume only the tab explicitly selected by the user, after a full navigation.
  try{chrome.runtime.sendMessage({from:'vrm-parcours',action:'etat'},r=>{void chrome.runtime.lastError;if(r?.actif===true)demarrerParcoursPage(r);});}catch{}

try{chrome.runtime.onMessage.addListener((m,sender,reply)=>m?.vrm==='parcours'?traiterCommandeParcours(m,sender,reply):false);}catch{}
})();
