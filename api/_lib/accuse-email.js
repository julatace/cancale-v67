import crypto from 'node:crypto';
export const empreinteEmail = corps => crypto.createHash('sha256').update(JSON.stringify(corps)).digest('hex');
// Accusé émis seulement après les écritures confirmées de la requête.
export function accuseEmail(messageId, corps, empreinte) {
 if(!messageId || !/^[a-f0-9]{64}$/.test(empreinte||'') || !(corps?.ok===true || corps?.garde===true))return null;
 const verification=corps.quarantaine===true || corps.garde===true || corps.type==='ignoré';
 return {messageId:String(messageId),stocke:true,empreinte,classement:verification?'a-verifier':String(corps.type||'information')};
}
// (12 nov.) L'E-MAIL SOURCE D'UNE LIGNE DE SUIVI : l'id de la ligne `email_reception_{clé}` que
// `repondre` (api/email-inbound.js) écrit pour CET e-mail — la même clé (`empreinteEmail(messageId)`).
// Seulement quand cette ligne sera écrite (réception connue, vendeur connu) et que l'e-mail a un
// Message-ID (sans lui, deux e-mails auraient la même clé : pas su ⇒ rien). La ligne de suivi le
// garde (`emailRecu`) pour « Voir l'e-mail » ; un e-mail sans réception garde celui d'avant.
export const ID_RECEPTION_RE = /^email_reception_[0-9a-f]{16,64}$/;
export function idReceptionDeLigne(contexte, owner) {
 if(!contexte || !contexte.reception || !owner)return null;
 const mid=contexte.messageId;
 if(typeof mid!=='string' || !mid.trim())return null;
 return `email_reception_${empreinteEmail(mid)}`;
}
