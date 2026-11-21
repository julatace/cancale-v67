// ── RECHERCHE PAR PHOTO : L'EMPREINTE D'UNE IMAGE ET LE CLASSEMENT (6 nov.) ──
//
// Julien a une paire en main, il la photographie : VRM propose les annonces et
// fiches dont la photo RESSEMBLE le plus, et c'est lui qui choisit (§5 : une
// PROPOSITION peut utiliser la ressemblance, c'est toujours SON clic qui relie).
//
// 100 % dans le navigateur, sans serveur, sans clé, sans modèle (§2.9) : une
// empreinte de quelques centaines de nombres calculée sur les pixels. Ce module
// est PUR (aucun DOM) : il prend des pixels RGBA, il rend une empreinte ; il
// compare deux empreintes. `scripts/audit-recherche-photo.cjs` l'exécute tel
// quel sur un jeu d'images INVENTÉES.
//
// Ce que porte une empreinte, et pourquoi (chiffres : docs/passation/2026-11-06-recherche-photo.md) :
//   · `couleur` : histogramme teinte × saturation (+ 4 gris), pondéré par
//     « ce qui n'est pas le fond » (la couleur médiane du bord de l'image) et
//     par le centre. La luminosité est rapportée au 95e centile de l'objet :
//     une photo plus sombre ou plus claire garde le même histogramme. C'est le
//     signal qui survit à un AUTRE ANGLE et à un AUTRE FOND ;
//   · `bords` : orientations des contours (8 directions, image entière + 4
//     quarts), pondérées comme la couleur — la forme, sans la lumière ;
//   · `grille` : la couleur moyenne (chromaticité) de 4 × 4 cases — où sont
//     les couleurs ;
//   · `dh` / `ph` : deux empreintes « perceptuelles » de 64 bits (différence de
//     voisins, cosinus discret) — la MÊME photo recadrée, réduite, recompressée,
//     éclaircie se retrouve presque bit pour bit.
//
// ⚠️ Ce n'est PAS une identité (§5). Un score dit « ressemble », jamais « c'est
// elle » : deux paires du même modèle et de la même couleur ont la même
// empreinte, et c'est voulu que l'écran les montre côte à côte.

export const V_EMPREINTE = 1;          // monter ce numéro recalcule les empreintes gardées
const T = 64;                          // côté de l'image réduite (couleur, bords, grille)
const NH = 12, NS = 2, NG = 4;         // teintes, saturations, gris
const NCOUL = NH * NS + NG;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Réduction par moyenne de surface (box filter), en Float32 RGB. Une même règle
// dans le navigateur et dans le banc : c'est elle qui rend l'empreinte
// indépendante de la taille d'origine.
export const reduire = (rgba, w, h, W, H) => {
  const out = new Float32Array(W * H * 3);
  if (!(w > 0 && h > 0)) return out;
  const sx = w / W, sy = h / H;
  for (let Y = 0; Y < H; Y++) {
    const y0 = Y * sy, y1 = (Y + 1) * sy;
    for (let X = 0; X < W; X++) {
      const x0 = X * sx, x1 = (X + 1) * sx;
      let r = 0, g = 0, b = 0, aire = 0;
      for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y1)); y++) {
        const fy = Math.min(y + 1, y1) - Math.max(y, y0); if (fy <= 0) continue;
        for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x1)); x++) {
          const fx = Math.min(x + 1, x1) - Math.max(x, x0); if (fx <= 0) continue;
          const a = fx * fy, i = (y * w + x) * 4;
          r += rgba[i] * a; g += rgba[i + 1] * a; b += rgba[i + 2] * a; aire += a;
        }
      }
      const o = (Y * W + X) * 3;
      if (aire > 0) { out[o] = r / aire; out[o + 1] = g / aire; out[o + 2] = b / aire; }
    }
  }
  return out;
};

const gris = (p, n) => { const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = 0.299 * p[i * 3] + 0.587 * p[i * 3 + 1] + 0.114 * p[i * 3 + 2]; return g; };
const mediane = (arr) => { const s = Array.from(arr).sort((a, b) => a - b); return s.length ? s[s.length >> 1] : 0; };

