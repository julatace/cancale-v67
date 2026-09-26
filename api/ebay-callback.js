// api/ebay-callback.js — LE RETOUR DE CONSENTEMENT eBay.
// Après que Julien a cliqué « autoriser » sur la page d'eBay, eBay renvoie SON
// navigateur ici avec un `code` (ou `error` s'il a refusé). On échange le code
// contre les jetons, on range le refresh_token côté serveur, puis on RENVOIE le
// navigateur vers l'app avec un drapeau — l'app affiche « connecté » ou l'erreur.
//
// ⚠️ Aucun jeton n'apparaît dans l'URL de retour : seulement un statut. La
// logique (échange + rangement) est partagée avec api/ebay.js (§11).
//
// C'est l'URL à mettre comme « accept URL » du RuName dans le portail eBay :
//   https://vrm.center/api/ebay-callback

import { keysReady, exchangeCode } from './_lib/ebay.js';

function retour(res, statut, reason) {
  const q = 'ebay=' + statut + (reason ? '&raison=' + encodeURIComponent(reason) : '');
  res.setHeader('Location', '/?' + q);
  res.status(302).end();
}

export default async function handler(req, res) {
  const q = req.query || {};
  // eBay a renvoyé une erreur (l'utilisateur a refusé, ou un souci côté eBay).
  if (q.error) { retour(res, 'refus', String(q.error).slice(0, 60)); return; }
  const code = String(q.code || '').trim();
  if (!code) { retour(res, 'erreur', 'aucun code'); return; }
  if (!keysReady()) { retour(res, 'erreur', 'clés absentes'); return; }
  try {
    const r = await exchangeCode(code);
    if (r.ok) { retour(res, 'connecte'); return; }
    // Échec honnête : on renvoie la RAISON (pas de jeton), l'app la montre.
    retour(res, 'erreur', r.reason || (r.error || '').slice(0, 60));
  } catch (e) {
    retour(res, 'erreur', 'echange impossible');
  }
}
