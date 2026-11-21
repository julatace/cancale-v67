// ── LE STOCK EN ÉTAGÈRES : MEUBLES LIBRES, COULEURS, PILES (15 nov. 2026) ──────
// Julien : « qu'on puisse vraiment faire le nombre de cases que l'on veut, représenter
// comme on veut notre stock, mettre des couleurs aux cases pour faire des étagères ;
// la règle pour une pile de boîtes : si on enlève celle tout en bas, celles du dessus
// descendent toutes seules ; que les numéros soient bien attribués. »
//
// Module PUR (aucun accès au navigateur ni à la base) : l'écran Stock (`StockMeubles`),
// la sortie automatique (`libererCasesPartis`, src/stockSortie.js), « Enlever du stock »
// (src/cycleArticle.js), « Vendu ailleurs » (src/venteAilleurs.js), « Où ranger »
// (src/ouRanger.js, src/rangementArrivee.js) et `scripts/audit-stock-etageres.cjs`
// exécutent les MÊMES fonctions (§11 : une règle, un propriétaire).
//
// LE MODÈLE — les clés d'hier, rien de renommé (`vrm_meubles`, `vrm_slots`, SYNC_KEYS de
// la ligne `main` : la fusion à trois voies et le comparer-et-échanger sur `data.rev` de
// `cloudPush`). Un meuble est l'objet d'hier, AUGMENTÉ de champs facultatifs :
//   { id, name, cols, rows, planches?, gravite?,          ← la forme d'hier, lue telle quelle
//     type?:    'etagere'|'armoire'|'casier'|'pile'|'bac' (absent ⇒ « étagère »)
//     couleur?: un nom de la palette (le meuble entier)
//     couleurs?: { 'rangée:colonne': nom }                (une case ; 1 = en haut / à gauche)
//     piles?:   [colonne, …]                              (colonnes empilées ; 1 = la gauche)
//     ordre?:   nombre                                    (sa place dans la pièce) }
// `vrm_slots` ne change pas : { [cleNum]: { m, i } }. Les couleurs sont rangées par
// « rangée:colonne » (et non par l'index de case) : changer le nombre de colonnes ne
// repeint pas la mauvaise case.
// ⚠️ LA MIGRATION n'en est pas une : l'ancienne forme EST la nouvelle sans ses champs
//    facultatifs. Aucune place ne bouge à la lecture ; rien n'est réécrit tant qu'il ne
//    fait pas un geste ; un geste réécrit le meuble d'origine augmenté de ce qu'il change
//    (`{ ...ancien, ...changé }`), jamais une copie « normalisée » (aucun drapeau
//    `localStorage`, §5).
//
// ⚠️⚠️ LA RÈGLE DES PILES (la gravité). Une colonne est « en pile » si le meuble entier
//    l'est (`gravite`, ou `type: 'pile'`) ou si elle est nommée dans `piles`. Dans une
//    telle colonne, entre deux planches, un article pose sur celui du dessous : un vide
//    se comble par le haut, d'un cran par case vidée, dans l'ordre (rien ne passe
//    par-dessus un autre).
//    • Une case est OCCUPÉE dès qu'une entrée de `vrm_slots` la désigne — que la paire
//      soit montrée ou non (compte écarté, lecture pas encore arrivée, plus en ligne,
//      vendue pas encore partie). Avant (28 oct.), seules les paires MONTRÉES comptaient :
//      une paire d'un compte écarté, ou toutes pendant le chargement, « disparaissaient »
//      et celles du dessus descendaient à travers son carton — une sortie que rien ne
//      prouvait. « Pas su » ne vaut pas « parti » (§5).
//    • Une case ne se VIDE que par un fait prouvé : la sortie automatique d'un colis PARTI
//      (`venteSortieDuStock`, `libererCasesPartis`), ou SON clic (Retirer de la case, Je
//      l'ai sortie, Enlever du stock, Vendu ailleurs, Déplacer). Ici on ne vide rien :
//      on tasse ce qui est déjà vide.
//    • C'est l'EMPLACEMENT qui change (`i`), JAMAIS le numéro (§5 : il est écrit sur un
//      carton). Chaque mouvement est rendu (`descentes`) pour que l'app le DISE.

import { planchesCases } from './stockRegles.js';