// Le fond : les couleurs DOMINANTES du bord (anneau de 4 px de l'image
// réduite), jusqu'à trois (un mur et un sol, une main…), chacune devant couvrir
// au moins 12 % de l'anneau. Un poids par pixel : 0 pour ce qui ressemble à
// l'une d'elles, 1 pour ce qui s'en distingue, multiplié par une préférence
// douce pour le centre (l'objet y est presque toujours). Une image où rien ne
// se distingue ⇒ le centre seul.
const couleursDuBord = (p) => {
  const pts = [];
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    if (x >= 4 && x < T - 4 && y >= 4 && y < T - 4) continue;
    const o = (y * T + x) * 3; pts.push([p[o], p[o + 1], p[o + 2]]);
  }
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // Départ déterministe : la médiane, puis à chaque fois le point le plus loin des centres déjà pris.
  const med = [0, 1, 2].map((c) => mediane(pts.map((q) => q[c])));
  const centres = [med];
  while (centres.length < 3) { let loin = null, dm = -1; for (const q of pts) { const d = Math.min(...centres.map((c) => d2(q, c))); if (d > dm) { dm = d; loin = q; } } if (!loin || dm < 400) break; centres.push(loin.slice()); }
  let n = new Array(centres.length).fill(0);
  for (let it = 0; it < 6; it++) {
    const acc = centres.map(() => [0, 0, 0]); n = new Array(centres.length).fill(0);
    for (const q of pts) { let k = 0, dm = Infinity; centres.forEach((c, j) => { const d = d2(q, c); if (d < dm) { dm = d; k = j; } }); acc[k][0] += q[0]; acc[k][1] += q[1]; acc[k][2] += q[2]; n[k]++; }
    centres.forEach((c, j) => { if (n[j]) { c[0] = acc[j][0] / n[j]; c[1] = acc[j][1] / n[j]; c[2] = acc[j][2] / n[j]; } });
  }
  const fonds = centres.filter((c, j) => n[j] >= pts.length * 0.12);
  return fonds.length ? fonds : [med];
};
// Quand presque rien ne se distingue du fond (une paire blanche sur un mur
// blanc), le fond n'est plus effacé tout à fait : un plancher, d'autant plus
// haut que l'objet trouvé est petit — sinon un simple recadrage changeait tout.
const poidsObjet = (p) => {
  const fonds = couleursDuBord(p);
  const o = new Float32Array(T * T), w = new Float32Array(T * T);
  let masse = 0;
  for (let i = 0; i < T * T; i++) {
    let d = Infinity; for (const f of fonds) d = Math.min(d, Math.hypot(p[i * 3] - f[0], p[i * 3 + 1] - f[1], p[i * 3 + 2] - f[2]) / 441.7);
    o[i] = clamp01((d - 0.08) / 0.17); masse += o[i];
  }
  masse /= T * T;
  const plancher = masse < 0.15 ? 0.3 * (1 - masse / 0.15) : 0;
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x, dx = (x + 0.5) / T - 0.5, dy = (y + 0.5) / T - 0.5;
    const centre = Math.exp(-(dx * dx + dy * dy) / (2 * 0.3 * 0.3));
    w[i] = (plancher + (1 - plancher) * o[i]) * (0.35 + 0.65 * centre);
  }
  return w;
};

const hsv = (r, g, b) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return [h, mx > 0 ? d / mx : 0, mx];
};

const normaliser1 = (v) => { let s = 0; for (const x of v) s += x; if (s > 0) for (let i = 0; i < v.length; i++) v[i] /= s; return v; };
const normaliser2 = (v) => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s); if (s > 0) for (let i = 0; i < v.length; i++) v[i] /= s; return v; };

