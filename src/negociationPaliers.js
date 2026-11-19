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
  return {
    actif: o.actif === true,
    remiseMax: Number.isFinite(rm) && rm > 0 && rm < 90 ? Math.round(rm) : null,
    paliers: uniques.length ? uniques : [...PALIERS_DEFAUT.paliers],
    messages: (Array.isArray(o.messages) ? o.messages : []).map((t) => String(t == null ? '' : t).trim()).filter(Boolean).slice(0, MESSAGES_MAX),
    arrondi: o.arrondi !== false,
  };
}
const cents = (x) => Math.round(Number(x) * 100);
// Le plancher (euros) ; `null` = pas de plancher ⇒ rien n'est proposé.
export function plancherDe(prix, mini, remiseMax) {
  const p = Number(prix);
  if (!(p > 0)) return null;
  const m = Number(mini);
  if (Number.isFinite(m) && m > 0) return m < p ? m : null;           // un mini au-dessus du prix : rien à négocier
  const r = Number(remiseMax);
  if (Number.isFinite(r) && r > 0 && r < 90) return Math.ceil(cents(p * (1 - r / 100))) / 100;
  return null;
}
// Les prix des paliers, du plus haut au plancher (euros).
export function prixPaliers(prix, plancher, reg) {
  const p = Number(prix), f = Number(plancher), R = reglagesPaliers(reg);
  if (!(p > 0) || !(f > 0) || !(f < p)) return [];
  const out = [];
  for (const pct of R.paliers) {
    let v = p - (p - f) * pct / 100;
    v = R.arrondi ? Math.round(v) : Math.round(v * 100) / 100;
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
// négociation (`joues` : indices). Rend { i, prix } ou null (rien à proposer).
export function palierSuivant({ prix, mini, offre, joues = [], reglages }) {
  const R = reglagesPaliers(reglages);
  if (!R.actif) return null;
  const f = plancherDe(prix, mini, R.remiseMax);
  if (f == null) return null;
  const l = prixPaliers(prix, f, R);
  const deja = new Set((Array.isArray(joues) ? joues : []).map(Number));
  for (let i = 0; i < l.length; i++) {
    if (deja.has(i)) continue;
    if (!(l[i] > Number(offre))) return null;                        // jamais une contre-offre ≤ son offre
    if (l[i] < f) return null;                                        // jamais sous le plancher (garde)
    return { i, prix: l[i], plancher: f };
  }
  return null;
}
