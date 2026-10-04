// api/vinted-proxy.js
// Proxy server-side vers l'API interne de Vinted.
// Pourquoi ce fichier existe : le navigateur bloque (CORS) les requêtes faites
// directement depuis cancale-v67.vercel.app vers www.vinted.fr. En passant par
// une fonction serverless Vercel (exécutée côté serveur, pas dans le navigateur),
// il n'y a plus de CORS : le front appelle "/api/vinted-proxy" (même origine),
// et c'est CE fichier qui parle à Vinted pour de vrai.
//
// Utilisation depuis App.jsx (`vintedApiCall`) :
//   fetch('/api/vinted-proxy', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json', Authorization: 'Bearer <session VRM>' },
//     body: JSON.stringify({ uid: '<vinted_user_id>', endpoint: '/api/v2/users/current' })
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

import { vendeurExige, baseCloisonnee, lireCommeVendeur } from './_lib/session.js';

// ⚠️⚠️ 4 OCTOBRE — CE PROXY ÉTAIT UN RELAIS OUVERT. N'importe qui pouvait lui
// envoyer un jeton Vinted (volé ou non) et n'importe quelle adresse Vinted,
// avec n'importe quelle méthode — DELETE compris — et la requête partait de
// l'IP de Vercel, celle de VRM. C'est le schéma que le journal accuse d'avoir
// fait bloquer un compte (§3), et il ne demandait même pas d'être connecté.
// Désormais :
//   1. la SESSION VRM est exigée (401 sinon, aucune requête à Vinted) ;
//   2. les jetons ne viennent PLUS du navigateur : on lit ceux du compte
//      demandé (`uid`) en base, AU NOM du vendeur — RLS ne lui rend que ses
//      comptes, et on filtre en plus sur son `owner` quand la base est
//      cloisonnée. Un compte qui n'est pas à lui → 403, rien ne part ;
//   3. LECTURE seulement : GET, et uniquement les adresses que l'app lit
//      vraiment (`LECTURES_PERMISES`). Les gestes (offres, réponses,
//      bordereaux) passent par l'extension, dans le navigateur du vendeur,
//      avec ses garde-fous — jamais par ici.
// Lecture des comptes ratée → 503 : on ne relaie pas sur une mesure qui n'a pas
// eu lieu.
const LECTURES_PERMISES = [
  /^\/api\/v2\/my_orders\?[\w=&.%-]*$/,
  /^\/api\/v2\/inbox\?[\w=&.%-]*$/,
  /^\/api\/v2\/conversations\/\d{1,20}$/,
  /^\/api\/v2\/transactions\/\d{1,20}$/,
  /^\/api\/v2\/users\/current$/,
  /^\/api\/v2\/wardrobe\/\d{1,20}\/items\?[\w=&.%-]*$/,
  /^\/inbox-notifications\/v1\/notifications\/unread_count$/,
];
export const lecturePermise = (endpoint) => typeof endpoint === 'string' && endpoint.length <= 300 && LECTURES_PERMISES.some((re) => re.test(endpoint));

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
  const u = await vendeurExige(req, res);
  if (!u) return;

  const { uid, endpoint, host, method, body } = req.body || {};
  if ((method && String(method).toUpperCase() !== 'GET') || body != null) {
    res.status(403).json({ erreur: 'lecture', message: 'Ce relais ne fait que lire. Les gestes passent par l\'extension.' });
    return;
  }
  if (!lecturePermise(endpoint)) {
    res.status(403).json({ erreur: 'adresse', message: 'Adresse Vinted non autorisée.' });
    return;
  }
  if (!/^\d{1,20}$/.test(String(uid || ''))) {
    res.status(400).json({ erreur: 'compte', message: 'Compte Vinted manquant.' });
    return;
  }
  const filtre = (await baseCloisonnee()) ? `&owner=eq.${encodeURIComponent(u.id)}` : '';
  const lignes = await lireCommeVendeur(req, `vinted_accounts?select=access_token,refresh_token,anon_id,csrf_token,domain&vinted_user_id=eq.${encodeURIComponent(uid)}${filtre}&limit=1`);
  if (lignes === null) {
    res.status(503).json({ erreur: 'base', message: 'La base ne répond pas — réessaie dans un instant.' });
    return;
  }
  const acc = lignes[0];
  if (!acc || !acc.access_token) {
    res.status(403).json({ erreur: 'compte', message: 'Ce compte Vinted n\'est pas relié à ta boutique.' });
    return;
  }
  const token = acc.access_token, refreshToken = acc.refresh_token, anonId = acc.anon_id, csrfToken = acc.csrf_token;
  const siteDomain = ALLOWED_HOSTS.includes(acc.domain) ? acc.domain : 'www.vinted.fr';
  const targetHost = host && ALLOWED_HOSTS.includes(host) ? host : siteDomain;
  const url = `https://${targetHost}${endpoint}`;
  const isApiSubdomain = targetHost.startsWith('api.');

  // Effectue l'appel Vinted (LECTURE) avec un access_token donne.
  const doCall = (accessToken, refreshTok) => fetch(url, {
    method: 'GET',
    headers: {
      ...buildHeaders({ token: accessToken, anonId, csrfToken, isApiSubdomain, hasBody: false }),
      'Cookie': buildCookie({ token: accessToken, refreshToken: refreshTok, anonId }),
    },
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
