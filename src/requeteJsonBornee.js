// Délai couvrant les en-têtes ET le JSON, sans relance des mutations.
// Compatible avec les Safari qui n'ont pas AbortSignal.timeout.
export async function requeteJsonBornee(url,options={},delai=15000,fetcher=fetch){
 const controle=new AbortController(),externe=options.signal;
 const interrompre=()=>controle.abort();
 if(externe?.aborted)interrompre();else externe?.addEventListener('abort',interrompre,{once:true});
 const timer=setTimeout(interrompre,delai);
 try{
  const r=await fetcher(url,{...options,signal:controle.signal});
  let json;try{json=await r.json();}catch(e){if(controle.signal.aborted)throw e;throw Error('La réponse du service n’est pas lisible.');}
  return {ok:r.ok,status:r.status,json};
 }catch(e){
  if(controle.signal.aborted){const erreur=Error('La demande a été interrompue ou le service n’a pas répondu à temps.');erreur.name='AbortError';throw erreur;}
  if(e?.name==='TypeError')throw Error('La connexion au service a échoué. Le résultat de la demande reste à vérifier.');
  throw e;
 }
 finally{clearTimeout(timer);externe?.removeEventListener('abort',interrompre);}
}
