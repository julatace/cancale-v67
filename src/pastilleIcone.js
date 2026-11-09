// (9 nov., lot Z) La pastille sur l'icône de VRM (écran d'accueil iPhone/Android, Dock) :
// le nombre de colis à envoyer, LE MÊME que le badge de Colis (`vrm_colis_aposter`, §11 —
// publié par l'écran qui a toutes les sources, frais de moins de 12 h).
// Pas su (`null`) ⇒ AUCUNE pastille : jamais un nombre périmé sur l'icône (pas su ≠ 0).
// 0 ⇒ pastille effacée. Navigateur sans l'API (Badging) ⇒ rien, sans erreur.

/** Ce que l'icône doit montrer : un entier > 0, ou `null` (effacer). */
export function pastillePour(n) {
  if (n === null || n === undefined) return null;
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.floor(v);
}

/** Pose (ou efface) la pastille. Rend ce qui a été demandé au navigateur, pour les bancs. */
export function poserPastilleIcone(n, nav = (typeof navigator !== 'undefined' ? navigator : null)) {
  const p = pastillePour(n);
  if (!nav) return { pose: false, valeur: p };
  try {
    if (p === null) { if (typeof nav.clearAppBadge === 'function') { const r = nav.clearAppBadge(); if (r && r.catch) r.catch(() => {}); return { pose: true, valeur: null }; } }
    else if (typeof nav.setAppBadge === 'function') { const r = nav.setAppBadge(p); if (r && r.catch) r.catch(() => {}); return { pose: true, valeur: p }; }
  } catch (_) {}
  return { pose: false, valeur: p };
}
