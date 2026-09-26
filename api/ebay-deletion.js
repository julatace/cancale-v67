// api/ebay-deletion.js — CONFORMITÉ eBay : notification de suppression de compte.
//
// eBay exige que toute application de PRODUCTION fournisse une URL qui :
//   • répond à un « challenge » de vérification (GET ?challenge_code=…) en
//     renvoyant sha256(challengeCode + verificationToken + endpointURL) ;
//   • accuse réception (200) des notifications de suppression de compte (POST).
// Sans cet endpoint validé, l'app reste « Non Compliant » et la Production est
// bloquée (pas de RuName, pas de jetons).
//
// Le « verification token » est un secret partagé avec eBay : il vit dans la
// variable Vercel EBAY_VERIF_TOKEN (32–80 caractères), jamais dans le dépôt.
// L'URL de l'endpoint doit correspondre EXACTEMENT à celle configurée chez eBay
// (EBAY_DELETION_URL) — sinon le hash ne correspond pas.

import crypto from 'crypto';

const verifToken = () => process.env.EBAY_VERIF_TOKEN || '';
// L'URL exacte enregistrée chez eBay. À défaut, on la reconstruit depuis la
// requête (host + chemin) — mais la valeur explicite est plus sûre.
function endpointUrl(req) {
  if (process.env.EBAY_DELETION_URL) return process.env.EBAY_DELETION_URL;
  const host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'vrm.center';
  return `https://${host}/api/ebay-deletion`;
}

export default async function handler(req, res) {
  // ── VÉRIFICATION (eBay appelle en GET avec un challenge_code) ───────────────
  if (req.method === 'GET') {
    const code = (req.query && (req.query.challenge_code || req.query.challengeCode)) || '';
    if (!code) { res.status(200).json({ ok: true, ready: !!verifToken() }); return; }
    if (!verifToken()) { res.status(503).json({ ok: false, reason: 'no-verif-token',
      error: 'EBAY_VERIF_TOKEN non configuré sur Vercel.' }); return; }
    // ⚠️ ORDRE IMPOSÉ PAR eBay : challengeCode + verificationToken + endpoint.
    const hash = crypto.createHash('sha256');
    hash.update(String(code)); hash.update(verifToken()); hash.update(endpointUrl(req));
    res.status(200).json({ challengeResponse: hash.digest('hex') });
    return;
  }
  // ── NOTIFICATION DE SUPPRESSION (POST) : on accuse réception ────────────────
  if (req.method === 'POST') {
    // eBay veut un 200 rapide. (On ne stocke aucune donnée personnelle d'un
    // membre eBay tiers ; le jour où le multi-vendeur existera, c'est ici qu'on
    // effacera les données du compte concerné.)
    res.status(200).json({ ok: true });
    return;
  }
  res.status(405).json({ ok: false, error: 'GET/POST' });
}
