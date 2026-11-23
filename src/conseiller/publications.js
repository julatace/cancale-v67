// ── src/conseiller/publications.js — ce que les écrans propriétaires publient pour le Conseiller (23 nov.) ──
// §11 : un écran publie, les autres consomment. Annonces publie le NOMBRE de « Baisses conseillées » qu'il affiche
// déjà (`nBaissesConseillees`, règle src/baisseConseillee.js) — seulement quand ses annonces sont LUES (un 0 publié
// est un fait, jamais « pas lu »). Sur CET appareil, par compte VRM (owner), daté.
export const CLE_PUB_BAISSES = 'vrm_baisses_conseillees';
export const EVT_PUB_CONSEILLER = 'vrm:conseiller-pub';
export function publierBaisses(n, { owner = '', lu = false, photos = [], maintenant = Date.now() } = {}) {
  if (!lu || !owner || !Number.isFinite(Number(n)) || Number(n) < 0) return false;
  // (23 nov.) + jusqu'à 4 photos de SES annonces à baisser (le mini-visuel du conseil).
  const p = { owner: String(owner), n: Number(n), at: maintenant, photos: (Array.isArray(photos) ? photos : []).filter((x) => typeof x === 'string' && x).slice(0, 4) };
  try {
    const avant = JSON.parse(localStorage.getItem(CLE_PUB_BAISSES) || 'null');
    if (avant && avant.owner === p.owner && avant.n === p.n && JSON.stringify(avant.photos || []) === JSON.stringify(p.photos) && maintenant - Number(avant.at) < 3600000) return false;
    localStorage.setItem(CLE_PUB_BAISSES, JSON.stringify(p));
  } catch (_) { return false; }
  try { window.dispatchEvent(new CustomEvent(EVT_PUB_CONSEILLER, { detail: p })); } catch (_) {}
  return true;
}
// Une publication d'un AUTRE compte VRM (même appareil) ne compte pas : null.
export function lirePub(cle, owner) {
  try {
    const p = JSON.parse(localStorage.getItem(cle) || 'null');
    if (!p || typeof p !== 'object' || !owner || String(p.owner || '') !== String(owner)) return null;
    return p;
  } catch (_) { return null; }
}
