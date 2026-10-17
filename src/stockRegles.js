// ── STOCK : RÈGLES PURES DE LA PIÈCE (17 octobre) ───────────────────────────
// Julien : « je veux avoir la possibilité quand on crée la pièce de la créer
// avec une vue du dessus… on doit pouvoir faire la forme que l'on veut à notre
// entrepôt, chambre… rien ne doit traverser un meuble… si deux numéros sont
// empilés et qu'on enlève celui du dessous, celui du dessus descend ».
// Tout ce qui DÉCIDE (forme de la pièce, contenance, non-traversée, gravité)
// vit ici, sans React ni Three : l'écran, la 3D et l'audit appellent les mêmes
// fonctions (§11 — une règle, un propriétaire).
// ⚠️ Aucune fonction ne change un numéro : elles déplacent, empilent, retirent
//    sur demande — un numéro n'est jamais réattribué ni deviné (§5).

const arr = (a) => (Array.isArray(a) ? a : []);
const r2 = (v) => Math.round(v * 100) / 100;
export const PAS_PLAN = 0.25;                      // pas de la grille du plan (25 cm)
export const caler = (v, pas = PAS_PLAN) => Math.round(v / pas) * pas;

// ── LA FORME DE LA PIÈCE ────────────────────────────────────────────────────
// `room.poly` = liste de coins [x, y] en mètres (y = profondeur), dans le cadre
// 0..w × 0..h. Sans `poly`, la pièce est le rectangle w × h — comme avant.
export const rectPoly = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
export const polyDe = (room) => {
  const p = room && Array.isArray(room.poly) ? room.poly.filter((q) => Array.isArray(q) && isFinite(q[0]) && isFinite(q[1])) : [];
  return p.length >= 3 ? p.map((q) => [Number(q[0]), Number(q[1])]) : rectPoly(Number(room && room.w) || 10, Number(room && room.h) || 8);
};
export const estRectangle = (room) => !(room && Array.isArray(room.poly) && room.poly.length >= 3);
export const aire = (poly) => { let s = 0; for (let i = 0; i < poly.length; i++) { const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length]; s += x1 * y2 - x2 * y1; } return s / 2; };
// Ramène la forme au coin (0,0) et rend la boîte englobante : w/h restent la
// vérité pour la caméra, l'éclairage et les anciens lecteurs.
export const normaliserPoly = (poly) => {
  const p = arr(poly).map((q) => [r2(Number(q[0])), r2(Number(q[1]))]);
  if (p.length < 3) return null;
  const mx = Math.min(...p.map((q) => q[0])), my = Math.min(...p.map((q) => q[1]));
  const out = p.map(([x, y]) => [r2(x - mx), r2(y - my)]);
  const w = r2(Math.max(...out.map((q) => q[0]))), h = r2(Math.max(...out.map((q) => q[1])));
  if (!(w >= 1 && h >= 1) || Math.abs(aire(out)) < 1) return null;   // une pièce d'au moins 1 m²
  if (seCroise(out)) return null;                                      // une forme qui se recoupe n'est pas une pièce
  return { poly: out, w, h, dx: mx, dy: my };
};
// Préréglages : on part d'une forme courante, puis on tire les coins.
export const FORMES = {
  rectangle: (w, h) => rectPoly(w, h),
  L: (w, h) => { const a = caler(w * 0.55), b = caler(h * 0.5); return [[0, 0], [w, 0], [w, b], [a, b], [a, h], [0, h]]; },
  U: (w, h) => { const a = caler(w * 0.33), b = caler(w * 0.67), c = caler(h * 0.5); return [[0, 0], [w, 0], [w, h], [b, h], [b, c], [a, c], [a, h], [0, h]]; },
  T: (w, h) => { const a = caler(w * 0.33), b = caler(w * 0.67), c = caler(h * 0.45); return [[0, 0], [w, 0], [w, c], [b, c], [b, h], [a, h], [a, c], [0, c]]; },
};

