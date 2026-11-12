// ── L'ÉCRAN « MESSAGES AUX FAVORIS », EN UN COUP D'ŒIL (2 novembre 2026) ──────
// Julien : « Messages aux favoris : écran refait, plus simple (qui a mis en
// favori, message prêt, envoyé ou pas, pourquoi). » Pour un débutant comme pour
// un pro, « comme Apple ».
//
// Ce fichier ne porte que la PRÉSENTATION : il lit ce que le serveur a déjà
// décidé (la liste d'envoi `jobs`, le journal du mode automatique, la pause) et
// le dit en une phrase. Il ne décide RIEN de l'envoi : aucune règle d'envoi ni
// garde-fou n'est ici (ils restent dans api/_lib/favoris-*.js et l'extension).
//
// Règles d'écran :
//   · UN état par favori : à envoyer · en cours · à vérifier · envoyé · pas envoyé ;
//   · une phrase ne se répète jamais sur chaque ligne : les favoris sont rangés
//     par état ET par raison, la phrase et le geste vivent dans l'en-tête du groupe ;
//   · aucun mot technique à l'écran (MOTS_INTERDITS_FAVORIS), aucun emoji ;
//   · l'annonce se reconnaît par l'identifiant du lien (/items/<id>), jamais par
//     le texte de la notification ni par ressemblance (§5).
import {ageFavori} from './favorisVinted.js';
import { motsNavigateur } from './navigateurExtension.js';
// (5 nov.) Le navigateur d'ICI, nommé seulement s'il est su (jamais « Chrome » sur Orion).
const NAV = motsNavigateur();

// Les mots qui ne doivent jamais apparaître à l'écran (sa demande : « file »,
// « jeton », « 429 »… interdits).
export const MOTS_INTERDITS_FAVORIS=[/\bfiles?\b/i,/jetons?/i,/\b(?:401|403|404|409|429|500|502|503)\b/,/\bpont\b/i,/captur/i,/quota/i,/payload|endpoint|\bAPI\b|\bjson\b/i,/autorisation/i,/\blots?\b/i,/notification_?id|user_?id/i,/Vintex/i];
export function jargonFavoris(texte){const t=String(texte||'');return MOTS_INTERDITS_FAVORIS.filter(re=>re.test(t)).map(String);}
export const EMOJI_RE=/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/u;

const heureParis=t=>{try{const d=new Date(Number(t)||Date.parse(t));if(!Number.isFinite(d.getTime()))return '';return d.toLocaleString('fr-FR',{timeZone:'Europe/Paris',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});}catch{return '';}};
export const dateFavori=heureParis;

