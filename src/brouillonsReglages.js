// Brouillons en mémoire uniquement : rien dans localStorage ni sur le serveur.
// Un changement de vendeur invalide l'ensemble des brouillons précédents.
export function creerBrouillonsReglages(){
 let courant=null;const valeurs=new Map();
 const selectionner=owner=>{if(!owner||owner!==courant){valeurs.clear();courant=owner||null;}return !!owner;};
 return {
  activer(owner){selectionner(owner);},
  existe(owner){return selectionner(owner)&&valeurs.size>0;},
  lire(owner,cle){const v=selectionner(owner)?valeurs.get(cle):null;return v?{...v}:null;},
  ecrire(owner,cle,valeur){if(selectionner(owner))valeurs.set(cle,{...valeur});},
  effacer(owner,cle){if(selectionner(owner))valeurs.delete(cle);}
 };
}
export function dateImportValide(valeur){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(valeur||'')))return false;
 const t=Date.parse(valeur+'T00:00:00Z');
 return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===valeur;
}
