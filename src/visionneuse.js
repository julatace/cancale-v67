// ── LA PHOTO EN GRAND, PARTOUT (10 nov., lot AN) ─────────────────────────────
// Julien (9 nov.) : « Je veux que quand on clique sur la photo de l'article cela
// nous mette la photo en grand, sur ordi ou tel, là c'est pour toute l'app ».
//
// La RÈGLE (sans React, exécutée par `scripts/audit-visionneuse.cjs`) :
//   · une vignette d'article porte `data-vrm-vignette` (posé par `PhotoVinted` et
//     par les quelques `<img>` d'article qui ne passent pas par lui) ;
//   · un toucher sur elle ouvre LA visionneuse (src/Visionneuse.jsx) et RIEN
//     d'autre : le clic ne descend pas à la rangée (`stopPropagation`), le reste
//     de la rangée garde son geste ;
//   · pas une vignette : un `<img>` sans le marqueur, une image pas chargée
//     (« image absente ⇒ rien »), une icône (< 32 px), un endroit qui l'interdit
//     (`data-sans-visionneuse` : éditeur photo, studio), la visionneuse elle-même ;
//   · les AUTRES photos de l'article : celles que l'app a déjà lues (annonces du
//     dressing : `photos`, `photosDetail`), rangées par la clé du FICHIER (la même
//     règle que `photoKey` d'App.jsx : l'hôte et le répertoire de taille retirés).
//     Une identité de fichier, jamais un titre (§5). Inconnue ⇒ la seule photo
//     touchée. Aucune nouvelle source n'est lue : ce sont les adresses que l'app
//     affiche déjà.

export const EVT_VISIONNEUSE = 'vrm:visionneuse';
export const TAILLE_MIN_VIGNETTE = 32;

// La clé d'un fichier photo — recopie de `photoKey` (App.jsx) : même fichier, même clé,
// quelle que soit la taille servie (f800, 310x430, thumbnails…).
export function clePhoto(url) {
  const raw = String(url || '').split('?')[0].split('#')[0];
  if (!raw || /^(blob:|data:)/i.test(raw)) return raw || null;
  const chemin = raw.replace(/^https?:\/\/[^/]+/i, '');
  const segs = chemin.split('/').filter(Boolean).filter((s) => !/^(f\d{2,4}|\d{2,4}x\d{2,4}|thumbnails?)$/i.test(s));
  if (!segs.length) return null;
  return segs.slice(-2).join('/').replace(/\.(jpe?g|png|webp|gif|avif)$/i, '').toLowerCase() || null;
}

const adresse = (v) => (typeof v === 'string' && /^(https?:\/\/|blob:|data:image\/)/i.test(v) ? v : '');

// Les photos d'UN article, dans son ordre : [{ grande, cles[] }].
export function photosDeLArticle(it) {
  if (!it || typeof it !== 'object') return [];
  const listes = [it.photosDetail, it.photos, it.item_photos, it.images, it.imageUrls];
  const L = listes.find((l) => Array.isArray(l) && l.length) || [];
  const out = [], vus = new Set();
  for (const p of L.slice(0, 30)) {
    let grande = '', autres = [];
    if (typeof p === 'string') grande = adresse(p);
    else if (p && typeof p === 'object') {
      grande = adresse(p.full_size_url) || adresse(p.url) || adresse(p.src) || adresse(p.imageUrl);
      autres = [p.url, p.full_size_url, p.src, ...(Array.isArray(p.thumbnails) ? p.thumbnails.map((t) => t && t.url) : [])].map(adresse).filter(Boolean);
    }
    if (!grande) continue;
    const cles = [...new Set([grande, ...autres].map(clePhoto).filter(Boolean))];
    if (!cles.length || cles.some((c) => vus.has(c))) continue;
    cles.forEach((c) => vus.add(c));
    out.push({ grande, cles });
  }
  return out;
}

