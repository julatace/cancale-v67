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
// Une étagère À BACS (`ft.bacs`) est un plateau dont chaque case tient UN bac
// numéroté : bijoux, accessoires, petits objets — une case, un numéro.
export const BOITE_H = 0.145, BOITE_JEU = 0.008;    // une boîte à chaussures
export const modeCase = (ft) => (ft && ft.cases) || 'colonne';
// (28 oct.) `r` (rangée, 0 = le haut) : sous une TABLE, les rangées 1, 2…
// sont les niveaux SOUS le dessus (le dernier est le sol) — leur hauteur est
// celle de la table partagée entre eux. Sans `r` : le dessus de la table.
export const capaciteCase = (ft, it, wallH = 3.4, r) => {
  const m = modeCase(ft);
  if (m === 'cintre') return 1;
  if (m !== 'pile') return 1;
  if (ft.bacs) return 1;                              // un bac par case (petits objets, accessoires)
  if (ft.build === 'table' && r >= 1) {
    const nr = Math.max(1, (it && it.rows) || 1); if (nr < 2) return 1;
    const ht = Math.max(0.35, ((it && it.h3d) != null ? it.h3d : ft.h3d) * 1.5);
    return Math.max(1, Math.floor((ht / (nr - 1) - 0.06) / (BOITE_H + BOITE_JEU)));
  }
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
// ── LES PLANCHES, COLONNE PAR COLONNE (28 oct.) ─────────────────────────────
// Julien : « rends les planches réglables colonne par colonne », puis « fais
// pareil pour les planches de la vue 3D ». Une forme pour « Mes meubles » et la
// pièce 3D : un NOMBRE r = une planche sur toute la largeur sous la rangée r
// (1 = celle du haut), une chaîne « r:c » = un morceau sous la rangée r, colonne
// c (1 = la gauche). Le bas du meuble en est toujours une.
export const planchesCases = (planches, cols, rows) => {
  const c = Math.max(1, +cols || 1), r = Math.max(1, +rows || 1), out = new Set();
  arr(planches).forEach((x) => {
    if (typeof x === 'number' || /^\d+$/.test(String(x))) { const n = +x; if (Number.isInteger(n) && n >= 1 && n < r) for (let k = 1; k <= c; k++) out.add(n + ':' + k); return; }
    const mm = /^(\d+):(\d+)$/.exec(String(x)); if (!mm) return;
    const n = +mm[1], k = +mm[2]; if (n >= 1 && n < r && k >= 1 && k <= c) out.add(n + ':' + k);
  });
  return out;
};
export const planchesRangees = (set, cols, rows) => {
  const c = Math.max(1, +cols || 1), r = Math.max(1, +rows || 1), out = [];
  for (let n = 1; n < r; n++) {
    const ks = []; for (let k = 1; k <= c; k++) if (set.has(n + ':' + k)) ks.push(k);
    if (ks.length === c) out.push(n); else ks.forEach((k) => out.push(n + ':' + k));
  }
  return out;
};
// Une étagère de la pièce 3D (métal ou bois, pas à bacs) : SANS réglage, tous
// ses plateaux sont là (comme avant). Rend null pour un meuble sans plateaux
// réglables (table, bacs, portant, mur de boîtes).
// (28 oct.) « fais pareil pour les tables » : une table peut avoir des plateaux
// SOUS son dessus (rangées 1, 2…) ; le dessus lui-même (sous la rangée 1) est
// toujours là.
// (28 oct.) « fais pareil pour les portants » : un portant peut avoir plusieurs
// BARRES (rangées, 0 = la barre du haut), réglables cintre par cintre. « r:c »
// = la barre de la rangée r−1 (0-indexée) à ce cintre ; sans elle, le vêtement
// descend sur la barre du dessous si elle est libre. La barre du bas est toujours là.
// (28 oct.) « fais pareil pour les étagères à bacs » : une étagère à bacs a ses
// plateaux réglables colonne par colonne ; sans plateau, le bac descend dans la
// case du dessous si elle est vide (un bac par case).
export const plateauxReglables = (ft) => !!(ft && ((modeCase(ft) === 'pile' && (ft.build === 'metal' || ft.build === 'table')) || (modeCase(ft) === 'cintre' && ft.build === 'portant')));
export const plateauxMeuble = (it, ft) => {
  if (!plateauxReglables(ft)) return null;
  const nr = Math.max(1, (it && it.rows) || ft.rows || 1), nc = Math.max(1, (it && it.cols) || ft.cols || 1);
  const p = it && Array.isArray(it.planches) ? it.planches : Array.from({ length: nr - 1 }, (_, i) => i + 1);
  const out = planchesCases(p, nc, nr);
  if (ft.build === 'table' && nr > 1) for (let c = 1; c <= nc; c++) out.add('1:' + c);   // le dessus de la table
  return out;
};
// GRAVITÉ SUR UN PLATEAU QUI MANQUE : dans une colonne, les cases qui ne sont
// séparées par AUCUN plateau forment une seule hauteur — les boîtes de la case du
// dessus tombent dans celle du dessous tant qu'elle a de la place. On ne déplace
// que des boîtes, jamais un numéro ; aucune n'est perdue (une case trop pleine
// garde le surplus). Index 0 de chaque case = la boîte du bas.
export const tasserPlateaux = (slots, nr, nc, cases, cap) => {
  const out = {}; const s = slots || {};
  for (const k in s) { const a = nettoie(s[k]); if (a.length) out[k] = a; }
  if (!cases) return out;
  const C = (r) => Math.max(1, (typeof cap === 'function' ? cap(r) : cap) || 1);
  for (let c = 0; c < nc; c++) {
    const bornes = [0];
    for (let r = 1; r < nr; r++) if (cases.has(r + ':' + (c + 1))) bornes.push(r);
    bornes.push(nr);
    for (let b = 0; b < bornes.length - 1; b++) {
      const haut = bornes[b], bas = bornes[b + 1] - 1;
      if (haut === bas) continue;
      const tout = [];
      for (let r = bas; r >= haut; r--) { tout.push(...(out[r + '_' + c] || [])); delete out[r + '_' + c]; }
      let r = bas;
      while (tout.length && r >= haut) { const part = r === haut ? tout.splice(0) : tout.splice(0, C(r)); out[r + '_' + c] = part; r--; }
    }
  }
  return out;
};
// CARTONS AU SOL : `nums` est rempli colonne par colonne, de bas en haut
// (`rows` cartons par colonne). Une place vide dans une colonne s'écrit '' —
// elle garde les autres colonnes à leur place.
// ⚠️ (17 oct.) Julien : « quand j'enlève un carton en bas d'une pile, ça décolle
//    tout ». Retirer faisait `splice` sur TOUTE la liste : chaque carton d'après
//    reculait d'un rang, donc le bas de la colonne suivante montait en HAUT de la
//    précédente, et ainsi de suite — toutes les colonnes se déplaçaient. Seuls
//    les cartons du DESSUS dans la MÊME colonne descendent d'un cran ; les
//    autres colonnes ne bougent pas.
export const estTrou = (v) => !String(v == null ? '' : v).trim();
const sansTrouFinal = (a) => { const o = a.slice(); while (o.length && estTrou(o[o.length - 1])) o.pop(); return o; };
export const retirerDePile = (nums, idx, rows) => {
  const a = arr(nums).map((v) => String(v == null ? '' : v)); if (idx < 0 || idx >= a.length || estTrou(a[idx])) return null;
  const R = Math.max(1, Number(rows) || 1);
  const deb = Math.floor(idx / R) * R, fin = Math.min(deb + R, a.length);
  const col = a.slice(deb, fin); col.splice(idx - deb, 1);
  // La colonne garde sa hauteur : la place libérée passe EN HAUT de la colonne
  // (sauf pour la dernière colonne, qui raccourcit simplement).
  if (fin < a.length) col.push('');
  return sansTrouFinal([...a.slice(0, deb), ...col, ...a.slice(fin)]);
};
// ── UNE HAUTEUR PAR PILE (28 oct.) ──────────────────────────────────────────
// Julien : « une hauteur différente pour chaque pile ». `it.rows` reste le PAS
// de `nums` (la plus haute pile) ; `it.hauteurs[c]` = combien de cartons la
// pile c accepte (absent ⇒ `rows`, comme avant). Au-dessus de sa hauteur, une
// pile n'a que des places vides : aucun carton ne s'y pose.
export const hauteurPile = (rows, hauteurs, c) => {
  const R = Math.max(1, Number(rows) || 1), h = Number(arr(hauteurs)[c]);
  return Number.isInteger(h) && h >= 1 ? Math.min(R, h) : R;
};
// Ajouter un carton : il comble le premier TROU (le haut d'une colonne
// entamée), sinon il se pose au-dessus de la dernière colonne. Avec `rows`, une
// place au-dessus de la hauteur de SA pile n'est jamais un trou à combler ; si
// toutes les piles sont pleines, une nouvelle pile commence.
export const ajouterAPile = (nums, num, rows, hauteurs) => {
  const v = String(num == null ? '' : num).trim(); if (!v) return null;
  const a = arr(nums).map((x) => String(x == null ? '' : x));
  if (rows == null) {
    const t = a.findIndex(estTrou);
    if (t >= 0) { a[t] = v; return a; }
    return [...a, v];
  }
  const R = Math.max(1, Number(rows) || 1), cols = Math.max(1, Math.ceil(a.length / R));
  for (let c = 0; c < cols; c++) {
    const h = hauteurPile(R, hauteurs, c);
    for (let p = 0; p < h; p++) {
      const i = c * R + p;
      if (i >= a.length || estTrou(a[i])) { while (a.length < i) a.push(''); a[i] = v; return a; }
    }
  }
  while (a.length < cols * R) a.push('');
  return [...a, v];
};
// Changer la hauteur de UNE pile : chaque carton garde sa pile et sa place
// depuis le bas ; les autres piles ne bougent pas. Refusé si la pile porte un
// carton plus haut que la nouvelle hauteur. Rend { nums, rows, hauteurs } —
// `hauteurs` vaut null quand toutes les piles ont la même hauteur.
export const changerHauteurPile = (nums, rows, hauteurs, c, h) => {
  const a = arr(nums).map((x) => String(x == null ? '' : x));
  const R = Math.max(1, Number(rows) || 1), cols = Math.max(1, Math.ceil(a.length / R));
  const nh = Math.round(Number(h));
  if (!(c >= 0 && c < cols)) return { erreur: 'Cette pile n\'existe pas.' };
  if (!(nh >= 1 && nh <= 40)) return { erreur: 'Une pile fait entre 1 et 40 cartons.' };
  const col = a.slice(c * R, c * R + R);
  let haut = -1; col.forEach((x, p) => { if (!estTrou(x)) haut = p; });
  if (haut + 1 > nh) return { erreur: `Cette pile porte ${haut + 1} carton${haut ? 's' : ''} : retire d'abord ceux du haut.` };
  const hs = Array.from({ length: cols }, (_, k) => (k === c ? nh : hauteurPile(R, hauteurs, k)));
  const R2 = Math.max(...hs);
  const out = [];
  for (let k = 0; k < cols; k++) {
    const part = a.slice(k * R, k * R + R);
    for (let p = 0; p < R2; p++) out.push(p < part.length ? part[p] : '');
  }
  return { nums: sansTrouFinal(out), rows: R2, hauteurs: hs.every((x) => x === R2) ? null : hs };
};
// Les cartons réellement là (sans les places vides).
export const cartonsDePile = (nums) => arr(nums).map((v) => String(v == null ? '' : v).trim()).filter(Boolean);

// ── LA PROCHAINE PLACE LIBRE D'UN MEUBLE ─────────────────────────────────────
// Pour ranger en un geste : la place où poser le prochain article. Plateau
// (étagère, table) : le plateau du BAS d'abord, de gauche à droite, une case
// qui n'est pas pleine. Portant : le premier cintre libre. Mur de boîtes : le
// bas de la première colonne qui a de la place. Rend { cell } ou null (plein).
// Ne décide aucun numéro : seulement OÙ.
export const prochainePlaceMeuble = (it, ft, wallH = 3.4) => {
  if (!it || !ft || ft.deco || ft.box || ft.pile) return null;
  const nr = Math.max(1, it.rows || 1), nc = Math.max(1, it.cols || 1), slots = it.slots || {};
  const m = modeCase(ft), capR = (r) => capaciteCase(ft, it, wallH, r);
  const n = (k) => nettoie(slots[k]).length;
  if (m === 'colonne') {
    for (let c = 0; c < nc; c++) for (let r = nr - 1; r >= 0; r--) { const k = r + '_' + c; if (!n(k)) return { cell: k }; }
    return null;
  }
  const pl = plateauxMeuble(it, ft);
  for (let r = nr - 1; r >= 0; r--) for (let c = 0; c < nc; c++) {
    const k = r + '_' + c; if (n(k) >= capR(r)) continue;
    // Pas une case au-dessus d'un plateau qui manque tant que celle du dessous a de la place.
    if (pl && r < nr - 1 && !pl.has((r + 1) + ':' + (c + 1)) && n((r + 1) + '_' + c) < capR(r + 1)) continue;
    return { cell: k };
  }
  return null;
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

// ── L'ASSISTANT « CRÉER MA PIÈCE » (26 oct.) ────────────────────────────────
// Julien : « on n'a pas d'agent qui aide pour créer la pièce ». Trois réponses
// (la taille de la pièce, le meuble, combien d'articles) donnent une PROPOSITION
// qu'il voit avant de la poser. Une règle fixe, sans IA, sans rien de payant :
//  · une porte au milieu du mur de devant, et 1 m libre devant elle ;
//  · des rangées de meubles le dos au mur du fond, puis au mur de devant
//    (tournés vers la pièce), puis au milieu, chaque rangée avec 1 m d'allée
//    devant elle ;
//  · un meuble ne se pose que là où il tient sans rien traverser (`rectDans`,
//    `chevauche` — les mêmes règles que le glisser), aligné, à 10 cm d'écart.
// Ce qui ne tient pas est DIT (`manque`) : on ne pose jamais en travers.
// Rend { meubles: [{ cx, cy, rot }], porte: { cx, cy, rot }, capacite, manque }.
export const ALLEE = 1.0;
export const proposerPiece = ({ w, h, mw, md, cap, besoin, max = 40 }) => {
  const W = Math.max(1.5, Math.min(40, Number(w) || 0)), H = Math.max(1.5, Math.min(40, Number(h) || 0));
  const poly = rectPoly(W, H);
  const capM = Math.max(1, Math.floor(Number(cap) || 1));
  const voulu = Math.max(1, Math.min(max, Math.ceil(Math.max(1, Number(besoin) || 0) / capM)));
  const porte = { cx: r2(W / 2), cy: r2(H - 0.18), rot: Math.PI };
  const obstacles = [{ cx: W / 2, cy: H - 0.18, w: 1.0, h: 0.36 }, { cx: W / 2, cy: H - 0.35 - ALLEE / 2, w: 1.2, h: ALLEE }];
  const meubles = [];
  const rangee = (cy, rot) => {
    const pas = mw + 0.1;
    for (let cx = 0.1 + mw / 2; cx + mw / 2 <= W - 0.1 + 1e-6 && meubles.length < voulu; cx += pas) {
      const r = { cx: r2(cx), cy: r2(cy), w: mw, h: md };
      if (!rectDans(r.cx, r.cy, mw, md, poly) || obstacles.some((o) => chevauche(r, o))) continue;
      meubles.push({ cx: r.cx, cy: r.cy, rot }); obstacles.push(r);
    }
  };
  // Le fond, puis le mur de devant (si une allée tient entre les deux).
  rangee(0.05 + md / 2, 0);
  if (H - 2 * (md + 0.05) >= ALLEE) rangee(H - 0.05 - md / 2, Math.PI);
  // Puis le milieu : une rangée tous les (profondeur + allée), sans mordre sur
  // l'allée de la rangée du mur de devant.
  for (let cy = 0.05 + md / 2 + md + ALLEE; cy + md / 2 <= H - 0.05 - md - ALLEE + 1e-6 && meubles.length < voulu; cy += md + ALLEE) rangee(cy, 0);
  const capacite = meubles.length * capM;
  return { meubles, porte, capacite, manque: Math.max(0, (Number(besoin) || 0) - capacite), voulu };
};

// ── (28 oct.) UN ARTICLE, UNE FOIS — ET LES ARTICLES DE TOUTES LES PLATEFORMES ──
// Julien : « il faut qu'il n'y ait que les articles différents de toutes les
// plateformes » — les deux sens, sa réponse : (1) une paire en vente à la fois
// sur Vinted, Leboncoin et eBay n'apparaît qu'UNE fois dans « À ranger » ;
// (2) une paire qui n'est QUE sur Leboncoin ou eBay y apparaît aussi.
// L'identité d'une paire hors Vinted est son N° LU PAR IDENTITÉ (§5) : le SKU
// « VRM-{n°} » d'eBay, le lien posé à la main ou la référence VRM de Leboncoin —
// calculés par l'app (`numEbayLu`, `numeroLbcIdentite`), jamais un titre. Une
// annonce sans N° ne désigne aucune paire : elle n'est pas proposée (on range
// un carton par son numéro), elle est seulement comptée (`sansNumero`).
// `vendusPartis` (clés) : N° dont la vente est prouvée et le colis parti — une
// annonce eBay/Leboncoin restée en ligne n'en refait pas une paire présente.
// Rend { articles: [{ numero, cle, title, photo, plateformes }], sansNumero }.
export const articlesAutresPlateformes = ({ ebay, lbc, cle, vendusPartis }) => {
  const par = new Map(); const sans = { ebay: 0, leboncoin: 0 };
  const ajoute = (liste, plat) => {
    for (const a of arr(liste)) {
      const n = a && a.numero != null ? String(a.numero).trim() : '';
      const k = n ? cle(n) : '';
      if (!k) { sans[plat] += 1; continue; }
      if (vendusPartis && vendusPartis.has(k)) continue;
      const x = par.get(k) || { numero: n, cle: k, title: '', photo: null, plateformes: [] };
      if (!x.title && a.title) x.title = String(a.title);
      if (!x.photo && a.photo) x.photo = String(a.photo);
      if (!x.plateformes.includes(plat)) x.plateformes.push(plat);
      par.set(k, x);
    }
  };
  ajoute(ebay, 'ebay'); ajoute(lbc, 'leboncoin');
  return { articles: [...par.values()], sansNumero: sans };
};

// Une liste de fiches → un élément par ARTICLE. Deux fiches au même N° (clé)
// sont le même carton ; deux fiches à la même PHOTO EXACTE (`clePhoto`, le
// fichier — §5, « une paire, une proposition » du 17 oct.) sont la même paire
// sous deux numéros : elle n'apparaît qu'une fois, avec les autres N° dans
// `aussi`, et si l'un d'eux est déjà rangé (`estRangee`), aucun n'est proposé.
// L'ordre d'entrée est gardé ; le premier de chaque groupe représente l'article.
export const unParArticle = (liste, { cle, clePhoto, estRangee } = {}) => {
  const l = arr(liste).filter((f) => f && cle(f.numero));
  const parent = l.map((_, i) => i);
  const racine = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  const lie = (i, j) => { parent[racine(i)] = racine(j); };
  const parCle = new Map(), parPhoto = new Map();
  l.forEach((f, i) => {
    const k = cle(f.numero);
    if (parCle.has(k)) lie(i, parCle.get(k)); else parCle.set(k, i);
    const p = clePhoto ? clePhoto(f.photo) : '';
    if (p) { if (parPhoto.has(p)) lie(i, parPhoto.get(p)); else parPhoto.set(p, i); }
  });
  const groupes = new Map();
  l.forEach((f, i) => { const r = racine(i); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(f); });
  const out = [];
  for (const g of groupes.values()) {
    if (estRangee && g.some((f) => estRangee(f))) continue;
    const t = g[0];
    const plats = [...new Set(g.flatMap((f) => arr(f.plateformes)))];
    const aussi = [...new Set(g.map((f) => String(f.numero).trim()).filter((n) => cle(n) !== cle(t.numero)))];
    out.push({ ...t, plateformes: plats, aussi });
  }
  return out;
};
