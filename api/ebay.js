// api/ebay.js — AUTHENTIFICATION eBay (OAuth2), pilotée par l'app.
// La logique vit dans api/_lib/ebay.js (§11, partagée avec api/ebay-callback.js).
//
// Actions (POST body `action`) :
//   • GET               → santé : l'app sait si eBay est « branché / à configurer » ;
//   • POST authurl      → l'URL de consentement eBay (c'est LUI qui autorise) ;
//   • POST apptoken     → jeton applicatif (client_credentials) : TEST des clés ;
//   • POST exchange     → échange le `code` contre les jetons (refresh rangé serveur) ;
//   • POST status       → dit seulement si un compte est relié (booléen, jamais un jeton).
//
// ⚠️ La PUBLICATION n'est pas écrite ici : elle attend la validation du compte
//    et la MESURE des vraies réponses (catégories/aspects), comme Leboncoin.
//
// SÉCURITÉ : App ID / Cert ID dans les variables Vercel, jamais dans le dépôt ;
// les jetons ne repartent jamais vers le navigateur ; échecs honnêtes (503 sans
// clés, un refus eBay remonte, jamais un 200 qui ment).

import { keysReady, canConsent, ruName, authUrl, appToken, exchangeCode, hasRefresh } from './_lib/ebay.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ready: keysReady(), canConsent: canConsent(), env: 'production' });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }

  const b = req.body || {};
  const action = String(b.action || '');

  if (!keysReady()) {
    res.status(503).json({ ok: false, reason: 'no-key',
      error: 'eBay indisponible : EBAY_APP_ID / EBAY_CERT_ID ne sont pas configurés sur Vercel.' });
    return;
  }

  try {
    if (action === 'authurl') {
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame',
        error: 'Le RuName (URL de redirection) n\'est pas configuré (EBAY_RUNAME).' }); return; }
      res.status(200).json({ ok: true, url: authUrl(b.state) });
      return;
    }
    if (action === 'apptoken') {
      const r = await appToken();
      res.status(r.status).json(r.ok ? { ok: true, works: true, expires_in: r.expires_in || null }
        : { ok: false, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'exchange') {
      const r = await exchangeCode(String(b.code || '').trim());
      res.status(r.status).json(r.ok ? { ok: true, connected: true }
        : { ok: false, reason: r.reason, error: r.error, detail: r.detail || '' });
      return;
    }
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