// Le registre : clé de fichier → la galerie de SON article. Un fichier vu dans deux
// articles différents (deux fiches à la même photo) garde la PREMIÈRE galerie : on
// montre des photos, on ne relie rien.
const _galeries = new Map();
export function enregistrerGaleries(articles) {
  if (!Array.isArray(articles)) return 0;
  let n = 0;
  for (const it of articles) {
    const ph = photosDeLArticle(it);
    if (ph.length < 2) continue;
    const galerie = ph.map((p) => p.grande);
    ph.forEach((p, i) => p.cles.forEach((c) => { if (!_galeries.has(c)) { _galeries.set(c, { galerie, i }); n++; } }));
  }
  return n;
}
export function oublierGaleries() { _galeries.clear(); }

// La galerie d'une adresse touchée : { photos, index }. Jamais vide si `url` l'est pas.
export function galerieDe(url) {
  const u = String(url || '');
  if (!u) return { photos: [], index: 0 };
  const c = clePhoto(u);
  const g = c ? _galeries.get(c) : null;
  if (g && g.galerie.length) return { photos: g.galerie.slice(), index: Math.max(0, Math.min(g.i, g.galerie.length - 1)) };
  return { photos: [u], index: 0 };
}

// L'adresse d'ORIGINE d'une vignette rendue (une photo Vinted servie par le secours
// de l'extension est un `blob:` ; son origine est sur `data-photo-origine`).
export function origineVignette(img) {
  if (!img || !img.getAttribute) return '';
  return img.getAttribute('data-photo-origine') || img.getAttribute('data-vrm-grande') || img.currentSrc || img.getAttribute('src') || '';
}

// Ce toucher ouvre-t-il la visionneuse ? Rend l'image, ou null.
export function vignetteTouchee(cible) {
  const img = cible && cible.closest ? cible.closest('img[data-vrm-vignette]') : null;
  if (!img) return null;
  if (img.closest('[data-sans-visionneuse], .vrm-visionneuse')) return null;
  const r = img.getBoundingClientRect ? img.getBoundingClientRect() : { width: 0, height: 0 };
  if (r.width < TAILLE_MIN_VIGNETTE || r.height < TAILLE_MIN_VIGNETTE) return null;
  if (img.complete === false || !(img.naturalWidth > 0)) return null;   // image absente ⇒ rien
  // Une photo qui EST tout le bouton (case du Stock, choix d'une photo dans l'atelier
  // Republier) : il n'y a pas de « reste de la rangée », le geste du bouton gagne.
  const porte = img.parentElement && img.parentElement.closest ? img.parentElement.closest('button, a[href], [role="button"], label') : null;
  if (porte) {
    const p = porte.getBoundingClientRect();
    if (p.width > 0 && p.height > 0 && (r.width * r.height) >= 0.8 * (p.width * p.height)) return null;
  }
  return img;
}

export function ouvrirVisionneuse(photos, index = 0) {
  const L = (Array.isArray(photos) ? photos : [photos]).map((p) => String(p || '')).filter(Boolean);
  if (!L.length) return false;
  try { window.dispatchEvent(new CustomEvent(EVT_VISIONNEUSE, { detail: { photos: L, index: Math.max(0, Math.min(Number(index) || 0, L.length - 1)) } })); return true; } catch (_) { return false; }
}

// Le zoom : borné, et un double toucher bascule 1 ⇄ 2,5.
export const ZOOM_MIN = 1, ZOOM_MAX = 5, ZOOM_DOUBLE = 2.5;
export const borneZoom = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number.isFinite(z) ? z : 1));
// Le déplacement d'une photo zoomée reste dans son cadre (jamais un écran noir).
export function borneDeplacement(x, y, zoom, largeur, hauteur) {
  const mx = Math.max(0, (zoom - 1) * largeur / 2), my = Math.max(0, (zoom - 1) * hauteur / 2);
  return { x: Math.max(-mx, Math.min(mx, x)), y: Math.max(-my, Math.min(my, y)) };
}
