// ── LA NÉGOCIATION PAR PALIERS — les RÈGLES (pas d'IA), 19 nov. soir ─────────────────────────────────────────────────────
// Julien (capture d'un outil de vendeur, « Conversations auto · Négociations ») : une marge minimale (le plancher), des
// paliers de contre-offre qui convergent vers le plancher, l'aperçu « 100 → 93 → 88 → 85 · plancher 85 », une marge par
// tranche de prix, un bonus de lot, l'arrondi. Le plancher d'un article est SON prix mini (posé à côté du N°) quand il en a
// un — il est prioritaire ; sinon le prix affiché moins la marge.
// ⚠️ Ces réglages sont rangés (`vinted_offres_nego`, synchronisés) ; le moteur d'offres existant (accepter ≥ mini, refuser
// sous le seuil, éteint par défaut, garde-fous inchangés) ne fait PAS encore de contre-offre : l'écran le dit « bientôt »
// et RIEN n'est envoyé tant que l'extension ne sait pas le faire. Module PUR.
export const CLE_NEGO = 'vinted_offres_nego';
export const ARRONDIS = ['unite', 'demi', 'aucun'];
export const NEGO_DEFAUT = Object.freeze({ v: 1, marge: 15, paliers: [{ pct: 50, message: '' }, { pct: 80, message: '' }, { pct: 100, message: '' }], tranches: [], lots: [], arrondi: 'unite' });
const ent = (v, a, b) => { const n = Number(v); return Number.isInteger(n) && n >= a && n <= b ? n : null; };
// La valeur LUE (une carte absente ou abîmée ⇒ le défaut, jamais une valeur inventée ailleurs).
export function negoLue(x) {
  const o = x && typeof x === 'object' && x.v === 1 ? x : null;
  if (!o) return { ...NEGO_DEFAUT, paliers: NEGO_DEFAUT.paliers.map((p) => ({ ...p })) };
  const marge = ent(o.marge, 1, 90) ?? NEGO_DEFAUT.marge;
  const paliers = (Array.isArray(o.paliers) ? o.paliers : []).map((p) => ({ pct: ent(p && p.pct, 1, 100), message: String((p && p.message) || '').slice(0, 300) })).filter((p) => p.pct != null).slice(0, 6);
  const tranches = (Array.isArray(o.tranches) ? o.tranches : []).map((t) => ({ jusqua: ent(t && t.jusqua, 1, 100000), marge: ent(t && t.marge, 1, 90) })).filter((t) => t.jusqua != null && t.marge != null).slice(0, 6);
  const lots = (Array.isArray(o.lots) ? o.lots : []).map((l) => ({ articles: ent(l && l.articles, 2, 20), plus: ent(l && l.plus, 1, 50) })).filter((l) => l.articles != null && l.plus != null).slice(0, 4);
  return { v: 1, marge, paliers: paliers.length ? paliers : NEGO_DEFAUT.paliers.map((p) => ({ ...p })), tranches, lots, arrondi: ARRONDIS.includes(o.arrondi) ? o.arrondi : 'unite' };
}
// Ce qui se range (les paliers triés, croissants ; un palier à 100 % = le plancher).
export function negoARanger(r) { const x = negoLue({ ...r, v: 1 }); return { ...x, paliers: [...x.paliers].sort((a, b) => a.pct - b.pct), tranches: [...x.tranches].sort((a, b) => a.jusqua - b.jusqua), lots: [...x.lots].sort((a, b) => a.articles - b.articles) }; }
const arrondir = (v, a) => (a === 'unite' ? Math.round(v) : a === 'demi' ? Math.round(v * 2) / 2 : Math.round(v * 100) / 100);
// La marge d'un prix : la première tranche qui le contient, sinon la marge par défaut ; + le bonus du lot.
export function margeDe(r, prix, articles = 1) {
  const t = r.tranches.find((x) => prix <= x.jusqua);
  const b = r.lots.filter((l) => articles >= l.articles).reduce((m, l) => Math.max(m, l.plus), 0);
  return Math.min(90, (t ? t.marge : r.marge) + b);
}
// L'aperçu : le prix affiché, chaque contre-offre, le plancher. `mini` (le prix mini du N°) est prioritaire.
export function apercuNego(r0, prix = 100, { mini = null, articles = 1 } = {}) {
  const r = negoLue({ ...r0, v: 1 });
  const plancher = mini != null && mini > 0 && mini <= prix ? mini : arrondir(prix * (1 - margeDe(r, prix, articles) / 100), r.arrondi);
  const etapes = [...r.paliers].sort((a, b) => a.pct - b.pct).map((p) => Math.max(plancher, arrondir(prix - (prix - plancher) * p.pct / 100, r.arrondi)));
  return { prix, plancher, etapes, deMini: mini != null && mini > 0 && mini <= prix };
}
