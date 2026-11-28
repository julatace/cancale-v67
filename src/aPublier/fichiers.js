// ── LES FICHIERS CHOISIS POUR LE DOSSIER « À PUBLIER » (28 nov.) — dans la page, sans IA, sans service (§2.9) ─────────
// Pour chaque photo choisie (galerie du téléphone, fichiers ou dossier de l'ordinateur) :
//   h   — l'empreinte EXACTE : SHA-256 des octets du fichier (crypto.subtle) — « fichier exact » ;
//   e   — l'empreinte PERCEPTUELLE du fichier tel quel (src/photoEmpreinte.js, la règle de l'extension) ;
//   img — la photo rangée : recadrée au format des annonces, comme le studio (`recadrerFichier`) ; ec : son empreinte ;
//   vig — une vignette de 120 px (la liste du dossier la lit seule, par projection) ;
//   nom, t (heure du fichier), chemin (dossier, à l'ordinateur) — pour PROPOSER un regroupement, jamais une identité.
// Une photo illisible est écartée et DITE (jamais une photo vide présentée comme une photo).
import { empreinteImageLocale } from '../photosComptes.js';
import { recadrerFichier } from '../studioPhoto.js';

const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
export async function sha256Fichier(f) {
  try { const b = await f.arrayBuffer(); const d = await crypto.subtle.digest('SHA-256', b); return hex(d); } catch (_) { return ''; }
}
const vignette = (src, largeur = 120) => new Promise((ok) => {
  const im = new Image();
  im.onload = () => { try { const w = largeur, h = Math.round((im.naturalHeight / Math.max(1, im.naturalWidth)) * w); const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h); ok(c.toDataURL('image/jpeg', 0.7)); } catch (_) { ok(''); } };
  im.onerror = () => ok(''); im.src = src;
});
let _n = 0;
export async function lireFichierPhoto(f) {
  if (!f || !/^image\//.test(String(f.type || ''))) return null;
  const url = URL.createObjectURL(f);
  try {
    const [h, e, img] = await Promise.all([sha256Fichier(f), empreinteImageLocale(url), recadrerFichier(f)]);
    if (!img) return null;
    const ec = await empreinteImageLocale(img);
    const vig = await vignette(img);
    _n += 1;
    return { id: 'p' + Date.now().toString(36) + (_n).toString(36) + Math.random().toString(36).slice(2, 5), h, e: e || '', ec: ec || '', img, vig,
      nom: String(f.name || '').slice(0, 120), t: Number.isFinite(f.lastModified) ? f.lastModified : null, chemin: String(f.webkitRelativePath || '') };
  } catch (_) { return null; } finally { URL.revokeObjectURL(url); }
}
// Plusieurs fichiers, dans l'ordre de SA sélection (puis l'heure du fichier pour les égalités, jamais réordonnés sinon).
export async function lireFichiersPhotos(liste, { surProgres = null } = {}) {
  const L = Array.from(liste || []);
  const out = []; let rates = 0;
  for (let i = 0; i < L.length; i++) {
    const p = await lireFichierPhoto(L[i]);
    if (p) out.push(p); else rates += 1;
    if (typeof surProgres === 'function') surProgres(i + 1, L.length);
  }
  return { photos: out, rates };
}
