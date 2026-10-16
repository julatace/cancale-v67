// Lecture locale des pages réellement chargées ; aucun appel commercial.
export function offresAffichees(rows,{search='',sort='deadline',cible=null}={}){
 const query=search.trim().toLocaleLowerCase('fr-FR');
 const selected=(rows || []).filter(o=>cible?String(o.id)===cible.id && (!cible.itemId || String(o.itemId)===cible.itemId):!query || [o.titre,o.buyer,o.message,o.itemId,o.id].filter(v=>v!=null).join(' ').toLocaleLowerCase('fr-FR').includes(query));
 const deadline=o=>{const n=Date.parse(o.expiresAt);return Number.isFinite(n)?n:Infinity;};
 return selected.slice().sort((a,b)=>sort==='buyer'?String(a.buyer || '').localeCompare(String(b.buyer || ''),'fr'):sort==='title'?String(a.titre || '').localeCompare(String(b.titre || ''),'fr'):(deadline(a)-deadline(b) || 0));
}
