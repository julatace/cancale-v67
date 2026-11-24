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

// (24 nov., plan des paires qui dorment) Annonces publie LE PLAN DU MATIN (src/conseiller/planDorment.js, sur SES annonces
// LUES) : les seuils, les comptes et ≤ 8 lignes (identité compte + annonce, N°, photo, âge, vues, favoris, prix, l'action).
// Aucun prix d'achat, aucun plancher n'est publié (seulement la baisse proposée). Même appareil, même compte VRM, daté.
export const CLE_PUB_PLAN = 'vrm_plan_dorment';
export function publierPlan(plan, { owner = '', lu = false, maintenant = Date.now() } = {}) {
  if (!lu || !owner || !plan || typeof plan !== 'object' || !Array.isArray(plan.lignes)) return false;
  const S = plan.seuils || {};
  const p = { owner: String(owner), at: maintenant, etat: plan.etat, total: plan.total, passu: plan.passu, jeunes: plan.jeunes, dorment: plan.dorment,
    seuils: { etat: S.etat || '', n: S.n || 0, min: S.min || 0, vuesJour: Number.isFinite(S.vuesJour) ? Math.round(S.vuesJour * 100) / 100 : null, favorisJour: Number.isFinite(S.favorisJour) ? Math.round(S.favorisJour * 1000) / 1000 : null },
    lignes: plan.lignes.slice(0, 10).map((l) => ({ cle: l.cle, id: l.id, uid: l.uid, compte: l.compte, numero: l.numero, photo: l.photo, prix: l.prix, age: l.age, vues: l.vues, favoris: l.favoris,
      action: { k: l.action.k, site: l.action.site || '', sugg: l.action.sugg ?? null, pct: l.action.pct ?? null, bloque: l.action.bloque || '', pourquoi: l.action.pourquoi, effet: null } })) };
  try {
    const avant = localStorage.getItem(CLE_PUB_PLAN);
    const sans = (x) => { try { const o = typeof x === 'string' ? JSON.parse(x) : x; if (!o) return ''; const { at, ...r } = o; return JSON.stringify(r); } catch (_) { return ''; } };
    const a = avant ? JSON.parse(avant) : null;
    if (a && sans(a) === sans(p) && maintenant - Number(a.at) < 3600000) return false;
    localStorage.setItem(CLE_PUB_PLAN, JSON.stringify(p));
  } catch (_) { return false; }
  try { window.dispatchEvent(new CustomEvent(EVT_PUB_CONSEILLER, { detail: { plan: true } })); } catch (_) {}
  return true;
}
