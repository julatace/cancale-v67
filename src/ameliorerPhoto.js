// ════════════════════════════════════════════════════════════════════════════
//  AMÉLIORER LES PHOTOS D'UNE PAIRE EN UN GESTE (23 nov., lot photos-un-geste — validé par Julien)
//  « Lumière, recadrage, fond uniforme, LOCALEMENT dans le navigateur, gratuit, sans IA payante ; réglages appliqués à
//  toutes les photos d'une annonce, original conservé. »
//
//  §2.9 : RIEN ne part chez un service, aucune clé, aucun modèle : de l'arithmétique sur les pixels, dans la page.
//    · LUMIÈRE  : niveaux automatiques — les 1 % les plus sombres et les 1 % les plus clairs de la luminance (Rec. 709)
//                 deviennent le noir et le blanc ; l'étirement est BORNÉ (gain ≤ 2,2) pour ne jamais brûler une photo
//                 déjà juste ; une photo déjà étalée (écart ≥ 235) n'est pas touchée ;
//    · FOND     : la couleur du fond = la médiane des pixels du BORD de la photo ; « fond uniforme » ne s'applique que
//                 si ce bord est vraiment uni (écart médian ≤ SEUIL_UNI) — sinon rien n'est changé, et c'est DIT
//                 (`fond: 'pas-uni'`) ; alors un remplissage depuis le bord (4-voisins) passe en blanc les pixels
//                 PROCHES de cette couleur et RELIÉS au bord : un pixel de la chaussure de la même teinte, mais enfermé
//                 par elle, n'est jamais blanchi. Ce n'est PAS un détourage (le détourage U²-Net reste Vestiaire seul,
//                 §3 ; rien ici n'est promis à Leboncoin ni à eBay) ;
//    · RECADRAGE: la boîte des pixels qui ne sont PAS le fond, une marge de 8 %, au format 3:4 des annonces ; un sujet
//                 introuvable (tout est fond, ou rien n'est fond) ⇒ pas de recadrage, dit (`recadrage: 'sujet'`).
//  UN réglage pour TOUTES les photos de la paire (le même choix appliqué à chacune) ; l'ORIGINAL (`img`) n'est jamais
//  remplacé : le résultat est rangé à côté (`ameliore`), « Revenir à l'original » le retire.
//  Partie PURE (`analyser`, `ameliorerPixels`) exécutée par scripts/audit-photos-un-geste.cjs ; la partie navigateur
//  (`ameliorerDataUrl`) n'ajoute que le canvas.
// ════════════════════════════════════════════════════════════════════════════
export const REGLAGES_DEFAUT = Object.freeze({ lumiere: true, recadrage: true, fond: true });
export const GAIN_MAX = 2.2;
export const SEUIL_UNI = 14;        // écart médian (0-255) au-delà duquel le bord n'est pas « uni »
export const TOLERANCE_FOND = 26;   // distance (0-255) d'un pixel à la couleur du fond pour être « du fond »
export const MARGE = 0.08;
export const RATIO = 3 / 4;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const mediane = (l) => { if (!l.length) return 0; const s = l.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const dist = (d, i, c) => Math.max(Math.abs(d[i] - c[0]), Math.abs(d[i + 1] - c[1]), Math.abs(d[i + 2] - c[2]));

// Les pixels du bord (une bande de 2 % au moins 1 px), échantillonnés.
function bord(img) {
  const { data: d, width: w, height: h } = img, e = Math.max(1, Math.round(Math.min(w, h) * 0.02)), out = [];
  const pas = Math.max(1, Math.floor((w + h) / 400));
  for (let y = 0; y < h; y += pas) for (let x = 0; x < w; x += pas) {
    if (x >= e && x < w - e && y >= e && y < h - e) { x = w - e - 1; continue; }
    out.push((y * w + x) * 4);
  }
  return out;
}

// L'ANALYSE : { bas, haut, fond: [r,g,b], ecartBord, uni }.
export function analyser(img) {
  const { data: d, width: w, height: h } = img;
  const hist = new Uint32Array(256); let n = 0;
  const pas = Math.max(1, Math.floor((w * h) / 250000));
  for (let p = 0; p < w * h; p += pas) { const i = p * 4; hist[Math.round(lum(d[i], d[i + 1], d[i + 2]))]++; n++; }
  const pc = (q) => { let s = 0; const k = n * q; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= k) return v; } return 255; };
  const B = bord(img);
  const fond = [0, 1, 2].map((c) => mediane(B.map((i) => d[i + c])));
  const ecartBord = mediane(B.map((i) => dist(d, i, fond)));
  return { bas: pc(0.01), haut: pc(0.99), fond, ecartBord, uni: ecartBord <= SEUIL_UNI };
}

// Les niveaux : f(v) = (v − bas) × gain, borné ; rien si la photo est déjà étalée.
export function niveaux(A) {
  const ecart = A.haut - A.bas;
  if (ecart >= 235 || ecart <= 0) return null;
  const gain = Math.min(GAIN_MAX, 255 / ecart);
  const bas = Math.max(0, A.bas - Math.max(0, (255 / gain - ecart) / 2));
  return { bas, gain };
}

