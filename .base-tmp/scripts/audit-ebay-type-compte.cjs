// Audit : PRO OU PARTICULIER pour un compte eBay (17 octobre).
// Julien : « pouvoir reconnaître un compte pro d'un compte particulier ».
// eBay le dit dans GetUser (`User.SellerInfo.SellerBusinessType` : Commercial ·
// Private · Undefined — doc d'eBay, ⚠️ NON MESURÉ sur ses comptes). On EXÉCUTE
// la vraie `identiteEbay` contre une réponse servie, et `normaliserRegistre` :
//   · Commercial ⇒ 'pro' · Private ⇒ 'particulier' ;
//   · Undefined, absent ⇒ '' (pas su — JAMAIS « particulier » par défaut) ;
//   · le type ne passe que s'il est l'une des valeurs connues (une valeur
//     écrite à la main dans la ligne n'est pas recopiée) ;
//   · l'identité (clé, pseudo) ne change pas.
const path = require('path');
const RACINE = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const reponse = (bt) => `<?xml version="1.0"?><GetUserResponse><Ack>Success</Ack><User><EIASToken>nY+sHZ2PrBmdj6wVnY+sEZ2PrA2dj6wFk4CoAZCKoQ</EIASToken><UserID>paire_pro</UserID>${bt === undefined ? '' : `<SellerInfo><AllowPaymentEdit>true</AllowPaymentEdit>${bt === null ? '' : `<SellerBusinessType>${bt}</SellerBusinessType>`}</SellerInfo>`}</User></GetUserResponse>`;
(async () => {
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://exemple.supabase.co';
  let lib;
  try { lib = await import('file://' + path.join(RACINE, 'api', '_lib', 'ebay.js')); } catch (e) { dit(false, 'chargement de api/_lib/ebay.js', String(e.message || e)); process.exit(1); }
  const vrai = global.fetch;
  const essai = async (bt) => { global.fetch = async () => ({ ok: true, status: 200, text: async () => reponse(bt) }); try { return await lib.identiteEbay('jeton'); } catch (e) { return { erreur: String(e.message || e) }; } finally { global.fetch = vrai; } };
  const c = await essai('Commercial'); const p = await essai('Private'); const u = await essai('Undefined'); const a = await essai(undefined); const n = await essai(null);
  dit(c && c.type === 'pro', 'Commercial ⇒ « pro »', JSON.stringify(c));
  dit(p && p.type === 'particulier', 'Private ⇒ « particulier »', JSON.stringify(p));
  dit(u && u.type === '', 'Undefined ⇒ pas su (« »), jamais « particulier »', JSON.stringify(u));
  dit(a && a.type === '' && n && n.type === '', 'SellerInfo absent ou sans type ⇒ pas su', JSON.stringify([a && a.type, n && n.type]));
  dit(c && /^[0-9a-f]{16}$/.test(c.cle || '') && c.pseudo === 'paire_pro' && p.cle === c.cle, 'l\'identité (clé, pseudo) ne change pas', JSON.stringify(c));
  const reg = lib.normaliserRegistre({ comptes: [
    { cle: 'a'.repeat(16), pseudo: 'x', type: 'pro', typeLuLe: 5 },
    { cle: 'b'.repeat(16), pseudo: 'y', type: 'administrateur' },
    { cle: 'c'.repeat(16), pseudo: 'z' },
    { principal: true, pseudo: 'p', type: '' },
  ] });
  const t = reg.comptes.map((e) => e.type);
  dit(t[0] === 'pro' && t[1] === undefined && t[2] === undefined && t[3] === '', 'le registre ne garde que pro · particulier · « » (et rien quand jamais demandé)', JSON.stringify(t));
  console.log(`\n${ko ? '❌' : '✅'} audit-ebay-type-compte : ${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
