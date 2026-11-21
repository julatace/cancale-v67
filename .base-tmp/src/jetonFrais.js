// ═══════════════════════════════════════════════════════════════════════════
// UNE REQUÊTE NE PART JAMAIS AVEC UN JETON DÉJÀ EXPIRÉ (14 nov., fiabilité prod)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré dans les journaux de la base (edge_logs, 12 → 14 nov., hors bancs) :
// chaque jour 100 à 150 lectures de vrm.center refusées 401 « token is expired »
// (`request.sb.auth_user` rempli : le jeton est le bon, il a juste expiré), par
// rafales au réveil d'un Mac ou d'un iPhone (39 lectures dans la même seconde),
// et les routes `/api/*` qui relisent la session répondaient « token is expired »
// (GET /auth/v1/user 403 côté serveur). Chacune de ces lectures rendait « pas su »
// (§5 : jamais `[]`) — l'écran disait « — » le temps du tour suivant.
// La cause : `sbAuth` (App.jsx) VOIT le jeton expiré, lance le renouvellement…
// et rend l'ANCIEN jeton à la requête qui part tout de suite (« la lecture
// suivante partira avec le jeton frais »). Toutes les lectures du réveil partent
// donc avec un jeton mort, ensemble.
//
// Ici, posé une fois sur `window.fetch`, AVANT chaque requête vers la base
// (`/rest/v1/`) ou nos routes (`/api/`) qui porte le jeton de LA session :
//   · jeton expiré (ou qui expire dans les 10 s) ⇒ on ATTEND le renouvellement
//     partagé (un seul en vol, App.jsx `authRefresh`, au plus 8 s) et la requête
//     part avec le jeton neuf ; renouvellement « pas su » ⇒ elle part telle quelle
//     (rien n'est inventé, la réponse dit ce qu'elle dit) ;
//   · une requête de la BASE refusée 401 alors qu'on croyait le jeton bon (horloge,
//     jeton révoqué côté serveur) ⇒ UN renouvellement, UNE relance si le jeton a
//     changé. PostgREST refuse un 401 AVANT d'exécuter quoi que ce soit : relancer
//     n'écrit jamais deux fois. Les routes `/api/` ne sont jamais relancées ici.
// Une requête qui ne porte pas CE jeton (clé publique, autre session, `Request`
// déjà construite) passe sans être touchée. Aucun texte, aucun écran.
// ═══════════════════════════════════════════════════════════════════════════

export const MARGE_MS = 10000;
export const ATTENTE_MAX_MS = 8000;

// La valeur d'un en-tête, quelle que soit sa forme (objet, Headers, liste de paires).
export function lireEntete(init, nom) {
  const h = init && init.headers;
  if (!h) return null;
  const n = String(nom).toLowerCase();
  try {
    if (typeof h.get === 'function') return h.get(n);
    if (Array.isArray(h)) { const p = h.find((x) => Array.isArray(x) && String(x[0]).toLowerCase() === n); return p ? String(p[1]) : null; }
    for (const k of Object.keys(h)) if (k.toLowerCase() === n) return String(h[k]);
  } catch (_) {}
  return null;
}
// Une copie de `init` dont l'en-tête Authorization porte `jeton` (l'original n'est pas touché).
export function avecJeton(init, jeton) {
  const v = `Bearer ${jeton}`;
  const h = init && init.headers;
  let neuf;
  if (h && typeof h.get === 'function' && typeof Headers !== 'undefined') { neuf = new Headers(h); neuf.set('Authorization', v); }
  else if (Array.isArray(h)) neuf = h.filter((x) => !(Array.isArray(x) && String(x[0]).toLowerCase() === 'authorization')).concat([['Authorization', v]]);
  else { neuf = {}; for (const k of Object.keys(h || {})) if (k.toLowerCase() !== 'authorization') neuf[k] = h[k]; neuf.Authorization = v; }
  return Object.assign({}, init || {}, { headers: neuf });
}
// Un corps qu'on peut renvoyer tel quel (une chaîne, ou rien) : un flux ne se relit pas.
const corpsRejouable = (init) => !init || init.body == null || typeof init.body === 'string';
const borne = (p, ms) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((ok) => setTimeout(() => ok(null), ms))]);

// fetchOrig : le `fetch` à envelopper · session() : la session courante ({access_token, refresh_token, expires_at})
// rafraichir(opts) : le renouvellement partagé (true renouvelé · false refusé · null pas su)
// base : l'adresse de la base · origine() : l'origine de la page (pour `/api/`).
export function creerJetonFrais(fetchOrig, { session, rafraichir, base, origine, maintenant = () => Date.now(), marge = MARGE_MS, attente = ATTENTE_MAX_MS }) {
  const b = String(base || '').replace(/\/+$/, '');
  const versBase = (u) => !!b && u.indexOf(b + '/rest/v1/') === 0;
  const versApi = (u) => {
    if (/^\/api\//.test(u)) return true;
    try { const o = typeof origine === 'function' ? origine() : origine; return !!o && u.indexOf(String(o).replace(/\/+$/, '') + '/api/') === 0; } catch (_) { return false; }
  };
  const sess = () => { try { return session() || null; } catch (_) { return null; } };
  return async function fetchJetonFrais(input, init) {
    const url = typeof input === 'string' ? input : (typeof URL !== 'undefined' && input instanceof URL ? input.href : null);
    if (url == null) return fetchOrig(input, init);
    const s = sess();
    const tok = s && s.access_token;
    const base_ = versBase(url);
    if (!tok || !(base_ || versApi(url)) || lireEntete(init, 'authorization') !== `Bearer ${tok}`) return fetchOrig(input, init);
    let envoye = init, jetonEnvoye = tok;
    if (s.refresh_token && !(Number(s.expires_at) > maintenant() + marge)) {
      const ok = await borne(rafraichir({ discret: true }), attente);
      const s2 = sess();
      if (ok === true && s2 && s2.access_token && s2.access_token !== tok) { envoye = avecJeton(init, s2.access_token); jetonEnvoye = s2.access_token; }
    }
    const r = await fetchOrig(input, envoye);
    if (!base_ || !r || r.status !== 401 || !corpsRejouable(envoye) || !(s && s.refresh_token)) return r;
    const ok = await borne(rafraichir({ discret: true }), attente);
    const s3 = sess();
    if (ok !== true || !s3 || !s3.access_token || s3.access_token === jetonEnvoye) return r;
    return fetchOrig(input, avecJeton(envoye, s3.access_token));
  };
}

// Posée UNE fois sur la page.
export function installerJetonFrais(opts) {
  try {
    if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.__vrmJetonFrais) return false;
    window.fetch = creerJetonFrais(window.fetch.bind(window), Object.assign({ origine: () => window.location.origin }, opts));
    window.__vrmJetonFrais = true;
    return true;
  } catch (_) { return false; }
}
