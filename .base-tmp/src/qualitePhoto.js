// ══════════════════════════════════════════════════════════════════════════════
//  PHOTO FLOUE OU TROP SOMBRE ? (14 nov., proposition 102 — validée par Julien)
// ══════════════════════════════════════════════════════════════════════════════
// Avant qu'il mette une paire en ligne, VRM regarde la photo qu'il vient de prendre
// (studio, « Créer sur Vinted ») et dit, en un mot, « floue ? » ou « sombre ? ».
//   · CALCULÉ SUR LE TÉLÉPHONE (§2.9) : quelques milliers d'opérations sur les pixels,
//     dans un worker (src/qualitePhoto.worker.js) — aucune IA, aucun serveur, aucune clé ;
//   · UN SIMPLE AVERTISSEMENT : jamais bloquant, rien n'est retiré ni refusé ; il garde
//     sa photo s'il veut ;
//   · SEUILS PRUDENTS : on ne signale que ce qui est NETTEMENT flou ou sombre (mesuré par
//     scripts/audit-qualite-photo.cjs sur des images inventées : une photo légèrement
//     douce, une chaussure noire sur fond blanc, un fond uni à 80 % ne sont PAS signalés).
//   · « pas su » ≠ « nette » : une image uniforme (rien à juger) rend `juge: 'passu'`,
//     et rien n'est dit.
//
// LA MESURE
//   · netteté = variance du LAPLACIEN (4 voisins) de la luminance, après étirement du
//     contraste (2e → 98e centile) : une photo sombre mais nette garde ses bords. On la
//     prend case par case (grille 6 × 6) et on garde le 85e centile : un grand fond uni
//     ne fait pas passer une paire nette pour floue (seules les cases qui ont du détail
//     comptent) ;
//   · luminosité = moyenne et 95e centile de la luminance (Rec. 601, 0–255). Sombre =
//     moyenne basse ET aucune zone claire (une basket noire sur fond blanc a un 95e
//     centile haut : pas « sombre »).
// Module PUR (aucun DOM) : exécuté tel quel par l'audit et par le worker.
// ══════════════════════════════════════════════════════════════════════════════

export const V_QUALITE = 1;
export const COTE_QUALITE = 512;                     // l'image est réduite à 512 px de côté au plus
export const SEUILS = Object.freeze({
  nettete: 15,            // variance du laplacien (85e centile des cases) sous laquelle la photo est « floue »
  etendueMin: 6,          // écart 2e → 98e centile sous lequel on ne juge pas la netteté (image uniforme)
  lumMoy: 58,             // moyenne de la luminance sous laquelle la photo PEUT être sombre…
  lumHaute: 150,          // … si son 95e centile reste sous ce seuil (aucune zone claire)
});

// RGBA → luminance (Float32Array, 0–255).
export function luminance(rgba, w, h) {
  const n = w * h, g = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
  return g;
}

// Centile d'un tableau (copie triée ; p dans [0, 1]).
const centile = (arr, p) => {
  if (!arr.length) return 0;
  const s = Float32Array.from(arr).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
};

// Réduction par moyenne de surface, en luminance (le worker reçoit déjà ≤ 512 px).
export function reduireGris(g, w, h, cote = COTE_QUALITE) {
  const k = Math.max(w, h) / cote;
  if (k <= 1) return { g, w, h };
  const W = Math.max(2, Math.round(w / k)), H = Math.max(2, Math.round(h / k));
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    const y0 = Math.floor(Y * h / H), y1 = Math.max(y0 + 1, Math.floor((Y + 1) * h / H));
    for (let X = 0; X < W; X++) {
      const x0 = Math.floor(X * w / W), x1 = Math.max(x0 + 1, Math.floor((X + 1) * w / W));
      let s = 0, c = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += g[y * w + x]; c++; }
      out[Y * W + X] = c ? s / c : 0;
    }
  }
  return { g: out, w: W, h: H };
}

// Les mesures brutes d'une image en luminance.
export function mesurerGris(g0, w0, h0) {
  if (!(w0 > 2 && h0 > 2) || !g0 || g0.length < w0 * h0) return null;
  const { g, w, h } = reduireGris(g0, w0, h0);
  const n = w * h;
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) { s += g[i]; s2 += g[i] * g[i]; }
  const moy = s / n, contraste = Math.sqrt(Math.max(0, s2 / n - moy * moy));
  // Un échantillon (1 pixel sur 4 au plus) pour les centiles : assez précis, bien plus rapide.
  const pas = Math.max(1, Math.floor(n / 40000));
  const ech = []; for (let i = 0; i < n; i += pas) ech.push(g[i]);
  const p02 = centile(ech, 0.02), p98 = centile(ech, 0.98), p95 = centile(ech, 0.95);
  const etendue = p98 - p02;
  const k = etendue > 1 ? 255 / etendue : 1;
  // Laplacien de l'image ÉTIRÉE, variance par case (grille 6 × 6).
  const NC = 6, cases = new Float64Array(NC * NC * 3);
  for (let y = 1; y < h - 1; y++) {
    const cy = Math.min(NC - 1, Math.floor(y * NC / h));
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const L = k * (g[i - 1] + g[i + 1] + g[i - w] + g[i + w] - 4 * g[i]);
      const c = (cy * NC + Math.min(NC - 1, Math.floor(x * NC / w))) * 3;
      cases[c] += L; cases[c + 1] += L * L; cases[c + 2] += 1;
    }
  }
  const vars = [];
  for (let c = 0; c < NC * NC; c++) {
    const m = cases[c * 3 + 2]; if (!m) continue;
    const mu = cases[c * 3] / m; vars.push(Math.max(0, cases[c * 3 + 1] / m - mu * mu));
  }
  const nettete = centile(vars, 0.85);
  return { nettete: Math.round(nettete * 10) / 10, lum: Math.round(moy * 10) / 10, p95: Math.round(p95), contraste: Math.round(contraste * 10) / 10, etendue: Math.round(etendue), w, h };
}

// Le verdict : { flou, sombre, juge: 'ok' | 'flou' | 'sombre' | 'flou-sombre' | 'passu', mesures }.
export function juger(m, seuils = SEUILS) {
  if (!m) return { flou: false, sombre: false, juge: 'passu', v: V_QUALITE, mesures: null };
  const sombre = m.lum < seuils.lumMoy && m.p95 < seuils.lumHaute;
  const jugeable = m.etendue >= seuils.etendueMin;
  const flou = jugeable && m.nettete < seuils.nettete;
  const juge = flou && sombre ? 'flou-sombre' : flou ? 'flou' : sombre ? 'sombre' : jugeable ? 'ok' : 'passu';
  return { flou, sombre, juge, v: V_QUALITE, mesures: m };
}

// Le chemin complet, depuis des pixels RGBA (ce que le worker exécute).
export const qualiteDePixels = (rgba, w, h) => juger(mesurerGris(luminance(rgba, w, h), w, h));

// Ce qui se garde avec une photo (le studio la range avec elle) : petit, sans les pixels.
export const resumeQualite = (q) => (q && q.v === V_QUALITE ? { v: q.v, juge: q.juge, flou: !!q.flou, sombre: !!q.sombre, n: q.mesures ? q.mesures.nettete : null, l: q.mesures ? q.mesures.lum : null } : null);
// Une photo signalée (102) : floue ou sombre, mesurée par CETTE version de la règle.
export const photoDouteuse = (q) => !!(q && q.v === V_QUALITE && (q.flou || q.sombre));
