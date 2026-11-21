// src/photosEbayAjout.js
// ────────────────────────────────────────────────────────────────────────────
// (5 nov.) LES PHOTOS AJOUTÉES À UNE ANNONCE eBAY DEPUIS LE TÉLÉPHONE.
// Julien (demandes du 5 nov.) : « prendre en photo l'article ou l'importer
// depuis la galerie ». Le formulaire « Vendre sur eBay » (EbayPublier) prend
// une photo à l'appareil ou en choisit plusieurs dans la galerie ; chacune est
// réduite ici (1600 px, JPEG), confiée à l'hébergement d'images d'eBay par la
// route eBay (action `photo`, api/_lib/ebay-photo.js), et c'est son ADRESSE
// i.ebayimg.com qui rejoint la liste des photos de l'annonce — dans l'ordre
// qu'il choisit, la première servant de couverture.
// Une règle, un propriétaire (§11) : l'adresse d'une photo hébergée chez eBay
// se reconnaît par `URL_PHOTO_EBAY`, ici — le serveur l'importe.
// ────────────────────────────────────────────────────────────────────────────

export const URL_PHOTO_EBAY = /^https:\/\/i\.ebayimg\.com\/[^\s<>"']+$/;
export const PHOTOS_AJOUT_MAX = 12;    // photos ajoutées depuis le téléphone, par annonce
export const PHOTOS_EBAY_MAX = 24;     // ce qu'eBay prend au plus (itemXml n'en envoie pas plus)
export const PHOTO_COTE_MAX = 1600;    // eBay recommande au moins 500 px ; 1600 suffit au zoom

export const estPhotoAjoutee = (u) => URL_PHOTO_EBAY.test(String(u || ''));

// Combien de photos on peut encore ajouter : la borne des ajouts (12) ET celle
// d'eBay (24 en tout), en comptant celles en cours d'envoi.
export function placesPhotos(urls, enAttente = 0) {
  const l = Array.isArray(urls) ? urls : [];
  const ajoutees = l.filter(estPhotoAjoutee).length + Math.max(0, enAttente | 0);
  const total = l.length + Math.max(0, enAttente | 0);
  return Math.max(0, Math.min(PHOTOS_AJOUT_MAX - ajoutees, PHOTOS_EBAY_MAX - total));
}

// Déplacer la photo `i` d'un cran (`sens` = -1 vers la couverture, +1 vers la
// fin). Rend une NOUVELLE liste ; hors bornes ⇒ la liste telle quelle.
export function deplacerPhoto(urls, i, sens) {
  const l = Array.isArray(urls) ? urls.slice() : [];
  const j = i + sens;
  if (!Number.isInteger(i) || i < 0 || i >= l.length || j < 0 || j >= l.length) return l;
  [l[i], l[j]] = [l[j], l[i]];
  return l;
}

// Garder les photos ajoutées quand la liste change de source (choisir une
// autre paire, relire ses photos sur Vinted) : celles de la paire d'abord,
// puis celles qu'il a ajoutées, sans doublon.
export function avecPhotosAjoutees(nouvelles, anciennes) {
  const out = [];
  for (const u of [...(nouvelles || []), ...(anciennes || []).filter(estPhotoAjoutee)]) if (u && !out.includes(u)) out.push(u);
  return out;
}

// La photo réduite en JPEG (base64, sans en-tête « data: »). Navigateur seul.
// Une photo que ce navigateur ne sait pas lire (HEIC sur Chrome) lève : l'écran
// le dit sur la vignette, rien n'est envoyé.
export async function photoEnJpegBase64(fichier, cote = PHOTO_COTE_MAX, qualite = 0.85) {
  if (!fichier || !/^image\//i.test(fichier.type || 'image/')) throw new Error('ce fichier n\'est pas une photo');
  let source, l, h, fermer = () => {};
  if (typeof createImageBitmap === 'function') {
    try { source = await createImageBitmap(fichier, { imageOrientation: 'from-image' }); } catch (_) { source = null; }
    if (source) { l = source.width; h = source.height; fermer = () => { try { source.close(); } catch (_) {} }; }
  }
  if (!source) {
    const url = URL.createObjectURL(fichier);
    try {
      source = await new Promise((ok, ko) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ko(new Error('photo illisible par ce navigateur')); im.src = url; });
      l = source.naturalWidth; h = source.naturalHeight;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 0); }
  }
  if (!(l > 0 && h > 0)) { fermer(); throw new Error('photo illisible par ce navigateur'); }
  const r = Math.min(1, cote / Math.max(l, h));
  const W = Math.max(1, Math.round(l * r)), H = Math.max(1, Math.round(h * r));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);   // un PNG transparent ne devient pas noir
  cx.drawImage(source, 0, 0, W, H);
  fermer();
  const data = cv.toDataURL('image/jpeg', qualite);
  const b64 = data.slice(data.indexOf(',') + 1);
  if (!/^\/9j\//.test(b64)) throw new Error('photo pas convertie');
  return b64;
}