// L'identifiant d'annonce Vinted porté par le lien du favori (seule identité).
export function itemIdFavori(ligne){
  const m=/\/items\/([1-9]\d{0,19})(?:[/?#]|$)/.exec(String(ligne?.lien||''));
  return m?m[1]:null;
}

// ── LE MODE AUTOMATIQUE, EN UNE PHRASE ET UN GESTE ─────────────────────────────
// `ton` : 'neutre' (rien à faire) · 'geste' (ambre : un geste de Julien débloque).
const MODE={
  eteint:{texte:'Éteint : rien ne part tout seul.'},
  hors_horaires:{texte:'Allumé, hors de tes horaires : il reprend à ta prochaine plage.'},
  quota_heure:{texte:'Allumé : la limite de l’heure est atteinte, il reprend dans moins d’une heure.'},
  quota_jour:{texte:'Allumé : la limite des 24 h est atteinte, il reprend dès qu’un message envoyé a plus de 24 h.'},
  espacement:{texte:'Allumé : petite attente au hasard entre deux messages.'},
  occupe:{texte:'Allumé : un message part en ce moment.'},
  pret:{texte:'Allumé : un message part dans un instant.'},
  veille:{texte:'Allumé : il attend un nouveau favori.'},
  libre:{texte:'Allumé : il attend un nouveau favori.'},
  attente_favori:{texte:'Allumé : un favori attend son délai avant le message.'},
  lecture:{texte:'Allumé : VRM n’a pas pu lire ses données, nouvel essai dans quelques minutes.'},
  a_verifier:{texte:'En attente : un message est à vérifier sur Vinted.',geste:'Regarde-le dans « À vérifier » plus bas.'},
  garde_absente:{texte:'Rien ne part : VRM n’a pas pu vérifier tes articles vendus ailleurs.',geste:'Ouvre une fois l’écran Annonces de VRM.'},
  dressing_absent:{texte:'Rien ne part : VRM n’a pas vu ton dressing.',geste:'Ouvre ton dressing sur vinted.fr avec ce compte.'},
  dressing_ancien:{texte:'Rien ne part : ton dressing a été vu il y a plus de 24 h.',geste:'Ouvre ton dressing sur vinted.fr avec ce compte.'},
  dressing_partiel:{texte:'Rien ne part : VRM n’a vu qu’une partie de ton dressing.',geste:'Ouvre ton dressing sur vinted.fr et fais-le défiler jusqu’au bout.'},
  boite_ancienne:{texte:'Rien ne part : tes conversations Vinted n’ont pas été relues depuis 24 h.',geste:'Ouvre ta messagerie sur vinted.fr avec ce compte.'},
  capture:{texte:'Rien ne part : VRM n’a pas encore vu les favoris de ce compte.',geste:'Ouvre la cloche de Vinted avec ce compte.'},
  destinataire_non_prouve:{texte:'Rien ne part : VRM ne sait pas encore à qui écrire.',geste:'Touche « Ouvrir » sur un favori plus bas : VRM apprend à qui écrire.'},
  reglages:{texte:'Rien ne part : aucun message enregistré.',geste:'Écris ton message ci-dessous, puis Enregistrer.'},
  extension:{texte:'Un message est prêt, mais l’extension ne peut pas l’envoyer.',geste:`Ouvre vinted.fr ${NAV.dansNu} sur ce compte, avec l’extension à jour.`},
  onglet_vinted:{texte:'Un message attend : aucun onglet vinted.fr n’est ouvert sur ce compte.',geste:`Ouvre vinted.fr ${NAV.dansNu}, connecté sur ce compte, et laisse l’onglet ouvert.`},
  compte_vinted_absent:{texte:`Un message attend : ${NAV.ce} n’est pas connecté à Vinted.`,geste:`Connecte-toi à Vinted avec ce compte ${NAV.dansNu}.`},
  compte_vinted_different:{texte:`Un message attend : ${NAV.ce} est connecté à un autre compte Vinted.`,geste:'Passe sur ce compte dans l’onglet vinted.fr.'},
  extension_indisponible:{texte:'Un message attend : l’extension ne répond pas.',geste:`Recharge l’extension ${NAV.dansNu}, puis recharge VRM.`},
  extension_version:{texte:'Le mode automatique demande une extension plus récente.',geste:'Installe la dernière extension (Paramètres → Extension), puis recharge-la (⟳).'},
  session_extension:{texte:'Un message attend : l’extension n’est pas reliée à ton compte VRM.',geste:'Ouvre l’extension, puis Connecter.'},
};
const PAUSE={vinted_frein:'Vinted a demandé de ralentir',pause_vinted:'Vinted a demandé de ralentir',vinted_robot:'Vinted a parlé d’activité automatisée'};

// `auto` = vue.auto renvoyée par /api/compte?mode=favoris ; `extensionAuto` =
// { disponible, code, raison } mesuré par l'app. « Pas su » (vue pas lue) ⇒ null.
export function phraseModeAuto({auto,maintenant=Date.now(),extensionAuto=null,lu=true}={}){
  if(!lu)return null;
  const reg=auto?.reglages||null,actif=reg?.actif===true;
  const pause=Number(auto?.pauseJusqua)>maintenant?Number(auto.pauseJusqua):0;
  if(!actif)return {etat:'eteint',actif:false,texte:MODE.eteint.texte,geste:'',ton:'neutre'};
  if(pause){
    const raison=PAUSE[auto?.pauseRaison]||'Vinted a demandé de ralentir';
    return {etat:'pause',actif:true,jusqua:pause,texte:`En pause jusqu’à ${heureParis(pause)} : ${raison}.`,geste:'Rien à faire, il reprend tout seul.',ton:'neutre'};
  }
  const code=auto?.demande?.code&&MODE[auto.demande.code]?auto.demande.code:null;
  if(code)return {etat:code,actif:true,texte:MODE[code].texte,geste:MODE[code].geste||'',ton:MODE[code].geste?'geste':'neutre'};
  const e=auto?.etat&&MODE[auto.etat]?auto.etat:'veille';
  if(extensionAuto&&extensionAuto.disponible===false&&MODE[extensionAuto.code]){
    const m=MODE[extensionAuto.code];
    return {etat:extensionAuto.code,actif:true,texte:(t=>t.charAt(0).toUpperCase()+t.slice(1))(m.texte.replace(/^Un message attend : /,'')),geste:m.geste,ton:'geste'};
  }
  const m=MODE[e];
  return {etat:e,actif:true,texte:m.texte,geste:m.geste||'',ton:m.geste?'geste':'neutre'};
}

// ── POURQUOI UN FAVORI N'A PAS REÇU DE MESSAGE ─────────────────────────────────
// Une raison = une phrase courte (en tête de groupe) et, s'il existe, le geste
// qui débloque. `ouvrir` : le geste est « Ouvrir sur Vinted » sur la ligne.
export const RAISONS_ECRAN={
  conversation:{texte:'déjà une conversation avec cette personne'},
  contacte_30j:{texte:'personne déjà contactée ces 30 derniers jours'},
  deja_contacte:{texte:'déjà contactée pour cette annonce'},
  vendue:{texte:'article vendu'},
  reservee:{texte:'article réservé'},
  en_pause:{texte:'annonce en pause ou masquée'},
  fermee:{texte:'annonce plus en ligne'},
  annonce_absente:{texte:'annonce absente de ton dressing vu par VRM'},
  destinataire:{texte:'VRM ne sait pas encore à qui écrire',geste:'Touche « Ouvrir » sur la ligne : VRM apprend à qui écrire.',ouvrir:true},
  expire:{texte:'favori de plus de 3 jours, laissé de côté'},
  essais_epuises:{texte:'pas pu partir après deux essais'},
  offre_refusee:{texte:'Vinted a refusé l’offre de prix'},
  offre_prix_inconnu:{texte:'prix de l’annonce illisible'},
  offre_incertaine:{texte:'Vinted n’a pas répondu clairement à l’offre',geste:'Regarde la conversation sur Vinted avant de renvoyer.'},
  ouverture:{texte:'Vinted n’a pas confirmé l’ouverture de la conversation',geste:'Regarde la conversation sur Vinted avant de renvoyer.'},
  limite_heure:{texte:'limite d’actions de l’heure atteinte',geste:'Tu pourras les renvoyer dans une heure.'},
  vinted_frein:{texte:'Vinted a demandé de ralentir'},
  vinted_robot:{texte:'Vinted a parlé d’activité automatisée'},
  vinted_refus:{texte:'Vinted a refusé l’envoi'},
  historique:{texte:'VRM n’a pas pu relire la conversation avant d’écrire'},
  ecran_quitte:{texte:'l’écran a été quitté avant l’envoi',geste:'Renvoie-les en gardant cet écran ouvert.'},
  onglet_vinted:{texte:'aucun onglet vinted.fr ouvert sur ce compte',geste:`Ouvre vinted.fr ${NAV.dansNu}, connecté sur ce compte, puis renvoie-les.`},
  compte_vinted_absent:{texte:`${NAV.Ce} n’était pas connecté à Vinted`,geste:`Connecte-toi à Vinted avec ce compte ${NAV.dansNu}, puis renvoie-les.`},
  compte_vinted_different:{texte:`${NAV.Ce} était sur un autre compte Vinted`,geste:'Passe sur ce compte dans l’onglet vinted.fr, puis renvoie-les.'},
  extension:{texte:'l’extension n’a pas répondu',geste:`Recharge l’extension ${NAV.dansNu}, puis renvoie-les.`},
  session_extension:{texte:'l’extension n’était pas reliée à ton compte VRM',geste:'Ouvre l’extension, puis Connecter.'},
  arrete:{texte:'envoi arrêté avant de partir'},
  annule:{texte:'retiré de l’envoi avant de partir'},
  verifie:{texte:'vérifié par toi sur Vinted, envoi non confirmé'},
  interrompu:{texte:'interrompu avant l’envoi'},
};
// Les codes du serveur et de l'extension → une raison d'écran.
const CODE_RAISON={
  ignore:'conversation',conversation_deja_contactee:'conversation',conversation_existante:'conversation',
  contacte_30j:'contacte_30j',deja_contacte:'deja_contacte',
  vendue:'vendue',article_vendu:'vendue',reservee:'reservee',en_pause:'en_pause',fermee:'fermee',annonce_absente:'annonce_absente',
  destinataire_non_prouve:'destinataire',identite_non_confirmee:'destinataire',
  expire:'expire',essais_epuises:'essais_epuises',offre_refusee:'offre_refusee',offre_prix_inconnu:'offre_prix_inconnu',offre_incertaine:'offre_incertaine',creation_non_confirmee:'ouverture',
  quota_extension:'limite_heure',pause_vinted:'vinted_frein',vinted_frein:'vinted_frein',vinted_robot:'vinted_robot',vinted_refus:'vinted_refus',
  historique_non_verifie:'historique',ecran_inactif:'ecran_quitte',onglet_vinted:'onglet_vinted',
  compte_vinted_absent:'compte_vinted_absent',compte_vinted_different:'compte_vinted_different',
  extension_indisponible:'extension',session_extension:'session_extension',autorisation_expiree:'arrete',
};
// Réponses incertaines de Vinted : à vérifier, jamais « pas envoyé ».
const INCERTAINES=['reponse_inconnue','incertain'];

// L'état d'UN favori, à partir de ce que le serveur a noté.
//   job      : l'entrée de la liste d'envoi (indexerContactsFavoris), ou null ;
//   journal  : les entrées du journal du mode auto pour ce favori (plus récente d'abord) ;
//   vendue   : la paire est prouvée vendue (articleFavoriVendu).
// → { code: 'a_envoyer'|'en_cours'|'a_verifier'|'envoye'|'pas_envoye', raison?, date? }
export function etatFavori({job=null,journal=[],vendue=false}={}){
  const j0=Array.isArray(journal)?journal[0]||null:null;
  const envoiJournal=Array.isArray(journal)?journal.find(x=>x?.etat==='envoye'):null;
  // (3 nov.) « Offre faite » se PROUVE : le message est parti avec ses trois écritures
  // (conversation, offre, message — `ecrits` rendu par l'extension ≥ 5.309). Sans ce
  // compte, on dit « envoyé », jamais « offre faite » (une offre refusée arrête le favori
  // depuis la 5.307, mais un envoi plus ancien a pu partir sans elle).
  if(job?.etat==='envoye')return {code:'envoye',date:job.envoyeLe||job.traiteLe||envoiJournal?.at||null,...(job.ecrits===3?{offre:true}:{})};
  if(envoiJournal)return {code:'envoye',date:envoiJournal.at||null};
  if(job?.etat==='incertain')return {code:'a_verifier'};
  if(['attente','reserve'].includes(job?.etat))return {code:'en_cours',auto:job.auto===true};
  if(vendue)return {code:'pas_envoye',raison:'vendue'};
  if(job){
    if(job.etat==='ignore')return {code:'pas_envoye',raison:'conversation'};
    if(job.etat==='annule')return {code:'pas_envoye',raison:'annule'};
    if(job.etat==='verifie')return {code:'pas_envoye',raison:'verifie'};
    return {code:'pas_envoye',raison:CODE_RAISON[job.raison]||'interrompu'};
  }
  if(j0){
    if(j0.etat==='incertain'||INCERTAINES.includes(j0.raison))return {code:'a_verifier'};
    if(['attente','en_file'].includes(j0.etat)||j0.reprise)return {code:'en_cours',auto:true};
    return {code:'pas_envoye',raison:CODE_RAISON[j0.raison]||CODE_RAISON[j0.etat]||'interrompu'};
  }
  return {code:'a_envoyer'};
}

// Les favoris rangés pour l'écran : un groupe par état (et par raison pour
// « pas envoyé »), dans l'ordre où Julien doit les regarder.
//   lignes  : favoris lus (favorisDepuisNotifications) ;
//   statut  : ligne → job (indexerContactsFavoris) ;
//   journal : vue.auto.journal ;
//   vendue  : ligne → booléen ;
//   article : itemId → { titre, numero, photo } (par IDENTITÉ, fourni par l'app).
export function groupesFavoris({lignes=[],statut=()=>null,journal=[],vendue=()=>false,article=()=>null,maintenant=Date.now()}={}){
  const parNotif=new Map();
  for(const x of Array.isArray(journal)?journal:[]){if(!x||x.notificationId==null)continue;const k=String(x.notificationId);if(!parNotif.has(k))parNotif.set(k,[]);parNotif.get(k).push(x);}
  for(const l of parNotif.values())l.sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0));
  const groupes=new Map();
  for(const ligne of lignes){
    const e=etatFavori({job:statut(ligne),journal:parNotif.get(String(ligne.id))||[],vendue:vendue(ligne)});
    const id=itemIdFavori(ligne),a=id?article(id)||null:null;
    const cle=e.code==='pas_envoye'?'pas_envoye:'+e.raison:e.code;
    if(!groupes.has(cle))groupes.set(cle,{cle,code:e.code,raison:e.raison||null,lignes:[]});
    groupes.get(cle).lignes.push({
      id:ligne.id,itemId:id,
      titre:a?.titre||'',numero:a?.numero!=null&&a.numero!==''?String(a.numero):'',photo:a?.photo||ligne.photo||null,
      pseudo:ligne.nom||'',lien:ligne.lien||null,
      detail:e.code==='envoye'?(e.date?heureParis(e.date):'date non lue'):ageFavori(ligne.date,maintenant),
      dateEnvoi:e.code==='envoye'&&Number.isFinite(new Date(Number(e.date)||Date.parse(e.date)).getTime())?new Date(Number(e.date)||Date.parse(e.date)).toISOString():null,
      ouvrir:e.code==='pas_envoye'&&RAISONS_ECRAN[e.raison]?.ouvrir===true,
    });
  }
  const rang=g=>{
    const r=g.raison&&RAISONS_ECRAN[g.raison];
    if(g.code==='a_verifier')return 0;
    if(g.code==='pas_envoye'&&r?.geste)return 1;
    if(g.code==='a_envoyer')return 2;
    if(g.code==='en_cours')return 3;
    if(g.code==='pas_envoye')return 4;
    return 5;
  };
  return [...groupes.values()].map(g=>({...g,...enteteGroupe(g)})).sort((a,b)=>rang(a)-rang(b)||b.lignes.length-a.lignes.length);
}

