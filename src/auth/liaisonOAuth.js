// Relier une identité au compte connecté, jamais ouvrir une nouvelle connexion.
export async function preparerLiaisonOAuth({provider,enabled,token,owner,base,cle,origine,verifier,challenge,fetcher=fetch,storage=sessionStorage,stockageAppareil=localStorage,maintenant=Date.now()}){
 if(!['google','discord'].includes(provider)||!enabled)return{ok:false,error:'Cette connexion n’est pas encore activée dans VRM.'};
 if(!token||!owner)return{ok:false,error:'Reconnecte-toi à VRM avant de relier ce compte.'};
 const key='vrm_oauth_liaison';
 try{
  const url=new URL(base+'/auth/v1/user/identities/authorize');
  // `skip_http_redirect=true` : sinon l'endpoint répond en 302 vers Google, le
  // `fetch` suit la redirection et récupère du HTML → `r.json()` échoue, `j` est
  // nul, `new URL('')` lève → « Impossible de préparer ». Avec ce paramètre,
  // l'endpoint rend `{url}` en JSON (c'est ainsi que le SDK Supabase le lit).
  url.search=new URLSearchParams({provider,redirect_to:origine+'/?tab=settings&vue=compte',code_challenge:challenge,code_challenge_method:'s256',skip_http_redirect:'true'}).toString();
  const r=await fetcher(url.href,{headers:{apikey:cle,Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});
  const j=await r.json().catch(()=>null);
  if(!r.ok)return{ok:false,error:r.status===401?'Ta session a expiré. Reconnecte-toi avant de réessayer.':/already.*link|identity.*exists/i.test(j?.msg||j?.message||'')?'Ce compte est déjà relié à un autre compte VRM.':'La liaison n’est pas disponible pour le moment. Ton compte VRM reste inchangé.'};
  const retour=new URL(j?.url||'');const hotes=provider==='google'?['accounts.google.com']:['discord.com','discordapp.com'];
  if(retour.protocol!=='https:'||retour.username||retour.password||!hotes.includes(retour.hostname))throw Error('retour');
  const contexte=JSON.stringify({owner,provider,verifier,at:maintenant});storage.setItem(key,contexte);try{stockageAppareil.setItem(key,contexte);}catch(_){}
  return{ok:true,url:retour.href};
 }catch(_){return{ok:false,error:'Impossible de préparer la liaison. Réessaie dans un instant.'};}
}
export function lireLiaisonOAuth(storage,stockageAppareil,maintenant=Date.now()){
 const key='vrm_oauth_liaison';let c=null;
 for(const s of [storage,stockageAppareil]){try{const j=JSON.parse(s.getItem(key)||'null');s.removeItem(key);if(!c&&j?.owner&&j?.verifier&&['google','discord'].includes(j.provider)&&maintenant-j.at>=0&&maintenant-j.at<600000)c=j;}catch(_){}}
 return c;
}
export function resultatLiaisonPermis(contexte,reponse){return !contexte||!!(reponse?.access_token&&reponse?.user?.id===contexte.owner);}
