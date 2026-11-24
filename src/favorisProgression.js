export const ETAPES_FAVORIS={autorisation:'Autorisation de l’envoi',conversation:'Ouverture de la conversation',verification:'Vérification de l’article et du destinataire',historique:'Vérification des messages existants',ecriture:'Temps d’écriture',attente_message:'Offre faite · message bientôt',offre:'Offre de réduction Vinted',envoi:'Envoi du message',confirmation:'Confirmation de Vinted'};
export const RAISONS_FAVORIS={element_introuvable:'La page de Vinted n’a pas montré le bouton ou le champ attendu pour ce favori : rien n’est parti pour lui, la file continue avec les suivants.',tout_arrete:'« Tout arrêter » pendant l’attente : l’offre est faite, le message n’est PAS parti.',trop_tard:'L’extension s’est arrêtée trop longtemps : l’offre est faite, le message n’est PAS parti.',offre_refusee:'Vinted a refusé l’offre de réduction : le message n’a PAS été envoyé (il annonçait une offre qui n’existe pas). La file est arrêtée.',offre_prix_inconnu:'Le prix de l’article n’a pas pu être lu : l’offre n’a pas été faite et le message n’a PAS été envoyé. La file est arrêtée.',offre_incertaine:'Vinted n’a pas répondu clairement à l’offre : le message n’a PAS été envoyé. Vérifie la conversation sur Vinted avant toute suite.',article_vendu:'Article vendu : aucun message envoyé à ce favori.',annonce_indisponible:'Annonce réservée, masquée, fermée ou supprimée (lu sur Vinted ou dans ton dressing) : aucun message ni offre envoyés à ce favori.',ecran_inactif:'L’écran des favoris a été quitté avant l’envoi. Aucun message envoyé pour cette tentative.',compte_vinted_absent:'Connecte-toi à Vinted avec le compte sélectionné dans ce navigateur.',quota_extension:'Le plafond d’actions de l’extension est atteint. Attends avant de relancer.',pause_vinted:'Vinted demande de ralentir. La file est arrêtée.',conversation_deja_contactee:'Conversation avec des messages : aucun message aux favoris envoyé.',historique_non_verifie:'L’historique du fil n’a pas pu être vérifié. Aucun message envoyé.',identite_non_confirmee:'L’article ou le destinataire du fil n’a pas été confirmé. Aucun message envoyé.',autorisation_expiree:'La file a été arrêtée ou son autorisation a expiré.',compte_vinted_different:'Connecte le compte Vinted sélectionné dans ce navigateur.',extension_indisponible:'L’extension ne répond pas ou doit être rechargée.',session_extension:'Reconnecte l’extension au même compte VRM que l’application.',vinted_refus:'Vinted a refusé la demande. La file est arrêtée.',creation_non_confirmee:'Vinted n’a pas confirmé l’ouverture du fil. Aucun renvoi automatique.',reponse_inconnue:'L’accusé de réception est incertain. Vérifie le fil sur Vinted avant toute suite.',conversation_existante:'Une conversation existe déjà avec cette personne : rien envoyé (mode automatique).',vinted_frein:'Vinted a demandé de ralentir : le mode automatique est en pause 24 h sur ce compte.',vinted_robot:'Vinted a parlé d’activité automatisée ou demandé un captcha : le mode automatique est en pause 24 h sur ce compte.',texte_interdit:'Ton message contient un lien, un e-mail, un téléphone ou un paiement hors de Vinted : Vinted le refuse, rien n’a été envoyé. Corrige le texte (et tes autres versions) dans l’éditeur.',texte_refuse:'Vinted a refusé ce texte : cette version n’est plus utilisée. Change-la, ou ajoute d’autres versions du message.',offre_sous_plancher:'L’offre serait sous ton prix mini : ni offre ni message pour ce favori.',conversation_refusee:'Vinted refuse d’ouvrir la conversation avec cette personne (elle t’a peut-être bloqué, ou son compte est fermé) : rien envoyé.',favori_trop_ancien:'Ce favori n’est plus dans la cloche de Vinted (trop ancien) : rien envoyé, comme le ferait la cloche.',onglet_vinted:'Ouvre vinted.fr dans le navigateur où est l’extension VRM, connecté sur ce compte, et laisse l’onglet ouvert : les messages partent de la page Vinted. Rien n’a été envoyé.'};
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
  // (5.369) Le n° de la version envoyée (1 à 5), seulement sur un envoi confirmé.
  const variante=resultat==='envoye'&&Number.isInteger(r?.data?.variante)&&r.data.variante>=1&&r.data.variante<=5?r.data.variante:undefined;
  // (5.406) Un refus d'ATTENTE avant toute écriture dit QUAND réessayer (le vrai temps de la garde
  // de l'extension : ouverture de Vinted, 15/h, 50/h…) ; borné 5 s – 60 min. Absent ⇒ rien (10 min d'avant).
  const a=Number(r?.data?.apresMs);
  const apresMs=resultat==='refuse'&&raison==='quota_extension'&&ecrits===0&&Number.isFinite(a)&&a>0?Math.round(Math.min(3600000,Math.max(5000,a))):undefined;
  // (22 nov.) OÙ et POURQUOI, pour le diagnostic et pour l'écran : l'ÉTAPE (un nom de la séquence) et la CLASSE de la cause
  // (élément absent + son nom de code, statut HTTP, garde, onglet…) — jamais une valeur, jamais un texte.
  const etape=ETAPE_ACCUSE.test(String(r?.data?.etape||''))?String(r.data.etape):undefined;
  const cause=CAUSE_ACCUSE.test(String(r?.data?.cause||''))?String(r.data.cause):undefined;
  return {resultat,raison,ecrits,...(variante?{variante}:{}),...(apresMs?{apresMs}:{}),...(etape?{etape}:{}),...(cause?{cause}:{})};
}
export const ETAPE_ACCUSE=/^(?:autorisation|cloche|conversation|verification|historique|ecriture|attente_message|attente_offre|offre|envoi|confirmation)$/;
export const CAUSE_ACCUSE=/^(?:element_absent|favori_absent|page_autre|lien_autre|compte|onglet|file|garde|frein|captcha|autorisation|http_[1-5]\d\d)(?::[a-z][a-z-]{1,39})?$/;
// (22 nov., Julien : « 0 envoyé · 2 refusés : autre refus », la file arrêtée pour un bouton introuvable) UN favori refusé
// sans RIEN d'écrit, pour une cause qui ne tient qu'à LUI (la page n'a pas montré son bouton, son fil n'a pas pu être
// vérifié, Vinted a répondu 4xx pour lui seul), est SAUTÉ : la file continue. Les causes GLOBALES arrêtent toujours
// (vérification, 403/429, mauvais compte, onglet fermé, plafond, autorisation). Trois de suite ⇒ la file s'arrête et le dit.
export const RAISONS_LOCALES=Object.freeze(['element_introuvable','identite_non_confirmee','historique_non_verifie']);
export const REFUS_LOCAUX_MAX=3;
export function refusLocal({resultat,raison,ecrits,cause,etape}={}){
  if(resultat!=='refuse')return false;
  // Rien d'écrit — ou seulement la conversation OUVERTE (vide) quand l'arrêt est à l'écriture / l'envoi du message.
  if(!(ecrits===0||(ecrits===1&&['verification','historique','ecriture','envoi'].includes(String(etape||'')))))return false;
  if(RAISONS_LOCALES.includes(raison))return true;
  return raison==='vinted_refus'&&/^http_4\d\d/.test(String(cause||''))&&!/^http_4(?:01|03|29)/.test(String(cause||''));
}

