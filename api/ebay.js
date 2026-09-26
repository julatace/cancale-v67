// api/ebay.js — AUTHENTIFICATION eBay (OAuth2), la brique serveur de la
// publication directe VRM → eBay via l'API officielle (Sell API).
//
// CE QUE FAIT CETTE ROUTE (et RIEN de plus pour l'instant) :
//   • GET               → santé : l'app sait si eBay est « branché / à configurer » ;
//   • POST authurl      → l'URL de consentement eBay (c'est LUI qui autorise son
//                         compte vendeur sur la page d'eBay — jamais de mot de passe
//                         qui passe par nous) ;
//   • POST exchange     → échange le `code` de retour contre les jetons, et RANGE
//                         le refresh_token CÔTÉ SERVEUR (Supabase, clé de service) ;
//   • POST apptoken     → jeton applicatif (client_credentials) : sert à TESTER que
//                         les clés marchent, sans toucher au compte ;
//   • POST status       → dit seulement si un compte est relié (booléen), jamais un jeton.
//
// ⚠️ LA PUBLICATION D'ANNONCES N'EST PAS ÉCRITE ICI. Elle attend (1) que le
//    compte eBay soit validé et (2) que les vraies réponses de l'API soient
//    MESURÉES — même discipline que Leboncoin : on ne publie pas à l'aveugle.
//
// SÉCURITÉ (comme api/ai.js et api/email-inbound.js) :
//   • App ID / Cert ID vivent UNIQUEMENT dans les variables d'environnement
//     Vercel (EBAY_APP_ID, EBAY_CERT_ID). JAMAIS dans le code (dépôt public).
//   • Les JETONS (access/refresh) ne sont JAMAIS renvoyés au navigateur : le
//     refresh_token est rangé côté serveur (Supabase, SUPABASE_SERVICE_KEY).
//   • Sans clés → 503 honnête. Un refus eBay REMONTE : on ne répond jamais 200
//     sur un échec (« les routes api n'avaient jamais appris la leçon »).

// eBay est stable : ces adresses ne bougent pas. Environnement de PRODUCTION.
const EBAY_AUTH_URL  = 'https://auth.ebay.com/oauth2/authorize';
const EBAY_TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
// Scopes minimaux pour VENDRE (créer/gérer des annonces + le compte vendeur).
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
].join(' ');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lgonxzrzjcqthjtbdpzo.supabase.co';
// La clé de SERVICE (jamais dans le dépôt) : c'est la seule qui a le droit
// d'écrire un jeton. À défaut la clé publique, mais alors le stockage peut
// échouer si RLS est actif — et on le DIRA (jamais un « connecté » menteur).
// ⚠️ Lue à l'APPEL (comme appId/certId), pas à l'import : une fonction
// serverless capture sinon un env absent au chargement (piège vu au banc).
const sbKey = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const TOKENS_ID = 'ebay_tokens';

const appId  = () => process.env.EBAY_APP_ID || '';
const certId = () => process.env.EBAY_CERT_ID || '';
// L'URL de redirection = le « RuName » configuré dans le portail eBay Developer.
// C'est LUI qui le crée (My Account → User Tokens → Get a Token from eBay via
// Your Application → redirect settings). Sans lui, pas de consentement possible.
const ruName = () => process.env.EBAY_RUNAME || process.env.EBAY_REDIRECT || '';

function basicAuth() {
  return 'Basic ' + Buffer.from(`${appId()}:${certId()}`).toString('base64');
}

