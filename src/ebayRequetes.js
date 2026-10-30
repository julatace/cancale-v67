const erreur=(message,reason)=>Object.assign(new Error(message),{reason});
const incertain=()=>erreur('Résultat incertain : relis les données eBay avant de recommencer.','incertain');
export async function appelerEbay(action,payload,headers,{write=false,fetcher=globalThis.fetch,timeoutMs=30000}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{
  const r=await fetcher('/api/ebay',{method:'POST',headers:{'Content-Type':'application/json',...headers()},body:JSON.stringify({...payload,action}),signal:controller.signal});
  let j;try{j=await r.json();}catch(_){throw write?incertain():erreur('Réponse eBay illisible. Réessaie la lecture.','lecture');}
  if(!j || typeof j.ok!=='boolean')throw write?incertain():erreur('Réponse eBay incomplète. Réessaie la lecture.','lecture');
  if(!r.ok || !j.ok){
   const reason=j.reason || (write && r.status>=500?'incertain':undefined);
   if(reason==='incertain')throw incertain();
   throw Object.assign(erreur(j.error || 'eBay est indisponible.',reason),{status:r.status});
  }
  return j;
 }catch(e){if(e.name==='AbortError' || e instanceof TypeError)throw write?incertain():erreur('Lecture indisponible. Réessaie.','lecture');throw e;}
 finally{clearTimeout(timer);}
}