// La boîte du sujet (ce qui n'est pas le fond) ⇒ { x, y, w, h } au format 3:4, ou null (pas de sujet net).
export function boiteSujet(img, fond, tol = TOLERANCE_FOND) {
  const { data: d, width: w, height: h } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (dist(d, (y * w + x) * 4, fond) > tol) { n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (!n || n > w * h * 0.97 || n < w * h * 0.005) return null;
  let bw = (x1 - x0 + 1) * (1 + 2 * MARGE), bh = (y1 - y0 + 1) * (1 + 2 * MARGE);
  if (bw / bh > RATIO) bh = bw / RATIO; else bw = bh * RATIO;
  if (bw > w) { bw = w; bh = bw / RATIO; } if (bh > h) { bh = h; bw = bh * RATIO; }
  const cx = (x0 + x1 + 1) / 2, cy = (y0 + y1 + 1) / 2;
  const bx = Math.min(Math.max(0, cx - bw / 2), w - bw), by = Math.min(Math.max(0, cy - bh / 2), h - bh);
  const B = { x: Math.round(bx), y: Math.round(by), w: Math.round(bw), h: Math.round(bh) };
  // Un cadre qui garde presque tout n'apprend rien : pas de recadrage.
  return B.w * B.h >= w * h * 0.92 ? null : B;
}

// Le fond en blanc : remplissage depuis le bord, seulement les pixels proches du fond ET reliés au bord.
// Rend le nombre de pixels blanchis. Modifie `img.data` en place.
export function blanchirFond(img, fond, tol = TOLERANCE_FOND) {
  const { data: d, width: w, height: h } = img;
  const vu = new Uint8Array(w * h), pile = new Int32Array(w * h); let top = 0, n = 0;
  const pousser = (p) => { if (!vu[p] && dist(d, p * 4, fond) <= tol) { vu[p] = 1; pile[top++] = p; } };
  for (let x = 0; x < w; x++) { pousser(x); pousser((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { pousser(y * w); pousser(y * w + w - 1); }
  while (top) {
    const p = pile[--top], i = p * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; n++;
    const x = p % w, y = (p - x) / w;
    if (x > 0) pousser(p - 1); if (x < w - 1) pousser(p + 1); if (y > 0) pousser(p - w); if (y < h - 1) pousser(p + w);
  }
  return n;
}

// LE GESTE, sur des pixels : { image: {data,width,height}, fait: { lumiere, fond, recadrage } } ; `img` n'est pas modifiée.
// fait.* : true (appliqué) · false (pas demandé) · 'deja' (lumière déjà juste) · 'pas-uni' (fond) · 'sujet' (recadrage).
export function ameliorerPixels(img, reglages = REGLAGES_DEFAUT) {
  const R = { ...REGLAGES_DEFAUT, ...(reglages || {}) };
  const A = analyser(img);
  let data = new Uint8ClampedArray(img.data);
  let cur = { data, width: img.width, height: img.height };
  const fait = { lumiere: false, fond: false, recadrage: false };
  // 1. Le fond d'abord (sur la couleur LUE du bord, avant tout étirement), puis la boîte du sujet sur la même couleur.
  const boite = R.recadrage ? boiteSujet(cur, A.fond) : null;
  if (R.fond) { if (A.uni) { blanchirFond(cur, A.fond); fait.fond = true; } else fait.fond = 'pas-uni'; }
  // 2. La lumière.
  if (R.lumiere) {
    const N = niveaux(A);
    if (!N) fait.lumiere = 'deja';
    else {
      const t = new Uint8ClampedArray(256); for (let v = 0; v < 256; v++) t[v] = (v - N.bas) * N.gain;
      for (let i = 0; i < data.length; i += 4) { if (fait.fond === true && data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) continue; data[i] = t[data[i]]; data[i + 1] = t[data[i + 1]]; data[i + 2] = t[data[i + 2]]; }
      fait.lumiere = true;
    }
  }
  // 3. Le recadrage (en dernier : il ne fait que couper).
  if (R.recadrage) {
    if (!boite) fait.recadrage = 'sujet';
    else {
      const out = new Uint8ClampedArray(boite.w * boite.h * 4);
      for (let y = 0; y < boite.h; y++) out.set(data.subarray(((boite.y + y) * img.width + boite.x) * 4, ((boite.y + y) * img.width + boite.x + boite.w) * 4), y * boite.w * 4);
      cur = { data: out, width: boite.w, height: boite.h }; fait.recadrage = true;
    }
  }
  return { image: cur, fait, analyse: A };
}

// ── Le navigateur : une photo (data URL) ⇒ { ok, img, fait } | { ok: false, raison } ──
export async function ameliorerDataUrl(src, reglages = REGLAGES_DEFAUT, { largeur = 900, qualite = 0.86 } = {}) {
  try {
    const im = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image illisible')); i.src = src; });
    const w0 = im.naturalWidth, h0 = im.naturalHeight; if (!w0 || !h0) return { ok: false, raison: 'image vide' };
    const k = Math.min(1, largeur / w0), w = Math.round(w0 * k), h = Math.round(h0 * k);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0, w, h);
    const r = ameliorerPixels(cx.getImageData(0, 0, w, h), reglages);
    const out = document.createElement('canvas'); out.width = r.image.width; out.height = r.image.height;
    out.getContext('2d').putImageData(new ImageData(r.image.data, r.image.width, r.image.height), 0, 0);
    return { ok: true, img: out.toDataURL('image/jpeg', qualite), fait: r.fait };
  } catch (e) { return { ok: false, raison: (e && e.message) || 'navigateur' }; }
}
