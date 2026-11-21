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
// (16 nov., lot vitesse-lectures) Les données inventées et la petite base qui les sert sont un
// morceau À PART (≈ 23 Ko de source) : chargées seulement quand l'exemple est vraiment demandé, au
// moment où il s'installe — la page d'accueil de tous les visiteurs ne les télécharge plus (budget
// du fichier d'entrée, banc `accueil`). Toute lecture de la base de l'exemple ATTEND ces données
// (la réponse arrive un instant plus tard, rien ne sort pour autant : le réseau est déjà coupé).
import { UID_EXEMPLE, EMAIL_EXEMPLE } from './exempleIdentite.js';
let _donneesExemple = null;
const chargerDonneesExemple = () => _donneesExemple || (_donneesExemple = Promise.all([import('./exempleBase.js'), import('./exempleDonnees.js')]));

export const CLE_EXEMPLE = 'vrm_mode_exemple';
export { UID_EXEMPLE };
// (12 nov.) La base d’essai (Preview, VITE_SUPABASE_URL) est aussi tenue à l’écart en mode exemple.
const HOTE_BASE = (() => { try { const u = import.meta.env && import.meta.env.VITE_SUPABASE_URL; return u ? new URL(u).host : 'lgonxzrzjcqthjtbdpzo.supabase.co'; } catch (_) { return 'lgonxzrzjcqthjtbdpzo.supabase.co'; } })();
// Les réglages d'AFFICHAGE de l'appareil que l'exemple reprend (thème, zoom) :
// ce ne sont pas des données, et l'exemple doit ressembler à SON écran.
const AFFICHAGE = ['vinted_dark', 'vrm_apparence', 'vrm_zoom', 'vrm_densite'];

let ETAT = null;

