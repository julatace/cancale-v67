// ══════════════════════════════════════════════════════════════════════════
// LA DEUXIÈME MESURE DE « LA MÊME PHOTO » (15 nov., lot meme-photo-sure).
//
// Julien : « Est-ce que tu peux faire la reconnaissance d'image et que ça soit
// parfaitement fiable ? »
//
// • On reconnaît la MÊME PHOTO (le même fichier, recompressé, réduit, recadré de
//   quelques px, bordé de bandes, éclairci par un autre site) — JAMAIS « la même
//   chaussure sur une autre photo » : avec 50 paires identiques, c'est impossible à
//   rendre sûr, et ce n'est pas construit.
// • La première mesure (src/photoEmpreinte.js : dHash + pHash 64 bits, image réduite
//   à 64 × 64) trouve les CANDIDATS. MESURÉ le 15 nov. (banc meme-photo-fiabilite) :
//   elle ne suffit pas seule — 50 exemplaires du même modèle photographiés AU MÊME
//   ENDROIT (même fond, même lumière, posés à ± 15 px / ± 2° près) tombent à une
//   distance de 0 à 12 entre eux : une empreinte de 64 bits ne voit pas l'usure.
// • Cette deuxième mesure est d'une AUTRE NATURE : une CORRÉLATION des niveaux de gris
//   pixel à pixel, sur une grille FINE (`COTE_FINE` × `COTE_FINE`), après avoir retiré
//   les bandes unies du bord et RECALÉ les deux images (échelle et décalage cherchés,
//   d'abord sur 32 × 32 puis affinés). La même photo se recale exactement (≥ seuil) ;
//   une autre prise de vue, même du même modèle au même endroit, laisse des plis, une
//   pose, une ombre qui ne se superposent pas (sous le seuil).
// • Calculée SANS IA (§2.9), localement, par l'extension (les photos de vinted.net ne
//   sont pas lisibles par la page : mesuré, aucun en-tête CORS) — seulement pour les
//   couples CANDIDATS (`couplesAVerifier`) ; rien n'est gardé de l'image : un score.
// • ⚠️ §5 : même « sûre », une photo PROPOSE ; c'est TOUJOURS son toucher qui relie.
// Le bloc <photo-fine-regle> est recopié dans background.js par
// `node scripts/audit-meme-photo.cjs --recopie` — ne jamais le modifier là-bas.
// ══════════════════════════════════════════════════════════════════════════
import { distanceEmpreintes } from './photoEmpreinte.js';

// <photo-fine-regle>
// La version de la mesure : un score d'une autre version n'est pas relu (recalculé).
export const VERSION_FINE = 1;
// L'image est lue à `LECTURE_FINE` px au plus (proportions gardées), puis le contenu (bandes
// unies retirées) est ramené à `COTE_FINE` × `COTE_FINE` niveaux de gris centrés-réduits.
export const LECTURE_FINE = 512;
export const COTE_FINE = 128;
// L'écart par case se mesure sur une grille plus fine encore (256 × 256) : les plis, l'usure,
// le grain d'un AUTRE exemplaire ne se voient qu'à cette échelle.
export const COTE_DETAIL = 256;
const GROSSIER = 32;
// Un contenu plus petit que `COTE_FINE_MIN` px (vignette) ne se vérifie pas finement : « pas su ».
export const COTE_FINE_MIN = 96;
// La mesure fine rend DEUX nombres (`comparerFine` ⇒ { s, r }) :
//   s = 1 − l'écart moyen des 10 % de cases les plus mal superposées (grille 256, flou égalisé) ;
//   r = la corrélation de toute l'image une fois recalée (grille 128).
// Les seuils — MESURÉS (banc meme-photo-fiabilite, 15 nov.), pas devinés :
//   « sûr »  : s ≥ SEUIL_FINE_SUR ET r ≥ SEUIL_CORREL_SUR (les deux, nettement) ;
//   « non »  : s < SEUIL_FINE_NON — pas la même photo, le candidat est écarté ;
//   entre    : « à vérifier » (montré, jamais compté sûr).
// MESURÉ : 2 × 50 exemplaires du même modèle photographiés au même endroit ⇒ s ≤ 0,79, r ≤ 0,9963 ;
// la même photo recompressée (JPEG 50–90, WebP 60–80) ⇒ s ≥ 0,87, r ≥ 0,999.
export const SEUIL_FINE_SUR = 0.85;
export const SEUIL_CORREL_SUR = 0.998;
export const SEUIL_FINE_NON = 0.35;
// La première mesure doit, elle aussi, être NETTE pour « sûr » (≤ `SEUIL_EMPREINTE_SUR` ;
// au-dessus et jusqu'au seuil de proposition : « à vérifier »).
export const SEUIL_EMPREINTE_SUR = 10;