const segCoupe = (a, b, c, d) => {                 // intersection STRICTE de deux segments
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
};
export const seCroise = (poly) => {
  const n = poly.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
    if (segCoupe(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return true;
  }
  return false;
};
// Point dans la forme (bord compris : un meuble contre le mur est DEDANS).
export const pointDans = (x, y, poly, eps = 1e-6) => {
  let dedans = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    // sur le bord
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi);
    if (Math.abs(cross) < eps * Math.max(1, Math.hypot(xj - xi, yj - yi)) && x >= Math.min(xi, xj) - eps && x <= Math.max(xi, xj) + eps && y >= Math.min(yi, yj) - eps && y <= Math.max(yi, yj) + eps) return true;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans;
  }
  return dedans;
};
// Un rectangle au sol (centre cx,cy · largeur w · profondeur h) tient-il dans la
// pièce ? Ses quatre coins dedans, aucun coin de la pièce DANS lui (le coin
// rentrant d'une pièce en L), aucun mur qui le traverse.
export const rectDans = (cx, cy, w, h, poly) => {
  const x0 = cx - w / 2 + 1e-4, x1 = cx + w / 2 - 1e-4, y0 = cy - h / 2 + 1e-4, y1 = cy + h / 2 - 1e-4;
  const coins = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  if (!coins.every(([x, y]) => pointDans(x, y, poly))) return false;
  if (poly.some(([x, y]) => x > x0 && x < x1 && y > y0 && y < y1)) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let k = 0; k < 4; k++) if (segCoupe(a, b, coins[k], coins[(k + 1) % 4])) return false;
  }
  return true;
};

// ── EMPREINTE ET CHEVAUCHEMENT ──────────────────────────────────────────────
export const empreinte = (it) => {
  const odd = Math.abs(Math.round((it.rot || 0) / (Math.PI / 2))) % 2 === 1;
  const w = Number(it.w) || 0.5, h = Number(it.h) || 0.5;
  return { cx: (Number(it.x) || 0) + w / 2, cy: (Number(it.y) || 0) + h / 2, w: odd ? h : w, h: odd ? w : h };
};
export const chevauche = (a, b, marge = 0.003) => ((a.w + b.w) / 2 - Math.abs(a.cx - b.cx)) > marge && ((a.h + b.h) / 2 - Math.abs(a.cy - b.cy)) > marge;

// Pousse un rectangle hors des obstacles (axe le plus court), le garde dans la
// pièce. Rend null s'il n'existe aucune place sans traverser quelque chose :
// l'appelant garde alors l'ancienne position (on ne pose JAMAIS en travers).
export const placerSansTraverser = (cx, cy, w, h, obstacles, poly) => {
  const W = Math.max(...poly.map((q) => q[0])), H = Math.max(...poly.map((q) => q[1]));
  const borne = (x, y) => [Math.max(w / 2, Math.min(W - w / 2, x)), Math.max(h / 2, Math.min(H - h / 2, y))];
  const libre = (x, y) => rectDans(x, y, w, h, poly) && !obstacles.some((o) => chevauche({ cx: x, cy: y, w, h }, o));
  let [x, y] = borne(cx, cy);
  for (let iter = 0; iter < 16; iter++) {
    let bouge = false;
    for (const s of obstacles) {
      const ox = (w + s.w) / 2 - Math.abs(x - s.cx), oy = (h + s.h) / 2 - Math.abs(y - s.cy);
      if (ox > 0.003 && oy > 0.003) { if (ox < oy) x += (x < s.cx ? -ox : ox); else y += (y < s.cy ? -oy : oy); bouge = true; }
    }
    [x, y] = borne(x, y);
    if (!bouge) break;
  }
  if (libre(x, y)) return { cx: r2(x), cy: r2(y) };
  // Pièce non rectangulaire ou coin encombré : on cherche la place libre la plus
  // proche sur une spirale de pas fins (borné : 900 essais).
  const pas = 0.25;
  for (let rayon = 1; rayon <= 30; rayon++) {
    let best = null, bd = Infinity;
    for (let i = -rayon; i <= rayon; i++) for (let j = -rayon; j <= rayon; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) !== rayon) continue;
      const [tx, ty] = borne(cx + i * pas, cy + j * pas);
      if (!libre(tx, ty)) continue;
      const d = (tx - cx) ** 2 + (ty - cy) ** 2; if (d < bd) { bd = d; best = [tx, ty]; }
    }
    if (best) return { cx: r2(best[0]), cy: r2(best[1]) };
  }
  return null;
};

