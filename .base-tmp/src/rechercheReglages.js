// La recherche dans les Paramètres : chaque mot tapé doit se trouver dans le titre de la
// catégorie et du groupe, le nom du réglage, sa phrase, son id, ou ses mots courants
// ci-dessous (ce qu'un vendeur tape : « papier », « URSSAF », « numéro », « carte »…).
// (15 nov.) Elle cherche dans TOUTES les catégories (avant : l'onglet « Réglages » seul) ;
// `g.titre` porte le nom de la catégorie et du groupe (« Argent · Compta »).
const termes={
 adresses:'mail email adresse gmail outlook icloud transfert reception boite',
 'adresse-vrm':'mail email adresse vrm transfert reception',
 liens:'compte vinted leboncoin vestiaire ebay associer connecter pseudo inclus exclus totaux',
 numeros:'numero numerotation rangement etiquette reference boite serie carton stock',
 imprimante:'imprimer imprimante impression papier a4 thermique pdf bordereau etiquette zebra dymo format chronopost mondial relay colis',
 tampons:'numero placement qr code barre tampon bordereau chronopost',
 zoom:'taille lisibilite affichage agrandir reduire ecran texte police',
 stream:'confidentialite flouter discretion cacher pseudo montants prix oeil masquer video filmer marques mots',
 'stream-on':'stream confidentialite flouter cacher montants oeil filmer',
 configuration:'configuration demarrage depart personnaliser plateformes statut regime numero etiquetage affichage notifications',
 regime:'regime fiscal statut urssaf cotisation impot declaration micro entreprise societe particulier taux',
 connexions:'etat extension synchro capture relu relecture fraicheur connexion',
 securite:'securite donnees acces protection base rls supabase expert',
 'securite-comptes':'securite compte bannir ban blocage robot plafond nuit pause captcha',
 discretion:'discretion plafond limite jour frein vinted',
 vacances:'vacances conges pause absence fermer boutique',
 santecomptes:'sante compte note envois annulations moderation',
 visite:'aide visite tutoriel decouvrir',
 depannage:'aide probleme panne marche pas bloque',
 toutvabien:'tout va bien probleme etat extension relu releve marche',
 verifier:'extension installer installation chrome module plugin navigateur verifier',
 email:'email adresse changer connexion',
 ebay:'ebay compte connexion',
 equipe:'equipe aide invite collaborateur membre',
 'lien-aide':'aide lien invite colis temporaire',
 appareils:'appareils session deconnecter partout telephone ordinateur',
 import:'historique date email debut import',
 historique:'historique ancien ventes achats import passe',
 sauvegarde:'export sauvegarde donnees recuperer',
 export:'export sauvegarde copie donnees recuperer telecharger',
 restaurer:'restaurer sauvegarde import recuperer donnees',
 revenir:'revenir arriere annuler restaurer point',
 corbeille:'corbeille supprime restaurer effacer',
 motdepasse:'mot passe connexion securite changer',
 double:'double verification authentification securite totp 2fa code application',
 'code-local':'code verrou ouverture chiffres securite',
 abonnement:'abonnement paiement payer carte facture factures prix resilier arreter offre solo pro stripe parrainage',
 push:'notification notifications telephone iphone alerte prevenir son',
 alertes:'alerte bandeau notification',
 rappels:'rappel rappeler notification',
 agenda:'agenda calendrier echeance urssaf ical google',
 'tes-donnees':'donnees confidentialite vie privee rgpd stockage acces extension lit fait',
 'journal-vrm':'journal historique ce que vrm a fait envoye',
 fermer:'supprimer compte rgpd effacer fermer',
 deconnexion:'deconnecter deconnexion quitter sortir',
 statut:'etat panne incident statut fonctionne serveur',
 masques:'masque cacher achat compta',
 prixachat:'prix achat cout benefice marge',
 'objectif-mois':'objectif but chiffre mois',
 modeles:'modele texte description annonce',
 'sms-colis':'sms mondial relay casier colis vinted go pickup',
 'carte-merci':'carte remerciement merci colis',
 langue:'langue anglais english espagnol italien allemand traduction',
 apparence:'apparence sombre clair nuit theme couleur',
 sombre:'sombre nuit noir theme',
 'mes-plateformes':'plateformes onglets visibles leboncoin vestiaire ebay vinted',
 'je-vends':'vends sneakers vetements categorie',
 widget:'widget iphone ecran accueil scriptable',
};
export const normaliserRechercheReglage=v=>String(v||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const motsDuReglage=(id)=>termes[id]||'';
export function filtrerReglages(groupes,recherche){
 const mots=normaliserRechercheReglage(recherche).split(' ').filter(Boolean);
 return groupes.map(g=>({...g,items:mots.length?g.items.filter(it=>{
  const texte=normaliserRechercheReglage(`${g.titre||''} ${it.lib||''} ${typeof it.desc==='string'?it.desc:''} ${typeof it.val==='string'?it.val:''} ${it.id} ${termes[it.id]||''}`);
  return mots.every(m=>texte.includes(m));
 }):g.items})).filter(g=>g.items.length);
}
