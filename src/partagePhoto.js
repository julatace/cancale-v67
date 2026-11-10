// ═══════════════════════════════════════════════════════════════════════════
// PARTAGER UNE PHOTO VERS VRM (10 nov., lot J — proposition 10 validée)
// ═══════════════════════════════════════════════════════════════════════════
// VRM installée sur l'écran d'accueil est une CIBLE de partage (`share_target`,
// public/manifest.webmanifest) : Photos → Partager → VRM. Le service worker
// (public/sw.js) range la photo dans la réserve de l'appareil et ouvre
// `?tab=achats&achat=1&photo=partage` ; « Nouvel achat » s'ouvre avec la photo.
// Rien n'est écrit en base avant « Ajouter l'achat » (la photo rejoint alors SA
// ligne `achat_hors_photo_{id}`, comme une photo choisie à la main).
// La photo est lue UNE fois puis retirée ; au-delà de 10 minutes, elle est jetée.
// ⚠️ Safari (iPhone) ne propose pas les apps web dans la feuille de partage :
// là, le bouton « Photo » du formulaire ouvre la photothèque.
export const CACHE_PARTAGE = 'vrm-hl-partage';
export const CLE_PARTAGE = '/__vrm_partage_photo';
export const PARTAGE_MAX_MS = 10 * 60 * 1000;

// La photo partagée (Blob) ou null. Toujours retirée de la réserve.
export async function prendrePhotoPartagee(maintenant = Date.now()) {
  try {
    if (typeof caches === 'undefined') return null;
    const c = await caches.open(CACHE_PARTAGE);
    const r = await c.match(CLE_PARTAGE);
    await c.delete(CLE_PARTAGE);
    if (!r) return null;
    const at = Number(r.headers.get('x-vrm-partage-at'));
    if (!(at > 0) || maintenant - at > PARTAGE_MAX_MS) return null;
    const b = await r.blob();
    return b && /^image\//.test(b.type || '') && b.size > 0 ? b : null;
  } catch (_) { return null; }
}
