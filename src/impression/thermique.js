// ── IMPRESSION DES BORDEREAUX : A4 OU THERMIQUE, PERSONNALISABLE (11 nov.) ──
// Julien : « bordereaux pour imprimante thermique, PERSONNALISABLES en fonction
// de l'imprimante ; tu dois prendre en compte le tamponnage ; peut-être qu'il ne
// veut pas le titre du produit dessus car visible ».
//
// Ce fichier porte les RÈGLES, pures (aucun PDF, aucun DOM) : le réglage, les
// formats, l'orientation et l'échelle d'une étiquette, la découpe d'une page
// en étiquettes d'après l'ENCRE, la taille du module des codes, ce que dit le
// tampon. `src/App.jsx` (poserBordereau) les applique ; `audit-thermique.cjs`
// et le banc `thermique.cjs` les jugent.
//
// Deux réglages, deux propriétaires (§11) :
//   · `vrm_imprimante` : A4 ou thermique (le choix d'avant, inchangé) ;
//   · `vrm_impression` : QUEL papier thermique, marges, encre, ce que dit le
//     tampon, la fiche de préparation. Synchronisé (SYNC_KEYS).

export const CLE_IMPRESSION = 'vrm_impression';
export const MM = 72 / 25.4;                       // points par millimètre

// Les papiers thermiques courants (mm, debout : largeur × hauteur).
// `continu` : rouleau sans fin (la hauteur suit l'étiquette).
export const FORMATS_THERMIQUES = Object.freeze([
  { id: '10x15', w: 100, h: 150, marge: 2.5, nom: '10 × 15 cm', aide: '4 × 6 in · Zebra, Rollo, Munbyn, Phomemo PM-241' },
  { id: '10x10', w: 100, h: 100, marge: 2.5, nom: '10 × 10 cm', aide: 'étiquette carrée' },
  { id: '10x15m', w: 100, h: 150, marge: 5, nom: '100 × 150 avec marge', aide: 'tête qui n’imprime pas jusqu’au bord' },
  { id: 'dymo4xl', w: 104, h: 159, marge: 3, nom: 'Dymo 4XL', aide: '104 × 159 mm' },
  { id: 'ql62', w: 62, h: null, marge: 1.5, continu: true, nom: 'Brother QL · 62 mm', aide: 'rouleau continu' },
  { id: 'autre', w: null, h: null, marge: 2.5, nom: 'Autre', aide: 'largeur × hauteur en mm' },
]);
export const AUTRE_MIN_MM = 25, AUTRE_MAX_MM = 300, MARGE_MAX_MM = 10;
// Ce que dit le tampon. En thermique, le N° seul est proposé : l'étiquette est
// collée SUR le colis, son titre se lit par le transporteur et le voisin.
export const TAMPONS = Object.freeze(['num', 'num_titre', 'num_titre_taille', 'rien']);
export const NOMS_TAMPON = Object.freeze({ num: 'N° seul', num_titre: 'N° + titre', num_titre_taille: 'N° + titre + taille', rien: 'Rien' });
export const POURQUOI_TITRE_CACHE = 'Le titre est caché par défaut : l’étiquette se colle sur le colis, il serait visible par le transporteur.';
// L'encre : « noir pur » repasse l'étiquette en noir et blanc (aucun gris — une
// tête thermique tramerait le gris en pointillés, un code-barres gris se lit
// mal) ; « tel quel » garde le PDF du transporteur.
export const ENCRES = Object.freeze(['noir', 'tel']);
export const CONTRASTES = Object.freeze({ clair: 110, normal: 150, fonce: 190 });   // seuil de luminance : sous ⇒ noir
// La plus petite barre (ou case de QR) qu'une tête 203 dpi trace sur DEUX
// points : 2 × 0,125 mm. Plus fin, le code risque de ne pas se lire.
export const MODULE_MIN_MM = 0.25;
export const AGRANDI_MAX = 1.25;                   // jamais agrandie de plus de 25 %
export const BANDE_CONTINU_MM = 12;                // rouleau continu : place du N° sous l'étiquette

