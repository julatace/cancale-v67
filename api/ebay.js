// api/ebay.js — TOUTES les routes eBay en UNE seule fonction serverless.
//
// ⚠️ POURQUOI TOUT EN UN FICHIER : le plan Vercel Hobby limite à 12 fonctions
// serverless par déploiement. Le projet en a déjà 12 ; trois fichiers eBay
// séparés (auth + callback + deletion) faisaient passer à 15 → TOUT déploiement
// échouait (« exceeded_serverless_functions_per_deployment »), et la prod
// restait bloquée sur l'ancienne version. On route donc par `?mode=` :
//   • (défaut)        → pilotage par l'app : GET santé, POST authurl/apptoken/
//                       exchange/status ;
//   • ?mode=callback  → retour de consentement eBay (redirige vers l'app) ;
//   • ?mode=deletion  → conformité : notification de suppression de compte.
// `vercel.json` redirige /api/ebay-callback et /api/ebay-deletion vers ici, pour
// que les URLs publiques restent stables (eBay les appelle telles quelles).
//
// La logique OAuth vit dans api/_lib/ebay.js (§11, partagée). Sécurité : clés
// dans les variables Vercel, jamais dans le dépôt ; jetons jamais renvoyés au
// navigateur ; échecs honnêtes (503 sans clés, un refus eBay remonte).

import crypto from 'crypto';
import { keysReady, canConsent, ruName, authUrl, appToken, exchangeCode, hasRefresh } from './_lib/ebay.js';

// ── CONFORMITÉ : notification de suppression de compte ──────────────────────
const verifToken = () => process.env.EBAY_VERIF_TOKEN || '';
function deletionUrl(req) {
  if (process.env.EBAY_DELETION_URL) return process.env.EBAY_DELETION_URL;
  const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'vrm.center';
  return `https://${host}/api/ebay-deletion`;   // l'URL publique stable, pas le chemin interne
}
async function handleDeletion(req, res) {
  if (req.method === 'GET') {
    const code = (req.query && (req.query.challenge_code || req.query.challengeCode)) || '';
    if (!code) { res.status(200).json({ ok: true, ready: !!verifToken() }); return; }
    if (!verifToken()) { res.status(503).json({ ok: false, reason: 'no-verif-token', error: 'EBAY_VERIF_TOKEN non configuré sur Vercel.' }); return; }
    const hash = crypto.createHash('sha256');
    hash.update(String(code)); hash.update(verifToken()); hash.update(deletionUrl(req));  // ordre imposé par eBay
    res.status(200).json({ challengeResponse: hash.digest('hex') });
    return;
  }
  if (req.method === 'POST') { res.status(200).json({ ok: true }); return; }
  res.status(405).json({ ok: false, error: 'GET/POST' });
}

// ── RETOUR DE CONSENTEMENT (eBay renvoie le navigateur ici) ─────────────────
function retour(res, statut, reason) {
  const q = 'ebay=' + statut + (reason ? '&raison=' + encodeURIComponent(reason) : '');
  res.setHeader('Location', '/?' + q);
  res.status(302).end();
}
async function handleCallback(req, res) {
  const q = req.query || {};
  if (q.error) { retour(res, 'refus', String(q.error).slice(0, 60)); return; }
  const code = String(q.code || '').trim();
  if (!code) { retour(res, 'erreur', 'aucun code'); return; }
  if (!keysReady()) { retour(res, 'erreur', 'clés absentes'); return; }
  try {
    const r = await exchangeCode(code);
    retour(res, r.ok ? 'connecte' : 'erreur', r.ok ? '' : (r.reason || (r.error || '').slice(0, 60)));
  } catch (_) { retour(res, 'erreur', 'echange impossible'); }
}

// ── PILOTAGE PAR L'APP (défaut) ─────────────────────────────────────────────
async function handleApp(req, res) {
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ready: keysReady(), canConsent: canConsent(), env: 'production' });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }
  const b = req.body || {};
  const action = String(b.action || '');
  if (!keysReady()) { res.status(503).json({ ok: false, reason: 'no-key', error: 'eBay indisponible : EBAY_APP_ID / EBAY_CERT_ID ne sont pas configurés sur Vercel.' }); return; }
  try {
    if (action === 'authurl') {
      if (!ruName()) { res.status(503).json({ ok: false, reason: 'no-runame', error: 'Le RuName (EBAY_RUNAME) n\'est pas configuré.' }); return; }
      res.status(200).json({ ok: true, url: authUrl(b.state) });
      return;
    }
    if (action === 'apptoken') {
      const r = await appToken();
      res.status(r.status).json(r.ok ? { ok: true, works: true, expires_in: r.expires_in || null } : { ok: false, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'exchange') {
      const r = await exchangeCode(String(b.code || '').trim());
      res.status(r.status).json(r.ok ? { ok: true, connected: true } : { ok: false, reason: r.reason, error: r.error, detail: r.detail || '' });
      return;
    }
    if (action === 'status') {
      const has = await hasRefresh();
      if (has === null) { res.status(503).json({ ok: false, reason: 'store-unreachable', error: 'Impossible de lire l\'état (base injoignable).' }); return; }
      res.status(200).json({ ok: true, connected: !!has });
      return;
    }
    res.status(400).json({ ok: false, error: 'action inconnue' });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'eBay injoignable', detail: String((e && e.message) || '').slice(0, 200) });
  }
}

export default async function handler(req, res) {
  const mode = (req.query && req.query.mode) || '';
  if (mode === 'deletion') return handleDeletion(req, res);
  if (mode === 'callback') return handleCallback(req, res);
  return handleApp(req, res);
}
