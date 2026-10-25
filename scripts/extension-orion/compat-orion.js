// Orion package only: preserve native listeners/callbacks and bridge promise
// callers when the exposed chrome API only implements callback-style methods.
(function(){
 'use strict';
 const g=globalThis;
 if(g.__vrmOrionCompat)return;
 const c=g.chrome&&g.chrome.runtime?g.chrome:g.browser&&g.browser.runtime?g.browser:null;
 if(!c)return;
 g.__vrmOrionCompat=true;
 let promises=false;
 try{const r=c.storage?.local?.get('__vrm_sonde_orion');promises=!!r&&typeof r.then==='function';if(promises)r.catch(()=>{});}catch{}
 const asyncs=new Set([
  'storage.local.get','storage.local.set','storage.local.remove','storage.local.clear',
  'storage.session.get','storage.session.set','storage.session.remove','storage.session.clear',
  'storage.sync.get','storage.sync.set','storage.sync.remove','storage.sync.clear',
  'tabs.query','tabs.get','tabs.create','tabs.update','tabs.remove','tabs.sendMessage',
  'cookies.get','cookies.getAll','cookies.set','cookies.remove',
  'alarms.get','alarms.getAll','alarms.clear','alarms.clearAll',
  'scripting.executeScript','windows.get','windows.getAll','windows.create','windows.update','windows.remove',
  'runtime.sendMessage','runtime.getPlatformInfo','downloads.download','downloads.search'
 ]);
 const cache=new WeakMap();
 const envelopper=(o,chemin='')=>{
  if(!o||typeof o!=='object')return o;
  if(cache.has(o))return cache.get(o);
  const p=new Proxy(o,{get(obj,k){
   // This MV2 distribution does not request MV3 scripting permission.
   // Use the existing page relay even if Orion exposes that namespace.
   if(chemin===''&&k==='scripting')return undefined;
   if(chemin===''&&k==='action'&&!obj.action&&obj.browserAction)return envelopper(obj.browserAction,'action');
   const v=obj[k],nom=chemin?chemin+'.'+String(k):String(k);
   if(typeof v==='function')return function(...args){
    if(promises||!asyncs.has(nom)||typeof args[args.length-1]==='function')return v.apply(obj,args);
    return new Promise((resolve,reject)=>{
     const rappel=r=>{const err=c.runtime?.lastError;if(err)reject(Error(err.message||'Appel extension refusé'));else resolve(r);};
     try{const r=v.apply(obj,[...args,rappel]);if(r&&typeof r.then==='function')r.then(resolve,reject);}catch(e){reject(e);}
    });
   };
   return v&&typeof v==='object'?envelopper(v,nom):v;
  }});
  cache.set(o,p);return p;
 };
 const adapte=envelopper(c);
 try{g.chrome=adapte;}catch{}
 if(g.chrome!==adapte)try{Object.defineProperty(g,'chrome',{value:adapte,configurable:true,writable:true});}catch{}
})();
