// ── Des « photos » de paires INVENTÉES, dessinées pixel par pixel (14 nov.) ───────
// Pour les audits de la qualité (102) et de la couleur (104) : aucune photo réelle
// (dépôt public). Une basket faite de formes (tige, col, semelle, bande, lacets,
// coutures) sur un fond mur + sol, un léger grain de capteur ; puis les défauts qu'on
// veut mesurer : flou (gaussien, rayon au choix), sous-exposition, fond uni.
'use strict';
const rnd = (s) => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// m = { W, H, fond: [mur, sol], tige, col, semelle, bande, lacets, grain, graine, uni }
function dessiner(m) {
  const W = m.W || 384, H = m.H || 512;
  const px = new Uint8ClampedArray(W * H * 4);
  const r = rnd(m.graine || 7);
  const mur = hex(m.fond ? m.fond[0] : '#eeeae4'), sol = hex(m.fond ? m.fond[1] : '#d9d2c7');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = m.uni || y < H * 0.58 ? mur : sol, i = (y * W + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  const poser = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; };
  const ellipse = (cx, cy, rx, ry, c, yMax = H) => { for (let y = Math.floor(cy - ry); y <= cy + ry && y < yMax; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) poser(x, y, c); };
  const rect = (x0, y0, x1, y1, c) => { for (let y = Math.round(y0); y < y1; y++) for (let x = Math.round(x0); x < x1; x++) poser(x, y, c); };
  const ech = m.echelle || 1, ox = W * (1 - ech) / 2, oy = H * (1 - ech) / 2;
  const X = (v) => ox + v * W * ech, Y = (v) => oy + v * H * ech, RX = (v) => v * W * ech, RY = (v) => v * H * ech;
  ellipse(X(0.48), Y(0.53), RX(0.36), RY(0.12), hex(m.tige || '#1d4ed8'), Y(0.64));
  ellipse(X(0.25), Y(0.46), RX(0.1), RY(0.09), hex(m.col || m.tige || '#1d4ed8'));
  rect(X(0.1), Y(0.62), X(0.9), Y(0.68), hex(m.semelle || '#f4f4f2'));
  for (let t = 0; t <= 1; t += 0.01) ellipse(X(0.28 + 0.42 * t), Y(0.6 - 0.1 * t + 0.04 * t * (1 - t)), RX(0.022), RX(0.022), hex(m.bande || '#f4f4f2'));
  for (let j = 0; j < 5; j++) rect(X(0.5 + j * 0.05), Y(0.43 + j * 0.006), X(0.53 + j * 0.05), Y(0.455 + j * 0.006), hex(m.lacets || '#f4f4f2'));
  // Coutures (le détail fin d'une vraie photo nette).
  const cout = hex(m.couture || '#9ca3af');
  for (let x = X(0.16); x < X(0.86); x += 6 * ech) rect(x, Y(0.615), x + 3 * ech, Y(0.615) + 1.5, cout);
  // Grain du capteur.
  const g = m.grain == null ? 4 : m.grain;
  if (g) for (let i = 0; i < W * H * 4; i += 4) { const n = (r() - 0.5) * 2 * g; px[i] += n; px[i + 1] += n; px[i + 2] += n; }
  return { px, w: W, h: H };
}

// Flou gaussien approché (trois passes de flou-boîte séparable de rayon ~ sigma).
function flouter(img, sigma) {
  if (!(sigma > 0)) return img;
  const { w, h } = img; let a = new Float32Array(img.px), b = new Float32Array(a.length);
  const rr = Math.max(1, Math.round(Math.sqrt(12 * sigma * sigma / 3 + 1) / 2));
  const passe = (src, dst, dx) => {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
      let s = 0, n = 0;
      for (let k = -rr; k <= rr; k++) { const xx = dx ? x + k : x, yy = dx ? y : y + k; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; s += src[(yy * w + xx) * 4 + c]; n++; }
      dst[(y * w + x) * 4 + c] = s / n;
    }
    for (let i = 3; i < dst.length; i += 4) dst[i] = 255;
  };
  for (let p = 0; p < 3; p++) { passe(a, b, true); passe(b, a, false); }
  return { px: new Uint8ClampedArray(a), w, h };
}
// Sous-exposition : la lumière multipliée par k (0,15 = une photo prise sans lumière).
function assombrir(img, k) { const px = new Uint8ClampedArray(img.px); for (let i = 0; i < px.length; i += 4) { px[i] *= k; px[i + 1] *= k; px[i + 2] *= k; } return { ...img, px }; }

module.exports = { dessiner, flouter, assombrir, hex };
