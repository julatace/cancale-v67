// content.js — tourne dans le monde "isole" de l'extension sur la page vinted.fr.
// Role : (1) injecter inject.js dans le MAIN world pour observer les requetes ;
//        (2) relayer les messages d'inject.js vers le service worker (background)
//            qui, lui, ecrit dans Supabase.
// content.js ne fait AUCUN appel a Vinted.
(function () {
  'use strict';
  const TAG = 'CANCALE_VINTED';

  // Injecte inject.js dans le MAIN world (via un <script> pointant sur la
  // ressource web-accessible de l'extension), en secours du script MAIN posé
  // directement par le manifeste à document_start. Sa garde évite le doublon.
  // ⚠️ 5.162 — LA PAUSE DEMANDÉE PAR VINTED (429/403) VAUT AUSSI POUR LA
  // MOISSON FAITE DANS LA PAGE. Elle est rangée par le fond dans
  // `chrome.storage.local` (`vrmPauseVinted`) ; `inject.js` (monde MAIN) n'y a
  // pas accès : on lui transmet la fin de la pause — un nombre, rien d'autre —
  // une fois qu'il est chargé, puis à chaque changement.
  let injecte = false, pauseFin = null;
  const direPause = () => {
    if (!injecte || pauseFin == null) return;
    try { window.postMessage({ __tag: 'CANCALE_VINTED_PAUSE', jusqua: pauseFin }, '*'); } catch (_) {}
  };
  try {
    chrome.storage.local.get('vrmPauseVinted', (o) => {
      try { pauseFin = Number(((o && o.vrmPauseVinted) || {}).jusqua) || 0; direPause(); } catch (_) {}
    });
    chrome.storage.onChanged.addListener((ch, zone) => {
      try {
        if (zone !== 'local' || !ch || !ch.vrmPauseVinted) return;
        pauseFin = Number((ch.vrmPauseVinted.newValue || {}).jusqua) || 0; direPause();
      } catch (_) {}
    });
  } catch (_) {}

  try {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('inject.js');
    s.onload = function () { this.remove(); injecte = true; direPause(); };
    (document.head || document.documentElement).appendChild(s);
  } catch (_) {}

  // Relaie les messages d'inject.js (csrf + donnees moissonnees) au background.
  // ⚠️⚠️ IL RELAYAIT UNE LISTE DE CHAMPS FIXE, ET JETAIT LE RESTE EN SILENCE.
  // Mesuré le 19 septembre : `inject.js` envoyait bien `reponses` (les codes de
  // réponse HTTP, la mesure qui devait dire si la requête d'export part et se
  // fait refuser) — et ce relais ne recopiait que `paths`. La donnée mourait
  // ici, entre deux fichiers qui avaient tous les deux raison.
  // C'est le défaut de `storeLbcRecon` (qui rangeait clé par clé et perdait
  // `etapes`), exactement, une couche plus tôt. *Un raccord qui énumère ne
  // transporte que ce qu'on a pensé à écrire.*
  // ⇒ On recopie TOUT ce que la page envoie, sauf son étiquette. `from` et
  //   `domain` restent posés par NOUS : la page ne doit pas pouvoir les dicter.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if (!d || d.__tag !== TAG) return;
    if(d.kind==='injectReady'){injecte=true;direPause();return;}
    try {
      const m = {};
      for (const k of Object.keys(d)) {
        if (k === '__tag' || k === 'from' || k === 'domain') continue;
        m[k] = d[k];
      }
      m.from = 'cancale-content';
      m.domain = location.host;
      chrome.runtime.sendMessage(m);
    } catch (_) { /* le service worker peut etre endormi, on ignore */ }
  }, false);

  // ── NAVIGATEUR SANS API `cookies` / SANS MONDE MAIN (20 octobre, Orion) ──
  // (1) Les cookies de session : le fond demande s'il en a besoin (`veux`) —
  //     sur Chrome il répond non et RIEN d'autre ne part. Sinon on lui donne
  //     les trois cookies que la page voit, à l'ouverture puis à chaque
  //     changement (toutes les 10 s tant que la page est visible, et au retour
  //     au premier plan : iOS suspend tout en arrière-plan).
  // (2) Le relais de la page : une requête GET demandée par le fond part
  //     d'inject.js (monde MAIN) et sa réponse revient ici.
  const NOMS = ['access_token_web', 'refresh_token_web', 'anon_id'];
  const lireCookies = () => {
    const c = {};
    try {
      for (const part of String(document.cookie || '').split(';')) {
        const i = part.indexOf('='); if (i < 0) continue;
        const k = part.slice(0, i).trim();
        if (NOMS.includes(k)) { try { c[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { c[k] = part.slice(i + 1).trim(); } }
      }
    } catch (_) {}
    return c;
  };
  let dernierEnvoi = null;
  const envoyerCookies = () => {
    try {
      const c = lireCookies(); const sig = JSON.stringify(c);
      if (sig === dernierEnvoi) return;
      chrome.runtime.sendMessage({ from: 'vrm-cookies', domain: location.hostname, c }, (r) => {
        void (chrome.runtime && chrome.runtime.lastError);
        if (r && r.ok) dernierEnvoi = sig;
      });
    } catch (_) {}
  };
  try {
    chrome.runtime.sendMessage({ from: 'vrm-cookies', action: 'veux' }, (r) => {
      void (chrome.runtime && chrome.runtime.lastError);
      if (!r || !r.veux) return;
      envoyerCookies();
      setInterval(() => { if (document.visibilityState !== 'hidden') envoyerCookies(); }, 10000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { dernierEnvoi = null; envoyerCookies(); } });
    });
  } catch (_) {}

  // 5.294 : l'onglet Vinted redevient visible ⇒ le fond décide s'il relit
  // (`retourSurVinted` : plus de 3 min depuis la dernière lecture complète, au
  // plus une fois par 3 min, tous les garde-fous). 1,5 s d'attente : sur Orion,
  // les cookies que la page renvoie au même moment arrivent d'abord.
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !/(^|\.)vinted\.[a-z.]+$/i.test(location.hostname)) return;
      setTimeout(() => {
        try { if (document.visibilityState === 'visible') chrome.runtime.sendMessage({ from: 'vrm-retour', action: 'vintedVisible' }, () => { void (chrome.runtime && chrome.runtime.lastError); }); } catch (_) {}
      }, 1500);
    });
  } catch (_) {}

  const enAttente = new Map();
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.__tag !== 'CANCALE_VINTED_REP') return;
    const f = enAttente.get(String(event.data.id || ''));
    if (f) { enAttente.delete(String(event.data.id)); f(event.data); }
  }, false);
  const demanderPage = (req) => new Promise((res) => {
    const id = String((req && req.id) || '');
    if (!id || !/(^|\.)vinted\.[a-z.]+$/i.test(location.hostname)) { res(null); return; }
    const t = setTimeout(() => { enAttente.delete(id); res(null); }, 20000);
    enAttente.set(id, (d) => { clearTimeout(t); res({ id, status: d.status, ok: d.ok, json: d.json, origine: d.origine }); });
    try { window.postMessage({ __tag: 'CANCALE_VINTED_REQ', id, p: req.p, h: req.h }, location.origin); } catch (_) { enAttente.delete(id); clearTimeout(t); res(null); }
  });
  try {
    chrome.runtime.onMessage.addListener((m, sender, sendResponse) => {
      if(m?.vrm==='parcours')return traiterCommandeParcours(m,sender,sendResponse);
      if(m?.vrm==='favoriPage')return traiterFavoriPage(m,sender,sendResponse);
      if (!m || m.vrm !== 'fetchPage') return false;
      demanderPage(m).then(sendResponse, () => sendResponse(null));
      return true;
    });
  } catch (_) {}

  // Tab-addressed navigation only. Do not broadcast a click through storage.
  const attentesFavoris=new Map();
  window.addEventListener('message',event=>{
    const m=event.data;if(event.source!==window||m?.__tag!=='CANCALE_VINTED_FAVORI_REP')return;
    const f=attentesFavoris.get(m.id);if(f){attentesFavoris.delete(m.id);f(m);}
  });
  function natifFavoriSur(v){
   const n=x=>typeof x==='string'&&/^[1-9]\d{0,19}$/.test(x)?x:'';
   if(!v||!n(v.itemId)||!n(v.receiverId)||typeof v.chemin!=='string'||v.chemin.length>120||!/^\/[a-z0-9_\/-]*$/.test(v.chemin))return null;
   return {chemin:v.chemin,itemId:v.itemId,receiverId:v.receiverId};
  }
  function inspectionFavoriSure(v){
 const r={};for(const k of ['liensFavoris','memeArticle','exacts','visibles','natifsMemeArticle','natifs','natifsVisibles'])if(Number.isSafeInteger(v?.[k])&&v[k]>=0&&v[k]<=10000)r[k]=v[k];return r;
}
  function traiterFavoriPage(m,sender,sendResponse){
    if(m?.vrm!=='favoriPage'||window.top!==window)return false;
    if(sender?.id&&sender.id!==chrome.runtime.id)return false;
    if(!/^f[a-f0-9]{32}$/.test(String(m.id||''))||!['sonder','ouvrir','cloche_sonder','cloche_ouvrir'].includes(m.action))return false;
    try{const u=new URL(m.cible);if(u.origin!==location.origin||u.protocol!=='https:'||!/^\/items\/[1-9]\d{0,19}\/[a-z_-]{1,40}\/new\/?$/.test(u.pathname)||! /^(?:www\.)?vinted\.(fr|com|it|de)$/.test(u.hostname)||u.href.length>2000||u.username||u.password)return false;}catch{return false;}
    if(attentesFavoris.has(m.id)||attentesFavoris.size)return false;
    const timer=setTimeout(()=>{attentesFavoris.delete(m.id);sendResponse(null);},3000);
    attentesFavoris.set(m.id,r=>{
      clearTimeout(timer);if(r.origine!==location.origin)return sendResponse(null);
      const v=r.resultat;
      if(m.action.startsWith('cloche_')){if(!v||!['disponible','deja_ouverte','activee','absente','ambigue','indisponible','origine'].includes(v.etat))return sendResponse(null);sendResponse({id:m.id,origine:location.origin,resultat:{etat:v.etat}});}
      else {if(!v||typeof v.trouve!=='boolean')return sendResponse(null);const nat=v.trouve&&v.natif?natifFavoriSur(v.natif):null;if(v.trouve&&v.natif&&!nat)return sendResponse(null);sendResponse({id:m.id,origine:location.origin,resultat:{trouve:v.trouve,...(nat?{natif:nat}:{}),...(v.inspection?{inspection:inspectionFavoriSure(v.inspection)}:{})}});}
    });
    try{window.postMessage({__tag:'CANCALE_VINTED_FAVORI_REQ',id:m.id,action:m.action,cible:m.cible},location.origin);}catch{clearTimeout(timer);attentesFavoris.delete(m.id);sendResponse(null);}
    return true;
  }
  // La boîte aux lettres (navigateur sans `tabs.sendMessage`) : une demande
  // posée par le fond dans `chrome.storage.local`, prise par UN onglet Vinted.
  try {
    chrome.storage.onChanged.addListener((ch, zone) => {
      try {
        if (zone !== 'local' || !ch || !ch.vrmPageReq) return;
        const req = ch.vrmPageReq.newValue;
        if (!req || req.vrm !== 'fetchPage' || Date.now() - Number(req.at || 0) > 20000) return;
        if (document.visibilityState === 'hidden') return;   // l'onglet visible répond
        demanderPage(req).then((o) => { if (o) chrome.storage.local.set({ vrmPageRep: o }); });
      } catch (_) {}
    });
  } catch (_) {}
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
  function arreterParcoursPage(){parcoursActif=null;clearInterval(parcoursTimer);parcoursTimer=null;parcoursObs?.disconnect();parcoursObs=null;document.removeEventListener('click',clicParcours,true);document.getElementById('vrm-parcours-local')?.remove();}
  function releverParcours(e){if(!parcoursActif)return;if(Date.now()>parcoursActif.fin){arreterParcoursPage();return;}parcoursSend({action:'evenement',nonce:parcoursActif.nonce,evenement:e});}
  function clicParcours(e){
   if(!e.isTrusted||!parcoursActif)return;
   const t=e.target?.closest?.('a,button,[role="button"],[role="link"]')||e.target;
   if(!(t instanceof Element)||t.closest('#vrm-parcours-local'))return;
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
   const afficher=()=>{if(!parcoursActif||document.getElementById('vrm-parcours-local'))return;const box=document.createElement('aside');box.id='vrm-parcours-local';box.style.cssText='position:fixed;bottom:12px;left:12px;z-index:2147483647;background:#203b43;color:white;padding:10px 12px;border-radius:8px;font:13px system-ui;max-width:280px';const txt=document.createElement('span');txt.textContent='VRM · Parcours local en cours ';const stop=document.createElement('button');stop.textContent='Arrêter';stop.type='button';stop.style.cssText='margin-left:8px;padding:8px';stop.onclick=()=>{const nonce=parcoursActif?.nonce;arreterParcoursPage();parcoursSend({action:'stop',nonce});};box.append(txt,stop);document.body?.append(box);};
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
})();