const DEFAUT = Object.freeze({ format: '10x15', l: 100, h: 150, marge: null, encre: 'noir', contraste: 'normal', tamponA4: 'num_titre', tamponTh: 'num', fiche: true });
const nombre = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(String(v).replace(',', '.')) : NaN);
const borne = (v, a, b) => Math.max(a, Math.min(b, v));

// Le réglage lu, toujours complet et valide (une valeur étrange ⇒ le défaut).
export function reglageImpression(brut) {
  const r = brut && typeof brut === 'object' && !Array.isArray(brut) ? brut : {};
  const format = FORMATS_THERMIQUES.some((f) => f.id === r.format) ? r.format : DEFAUT.format;
  const l = nombre(r.l), h = nombre(r.h), m = nombre(r.marge);
  return {
    format,
    l: Number.isFinite(l) ? borne(Math.round(l * 10) / 10, AUTRE_MIN_MM, AUTRE_MAX_MM) : DEFAUT.l,
    h: Number.isFinite(h) ? borne(Math.round(h * 10) / 10, AUTRE_MIN_MM, AUTRE_MAX_MM) : DEFAUT.h,
    marge: Number.isFinite(m) ? borne(Math.round(m * 10) / 10, 0, MARGE_MAX_MM) : null,
    encre: ENCRES.includes(r.encre) ? r.encre : DEFAUT.encre,
    contraste: r.contraste in CONTRASTES ? r.contraste : DEFAUT.contraste,
    tamponA4: TAMPONS.includes(r.tamponA4) ? r.tamponA4 : DEFAUT.tamponA4,
    tamponTh: TAMPONS.includes(r.tamponTh) ? r.tamponTh : DEFAUT.tamponTh,
    fiche: r.fiche === false ? false : true,
  };
}

// Le papier du réglage, en millimètres : { w, h (null = continu), marge, continu, nom }.
export function papierThermique(reg) {
  const r = reglageImpression(reg), f = FORMATS_THERMIQUES.find((x) => x.id === r.format);
  const w = f.id === 'autre' ? r.l : f.w, h = f.id === 'autre' ? r.h : f.h;
  const marge = r.marge != null ? Math.min(r.marge, (Math.min(w, h || w) / 2) - 5) : f.marge;
  return { id: f.id, w, h, marge: Math.max(0, marge), continu: !!f.continu, nom: f.id === 'autre' ? `${fmtMm(w)} × ${fmtMm(h)} mm` : f.nom };
}
export const fmtMm = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
// Libellé court du réglage (la ligne de Paramètres, la feuille « Tout imprimer »).
export const libellePapier = (mode, reg) => (mode === 'thermique' ? `Thermique · ${papierThermique(reg).nom}` : 'Normale · A4');

// Ce que le tampon écrit. `taille` : la pointure lue sur la vente (jamais devinée
// au-delà de ce que le titre porte déjà) ; « num_titre_taille » ne la répète pas
// si le titre la contient.
export function contenuTampon(mode, { numero = '', titre = '', taille = '' } = {}) {
  const n = String(numero == null ? '' : numero).trim(), t = String(titre == null ? '' : titre).trim(), tl = String(taille == null ? '' : taille).trim();
  const m = TAMPONS.includes(mode) ? mode : 'num_titre';
  if (m === 'rien') return { numero: '', titre: '' };
  if (m === 'num') return { numero: n, titre: '' };
  if (m === 'num_titre') return { numero: n, titre: t };
  const tn = tl.replace(/[^\d.,]/g, '');
  const dejaLa = !!tn && new RegExp(`(^|[^\\d])${tn.replace(/[.,]/g, '[.,]')}([^\\d]|$)`).test(t);
  return { numero: n, titre: tl && !dejaLa ? (t ? `${t} · T ${tl}` : `T ${tl}`) : t };
}

