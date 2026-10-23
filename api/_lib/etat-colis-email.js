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
export const annonceArriveeFuture=(texte)=>FUTUR.test(normaliser(texte));
function lire(texte){
 const t=normaliser(texte);if(!t)return null;
 const negatif=/(?:n[' ]a\s+pas|n[' ]avez\s+pas|pas\s+encore|non)\s+(?:ete\s+)?(?:retire|recupere|receptionne)|(?:n'a|n'avez)\s+(?:toujours\s+|encore\s+)?pas\s+(?:encore\s+)?(?:ete\s+)?(?:retire|recupere|receptionne)/.test(t);
 const retrait=/\b(?:a|ont)\s+(?:bien\s+)?ete\s+(?:retire|recupere)|\b(?:vous\s+)?avez\s+(?:bien\s+)?(?:retire|recupere)|merci\s+d'avoir\s+(?:bien\s+)?(?:retire|recupere)|\bcolis\s+(?:bien\s+)?(?:retire|recupere)|\b(?:retire|recupere)\s+(?:le\s+\d|par\s+(?:l'acheteur|le\s+destinataire|vous))|retrait\s+(?:du|de\s+votre|de\s+ton)\s+colis\s+(?:confirme|effectue)|remis\s+(?:au\s+destinataire|en\s+mains?\s+propres)/.test(t);
 if(retrait&&!negatif)return 'delivered';
 // (23 oct.) LE COLIS EST REPARTI CHEZ L'EXPÉDITEUR — seulement au PASSÉ ou au
 // PRÉSENT, et jamais dans une condition (« s'il n'est pas retiré, il sera
 // retourné » est un RAPPEL : le colis attend encore). Aucun e-mail réel de ce
 // genre n'a été mesuré dans sa base (0 sur 229) : la règle est étroite exprès.
 const retour=/\b(?:a\s+ete|est|ont\s+ete|sont)\s+(?:en\s+cours\s+de\s+)?(?:retourne|renvoye|reexpedie)e?s?\s+(?:a|vers|chez)\s+(?:l'|son\s+|ton\s+|votre\s+|leur\s+)?(?:expediteur|vendeur)|\best\s+en\s+(?:cours\s+de\s+)?retour\s+(?:a|vers|chez)\s+(?:l'|son\s+|ton\s+|votre\s+)?(?:expediteur|vendeur)|\b(?:retour|renvoi)\s+(?:a|vers)\s+l'expediteur\s+(?:effectue|en\s+cours)|(?<!\bsi\s)(?<!s'il\s)(?<!s'\s)\bn'a\s+pas\s+ete\s+(?:retire|recupere)\s+(?:dans\s+(?:le|les)\s+delais?|a\s+temps)|\bdelai\s+de\s+(?:retrait|garde)\s+(?:est\s+)?(?:depasse|expire|ecoule)/.test(t);
 if(retour)return 'retour';
 // Le FUTUR n'est pas une arrivée : « votre colis sera disponible dans les
 // prochains jours dans votre Relais Pickup » (Chronopost « Information sur
 // votre colis », mesuré le 22-23 oct.) annonce un colis en route.
 // ⚠️ Étroit exprès : « il sera disponible JUSQU'AU 26/10 » (un colis qui EST là)
 // ne doit pas passer en transit — seul l'avenir de l'ARRIVÉE compte, et un
 // texte qui dit aussi « est disponible / t'attend » reste une arrivée.
 if(FUTUR.test(t)&&!/\b(?:est|sont)\s+(?:bien\s+)?(?:disponibles?|arrives?)|\bt'attend|vous\s+attend/.test(t))return 'transit';
 const point=/\b(?:livre|arrive|depose)\s+(?:dans\s+(?:le|la)|au|en|chez|a\s+(?:la|une|un))\s+(?:point|relais|consigne|casier|locker|bureau)/.test(t);
 if(point||/disponible|a\s+retirer|(?:vous|t')\s*attend|pret\s+(?:pour\s+le\s+retrait|a\s+etre\s+retire)/.test(t)||negatif)return 'available';
 if(/(?:sera|va etre|doit etre|pret a etre)\s+livre|(?:nous avons|nous avons bien|transporteur a)\s+(?:bien\s+)?recu|receptionne\s+(?:par le transporteur|dans notre)/.test(t))return 'transit';
 if(/\blivre\b|bien\s+recu|receptionne|livraison\s+(?:effectuee|reussie)/.test(t))return 'delivered';
 if(/acheminement|en\s+transit|expedie|pris\s+en\s+charge|en\s+cours\s+de\s+livraison/.test(t))return 'transit';
 return null;
}
export function etatColisDepuisTexte(sujet,texte='') {
 const s=normaliser(sujet);
 if(/entre de bonnes mains|preuve de depot|confirmation du depot|depot de votre colis|colis est depose|bordereau d'envoi/.test(s)&&!/point|consigne|relais/.test(s))return 'transit';
 // Le sujet courant prime ; le texte n'est consulté que si le sujet est neutre.
 return lire(sujet)||lire(String(texte).split(/(?:message d'origine|original message|forwarded message)/i)[0]);
}
export function conserverRetrait(precedent,nouveau){
 if(nouveau?.status==='info'&&['available','transit'].includes(precedent?.status))return {...nouveau,status:precedent.status,label:precedent.statusLabel||'Mise à jour'};
 return precedent?.status==='delivered'?{...nouveau,status:'delivered',label:precedent.statusLabel||'Livré / retiré'}:nouveau;
}