// Range le refresh_token côté serveur. Rend true seulement si l'écriture a
// VRAIMENT abouti (§ « on n'acquitte pas ce qu'on n'a pas rangé »).
async function storeRefresh(refresh, expiresInDays) {
  if (!sbKey()) return false;
  try {
    const body = [{ id: TOKENS_ID, data: { refresh_token: refresh, saved_at: Date.now(),
      refresh_expires_days: expiresInDays || null } }];
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}`,
        'content-type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    });
    return r.ok;
  } catch (_) { return false; }
}

async function hasRefresh() {
  if (!sbKey()) return null;   // pas de clé de service → on ne SAIT pas (≠ « non »)
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.${TOKENS_ID}&select=data->>refresh_token`, {
      headers: { apikey: sbKey(), Authorization: `Bearer ${sbKey()}` },
    });
    if (!r.ok) return null;                         // « pas su » ≠ « non »
    const rows = await r.json();
    return !!(Array.isArray(rows) && rows[0] && rows[0].refresh_token);
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  // ── SANTÉ : l'app affiche « eBay branché / à configurer » ──────────────────
  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      ready: !!(appId() && certId()),   // les clés sont posées
      canConsent: !!(appId() && ruName()), // + le RuName → on peut demander le consentement
      env: 'production',
    });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }

  const b = req.body || {};
  const action = String(b.action || '');

  if (!appId() || !certId()) {
    // 503 = « pas configuré », jamais un 200 qui ment. L'app le sait et affiche
    // « ajoute tes clés eBay dans Vercel ».
    res.status(503).json({ ok: false, reason: 'no-key',
      error: 'eBay indisponible : EBAY_APP_ID / EBAY_CERT_ID ne sont pas configurés sur Vercel.' });
    return;
  }

  try {
    // ── L'URL DE CONSENTEMENT (c'est LUI qui autorise sur eBay) ──────────────
    if (action === 'authurl') {
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame',
        error: 'Le RuName (URL de redirection) n\'est pas configuré (EBAY_RUNAME). À créer dans le portail eBay Developer.' }); return; }
      const u = `${EBAY_AUTH_URL}?client_id=${encodeURIComponent(appId())}`
        + `&redirect_uri=${encodeURIComponent(ruName())}`
        + `&response_type=code&scope=${encodeURIComponent(SCOPES)}`
        + (b.state ? `&state=${encodeURIComponent(String(b.state).slice(0, 120))}` : '');
      res.status(200).json({ ok: true, url: u });
      return;
    }

    // ── JETON APPLICATIF (client_credentials) : TEST que les clés marchent ────
    if (action === 'apptoken') {
      const r = await fetch(EBAY_TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=client_credentials&scope=${encodeURIComponent('https://api.ebay.com/oauth/api_scope')}`,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { res.status(r.status >= 500 ? 502 : r.status).json({ ok: false,
        error: 'eBay a refusé les clés', detail: (j && (j.error_description || j.error)) || '' }); return; }
      // On ne renvoie PAS le jeton — juste la preuve que les clés sont bonnes.
      res.status(200).json({ ok: true, works: true, expires_in: j.expires_in || null });
      return;
    }

    // ── ÉCHANGE du code de consentement → jetons (refresh rangé serveur) ──────
    if (action === 'exchange') {
      const code = String(b.code || '').trim();
      if (!code) { res.status(400).json({ ok: false, error: 'code manquant' }); return; }
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame', error: 'RuName non configuré (EBAY_RUNAME).' }); return; }
      const r = await fetch(EBAY_TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: basicAuth(), 'content-type': 'application/x-www-form-urlencoded' },
        body: `grant_type=authorization_code&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent(ruName())}`,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { res.status(r.status >= 500 ? 502 : r.status).json({ ok: false,
        error: 'eBay a refusé l\'échange', detail: (j && (j.error_description || j.error)) || '' }); return; }
      if (!j.refresh_token) { res.status(502).json({ ok: false, error: 'eBay n\'a pas renvoyé de refresh_token' }); return; }
      // ⚠️ ON N'ANNONCE « connecté » QUE SI ON A VRAIMENT RANGÉ LE JETON.
      const stored = await storeRefresh(j.refresh_token, j.refresh_token_expires_in && Math.round(j.refresh_token_expires_in / 86400));
      if (!stored) { res.status(500).json({ ok: false, reason: 'store-failed',
        error: 'Jetons reçus mais impossible de les ranger (SUPABASE_SERVICE_KEY manquante ou base injoignable).' }); return; }
      res.status(200).json({ ok: true, connected: true });
      return;
    }

    // ── ÉTAT : un compte est-il relié ? (booléen, jamais un jeton) ────────────
    if (action === 'status') {
      const has = await hasRefresh();
      if (has === null) { res.status(503).json({ ok: false, reason: 'store-unreachable',
        error: 'Impossible de lire l\'état (base injoignable).' }); return; }
      res.status(200).json({ ok: true, connected: !!has });
      return;
    }

    res.status(400).json({ ok: false, error: 'action inconnue' });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'eBay injoignable', detail: String((e && e.message) || '').slice(0, 200) });
  }
}
