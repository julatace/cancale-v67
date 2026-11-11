// ══════════════════════════════════════════════════════════════════════════
// L'EMPREINTE D'UNE PHOTO (11 nov., lot photos-comptes — demande de Julien :
// « Vinted relie les comptes entre eux et peut les bannir ; une même photo
// publiée sur deux de mes comptes est un risque »).
//
// • Une empreinte PERCEPTUELLE : deux empreintes de 64 bits (dHash et pHash) à
//   trois recadrages (détail plus bas). Elle résiste à la
//   recompression, au redimensionnement, à la luminosité et à un recadrage léger ;
//   deux photos DIFFÉRENTES de la même paire restent loin. Le seuil `SEUIL_PHOTO`
//   est MESURÉ par le banc `photos-comptes` sur un jeu d'images inventé.
// • Calculée SANS IA (§2.9), localement : par l'extension pour les photos de
//   vinted.net (la page ne peut pas en lire les pixels), par la page pour les
//   photos de VRM. Jamais l'image n'est rangée : l'empreinte seule.
// • ⚠️ §5 : un doublon de photo est un RISQUE à montrer, JAMAIS une identité. Rien
//   ici ne relie, ne renumérote ni ne fusionne deux fiches (`entryKeyByPhoto` et
//   `jumellesParPhoto` ne lisent pas ce fichier).
// Le bloc <empreinte-photo-regle> est recopié dans background.js par
// `node scripts/audit-photos-comptes.cjs --recopie` — ne jamais le modifier là-bas.
// ══════════════════════════════════════════════════════════════════════════