export const COLS_MAX = 30;
export const RANGEES_MAX = 50;
// La palette : sobre, nommée, lisible le jour et la nuit (les teintes vivent dans
// src/styles-etageres.css). Jamais le rouge (réservé au doublon de N°), jamais le violet.
export const COULEURS = ['ciel', 'lagon', 'sauge', 'sable', 'terre', 'ardoise'];
// Les formes de meuble : un point de départ (dimensions proposées), rien d'imposé.
export const TYPES = {
  etagere: { cols: 4, rows: 3, pile: false },
  armoire: { cols: 3, rows: 5, pile: false },
  casier: { cols: 6, rows: 4, pile: false },
  pile: { cols: 1, rows: 5, pile: true },
  bac: { cols: 4, rows: 1, pile: false },
};
export const TYPES_ORDRE = ['etagere', 'armoire', 'casier', 'pile', 'bac'];

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const entier = (v, min, max, def) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def; };
export const couleurValide = (c) => (typeof c === 'string' && COULEURS.includes(c) ? c : null);
export const typeDe = (m) => (m && typeof m.type === 'string' && TYPES[m.type] ? m.type : 'etagere');
const dims = (m) => ({ cols: Math.max(1, Math.floor(Number(m && m.cols)) || 1), rows: Math.max(1, Math.floor(Number(m && m.rows)) || 1) });
export const bornerCols = (v) => entier(v, 1, COLS_MAX, 1);
export const bornerRangees = (v) => entier(v, 1, RANGEES_MAX, 1);

// ── LES COLONNES EN PILE ──────────────────────────────────────────────────────
// Rend l'ensemble des colonnes (1 = la gauche) dont les articles posent sur celui du dessous.
export function colonnesEnPile(m) {
  const out = new Set();
  if (!m) return out;
  const { cols } = dims(m);
  if (m.gravite === true || m.type === 'pile') { for (let c = 1; c <= cols; c++) out.add(c); return out; }
  for (const x of (Array.isArray(m.piles) ? m.piles : [])) { const c = Math.floor(Number(x)); if (c >= 1 && c <= cols) out.add(c); }
  return out;
}
export const colonneEnPile = (m, c) => colonnesEnPile(m).has(Number(c));
export const aDesPiles = (m) => colonnesEnPile(m).size > 0;

// ── LES COULEURS ──────────────────────────────────────────────────────────────
export const cleCase = (i, m) => { const { cols } = dims(m); return `${Math.floor(i / cols) + 1}:${(i % cols) + 1}`; };
// La couleur d'une case : la sienne, sinon celle du meuble, sinon aucune.
export function couleurCase(m, i) {
  if (!m) return { couleur: null, propre: false };
  const propre = estObjet(m.couleurs) ? couleurValide(m.couleurs[cleCase(i, m)]) : null;
  if (propre) return { couleur: propre, propre: true };
  return { couleur: couleurValide(m.couleur), propre: false };
}
// Peindre des cases (« rangée:colonne ») d'une couleur, ou les rendre à la couleur du
// meuble (`null`). Rend le NOUVEL objet `couleurs` (les autres cases gardent la leur).
export function peindre(couleurs, cles, couleur) {
  const out = estObjet(couleurs) ? { ...couleurs } : {};
  const c = couleurValide(couleur);
  for (const k of (Array.isArray(cles) ? cles : [])) { if (!/^\d+:\d+$/.test(String(k))) continue; if (c) out[k] = c; else delete out[k]; }
  return out;
}
// Les couleurs de cases qui sortent du meuble (moins de rangées ou de colonnes) sont
// oubliées à l'enregistrement ; les autres restent sur LEUR rangée et LEUR colonne.
export function couleursDans(couleurs, cols, rows) {
  const out = {};
  if (!estObjet(couleurs)) return out;
  for (const [k, v] of Object.entries(couleurs)) {
    const mm = /^(\d+):(\d+)$/.exec(k); if (!mm || !couleurValide(v)) continue;
    if (+mm[1] >= 1 && +mm[1] <= rows && +mm[2] >= 1 && +mm[2] <= cols) out[k] = v;
  }
  return out;
}

// ── L'ORDRE DES MEUBLES ───────────────────────────────────────────────────────
// Le champ `ordre` (sinon la place dans la liste) : un déplacement se fusionne champ par
// champ entre deux appareils (la liste, elle, garde l'ordre du nuage).
export function ordonner(meubles) {
  const l = Array.isArray(meubles) ? meubles.filter((m) => m && m.id != null) : [];
  return l.map((m, k) => [m, Number.isFinite(Number(m.ordre)) && m.ordre !== null && m.ordre !== '' ? Number(m.ordre) : k, k])
    .sort((a, b) => (a[1] - b[1]) || (a[2] - b[2])).map((x) => x[0]);
}
// Monter (-1) ou descendre (+1) un meuble dans la pièce. Rend la nouvelle liste (chaque
// meuble garde ses champs, `ordre` = sa nouvelle place) ou `null` s'il ne peut pas bouger.
export function deplacerMeuble(meubles, id, sens) {
  const l = ordonner(meubles);
  const k = l.findIndex((m) => String(m.id) === String(id));
  const j = k + (sens < 0 ? -1 : 1);
  if (k < 0 || j < 0 || j >= l.length) return null;
  const tri = l.slice(); const x = tri[k]; tri[k] = tri[j]; tri[j] = x;
  const place = new Map(tri.map((m, n) => [String(m.id), n]));
  return (Array.isArray(meubles) ? meubles : []).map((m) => (m && m.id != null && place.has(String(m.id)) ? { ...m, ordre: place.get(String(m.id)) } : m));
}

