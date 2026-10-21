// Test de lecture, sans clé de service et sans contenu métier.
// La présence d’une colonne owner ne prouve pas que RLS filtre réellement.
export async function verifierConfidentialite({url,anon,jeton,uid,fetcher=fetch}) {
 if(!uid||!jeton)return {ok:false,raison:'session'};
 const verifier=async(table,token,filtre='')=>{
  try{
   const r=await fetcher(`${url}/rest/v1/${table}?select=owner&limit=1${filtre}`,{headers:{apikey:anon,Authorization:`Bearer ${token}`}});
   if(r.status===401||r.status===403)return token===anon?true:null;
   if(!r.ok)return null;
   const j=await r.json();return Array.isArray(j)?j.length===0:null;
  }catch(_){return null;}
 };
 const resultats=await Promise.all(['app_data','vinted_accounts'].flatMap(t=>[
  verifier(t,anon),verifier(t,jeton,`&or=${encodeURIComponent(`(owner.neq.${uid},owner.is.null)`)}`),
 ]));
 return resultats.some(v=>v===false)?{ok:false,raison:'separation-non-confirmee'}:resultats.every(v=>v===true)?{ok:true}:{ok:false,raison:'verification-indisponible'};
}