// L'en-tête d'un groupe : un titre, une phrase (une fois), un geste (ambre).
export function enteteGroupe(g){
  if(g.code==='a_verifier')return {titre:'À vérifier sur Vinted',phrase:'Vinted n’a pas répondu clairement : le message est peut-être parti.',geste:'Vérifie la conversation avant de relancer pour éviter un doublon, puis indique le résultat à VRM.',ton:'geste'};
  if(g.code==='a_envoyer')return {titre:'À envoyer',phrase:'',geste:'',ton:'neutre'};
  if(g.code==='en_cours')return {titre:'En cours d’envoi',phrase:'Ils partent un par un, depuis l’onglet vinted.fr de ce compte.',geste:'',ton:'neutre'};
  if(g.code==='envoye')return {titre:'Envoyés',phrase:'Envoi confirmé : ces favoris ne sont pas à relancer.',geste:'',ton:'neutre'};
  const r=RAISONS_ECRAN[g.raison]||RAISONS_ECRAN.interrompu;
  return {titre:'Pas envoyé',phrase:r.texte.charAt(0).toUpperCase()+r.texte.slice(1)+'.',geste:r.geste||'',ton:r.geste?'geste':'neutre'};
}

// Le message enregistré, dit en une phrase (l'offre à côté).
export function resumeOffre(reglages){
  const m=reglages?.offreMode,v=reglages?.offreValeur,p=reglages?.pourcentage;
  const nb=x=>String(x).replace('.',',');
  if(m==='pct'&&p)return `Avec une offre à −${p}\u00a0%${reglages.arrondi?', arrondie à l’euro':''}.`;
  if(m==='euros'&&v)return `Avec une offre à −${nb(v)}\u00a0€${reglages.arrondi?', arrondie à l’euro':''}.`;
  if(m==='prix'&&v)return `Avec une offre à ${nb(v)}\u00a0€.`;
  return 'Sans offre de prix.';
}

