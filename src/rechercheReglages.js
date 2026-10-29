const termes={
 adresses:'mail email adresse gmail outlook icloud transfert reception',
 liens:'compte vinted associer connecter pseudo',
 numeros:'numero rangement etiquette reference boite serie',
 imprimante:'imprimer imprimante papier a4 thermique pdf bordereau chronopost mondial relay',
 tampons:'numero placement qr code barre tampon bordereau chronopost',
 zoom:'taille lisibilite affichage agrandir reduire ecran',
 stream:'confidentialite flouter discretion cacher pseudo',
 import:'historique date email debut import',
 sauvegarde:'export sauvegarde donnees recuperer',
 export:'export sauvegarde copie donnees recuperer',
 restaurer:'restaurer sauvegarde import recuperer donnees',
 motdepasse:'mot passe connexion securite changer',
 double:'double verification authentification securite totp',
 photoroom:'photoroom cle api fond blanc detourer photo studio vestiaire',
};
export const normaliserRechercheReglage=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function filtrerReglages(groupes,recherche){
 const mots=normaliserRechercheReglage(recherche).split(' ').filter(Boolean);
 return groupes.map(g=>({...g,items:mots.length?g.items.filter(it=>{
  const texte=normaliserRechercheReglage(`${g.titre||''} ${it.lib||''} ${typeof it.desc==='string'?it.desc:''} ${it.id} ${termes[it.id]||''}`);
  return mots.every(m=>texte.includes(m));
 }):g.items})).filter(g=>g.items.length);
}
