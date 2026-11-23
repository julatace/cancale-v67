// ── LES PAIRES EN LITIGE OU EN RETOUR (21 nov., pour « À republier en priorité ») ─────────────────────────────
// Un seul propriétaire (§5) : `retoursEnCours` (src/retoursStock.js), calculé par l'app sur les ventes lues. Ses lignes EN
// COURS (pas remises en stock : initié, en route vers toi, reçu) sont des paires dont l'histoire n'est pas finie : on ne
// propose pas d'en republier l'annonce. Ce module ne garde que leurs IDENTITÉS (clé du N° par `cleNum`, identifiant
// d'annonce) — jamais un titre. Pas encore calculé ⇒ `null` (pas su : rien n'est retiré sur un doute, et rien n'est dit
// « sans litige » non plus — l'écran ne l'affirme pas).
let _etat = null;   // null · { nums: Set, ids: Set, at }
const abonnes = new Set();

export function poserEnLitige(res, cle = (v) => String(v == null ? '' : v).trim().toUpperCase()) {
  if (!res || res.etat !== 'lu' || !Array.isArray(res.lignes)) return;
  const nums = new Set(), ids = new Set();
  for (const l of res.lignes) {
    if (!l || l.ancien) continue;
    if (l.num != null && String(l.num).trim()) nums.add(cle(l.num));
    if (l.itemId != null && String(l.itemId).trim()) ids.add(String(l.itemId).trim());
  }
  const sig = [...nums].sort().join(',') + '|' + [...ids].sort().join(',');
  if (_etat && _etat.sig === sig) return;
  _etat = { nums, ids, sig, at: Date.now() };
  for (const f of abonnes) { try { f(); } catch (_) {} }
}
export const enLitigeConnus = () => (_etat ? { nums: _etat.nums, ids: _etat.ids } : null);
export function abonnerLitiges(f) { abonnes.add(f); return () => abonnes.delete(f); }