// ══ 3 NOVEMBRE — L'ÉCRAN « FUSION » : UNE CARTE PAR ARTICLE ═══════════════════
// Julien (3 nov., 10 h 16) : « fais une meilleure interface pour les messages aux
// favoris » — premium, peu de couleur, aucun texte explicatif, des photos,
// « article » et pas « paire ». La liste devient UNE carte par ARTICLE (identité :
// l'identifiant /items/<id> du lien, jamais le texte), avec les personnes qui l'ont
// mis en favori, UN état en une puce et UN geste.
//
// Mesuré en lecture seule sur sa base (3 nov.) : les notifications de favori
// n'ont PAS de champ `actor` (clés : body, id, image{url}, link, updated_at,
// user_id…) ; `image.url` est la PHOTO DE L'ARTICLE (une adresse par article,
// jamais un avatar) ; le texte est « <pseudo> a marqué ton article <titre> comme
// favori » ; le lien « /items/<id>/want_it/new?offering_id=<n> » ; 120 favoris
// pour 14 articles sur un compte. Vinted ne donne AUCUN avatar : la pile montre
// l'initiale du pseudo que Vinted écrit lui-même en tête de sa phrase — jamais un
// nom inventé ; pas de pseudo lisible ⇒ un rond vide.

// Le pseudo tel que Vinted l'écrit (champ `nom` si présent, sinon le premier mot
// de SA phrase, seulement s'il a la forme d'un pseudo). Affichage seulement : le
// destinataire d'un message reste prouvé par le serveur, jamais par ce texte.
const PSEUDO_RE=/^([\p{L}\p{N}._-]{1,40}) (?:a|vient d['’]) ?(?:marqué|ajouté|mis|enregistré)(?=\s|$)/u;
export function pseudoFavori(ligne){
  const nom=String(ligne?.nom||'').trim();
  if(nom)return nom.slice(0,40);
  const m=PSEUDO_RE.exec(String(ligne?.body||'').trim());
  return m?m[1]:'';
}
// Le titre que Vinted écrit dans sa phrase, pour une carte DÉJÀ identifiée par
// /items/<id> quand VRM n'a pas l'annonce (jamais pour relier quoi que ce soit).
export function titreNotification(body){
  const m=/\bton article (.{2,200}?) (?:comme favori|à ses favoris|en favori|dans ses favoris)\b/i.exec(String(body||''));
  return m?m[1].trim():'';
}
export function initialePseudo(pseudo){
  const p=String(pseudo||'').replace(/^[._\-\d]+/,'');
  const c=[...p][0]||[...String(pseudo||'')][0]||'';
  return c?c.toLocaleUpperCase('fr'):'';
}

// Les refus qui viennent de Vinted lui-même (une puce « Refusé par Vinted »).
const REFUS_VINTED=new Set(['vinted_refus','offre_refusee','vinted_frein','vinted_robot']);
// La puce d'un favori « pas envoyé », en deux ou trois mots.
const PUCE_RAISON={
  conversation:'Déjà en conversation',contacte_30j:'Déjà contacté',deja_contacte:'Déjà contacté',
  vendue:'Vendu',reservee:'Réservé',en_pause:'En pause',fermee:'Plus en ligne',annonce_absente:'Plus en ligne',
  destinataire:'À ouvrir',expire:'Trop ancien',limite_heure:'Limite de l’heure',
};
export function puceRaison(raison){return REFUS_VINTED.has(raison)?'Refusé par Vinted':PUCE_RAISON[raison]||'Pas envoyé';}
// L'état d'une PERSONNE, en mots (feuille de détail d'un article).
export function texteEtatPersonne(p){
  if(p.etat==='envoye')return p.offre?'Offre faite':'Envoyé';
  if(p.etat==='a_envoyer')return 'À envoyer';
  if(p.etat==='en_cours')return 'En cours';
  if(p.etat==='a_verifier')return 'À vérifier';
  return puceRaison(p.raison);
}

export const PERIODES_FAVORIS=[['7','7 j'],['30','30 j'],['tout','Tout']];
export function debutPeriode(periode,maintenant=Date.now()){
  const j=periode==='7'?7:periode==='30'?30:0;
  return j?maintenant-j*86400000:-Infinity;
}

// Les favoris rangés par ARTICLE.
//   lignes, statut, journal, vendue, article(itemId) → {titre, numero, photo, prix} ;
//   periode : '7' · '30' · 'tout' (date du favori ; sans date lisible ⇒ comptée dans « Tout » seulement).
// → { cartes:[…], resume:{favoris, articles, envoyes, vendus, attente} }
export function articlesFavoris({lignes=[],statut=()=>null,journal=[],vendue=()=>false,article=()=>null,maintenant=Date.now(),periode='tout'}={}){
  const debut=debutPeriode(periode,maintenant);
  const parNotif=new Map();
  for(const x of Array.isArray(journal)?journal:[]){if(!x||x.notificationId==null)continue;const k=String(x.notificationId);if(!parNotif.has(k))parNotif.set(k,[]);parNotif.get(k).push(x);}
  for(const l of parNotif.values())l.sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0));
  const cartes=new Map();
  for(const ligne of Array.isArray(lignes)?lignes:[]){
    const t=Date.parse(ligne?.date||'');
    if(debut>-Infinity&&!(Number.isFinite(t)&&t>=debut))continue;
    const itemId=itemIdFavori(ligne);
    const cle=itemId?'item:'+itemId:'sans:'+ligne.id;
    if(!cartes.has(cle)){
      let a=null;if(itemId){try{a=article(itemId)||null;}catch{a=null;}}
      const prix=Number(a?.prix);
      cartes.set(cle,{cle,itemId,titre:a?.titre||(itemId?titreNotification(ligne.body):''),numero:a?.numero!=null&&a.numero!==''?String(a.numero):'',photo:a?.photo||ligne.photo||null,prix:Number.isFinite(prix)&&prix>0?prix:null,vendu:false,personnes:[],dernier:0});
    }
    const c=cartes.get(cle);
    const estVendue=!!vendue(ligne);if(estVendue)c.vendu=true;
    const e=etatFavori({job:statut(ligne),journal:parNotif.get(String(ligne.id))||[],vendue:estVendue});
    const pseudo=pseudoFavori(ligne);
    const dateEnvoi=e.code==='envoye'&&Number.isFinite(new Date(Number(e.date)||Date.parse(e.date)).getTime())?new Date(Number(e.date)||Date.parse(e.date)).toISOString():null;
    c.personnes.push({id:ligne.id,pseudo,initiale:initialePseudo(pseudo),date:Number.isFinite(t)?t:null,etat:e.code,raison:e.raison||null,offre:e.offre===true,
      detail:e.code==='envoye'?(e.date?heureParis(e.date):'date non lue'):ageFavori(ligne.date,maintenant),dateEnvoi,
      ouvrir:e.code==='pas_envoye'&&RAISONS_ECRAN[e.raison]?.ouvrir===true});
    if(!c.photo&&ligne.photo)c.photo=ligne.photo;
    if(Number.isFinite(t)&&t>c.dernier)c.dernier=t;
  }
  const liste=[...cartes.values()].map(c=>{
    const n={a_envoyer:0,en_cours:0,a_verifier:0,envoye:0,offre:0,pas_envoye:0,refus:0};
    for(const p of c.personnes){n[p.etat]=(n[p.etat]||0)+1;if(p.offre)n.offre++;if(p.etat==='pas_envoye'&&REFUS_VINTED.has(p.raison))n.refus++;}
    return {...c,compte:n,...puceArticle(c,n)};
  });
  const rang=c=>c.geste==='verifier'?0:c.geste==='envoyer'?1:c.geste==='ouvrir'?2:c.puce.code==='en_cours'?3:4;
  liste.sort((a,b)=>rang(a)-rang(b)||b.dernier-a.dernier||String(a.cle).localeCompare(String(b.cle)));
  const resume={favoris:0,articles:liste.length,envoyes:0,vendus:0,attente:0};
  for(const c of liste){resume.favoris+=c.personnes.length;resume.envoyes+=c.compte.envoye;resume.attente+=c.compte.a_envoyer+c.compte.en_cours;if(c.vendu&&c.itemId)resume.vendus++;}
  return {cartes:liste,resume};
}