// Le centre seul (sans deviner le fond) : le repli quand l'objet se confond
// avec le fond (une paire blanche sur un mur blanc).
const poidsCentre = () => { const w = new Float32Array(T * T); for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const dx = (x + 0.5) / T - 0.5, dy = (y + 0.5) / T - 0.5; w[y * T + x] = Math.exp(-(dx * dx + dy * dy) / (2 * 0.22 * 0.22)); } return w; };
const histoCouleur = (p, w) => {
  // Luminosité rapportée à l'objet (95e centile pondéré) : rééclairer ne déplace rien.
  const vs = [];
  for (let i = 0; i < T * T; i++) if (w[i] > 0.2) vs.push(Math.max(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
  vs.sort((a, b) => a - b);
  const vref = Math.max(30, vs.length ? vs[Math.floor(vs.length * 0.95)] : 255);
  const h = new Float32Array(NCOUL);
  for (let i = 0; i < T * T; i++) {
    const wi = w[i]; if (wi <= 0) continue;
    const [hu, s, v0] = hsv(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
    const v = Math.min(1, v0 / vref);
    // Saturation et teinte n'ont de sens que sur une couleur assez lumineuse.
    const chroma = clamp01((s - 0.18) / 0.14) * clamp01((v - 0.12) / 0.1);
    if (chroma > 0) {
      const fh = hu * NH - 0.5, h0 = Math.floor(fh), a = fh - h0;          // teinte répartie entre deux cases voisines
      const sb = s > 0.55 ? 1 : 0;
      const c0 = ((h0 % NH) + NH) % NH, c1 = (c0 + 1) % NH;
      h[c0 * NS + sb] += wi * chroma * (1 - a);
      h[c1 * NS + sb] += wi * chroma * a;
    }
    if (chroma < 1) {
      const fg = Math.min(NG - 1 - 1e-6, Math.max(0, v * NG - 0.5)), g0 = Math.floor(fg), a = fg - g0;
      h[NH * NS + g0] += wi * (1 - chroma) * (1 - a);
      h[NH * NS + Math.min(NG - 1, g0 + 1)] += wi * (1 - chroma) * a;
    }
  }
  return normaliser1(h);
};

const grilleCouleur = (p, w) => {
  // Chromaticité (r/(r+g+b), g/(r+g+b)) : indépendante de l'intensité de la lumière.
  const n = 4, c = n * n, acc = new Float32Array(c * 3);
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const i = y * T + x, wi = w[i] + 0.05, o = i * 3;
    const s = p[o] + p[o + 1] + p[o + 2] + 1e-3;
    const k = Math.floor(y * n / T) * n + Math.floor(x * n / T);
    acc[k * 3] += wi * p[o] / s; acc[k * 3 + 1] += wi * p[o + 1] / s; acc[k * 3 + 2] += wi;
  }
  const g = new Float32Array(c * 2);
  for (let k = 0; k < c; k++) { const s = acc[k * 3 + 2] || 1; g[k * 2] = acc[k * 3] / s; g[k * 2 + 1] = acc[k * 3 + 1] / s; }
  return g;
};

const histoBords = (g, w) => {
  const NB = 8, h = new Float32Array(NB * 5);
  for (let y = 1; y < T - 1; y++) for (let x = 1; x < T - 1; x++) {
    const i = y * T + x;
    const gx = (g[i - T + 1] + 2 * g[i + 1] + g[i + T + 1]) - (g[i - T - 1] + 2 * g[i - 1] + g[i + T - 1]);
    const gy = (g[i + T - 1] + 2 * g[i + T] + g[i + T + 1]) - (g[i - T - 1] + 2 * g[i - T] + g[i - T + 1]);
    const m = Math.hypot(gx, gy); if (m < 8) continue;
    let a = Math.atan2(gy, gx); if (a < 0) a += Math.PI;                     // sans sens : 0..π
    const fa = a / Math.PI * NB - 0.5, a0 = Math.floor(fa), t = fa - a0;
    const b0 = ((a0 % NB) + NB) % NB, b1 = (b0 + 1) % NB;
    const v = Math.sqrt(m) * (0.25 + w[i]);
    const q = 1 + (y >= T / 2 ? 2 : 0) + (x >= T / 2 ? 1 : 0);
    for (const cel of [0, q]) { h[cel * NB + b0] += v * (1 - t); h[cel * NB + b1] += v * t; }
  }
  return normaliser2(h);
};

// 64 bits en 16 caractères hexadécimaux.
const bitsEnHex = (bits) => { let s = ''; for (let i = 0; i < 64; i += 4) s += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16); return s; };

// `miroir` : la même image retournée (la paire vue de l'autre côté).
const miroirGris = (g, W, H) => { const m = new Float32Array(g.length); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = g[y * W + (W - 1 - x)]; return m; };
const dHash = (rgba, w, h, miroir = false) => {
  const p = reduire(rgba, w, h, 9, 8); let g = gris(p, 72); if (miroir) g = miroirGris(g, 9, 8);
  const bits = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits.push(g[y * 9 + x + 1] > g[y * 9 + x] ? 1 : 0);
  return bitsEnHex(bits);
};

let _cos = null;
const pHash = (rgba, w, h, miroir = false) => {
  const N = 32, p = reduire(rgba, w, h, N, N); let g = gris(p, N * N); if (miroir) g = miroirGris(g, N, N);
  if (!_cos) { _cos = new Float32Array(8 * N); for (let u = 0; u < 8; u++) for (let x = 0; x < N; x++) _cos[u * N + x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)); }
  const d = new Float32Array(64);
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) {
    let s = 0; for (let y = 0; y < N; y++) { const cy = _cos[v * N + y]; for (let x = 0; x < N; x++) s += g[y * N + x] * _cos[u * N + x] * cy; }
    d[v * 8 + u] = s;
  }
  const sansDC = Array.from(d).slice(1), med = mediane(sansDC);
  const bits = [0]; for (let i = 1; i < 64; i++) bits.push(d[i] > med ? 1 : 0);
  return bitsEnHex(bits);
};

