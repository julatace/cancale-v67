// api/_lib/ebay.js — la logique OAuth eBay, en UN seul endroit (§11).
// Utilisée par api/ebay.js (l'app pilote) ET api/ebay-callback.js (le retour de
// consentement d'eBay). Deux routes, une seule règle : les clés vivent dans les
// variables Vercel, les jetons ne repartent jamais vers le navigateur, et on ne
// ment jamais sur un échec.

const EBAY_AUTH_URL  = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
].join(' ');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
const TOKENS_ID = 'ebay_tokens';

// ⚠️ TOUT est lu à l'APPEL (jamais à l'import) : une fonction serverless
// capturerait sinon un env absent au chargement (piège vu au banc).
const appId  = () => process.env.EBAY_APP_ID || '';
const certId = () => process.env.EBAY_CERT_ID || '';
// Le « RuName » (URL de redirection) configuré dans le portail eBay Developer.
const ruName = () => process.env.EBAY_RUNAME || process.env.EBAY_REDIRECT || '';
const sbKey  = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

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

// Range le refresh_token côté serveur. true seulement si l'écriture a ABOUTI
// (§ « on n'acquitte pas ce qu'on n'a pas rangé »).
async function storeRefresh(refresh, expiresInDays) {
  if (!sbKey()) return false;
  try {
    const body = [{ id: TOKENS_ID, data: { refresh_token: refresh, saved_at: Date.now(), refresh_expires_days: expiresInDays || null } }];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}`, 'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch (_) { return false; }
}

// Échange le code de consentement contre les jetons ET range le refresh.
async function exchangeCode(code) {
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
  const stored = await storeRefresh(j.refresh_token, j.refresh_token_expires_in && Math.round(j.refresh_token_expires_in / 86400));
  if (!stored) return { ok: false, status: 500, reason: 'store-failed', error: 'Jetons reçus mais impossible de les ranger (SUPABASE_SERVICE_KEY manquante ou base injoignable).' };
  return { ok: true, status: 200, connected: true };
}

// Un compte est-il relié ? true / false / null (« pas su » : base injoignable).
async function hasRefresh() {
  if (!sbKey()) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${TOKENS_ID}&select=data->>refresh_token`, {
      headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return !!(Array.isArray(rows) && rows[0] && rows[0].refresh_token);
  } catch (_) { return null; }
}

export { SCOPES, appId, certId, ruName, keysReady, canConsent, authUrl, appToken, exchangeCode, hasRefresh };
