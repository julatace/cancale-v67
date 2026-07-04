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
//
// AUTO-REFRESH DES TOKENS (ajouté) : les access_token Vinted expirent au bout
// d'environ 2h. Quand un appel renvoie 401, ce proxy tente un refresh via
// POST /web/api/auth/refresh (host www.vinted.fr) avec le refresh_token_web,
// récupère un nouveau access_token ET un nouveau refresh_token (Vinted fait
// tourner le refresh_token à chaque refresh - l'ancien devient invalide), puis
// rejoue la requête d'origine. Les nouveaux tokens sont renvoyés au client dans
// le champ "refreshed" pour qu'App.jsx les persiste (state + Supabase). SANS
// cette persistance, le refresh suivant échouerait car le refresh_token stocké
// serait déjà consommé.

// Vinted utilise DEUX hosts differents selon l'endpoint (trouve via plusieurs
// "Copy as fetch" reels) : www.vinted.fr/api/v2/... pour les commandes/ventes,
// api.vinted.fr/... (sans /api/v2) pour d'autres services comme les notifs.
const ALLOWED_HOSTS = [
  'www.vinted.fr', 'www.vinted.com', 'www.vinted.it', 'www.vinted.de',
  'api.vinted.fr', 'api.vinted.com', 'api.vinted.it', 'api.vinted.de',
];

// Host "site" (www.*) correspondant a un host donne. Le refresh se fait
// toujours sur le domaine site, jamais sur le sous-domaine api.*.
const siteHostFor = (h) => (h && h.startsWith('api.')) ? h.replace(/^api\./, 'www.') : (h || 'www.vinted.fr');

// Construit les headers communs a un appel Vinted pour un access_token donne.
function buildHeaders({ token, anonId, csrfToken, isApiSubdomain, hasBody }) {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'locale': 'fr-FR',
    'x-anon-id': anonId || '',
    'x-csrf-token': csrfToken || '',
  };
  if (isApiSubdomain) {
    headers['platform'] = 'web';
    headers['x-next-app'] = 'marketplace-web';
  }
  if (hasBody) headers['Content-Type'] = 'application/json';
  return headers;
}

// Reconstitue l'en-tete Cookie a partir des tokens.
function buildCookie({ token, refreshToken, anonId }) {
  const parts = [`access_token_web=${token}`];
  if (refreshToken) parts.push(`refresh_token_web=${refreshToken}`);
  if (anonId) parts.push(`anon_id=${anonId}`);
  return parts.join('; ');
}

// Extrait la valeur d'un cookie depuis les en-tetes Set-Cookie de la reponse.
// Node/undici expose getSetCookie() (tableau) ; fallback sur get('set-cookie').
function readSetCookie(resHeaders, name) {
  let list = [];
  try { if (typeof resHeaders.getSetCookie === 'function') list = resHeaders.getSetCookie(); } catch { /* ignore */ }
  if ((!list || !list.length)) {
    const raw = resHeaders.get('set-cookie');
    if (raw) list = [raw];
  }
  for (const c of list) {
    const m = new RegExp(`(?:^|,\\s*)${name}=([^;]+)`).exec(c);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

// Tente de rafraichir les tokens. Renvoie { access_token, refresh_token } ou null.
async function refreshTokens({ siteHost, token, refreshToken, anonId, csrfToken }) {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`https://${siteHost}/web/api/auth/refresh`, {
      method: 'POST',
      headers: {
        'Cookie': buildCookie({ token, refreshToken, anonId }),
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'x-anon-id': anonId || '',
        'x-csrf-token': csrfToken || '',
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) return null;
    let json = {};
    try { json = await res.json(); } catch { json = {}; }
    // Les nouveaux tokens sont soit dans le corps JSON, soit dans Set-Cookie.
    const newAccess = json.access_token || readSetCookie(res.headers, 'access_token_web');
    const newRefresh = json.refresh_token || readSetCookie(res.headers, 'refresh_token_web') || refreshToken;
    if (!newAccess) return null;
    return { access_token: newAccess, refresh_token: newRefresh };
  } catch {
    return null;
  }
}

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

  const targetHost = host && ALLOWED_HOSTS.includes(host) ? host : 'www.vinted.fr';
  const url = `https://${targetHost}${endpoint}`;
  const isApiSubdomain = targetHost.startsWith('api.');
  const hasBody = !!body;

  // Effectue l'appel Vinted avec un access_token donne. Renvoie l'objet Response fetch.
  const doCall = (accessToken, refreshTok) => fetch(url, {
    method: method || 'GET',
    headers: {
      ...buildHeaders({ token: accessToken, anonId, csrfToken, isApiSubdomain, hasBody }),
      'Cookie': buildCookie({ token: accessToken, refreshToken: refreshTok, anonId }),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  try {
    let vintedRes = await doCall(token, refreshToken);
    let refreshed = null;

    // Token expire -> on tente un refresh puis on rejoue une seule fois.
    if (vintedRes.status === 401 && refreshToken) {
      const nt = await refreshTokens({
        siteHost: siteHostFor(targetHost), token, refreshToken, anonId, csrfToken,
      });
      if (nt) {
        refreshed = nt;
        vintedRes = await doCall(nt.access_token, nt.refresh_token);
      }
    }

    const text = await vintedRes.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    res.status(200).json({
      status: vintedRes.status,
      ok: vintedRes.ok,
      data: json,
      // Present uniquement si un refresh a eu lieu : le client DOIT persister
      // ces tokens (sinon le refresh_token consomme rend les appels suivants KO).
      refreshed,
    });
  } catch (err) {
    res.status(500).json({ error: 'Échec de la requête vers Vinted', detail: String(err) });
  }
}
