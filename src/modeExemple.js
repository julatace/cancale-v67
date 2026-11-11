// ── « DÉCOUVRIR AVEC DES EXEMPLES » : LE MODE EXEMPLE (6 nov.) ────────────────
// Julien ouvre VRM à des clients payants. Un nouveau vendeur (aucun compte
// Vinted relié) peut voir l'app REMPLIE avant d'avoir rien branché : des données
// INVENTÉES (src/exempleDonnees.js), un bandeau permanent « Exemple — rien n'est
// à toi » et un bouton « Brancher mes comptes ».
//
// ⚠️⚠️ §2.3 — RIEN DE L'EXEMPLE N'EST JAMAIS ÉCRIT EN BASE, NI SUR L'APPAREIL.
//    Le mode s'installe AU CHARGEMENT, avant que l'app n'existe (premier import
//    de src/main.jsx), et seulement si l'onglet le demande (`sessionStorage`,
//    clé `vrm_mode_exemple`, posée par « Découvrir avec des exemples »). Alors :
//     · `localStorage` et `sessionStorage` deviennent des stockages EN MÉMOIRE :
//       la session, les numéros, les réglages de l'exemple n'existent que dans
//       la page — le vrai stockage de l'appareil n'est ni lu ni écrit par l'app ;
//     · tout appel à la base (Supabase : `rest`, `auth`, `storage`) et aux
//       fonctions de VRM (`/api/`) est RÉPONDU SUR PLACE (src/exempleBase.js) —
//       aucune requête ne sort, lecture comprise ;
//     · toute requête qui écrirait ailleurs (POST, PATCH, PUT, DELETE vers un
//       autre site) est refusée sur place ; `sendBeacon` n'envoie rien ;
//     · l'extension n'entend rien et ne dit rien : les messages `__vmr` (le pont
//       de la page) sont coupés dans les deux sens et `chrome.runtime` est
//       masqué — sinon l'app donnerait la session de l'exemple à l'extension,
//       qui remplacerait la vraie ;
//     · le cache des QR (Cache Storage) est en mémoire, et une notification du
//       système ne s'affiche jamais pour une vente inventée.
//    Sortir = retirer la clé de l'onglet et recharger : la mémoire de la page
//    disparaît, la vraie session et le vrai stockage reprennent tels quels.
// Le banc `scripts/bancs/mode-exemple.cjs` compte les requêtes qui atteignent la
// base pendant l'exemple (attendu : 0) et vérifie qu'aucune trace de l'exemple
// ne reste dans la base ni dans le stockage réel après la sortie.
import { servirTable } from './exempleBase.js';
import { jeuExemple, UID_EXEMPLE, EMAIL_EXEMPLE } from './exempleDonnees.js';

export const CLE_EXEMPLE = 'vrm_mode_exemple';
export { UID_EXEMPLE };
const HOTE_BASE = 'lgonxzrzjcqthjtbdpzo.supabase.co';
// Les réglages d'AFFICHAGE de l'appareil que l'exemple reprend (thème, zoom) :
// ce ne sont pas des données, et l'exemple doit ressembler à SON écran.
const AFFICHAGE = ['vinted_dark', 'vrm_apparence', 'vrm_zoom', 'vrm_densite'];

let ETAT = null;

export const exempleActif = () => !!(ETAT && ETAT.actif);
// Pour le banc et le diagnostic : ce que la porte a fait (jamais de contenu).
export const bilanExemple = () => (ETAT ? { actif: ETAT.actif, reponduesSurPlace: ETAT.surPlace, ecrituresGardees: ETAT.ecritures, refusees: ETAT.refusees, messagesCoupes: ETAT.coupes } : { actif: false });

class StockageMemoire {
  constructor(depart) { this._m = new Map(Object.entries(depart || {})); }
  get length() { return this._m.size; }
  key(i) { return [...this._m.keys()][i] ?? null; }
  getItem(k) { k = String(k); return this._m.has(k) ? this._m.get(k) : null; }
  setItem(k, v) { this._m.set(String(k), String(v)); }
  removeItem(k) { this._m.delete(String(k)); }
  clear() { this._m.clear(); }
}

const demande = (ss) => { try { return !!ss && ss.getItem(CLE_EXEMPLE) === '1'; } catch (_) { return false; } };

// Entrer : poser la clé dans CET onglet, puis recharger (la porte s'installe
// avant l'app). Rien d'autre n'est écrit.
export function entrerModeExemple(win = window) {
  try { (ETAT && ETAT.ssReel ? ETAT.ssReel : win.sessionStorage).setItem(CLE_EXEMPLE, '1'); } catch (_) { return false; }
  try { win.location.assign('/?tab=journee'); } catch (_) {}
  return true;
}
// Sortir : retirer la clé du VRAI stockage de l'onglet, puis recharger.
export function sortirModeExemple(win = window, destination = '/?tab=journee') {
  try { (ETAT && ETAT.ssReel ? ETAT.ssReel : win.sessionStorage).removeItem(CLE_EXEMPLE); } catch (_) {}
  try { win.location.assign(destination); } catch (_) {}
}