// (16 nov., lot design-restes) « Monter / descendre » AU DOIGT : le meuble glissé est posé au rang `vers` (0 = en haut),
// les autres gardent leur ordre relatif. Même écriture que les touches (`ordre` seulement) ; rien ne bouge ⇒ null.
export function placerMeuble(meubles, id, vers) {
  const l = ordonner(meubles);
  const k = l.findIndex((m) => String(m.id) === String(id));
  if (k < 0 || !Number.isFinite(Number(vers))) return null;
  const j = Math.max(0, Math.min(l.length - 1, Math.round(Number(vers))));
  if (j === k) return null;
  const tri = l.slice(); const [x] = tri.splice(k, 1); tri.splice(j, 0, x);
  const place = new Map(tri.map((m, n) => [String(m.id), n]));
  return (Array.isArray(meubles) ? meubles : []).map((m) => (m && m.id != null && place.has(String(m.id)) ? { ...m, ordre: place.get(String(m.id)) } : m));
}

// ── LA GRAVITÉ ────────────────────────────────────────────────────────────────
// Tasse chaque colonne en pile de chaque meuble. Rend { slots, descentes } ; `slots` est
// le MÊME objet si rien ne bouge. `descentes` : [{ cle, m, de, a, crans }] (de/a = index
// de case ; crans = rangées descendues), du bas vers le haut.
export function tasserPiles(slots, meubles) {
  if (!estObjet(slots) || !Array.isArray(meubles)) return { slots, descentes: [] };
  // Une case est occupée dès qu'une entrée la désigne (montrée ou non).
  const parMeuble = new Map();
  for (const k of Object.keys(slots)) {
    const s = slots[k]; if (!s || s.m == null) continue;
    const i = Number(s.i); if (!Number.isInteger(i) || i < 0) continue;
    const id = String(s.m);
    if (!parMeuble.has(id)) parMeuble.set(id, new Map());
    const mm = parMeuble.get(id); if (!mm.has(i)) mm.set(i, []); mm.get(i).push(k);
  }
  let out = slots; const descentes = [];
  for (const m of meubles) {
    if (!m || m.id == null) continue;
    const piles = colonnesEnPile(m); if (!piles.size) continue;
    const occ = parMeuble.get(String(m.id)); if (!occ) continue;
    const { cols, rows } = dims(m);
    const pl = planchesCases(m.planches, cols, rows);
    for (const c of [...piles].sort((a, b) => a - b)) {
      const c0 = c - 1;
      const bornes = [0];
      for (let r = 1; r < rows; r++) if (pl.has(r + ':' + c)) bornes.push(r);
      bornes.push(rows);
      for (let b = 0; b < bornes.length - 1; b++) {
        const haut = bornes[b], bas = bornes[b + 1] - 1;
        const tas = [];                                   // du bas vers le haut
        for (let r = bas; r >= haut; r--) { const ks = occ.get(r * cols + c0); if (ks) tas.push([ks, r]); }
        tas.forEach(([ks, r0], j) => {
          const r1 = bas - j; if (r1 === r0) return;
          if (out === slots) out = { ...slots };
          for (const k of ks) { out[k] = { ...slots[k], i: r1 * cols + c0 }; descentes.push({ cle: k, m: String(m.id), de: r0 * cols + c0, a: r1 * cols + c0, crans: r1 - r0 }); }
        });
      }
    }
  }
  return { slots: out, descentes };
}

