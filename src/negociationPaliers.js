// ═══════════════════════════════════════════════════════════════════════════
// LA NÉGOCIATION PAR PALIERS (19 nov., ext. 5.409) — règles PURES, sans IA
// ═══════════════════════════════════════════════════════════════════════════
// Julien (captures de l'outil de référence) : une offre reçue SOUS son prix mini reçoit une CONTRE-OFFRE,
// palier par palier, vers un PLANCHER — jamais en dessous.
//   · plancher = le prix mini posé à côté du N° (`vinted_annonce_numeros[id].min`) s'il existe ; sinon le prix
//     moins sa REMISE MAXIMALE en % (`remiseMax`) ; ni l'un ni l'autre ⇒ pas de plancher ⇒ rien n'est proposé ;
//   · palier i = prix − (prix − plancher) × pct_i / 100, arrondi à l'euro (si `arrondi`), JAMAIS sous le plancher,
//     strictement décroissant (deux paliers égaux n'en font qu'un) ;
//   · aperçu « 100 → 93 → 88 → 85 · plancher 85 » ;
//   · une contre-offre PAR PALIER et PAR NÉGOCIATION (n° de transaction), dans l'ordre ; jamais une contre-offre
//     sous (ou égale à) l'offre de l'acheteur : elle serait pire pour lui que ce qu'il propose — on n'y touche pas.
// 5.410.4 (« comme Bleam / Vintex ») : tranches de prix (« de X € à Y € : baisse max Z € »), bonus de lot, arrondi
// 1 € / 0,50 €, « rester flexible » (accepter si l'écart au palier ≤ N €), étape FINALE (= le plancher) dite, et le
// plancher ABSOLU : le prix mini, sinon l'achat + 10 % — une tranche ou une marge ne descend JAMAIS en dessous.
// Réglage `vinted_offres_paliers` (synchronisé, l'app en est propriétaire, l'extension le LIT) : éteint par défaut.
// ⚠️ La MÊME règle vit dans background.js (`palierContreOffre`) : `scripts/audit-negociation-paliers.cjs` exécute
//    les deux sur la même table de cas et exige des réponses identiques.
// ═══════════════════════════════════════════════════════════════════════════
export const CLE_PALIERS = 'vinted_offres_paliers';
export const PALIERS_DEFAUT = Object.freeze({ actif: false, remiseMax: null, paliers: [50, 80, 100], messages: [], arrondi: true });
const PALIERS_MAX = 6, MESSAGES_MAX = 5;