// <empreinte-photo-regle>
// La taille à laquelle l'image est dessinée avant le calcul (étirée, sans garder les
// proportions : la même règle pour toutes les photos, page et extension).
export const COTE_EMPREINTE = 64;
// L'empreinte d'une photo = 6 empreintes de 64 bits : dHash (gradient horizontal, 9 × 8)
// et pHash (transformée en cosinus 32 × 32, bloc 8 × 8 comparé à sa médiane), chacune
// sur l'image entière et recadrée de 4 % et 8 % tout autour (un recadrage léger d'un
// côté retombe sur l'un des trois). 96 caractères hexadécimaux.
// Distance de deux photos = (meilleure distance dHash) + (meilleure distance pHash) / 2.
// MESURÉ (banc photos-comptes-seuil, 11 nov., 48 photos inventées × 11 transformations) :
// même photo recompressée / réduite / agrandie / éclaircie / recadrée ⇒ ≤ 13 ;
// photo différente (même paire autrement cadrée, ou autre paire) ⇒ ≥ 19. Seuil entre les deux.
export const SEUIL_PHOTO = 16;
const RECADRAGES = [0, 0.04, 0.08];
const N_DCT = 32;
let _cos = null;
function tableCos() {
  if (_cos) return _cos;
  _cos = new Float64Array(8 * N_DCT);
  for (let u = 0; u < 8; u++) for (let x = 0; x < N_DCT; x++) _cos[u * N_DCT + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N_DCT));
  return _cos;
}
// Niveaux de gris de la zone [c, 1 − c] réduits à nx × ny par moyenne de surface.
function grisReduit(gris, w, h, c, nx, ny) {
  const ax = w * c, ay = h * c, lw = w * (1 - 2 * c), lh = h * (1 - 2 * c);
  const out = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const y0 = ay + (j * lh) / ny, y1 = ay + ((j + 1) * lh) / ny;
    for (let i = 0; i < nx; i++) {
      const x0 = ax + (i * lw) / nx, x1 = ax + ((i + 1) * lw) / nx;
      let s = 0, a = 0;
      for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y1)); y++) {
        const fy = Math.min(y + 1, y1) - Math.max(y, y0);
        if (fy <= 0) continue;
        for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x1)); x++) {
          const fx = Math.min(x + 1, x1) - Math.max(x, x0);
          if (fx <= 0) continue;
          s += fx * fy * gris[y * w + x]; a += fx * fy;
        }
      }
      out[j * nx + i] = a > 0 ? s / a : 0;
    }
  }
  return out;
}
const versHex = (bits) => { let h = ''; for (let q = 0; q < 16; q++) { let n = 0; for (let b = 0; b < 4; b++) n = (n << 1) | (bits[q * 4 + b] ? 1 : 0); h += n.toString(16); } return h; };
function dHash(g) {                                    // g : 9 × 8
  const bits = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push(g[y * 9 + x] < g[y * 9 + x + 1]);
  return versHex(bits);
}
function pHash(g) {                                    // g : 32 × 32
  const c = tableCos();
  const lignes = new Float64Array(8 * N_DCT);
  for (let y = 0; y < N_DCT; y++) for (let u = 0; u < 8; u++) { let s = 0; for (let x = 0; x < N_DCT; x++) s += g[y * N_DCT + x] * c[u * N_DCT + x]; lignes[u * N_DCT + y] = s; }
  const bloc = new Float64Array(64);
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) { let s = 0; for (let y = 0; y < N_DCT; y++) s += lignes[u * N_DCT + y] * c[v * N_DCT + y]; bloc[v * 8 + u] = s; }
  const ac = Array.from(bloc).slice(1).sort((x, y) => x - y);
  const med = (ac[31] + ac[32]) / 2;
  return versHex(Array.from(bloc, (v, i) => i > 0 && v > med));
}
// `rgba` : les octets R, G, B, A ligne par ligne (ImageData.data), `w` × `h`.
// Rend 96 caractères hexadécimaux, ou null si l'image n'est pas lisible (vide, ou
// uniforme : une photo sans aucun détail ne dit rien — « pas su », jamais un faux).
export function empreinteDepuisPixels(rgba, w, h) {
  w = Math.floor(Number(w)); h = Math.floor(Number(h));
  if (!rgba || !(w > 0) || !(h > 0) || rgba.length < w * h * 4) return null;
  const gris = new Float64Array(w * h);
  let mn = 255, mx = 0;
  for (let i = 0; i < w * h; i++) { const v = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]; gris[i] = v; if (v < mn) mn = v; if (v > mx) mx = v; }
  if (!(mx - mn > 2)) return null;                     // image uniforme : rien à dire
  let d = '', p = '';
  for (const c of RECADRAGES) { d += dHash(grisReduit(gris, w, h, c, 9, 8)); p += pHash(grisReduit(gris, w, h, c, N_DCT, N_DCT)); }
  return d + p;
}
export function empreinteValide(h) { return typeof h === 'string' && /^[0-9a-f]{96}$/.test(h); }
const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
function hamming16(a, i, b, j) { let n = 0; for (let k = 0; k < 16; k++) n += BITS[parseInt(a[i + k], 16) ^ parseInt(b[j + k], 16)]; return n; }
// Distance de deux photos (0…96) ; null si l'une n'est pas lisible.
export function distanceEmpreintes(a, b) {
  if (!empreinteValide(a) || !empreinteValide(b)) return null;
  let dd = 64, dp = 64;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    dd = Math.min(dd, hamming16(a, i * 16, b, j * 16));
    dp = Math.min(dp, hamming16(a, 48 + i * 16, b, 48 + j * 16));
  }
  return dd + dp / 2;
}
export function memePhoto(a, b, seuil = SEUIL_PHOTO) {
  const d = distanceEmpreintes(a, b);
  return d != null && d <= seuil;
}
// La clé d'une photo (son adresse sans la signature `?s=`) : ce qui dit « cette photo
// est déjà calculée ». Jamais une identité de paire.
export function clePhotoEmpreinte(url) {
  const s = String(url || '').trim();
  if (!/^https:\/\/[\w.-]+\//i.test(s)) return '';
  return s.split('#')[0].split('?')[0].slice(0, 240);
}
// </empreinte-photo-regle>

// ── LES PHOTOS EN DOUBLE ENTRE COMPTES ────────────────────────────────────────
// `annonces` : [{ plateforme, compte, nom, id, titre, numero, photo, url, photos:[url] }]
//   (les annonces EN LIGNE, la règle <enligne-regle> — c'est l'écran qui les donne) ;
// `empreintes` : { [plateforme:compte]: { [idAnnonce]: { [clePhoto]: hex } } } ;
// `comptesLus` : { [plateforme:compte]: true | false } (false = pas relu / pas su).
// Rend { groupes, nPasVerifiees, comptesPasVerifies, nVerifiees } :
//   un groupe = des annonces de COMPTES DIFFÉRENTS (au moins deux comptes Vinted
//   distincts) qui partagent une photo. Même compte seul ⇒ pas d'alerte. Les autres
//   plateformes y figurent « pour info » quand elles touchent un groupe Vinted.
export function photosEnDouble({ annonces = [], empreintes = {}, comptesLus = {}, seuil = SEUIL_PHOTO } = {}) {
  const items = [];                                    // une photo calculée = un point
  let nPasVerifiees = 0, nVerifiees = 0;
  const comptesPasVerifies = new Set();
  for (const a of Array.isArray(annonces) ? annonces : []) {
    if (!a || !a.id || !a.compte) continue;
    const cc = `${a.plateforme || 'vinted'}:${a.compte}`;
    // Les photos que l'écran connaît (couverture, fiche) : celles sans empreinte sont
    // « pas encore vérifiées ». Toutes les empreintes rangées pour l'annonce comparent.
    const photos = [...new Set((Array.isArray(a.photos) && a.photos.length ? a.photos : [a.photo]).map(clePhotoEmpreinte).filter(Boolean))];
    const emp = (empreintes[cc] && empreintes[cc][String(a.id)]) || {};
    if (comptesLus[cc] === false) { comptesPasVerifies.add(cc); nPasVerifiees += photos.length || 1; continue; }
    const connues = Object.entries(emp).filter(([, h]) => empreinteValide(h));
    for (const [k, h] of connues) items.push({ a, cc, k, h });
    nVerifiees += connues.length;
    const manquent = photos.filter((k) => !empreinteValide(emp[k])).length;
    nPasVerifiees += photos.length ? manquent : (connues.length ? 0 : 1);
  }
  // Union-find par annonce (une annonce = un nœud), sur les paires de photos proches :
  // comparaison complète, bornée (quelques milliers de photos au plus chez un vendeur).
  const cle = (it) => `${it.cc}|${it.a.id}`;
  const parent = new Map();
  const trouve = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const unir = (x, y) => { const a = trouve(x), b = trouve(y); if (a !== b) parent.set(a, b); };
  for (const it of items) if (!parent.has(cle(it))) parent.set(cle(it), cle(it));
  const liens = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const x = items[i], y = items[j];
      if (x.cc === y.cc) continue;                     // même compte : pas d'alerte
      const d = distanceEmpreintes(x.h, y.h);
      if (d != null && d <= seuil) { unir(cle(x), cle(y)); liens.push({ x, y, d }); }
    }
  }
  const parRacine = new Map();
  for (const l of liens) {
    const r = trouve(cle(l.x));
    if (!parRacine.has(r)) parRacine.set(r, { annonces: new Map(), photos: new Map(), dmin: 64 });
    const g = parRacine.get(r);
    for (const it of [l.x, l.y]) {
      if (!g.annonces.has(cle(it))) g.annonces.set(cle(it), { ...it.a, cc: it.cc, photosCommunes: [] });
      const an = g.annonces.get(cle(it));
      if (!an.photosCommunes.includes(it.k)) an.photosCommunes.push(it.k);
    }
    g.dmin = Math.min(g.dmin, l.d);
  }
  const groupes = [];
  for (const g of parRacine.values()) {
    const ann = [...g.annonces.values()];
    const comptesVinted = new Set(ann.filter((a) => (a.plateforme || 'vinted') === 'vinted').map((a) => a.cc));
    if (comptesVinted.size < 2) continue;              // le risque est entre comptes VINTED
    ann.sort((a, b) => String(a.cc).localeCompare(String(b.cc)) || String(a.id).localeCompare(String(b.id)));
    groupes.push({ id: ann.map((a) => `${a.cc}|${a.id}`).join('+'), annonces: ann, nComptes: comptesVinted.size, distance: g.dmin });
  }
  groupes.sort((a, b) => b.nComptes - a.nComptes || a.distance - b.distance || a.id.localeCompare(b.id));
  return { groupes, nPasVerifiees, nVerifiees, comptesPasVerifies: [...comptesPasVerifies] };
}