const reponse = (status, corps, entetes) => new Response(corps == null ? null : (typeof corps === 'string' ? corps : JSON.stringify(corps)), { status, headers: { 'content-type': 'application/json', ...(entetes || {}) } });

function lireEntetes(h) {
  const out = {};
  try {
    if (!h) return out;
    if (typeof Headers !== 'undefined' && h instanceof Headers) { h.forEach((v, k) => { out[k] = v; out[k.replace(/(^|-)([a-z])/g, (m, a, b) => a + b.toUpperCase())] = v; }); return out; }
    if (Array.isArray(h)) { for (const [k, v] of h) out[k] = v; return out; }
    return { ...h };
  } catch (_) { return out; }
}
function lireCorps(b) {
  if (b == null) return null;
  if (typeof b === 'string') { try { return JSON.parse(b); } catch (_) { return b; } }
  return null;   // FormData, Blob… : rien à ranger, la requête ne part pas pour autant
}

// La réponse de la base de l'exemple, pour une adresse de Supabase.
function repondreBase(chemin, url, methode, entetes, corps) {
  const now = Date.now();
  const session = () => ({ access_token: 'exemple', token_type: 'bearer', expires_in: 43200, expires_at: Math.floor(now / 1000) + 43200, refresh_token: 'exemple', user: { id: UID_EXEMPLE, email: EMAIL_EXEMPLE, aud: 'authenticated', role: 'authenticated', identities: [] } });
  if (chemin.startsWith('/auth/v1/')) {
    const q = chemin.slice('/auth/v1/'.length);
    if (methode !== 'GET' && methode !== 'HEAD') ETAT.ecritures++;
    if (q.startsWith('settings')) return reponse(200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: false });
    if (q.startsWith('user')) return reponse(200, session().user);
    if (q.startsWith('token')) return reponse(200, session());
    if (q.startsWith('logout')) return reponse(204, null);
    if (q.startsWith('factors')) return reponse(200, []);
    return reponse(200, {});
  }
  if (chemin.startsWith('/rest/v1/')) {
    const table = chemin.slice('/rest/v1/'.length).split('/')[0];
    if (table === 'rpc') return reponse(200, 'null');
    const t = table === 'app_data' ? ETAT.base : table === 'vinted_accounts' ? ETAT.comptes : (ETAT.autres[table] || (ETAT.autres[table] = { lignes: [] }));
    if (methode !== 'GET' && methode !== 'HEAD') ETAT.ecritures++;
    const r = servirTable(t, { methode, url, entetes, corps, owner: UID_EXEMPLE });
    return reponse(r.status, r.status === 204 ? null : r.body, r.headers);
  }
  // storage, functions, realtime en HTTP : rien d'utile dans l'exemple.
  if (methode !== 'GET' && methode !== 'HEAD') ETAT.ecritures++;
  return reponse(404, { message: 'exemple' });
}

// La réponse des fonctions de VRM (`/api/…`) dans l'exemple.
function repondreApi(u, methode) {
  const mode = u.searchParams.get('mode') || '';
  if (methode !== 'GET' && methode !== 'HEAD') {
    ETAT.ecritures++;
    return reponse(409, { ok: false, erreur: 'exemple', message: "Mode exemple : rien n'est envoyé. Branche tes comptes pour le faire pour de vrai." });
  }
  // La porte de confidentialité (src/PorteConfidentialite.jsx) attend SON uid.
  if (u.pathname === '/api/compte' && mode === 'confidentialite') return reponse(200, { ok: true, uid: UID_EXEMPLE });
  return reponse(200, {});
}

