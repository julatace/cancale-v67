// Chrome's addressed channel bypasses an orphan page bridge. Never retry or
// switch channels after an ambiguous write: that could duplicate a message.
export function appelerFavorisDirect(rt,id,msg,timeoutMs=8000){
  if(!rt||typeof rt.sendMessage!=='function'||!/^[a-p]{32}$/.test(id||''))return Promise.resolve(null);
  return new Promise(resolve=>{
    let fini=false;const fin=v=>{if(fini)return;fini=true;clearTimeout(timer);resolve(v);};
    const timer=setTimeout(()=>fin(null),timeoutMs);
    try{rt.sendMessage(id,msg,r=>{let erreur;try{erreur=rt.lastError;}catch{erreur=true;}fin(erreur?null:r||null);});}catch{fin(null);}
  });
}
