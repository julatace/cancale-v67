// ══════════════════════════════════════════════════════════════════════════════
//  CHERCHER PAR COULEUR (14 nov., proposition 104 — validée par Julien)
// ══════════════════════════════════════════════════════════════════════════════
// Il tape « bleu » (ou « blue », « azul », « blu », « blau ») : VRM montre ses paires
// dont la PHOTO est bleue. La couleur est calculée À PARTIR DE SES PROPRES PHOTOS,
// sur l'appareil (canvas), sans IA, sans serveur, sans clé (§2.9).
//   · la couleur DOMINANTE de la paire, pas celle du fond : le fond est estimé par la
//     couleur médiane du bord de l'image, et chaque pixel compte d'autant plus qu'il
//     s'en éloigne et qu'il est près du centre ;
//   · rangée PAR IDENTITÉ DE PHOTO (l'adresse exacte de la photo, ou `studio:<N°>:<id>`
//     pour une photo du studio — src/indexCouleurs.js) : jamais par titre ;
//   · ⚠️ c'est UNE RECHERCHE, jamais un rapprochement d'identité (§5) : deux paires
//     bleues ne sont pas la même paire ; rien n'est relié, rien n'est écrit dans ses
//     fiches ; c'est SON toucher qui ouvre une fiche.
// Module PUR : exécuté tel quel par scripts/audit-couleur-photo.cjs.
// ══════════════════════════════════════════════════════════════════════════════

export const V_COULEUR = 1;
export const FAMILLES = ['noir', 'blanc', 'gris', 'beige', 'marron', 'rouge', 'orange', 'jaune', 'vert', 'bleu', 'violet', 'rose'];
export const PART_MIN = 0.22;       // une couleur est « de la paire » si elle en couvre au moins 22 %
// La pastille affichée pour chaque famille (un repère visuel, pas une donnée).
export const TEINTES = { noir: '#1c1c1e', blanc: '#f5f5f7', gris: '#8e8e93', beige: '#d8c7a6', marron: '#7a4e2d', rouge: '#d70015', orange: '#ff8a00', jaune: '#ffd60a', vert: '#2fa84f', bleu: '#0a64d8', violet: '#7d3cc8', rose: '#ff5fa2' };