// ── LA PLACE D'UNE ÉTIQUETTE SUR LE PAPIER ────────────────────────────────
// `r` : l'étiquette découpée ({ w, h } en points, dans le sens du PDF) ;
// `sens` : 90 ou -90, le côté qui remet son texte à l'endroit si on la tourne
// (null : -90) ; `papier` : papierThermique(). ORIENTATION AUTOMATIQUE : on
// garde le sens (droite ou tournée) qui donne la plus grande échelle, à égalité
// on ne tourne pas. L'étiquette est ENTIÈRE dans la marge, jamais rognée, jamais
// déformée (une seule échelle), jamais agrandie de plus de 25 %.
// `bande` (points) : place réservée sous l'étiquette (rouleau continu).
// Rend { W, H, x, y, s, angle, boite } — `x, y` le point d'ancrage pdf-lib
// (il tourne autour du coin bas-gauche de l'objet posé), `boite` la place
// occupée sur la page (points, origine en bas à gauche).
export function placementEtiquette(r, sens, papier, { bande = 0, agrandi = AGRANDI_MAX } = {}) {
  const m = papier.marge * MM, Wp = papier.w * MM;
  const essai = (tourne) => {
    const lw = tourne ? r.h : r.w, lh = tourne ? r.w : r.h;
    const dispoW = Wp - 2 * m;
    if (papier.continu || papier.h == null) return { tourne, lw, lh, s: Math.min(dispoW / lw, agrandi) };
    const dispoH = papier.h * MM - 2 * m - bande;
    return { tourne, lw, lh, s: Math.min(dispoW / lw, dispoH / lh, agrandi) };
  };
  const droite = essai(false), tournee = essai(true);
  // Rouleau continu : la largeur est fixe, on préfère le sens qui garde l'étiquette la plus grande,
  // puis la moins longue (moins de papier).
  const e = tournee.s > droite.s * 1.0001 ? tournee : droite;
  const dw = e.lw * e.s, dh = e.lh * e.s;
  const W = Wp, H = papier.continu || papier.h == null ? dh + 2 * m + bande : papier.h * MM;
  const dispoH = H - 2 * m - bande;
  const x0 = (W - dw) / 2, y0 = m + bande + (dispoH - dh) / 2;
  const angle = !e.tourne ? 0 : (sens === 90 ? 90 : -90);
  const x = angle === 90 ? x0 + dw : x0, y = angle === -90 ? y0 + dh : y0;
  return { W, H, x, y, s: e.s, angle, tourne: e.tourne, boite: { x: x0, y: y0, w: dw, h: dh }, bande };
}