export const exempleActif = () => !!(ETAT && ETAT.actif && !ETAT.bac);
// ── (15 nov.) LE BAC À SABLE « CE QUE VOIT UN NOUVEAU » ───────────────────────
// Réglages → Nouveaux comptes (le propriétaire de l'installation) montre le parcours d'un
// nouvel inscrit dans un CADRE : la même app, la même porte que l'exemple (stockage en
// mémoire, base et /api répondues sur place, extension coupée, aucune notification), mais
// une base VIDE (un compte qui vient d'être créé) et AUCUN bandeau « Exemple ».
// Il ne s'installe QUE dans le cadre nommé `vrm-bac-a-sable-nouveau`, posé dans une page
// de la MÊME origine (jamais un onglet, jamais un autre site) ; l'étape et l'appareil
// viennent de son adresse (`?bac=extension&appareil=iphone`), lus UNE fois ici.
// En plus de la porte de l'exemple, parce qu'un cadre partage l'origine de l'onglet de
// Julien : ni `indexedDB` (sa copie des lignes, ses gestes hors ligne, ses onglets), ni
// l'évènement `storage` (sa session qui change ailleurs) n'entrent dans le cadre, et rien
// n'est écrit dans le VRAI `sessionStorage` (partagé avec l'onglet qui l'affiche).
export const NOM_CADRE_BAC = 'vrm-bac-a-sable-nouveau';
export const UID_BAC = 'b0b0b0b0-0000-4000-8000-00000000b0b0';
const EMAIL_BAC = 'nouveau@vrm.invalid';
export const ETAPES_BAC = ['vitrine', 'inscription', 'bienvenue', 'plateformes', 'extension', 'comptes', 'numeros', 'historique', 'journee', 'abonnement'];
export const bacASableActif = () => !!(ETAT && ETAT.actif && ETAT.bac);
// L'étape du parcours que l'aperçu demande (`null` hors du bac ; la vitrine et l'inscription n'en sont pas).
export const bacASableEtape = () => (bacASableActif() && ETAT.bac.etape && !['vitrine', 'inscription'].includes(ETAT.bac.etape) ? ETAT.bac.etape : null);
export const bacASableAppareil = () => (bacASableActif() ? ETAT.bac.appareil : null);
export function demandeBacASable(win) {
  try {
    if (!win || win.name !== NOM_CADRE_BAC || win.top === win || !win.parent) return null;
    if (win.parent.location.origin !== win.location.origin) return null;   // un autre site : jamais (lève une erreur, rattrapée)
    const q = new URLSearchParams(String(win.location.search || ''));
    const etape = ETAPES_BAC.includes(q.get('bac')) ? q.get('bac') : 'bienvenue';
    const appareil = ['ordinateur', 'iphone', 'android'].includes(q.get('appareil')) ? q.get('appareil') : null;
    return { etape, appareil };
  } catch (_) { return null; }
}
// (13 nov., lot 48) Entré par le LIEN de la page d'accueil ou de la connexion (que seul
// un visiteur sans session voit) : le bandeau propose « Créer mon compte » plutôt que
// « Passer à mes vraies données ». La vraie session n'est jamais lue pour le savoir.
const CLE_SANS_COMPTE = 'vrm_mode_exemple_sans_compte';
export const exempleSansCompte = () => !!(ETAT && ETAT.actif && ETAT.sansCompte);
// `?exemple` dans l'adresse : un VRAI lien (page d'accueil, connexion) qui demande
// l'exemple à CET onglet — rien d'autre n'est lu ni écrit.
const demandeParLien = (win) => { try { return /[?&]exemple(=1)?(&|$)/.test(String(win.location.search || '')); } catch (_) { return false; } };
// Pour le banc et le diagnostic : ce que la porte a fait (jamais de contenu).
export const bilanExemple = () => (ETAT ? { actif: ETAT.actif, bac: ETAT.bac ? ETAT.bac.etape : null, reponduesSurPlace: ETAT.surPlace, ecrituresGardees: ETAT.ecritures, refusees: ETAT.refusees, messagesCoupes: ETAT.coupes } : { actif: false });

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
  if (ETAT && ETAT.bac) return false;   // (15 nov.) le bac à sable n'écrit jamais dans le vrai sessionStorage (celui de l'onglet de Julien)
  try { const ss = ETAT && ETAT.ssReel ? ETAT.ssReel : win.sessionStorage; ss.setItem(CLE_EXEMPLE, '1'); ss.removeItem(CLE_SANS_COMPTE); } catch (_) { return false; }
  try { win.location.assign('/?tab=journee'); } catch (_) {}
  return true;
}
// Sortir : retirer la clé du VRAI stockage de l'onglet, puis recharger.
export function sortirModeExemple(win = window, destination = '/?tab=journee') {
  if (ETAT && ETAT.bac) return;
  try { const ss = ETAT && ETAT.ssReel ? ETAT.ssReel : win.sessionStorage; ss.removeItem(CLE_EXEMPLE); ss.removeItem(CLE_SANS_COMPTE); } catch (_) {}
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
  const session = () => ({ access_token: 'exemple', token_type: 'bearer', expires_in: 43200, expires_at: Math.floor(now / 1000) + 43200, refresh_token: 'exemple', user: { id: ETAT.uid, email: ETAT.email, aud: 'authenticated', role: 'authenticated', identities: [], created_at: new Date(now - 60000).toISOString() } });
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
    if (methode !== 'GET' && methode !== 'HEAD') ETAT.ecritures++;
    const etat = ETAT;
    return etat.pret.then(() => {
      const t = table === 'app_data' ? etat.base : table === 'vinted_accounts' ? etat.comptes : (etat.autres[table] || (etat.autres[table] = { lignes: [] }));
      const r = etat.servirTable(t, { methode, url, entetes, corps, owner: etat.uid });
      return reponse(r.status, r.status === 204 ? null : r.body, r.headers);
    }, () => reponse(503, { message: 'exemple : données indisponibles' }));
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
  if (u.pathname === '/api/compte' && mode === 'confidentialite') return reponse(200, { ok: true, uid: ETAT.uid });
  // (15 nov.) Le bac à sable : un compte qui vient d'être créé n'est pas le propriétaire, et n'a
  // ni abonnement ni client Stripe (l'accès réel dépend de l'installation : l'écran le dit « pas lu »
  // si la réponse ne le porte pas — ici, `acces` seul, rien d'inventé).
  if (ETAT.bac && u.pathname === '/api/compte' && mode === 'abonnement') return reponse(200, { ok: true, proprietaire: false, acces: true });
  return reponse(200, {});
}