export function reglagesPaliers(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const pcts = (Array.isArray(o.paliers) ? o.paliers : PALIERS_DEFAUT.paliers).map(Number).filter((x) => Number.isFinite(x) && x > 0 && x <= 100);
  const uniques = [...new Set(pcts.map((x) => Math.round(x)))].sort((a, b) => a - b).slice(0, PALIERS_MAX);
  const rm = Number(o.remiseMax);
  const tranches = (Array.isArray(o.tranches) ? o.tranches : []).map((x) => ({ de: Number(x && x.de), a: Number(x && x.a), baisse: Number(x && x.baisse) }))
    .filter((x) => Number.isFinite(x.de) && Number.isFinite(x.a) && Number.isFinite(x.baisse) && x.de >= 0 && x.a > x.de && x.baisse > 0 && x.baisse < x.a).sort((a, b) => a.de - b.de).slice(0, 8);
  const bl = Number(o.bonusLot);
  const fx = o.flexible && typeof o.flexible === 'object' && o.flexible.actif === true ? Number(o.flexible.ecart) : NaN;
  return {
    actif: o.actif === true,
    remiseMax: Number.isFinite(rm) && rm > 0 && rm < 90 ? Math.round(rm) : null,
    paliers: uniques.length ? uniques : [...PALIERS_DEFAUT.paliers],
    messages: (Array.isArray(o.messages) ? o.messages : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, MESSAGES_MAX),
    arrondi: o.arrondi !== false,
    pas: Number(o.pas) === 0.5 ? 0.5 : 1,
    tranches,
    bonusLot: Number.isInteger(bl) && bl > 0 && bl <= 50 ? bl : 0,
    intelligente: o.intelligente === true,   // 5.437 : la descente intelligente (son choix ; éteinte par défaut)
    flexible: typeof o.flexible === 'number' ? (o.flexible > 0 && o.flexible <= 10 ? o.flexible : 0) : Number.isFinite(fx) ? (fx > 0 && fx <= 10 ? fx : 2) : (o.flexible && o.flexible.actif === true ? 2 : 0),   // déjà normalisé : un nombre
  };
}
// <nego-intelligente-regle> — recopié tel quel dans background.js (scripts/audit-nego-intelligente.cjs --recopie)
// 5.437 (Julien, 22 nov. : « négociation intelligente à partir du prix mini ») — LA CONTRE-OFFRE INTELLIGENTE, sans IA.
// Choisie par lui (`intelligente: true` dans SON réglage des paliers, éteinte par défaut comme les paliers). La même règle
// que les paliers pour le plancher (prix mini, sinon achat + 10 %, jamais dessous) ; ce qui change, c'est la DESCENTE :
//   · l'écart initial (prix − plancher) : petit (≤ 5 € ou ≤ 8 %) ⇒ directement le plancher, en un tour ;
//   · le nombre d'échanges : 3 tours (le dernier = le plancher) ; demande FORTE (≥ 10 favoris ou ≥ 200 vues) ⇒ 4 tours
//     et une descente lente au début ; annonce ANCIENNE (≥ 30 j) ou demande FAIBLE (≤ 1 favori et < 50 vues) ⇒ 2 tours,
//     descente plus rapide ;
//   · l'offre de l'acheteur : proche du plancher ⇒ un pas de plus vers lui ; jamais une contre-offre ≤ son offre ;
//   · le compte acheteur : note basse (< 3,5 ★) ⇒ on cède moins avant le dernier tour (l'acceptation auto d'un compte
//     1 étoile reste interdite par la garde de la note, inchangée) ;
//   · arrondis naturels : un prix rond (…9, …5, …0 au-dessus de 20 €, sinon l'euro), jamais sous le plancher, toujours
//     sous la contre-offre précédente (`dernier`).
// Rend { i, prix, plancher, finale, tours, raisons: [{ k, v }] } (les raisons vont au journal) ou null.
function niArrondi(raw, f, haut, pas) {
  if (pas !== 1 && pas !== 0.5) { const v = Math.max(f, Math.round(raw * 100) / 100); return v < haut ? v : null; }
  if (pas === 0.5) { let v = Math.round(raw * 2) / 2; if (v < f) v = Math.ceil(f * 2) / 2; return v < haut ? v : null; }
  const lo = Math.ceil(f - 1e-9), hi = Math.ceil(haut - 1e-9) - 1;
  if (hi < lo) return null;
  const tol = Math.max(1, raw * 0.02);
  let best = null;
  if (raw >= 20) for (let n = lo; n <= hi; n++) { if (![9, 5, 0].includes(n % 10)) continue; const d = Math.abs(n - raw); if (n - raw <= 1 && raw - n <= tol && (best == null || d < Math.abs(best - raw) - 1e-9)) best = n; }
  if (best == null) { best = Math.round(raw); if (best < lo) best = lo; if (best > hi) best = hi; }
  return best;
}
function palierIntelligent({ prix, plancher, offre, tour, dernier, jours, favoris, vues, note, pas }) {
  const p = Number(prix), f = Number(plancher), o = Number(offre);
  if (!(p > 0) || !(f > 0) || !(f < p)) return null;
  const E = Math.round((p - f) * 100) / 100;
  const raisons = [{ k: 'ecart', v: E }];
  const fav = Number(favoris), vu = Number(vues);
  const demande = (Number.isFinite(fav) && fav >= 10) || (Number.isFinite(vu) && vu >= 200) ? 'forte'
    : Number.isFinite(fav) && Number.isFinite(vu) && fav <= 1 && vu < 50 ? 'faible' : 'normale';
  const ancienne = Number.isFinite(Number(jours)) && Number(jours) >= 30;
  let N = 3;
  if (E <= Math.max(5, p * 0.08)) N = 1;
  else { if (demande === 'forte') N = 4; if (ancienne || demande === 'faible') N = 2; }
  const t = Math.max(0, Math.floor(Number(tour) || 0));
  if (t >= N) return null;
  raisons.push({ k: 'tour', v: (t + 1) + '/' + N });
  if (demande !== 'normale') raisons.push({ k: 'demande', v: demande });
  if (ancienne) raisons.push({ k: 'annonce', v: 'ancienne' });
  const k = demande === 'forte' && !ancienne ? 1.4 : ancienne || demande === 'faible' ? 0.8 : 1;
  let c = Math.pow((t + 1) / N, k);
  const basse = note && Number(note.n) > 0 && Number(note.etoiles) > 0 && Number(note.etoiles) < 3.5;
  if (basse && t < N - 1) { c *= 0.8; raisons.push({ k: 'note', v: 'basse' }); }
  if (Number.isFinite(o) && o > 0 && t < N - 1) { const prox = Math.max(0, Math.min(1, (o - (f - E)) / E)); if (prox >= 0.6) { c = Math.min(1, c + 0.15 * prox); raisons.push({ k: 'offre', v: 'proche' }); } }
  const haut = Number(dernier) > 0 ? Math.min(p, Number(dernier)) : p;
  let v;
  if (t === N - 1 || c >= 1) v = f;
  else { const raw = p - E * c; v = niArrondi(raw, f, haut, pas); if (v == null) v = f; if (v !== Math.round(raw * 100) / 100) raisons.push({ k: 'arrondi', v }); }
  if (v < f) v = f;
  if (!(v < haut) && !(v === f && f < haut)) return null;
  if (Number.isFinite(o) && o > 0 && !(v > o)) return null;
  return { i: t, prix: v, plancher: f, finale: v === f, tours: N, raisons };
}
// </nego-intelligente-regle>
export { palierIntelligent, niArrondi };
const cents = (x) => Math.round(Number(x) * 100);
// Le plancher ABSOLU (euros) : le prix mini posé, sinon l'achat + 10 % ; null = ni l'un ni l'autre.
export function plancherAbsolu(mini, achat) {
  const m = Number(mini); if (Number.isFinite(m) && m > 0) return m;
  const a = Number(achat); if (Number.isFinite(a) && a > 0) return Math.ceil(cents(a) * 110 / 100) / 100;
  return null;
}
// Le plancher (euros) ; `null` = pas de plancher ⇒ rien n'est proposé. `opts` : { achat, nArticles, tranches, bonusLot }.
export function plancherDe(prix, mini, remiseMax, opts = {}) {
  const p = Number(prix);
  if (!(p > 0)) return null;
  const abs = plancherAbsolu(mini, opts.achat);
  const lot = Number(opts.nArticles) > 1 && Number(opts.bonusLot) > 0 ? 1 + Number(opts.bonusLot) / 100 : 1;
  const tr = (Array.isArray(opts.tranches) ? opts.tranches : []).find((x) => p >= x.de && p <= x.a);
  let f;
  if (tr) f = Math.ceil(cents(p - tr.baisse * lot)) / 100;
  else {
    const m = Number(mini);
    if (Number.isFinite(m) && m > 0) return m < p ? m : null;           // un mini au-dessus du prix : rien à négocier
    const r = Number(remiseMax) > 0 ? Number(remiseMax) * lot : NaN;
    if (Number.isFinite(r) && r > 0 && r < 90) f = Math.ceil(cents(p * (1 - r / 100))) / 100;
    else f = abs;
  }
  if (f == null) return null;
  if (abs != null && f < abs) f = abs;                                   // JAMAIS sous le prix mini / l'achat + 10 %
  return f < p ? f : null;
}
// Les prix des paliers, du plus haut au plancher (euros).
export function prixPaliers(prix, plancher, reg) {
  const p = Number(prix), f = Number(plancher), R = reglagesPaliers(reg);
  if (!(p > 0) || !(f > 0) || !(f < p)) return [];
  const out = [];
  for (const pct of R.paliers) {
    let v = p - (p - f) * pct / 100;
    v = R.arrondi ? Math.round(v / R.pas) * R.pas : Math.round(v * 100) / 100;
    v = Math.round(v * 100) / 100;
    if (v < f) v = f;
    if (v >= p) continue;
    if (!out.length || v < out[out.length - 1]) out.push(v);
  }
  return out;
}
export function apercuPaliers(prix, plancher, reg) {
  const l = prixPaliers(prix, plancher, reg);
  return l.length ? { chaine: [Number(prix), ...l], plancher: Number(plancher) } : null;
}
// La contre-offre à faire maintenant pour une offre `offre` (euros), sachant les paliers déjà joués sur CETTE
// négociation (`joues` : indices). Rend { i, prix, plancher, finale } (contre-offre), { i, accepter: true, prix,
// plancher } (« rester flexible » : l'offre est à ≤ N € du palier, et au-dessus du plancher) ou null.
export function palierSuivant({ prix, mini, achat, nArticles, offre, joues = [], reglages, ctx = null }) {
  const R = reglagesPaliers(reglages);
  if (!R.actif) return null;
  const f = plancherDe(prix, mini, R.remiseMax, { achat, nArticles, tranches: R.tranches, bonusLot: R.bonusLot });
  if (f == null) return null;
  if (R.intelligente) {
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const r = palierIntelligent({ prix, plancher: f, offre, tour: (Array.isArray(joues) ? joues : []).length, dernier: c.dernier, jours: c.jours, favoris: c.favoris, vues: c.vues, note: c.note, pas: R.arrondi ? R.pas : 0.01 });
    if (r && R.flexible > 0 && Number(offre) >= f && Number(offre) < r.prix && r.prix - Number(offre) <= R.flexible + 1e-9) return { i: r.i, accepter: true, prix: Number(offre), plancher: f };
    return r;
  }
  const l = prixPaliers(prix, f, R);
  const deja = new Set((Array.isArray(joues) ? joues : []).map(Number));
  for (let i = 0; i < l.length; i++) {
    if (deja.has(i)) continue;
    if (R.flexible > 0 && Number(offre) >= f && Number(offre) < l[i] && l[i] - Number(offre) <= R.flexible + 1e-9) return { i, accepter: true, prix: Number(offre), plancher: f };
    if (!(l[i] > Number(offre))) return null;                        // jamais une contre-offre ≤ son offre
    if (l[i] < f) return null;                                        // jamais sous le plancher (garde)
    return { i, prix: l[i], plancher: f, finale: i === l.length - 1 };
  }
  return null;
}
