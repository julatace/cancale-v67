// Lecture seule ; aucune déduction d'identité et aucun marquage d'impression.
export async function lireBordereauVestiaire({id,owner,ownerActuel,lire,delai=20000}){
 const verifier=()=>{if(!owner||ownerActuel()!==owner)throw Error('Le compte VRM a changé. Rouvre la vente dans le bon compte.');};
 verifier();if(typeof id!=='string'||!id.startsWith('vc_label_')||id.length>512)throw Error('La référence du bordereau est absente. Rouvre cette vente sur Vestiaire pour la récupérer.');
 let timer;try{
  const j=await Promise.race([Promise.resolve().then(()=>lire(id)).catch(()=>{throw Error('La lecture du bordereau a échoué. Vérifie la connexion puis réessaie.');}),new Promise((_,rej)=>{timer=setTimeout(()=>rej(Error('La lecture du bordereau prend trop de temps. Réessaie.')),delai)})]);
  verifier();if(!Array.isArray(j))throw Error('Le bordereau n’a pas pu être lu. Réessaie dans un instant.');
  const b64=j[0]?.b64;if(typeof b64!=='string'||!b64)return{etat:'absent'};
  return{etat:'ok',b64};
 }finally{clearTimeout(timer);}
}
