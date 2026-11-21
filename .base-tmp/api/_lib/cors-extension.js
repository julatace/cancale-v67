// api/_lib/cors-extension.js
// ────────────────────────────────────────────────────────────────────────────
// (8 nov., Julien : « je viens de remettre VRM dans Orion et toujours pas les
// ventes ») L'extension appelle vrm.center (ventes légères `mode=commandes`,
// favoris, relais, notifications). Chrome laisse un service worker d'extension
// faire ces appels sans contrôle CORS ; ORION (WebKit, iPhone) applique le
// contrôle comme pour une page : il envoie d'abord une requête OPTIONS — à
// laquelle nos routes répondaient 405, sans `Access-Control-Allow-Origin` — et
// l'envoi réel ne partait JAMAIS (« réseau » côté extension, en boucle).
//
// Règle : seules les origines d'EXTENSION (chrome-extension, moz-extension,
// safari-web-extension) et vrm.center lui-même reçoivent l'autorisation, pour
// les en-têtes `Authorization` et `Content-Type` et les méthodes GET/POST.
// Aucune donnée n'est exposée de plus : chaque route exige toujours le jeton de
// session du vendeur (`Authorization: Bearer …`), jamais un cookie
// (`Access-Control-Allow-Credentials` n'est PAS posé).
// Le nom exact qu'Orion donne à ses extensions n'est pas mesuré : toute origine
// « <navigateur>-extension:// » (chrome-, moz-, safari-web-, webkit-…) est admise.
export const RE_ORIGINE_EXTENSION = /^[a-z]+(?:-[a-z]+)*-extension:\/\/[A-Za-z0-9._-]{1,128}$/;
export const ORIGINES_SITE = new Set(['https://vrm.center']);
export function origineAutorisee(origine) {
  const o = String(origine || '');
  return RE_ORIGINE_EXTENSION.test(o) || ORIGINES_SITE.has(o);
}
// Pose les en-têtes CORS si l'origine est autorisée. Rend true si la requête
// était un préalable OPTIONS (déjà répondu : l'appelant s'arrête).
export function corsExtension(req, res) {
  const origine = req && req.headers ? (req.headers.origin || req.headers.Origin || '') : '';
  const ok = origineAutorisee(origine);
  if (ok) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req && req.method === 'OPTIONS') {
    res.statusCode = ok ? 204 : 403;
    res.end();
    return true;
  }
  return false;
}