// ── LES CASES : COLONNE QUI TOMBE, OU PILE DANS LA CASE ─────────────────────
// Deux physiques, et elles ne se mélangent pas :
//  · 'colonne' — un MUR de boîtes sans plateau (la grille de boîtes d'avant) :
//    une case vidée fait descendre toute la colonne au-dessus ;
//  · 'pile' — un PLATEAU (étagère métal ou bois, table) : les boîtes s'empilent
//    DANS la case, retirer celle du dessous fait descendre celles du dessus,
//    mais rien ne tombe d'un plateau à l'autre (le plateau les tient).
//  · 'cintre' — un portant : un numéro par cintre, rien ne tombe.
export const BOITE_H = 0.145, BOITE_JEU = 0.008;    // une boîte à chaussures
export const modeCase = (ft) => (ft && ft.cases) || 'colonne';
export const capaciteCase = (ft, it, wallH = 3.4) => {
  const m = modeCase(ft);
  if (m === 'cintre') return 1;
  if (m !== 'pile') return 1;
  if (ft.build === 'table') return Math.max(1, Math.min(12, Math.floor((Math.max(1.2, wallH * 0.7) - (ft.h3d || 0.5) * 1.5) / (BOITE_H + BOITE_JEU))));
  const rows = Math.max(1, (it && it.rows) || ft.rows || 1);
  const ht = Math.max(0.35, ((it && it.h3d) != null ? it.h3d : ft.h3d) * 1.5);
  const cellH = ht / rows;
  return Math.max(1, Math.floor((cellH - 0.04) / (BOITE_H + BOITE_JEU)));
};
const nettoie = (a) => arr(a).map((v) => String(v == null ? '' : v).trim()).filter(Boolean);
// Ajoute un numéro DANS une case-pile (au-dessus). Rend null si la case est pleine.
export const empilerDansCase = (slots, key, num, cap) => {
  const v = String(num == null ? '' : num).trim(); if (!v) return null;
  const pile = nettoie((slots || {})[key]);
  if (pile.length >= cap) return null;
  return { ...(slots || {}), [key]: [...pile, v] };
};
// Retire un numéro d'une case-pile : ceux du dessus DESCENDENT (l'ordre du
// tableau EST la hauteur — index 0 en bas). Rend { slots, descendus } où
// `descendus` = les numéros qui ont glissé d'un cran (pour l'animation).
export const retirerDeCase = (slots, key, num) => {
  const t = String(num == null ? '' : num).trim();
  const pile = nettoie((slots || {})[key]);
  const i = pile.findIndex((v) => v === t);
  if (i < 0) return null;
  const reste = pile.slice(0, i).concat(pile.slice(i + 1));
  const out = { ...(slots || {}) };
  if (reste.length) out[key] = reste; else delete out[key];
  return { slots: out, descendus: pile.slice(i + 1) };
};
// Une liste de piles (pile de cartons au sol, `nums` rempli colonne par colonne
// de bas en haut) : retirer un carton fait descendre ceux du dessus.
export const retirerDePile = (nums, idx) => {
  const a = arr(nums).slice(); if (idx < 0 || idx >= a.length) return null;
  a.splice(idx, 1); return a;
};

// ── POSÉ SUR UN MEUBLE ──────────────────────────────────────────────────────
// Un meuble a une surface (une table, un bureau) : une pile de cartons peut s'y
// poser. Quand le meuble BOUGE, ce qui est posé dessus suit ; quand il est
// RETIRÉ, ce qui était dessus redescend au sol (gravité), sans traverser.
export const estPoseSur = (pose, meuble) => {
  if (!(Number(pose.lift) > 0)) return false;
  const a = empreinte(pose), b = empreinte(meuble);
  return Math.abs(a.cx - b.cx) <= b.w / 2 + 1e-3 && Math.abs(a.cy - b.cy) <= b.h / 2 + 1e-3;
};

// ── CHERCHER DES PAIRES DANS LE STOCK (bouton de l'onglet Colis) ───────────
// Rend, pour chaque numéro demandé, où il est — ou null s'il n'est rangé nulle
// part. Comparaison par IDENTITÉ de numéro (`cle`, fournie par l'appelant).
export const localiserNumeros = (plan, nums, cle, ouEst) => {
  const vus = new Set(), out = [];
  for (const n of arr(nums)) {
    const k = cle(n); if (!k || vus.has(k)) continue; vus.add(k);
    out.push({ numero: String(n), ou: ouEst(plan, n) || null });
  }
  return out;
};
