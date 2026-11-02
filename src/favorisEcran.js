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
  garde_absente:{texte:'Rien ne part : VRM n’a pas pu vérifier tes paires vendues ailleurs.',geste:'Ouvre une fois l’écran Annonces de VRM.'},
  dressing_absent:{texte:'Rien ne part : VRM n’a pas vu ton dressing.',geste:'Ouvre ton dressing sur vinted.fr avec ce compte.'},
  dressing_ancien:{texte:'Rien ne part : ton dressing a été vu il y a plus de 24 h.',geste:'Ouvre ton dressing sur vinted.fr avec ce compte.'},
  dressing_partiel:{texte:'Rien ne part : VRM n’a vu qu’une partie de ton dressing.',geste:'Ouvre ton dressing sur vinted.fr et fais-le défiler jusqu’au bout.'},
  boite_ancienne:{texte:'Rien ne part : tes conversations Vinted n’ont pas été relues depuis 24 h.',geste:'Ouvre ta messagerie sur vinted.fr avec ce compte.'},
  capture:{texte:'Rien ne part : VRM n’a pas encore vu les favoris de ce compte.',geste:'Ouvre la cloche de Vinted avec ce compte.'},
  destinataire_non_prouve:{texte:'Rien ne part : VRM ne sait pas encore à qui écrire.',geste:'Touche « Ouvrir » sur un favori plus bas : VRM apprend à qui écrire.'},
  reglages:{texte:'Rien ne part : aucun message enregistré.',geste:'Écris ton message ci-dessous, puis Enregistrer.'},
  extension:{texte:'Un message est prêt, mais l’extension ne peut pas l’envoyer.',geste:'Ouvre vinted.fr dans Chrome sur ce compte, avec l’extension à jour.'},
  onglet_vinted:{texte:'Un message attend : aucun onglet vinted.fr n’est ouvert sur ce compte.',geste:'Ouvre vinted.fr dans Chrome, connecté sur ce compte, et laisse l’onglet ouvert.'},
  compte_vinted_absent:{texte:'Un message attend : Chrome n’est pas connecté à Vinted.',geste:'Connecte-toi à Vinted avec ce compte dans Chrome.'},
  compte_vinted_different:{texte:'Un message attend : Chrome est connecté à un autre compte Vinted.',geste:'Passe sur ce compte dans l’onglet vinted.fr.'},
  extension_indisponible:{texte:'Un message attend : l’extension ne répond pas.',geste:'Recharge l’extension dans Chrome (⟳), puis recharge VRM.'},
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
  vendue:{texte:'paire vendue'},
  reservee:{texte:'paire réservée'},
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
  onglet_vinted:{texte:'aucun onglet vinted.fr ouvert sur ce compte',geste:'Ouvre vinted.fr dans Chrome, connecté sur ce compte, puis renvoie-les.'},
  compte_vinted_absent:{texte:'Chrome n’était pas connecté à Vinted',geste:'Connecte-toi à Vinted avec ce compte dans Chrome, puis renvoie-les.'},
  compte_vinted_different:{texte:'Chrome était sur un autre compte Vinted',geste:'Passe sur ce compte dans l’onglet vinted.fr, puis renvoie-les.'},
  extension:{texte:'l’extension n’a pas répondu',geste:'Recharge l’extension dans Chrome (⟳), puis renvoie-les.'},
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
  if(job?.etat==='envoye')return {code:'envoye',date:job.envoyeLe||job.traiteLe||envoiJournal?.at||null};
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
  if(g.code==='a_verifier')return {titre:'À vérifier sur Vinted',phrase:'Vinted n’a pas répondu clairement : le message est peut-être parti.',geste:'Regarde la conversation sur Vinted, puis dis-le à VRM.',ton:'geste'};
  if(g.code==='a_envoyer')return {titre:'À envoyer',phrase:'',geste:'',ton:'neutre'};
  if(g.code==='en_cours')return {titre:'En cours d’envoi',phrase:'Ils partent un par un, depuis l’onglet vinted.fr de ce compte.',geste:'',ton:'neutre'};
  if(g.code==='envoye')return {titre:'Envoyés',phrase:'',geste:'',ton:'neutre'};
  const r=RAISONS_ECRAN[g.raison]||RAISONS_ECRAN.interrompu;
  return {titre:'Pas envoyé',phrase:r.texte.charAt(0).toUpperCase()+r.texte.slice(1)+'.',geste:r.geste||'',ton:r.geste?'geste':'neutre'};
}

// Le message enregistré, dit en une phrase (l'offre à côté).
export function resumeOffre(reglages){
  const m=reglages?.offreMode,v=reglages?.offreValeur,p=reglages?.pourcentage;
  const nb=x=>String(x).replace('.',',');
  if(m==='pct'&&p)return `Avec une offre à −${p} %${reglages.arrondi?', arrondie à l’euro':''}.`;
  if(m==='euros'&&v)return `Avec une offre à −${nb(v)} €${reglages.arrondi?', arrondie à l’euro':''}.`;
  if(m==='prix'&&v)return `Avec une offre à ${nb(v)} €.`;
  return 'Sans offre de prix.';
}
