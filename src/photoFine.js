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
const GROSSIER = 32;
// Un contenu plus petit que `COTE_FINE_MIN` px (vignette) ne se vérifie pas finement : « pas su ».
export const COTE_FINE_MIN = 96;
// Les seuils — MESURÉS (banc meme-photo-fiabilite, 15 nov.), pas devinés :
//   score ≥ SEUIL_FINE_SUR  ⇒ la même photo (les deux mesures concordent nettement) ;
//   score < SEUIL_FINE_NON  ⇒ pas la même photo (le candidat est écarté) ;
//   entre les deux          ⇒ « à vérifier » (montré, jamais compté sûr).
export const SEUIL_FINE_SUR = 0.97;
export const SEUIL_FINE_NON = 0.80;
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
// `rgba` : les octets de l'image dessinée à `tailleLectureFine`. Rend { g, f, cote } ou null
// (image uniforme, ou contenu trop petit pour une vérification fine : « pas su »).
export function preparerFine(rgba, w, h) {
  w = Math.floor(Number(w)); h = Math.floor(Number(h));
  if (!rgba || !(w > 0) || !(h > 0) || rgba.length < w * h * 4) return null;
  const g = grisFin(rgba, w, h);
  const [l, t, r, b] = boiteContenu(g, w, h);
  const cote = Math.min(r - l, b - t);
  if (cote < COTE_FINE_MIN) return null;
  const f = grilleFine(g, w, h, l, t, r, b, COTE_FINE), c = grilleFine(g, w, h, l, t, r, b, GROSSIER);
  return f && c ? { f, g: c, cote } : null;
}
// Corrélation de A (N × N) et de B lu en (c + (x − c)·sx + dx, c + (y − c)·sy + dy),
// bilinéaire, sur la zone commune (au moins 60 % de l'image ; sinon −1).
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
// Le score (−1…1) de deux photos préparées : la meilleure corrélation fine après recalage.
// Recalage cherché sur 32 × 32 (échelle 0,96…1,04 par axe, décalage ± 2), puis affiné sur la
// grille fine autour du meilleur (± 1 % d'échelle, ± ½ pas). null si l'une n'est pas préparée.
const ECHELLES = [0.96, 0.98, 1, 1.02, 1.04];
export function comparerFine(pa, pb) {
  if (!pa || !pb || !pa.f || !pb.f || pa.f.length !== COTE_FINE * COTE_FINE || pb.f.length !== COTE_FINE * COTE_FINE) return null;
  let best = { r: -2, sx: 1, sy: 1, dx: 0, dy: 0 };
  for (const sx of ECHELLES) for (const sy of ECHELLES) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const r = correlation(pa.g, pb.g, GROSSIER, sx, sy, dx, dy);
    if (r > best.r) best = { r, sx, sy, dx, dy };
  }
  const k = COTE_FINE / GROSSIER;
  let fin = -2;
  for (const ex of [-0.01, 0, 0.01]) for (const ey of [-0.01, 0, 0.01]) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const r = correlation(pa.f, pb.f, COTE_FINE, best.sx + ex, best.sy + ey, best.dx * k + (i * k) / 2, best.dy * k + (j * k) / 2);
    if (r > fin) fin = r;
  }
  return Math.round(fin * 10000) / 10000;
}
// Le verdict d'un score : 'sur' · 'non' · 'doute' ; null (pas mesuré) ⇒ null.
export function verdictFin(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= SEUIL_FINE_SUR) return 'sur';
  if (score < SEUIL_FINE_NON) return 'non';
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