export function installerModeExemple(win = typeof window !== 'undefined' ? window : null) {
  if (!win || ETAT) return exempleActif();
  let ssReel = null, lsReel = null;
  try { ssReel = win.sessionStorage; lsReel = win.localStorage; } catch (_) { return false; }
  const bac = demandeBacASable(win);
  if (!bac && demandeParLien(win)) {
    try { ssReel.setItem(CLE_EXEMPLE, '1'); ssReel.setItem(CLE_SANS_COMPTE, '1'); } catch (_) {}
    try { win.history.replaceState(win.history.state, '', '/?tab=journee'); } catch (_) {}
  }
  if (!bac && !demande(ssReel)) return false;
  let sansCompte = false;
  try { sansCompte = ssReel.getItem(CLE_SANS_COMPTE) === '1'; } catch (_) {}
  // (11 nov.) Les captures de la page d'accueil posent un catalogue mélangé.
  // (14 nov.) `origine` : les photos d'exemple sont servies par `public/exemple/` (même origine, CSP).
  let origine = ''; try { origine = String(win.location.origin || ''); } catch (_) {}
  // (15 nov.) Le bac à sable : une base VIDE, celle d'un compte qui vient d'être créé.
  const t0 = Date.now(), catalogue = win.__vrmExempleCatalogue;
  ETAT = { actif: true, ssReel, sansCompte, bac, uid: bac ? UID_BAC : UID_EXEMPLE, email: bac ? EMAIL_BAC : EMAIL_EXEMPLE, base: { lignes: [] }, comptes: { lignes: [] }, autres: {}, surPlace: 0, ecritures: 0, refusees: 0, coupes: 0, servirTable: null, pret: null };
  {
    const etat = ETAT;
    etat.pret = chargerDonneesExemple().then(([b, d]) => {
      const jeu = bac ? { lignes: [], comptes: [] } : d.jeuExemple(t0, { catalogue, origine });
      // Lectures ET écritures de la base de l'exemple attendent `pret` : rien n'est servi avant le jeu.
      etat.base.lignes = jeu.lignes;
      etat.comptes.lignes = jeu.comptes;
      etat.servirTable = b.servirTable;
    });
    etat.pret.catch(() => {});
  }

  // 1. LE STOCKAGE : en mémoire. La session de l'exemple n'existe que là.
  const depart = {};
  for (const k of AFFICHAGE) { try { const v = lsReel.getItem(k); if (v != null) depart[k] = v; } catch (_) {} }
  const sess = { access_token: 'exemple', refresh_token: 'exemple', totp: [], expires_at: Date.now() + 12 * 3600e3, user: { id: ETAT.uid, email: ETAT.email, totp: [], created_at: new Date(Date.now() - 60000).toISOString() } };
  if (!bac) Object.assign(depart, {
    vrm_session: JSON.stringify(sess), vrm_local_owner: UID_EXEMPLE, schema_cloisonne: '1',
    vrm_bienvenue_vue: JSON.stringify({ at: 'exemple' }), vrm_visite_vue: JSON.stringify({ at: 'exemple' }),
  });
  // Le bac : la vitrine et l'inscription se voient SANS session (un visiteur) ; les étapes,
  // avec la session d'un compte neuf — rien de vu, rien de choisi.
  else if (!['vitrine', 'inscription'].includes(bac.etape)) Object.assign(depart, { vrm_session: JSON.stringify(sess), vrm_local_owner: UID_BAC, schema_cloisonne: '1' });
  const lsMem = new StockageMemoire(depart);
  const ssMem = new StockageMemoire(bac ? {} : { [CLE_EXEMPLE]: '1' });
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

  // (15 nov.) Le bac à sable, en plus : ni IndexedDB ni l'évènement `storage` de l'onglet de Julien.
  if (bac) {
    try { Object.defineProperty(win, 'indexedDB', { configurable: true, value: undefined }); } catch (_) {}
    try { win.addEventListener('storage', (e) => { ETAT.coupes++; e.stopImmediatePropagation(); }, true); } catch (_) {}
    try { win.document.documentElement.setAttribute('data-vrm-bac-a-sable', bac.etape); } catch (_) {}
  }
  // (14 nov.) La racine porte `data-vrm-exemple` : la marque « Exemple » sur chaque
  // code et chaque adresse inventés (src/guide-demarrage.css) et le cadre de l'écran.
  if (!bac) { try { win.document.documentElement.setAttribute('data-vrm-exemple', '1'); } catch (_) {} }
  try { win.__vrmExemple = bilanExemple; } catch (_) {}
  return true;
}

// Installé dès l'import (src/main.jsx l'importe EN PREMIER) : avant tout
// module de l'app, donc avant toute lecture du stockage ou de la base.
if (typeof window !== 'undefined') installerModeExemple(window);
