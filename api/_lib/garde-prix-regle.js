// LE GARDE-FOU SUR LE PRIX, côté serveur (eBay `revise`) — COPIE FABRIQUÉE de src/gardePrix.js par
// `node scripts/audit-garde-prix.cjs --recopie`. Ne pas modifier ici : modifier src/gardePrix.js puis recopier.
// <garde-prix-regle>
const GARDE_SEUIL_DEFAUT = 40;
const GARDE_SEUIL_BORNES = [10, 90];
const GARDE_MARGE_ACHAT = 110;               // sans prix mini : jamais sous l'achat + 10 %
const GARDE_RAISONS = ['zero', 'plancher', 'chute', 'frappe', 'actuel-inconnu', 'plancher-pas-lu'];
// Le seuil réglé (un entier de 10 à 90), sinon le défaut.
function gardeSeuil(v) {
  const n = Number(v && typeof v === 'object' ? v.seuil : v);
  return Number.isInteger(n) && n >= GARDE_SEUIL_BORNES[0] && n <= GARDE_SEUIL_BORNES[1] ? n : GARDE_SEUIL_DEFAUT;
}
// Des euros (nombre, « 45,50 », `{ amount }`) en centimes entiers, sinon null.
function gardeCentimes(v) {
  if (v == null || v === '') return null;
  const n = Number(typeof v === 'object' ? v.amount : String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null;
}
// Le plancher en centimes : le prix mini, sinon l'achat + 10 % (arrondi au centime supérieur), sinon null.
function gardePlancher(miniC, achatC) {
  if (Number.isInteger(miniC) && miniC > 0) return { c: miniC, de: 'mini' };
  if (Number.isInteger(achatC) && achatC > 0) return { c: Math.ceil(achatC * GARDE_MARGE_ACHAT / 100), de: 'achat' };
  return null;
}
// La règle. `prixC` : le prix FINAL qui partirait ; `actuelC` : le prix actuel LU (annonce) ; `plancher` :
// { c, de } ou null ; `mode` : 'main' (SON geste, confirmable) | 'auto' (tout le reste) ; `confirmeC` : le
// prix qu'il a confirmé, en centimes. Rend { ok, raisons, aConfirmer, bloque, … }.
function gardePrixRegle({ prixC, actuelC = null, plancher = null, plancherLu = true, seuil = GARDE_SEUIL_DEFAUT, mode = 'auto', confirmeC = null } = {}) {
  const s = gardeSeuil(seuil);
  const m = mode === 'main' ? 'main' : 'auto';
  const raisons = [];
  const p = Number.isInteger(prixC) ? prixC : NaN;
  const a = Number.isInteger(actuelC) && actuelC > 0 ? actuelC : null;
  const pl = plancher && Number.isInteger(plancher.c) && plancher.c > 0 ? plancher : null;
  if (!(p > 0)) raisons.push('zero');
  else {
    if (pl && p < pl.c) raisons.push('plancher');
    if (a != null) {
      if (p * 100 < a * (100 - s)) raisons.push('chute');
      const r = a / p;
      if ((r >= 9.5 && r <= 10.5) || (r >= 1 / 10.5 && r <= 1 / 9.5)) raisons.push('frappe');
    } else if (m === 'auto') raisons.push('actuel-inconnu');
    if (plancherLu === false && m === 'auto') raisons.push('plancher-pas-lu');
  }
  const confirmable = raisons.length > 0 && !raisons.includes('zero') && !raisons.includes('actuel-inconnu') && !raisons.includes('plancher-pas-lu');
  const confirme = m === 'main' && confirmable && Number.isInteger(confirmeC) && confirmeC === p;
  const ok = raisons.length === 0 || confirme;
  return {
    ok, raisons, mode: m, seuil: s, confirme,
    prixC: p > 0 ? p : (Number.isFinite(p) ? p : null), actuelC: a,
    plancherC: pl ? pl.c : null, plancherDe: pl ? pl.de : null,
    chutePct: a != null && p > 0 ? Math.round((1 - p / a) * 100) : null,
    aConfirmer: !ok && m === 'main' && confirmable,
    bloque: !ok && !(m === 'main' && confirmable),
  };
}
// La phrase (française : le journal du fond et la notification ; l'écran passe par ses propres textes).
function gardePhrase(g) {
  const e = (c) => (Number.isInteger(c) ? (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €' : '—');
  if (!g || g.ok) return '';
  if (g.raisons.includes('zero')) return 'un prix de 0 € ou moins ne part jamais';
  const q = g.actuelC != null ? `${e(g.prixC)} au lieu de ${e(g.actuelC)}` : e(g.prixC);
  const pourquoi = [];
  if (g.raisons.includes('frappe')) pourquoi.push('une faute de frappe probable (×10)');
  if (g.raisons.includes('plancher')) pourquoi.push(`sous ton ${g.plancherDe === 'mini' ? 'prix mini' : 'achat + 10 %'} (${e(g.plancherC)})`);
  if (g.raisons.includes('chute')) pourquoi.push(`${g.chutePct} % sous le prix actuel (seuil ${g.seuil} %)`);
  if (g.raisons.includes('actuel-inconnu')) pourquoi.push('le prix actuel n’est pas lu');
  if (g.raisons.includes('plancher-pas-lu')) pourquoi.push('ton prix mini n’a pas pu être relu');
  return `${q} : ${pourquoi.join(', ')}`;
}
// </garde-prix-regle>
export { GARDE_SEUIL_DEFAUT, gardeSeuil, gardeCentimes, gardePlancher, gardePrixRegle, gardePhrase };
