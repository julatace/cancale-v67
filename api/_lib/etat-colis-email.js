// Même règle côté serveur et affichage. On reconnaît un événement, pas un
// modèle HTML précis. Une disponibilité et un retrait effectif sont distincts.
const normaliser=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
export const normaliserSuivi=v=>String(v||'').toUpperCase().replace(/[\s\u00a0-]+/g,'').trim();
// « Sera disponible dans les prochains jours » : l'ARRIVÉE est annoncée pour plus
// tard (Chronopost « Information sur votre colis », mesuré les 22-23 oct.).
const FUTUR=/(?:sera|seront|va\s+etre|vont\s+etre)\s+(?:bientot\s+)?disponibles?\s+(?:dans\s+les\s+prochains\s+jours|prochainement|des\s+(?:demain|son\s+arrivee|reception)|a\s+partir\s+d)|disponibles?\s+(?:dans\s+les\s+prochains\s+jours|prochainement)/;
// (23 oct.) Le texte ANNONCE une arrivée à venir. Sert à la route quand l'e-mail
// ne porte NI code NI QR : un e-mail d'arrivée en porte toujours un (Mondial
// Relay le code, Chronopost code + QR, Vinted Go code + QR), une annonce jamais.
// (revue du 23 oct., n° 1) « Ton colis arrive aujourd'hui ! #… » (Vinted Go,
// mesuré : 12 lignes, AUCUNE avec un code, un QR ou un lieu) : l'ARRIVÉE est
// annoncée — le colis roule encore. ⚠️ Sans accents, « est arrivé » s'écrit
// « est arrive » : seul « <colis> arrive aujourd'hui / demain » (sans
// auxiliaire) ou « arrivera » annonce l'avenir.
const ARRIVEE_A_VENIR=/\b(?:colis|commande|paquet|envoi|article)\s+(?:arrive|arrivent)\s+(?:aujourd'hui|demain|bientot|prochainement|ce\s+(?:matin|midi|soir|jour)|dans\s+(?:la\s+journee|les\s+prochains?\s+jours?))\b|\barriver(?:a|ont)\b/;
export const annonceArriveeFuture=(texte)=>{const t=normaliser(texte);return FUTUR.test(t)||ARRIVEE_A_VENIR.test(t);};
// Les PHRASES d'un texte (le retour se juge dans SA phrase, avec ses conditions).
const phrases=(texte)=>String(texte||'').split(/[.!?;\n\r]+/).map(normaliser).filter(Boolean);
// Une phrase qui pose une condition, une échéance ou une règle générale.
const CONDITION=/(?:^|[\s,:(])(?:si|s'il|s'ils|s'elle|sinon|une\s+fois|passe\s+(?:ce|cette|le|la|les|un|une|ces)|au[\s-]dela|faute\s+d|a\s+defaut|sans\s+quoi|dans\s+le\s+cas|au\s+cas\s+ou|en\s+cas|lorsque|lorsqu'|quand|des\s+que|des\s+qu'|tant\s+que)(?=[\s,'’]|$)/;
const RETOUR=[
 // Constaté au passé : « il a été retourné à l'expéditeur ».
 /\b(?:a\s+ete|ont\s+ete)\s+(?:retourne|renvoye|reexpedie)e?s?\s+(?:a|vers|chez)\s+(?:l'|son\s+|ton\s+|votre\s+|leur\s+)?(?:expediteur|vendeur)/,
 // … ou au présent : « il est retourné / en cours de retour ».
 /\b(?:est|sont)\s+(?:en\s+cours\s+de\s+)?(?:retourne|renvoye|reexpedie)e?s?\s+(?:a|vers|chez)\s+(?:l'|son\s+|ton\s+|votre\s+|leur\s+)?(?:expediteur|vendeur)/,
 /\best\s+en\s+(?:cours\s+de\s+)?retour\s+(?:a|vers|chez)\s+(?:l'|son\s+|ton\s+|votre\s+)?(?:expediteur|vendeur)/,
 /\b(?:retour|renvoi)\s+(?:a|vers)\s+l'expediteur\s+(?:effectue|en\s+cours)/,
 /\bn'a\s+pas\s+ete\s+(?:retire|recupere)e?\s+(?:dans\s+(?:le|les)\s+delais?|a\s+temps)/,
 // Le délai, AVEC son auxiliaire (« est dépassé », « a expiré ») — jamais « expire demain ».
 /\bdelai\s+de\s+(?:retrait|garde)\s+(?:est|a)\s+(?:bien\s+)?(?:depasse|expire|ecoule)\b/,
];
const estUnRetour=(ph)=>!CONDITION.test(ph)&&RETOUR.some((r)=>r.test(ph));
// Le colis ATTEND ENCORE (dit au présent, sans négation) : « t'attend », « est
// disponible », « à retirer avant le… ». Un rappel peut aussi parler du retour
// (« sinon il sera renvoyé ») : ce qui attend n'est pas reparti.
const ATTEND=/\bt'attend\b(?!\s+plus)|\bvous\s+attend\b(?!\s+plus)|\b(?:est|sont)\s+(?:bien\s+|toujours\s+)?disponibles?\b|\ba\s+(?:retirer|recuperer)\s+(?:avant|jusqu)/;
// Le SUJET d'un rappel (mesuré : Vinted Go « Rappel : récupère ton colis avant le
// 25/09/2026 », « Libère de la place dans la consigne… », Mondial Relay « Le temps
// file : votre colis vous attend… »).
const SUJET_RAPPEL=/\brappel\b|\brecuperez?\s+(?:ton|votre)\s+colis\b|\blibere\s+de\s+la\s+place\b|\ble\s+temps\s+file\b/;
// (3 nov.) Le FUTUR et le CONDITIONNEL d'une phrase : elle n'annonce qu'un avenir.
const FUTUR_PHRASE=/\b(?:sera|seront|serait|seraient|arrivera|arriveront|arriverait|pourra|pourras|pourrez|pourront|recevras|recevrez|va\s+(?:etre|arriver)|vont\s+(?:etre|arriver)|devrait|devraient|bientot|prochainement)\b|\b(?:colis|commande|paquet|envoi|article)\s+arrivent?\s+(?:aujourd'hui|demain|ce\s+(?:matin|soir|jour)|dans\b)/;
// Ce qui CONSTATE qu'un colis attend au point (chacune est un mot entier : « indisponible »
// n'est pas « disponible »).
const CONSTAT_ARRIVEE=[
 /\bt'attend\b(?!\s+plus)|\bvous\s+attend\b(?!\s+plus)/,
 /(?:^|\b(?:est|sont|toujours|desormais|maintenant|deja|colis|commande|paquet)\s+)(?:bien\s+)?disponibles?\b/,
 /\b(?:est|sont|a\s+ete|ont\s+ete|vient\s+d'etre)\s+(?:bien\s+)?(?:arrivee?s?|livree?s?|deposee?s?)\s+(?:dans|au|aux|en|chez|a)\b.*\b(?:point|relais|consigne|casier|locker|bureau|pickup|magasin)\b/,
 /\bvient\s+d'arriver\s+(?:dans|au|en|a)\b.*\b(?:point|relais|consigne|casier|locker|pickup)\b/,
 /\ba\s+(?:retirer|recuperer)\s+(?:avant|jusqu)/,
 /\b(?:recupere|recuperez|retire|retirez)\s+(?:ton|votre)\s+colis\b/,
 /\bpret\s+(?:pour\s+le\s+retrait|a\s+etre\s+retire)/,
 /\b(?:arrive|livre|depose)e?\s+(?:en|au|dans\s+(?:le|la))\s+(?:point|relais|consigne|casier|locker)\b/,
];
const NEGATIF_RETRAIT=/(?:n[' ]a\s+pas|n[' ]avez\s+pas|pas\s+encore)\s+(?:encore\s+)?(?:ete\s+)?(?:retire|recupere)/;
export function arriveeDansPhrase(ph){
 const p=normaliser(ph);
 if(!p||CONDITION.test(p))return false;
 // « Il sera disponible JUSQU'AU 26/10 » : il EST là (la garde a une fin).
 if(FUTUR_PHRASE.test(p)&&!/\bdisponibles?\s+jusqu/.test(p))return false;
 // « Ton colis n'a pas encore été retiré » : il attend (un rappel).
 return CONSTAT_ARRIVEE.some((r)=>r.test(p))||NEGATIF_RETRAIT.test(p);
}
export const arriveeConstatee=(texte)=>phrases(texte).some(arriveeDansPhrase);
// (3 nov.) « Action requise : le colis semble avoir été perdu » (Vinted, mesuré le
// 2 nov.) était rangé « livré / retiré » et sonnait « ✅ Colis livré ». Un colis
// perdu n'est ni livré ni arrivé.
export const colisPerdu=(sujet)=>/\b(?:perdu|egare|introuvable)\b/.test(normaliser(sujet));
// (10 nov.) LE COLIS A CHANGÉ DE POINT RELAIS. Julien, sur l'e-mail Mondial Relay « Votre
// colis a changé de plan » (le point prévu est indisponible, le colis est redirigé vers un
// nouveau point) : « Regarde le colis a pas été livré c'est pas bon ». VRM l'avait montré
// livré / à retirer : le corps parle du point (« livré dans le Point Relais suivant »,
// « disponible »…). Un changement de point n'est NI une arrivée NI une livraison : le colis
// roule vers le NOUVEAU point (en route). Lu sur le SUJET d'abord (§5) ; dans le corps,
// seulement une phrase qui le CONSTATE (jamais « en cas de point indisponible », une
// condition — « Où vous livrer en cas de point indisponible ? » reste ce qu'il était).
const SUJET_CHANGEMENT_RELAIS=/\bchange\s+de\s+plan\b|\bchangement\s+de\s+(?:point|relais|lieu\s+de\s+(?:retrait|livraison)|destination)\b|\bnouveau\s+(?:point\s+(?:relais|de\s+retrait)|relais|lieu\s+de\s+(?:retrait|livraison))\b|\b(?:redirige|reachemine|reoriente)e?s?\b/;
const CORPS_CHANGEMENT_RELAIS=[
 /\b(?:a|ont)\s+(?:ete\s+)?(?:change|changes)\s+de\s+plan\b/,
 /\b(?:a\s+ete|ont\s+ete|est|sont)\s+(?:redirige|reachemine|reoriente)e?s?\b/,
 /\bpoint\s+relais\s+(?:\S+\s+){0,5}(?:est|etait)\s+(?:temporairement\s+|actuellement\s+|momentanement\s+)?(?:indisponible|ferme)e?\b/,
 /\b(?:vers|dans|au|a)\s+(?:le|un|votre|ton|ce)?\s*(?:nouveau\s+point\s+(?:relais|de\s+retrait)|point\s+relais\s+suivant)\b/,
];
export function changementDeRelais(sujet,texte=''){
 const s=normaliser(sujet);
 if(SUJET_CHANGEMENT_RELAIS.test(s))return true;
 const corps=String(texte||'').split(/(?:message d'origine|original message|forwarded message)/i)[0];
 return phrases(corps).some((p)=>!CONDITION.test(p)&&CORPS_CHANGEMENT_RELAIS.some((r)=>r.test(p)));
}
function lire(texte){
 const t=normaliser(texte);if(!t)return null;
 const negatif=/(?:n[' ]a\s+pas|n[' ]avez\s+pas|pas\s+encore|non)\s+(?:ete\s+)?(?:retire|recupere|receptionne)|(?:n'a|n'avez)\s+(?:toujours\s+|encore\s+)?pas\s+(?:encore\s+)?(?:ete\s+)?(?:retire|recupere|receptionne)/.test(t);
 const retrait=/\b(?:a|ont)\s+(?:bien\s+)?ete\s+(?:retire|recupere)|\b(?:vous\s+)?avez\s+(?:bien\s+)?(?:retire|recupere)|merci\s+d'avoir\s+(?:bien\s+)?(?:retire|recupere)|\bcolis\s+(?:bien\s+)?(?:retire|recupere)|\b(?:retire|recupere)\s+(?:le\s+\d|par\s+(?:l'acheteur|le\s+destinataire|vous))|retrait\s+(?:du|de\s+votre|de\s+ton)\s+colis\s+(?:confirme|effectue)|remis\s+(?:au\s+destinataire|en\s+mains?\s+propres)/.test(t);
 // (23 oct.) RETIRÉ PAR LE DESTINATAIRE, en néerlandais (DPD, mesuré : « Uw pakket
 // is afgehaald door de ontvanger » — le destinataire est NOMMÉ). ⚠️ L'espagnol
 // « Tu envío ha sido recogido » n'y est PAS, exprès : « recogido » dit aussi la
 // RELÈVE par le transporteur — mesuré, 6 des 8 lignes portent le n° d'une
 // « Confirmation du dépôt de votre colis » (ses propres envois). Sans preuve
 // que c'est le destinataire, ce n'est pas un retrait (une ligne « info »).
 const retireNl=/\b(?:af|op)gehaald\s+door\s+de\s+ontvanger\b/.test(t);
 if((retrait||retireNl)&&!negatif)return 'delivered';
 // (23 oct.) LE COLIS EST REPARTI CHEZ L'EXPÉDITEUR — seulement dans une phrase
 // qui le CONSTATE (passé ou présent), jamais dans une phrase qui pose une
 // condition ou annonce l'avenir : « s'il n'est pas retiré, il sera retourné »,
 // « si ton colis n'a pas été récupéré à temps… », « passé ce délai, il est
 // retourné… », « une fois le délai dépassé… » sont des RAPPELS — le colis attend
 // encore. ⚠️ (revue du 23 oct.) Sans les accents, « expire » (présent : « ton
 // délai de retrait expire demain ») s'écrivait comme « expiré » : un rappel
 // Vinted Go passait « reparti », sortait de « à retirer » et faisait sonner
 // « Colis reparti ». On ne lit donc le délai qu'avec son auxiliaire (« est
 // dépassé », « a expiré »), et chaque tournure dans SA phrase, sans condition.
 // Aucun e-mail réel de retour n'a été mesuré dans sa base (0 sur 229) : la règle
 // est étroite exprès — un retour manqué laisse le colis « à vérifier », un faux
 // retour le cache.
 if(phrases(texte).some(estUnRetour))return 'retour';
 // Le FUTUR n'est pas une arrivée : « votre colis sera disponible dans les
 // prochains jours dans votre Relais Pickup » (Chronopost « Information sur
 // votre colis », mesuré le 22-23 oct.) annonce un colis en route.
 // ⚠️ Étroit exprès : « il sera disponible JUSQU'AU 26/10 » (un colis qui EST là)
 // ne doit pas passer en transit — seul l'avenir de l'ARRIVÉE compte, et un
 // texte qui dit aussi « est disponible / t'attend » reste une arrivée.
 // (3 nov.) « dès qu'il EST disponible » (une condition) ne fait plus exception : la
 // règle des phrases (`arriveeDansPhrase`) dit seule si une arrivée est constatée.
 if((FUTUR.test(t)||ARRIVEE_A_VENIR.test(t))&&!phrases(texte).some(arriveeDansPhrase))return 'transit';
  // (3 nov.) « ARRIVÉ » SEULEMENT SUR UNE PHRASE QUI LE CONSTATE (Julien : « elles
 // disent "arrivé au point relais" alors que le message disait qu'il VA arriver »).
 // Mesuré sur sa base (journal des e-mails, 14 jours) : « Où vous livrer en cas de
 // point indisponible ? » (Mondial Relay, le colis roule encore — « disponible »
 // était lu DANS « indisponible ») et « Confirmation de commande Mondial Relay »
 // (« dès que votre colis sera disponible… ») ont été rangés « arrivé » et ont
 // sonné « 📍 Colis arrivé au point de retrait ». La règle juge chaque PHRASE :
 // un mot entier, au présent ou au passé composé, jamais dans une condition
 // (« si », « au cas où », « dès que »…) ni au futur / conditionnel.
 if(phrases(texte).some(arriveeDansPhrase))return 'available';
 if(/(?:sera|va etre|doit etre|pret a etre)\s+livre|(?:nous avons|nous avons bien|transporteur a)\s+(?:bien\s+)?recu|receptionne\s+(?:par le transporteur|dans notre)/.test(t))return 'transit';
 if(/\blivre\b|bien\s+recu|receptionne|livraison\s+(?:effectuee|reussie)/.test(t))return 'delivered';
 if(/acheminement|en\s+transit|expedie|pris\s+en\s+charge|en\s+cours\s+de\s+livraison|\ben\s+route\b|\ben\s+chemin\b/.test(t))return 'transit';
 return null;
}
export function etatColisDepuisTexte(sujet,texte='') {
 const s=normaliser(sujet);
 if(colisPerdu(sujet))return null;
 // (12 nov., mesuré : Mondial Relay 80380675, 80459659) « Où vous livrer en cas de point indisponible ? » est envoyé
 // AVANT l'arrivée (choisir un point de secours) : le colis ROULE. Rangé « disponible », il tombait dans « Lieu à
 // confirmer » avec une date estimée. Le SMS « Au cas où le point de retrait… » suit déjà cette règle.
 if(/ou vous livrer en cas de point indisponible|au cas ou le point (?:de retrait|relais)/.test(s))return 'transit';
 // (10 nov.) Un changement de point relais : le colis ROULE vers le nouveau point. Un
 // sujet qui constate l'arrivée ou le retrait (« … est disponible ») garde la main.
 if(SUJET_CHANGEMENT_RELAIS.test(s)){const l=lire(sujet);return l==='available'||l==='delivered'||l==='retour'?l:'transit';}
 if(/entre de bonnes mains|preuve de depot|confirmation du depot|depot de votre colis|colis est depose|bordereau d'envoi/.test(s)&&!/point|consigne|relais/.test(s))return 'transit';
 // Le sujet courant prime ; le texte n'est consulté que si le sujet est neutre.
 const parSujet=lire(sujet);if(parSujet)return parSujet;
 const corps=String(texte).split(/(?:message d'origine|original message|forwarded message)/i)[0];
 if(phrases(corps).some((p)=>!CONDITION.test(p)&&CORPS_CHANGEMENT_RELAIS.some((r)=>r.test(p))))return 'transit';
 const parCorps=lire(corps);
 // (revue du 23 oct.) Un retour lu dans le SEUL corps d'un e-mail au sujet neutre
 // ne vaut que si rien ne dit que le colis attend encore : le sujet d'un rappel,
 // ou une phrase du corps qui le dit au présent.
 if(parCorps==='retour'&&(SUJET_RAPPEL.test(s)||phrases(corps).some((p)=>!CONDITION.test(p)&&ATTEND.test(p))))return 'available';
 return parCorps;
}
// (revue du 23 oct.) L'ORDRE DE TRAITEMENT N'EST PAS L'ORDRE DES E-MAILS. Le
// script Gmail lit sa boîte du plus RÉCENT au plus ancien, et ses reprises
// passent plus tard : « Information… sera disponible dans les prochains jours »
// ou « votre colis est en route », traités APRÈS « arrivé en relais Pickup »,
// faisaient redescendre un colis à retirer en « en transit » — il disparaissait.
// Une ligne déjà disponible (un code, un QR ou un vrai lieu le prouvent) ne
// redescend donc jamais en transit / info, et un colis reparti ne redevient
// jamais disponible, SAUF si la date de l'e-mail (`sourceDate`, la date Gmail)
// prouve qu'il est plus récent que celui qui a posé l'état (`plusRecent`). Seuls
// « retiré » (delivered) et « reparti » (retour), par identité, font sortir un colis.
const FUTUR_LIEU=/prochains?\s+jours|prochainement|d[èe]s\s+(?:son|que)/i;
const preuveDisponible=(l)=>!!(l&&(l.code||l.qrB64||l.qrUrl||(l.lieu&&!FUTUR_LIEU.test(String(l.lieu)))));
// (10 nov., retraits irréprochables) UN « RETIRÉ » RANGÉ PAR UNE RÈGLE D'AVANT NE TIENT QUE SI SON
// PROPRE SUJET LE DIT ENCORE. Mesuré sur sa base : deux colis Mondial Relay « Votre colis a changé de
// plan » rangés « livré / retiré » (avant la règle du changement de point) ; l'e-mail suivant du même
// n° (« disponible » au NOUVEAU point, avec son code) était absorbé par « un retiré reste retiré » —
// le colis arrivé restait « en route » (relu) et n'était jamais « à retirer ». Idem « le colis semble
// avoir été perdu ». Le retiré reste retiré quand c'est un vrai retrait ; un faux, jugé sur le sujet
// qui l'a posé (§5 : le SUJET d'abord), ne garde rien.
export function retraitTenu(precedent){
 if(precedent?.status!=='delivered')return false;
 const sj=precedent.subject||precedent.sujet||precedent.sj||'';
 if(!sj)return true;
 if(colisPerdu(sj))return false;
 if(changementDeRelais(sj)&&etatColisDepuisTexte(sj)!=='delivered')return false;
 return true;
}
export function conserverRetrait(precedent,nouveau,plusRecent=false){
 if(retraitTenu(precedent))return {...nouveau,status:'delivered',label:precedent.statusLabel||'Livré / retiré'};
 if(!plusRecent&&precedent?.status==='available'&&preuveDisponible(precedent)&&['transit','info'].includes(nouveau?.status))return {...nouveau,status:'available',label:precedent.statusLabel||'Arrivé au point de retrait',conserve:true};
 if(!plusRecent&&precedent?.status==='retour'&&['available','transit','info'].includes(nouveau?.status))return {...nouveau,status:'retour',label:precedent.statusLabel||'Reparti chez l’expéditeur',conserve:true};
 if(nouveau?.status==='info'&&['available','transit'].includes(precedent?.status))return {...nouveau,status:precedent.status,label:precedent.statusLabel||'Mise à jour'};
 return nouveau;
}