// ── AVANT DE PUBLIER ─────────────────────────────────────────────────────────
// `photos` : les empreintes des photos choisies ([{ cle?, h }]) ; `compteCible` :
// `vinted:<uid>` du compte qui va publier (null hors Vinted) ; `exclure` : les clés
// `cc|id` à ignorer (l'annonce elle-même, qu'on republie). Rend les annonces EN LIGNE
// d'un AUTRE compte Vinted qui portent une de ces photos, et le nombre de photos
// choisies qu'on n'a pas pu vérifier (empreinte pas calculée).
export function dejaSurAutreCompte({ photos = [], annonces = [], empreintes = {}, compteCible = null, compteSource = null, exclure = [], seuil = SEUIL_PHOTO } = {}) {
  const ex = new Set((exclure || []).map(String));
  const choisies = (photos || []).filter((p) => p && empreinteValide(p.h));
  const nPasVerifiees = (photos || []).length - choisies.length;
  const trouvees = new Map();
  if (choisies.length) {
    for (const a of annonces || []) {
      if (!a || !a.id || !a.compte || (a.plateforme || 'vinted') !== 'vinted') continue;
      const cc = `vinted:${a.compte}`;
      if (cc === compteCible || cc === compteSource || ex.has(`${cc}|${a.id}`)) continue;
      const emp = (empreintes[cc] && empreintes[cc][String(a.id)]) || null;
      if (!emp) continue;
      for (const h of Object.values(emp)) {
        const d = choisies.reduce((m, p) => { const x = distanceEmpreintes(p.h, h); return x != null && x < m ? x : m; }, 99);
        if (d <= seuil) { const k = `${cc}|${a.id}`; if (!trouvees.has(k) || trouvees.get(k).distance > d) trouvees.set(k, { ...a, cc, distance: d }); }
      }
    }
  }
  return { annonces: [...trouvees.values()].sort((a, b) => a.distance - b.distance), nPasVerifiees };
}
// Les empreintes connues d'une liste d'adresses de photos (`index` : clé ⇒ hex, toutes
// annonces confondues) — une photo de vinted.net déjà calculée par l'extension.
export function indexEmpreintes(empreintes = {}) {
  const ix = new Map();
  for (const parAnnonce of Object.values(empreintes || {})) for (const parPhoto of Object.values(parAnnonce || {})) for (const [k, h] of Object.entries(parPhoto || {})) if (empreinteValide(h)) ix.set(k, h);
  return ix;
}
