// Les deux modes sont indépendants : un échec thermique ne masque pas l'A4.
export async function preparerApercusModes(fabrique) {
 const modes=['normale','thermique'];
 const resultats=await Promise.allSettled(modes.map(m=>fabrique(m==='thermique')));
 const sortie={normale:null,thermique:null,erreurs:{}};
 resultats.forEach((r,i)=>{
  if(r.status==='fulfilled')sortie[modes[i]]=r.value;
  else sortie.erreurs[modes[i]]=String(r.reason?.message||'Aperçu indisponible.');
 });
 return sortie;
}
