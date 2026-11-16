// ── UN MEUBLE EN ISOMÉTRIQUE (« La pièce » → Isométrique, 15 nov.) ─────────────
// Module PUR : rend les polygones d'un meuble vu en isométrique douce (porcelaine), cartons avec leur profondeur —
// le dessin des maquettes v4 (`v3-iso.cjs`, `dessiner`), sans plaques (une miniature). Aucune donnée inventée :
// `grille` = les cases RÉELLES du meuble ([rangée du haut … du bas][colonne] ⇒ { n, etat } | null).
//   etat : 'sortir' (vendue, à sortir : liseré ambre) · 'double' · '' ; teinte : nom de teinte (src/etageres/reglages.js).
const C = Math.cos(Math.PI / 6), S = 0.5;
export const PAL = {
  jour: { top: '#FBFDFF', front: '#E4ECF4', right: '#C7D3DF', back1: '#93A9C0', back2: '#B9C9D9', inner: '#D3DEE9', ombre: 'rgba(4,14,30,.35)' },
  nuit: { top: '#3A5274', front: '#263B57', right: '#1B2C44', back1: '#0A1424', back2: '#14243B', inner: '#1E3150', ombre: 'rgba(0,0,0,.6)' },
};
export const TONS = {
  kraft: { top: '#EFE2C8', front: '#DCC6A1', right: '#C2A77D' },
  blanc: { top: '#FFFFFF', front: '#ECF0F4', right: '#CFD8E1' },
  ardoise: { top: '#B8C7D6', front: '#98ABBF', right: '#7D91A6' },
  sable: { top: '#F6EBD3', front: '#E6D3A8', right: '#CDB585' },
  sauge: { top: '#D9E5D3', front: '#B4C9AC', right: '#9BB491' },
  ciel: { top: '#E2EEF8', front: '#B7D3EA', right: '#9BBEDC' },
  lagon: { top: '#D5ECEA', front: '#9FCFCB', right: '#86B9B5' },
};

export function dessinerIso({ cols, rows, grille, u = 20, nuit = false, bh = 0.56, teinteDe = () => 'kraft' } = {}) {
  const n = Math.max(1, cols | 0), R = Math.max(1, rows | 0);
  const t = 0.07, bt = 0.06, D = 1.15, hc = 0.78, pt = 0.07;
  const W = n + 2 * t, H = R * hc + (R + 1) * pt;
  const pal = PAL[nuit ? 'nuit' : 'jour'];
  const ox = 8 + D * C * u, oy = 8 + H * u;
  const P = (x, y, z) => [ox + (x - y) * C * u, oy + (x + y) * S * u - z * u];
  const polys = [];
  const poly = (pts, fill, extra = {}) => polys.push({ pts: pts.map(([x, y]) => x.toFixed(1) + ',' + y.toFixed(1)).join(' '), fill, ...extra });
  const top = (x0, x1, y0, y1, z) => [P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)];
  const front = (x0, x1, y, z0, z1) => [P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)];
  const right = (x, y0, y1, z0, z1) => [P(x, y0, z0), P(x, y1, z0), P(x, y1, z1), P(x, y0, z1)];
  const cub = (x0, x1, y0, y1, z0, z1, c) => { poly(top(x0, x1, y0, y1, z1), c.top); poly(front(x0, x1, y1, z0, z1), c.front); poly(right(x1, y0, y1, z0, z1), c.right); };
  const w = (W + D) * C * u + 16, h = (W + D) * S * u + H * u + 16;
  poly([P(-0.05, D + 0.3, 0), P(W + 0.3, D + 0.3, 0), P(W + 0.3, 0, 0), P(0, 0, 0)], pal.ombre, { flou: true });
  poly(front(t, W - t, bt, 0, H), 'url(#fond)');
  poly(right(t, bt, D, 0, H), pal.inner);
  for (let r = 0; r < R; r++) {
    const i = R - 1 - r;
    const zb = pt + r * (hc + pt);
    poly(top(t, W - t, bt, D, zb), pal.top); poly(front(t, W - t, D, zb - pt, zb), pal.front);
    poly(front(t, W - t, bt + 0.001, zb + hc - 0.22, zb + hc), 'rgba(0,0,0,.18)');
    const ligne = (grille && grille[i]) || [];
    for (let c = 0; c < n; c++) {
      const p = ligne[c];
      const x0 = t + c + 0.07, x1 = t + c + 0.93;
      if (!p) continue;
      const tire = p.etat === 'sortir' ? 0.22 : 0;
      const yf = D - 0.06 + tire, y0 = yf - 0.92;
      const ton = TONS[teinteDe(p)] || TONS.kraft;
      poly([P(x0 + 0.06, yf + 0.05, zb), P(x1 + 0.1, yf + 0.05, zb), P(x1 + 0.1, y0, zb), P(x0 + 0.06, y0, zb)], 'rgba(0,0,0,.22)', { flou: true });
      cub(x0, x1, y0, yf, zb, zb + bh, ton);
      poly(front(x0, x1, yf, zb + bh - 0.1, zb + bh), 'rgba(0,0,0,.08)');
      if (p.etat === 'sortir' || p.etat === 'double') poly(front(x0, x1, yf, zb, zb + bh), 'none', { trait: p.etat === 'double' ? 'var(--sb-doublon)' : '#F0A43C', epaisseur: 2 });
    }
  }
  cub(0, W, 0, D, H - pt, H, pal);
  poly(front(0, t, D, 0, H), pal.front); poly(top(0, t, 0, D, H), pal.top);
  cub(W - t, W, 0, D, 0, H, pal);
  return { w: Math.round(w), h: Math.round(h), polys, fond: [pal.back1, pal.back2] };
}