// Les mots de chaque famille, dans les cinq langues de VRM (sans accents, minuscules).
// Le premier mot de chaque langue est celui qu'on AFFICHE.
export const NOMS = {
  fr: { noir: ['noir', 'noire', 'noirs', 'noires'], blanc: ['blanc', 'blanche', 'blancs', 'blanches'], gris: ['gris', 'grise', 'grises'], beige: ['beige', 'beiges', 'creme', 'ecru'], marron: ['marron', 'marrons', 'brun', 'brune', 'chocolat', 'camel'], rouge: ['rouge', 'rouges', 'bordeaux'], orange: ['orange', 'oranges'], jaune: ['jaune', 'jaunes'], vert: ['vert', 'verte', 'verts', 'vertes', 'kaki'], bleu: ['bleu', 'bleue', 'bleus', 'bleues', 'marine'], violet: ['violet', 'violette', 'violets', 'mauve'], rose: ['rose', 'roses'] },
  en: { noir: ['black'], blanc: ['white'], gris: ['grey', 'gray'], beige: ['beige', 'cream'], marron: ['brown', 'tan'], rouge: ['red'], orange: ['orange'], jaune: ['yellow'], vert: ['green', 'khaki'], bleu: ['blue', 'navy'], violet: ['purple', 'violet'], rose: ['pink'] },
  es: { noir: ['negro', 'negra', 'negros', 'negras'], blanc: ['blanco', 'blanca', 'blancos', 'blancas'], gris: ['gris', 'grises'], beige: ['beis', 'beige', 'crema'], marron: ['marron', 'marrones', 'cafe'], rouge: ['rojo', 'roja', 'rojos', 'rojas'], orange: ['naranja', 'naranjas'], jaune: ['amarillo', 'amarilla', 'amarillos'], vert: ['verde', 'verdes'], bleu: ['azul', 'azules', 'marino'], violet: ['morado', 'morada', 'violeta', 'lila'], rose: ['rosa', 'rosas'] },
  it: { noir: ['nero', 'nera', 'neri', 'nere'], blanc: ['bianco', 'bianca', 'bianchi', 'bianche'], gris: ['grigio', 'grigia', 'grigi', 'grigie'], beige: ['beige', 'crema'], marron: ['marrone', 'marroni'], rouge: ['rosso', 'rossa', 'rossi', 'rosse'], orange: ['arancione', 'arancio'], jaune: ['giallo', 'gialla', 'gialli'], vert: ['verde', 'verdi'], bleu: ['blu', 'azzurro', 'azzurra'], violet: ['viola'], rose: ['rosa'] },
  de: { noir: ['schwarz', 'schwarze', 'schwarzen'], blanc: ['weiss', 'weisse', 'weissen'], gris: ['grau', 'graue', 'grauen'], beige: ['beige', 'creme'], marron: ['braun', 'braune', 'braunen'], rouge: ['rot', 'rote', 'roten'], orange: ['orange'], jaune: ['gelb', 'gelbe', 'gelben'], vert: ['grun', 'grune', 'grunen', 'gruen'], bleu: ['blau', 'blaue', 'blauen'], violet: ['lila', 'violett'], rose: ['rosa', 'pink'] },
};
const sansAccent = (s) => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
const INDEX_MOTS = (() => {
  const m = new Map();
  for (const l of Object.keys(NOMS)) for (const [f, mots] of Object.entries(NOMS[l])) for (const w of mots) { const k = sansAccent(w); if (!m.has(k)) m.set(k, f); }
  return m;
})();
// Le nom d'une famille dans une langue (repli : français).
export const nomCouleur = (f, l = 'fr') => ((NOMS[l] || NOMS.fr)[f] || NOMS.fr[f] || [f])[0];
// Une requête parle-t-elle d'une couleur ? Rend la famille (le PREMIER mot de couleur
// de la requête) et le reste du texte, ou null. « bleu », « Nike bleue », « blue ».
export function couleurDeRequete(q) {
  const mots = sansAccent(q).split(/[^a-z0-9]+/).filter(Boolean);
  for (let i = 0; i < mots.length; i++) {
    const f = INDEX_MOTS.get(mots[i]);
    if (f) return { famille: f, reste: mots.filter((_, j) => j !== i).join(' ') };
  }
  return null;
}

// RGB 0–255 → { h (0–360), s (0–1), v (0–1) }.
const hsv = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4); }
  if (h < 0) h += 360;
  return { h, s: mx ? d / mx : 0, v: mx };
};
// La famille d'UN pixel.
export function familleDe(r, g, b) {
  const { h, s, v } = hsv(r, g, b);
  if (v < 0.2) return 'noir';
  if (s < 0.14) return v > 0.84 ? 'blanc' : v < 0.3 ? 'noir' : 'gris';
  if (h >= 18 && h < 50 && s < 0.38 && v > 0.62) return 'beige';
  if (h >= 8 && h < 45 && v < 0.6) return 'marron';
  if (h < 12 || h >= 345) return s < 0.45 && v > 0.7 ? 'rose' : 'rouge';
  if (h < 42) return 'orange';
  if (h < 68) return 'jaune';
  if (h < 165) return 'vert';
  if (h < 258) return 'bleu';
  if (h < 295) return 'violet';
  return 'rose';
}