// Seuls les meubles TOUCHÉS se tassent : une case vidée dans l'un ne fait rien bouger ailleurs.
const dansMeubles = (meubles, ids) => { const set = new Set(ids.filter((x) => x != null).map(String)); return (Array.isArray(meubles) ? meubles : []).filter((m) => m && set.has(String(m.id))); };
// Les meubles qu'une écriture des cases touche : une entrée posée, retirée ou déplacée
// (son ancien ET son nouveau meuble), et ceux nommés (`ids` : un meuble qu'il vient de régler).
export function meublesTouches(avant, apres, ids = []) {
  const A = estObjet(avant) ? avant : {}, B = estObjet(apres) ? apres : {};
  const out = new Set((Array.isArray(ids) ? ids : []).filter((x) => x != null).map(String));
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k], b = B[k];
    if (a && b && String(a.m) === String(b.m) && Number(a.i) === Number(b.i)) continue;
    if (a && a.m != null) out.add(String(a.m));
    if (b && b.m != null) out.add(String(b.m));
  }
  return out;
}
// Une écriture des cases par SON geste : on tasse les meubles qu'elle touche. Rend { slots, descentes, chutes } :
// `descentes` = les cartons qui étaient DÉJÀ là et sont descendus (à dire) ; `chutes` = la paire qu'il vient de poser
// ou de déplacer, tombée jusqu'au carton du dessous (sa case finale est dite par le message de la pose).
export function tasserApres(avant, apres, meubles, ids = []) {
  const t = meublesTouches(avant, apres, ids);
  if (!t.size) return { slots: apres, descentes: [], chutes: [] };
  const r = tasserPiles(apres, dansMeubles(meubles, [...t]));
  const A = estObjet(avant) ? avant : {};
  const pose = (k) => { const a = A[k], b = apres[k]; return !a || !b || String(a.m) !== String(b.m) || Number(a.i) !== Number(b.i); };
  return { slots: r.slots, descentes: r.descentes.filter((d) => !pose(d.cle)), chutes: r.descentes.filter((d) => pose(d.cle)) };
}

// Vider des cases (SON clic, ou une sortie PROUVÉE décidée ailleurs) puis tasser.
// Rend { slots, sortis: [{ cle, m, i }], descentes }.
export function sortirDeCases({ slots, meubles, cles } = {}) {
  if (!estObjet(slots)) return { slots, sortis: [], descentes: [] };
  let u = slots; const sortis = [];
  for (const k of (Array.isArray(cles) ? cles : [])) {
    if (k == null || !Object.prototype.hasOwnProperty.call(u, k)) continue;
    if (u === slots) u = { ...slots };
    const s = u[k]; delete u[k];
    sortis.push({ cle: k, m: s && s.m != null ? String(s.m) : null, i: s ? Number(s.i) : null });
  }
  if (!sortis.length) return { slots, sortis, descentes: [] };
  const t = tasserPiles(u, dansMeubles(meubles, sortis.map((x) => x.m)));
  return { slots: t.slots, sortis, descentes: t.descentes };
}

// Les mêmes, en OPÉRATIONS de geste annulable (src/gesteAnnulable.js) : la case vidée,
// puis chaque descente — « Annuler » rend tout (le carton sorti ET ceux qui sont descendus).
export function opsSortieCases({ slots, meubles, cles } = {}) {
  const S = estObjet(slots) ? slots : {};
  const r = sortirDeCases({ slots: S, meubles, cles });
  const ops = r.sortis.map((x) => ({ k: 'vrm_slots', type: 'cle', id: x.cle, apres: undefined, avant: S[x.cle] }));
  for (const d of r.descentes) ops.push({ k: 'vrm_slots', type: 'cle', id: d.cle, apres: r.slots[d.cle], avant: S[d.cle], crans: d.crans });
  return { ops, descentes: r.descentes };
}

// Les N° descendus (une fois chacun, du bas vers le haut), pour la phrase de l'écran.
export const clesDescendues = (descentes) => [...new Set((Array.isArray(descentes) ? descentes : []).map((d) => d && d.cle).filter((k) => k != null))];

// ── LECTURE TOLÉRANTE ─────────────────────────────────────────────────────────
// Ce que l'écran DESSINE d'un meuble (jamais réécrit tel quel) : dimensions bornées à
// au moins 1, type, couleur et piles lus s'ils sont valides — une valeur abîmée se lit
// comme absente, elle ne fait jamais tomber l'écran.
export function lireMeuble(m) {
  if (!m || m.id == null) return null;
  const { cols, rows } = dims(m);
  return {
    id: m.id, name: String(m.name == null || m.name === '' ? 'Meuble' : m.name), cols, rows,
    planches: Array.isArray(m.planches) ? m.planches : undefined, gravite: m.gravite === true,
    type: typeDe(m), couleur: couleurValide(m.couleur), couleurs: couleursDans(m.couleurs, cols, rows),
    piles: [...colonnesEnPile({ ...m, gravite: false, type: m.type === 'pile' ? 'pile' : undefined })].sort((a, b) => a - b),
  };
}