export function installerModeExemple(win = typeof window !== 'undefined' ? window : null) {
  if (!win || ETAT) return exempleActif();
  let ssReel = null, lsReel = null;
  try { ssReel = win.sessionStorage; lsReel = win.localStorage; } catch (_) { return false; }
  if (!demande(ssReel)) return false;
  // (11 nov.) Les captures de la page d'accueil posent un catalogue mélangé.
  const jeu = jeuExemple(Date.now(), { catalogue: win.__vrmExempleCatalogue });
  ETAT = { actif: true, ssReel, base: { lignes: jeu.lignes }, comptes: { lignes: jeu.comptes }, autres: {}, surPlace: 0, ecritures: 0, refusees: 0, coupes: 0 };

  // 1. LE STOCKAGE : en mémoire. La session de l'exemple n'existe que là.
  const depart = {};
  for (const k of AFFICHAGE) { try { const v = lsReel.getItem(k); if (v != null) depart[k] = v; } catch (_) {} }
  const sess = { access_token: 'exemple', refresh_token: 'exemple', totp: [], expires_at: Date.now() + 12 * 3600e3, user: { id: UID_EXEMPLE, email: EMAIL_EXEMPLE, totp: [] } };
  Object.assign(depart, {
    vrm_session: JSON.stringify(sess), vrm_local_owner: UID_EXEMPLE, schema_cloisonne: '1',
    vrm_bienvenue_vue: JSON.stringify({ at: 'exemple' }), vrm_visite_vue: JSON.stringify({ at: 'exemple' }),
  });
  const lsMem = new StockageMemoire(depart);
  const ssMem = new StockageMemoire({ [CLE_EXEMPLE]: '1' });
  try {
    Object.defineProperty(win, 'localStorage', { configurable: true, enumerable: true, get: () => lsMem });
    Object.defineProperty(win, 'sessionStorage', { configurable: true, enumerable: true, get: () => ssMem });
  } catch (_) {
    // Un navigateur qui refuse de remplacer le stockage : on n'entre PAS dans
    // l'exemple (on ne mélangerait jamais l'exemple au vrai stockage).
    ETAT = null;
    try { ssReel.removeItem(CLE_EXEMPLE); } catch (_) {}
    return false;
  }

  // 2. LE RÉSEAU : la base et /api répondus sur place ; aucune écriture ne sort.
  const fetchReel = win.fetch ? win.fetch.bind(win) : null;
  win.fetch = async (entree, init) => {
    let url = '', methode = 'GET', entetes = {}, corps = null;
    try {
      if (typeof entree === 'string' || entree instanceof URL) url = String(entree);
      else if (entree && entree.url) { url = entree.url; methode = entree.method || 'GET'; entetes = lireEntetes(entree.headers); }
      if (init) { if (init.method) methode = String(init.method).toUpperCase(); if (init.headers) entetes = { ...entetes, ...lireEntetes(init.headers) }; if (init.body != null) corps = lireCorps(init.body); }
    } catch (_) {}
    methode = String(methode || 'GET').toUpperCase();
    let u = null;
    try { u = new URL(url, win.location.href); } catch (_) {}
    if (u && u.host === HOTE_BASE) { ETAT.surPlace++; return repondreBase(u.pathname, u.pathname + u.search, methode, entetes, corps); }
    if (u && u.origin === win.location.origin && u.pathname.startsWith('/api/')) { ETAT.surPlace++; return repondreApi(u, methode); }
    if (methode !== 'GET' && methode !== 'HEAD') { ETAT.refusees++; return reponse(409, { ok: false, erreur: 'exemple' }); }
    if (!fetchReel) return reponse(503, { ok: false });
    return fetchReel(entree, init);
  };
  try { if (win.navigator && typeof win.navigator.sendBeacon === 'function') win.navigator.sendBeacon = () => { ETAT.refusees++; return true; }; } catch (_) {}
  try {
    const WS = win.WebSocket;
    if (WS) win.WebSocket = function WebSocketExemple(adresse, ...r) { if (String(adresse).includes(HOTE_BASE)) { ETAT.refusees++; throw new Error('mode exemple'); } return new WS(adresse, ...r); };
  } catch (_) {}

  // 3. L'EXTENSION : ni message vers elle, ni message d'elle.
  const estPont = (d) => !!d && typeof d === 'object' && Object.keys(d).some((k) => k.startsWith('__vmr'));
  try {
    const pmReel = win.postMessage.bind(win);
    win.postMessage = (msg, ...r) => { if (estPont(msg)) { ETAT.coupes++; return undefined; } return pmReel(msg, ...r); };
  } catch (_) {}
  try { win.addEventListener('message', (e) => { if (estPont(e.data)) { ETAT.coupes++; e.stopImmediatePropagation(); } }, true); } catch (_) {}
  try { if (win.chrome && win.chrome.runtime) Object.defineProperty(win, 'chrome', { configurable: true, value: {} }); } catch (_) {}

  // 4. Cache des QR en mémoire ; aucune notification du système.
  try {
    const caches = new Map();
    const cache = () => { const m = new Map(); return { match: async (k) => m.get(String(k && k.url || k)), put: async (k, v) => { m.set(String(k && k.url || k), v); }, delete: async (k) => m.delete(String(k && k.url || k)), keys: async () => [] }; };
    Object.defineProperty(win, 'caches', { configurable: true, value: { open: async (n) => { if (!caches.has(n)) caches.set(n, cache()); return caches.get(n); }, has: async (n) => caches.has(n), delete: async (n) => caches.delete(n), keys: async () => [...caches.keys()], match: async () => undefined } });
  } catch (_) {}
  try {
    const N = function NotificationExemple() {};
    N.permission = 'denied'; N.requestPermission = async () => 'denied';
    Object.defineProperty(win, 'Notification', { configurable: true, value: N });
  } catch (_) {}

  try { win.__vrmExemple = bilanExemple; } catch (_) {}
  return true;
}

// Installé dès l'import (src/main.jsx l'importe EN PREMIER) : avant tout
// module de l'app, donc avant toute lecture du stockage ou de la base.
if (typeof window !== 'undefined') installerModeExemple(window);