// L'EMPREINTE d'une image (pixels RGBA, n'importe quelle taille). `null` si
// l'image est vide : jamais une empreinte de rien présentée comme une photo.
// La balance des blancs : chaque canal rapporté à ses tons les plus clairs
// (97e centile), gains bornés — une lumière chaude ou froide ne change plus la
// teinte. Pour la couleur seulement (les hachages travaillent en gris).
// (Un « point noir » par canal en plus a été mesuré : moins bon, retiré.)
const balanceBlancs = (p) => {
  const n = T * T, q = [];
  for (let c = 0; c < 3; c++) { const v = new Float32Array(n); for (let i = 0; i < n; i++) v[i] = p[i * 3 + c]; v.sort(); q.push(Math.max(20, v[Math.floor(n * 0.97)])); }
  const m = (q[0] + q[1] + q[2]) / 3;
  const g = q.map((x) => Math.min(1.33, Math.max(0.75, m / x)));
  const out = new Float32Array(p.length);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.min(255, p[i * 3 + c] * g[c]);
  return out;
};

export const empreinteDePixels = (rgba, w, h) => {
  if (!rgba || !(w > 1 && h > 1) || rgba.length < w * h * 4) return null;
  const p = balanceBlancs(reduire(rgba, w, h, T, T));
  const w8 = poidsObjet(p);
  const arr = (f) => Array.from(f, (x) => Math.round(x * 10000) / 10000);
  return {
    v: V_EMPREINTE,
    couleur: arr(histoCouleur(p, w8)),
    centre: arr(histoCouleur(p, poidsCentre())),
    bords: arr(histoBords(gris(p, T * T), w8)),
    grille: arr(grilleCouleur(p, w8)),
    dh: dHash(rgba, w, h),
    ph: pHash(rgba, w, h),
    dhm: dHash(rgba, w, h, true),
    phm: pHash(rgba, w, h, true),
  };
};

const BITS = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
const hamming = (a, b) => { if (!a || !b || a.length !== b.length) return 64; let n = 0; for (let i = 0; i < a.length; i++) n += BITS[parseInt(a[i], 16) ^ parseInt(b[i], 16)]; return n; };

// Similarité de chaque partie, 0 (rien en commun) .. 1 (identique).
const bhatta = (a, b) => { let s = 0; for (let i = 0; i < NCOUL; i++) s += Math.sqrt((a[i] || 0) * (b[i] || 0)); return clamp01(s); };
export const parties = (a, b) => {
  let cb = 0; for (let i = 0; i < a.bords.length; i++) cb += a.bords[i] * b.bords[i];
  let dg = 0; for (let i = 0; i < a.grille.length; i++) dg += Math.abs(a.grille[i] - b.grille[i]);
  const grille = clamp01(1 - dg / a.grille.length / 0.12);
  // Deux images sans rapport ont ~32 bits différents sur 64 : on rapporte à ça.
  // La paire photographiée de l'autre côté : comparée aussi à son miroir.
  const hash = clamp01(1 - Math.min(hamming(a.dh, b.dh), hamming(a.ph, b.ph), hamming(a.dh, b.dhm), hamming(a.ph, b.phm)) / 32);
  return { objet: bhatta(a.couleur, b.couleur), centre: bhatta(a.centre, b.centre), bords: clamp01(cb), grille, hash };
};