// UNE puce et UN geste par article. `ton` : 'neutre' · 'geste' (ambre : à toi de jouer).
export function puceArticle(c,n){
  if(n.a_verifier)return {puce:{code:'a_verifier',texte:'À vérifier',ton:'geste'},geste:'verifier'};
  if(n.en_cours)return {puce:{code:'en_cours',texte:'En cours',ton:'neutre'},geste:null};
  if(n.a_envoyer&&!c.vendu)return {puce:{code:'a_envoyer',texte:n.a_envoyer>1?`${n.a_envoyer} à envoyer`:'1 à envoyer',ton:'neutre'},geste:'envoyer'};
  if(c.vendu)return {puce:{code:'vendu',texte:'Vendu',ton:'neutre'},geste:null};
  if(n.refus)return {puce:{code:'refus',texte:'Refusé par Vinted',ton:'neutre'},geste:null};
  if(n.offre)return {puce:{code:'offre',texte:'Offre faite',ton:'neutre'},geste:null};
  if(n.envoye)return {puce:{code:'envoye',texte:'Envoyé',ton:'neutre'},geste:null};
  const ouvrir=c.personnes.find(p=>p.ouvrir);
  if(ouvrir)return {puce:{code:'ouvrir',texte:'À ouvrir',ton:'geste'},geste:'ouvrir'};
  const p0=c.personnes.find(p=>p.etat==='pas_envoye');
  return {puce:{code:'pas_envoye',texte:puceRaison(p0?.raison),ton:'neutre'},geste:null};
}

