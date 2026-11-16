// Crée UNE fois la clé de signature des appels eBay (Key Management API, `createSigningKey`)
// et dit les deux variables à poser sur Vercel. À lancer par une session, jamais dans l'app.
//   EBAY_APP_ID=… EBAY_CERT_ID=… node scripts/ebay-cle-signature.mjs
// Source : developer.ebay.com/api-docs/developer/key-management/resources/signing_key/methods/createSigningKey
// (jeton d'APPLICATION, scope `api_scope` ; `signingKeyCipher: ED25519`).
// Ce qui sort : la clé privée (à garder secrète : seulement dans les variables Vercel
// EBAY_SIGNATURE_PRIVEE et EBAY_SIGNATURE_JWE) — rien n'est écrit sur le disque ni en base.
const id = process.env.EBAY_APP_ID || '', cert = process.env.EBAY_CERT_ID || '';
if (!id || !cert) { console.error('EBAY_APP_ID et EBAY_CERT_ID sont nécessaires.'); process.exit(1); }
const basic = 'Basic ' + Buffer.from(`${id}:${cert}`).toString('base64');
const t = await fetch('https://api.ebay.com/identity/v1/oauth2/token', { method: 'POST', headers: { Authorization: basic, 'content-type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials&scope=' + encodeURIComponent('https://api.ebay.com/oauth/api_scope') });
const tj = await t.json().catch(() => ({}));
if (!tj.access_token) { console.error('Jeton d’application refusé par eBay :', t.status, tj.error || ''); process.exit(1); }
const r = await fetch('https://apiz.ebay.com/developer/key_management/v1/signing_key', { method: 'POST', headers: { Authorization: 'Bearer ' + tj.access_token, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ signingKeyCipher: 'ED25519' }) });
const k = await r.json().catch(() => ({}));
if (!r.ok || !k.privateKey || !k.jwe) { console.error('eBay n’a pas créé la clé :', r.status, JSON.stringify(k).slice(0, 300)); process.exit(1); }
console.log('Clé créée :', k.signingKeyId, '· expire :', k.expirationTime || '?');
console.log('\nÀ poser sur Vercel (Production), puis redéployer :');
console.log('EBAY_SIGNATURE_PRIVEE=' + k.privateKey);
console.log('EBAY_SIGNATURE_JWE=' + k.jwe);
