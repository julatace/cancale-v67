import {normAdresse} from '../api/_lib/proprietaire-email.js';
export function etatCollecteur(collecteur,maintenant=Date.now()) {
 const t=Date.parse(collecteur?.dernierPassage),s=Date.parse(collecteur?.dernierSucces);
 if(!Number.isFinite(t)&&!Number.isFinite(s))return {etat:'inconnu',titre:'Suivi du collecteur à activer',detail:'Le script installé doit transmettre son état. L’absence de suivi ne signifie pas que tes emails sont arrêtés.'};
 if(collecteur?.etat==='erreur'&&(!Number.isFinite(s)||t>=s))return {etat:'alerte',titre:'Dernier passage en difficulté',detail:'Le collecteur a signalé un problème. Les emails non confirmés restent disponibles pour une reprise.'};
 const recent=Math.max(Number.isFinite(t)?t:0,Number.isFinite(s)?s:0);
 if(recent>maintenant+300000)return {etat:'inconnu',titre:'Horodatage à vérifier',detail:'L’heure du suivi ne permet pas de conclure sur la réception.'};
 if(maintenant-recent>20*60000)return {etat:'alerte',titre:'Collecteur à vérifier',detail:'Aucun passage signalé depuis plus de 20 minutes. Cela ne prouve pas une perte d’emails.'};
 if(collecteur?.etat==='debut'&&(!Number.isFinite(s)||t>s))return {etat:'actif',titre:'Vérification en cours',detail:'Le collecteur a démarré un passage. Son résultat n’est pas encore confirmé.'};
 return {etat:'actif',titre:'Collecteur actif',detail:'Un passage récent a été confirmé. Cela ne garantit pas que tous les transferts utilisateurs sont configurés.'};
}
export const typesEmail={achat:'Achat',vente:'Vente',bordereau:'Bordereau',finalisation:'Versement',suivi:'Colis',offre:'Offre',message:'Message',favori:'Favori','connu-sans-action':'Information',information:'Information',ignoré:'À vérifier',action:'Action'};
// Une adresse personnelle n’est associée qu’à un compte Vinted dans le formulaire.
export function conflitAdresseCompte(mapping,uid,adresse) {

 const a=normAdresse(adresse);if(!a)return null;
 return Object.keys(mapping||{}).find(id=>String(id)!==String(uid)&&normAdresse(mapping[id])===a)||null;
}

// Les étapes utilisent uniquement des preuves lues ; un transfert externe
// n'est jamais déclaré actif simplement parce que l'adresse est enregistrée.
export function etapesTransfert(adresse, preuves, maintenant=Date.now()) {
 const unique=adresse?.comptes?.length===1;
 const declaree=unique&&adresse?.declaree===true;
 const preuve=preuves?.adresses?.[String(adresse?.adresse||'').trim().toLowerCase()];
 const date=Date.parse(adresse?.derniereReception||'');
 const observe=declaree&&Number.isFinite(date)&&date<=maintenant+300000;
 return [
  {id:'compte',titre:'Associer le compte',etat:unique?'fait':'a-faire'},
  {id:'declaration',titre:'Déclarer l’adresse',etat:declaree?'fait':'a-faire'},
  {id:'confirmation',titre:'Confirmer l’adresse',etat:typeof preuves?.cloisonnee!=='boolean'?'inconnu':preuves.cloisonnee===false?'non-requis':preuve?.etat==='prouvee'?'fait':preuve?.etat==='envoyee'?'attente':preuve?.etat==='envoi'?'preparation':'a-faire'},
  {id:'transfert',titre:'Activer le transfert',etat:'externe'},
  {id:'reception',titre:'Vérifier la réception',etat:observe?'fait':'attente'},
 ];
}
