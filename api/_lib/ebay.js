import { sbCle } from './cle.js';
// Base cloisonnée : sans propriétaire ni cible (owner,id), l'écriture est refusée.
import { withOwnerAll, conflictTarget } from './owner.js';
// La base sait-elle séparer les vendeurs ? (trois états, voir session.js)
import { baseCloisonnee } from './session.js';
// api/_lib/ebay.js — la logique OAuth eBay, en UN seul endroit (§11).
// Utilisée par api/ebay.js (l'app pilote, et `?mode=callback`, le retour de
// consentement d'eBay). Une seule règle : les clés vivent dans les variables
// Vercel, les jetons ne repartent jamais vers le navigateur, on ne ment jamais
// sur un échec — et (5 octobre) chaque vendeur a SES jetons et SES lignes :
// toute fonction qui lit ou écrit reçoit le vendeur en paramètre (`owner`).

const EBAY_AUTH_URL  = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
// ⚠️ Scopes demandés à la CONSENTEMENT (authorize). `sell.finances` (lecture)
// ouvre le solde à virer (getSellerFundsSummary). Il n'entre en vigueur qu'au
// PROCHAIN consentement : un jeton déjà accordé SANS ce droit ne l'a pas — c'est
// pourquoi le rafraîchissement (accessToken) ne redemande AUCUN scope (voir
// plus bas), sinon eBay refuserait un droit non accordé et casserait TOUT accès.
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.finances',
].join(' ');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const TOKENS_ID = 'ebay_tokens';

// ⚠️ TOUT est lu à l'APPEL (jamais à l'import) : une fonction serverless
// capturerait sinon un env absent au chargement (piège vu au banc).
const appId  = () => process.env.EBAY_APP_ID || '';
const certId = () => process.env.EBAY_CERT_ID || '';
// Le « RuName » (URL de redirection) configuré dans le portail eBay Developer.
const ruName = () => process.env.EBAY_RUNAME || process.env.EBAY_REDIRECT || '';
// ⚠️ REPLI SUR LA CLÉ PUBLIQUE « anon », comme api/push.js et api/email-inbound.js.
// Sans lui, la route eBay n'avait AUCUNE clé pour ranger/lire le jeton quand
// SUPABASE_SERVICE_KEY n'est pas posée sur Vercel → l'échange OAuth échouait à la
// dernière ligne (« store-failed »), et status répondait « store-unreachable ».
// Tant que la base n'est pas cloisonnée, la clé anon lit/écrit app_data (mesuré).
// Le jeton n'est donc pas plus exposé que les jetons Vinted déjà en base — la
// migration RLS (SECURITE.md) protège tout d'un coup, ce jeton compris.
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxnb254enJ6amNxdGhqdGJkcHpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1ODIyMjYsImV4cCI6MjA5NTE1ODIyNn0.QJQSKILJLEpbDvBP4w7xD-olxoUjX1H2rxrYdo63GWQ';
const sbKey  = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || ANON;

const keysReady  = () => !!(appId() && certId());
const canConsent = () => !!(appId() && ruName());
const basicAuth  = () => 'Basic ' + Buffer.from(`${appId()}:${certId()}`).toString('base64');

function authUrl(state) {
  return `${EBAY_AUTH_URL}?client_id=${encodeURIComponent(appId())}`
    + `&redirect_uri=${encodeURIComponent(ruName())}`
    + `&response_type=code&scope=${encodeURIComponent(SCOPES)}`
    + (state ? `&state=${encodeURIComponent(String(state).slice(0, 120))}` : '');
}

// Jeton applicatif (client_credentials) : sert à TESTER que les clés marchent.
async function appToken() {
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status >= 500 ? 502 : r.status, error: 'eBay a refusé les clés', detail: (j && (j.error_description || j.error)) || '' };
  return { ok: true, status: 200, works: true, expires_in: j.expires_in || null };
}

// ── À QUI APPARTIENT UNE LIGNE eBAY ? (5 octobre, chaque vendeur son eBay) ────
// Julien : « tout doit être adaptable en fonction de la personne en face ».
// Jusqu'ici `ebay_tokens` et les lignes `ebay_*` étaient celles de
// l'INSTALLATION (écrites au nom de VRM_OWNER_UID, lues avec la clé de service
// SANS filtre) : un second vendeur aurait lu les jetons eBay de Julien — ou la
// première ligne venue, la sienne ou celle d'un autre.
// ⇒ Le vendeur est passé EXPLICITEMENT à chaque fonction (jamais une variable
//   de module : deux requêtes se traitent en parallèle dans la même instance).
//   Base cloisonnée : on lit `owner=eq.{vendeur}` et on écrit `owner` = lui,
//   cible `(owner,id)`. Base pas encore cloisonnée : EXACTEMENT comme avant
//   (un seul jeu de données, `withOwnerAll` / `conflictTarget`).
// ⚠️ Rétrocompatible : la ligne `ebay_tokens` de Julien porte déjà
//   owner = VRM_OWNER_UID = son identifiant — elle reste la sienne, sans rien
//   refaire.
// `null` = on ne SAIT PAS pour qui (base cloisonnée, vendeur absent ou mal
// formé) : on ne lit ni n'écrit rien — jamais « au hasard ».
const UUID_VENDEUR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function portee(owner) {
  const cloison = await baseCloisonnee();
  if (cloison) {
    if (!owner || !UUID_VENDEUR.test(String(owner))) return null;
    const o = String(owner);
    return { filtre: `&owner=eq.${encodeURIComponent(o)}`, lignes: (rows) => rows.map((r) => ({ owner: o, ...r })), conflit: 'owner,id' };
  }
  return { filtre: '', lignes: withOwnerAll, conflit: conflictTarget('id') };
}

