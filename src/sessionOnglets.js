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
