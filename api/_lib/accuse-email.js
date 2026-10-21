import crypto from 'node:crypto';
export const empreinteEmail = corps => crypto.createHash('sha256').update(JSON.stringify(corps)).digest('hex');
// Accusé émis seulement après les écritures confirmées de la requête.
export function accuseEmail(messageId, corps, empreinte) {
 if(!messageId || !/^[a-f0-9]{64}$/.test(empreinte||'') || !(corps?.ok===true || corps?.garde===true))return null;
 const verification=corps.quarantaine===true || corps.garde===true || corps.type==='ignoré';
 return {messageId:String(messageId),stocke:true,empreinte,classement:verification?'a-verifier':String(corps.type||'information')};
}
