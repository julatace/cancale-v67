// api/vinted-proxy.js
// Proxy server-side vers l'API interne de Vinted.
// Pourquoi ce fichier existe : le navigateur bloque (CORS) les requêtes faites
// directement depuis cancale-v67.vercel.app vers www.vinted.fr. En passant par
// une fonction serverless Vercel (exécutée côté serveur, pas dans le navigateur),
// il n'y a plus de CORS : le front appelle "/api/vinted-proxy" (même origine),
// et c'est CE fichier qui parle à Vinted pour de vrai.
//
// Utilisation depuis App.jsx :
//   fetch('/api/vinted-proxy', {
//     method: 'POST',
//     headers: {'Content-Type':'application/json'},
//     body: JSON.stringify({ token: accessTokenWeb, endpoint: '/api/v2/users/current' })
//   })

// Host reel de l'API interne de Vinted (trouve via une vraie requete "Copy as
// fetch" depuis le navigateur - www.vinted.fr/api/v2/... n'existe plus, tout
// est passe sur ce sous-domaine dedie).
const ALLOWED_HOSTS = ['api.vinted.fr', 'api.vinted.com', 'api.vinted.it', 'api.vinted.de'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non supportée, utilise POST' });
    return;
  }

  const { token, refreshToken, anonId, csrfToken, endpoint, host, method, body } = req.body || {};

  if (!token) {
    res.status(400).json({ error: 'Paramètre "token" manquant (cookie access_token_web capturé par l\'extension)' });
    return;
  }
  if (!endpoint || !endpoint.startsWith('/')) {
    res.status(400).json({ error: 'Paramètre "endpoint" manquant ou invalide (doit commencer par /)' });
    return;
  }

  const targetHost = host && ALLOWED_HOSTS.includes(host) ? host : 'api.vinted.fr';
  const url = `https://${targetHost}${endpoint}`;

  // Reconstitue les cookies necessaires (Vinted verifie access_token_web ET
  // anon_id doit correspondre au header x-anon-id).
  const cookieParts = [`access_token_web=${token}`];
  if (refreshToken) cookieParts.push(`refresh_token_web=${refreshToken}`);
  if (anonId) cookieParts.push(`anon_id=${anonId}`);

  try {
    const vintedRes = await fetch(url, {
      method: method || 'GET',
      headers: {
        'Cookie': cookieParts.join('; '),
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'Content-Type': 'application/json',
        // Headers proprietaires exiges par l'API Vinted (identifies via une
        // vraie requete du site, "Copy as fetch" dans DevTools).
        'locale': 'fr-FR',
        'platform': 'web',
        'x-anon-id': anonId || '',
        'x-csrf-token': csrfToken || '',
        'x-next-app': 'marketplace-web',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await vintedRes.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    res.status(vintedRes.status).json({
      status: vintedRes.status,
      ok: vintedRes.ok,
      data: json,
    });
  } catch (err) {
    res.status(500).json({ error: 'Échec de la requête vers Vinted', detail: String(err) });
  }
}
