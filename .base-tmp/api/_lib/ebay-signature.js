// ── LA SIGNATURE NUMÉRIQUE DES APPELS eBAY (15 nov., eBay complet 2) ─────────
// Pourquoi : pour un vendeur établi dans l'Union européenne ou au Royaume-Uni (Julien :
// eBay.fr), eBay EXIGE que certains appels soient signés — « toutes les méthodes de
// la Finances API », `issueRefund` (Fulfillment), les remboursements et annulations de
// la Post-Order API, `GetAccount` (Trading). Sans signature, eBay répond 403.
// Source : developer.ebay.com/develop/guides/digital-signatures-for-apis (guide
// « Digital Signatures for APIs ») et l'aperçu de la Key Management API
// (developer.ebay.com/api-docs/developer/key-management/overview.html).
// ⚠️ NON MESURÉ : aucun appel signé n'est encore parti vers eBay depuis VRM ; la forme
// suit la norme HTTP Message Signatures (RFC 9421) telle que le guide d'eBay la décrit.
//
// Constaté dans la base de production (lecture seule, 15 nov.) : AUCUNE ligne
// `ebay_finances` n'a jamais été écrite — la lecture du solde n'a jamais abouti
// (appel sans signature, et sur `api.ebay.com` au lieu de `apiz.ebay.com`).
//
// La clé : une paire Ed25519 créée UNE fois par la Key Management API d'eBay avec les
// clés de l'application VRM (`scripts/ebay-cle-signature.mjs`). Elle vit dans DEUX
// variables Vercel, jamais en base, jamais dans le navigateur :
//   EBAY_SIGNATURE_PRIVEE : la clé privée (PEM, ou le base64 PKCS#8 rendu par eBay)
//   EBAY_SIGNATURE_JWE    : la clé publique chiffrée par eBay (« jwe »)
// Absente ⇒ `cleSignature()` rend null : l'appel part sans signature, et un 403 de
// signature est DIT (« eBay exige une signature : … »), jamais pris pour « reconnecte ».
import crypto from 'crypto';

export function cleSignature(env = process.env) {
  const brut = String(env.EBAY_SIGNATURE_PRIVEE || '').trim();
  const jwe = String(env.EBAY_SIGNATURE_JWE || '').trim();
  if (!brut || !jwe) return null;
  try {
    const pem = /BEGIN/.test(brut) ? brut.replace(/\\n/g, '\n')
      : `-----BEGIN PRIVATE KEY-----\n${brut.replace(/\s+/g, '').match(/.{1,64}/g).join('\n')}\n-----END PRIVATE KEY-----\n`;
    const cle = crypto.createPrivateKey({ key: pem, format: 'pem' });
    if (cle.asymmetricKeyType !== 'ed25519') return null;
    return { cle, jwe };
  } catch (_) { return null; }
}

// L'empreinte du corps (« Content-Digest », RFC 9530) : `sha-256=:<base64>:`.
export const empreinteCorps = (corps) => 'sha-256=:' + crypto.createHash('sha256').update(Buffer.from(String(corps), 'utf8')).digest('base64') + ':';

// La « base de signature » (RFC 9421 §2.5) : une ligne par composant signé, puis
// `"@signature-params"`. `@path` = le chemin SANS la requête (`?…`).
export function baseSignature({ methode, url, jwe, digest, cree }) {
  const u = new URL(url);
  const composants = [...(digest ? ['content-digest'] : []), 'x-ebay-signature-key', '@method', '@path', '@authority'];
  const valeur = { 'content-digest': digest, 'x-ebay-signature-key': jwe, '@method': String(methode || 'GET').toUpperCase(), '@path': u.pathname, '@authority': u.host };
  const params = '(' + composants.map((c) => `"${c}"`).join(' ') + `);created=${cree}`;
  const lignes = composants.map((c) => `"${c}": ${valeur[c]}`);
  lignes.push(`"@signature-params": ${params}`);
  return { base: lignes.join('\n'), params };
}

// Les en-têtes à AJOUTER à la requête. `signe` absent (pas de clé) ⇒ {}.
export function entetesSignes(signe, { methode = 'GET', url, corps, maintenant = Date.now() } = {}) {
  if (!signe || !signe.cle || !signe.jwe || !url) return {};
  const digest = corps != null && corps !== '' ? empreinteCorps(corps) : '';
  const cree = Math.floor(maintenant / 1000);
  const { base, params } = baseSignature({ methode, url, jwe: signe.jwe, digest, cree });
  const sig = crypto.sign(null, Buffer.from(base, 'utf8'), signe.cle).toString('base64');
  return {
    'x-ebay-signature-key': signe.jwe,
    'Signature-Input': `sig1=${params}`,
    'Signature': `sig1=:${sig}:`,
    ...(digest ? { 'Content-Digest': digest } : {}),
  };
}

// Un refus d'eBay qui parle de SIGNATURE (et pas d'un droit manquant). Les codes
// 215xxx sont ceux du guide (« Signature validation failed », « Missing signature
// header »…) ; le texte est relu en repli. Rend true / false.
export function refusSignature(r) {
  if (!r || (r.status !== 400 && r.status !== 401 && r.status !== 403)) return false;
  const errs = r.data && Array.isArray(r.data.errors) ? r.data.errors : [];
  if (errs.some((e) => e && /^2151\d\d$/.test(String(e.errorId || '')))) return true;
  const t = [r.raw || '', ...errs.map((e) => `${(e && e.message) || ''} ${(e && e.longMessage) || ''}`)].join(' ');
  return /signature/i.test(t);
}