// Les filtres de la liste : à faire (un geste) · envoyés · tous.
export const FILTRES_ARTICLES=[['afaire','À envoyer'],['envoyes','Envoyés'],['tous','Tous']];
export function filtrerArticles(cartes,filtre){
  if(filtre==='afaire')return cartes.filter(c=>c.geste==='envoyer'||c.geste==='verifier'||c.geste==='ouvrir'||c.puce.code==='en_cours');
  if(filtre==='envoyes')return cartes.filter(c=>c.compte.envoye>0);
  return cartes;
}

// L'aperçu du message : le VRAI texte, variables remplacées sur un favori réel,
// et l'offre sur le prix d'un article réel quand VRM le connaît.
//   personnaliser, prixOffre : les fonctions de src/favorisMessage.js (règle unique).
export function apercuMessageFavori({message='',offre=null,exemple=null,personnaliser,prixOffre}={}){
  const texte=message?personnaliser(message,exemple?.pseudo||'',()=>0):'';
  let offreTxt='';
  if(offre&&offre.mode){
    const prix=Number(exemple?.prix);
    const apres=Number.isFinite(prix)&&prix>0?prixOffre(prix,offre):null;
    const eur=x=>Number(x).toFixed(2).replace('.',',').replace(/,00$/,'')+'\u00a0€';
    if(apres)offreTxt=`${eur(prix)} → ${eur(apres)}`;
    else if(offre.mode==='pct')offreTxt=`Offre −${offre.valeur}\u00a0%`;
    else if(offre.mode==='euros')offreTxt=`Offre −${eur(offre.valeur)}`;
    else offreTxt=`Offre à ${eur(offre.arrondi?Math.floor(offre.valeur):offre.valeur)}`;
  }
  return {texte,offre:offreTxt};
}
