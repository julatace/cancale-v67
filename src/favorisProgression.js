export const ETAPES_FAVORIS={autorisation:'Autorisation de l’envoi',conversation:'Ouverture de la conversation',verification:'Vérification de l’article et du destinataire',historique:'Vérification des messages existants',offre:'Offre de réduction Vinted',envoi:'Envoi du message',confirmation:'Confirmation de Vinted'};
export const RAISONS_FAVORIS={offre_refusee:'Vinted a refusé l’offre de réduction : le message n’a PAS été envoyé (il annonçait une offre qui n’existe pas). La file est arrêtée.',offre_prix_inconnu:'Le prix de l’article n’a pas pu être lu : l’offre n’a pas été faite et le message n’a PAS été envoyé. La file est arrêtée.',offre_incertaine:'Vinted n’a pas répondu clairement à l’offre : le message n’a PAS été envoyé. Vérifie la conversation sur Vinted avant toute suite.',article_vendu:'Article vendu : aucun message envoyé à ce favori.',ecran_inactif:'L’écran des favoris a été quitté avant l’envoi. Aucun message envoyé pour cette tentative.',compte_vinted_absent:'Connecte-toi à Vinted avec le compte sélectionné dans ce navigateur.',quota_extension:'Le plafond d’actions de l’extension est atteint. Attends avant de relancer.',pause_vinted:'Vinted demande de ralentir. La file est arrêtée.',conversation_deja_contactee:'Conversation avec des messages : aucun message aux favoris envoyé.',historique_non_verifie:'L’historique du fil n’a pas pu être vérifié. Aucun message envoyé.',identite_non_confirmee:'L’article ou le destinataire du fil n’a pas été confirmé. Aucun message envoyé.',autorisation_expiree:'La file a été arrêtée ou son autorisation a expiré.',compte_vinted_different:'Connecte le compte Vinted sélectionné dans ce navigateur.',extension_indisponible:'L’extension ne répond pas ou doit être rechargée.',session_extension:'Reconnecte l’extension au même compte VRM que l’application.',vinted_refus:'Vinted a refusé la demande. La file est arrêtée.',creation_non_confirmee:'Vinted n’a pas confirmé l’ouverture du fil. Aucun renvoi automatique.',reponse_inconnue:'L’accusé de réception est incertain. Vérifie le fil sur Vinted avant toute suite.',conversation_existante:'Une conversation existe déjà avec cette personne : rien envoyé (mode automatique).',vinted_frein:'Vinted a demandé de ralentir : le mode automatique est en pause 24 h sur ce compte.',vinted_robot:'Vinted a parlé d’activité automatisée ou demandé un captcha : le mode automatique est en pause 24 h sur ce compte.',onglet_vinted:'Ouvre vinted.fr dans ce Chrome, connecté sur ce compte, et laisse l’onglet ouvert : les messages partent de la page Vinted, comme Vintex. Rien n’a été envoyé.'};
export function progressionFavoris(vue,maintenant){
  const tous=vue?.jobs||[],jobs=vue?.lot?tous.filter(x=>x.lot===vue.lot):tous;
  const compter=etat=>jobs.filter(x=>x.etat===etat).length;
  const termines=jobs.filter(x=>!['attente','reserve'].includes(x.etat)).length;
  return {jobs,total:jobs.length,termines,envoyes:compter('envoye'),ignores:compter('ignore'),attente:compter('attente'),encours:compter('reserve'),incertains:compter('incertain'),refuses:compter('refuse'),annules:compter('annule'),verifies:compter('verifie'),secondes:vue?.active&&vue.prochain?Math.max(0,Math.ceil((vue.prochain-maintenant)/1000)):0};
}
export function dureeFavoris(secondes){const s=Math.max(0,Math.ceil(secondes));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}

// Le résultat rendu par l'extension (ou son absence), traduit pour le serveur — la
// MÊME traduction pour un envoi sur clic et pour le mode automatique (2 nov.).
// `ecrits` (5.309) : combien d'écritures sont parties chez Vinted ; inconnu ⇒ absent.
const CODES_REFUS=['vinted-pause','vinted-absent','vinted-autre','plafond','plafond-bordereaux','perime','plusieurs','non-autorise','origine','preparation-refusee'];
export function traduireResultatFavori(r){
  let resultat='incertain',raison='reponse_inconnue';
  if(r?.ok&&['envoye','ignore'].includes(r.data?.resultat))resultat=r.data.resultat;
  else if(r?.data?.resultat==='refuse')resultat='refuse';
  if(CODES_REFUS.includes(r?.code))resultat='refuse';
  if(RAISONS_FAVORIS[r?.data?.raison])raison=r.data.raison;
  else if(r?.code==='vinted-autre')raison='compte_vinted_different';
  else if(r?.code==='vinted-absent')raison='compte_vinted_absent';
  else if(['plafond','plafond-bordereaux'].includes(r?.code))raison='quota_extension';
  else if(r?.code==='vinted-pause')raison='pause_vinted';
  else if(['perime','plusieurs','non-autorise','origine','preparation-refusee'].includes(r?.code))raison='extension_indisponible';
  else if(resultat==='refuse')raison='vinted_refus';
  if(resultat==='envoye')raison='';
  // Refusé par l'app ou l'extension AVANT d'atteindre Vinted : rien n'est parti.
  const ecrits=Number.isInteger(r?.data?.ecrits)?r.data.ecrits:CODES_REFUS.includes(r?.code)?0:undefined;
  return {resultat,raison,ecrits};
}