// ── L'ENCRE D'UNE IMAGE (pixels RGBA) ─────────────────────────────────────
const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
// Une carte d'encre par cellules de `k` px : une cellule est de l'encre si au
// moins 2 de ses pixels sont sous `seuil` (un point isolé n'est pas de l'encre).
export function carteEncre(pixels, w, h, { seuil = 235, k = 3 } = {}) {
  const cw = Math.ceil(w / k), ch = Math.ceil(h / k), n = new Uint8Array(cw * ch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (lum(pixels, (y * w + x) * 4) < seuil) { const c = ((y / k) | 0) * cw + ((x / k) | 0); if (n[c] < 2) n[c]++; }
  }
  for (let i = 0; i < n.length; i++) n[i] = n[i] >= 2 ? 1 : 0;
  return { m: n, cw, ch, k };
}
// Un FILET (trait de découpe, cadre) : une ligne ou colonne de cellules dont
// l'encre est FINE (≤ 2 cellules d'épaisseur) et longue (≥ 60 % du côté). Il
// ne compte pas comme du contenu : rogner sur lui garderait la feuille entière.
function estFiletLigne(c, y, x0, x1) { let n = 0; for (let x = x0; x < x1; x++) n += c.m[y * c.cw + x]; return n >= (x1 - x0) * 0.6; }
function estFiletColonne(c, x, y0, y1) { let n = 0; for (let y = y0; y < y1; y++) n += c.m[y * c.cw + x]; return n >= (y1 - y0) * 0.6; }
// Masque des filets de DÉCOUPE : un filet (rangée ou colonne) près d'un BORD de la
// zone (≤ `bord` cellules) est retiré — sauf s'il a son pendant au bord opposé :
// c'est alors le CADRE de l'étiquette, qui est gardé. Un filet au milieu de la
// zone est du contenu (un trait de l'étiquette), toujours gardé.
function sansFilets(c, R, bord) {
  const m = c.m.slice(), { x0, y0, x1, y1 } = R;
  const lignes = [], cols = [];
  for (let y = y0; y < y1; y++) if (estFiletLigne(c, y, x0, x1)) lignes.push(y);
  for (let x = x0; x < x1; x++) if (estFiletColonne(c, x, y0, y1)) cols.push(x);
  const b = bord == null ? Math.max(2, Math.round((Math.min(x1 - x0, y1 - y0)) * 0.06)) : bord;
  const haut = lignes.filter((y) => y - y0 < b), bas = lignes.filter((y) => y1 - 1 - y < b);
  const gauche = cols.filter((x) => x - x0 < b), droite = cols.filter((x) => x1 - 1 - x < b);
  if (!(haut.length && bas.length)) for (const y of [...haut, ...bas]) for (let x = x0; x < x1; x++) m[y * c.cw + x] = 0;
  if (!(gauche.length && droite.length)) for (const x of [...gauche, ...droite]) for (let y = y0; y < y1; y++) m[y * c.cw + x] = 0;
  return m;
}
// La boîte de l'encre UTILE dans `rect` (pixels), filets écartés, élargie de
// `pad` px (la zone de silence des codes), bornée à `rect`. null : rien d'encré.
export function boiteEncre(carte, rect, pad = 0) {
  const k = carte.k, R = { x0: Math.max(0, Math.floor(rect.x / k)), y0: Math.max(0, Math.floor(rect.y / k)), x1: Math.min(carte.cw, Math.ceil((rect.x + rect.w) / k)), y1: Math.min(carte.ch, Math.ceil((rect.y + rect.h) / k)) };
  const m = sansFilets(carte, R);
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = R.y0; y < R.y1; y++) for (let x = R.x0; x < R.x1; x++) if (m[y * carte.cw + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const bx = Math.max(rect.x, x0 * k - pad), by = Math.max(rect.y, y0 * k - pad);
  const bX = Math.min(rect.x + rect.w, (x1 + 1) * k + pad), bY = Math.min(rect.y + rect.h, (y1 + 1) * k + pad);
  return { x: bx, y: by, w: bX - bx, h: bY - by };
}

// ── PLUSIEURS ÉTIQUETTES SUR UNE FEUILLE (1, 2 ou 4 par A4) ───────────────
// Une feuille se coupe au MILIEU (±15 %) seulement là où passe une GOUTTIÈRE :
// une bande d'au moins `gouttiere` px où rien n'est encré — un filet de
// découpe (pointillés, trait fin) y est permis. Chaque morceau doit porter au
// moins un CODE (code-barres ou QR : c'est ce qui fait une étiquette) et
// mesurer au moins `minCote` px de côté. Sinon : null (la feuille n'est pas
// découpée, la règle d'avant s'applique). `codes` : boîtes en pixels.
function coupeMilieu(carte, R, axe, gouttiere) {
  const { k } = carte, m = carte.m;
  const a0 = axe === 'x' ? R.x0 : R.y0, a1 = axe === 'x' ? R.x1 : R.y1, b0 = axe === 'x' ? R.y0 : R.x0, b1 = axe === 'x' ? R.y1 : R.x1;
  const L = a1 - a0, lo = a0 + Math.floor(L * 0.35), hi = a0 + Math.ceil(L * 0.65), g = Math.max(1, Math.ceil(gouttiere / k));
  // Vide : rien d'encré en travers, sauf un filet de découpe (pointillés ou trait fin) qui
  // court LE LONG de la coupe — une colonne (ou rangée) dont l'encre couvre ≥ 60 % du
  // côté sans épaisseur (ses voisines à 2 cellules sont vides) en fait partie.
  const brut = (a) => { let n = 0; for (let b = b0; b < b1; b++) n += m[axe === 'x' ? b * carte.cw + a : a * carte.cw + b]; return n; };
  const vide = (a) => { const n = brut(a); if (n === 0) return true; const L2 = b1 - b0; if (n < L2 * 0.25) return false;
    const voisinVide = (o) => a + o < a0 || a + o >= a1 || brut(a + o) === 0; return (voisinVide(-2) || voisinVide(-3)) && (voisinVide(2) || voisinVide(3)); };
  let best = null, i = lo;
  while (i < hi) {
    if (!vide(i)) { i++; continue; }
    let j = i; while (j < a1 && vide(j)) j++;
    let d = i; while (d > a0 && vide(d - 1)) d--;
    if (j - d >= g) { const c = (d + j) / 2, ecart = Math.abs(c - (a0 + a1) / 2); if (!best || ecart < best.ecart) best = { c, ecart }; }
    i = j + 1;
  }
  return best ? best.c * k : null;
}
export function decouperFeuille(carte, rect, codes, { minCote, gouttiere }) {
  const k = carte.k;
  const vers = (r) => ({ x0: Math.max(0, Math.floor(r.x / k)), y0: Math.max(0, Math.floor(r.y / k)), x1: Math.min(carte.cw, Math.ceil((r.x + r.w) / k)), y1: Math.min(carte.ch, Math.ceil((r.y + r.h) / k)) });
  const aCode = (r) => (codes || []).some((q) => q.x + q.w / 2 > r.x && q.x + q.w / 2 < r.x + r.w && q.y + q.h / 2 > r.y && q.y + q.h / 2 < r.y + r.h);
  // Un code coupé en deux par la coupe : on ne coupe pas là.
  const traverse = (axe, c) => (codes || []).some((q) => (axe === 'x' ? q.x < c && q.x + q.w > c : q.y < c && q.y + q.h > c));
  const couper = (r, axe) => {
    const c = coupeMilieu(carte, vers(r), axe, gouttiere); if (c == null || traverse(axe, c)) return null;
    const a = axe === 'x' ? { x: r.x, y: r.y, w: c - r.x, h: r.h } : { x: r.x, y: r.y, w: r.w, h: c - r.y };
    const b = axe === 'x' ? { x: c, y: r.y, w: r.x + r.w - c, h: r.h } : { x: r.x, y: c, w: r.w, h: r.y + r.h - c };
    return [a, b];
  };
  let parts = [rect];
  for (const axe of ['x', 'y']) {
    const suite = [];
    let coupe = false;
    for (const r of parts) { const p = couper(r, axe); if (p && p.every((q) => Math.min(q.w, q.h) >= minCote)) { suite.push(...p); coupe = true; } else suite.push(r); }
    if (coupe) parts = suite;
  }
  const etiquettes = parts.filter(aCode);
  if (parts.length < 2 || etiquettes.length < 2) return null;
  return etiquettes;
}

// ── LA TAILLE DU MODULE D'UN CODE ─────────────────────────────────────────
// La plus petite barre (ou case) d'un code repéré, en pixels : on suit des
// lignes (et des colonnes) à travers la zone, on note la longueur de chaque
// passage noir/blanc, et on prend le 10ᵉ centile des passages NOIRS (la barre
// la plus fine, sans le bruit d'un pixel d'anticrénelage). null : pas mesuré.
export function moduleDuCode(pixels, w, h, zone, seuil = 128) {
  const noir = (x, y) => lum(pixels, (y * w + x) * 4) < seuil;
  const runs = [];
  const x0 = Math.max(0, Math.round(zone.x)), y0 = Math.max(0, Math.round(zone.y)), x1 = Math.min(w, Math.round(zone.x + zone.w)), y1 = Math.min(h, Math.round(zone.y + zone.h));
  if (x1 - x0 < 4 || y1 - y0 < 4) return null;
  const suivre = (n, at) => { let cur = null, len = 0; for (let i = 0; i < n; i++) { const v = at(i); if (v === cur) len++; else { if (cur === true && len > 0) runs.push(len); cur = v; len = 1; } } };
  for (let t = 1; t <= 7; t++) { const y = y0 + Math.floor(((y1 - y0) * t) / 8); suivre(x1 - x0, (i) => noir(x0 + i, y)); }
  for (let t = 1; t <= 7; t++) { const x = x0 + Math.floor(((x1 - x0) * t) / 8); suivre(y1 - y0, (i) => noir(x, y0 + i)); }
  const v = runs.filter((r) => r >= 1).sort((a, b) => a - b);
  if (v.length < 6) return null;
  return v[Math.floor(v.length * 0.1)];
}
// Le module APRÈS mise en page, en mm : `modulePt` (points du PDF d'origine) × l'échelle.
export const moduleImprimeMm = (modulePt, s) => (modulePt * s) / MM;
export const codeAssezGros = (mm) => mm == null || mm + 1e-9 >= MODULE_MIN_MM;

// ── LE NOIR PUR : un pixel est noir ou blanc, jamais gris ─────────────────
export function seuillerNoir(pixels, seuil = CONTRASTES.normal) {
  for (let i = 0; i < pixels.length; i += 4) {
    const v = lum(pixels, i) < seuil ? 0 : 255;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = v; pixels[i + 3] = 255;
  }
  return pixels;
}
// La photo de la fiche de préparation, en noir et blanc tramé (Floyd–Steinberg) :
// une photo seuillée devient une tache noire, tramée elle reste reconnaissable.
export function tramerNoir(pixels, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = lum(pixels, i * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = g[i], n = o < 128 ? 0 : 255, e = o - n; g[i] = n;
    if (x + 1 < w) g[i + 1] += e * 7 / 16;
    if (y + 1 < h) { if (x > 0) g[i + w - 1] += e * 3 / 16; g[i + w] += e * 5 / 16; if (x + 1 < w) g[i + w + 1] += e / 16; }
  }
  for (let i = 0; i < w * h; i++) { const v = g[i] < 128 ? 0 : 255; pixels[i * 4] = pixels[i * 4 + 1] = pixels[i * 4 + 2] = v; pixels[i * 4 + 3] = 255; }
  return pixels;
}

// ── LES ZONES D'ADRESSE (jamais de tampon dessus) ─────────────────────────
// Un fragment de texte qui porte un code postal (5 chiffres, ou un code
// étranger courant) ou les mots « destinataire / expéditeur / adresse » marque
// un bloc d'adresse : la zone interdite couvre le bloc autour (au-dessus, où
// sont le nom et la rue, et un peu dessous). Boîtes en points, origine en bas
// à gauche (celles du relevé de la page) ; rend des boîtes du même repère.
const MOTS_ADRESSE = /destinataire|exp[ée]diteur|adresse|recipient|sender|\bship\s*to\b/i;
const CODE_POSTAL = /(^|\D)\d{5}(\D|$)|\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b|\b\d{4}\s?[A-Z]{2}\b/;
export function zonesAdresse(textes, { haut = 22 * MM, bas = 6 * MM, cote = 4 * MM } = {}) {
  const out = [];
  for (const o of textes || []) {
    if (!o || !o.s) continue;
    const mot = MOTS_ADRESSE.test(o.s), cp = CODE_POSTAL.test(o.s);
    if (!mot && !cp) continue;
    // « Destinataire » est AU-DESSUS du bloc ; un code postal en est la fin.
    const larg = Math.max(o.X - o.x, 45 * MM);
    out.push(mot ? { x: o.x - cote, y: o.y - haut - bas, w: larg + 2 * cote, h: (o.Y - o.y) + haut + 2 * bas }
                 : { x: o.x - cote, y: o.y - bas, w: larg + 2 * cote, h: (o.Y - o.y) + haut + bas });
  }
  return out;
}