// Les poids : réglés par la mesure (scripts/mesure-recherche-photo.cjs) — la
// couleur porte l'essentiel ; `objet` = part de la couleur « sans le fond »
// face à la couleur du centre seul.
export const POIDS = { couleur: 0.7, objet: 0.8, bords: 0.1, grille: 0.2, hash: 0 };

export const combiner = (s, P = POIDS) => {
  const couleur = P.objet * s.objet + (1 - P.objet) * s.centre;
  const base = P.couleur * couleur + P.bords * s.bords + P.grille * s.grille + P.hash * s.hash;
  // La même photo (recadrée, recompressée, rééclairée, retournée) : un hachage
  // presque identique ET les mêmes couleurs ajoutent jusqu'à 0,15. Le hachage
  // SEUL ne suffit jamais : ses photos d'annonces sont toutes prises au même
  // endroit, de la même façon — deux paires de couleurs différentes y ont
  // presque le même dessin en gris (mesuré par l'audit, cas A). Les couleurs se
  // jugent ici aussi sur le centre seul : une paire blanche sur un mur blanc n'a
  // pas de « fond » sûr, mais la même photo garde son centre.
  const c2 = Math.max(couleur, s.centre);
  const bonus = 0.15 * clamp01((s.hash - 0.75) / 0.25) * clamp01((c2 - 0.75) / 0.2);
  return base + bonus;
};

export const similarite = (a, b) => (!a || !b || a.v !== b.v ? 0 : combiner(parties(a, b)));

// Ce que l'écran dit d'un score : le score lui-même ET sa place parmi SES
// annonces (`relatif` : 1 = la plus ressemblante, 0 = la ressemblance médiane
// de tout le catalogue). Un score haut au milieu d'un catalogue de paires
// toutes semblables ne dit pas « très proche ». JAMAIS « c'est elle » : le
// meilleur score ne prouve rien (deux paires identiques ont le même), il propose.
// Seuils posés par la mesure (scripts/mesure-recherche-photo.cjs).
export const SEUILS = { tresProche: 0.85, tresProcheRelatif: 0.97, proche: 0.78, procheRelatif: 0.8 };
export const niveauDe = (score, relatif = 1) => (score >= SEUILS.tresProche && relatif >= SEUILS.tresProcheRelatif ? 'tres-proche'
  : score >= SEUILS.proche && relatif >= SEUILS.procheRelatif ? 'proche' : 'peu-sur');
export const NIVEAUX = { 'tres-proche': 'Très proche', proche: 'Proche', 'peu-sur': 'Peu sûr' };

// Le classement. `index` : [{ cle, empreinte, ... }] — `cle` est l'IDENTITÉ de
// l'entrée (l'annonce), jamais un titre : deux entrées au même titre restent
// deux lignes, chacune avec son score. Rend les `max` meilleures, chacune une
// seule fois (une entrée sans empreinte n'est pas classée).
export const classer = (requete, index, { max = 5 } = {}) => {
  if (!requete) return [];
  const vus = new Set(), tous = [];
  for (const e of index || []) {
    if (!e || e.cle == null || vus.has(String(e.cle)) || !e.empreinte) continue;
    vus.add(String(e.cle));
    tous.push({ e, score: similarite(requete, e.empreinte) });
  }
  if (!tous.length) return [];
  const tries = tous.map((x) => x.score).sort((a, b) => a - b);
  const med = tries[Math.floor((tries.length - 1) / 2)], best = tries[tries.length - 1];
  const out = tous.map(({ e, score }) => {
    const relatif = tous.length < 3 ? 1 : (score - med) / Math.max(1e-3, best - med);
    return { ...e, brut: score, score: Math.round(score * 1000) / 1000, relatif: Math.round(relatif * 100) / 100, niveau: niveauDe(score, relatif) };
  });
  out.sort((a, b) => b.brut - a.brut || String(a.cle).localeCompare(String(b.cle)));
  return out.slice(0, max).map(({ brut, ...r }) => r);
};