// (20 nov., ext. 5.410 `messagesmalins`) LE BILAN d'un envoi : « 12 envoyés · 2 sautés (vendus ou indisponibles) · 1 refusé :
// texte refusé par Vinted ». Une règle pour l'app, la carte de vinted.fr et le serveur (vueFile.bilan, fin.bilan). Sauté = rien
// envoyé à ce favori, la file a continué (annonce plus disponible, déjà en conversation, offre sous le prix mini, conversation
// refusée par Vinted) ; refusé = Vinted ou la règle a arrêté CE message (la raison nommée). Regroupé par CODE (traduit à l'écran).
export const RAISONS_SAUT=Object.freeze(['favori_trop_ancien','annonce_indisponible','article_vendu','conversation_deja_contactee','conversation_existante','offre_sous_plancher','conversation_refusee']);
const CODE_SAUT={article_vendu:'annonce_indisponible',conversation_existante:'conversation_deja_contactee'};
export const MOTS_SAUT=Object.freeze({favori_trop_ancien:'trop anciens pour Vinted',annonce_indisponible:'vendus ou indisponibles',conversation_deja_contactee:'déjà en conversation',offre_sous_plancher:'offre sous le prix mini',conversation_refusee:'conversation refusée par Vinted',autre:'autres'});
export const MOTS_REFUS=Object.freeze({element_introuvable:'bouton ou champ introuvable sur la page de Vinted',identite_non_confirmee:'article ou destinataire pas confirmé',historique_non_verifie:'conversation pas vérifiée',texte_interdit:'texte contenant un lien, un e-mail, un téléphone ou un paiement hors Vinted',texte_refuse:'texte refusé par Vinted',vinted_robot:'vérification anti-robot de Vinted',pause_vinted:'Vinted demande de ralentir',vinted_frein:'Vinted demande de ralentir',offre_refusee:'offre refusée par Vinted',autre:'autre refus'});
export function bilanFavoris(jobs){
  const l=Array.isArray(jobs)?jobs:[];
  const b={envoyes:0,sautes:0,refuses:0,incertains:0,attente:0,parSaut:{},parRefus:{}};
  for(const j of l){
    if(!j)continue;
    if(j.etat==='envoye')b.envoyes++;
    else if(j.etat==='attente'||j.etat==='reserve')b.attente++;
    else if(j.etat==='incertain')b.incertains++;
    else if(j.etat==='ignore'||(j.etat==='refuse'&&RAISONS_SAUT.includes(j.raison))){b.sautes++;const c=CODE_SAUT[j.raison]||(MOTS_SAUT[j.raison]?j.raison:'autre');b.parSaut[c]=(b.parSaut[c]||0)+1;}
    else if(j.etat==='refuse'){b.refuses++;const c=j.raison==='vinted_frein'?'pause_vinted':MOTS_REFUS[j.raison]?j.raison:'autre';b.parRefus[c]=(b.parRefus[c]||0)+1;}
  }
  return b;
}
// 5.440.1 (Julien, 23 nov. : « plusieurs favoris de suite » après UN refus, et la phrase coupée « puis touche « ») : la raison
//    d'une file qui saute ou s'arrête pour des refus LOCAUX, dite par SON code (l'extension la traduit, `raisonCode`) — UN
//    favori nommé par sa raison, « N de suite » seulement quand il y en a eu N. Toujours terminée par le nom du bouton.
export function phraseRaisonFile(code,{refus='autre',n=REFUS_LOCAUX_MAX}={}){
  const mot=MOTS_REFUS[refus]||MOTS_REFUS.autre;
  if(code==='local_saute')return `Un favori n’est pas parti (${mot}) : rien n’est parti pour lui, VRM continue avec les suivants.`;
  if(code==='locaux_suite')return `${Number(n)>1?`${Number(n)} favoris de suite ne sont pas partis`:'Un favori n’est pas parti'} (le dernier : ${mot}) : la file est en pause, rien n’est parti pour eux. Ouvre Vinted dans l’onglet de travail, vérifie que la cloche et la messagerie s’affichent, puis touche « Reprendre ».`;
  return '';
}
// La phrase du bilan. `mot(code, famille)` traduit un code (l'écran passe tr()) ; sans lui, le français de la règle.
export function phraseBilanFavoris(b,mot){
  if(!b)return '';
  const m=(c,f)=>(typeof mot==='function'&&mot(c,f))||(f==='saut'?MOTS_SAUT:MOTS_REFUS)[c]||c;
  const liste=(o,f)=>{const e=Object.entries(o);return e.map(([c,n])=>e.length>1?`${n} ${m(c,f)}`:m(c,f)).join(', ');};
  const p=[`${b.envoyes} envoyé${b.envoyes>1?'s':''}`];
  if(b.sautes)p.push(`${b.sautes} sauté${b.sautes>1?'s':''} (${liste(b.parSaut,'saut')})`);
  // 5.440.1 : UN mot par état, partout (fenêtre de vinted.fr, panneau, app) : « pas envoyé » (plus « refusé »).
  if(b.refuses)p.push(`${b.refuses} pas envoyé${b.refuses>1?'s':''} : ${liste(b.parRefus,'refus')}`);
  if(b.incertains)p.push(`${b.incertains} à vérifier sur Vinted`);
  return p.join(' · ');
}
