// ── LA BONNE TAILLE DE PHOTO POUR CHAQUE AFFICHAGE (23 nov., lot photos-nettes) ──
// Julien (capture iPhone) : « toutes les photos sont floues » — en plein écran, la photo
// d'un achat était une vignette 150 × 210 agrandie.
//
// LA MESURE (vraie base, lecture seule, 23 nov.) :
//   · « Mes achats » / « Mes ventes » (`my_orders`) ne donnent QU'UNE vignette 150x210
//     (727 achats et 772 ventes en ont une ; aucune autre taille) ;
//   · le dressing (`harvest_*_listings`) et le coffre (`coffre_*`) rangent la pleine
//     taille (`/tc/…`, `full_size_url`) ; le détail de transaction (`harvest_*_txn_*`)
//     range `order.items[].photos[]` avec f800 + thumbnails (70x100 · 150x210 · 310x430) ;
//   · CHAQUE taille a SA signature (`?s=…`) : réécrire « 150x210 » en « f800 » donne une
//     adresse que Vinted n'a jamais donnée. ⇒ on ne fabrique AUCUNE adresse : on choisit
//     parmi celles que l'app a déjà lues pour LE MÊME FICHIER (clé `clePhoto`, la même que
//     la visionneuse : l'hôte et le répertoire de taille retirés). Mesuré : 498 ventes sur
//     772 ont une plus grande taille connue (dressing, coffre, détail) ; 34 achats sur 727.
//   · Aucune requête nouvelle vers Vinted : seulement des adresses déjà lues, chargées
//     comme les autres photos de l'app. Une plus grande taille n'est montrée qu'une fois
//     CHARGÉE (préchargée à côté) : la petite reste à l'écran d'ici là, jamais un trou.
//
// LA RÈGLE : une image se montre à au moins 2 pixels réels par point affiché (écran Retina) ;
// une vignette de 44 pt veut ≥ 88 px, une carte de 180 pt ≥ 360 px, le plein écran la plus
// grande taille connue. On prend la PLUS PETITE taille connue qui suffit (pas de pleine
// taille dans une liste quand 310 suffit) ; sinon la plus grande connue ; jamais plus petit
// que celle qu'on a.
import { clePhoto } from './visionneuse.js';

export const FACTEUR_RETINA = 2;
// Une pleine taille (`/tc/…`, `full_size_url`) : sa largeur n'est pas écrite dans l'adresse.
export const LARGEUR_PLEINE = 4096;
export const MAX_FICHIERS = 6000;

const adresse = (v) => (typeof v === 'string' && /^https:\/\//i.test(v) && v.length < 1200 ? v : '');

// La largeur (px) d'une adresse Vinted, lue dans SON chemin ; null : pas sue (autre site…).
export function largeurPhoto(url) {
  const u = adresse(url);
  if (!u || !/^https:\/\/(?:[a-z0-9-]+\.)*vinted\.net\//i.test(u)) return null;
  const chemin = u.split('?')[0];
  if (/\/tc\//i.test(chemin)) return LARGEUR_PLEINE;
  let m = /\/f(\d{2,4})\//i.exec(chemin); if (m) return Number(m[1]);
  m = /\/(\d{2,4})x(\d{2,4})\//i.exec(chemin); if (m) return Number(m[1]);
  return null;
}

// clé de fichier → Map(adresse → largeur)
const _tailles = new Map();
export function oublierTailles() { _tailles.clear(); }

function noterUne(url, largeur) {
  const u = adresse(url); if (!u) return false;
  const w = Number.isFinite(largeur) && largeur > 0 ? largeur : largeurPhoto(u);
  if (!w) return false;
  const c = clePhoto(u); if (!c) return false;
  let m = _tailles.get(c);
  if (!m) { if (_tailles.size >= MAX_FICHIERS) _tailles.delete(_tailles.keys().next().value); m = new Map(); _tailles.set(c, m); }
  if (m.get(u) === w) return false;
  m.set(u, w);
  return true;
}

// Range les tailles d'une photo : une adresse, un objet photo Vinted ({ url, full_size_url,
// thumbnails[{ url, width }] }) ou une liste de ceux-là. Rend le nombre d'adresses neuves.
export function noterPhotos(p, profondeur = 0) {
  if (profondeur > 3 || p == null) return 0;
  if (typeof p === 'string') return noterUne(p) ? 1 : 0;
  if (Array.isArray(p)) { let n = 0; for (const x of p.slice(0, 40)) n += noterPhotos(x, profondeur + 1); return n; }
  if (typeof p !== 'object') return 0;
  let n = 0;
  for (const k of ['url', 'full_size_url', 'src', 'imageUrl']) if (typeof p[k] === 'string' && noterUne(p[k], k === 'full_size_url' ? LARGEUR_PLEINE : undefined)) n++;
  if (Array.isArray(p.thumbnails)) for (const t of p.thumbnails.slice(0, 12)) if (t && typeof t.url === 'string' && noterUne(t.url)) n++;
  return n;
}

// Les tailles connues du fichier de `url` : [{ url, largeur }], de la plus petite à la plus grande.
export function taillesConnues(url) {
  const c = clePhoto(url); const m = c ? _tailles.get(c) : null;
  return m ? [...m.entries()].map(([u, l]) => ({ url: u, largeur: l })).sort((a, b) => a.largeur - b.largeur) : [];
}

// L'adresse à montrer pour un besoin de `besoin` px réels (largeur). Jamais plus petite que `url`.
export function photoPour(url, besoin) {
  const u = String(url || '');
  const w0 = largeurPhoto(u);
  if (!u || !w0) return u;
  const L = taillesConnues(u).filter((t) => t.largeur > w0);
  if (!L.length || !(besoin > w0)) return u;
  const assez = L.find((t) => t.largeur >= besoin);
  return (assez || L[L.length - 1]).url;
}
export const pleineTaille = (url) => photoPour(url, Infinity);

// Le besoin en px réels (largeur de l'image) d'une image affichée `cssL` × `cssH` points, dont
// l'image chargée fait `nl` × `nh` px, en `cover` (rognée) ou `contain`.
export function besoinAffiche(cssL, cssH, nl, nh, ajustement = 'cover') {
  if (!(cssL > 0) || !(cssH > 0) || !(nl > 0) || !(nh > 0)) return 0;
  const k = ajustement === 'contain' ? Math.min(cssL / nl, cssH / nh) : Math.max(cssL / nl, cssH / nh);
  return Math.ceil(FACTEUR_RETINA * k * nl);
}