// La couleur DOMINANTE d'une photo : [{ c, part }] (parts ≥ PART_MIN, de la plus grande
// à la plus petite, 3 au plus). Rend [] si rien ne domine ; null si l'image est illisible.
export function couleursDePixels(rgba, w, h) {
  if (!(w > 3 && h > 3) || !rgba || rgba.length < w * h * 4) return null;
  // Réduction à 48 px de côté (moyenne de surface), assez pour une couleur.
  const T = 48, k = Math.max(w, h) / T, W = Math.max(4, Math.round(w / k)), H = Math.max(4, Math.round(h / k));
  const px = new Float32Array(W * H * 3);
  for (let Y = 0; Y < H; Y++) {
    const y0 = Math.floor(Y * h / H), y1 = Math.max(y0 + 1, Math.floor((Y + 1) * h / H));
    for (let X = 0; X < W; X++) {
      const x0 = Math.floor(X * w / W), x1 = Math.max(x0 + 1, Math.floor((X + 1) * w / W));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { const i = (y * w + x) * 4; r += rgba[i]; g += rgba[i + 1]; b += rgba[i + 2]; n++; }
      const o = (Y * W + X) * 3; px[o] = r / n; px[o + 1] = g / n; px[o + 2] = b / n;
    }
  }
  // Le fond : la couleur médiane du bord (canal par canal).
  const bord = [[], [], []];
  for (let X = 0; X < W; X++) for (const Y of [0, 1, H - 2, H - 1]) for (let c = 0; c < 3; c++) bord[c].push(px[(Y * W + X) * 3 + c]);
  for (let Y = 2; Y < H - 2; Y++) for (const X of [0, 1, W - 2, W - 1]) for (let c = 0; c < 3; c++) bord[c].push(px[(Y * W + X) * 3 + c]);
  const med = bord.map((l) => { const s = l.slice().sort((a, b) => a - b); return s[s.length >> 1]; });
  const poids = new Map(); let total = 0;
  const voter = (unif) => {
    poids.clear(); total = 0;
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      const o = (Y * W + X) * 3, r = px[o], g = px[o + 1], b = px[o + 2];
      const d = Math.sqrt((r - med[0]) ** 2 + (g - med[1]) ** 2 + (b - med[2]) ** 2);
      const loinFond = unif ? 1 : Math.min(1, Math.max(0, (d - 18) / 50));
      if (!loinFond) continue;
      const dx = (X + 0.5) / W - 0.5, dy = (Y + 0.5) / H - 0.5;
      const centre = 1 - Math.min(0.6, Math.sqrt(dx * dx + dy * dy));
      const p = loinFond * centre;
      const f = familleDe(r, g, b);
      poids.set(f, (poids.get(f) || 0) + p); total += p;
    }
  };
  voter(false);
  // La paire se confond avec le fond (photo prise sur un fond de sa couleur) : tous les pixels comptent.
  if (total < W * H * 0.04) voter(true);
  if (!(total > 0)) return [];
  return [...poids.entries()].map(([c, p]) => ({ c, part: Math.round((p / total) * 100) / 100 }))
    .filter((x) => x.part >= PART_MIN).sort((a, b) => b.part - a.part).slice(0, 3);
}

// Les photos d'une famille : `entrees` = [{ cle, couleurs: [{c, part}] | null, ... }]
// (une par PHOTO). Rend celles où la famille couvre au moins PART_MIN, de la plus à la
// moins colorée ; une photo pas encore lue (`couleurs: null`) n'est jamais rendue (elle
// est comptée à part par l'écran : « N photos pas encore lues »).
export function photosDeCouleur(entrees, famille) {
  if (!FAMILLES.includes(famille)) return [];
  const out = [], vues = new Set();
  for (const e of Array.isArray(entrees) ? entrees : []) {
    if (!e || e.cle == null || vues.has(String(e.cle)) || !Array.isArray(e.couleurs)) continue;
    const x = e.couleurs.find((y) => y && y.c === famille && y.part >= PART_MIN);
    if (!x) continue;
    vues.add(String(e.cle));
    out.push({ ...e, part: x.part });
  }
  return out.sort((a, b) => b.part - a.part || String(a.cle).localeCompare(String(b.cle)));
}
