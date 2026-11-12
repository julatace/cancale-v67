// ════════════════════════════════════════════════════════════════════════════
//  UN SEUL ONGLET RENOUVELLE LE JETON (11 nov., revue de robustesse, point 9)
//
//  Deux onglets (ou l'app installée + un onglet) du MÊME vendeur : quand l'onglet
//  A renouvelait la session, l'onglet B gardait en mémoire l'ANCIEN jeton de
//  renouvellement et le renvoyait à Supabase. Refusé (déjà utilisé) — et la
//  détection de réutilisation peut révoquer toute la famille de jetons : B restait
//  avec un jeton expiré (lectures « pas su », écritures refusées), A pouvait être
//  déconnecté.
//  Désormais : (1) le renouvellement passe sous un VERROU partagé entre onglets
//  (`navigator.locks`, sinon tel quel) ; (2) dans le verrou, la session rangée par
//  un autre onglet est relue : plus fraîche, du même vendeur ⇒ on l'ADOPTE au lieu
//  d'appeler Supabase ; (3) l'écouteur `storage` adopte aussi la session renouvelée
//  ailleurs (même vendeur), sans recharger.
//
//  Module PUR : exécuté tel quel par `scripts/audit-robustesse-donnees.cjs`.
// ════════════════════════════════════════════════════════════════════════════

export const VERROU_RENOUVELLEMENT = 'vrm-auth-refresh';

// La session `stockee` (rangée par un autre onglet) remplace-t-elle `courante` ?
// Oui seulement : même vendeur, AUTRES jetons, et valable encore plus d'une minute.
export function sessionAAdopter(courante, stockee, maintenant = Date.now()) {
  if (!courante || !stockee || typeof stockee !== 'object') return null;
  const u1 = courante.user && courante.user.id, u2 = stockee.user && stockee.user.id;
  if (!u1 || !u2 || u1 !== u2) return null;
  if (typeof stockee.access_token !== 'string' || !stockee.access_token || typeof stockee.refresh_token !== 'string' || !stockee.refresh_token) return null;
  if (stockee.refresh_token === courante.refresh_token && stockee.access_token === courante.access_token) return null;
  if (!(Number(stockee.expires_at) > maintenant + 60000)) return null;
  if (Number(courante.expires_at) > Number(stockee.expires_at)) return null;   // la nôtre est plus récente
  return stockee;
}

// `fn` sous le verrou nommé, partagé par tous les onglets du site ; sans
// `navigator.locks` (vieux Safari), `fn` tel quel (l'adoption ci-dessus reste).
export function sousVerrou(nom, fn, nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  try {
    if (nav && nav.locks && typeof nav.locks.request === 'function') return nav.locks.request(nom, () => fn());
  } catch (_) {}
  return Promise.resolve().then(fn);
}

// ── (12 nov.) LA SESSION NEUVE PASSE PAR INDEXEDDB, PAS PAR localStorage ─────
// Mesuré (banc robustesse-donnees, scène « onglets », 1 fois sur 3) : l'onglet A
// renouvelle et range la session dans `localStorage`, rend le verrou ; B entre
// 7 ms plus tard et relit… l'ANCIENNE session. Deux onglets peuvent vivre dans
// deux processus : `localStorage` y est recopié APRÈS coup (cohérence à terme).
// B renvoyait donc l'ancien jeton de renouvellement (déjà utilisé ⇒ refus, et
// révocation possible). IndexedDB, lui, est tenu par UN seul service pour tout
// le site : une écriture TERMINÉE avant que A rende le verrou est vue par B.
// Toujours « pas su » ⇒ `null` (jamais d'exception) : l'adoption par
// `localStorage` reste le premier essai.
const BASE_ONGLETS = 'vrm-session-onglets', MAGASIN = 's', CLE = 'derniere';
const ouvrirBase = (idb) => new Promise((ok) => {
  try {
    if (!idb || typeof idb.open !== 'function') return ok(null);
    const r = idb.open(BASE_ONGLETS, 1);
    r.onupgradeneeded = () => { try { r.result.createObjectStore(MAGASIN); } catch (_) {} };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ok(null);
    r.onblocked = () => ok(null);
  } catch (_) { ok(null); }
});
const avecDelai = (p, ms) => Promise.race([p, new Promise((ok) => setTimeout(() => ok(null), ms))]);
const idbDefaut = () => (typeof indexedDB !== 'undefined' ? indexedDB : null);
// Rend `true` quand l'écriture est TERMINÉE (`oncomplete`), sinon `false`. `null` efface.
export function rangerSessionOnglets(session, idb = idbDefaut()) {
  return avecDelai(ouvrirBase(idb).then((db) => new Promise((ok) => {
    if (!db) return ok(false);
    try {
      const t = db.transaction(MAGASIN, 'readwrite');
      if (session) t.objectStore(MAGASIN).put(session, CLE); else t.objectStore(MAGASIN).delete(CLE);
      t.oncomplete = () => { try { db.close(); } catch (_) {} ok(true); };
      t.onerror = t.onabort = () => { try { db.close(); } catch (_) {} ok(false); };
    } catch (_) { try { db.close(); } catch (__) {} ok(false); }
  })), 1500).then((v) => v === true);
}
export function lireSessionOnglets(idb = idbDefaut()) {
  return avecDelai(ouvrirBase(idb).then((db) => new Promise((ok) => {
    if (!db) return ok(null);
    try {
      const q = db.transaction(MAGASIN, 'readonly').objectStore(MAGASIN).get(CLE);
      q.onsuccess = () => { try { db.close(); } catch (_) {} const v = q.result; ok(v && typeof v === 'object' ? v : null); };
      q.onerror = () => { try { db.close(); } catch (_) {} ok(null); };
    } catch (_) { try { db.close(); } catch (__) {} ok(null); }
  })), 1500).then((v) => v || null);
}
