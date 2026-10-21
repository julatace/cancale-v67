// Même règle côté serveur et affichage. On reconnaît un événement, pas un
// modèle HTML précis. Une disponibilité et un retrait effectif sont distincts.
const normaliser=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
export const normaliserSuivi=v=>String(v||'').toUpperCase().replace(/[\s\u00a0-]+/g,'').trim();
function lire(texte){
 const t=normaliser(texte);if(!t)return null;
 const negatif=/(?:n[' ]a\s+pas|n[' ]avez\s+pas|pas\s+encore|non)\s+(?:ete\s+)?(?:retire|recupere|receptionne)|(?:n'a|n'avez)\s+(?:toujours\s+|encore\s+)?pas\s+(?:encore\s+)?(?:ete\s+)?(?:retire|recupere|receptionne)/.test(t);
 const retrait=/\b(?:a|ont)\s+(?:bien\s+)?ete\s+(?:retire|recupere)|\b(?:vous\s+)?avez\s+(?:bien\s+)?(?:retire|recupere)|merci\s+d'avoir\s+(?:bien\s+)?(?:retire|recupere)|\bcolis\s+(?:bien\s+)?(?:retire|recupere)|\b(?:retire|recupere)\s+(?:le\s+\d|par\s+(?:l'acheteur|le\s+destinataire|vous))|retrait\s+(?:du|de\s+votre|de\s+ton)\s+colis\s+(?:confirme|effectue)|remis\s+(?:au\s+destinataire|en\s+mains?\s+propres)/.test(t);
 if(retrait&&!negatif)return 'delivered';
 const point=/\b(?:livre|arrive|depose)\s+(?:dans\s+(?:le|la)|au|en|chez|a\s+(?:la|une|un))\s+(?:point|relais|consigne|casier|locker|bureau)/.test(t);
 if(point||/disponible|a\s+retirer|(?:vous|t')\s*attend|pret\s+(?:pour\s+le\s+retrait|a\s+etre\s+retire)/.test(t)||negatif)return 'available';
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