// Écrit (fusion par id) des lignes AU NOM du vendeur. true seulement si
// l'écriture a ABOUTI (§ « on n'acquitte pas ce qu'on n'a pas rangé »).
async function ecrireLignes(rows, owner) {
  if (!sbKey()) return false;
  const p = await portee(owner);
  if (!p) return false;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=${p.conflit}`, {
      method: 'POST',
      headers: { ...sbCle(sbKey()), 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(p.lignes(rows)),
    });
    return r.ok;
  } catch (_) { return false; }
}

// Range le refresh_token côté serveur, chez CE vendeur.
async function storeRefresh(refresh, expiresInDays, owner) {
  return ecrireLignes([{ id: TOKENS_ID, data: { refresh_token: refresh, saved_at: Date.now(), refresh_expires_days: expiresInDays || null } }], owner);
}

// Échange le code de consentement contre les jetons ET les range chez `owner`
// — le vendeur qui a DEMANDÉ ce consentement (lu dans le `state` signé, ou la
// session de l'appel), jamais un identifiant envoyé par le navigateur.
async function exchangeCode(code, owner) {
  if (!code) return { ok: false, status: 400, error: 'code manquant' };
  if (!ruName()) return { ok: false, status: 503, reason: 'no-runame', error: 'RuName non configuré (EBAY_RUNAME).' };
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(ruName())}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status >= 500 ? 502 : r.status, error: 'eBay a refusé l\'échange', detail: (j && (j.error_description || j.error)) || '' };
  if (!j.refresh_token) return { ok: false, status: 502, error: 'eBay n\'a pas renvoyé de refresh_token' };
  const stored = await storeRefresh(j.refresh_token, j.refresh_token_expires_in && Math.round(j.refresh_token_expires_in / 86400), owner);
  if (!stored) return { ok: false, status: 500, reason: 'store-failed', error: 'Jetons reçus mais impossible de les ranger (SUPABASE_SERVICE_KEY manquante ou base injoignable).' };
  return { ok: true, status: 200, connected: true };
}

// Le refresh_token rangé pour CE vendeur. TROIS états, jamais deux :
// `undefined` = pas su (base injoignable, vendeur inconnu) · `''` = aucun
// compte eBay relié · la valeur. Avant, « pas su » valait « pas connecté » :
// un hoquet de la base disait « aucun compte eBay relié » à quelqu'un qui l'est.
async function lireRefresh(owner) {
  if (!sbKey()) return undefined;
  const p = await portee(owner);
  if (!p) return undefined;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${TOKENS_ID}${p.filtre}&select=refresh_token:data->>refresh_token`, {
      headers: { ...sbCle(sbKey()) },
    });
    if (!r.ok) return undefined;
    const rows = await r.json();
    if (!Array.isArray(rows)) return undefined;
    return (rows[0] && rows[0].refresh_token) || '';
  } catch (_) { return undefined; }
}
// Un compte est-il relié ? true / false / null (« pas su »).
async function hasRefresh(owner) {
  const v = await lireRefresh(owner);
  return v === undefined ? null : !!v;
}
// La valeur seule (ou null) — pour les lecteurs d'avant.
async function readRefresh(owner) { return (await lireRefresh(owner)) || null; }

// Échange le refresh_token de CE vendeur contre un access_token frais (~2 h).
async function accessToken(owner) {
  const refresh = await lireRefresh(owner);
  if (refresh === undefined) return { ok: false, status: 503, reason: 'store-unreachable', error: 'Je n\'ai pas pu lire ta connexion eBay (base injoignable) — rien n\'a été envoyé à eBay.' };
  if (!refresh) return { ok: false, status: 401, reason: 'not-connected', error: 'Aucun compte eBay relié.' };
  // ⚠️ AUCUN `scope=` ici. eBay renvoie alors TOUS les droits déjà accordés à ce
  // refresh_token. Redemander `SCOPES` casserait tout le jour où on y ajoute un
  // droit (comme `sell.finances`) que le jeton actuel n'a pas encore : eBay
  // répond `invalid_scope` et plus RIEN ne se lit. Le nouveau droit s'obtient
  // en se reconnectant (nouveau consentement), pas en le réclamant au refresh.
  const r = await fetch(EBAY_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refresh)}`,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) return { ok: false, status: r.status >= 500 ? 502 : (r.status || 502),
    reason: 'refresh-failed', error: 'Impossible de rafraîchir le jeton eBay', detail: (j && (j.error_description || j.error)) || '' };
  return { ok: true, token: j.access_token, expires_in: j.expires_in || null };
}

// Range n'importe quelle donnée captée (fusion par id), chez CE vendeur.
async function storeData(id, data, owner) {
  return ecrireLignes([{ id, data }], owner);
}

export { SCOPES, appId, certId, ruName, keysReady, canConsent, authUrl, appToken, exchangeCode, hasRefresh, readRefresh, lireRefresh, accessToken, storeData, portee };