function grisFin(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}
// Les bandes UNIES du bord (ajoutées par un site pour mettre la photo au carré, ou un fond
// uni) : une ligne / colonne dont l'écart est ≤ 8 niveaux et de la même teinte que la
// première. Au plus 40 % de chaque côté.
function boiteContenu(g, w, h) {
  const T = 8;
  const ligne = (y, x0, x1) => { let mn = 1e9, mx = -1e9, s = 0; for (let x = x0; x < x1; x++) { const v = g[y * w + x]; if (v < mn) mn = v; if (v > mx) mx = v; s += v; } return [mx - mn, s / Math.max(1, x1 - x0)]; };
  const col = (x, y0, y1) => { let mn = 1e9, mx = -1e9, s = 0; for (let y = y0; y < y1; y++) { const v = g[y * w + x]; if (v < mn) mn = v; if (v > mx) mx = v; s += v; } return [mx - mn, s / Math.max(1, y1 - y0)]; };
  let t = 0, b = h, l = 0, r = w;
  let p = ligne(0, 0, w); if (p[0] <= T) { const m = p[1]; while (t < h * 0.4) { p = ligne(t, 0, w); if (p[0] > T || Math.abs(p[1] - m) > T) break; t++; } }
  p = ligne(h - 1, 0, w); if (p[0] <= T) { const m = p[1]; while (b > h * 0.6) { p = ligne(b - 1, 0, w); if (p[0] > T || Math.abs(p[1] - m) > T) break; b--; } }
  p = col(0, t, b); if (p[0] <= T) { const m = p[1]; while (l < w * 0.4) { p = col(l, t, b); if (p[0] > T || Math.abs(p[1] - m) > T) break; l++; } }
  p = col(w - 1, t, b); if (p[0] <= T) { const m = p[1]; while (r > w * 0.6) { p = col(r - 1, t, b); if (p[0] > T || Math.abs(p[1] - m) > T) break; r--; } }
  return [l, t, r, b];
}
// La zone [x0, x1) × [y0, y1) ramenée à N × N par moyenne de surface, centrée-réduite.
function grilleFine(g, w, h, x0, y0, x1, y1, N) {
  const out = new Float32Array(N * N), lw = x1 - x0, lh = y1 - y0;
  for (let j = 0; j < N; j++) {
    const ya = y0 + (j * lh) / N, yb = y0 + ((j + 1) * lh) / N;
    for (let i = 0; i < N; i++) {
      const xa = x0 + (i * lw) / N, xb = x0 + ((i + 1) * lw) / N;
      let s = 0, a = 0;
      for (let y = Math.floor(ya); y < Math.min(h, Math.ceil(yb)); y++) {
        const fy = Math.min(y + 1, yb) - Math.max(y, ya); if (fy <= 0) continue;
        for (let x = Math.floor(xa); x < Math.min(w, Math.ceil(xb)); x++) {
          const fx = Math.min(x + 1, xb) - Math.max(x, xa); if (fx <= 0) continue;
          s += fx * fy * g[y * w + x]; a += fx * fy;
        }
      }
      out[j * N + i] = a > 0 ? s / a : 0;
    }
  }
  let m = 0; for (let i = 0; i < out.length; i++) m += out[i]; m /= out.length;
  let v = 0; for (let i = 0; i < out.length; i++) v += (out[i] - m) * (out[i] - m); v = Math.sqrt(v / out.length);
  if (!(v > 1.5)) return null;                         // contenu uni : rien à comparer
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - m) / v;
  return out;
}
// La taille à laquelle dessiner l'image avant `preparerFine` (proportions gardées).
export function tailleLectureFine(w, h) {
  const k = Math.min(1, LECTURE_FINE / Math.max(1, w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
// `rgba` : les octets de l'image dessinée à `tailleLectureFine`. Rend { v: [variante…], cote } ou
// null (image uniforme, ou contenu trop petit pour une vérification fine : « pas su »).
// Une variante = { f, m, p } : la grille fine 128 × 128, 32 × 32 et 16 × 16 (le recalage grossier).
// Deux variantes : l'image entière, et l'image SANS ses bandes unies (quand il y en a) — un site
// qui ajoute des bandes, ou un fond blanc écrêté par l'éclaircissement, ne déplace pas le contenu
// de la même façon : la comparaison prend la meilleure des combinaisons.
export function preparerFine(rgba, w, h) {
  w = Math.floor(Number(w)); h = Math.floor(Number(h));
  if (!rgba || !(w > 0) || !(h > 0) || rgba.length < w * h * 4) return null;
  const g = grisFin(rgba, w, h);
  const [l, t, r, b] = boiteContenu(g, w, h);
  const cote = Math.min(r - l, b - t);
  if (cote < COTE_FINE_MIN) return null;
  const variante = (x0, y0, x1, y1) => { const f = grilleFine(g, w, h, x0, y0, x1, y1, COTE_FINE), m = grilleFine(g, w, h, x0, y0, x1, y1, GROSSIER), p = grilleFine(g, w, h, x0, y0, x1, y1, 16), d = grilleFine(g, w, h, x0, y0, x1, y1, COTE_DETAIL); return f && m && p && d ? { f, m, p, d } : null; };
  const v = [variante(0, 0, w, h)];
  if (l > 0 || t > 0 || r < w || b < h) v.push(variante(l, t, r, b));
  const ok = v.filter(Boolean);
  return ok.length ? { v: ok, cote } : null;
}
// B lu en (c + (x − c)·sx + dx, c + (y − c)·sy + dy), bilinéaire ; NaN hors de l'image.
function lireDeforme(B, N, sx, sy, dx, dy) {
  const c = (N - 1) / 2, out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    const fy = c + (y - c) * sy + dy;
    for (let x = 0; x < N; x++) {
      const fx = c + (x - c) * sx + dx;
      if (fy < 0 || fy > N - 1 || fx < 0 || fx > N - 1) { out[y * N + x] = NaN; continue; }
      const y0 = Math.floor(fy), y1 = y0 + 1 < N ? y0 + 1 : y0, ay = fy - y0, x0 = Math.floor(fx), x1 = x0 + 1 < N ? x0 + 1 : x0, ax = fx - x0;
      out[y * N + x] = (1 - ay) * ((1 - ax) * B[y0 * N + x0] + ax * B[y0 * N + x1]) + ay * ((1 - ax) * B[y1 * N + x0] + ax * B[y1 * N + x1]);
    }
  }
  return out;
}
// Corrélation de A et de B lu déformé, sur la zone commune (au moins 60 % de l'image ; sinon −1).
function correlation(A, B, N, sx, sy, dx, dy) {
  const c = (N - 1) / 2;
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let y = 0; y < N; y++) {
    const fy = c + (y - c) * sy + dy; if (fy < 0 || fy > N - 1) continue;
    const y0 = Math.floor(fy), y1 = y0 + 1 < N ? y0 + 1 : y0, ay = fy - y0;
    for (let x = 0; x < N; x++) {
      const fx = c + (x - c) * sx + dx; if (fx < 0 || fx > N - 1) continue;
      const x0 = Math.floor(fx), x1 = x0 + 1 < N ? x0 + 1 : x0, ax = fx - x0;
      const b = (1 - ay) * ((1 - ax) * B[y0 * N + x0] + ax * B[y0 * N + x1]) + ay * ((1 - ax) * B[y1 * N + x0] + ax * B[y1 * N + x1]);
      const a = A[y * N + x];
      n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
    }
  }
  if (n < N * N * 0.6) return -1;
  const cov = sab - (sa * sb) / n, va = saa - (sa * sa) / n, vb = sbb - (sb * sb) / n;
  return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : 0;
}
// L'ÉCART PAR CASE une fois recalées : la grille fine coupée en 8 × 8 cases ; dans chaque case,
// l'écart quadratique moyen des deux images centrées-réduites (sur la zone commune). La même
// photo se superpose PARTOUT (chaque case petite) ; une autre prise de vue, même identique de
// loin (même fond, même lumière), laisse des cases où la paire, ses plis, son ombre ne tombent
// pas au même endroit. Rend les écarts des cases, du plus grand au plus petit.
const CASES = 8;
function ecartsCases(A, B, N, sx, sy, dx, dy, CASES = 8) {
  const Bd = lireDeforme(B, N, sx, sy, dx, dy);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0;
  for (let i = 0; i < N * N; i++) { const b = Bd[i]; if (b !== b) continue; const a = A[i]; n++; sa += a; sb += b; saa += a * a; sbb += b * b; }
  if (n < N * N * 0.6) return null;
  const ma = sa / n, mb = sb / n, ea = Math.sqrt(Math.max(1e-9, saa / n - ma * ma)), eb = Math.sqrt(Math.max(1e-9, sbb / n - mb * mb));
  const t = N / CASES, out = [];
  for (let cy = 0; cy < CASES; cy++) for (let cx = 0; cx < CASES; cx++) {
    let s = 0, k = 0;
    for (let y = cy * t; y < (cy + 1) * t; y++) for (let x = cx * t; x < (cx + 1) * t; x++) { const b = Bd[y * N + x]; if (b !== b) continue; const d = (A[y * N + x] - ma) / ea - (b - mb) / eb; s += d * d; k++; }
    if (k >= t * t * 0.5) out.push(Math.sqrt(s / k));
  }
  return out.length >= CASES * CASES * 0.5 ? out.sort((x, y) => y - x) : null;
}
// Le recalage : sur 16 × 16, toutes les échelles 0,96…1,04 par axe et tous les décalages ± 2, pour
// chaque combinaison de variantes ; puis affiné sur 32 × 32 (± 1 % d'échelle, ± 1 px) ; puis sur la
// grille fine (décalage ± 1 px, puis échelle ± 0,5 %).
const ECHELLES = [0.96, 0.98, 1, 1.02, 1.04];
export function mesureFine(pa, pb) {
  const N = COTE_FINE, ok = (x) => x && Array.isArray(x.v) && x.v.length && x.v.every((q) => q && q.f && q.f.length === N * N && q.m && q.m.length === GROSSIER * GROSSIER && q.p && q.p.length === 256 && q.d && q.d.length === COTE_DETAIL * COTE_DETAIL);
  if (!ok(pa) || !ok(pb)) return null;
  let b = { r: -2, A: null, B: null, sx: 1, sy: 1, dx: 0, dy: 0 };
  for (const A of pa.v) for (const B of pb.v) for (const sx of ECHELLES) for (const sy of ECHELLES) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const r = correlation(A.p, B.p, 16, sx, sy, dx, dy);
    if (r > b.r) b = { r, A, B, sx, sy, dx, dy };
  }
  const { A, B } = b;
  let m = { r: -2, sx: b.sx, sy: b.sy, dx: b.dx * 2, dy: b.dy * 2 };
  const m0 = { ...m };
  for (const ex of [-0.01, 0, 0.01]) for (const ey of [-0.01, 0, 0.01]) for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) {
    const r = correlation(A.m, B.m, GROSSIER, m0.sx + ex, m0.sy + ey, m0.dx + i, m0.dy + j);
    if (r > m.r) m = { r, sx: m0.sx + ex, sy: m0.sy + ey, dx: m0.dx + i, dy: m0.dy + j };
  }
  const k = N / GROSSIER;
  let fin = { r: -2, sx: m.sx, sy: m.sy, dx: m.dx * k, dy: m.dy * k };
  const f0 = { ...fin };
  for (const i of [-1, 0, 1]) for (const j of [-1, 0, 1]) { const r = correlation(A.f, B.f, N, f0.sx, f0.sy, f0.dx + i, f0.dy + j); if (r > fin.r) fin = { r, sx: f0.sx, sy: f0.sy, dx: f0.dx + i, dy: f0.dy + j }; }
  const f1 = { ...fin };
  for (const ex of [-0.005, 0, 0.005]) for (const ey of [-0.005, 0, 0.005]) { const r = correlation(A.f, B.f, N, f1.sx + ex, f1.sy + ey, f1.dx, f1.dy); if (r > fin.r) fin = { r, sx: f1.sx + ex, sy: f1.sy + ey, dx: f1.dx, dy: f1.dy }; }
  // Affinage sous le pixel (½ px puis ¼ px, ¼ % d'échelle) : une copie se superpose EXACTEMENT.
  for (const [pd, pe] of [[0.5, 0.0025], [0.25, 0.00125]]) {
    let f2 = { ...fin };
    for (const i of [-pd, 0, pd]) for (const j of [-pd, 0, pd]) { const r = correlation(A.f, B.f, N, f2.sx, f2.sy, f2.dx + i, f2.dy + j); if (r > fin.r) fin = { r, sx: f2.sx, sy: f2.sy, dx: f2.dx + i, dy: f2.dy + j }; }
    f2 = { ...fin };
    for (const ex of [-pe, 0, pe]) for (const ey of [-pe, 0, pe]) { const r = correlation(A.f, B.f, N, f2.sx + ex, f2.sy + ey, f2.dx, f2.dy); if (r > fin.r) fin = { r, sx: f2.sx + ex, sy: f2.sy + ey, dx: f2.dx, dy: f2.dy }; }
  }
  // Sur la grille de DÉTAIL (256) : recalage affiné encore (¼ px), puis le flou ÉGALISÉ — une copie
  // réduite ou recompressée est plus floue que l'original : on floute l'image la plus nette de
  // 0 à 1,5 px et on garde l'écart le plus petit (une autre prise de vue ne s'efface pas en floutant).
  const D = COTE_DETAIL, kd = D / N;
  let g = { r: correlation(A.d, B.d, D, fin.sx, fin.sy, fin.dx * kd, fin.dy * kd), sx: fin.sx, sy: fin.sy, dx: fin.dx * kd, dy: fin.dy * kd };
  for (const pd of [0.5, 0.25]) {
    const g0 = { ...g };
    for (const i of [-pd, 0, pd]) for (const j of [-pd, 0, pd]) { if (!i && !j) continue; const r = correlation(A.d, B.d, D, g0.sx, g0.sy, g0.dx + i, g0.dy + j); if (r > g.r) g = { r, sx: g0.sx, sy: g0.sy, dx: g0.dx + i, dy: g0.dy + j }; }
  }
  const Bd = lireDeforme(B.d, D, g.sx, g.sy, g.dx, g.dy);
  let meilleur = null;
  for (const [fa, fb] of [[0, 0], [0.8, 0], [1.5, 0], [0, 0.8], [0, 1.5]]) {
    const e = ecartsGrilles(fa ? flou(A.d, D, fa) : A.d, fb ? flou(Bd, D, fb) : Bd, D);
    if (e && (!meilleur || e.global < meilleur.global)) meilleur = e;
  }
  if (!meilleur) return null;
  const moy = (l) => { const p = l.slice(0, Math.max(1, Math.round(l.length / 10))); return p.reduce((t, x) => t + x, 0) / p.length; };
  return { r: fin.r, pire: moy(meilleur.c8), max: meilleur.c8[0], med: moy(meilleur.c16) };
}
// Flou gaussien séparable (σ en px de la grille), NaN (hors de l'image) préservé.
function flou(Z, N, sigma) {
  const r = Math.ceil(sigma * 2.5), w = []; let t = 0;
  for (let i = -r; i <= r; i++) { const v = Math.exp(-(i * i) / (2 * sigma * sigma)); w.push(v); t += v; }
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const z0 = Z[y * N + x]; if (z0 !== z0) { tmp[y * N + x] = NaN; continue; } let s = 0, a = 0; for (let i = -r; i <= r; i++) { const xx = x + i; if (xx < 0 || xx >= N) continue; const z = Z[y * N + xx]; if (z !== z) continue; s += w[i + r] * z; a += w[i + r]; } tmp[y * N + x] = s / a; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const z0 = tmp[y * N + x]; if (z0 !== z0) { out[y * N + x] = NaN; continue; } let s = 0, a = 0; for (let i = -r; i <= r; i++) { const yy = y + i; if (yy < 0 || yy >= N) continue; const z = tmp[yy * N + x]; if (z !== z) continue; s += w[i + r] * z; a += w[i + r]; } out[y * N + x] = s / a; }
  return out;
}
// Les écarts de deux grilles déjà superposées (NaN = hors de l'image) : global, cases 8 × 8 et 16 × 16.
function ecartsGrilles(A, Bd, N) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0;
  for (let i = 0; i < N * N; i++) { const b = Bd[i], a = A[i]; if (b !== b || a !== a) continue; n++; sa += a; sb += b; saa += a * a; sbb += b * b; }
  if (n < N * N * 0.6) return null;
  const ma = sa / n, mb = sb / n, ea = Math.sqrt(Math.max(1e-9, saa / n - ma * ma)), eb = Math.sqrt(Math.max(1e-9, sbb / n - mb * mb));
  const cases = (C) => {
    const t = N / C, out = [];
    for (let cy = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++) {
      let s = 0, k = 0;
      for (let y = cy * t; y < (cy + 1) * t; y++) for (let x = cx * t; x < (cx + 1) * t; x++) { const b = Bd[y * N + x], a = A[y * N + x]; if (b !== b || a !== a) continue; const d = (a - ma) / ea - (b - mb) / eb; s += d * d; k++; }
      if (k >= t * t * 0.5) out.push(Math.sqrt(s / k));
    }
    return out.length >= C * C * 0.5 ? out.sort((x, y) => y - x) : null;
  };
  const c8 = cases(8), c16 = cases(16);
  if (!c8 || !c16) return null;
  let s = 0; for (const x of c16) s += x * x;
  return { global: Math.sqrt(s / c16.length), c8, c16 };
}
// La mesure rangée : { s, r } (4 décimales). s = 1 − l'écart moyen des 10 % de cases les PLUS mal
// superposées (la même photo : près de 1 partout ; une autre prise de vue : ses pires cases la
// trahissent) ; r = la corrélation globale. null : pas mesurable (« pas su »).
export function comparerFine(pa, pb) {
  const x = mesureFine(pa, pb);
  const q = (v) => Math.round(v * 10000) / 10000;
  return x ? { s: q(Math.max(0, 1 - x.pire)), r: q(x.r) } : null;
}
// Une mesure rangée valide : { s, r } numériques. Rend la mesure ou null.
export function mesureValide(m) {
  return m && typeof m === 'object' && typeof m.s === 'number' && Number.isFinite(m.s) && typeof m.r === 'number' && Number.isFinite(m.r) ? { s: m.s, r: m.r } : null;
}
// Le verdict d'une mesure { s, r } : 'sur' · 'non' · 'doute' ; null (pas mesurée) ⇒ null.
export function verdictFin(mesure) {
  const m = mesureValide(mesure);
  if (!m) return null;
  if (m.s < SEUIL_FINE_NON) return 'non';
  if (m.s >= SEUIL_FINE_SUR && m.r >= SEUIL_CORREL_SUR) return 'sur';
  return 'doute';
}
// La clé d'un couple vérifié : la photo de l'autre site × la photo Vinted (clés de photo,
// sans signature). `site` : 'lbc' · 'vc' · 'ebay'.
export const cleCoupleFin = (site, idSite, kSite, uid, idVinted, kVinted) => `${site}|${idSite}|${kSite}#${uid}|${idVinted}|${kVinted}`;
// Les couples à vérifier finement : chaque photo d'un autre site × chaque photo Vinted à une
// distance d'empreinte ≤ `seuil` (le seuil de proposition). Une photo d'ailleurs proche de plus
// de `parPhoto` annonces Vinted est un logo / un fond : ignorée. Les plus proches d'abord, `max` au plus.
// `vinted` : { [uid]: { [idAnnonce]: { [clePhoto]: hex } } } ; `sites` : { lbc|vc|ebay: { [id]: { [clé]: hex } } }.
export function couplesAVerifier({ vinted = {}, sites = {}, seuil = 12, parPhoto = 8, max = 60 } = {}) {
  const pv = [];
  for (const [uid, parId] of Object.entries(vinted || {})) for (const [id, ph] of Object.entries(parId || {})) for (const [k, h] of Object.entries(ph || {})) pv.push({ uid, id, k, h });
  const out = [];
  for (const [site, parId] of Object.entries(sites || {})) for (const [sid, ph] of Object.entries(parId || {})) for (const [sk, sh] of Object.entries(ph || {})) {
    const proches = [];
    for (const v of pv) { const d = distanceEmpreintes(sh, v.h); if (d != null && d <= seuil) proches.push({ v, d }); }
    if (!proches.length || new Set(proches.map((x) => `${x.v.uid}|${x.v.id}`)).size > parPhoto) continue;
    for (const { v, d } of proches) out.push({ cle: cleCoupleFin(site, sid, sk, v.uid, v.id, v.k), site, sid, sk, uid: v.uid, vid: v.id, vk: v.k, d });
  }
  out.sort((a, b) => a.d - b.d || (a.cle < b.cle ? -1 : 1));
  return out.slice(0, max);
}
// </photo-fine-regle>
