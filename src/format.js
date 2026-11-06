// ═══════════════════════════════════════════════════════════════════════════
// UNE SEULE ÉCRITURE DES EUROS — `montant()` (5 nov., revue de cohérence 1.4)
// ═══════════════════════════════════════════════════════════════════════════
// Mesuré le 5 nov. : quatre fonctions (`fmt`, `fmtE`, `fmtE0`, `prixTxt`) et
// autant d'écritures — « 65,00 € » sur une ligne, « 65 € » à côté ; « NaN € »
// pour une chaîne illisible (fmtE) ; « 0,00 € » pour un montant ABSENT (fmt de
// `null` : `+null` vaut 0). Les quatre deviennent des alias de `montant`.
//
// La règle, une fois :
//   · un montant inconnu (`null`, `undefined`, '', NaN, Infini, un objet sans
//     montant) s'écrit « — » (§5 : « pas su » ne vaut pas 0, et « Au moins
//     0,00 € » ne se dit jamais) — l'appelant peut nommer autre chose (`vide`) ;
//   · les centimes s'écrivent SEULEMENT s'ils existent (« 65 € », « 65,50 € »,
//     jamais « 65,5 € » ni « 65,00 € ») ; l'arrondi au centime est celui de
//     `toFixed(2)`, le même qu'avant (aucun montant lu ne bouge d'un centime) ;
//   · séparateur décimal « , » ; milliers en espace fine insécable (U+202F,
//     celle de `toLocaleString('fr-FR')`) ; une espace avant « € » ;
//   · une devise étrangère est DITE (« 12,50 GBP ») ou ÉCARTÉE (« — ») selon
//     l'appel — jamais convertie (§1 : VRM reste en euros) ;
//   · un « −0 » ne s'écrit jamais (« -0 € » : §4.12).
// Exécuté par scripts/audit-composants.cjs, qui liste chaque écart de rendu
// des quatre anciennes fonctions.
// ═══════════════════════════════════════════════════════════════════════════

export const VIDE = '—';
const ESPACE_MILLIERS = ' ';

// Le nombre d'une valeur, ou null s'il n'y en a pas. Une chaîne accepte le
// point (« 88.0 », forme de l'API Vinted) ou la virgule (« 12,50 ») ; un objet
// se lit sur `amount` (prix Vinted `{amount, currency_code}`) ou `valeur`.
function lireNombre(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim().replace(/\s| | /g, '');
    if (!t || !/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function lireDevise(v, opts) {
  if (opts && opts.devise) return String(opts.devise).toUpperCase();
  if (v && typeof v === 'object') { const c = v.currency_code || v.currency || v.devise; if (c) return String(c).toUpperCase(); }
  return 'EUR';
}
const grouper = (entier) => entier.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);

// La valeur en EUROS (ou dans sa devise) d'une entrée, ou null : pour qui doit
// comparer ou sommer sans écrire (et ainsi ne jamais sommer un « — »).
export function valeurMontant(v, opts = {}) {
  const brut = v && typeof v === 'object' ? (v.amount != null ? v.amount : v.valeur) : v;
  const n = lireNombre(brut);
  if (n == null) return null;
  return opts.enCentimes ? n / 100 : n;
}

/**
 * montant(valeurOuCentimes, opts) → texte.
 * opts :
 *   enCentimes  la valeur est en centimes entiers (Stripe, `data-prix-vente`) ;
 *   centimes    'auto' (défaut : seulement s'ils existent) · 'toujours' · 'jamais' (arrondi à l'euro) ;
 *   milliers    true (défaut) : « 1 234 € » ; false : « 1234 € » ;
 *   vide        ce qui s'écrit quand le montant n'est pas su (défaut « — ») ;
 *   devise      code ISO (défaut : celui de l'objet, sinon EUR) ;
 *   etrangere   'dire' (défaut : « 12,50 GBP ») · 'ecarter' (⇒ `vide`) ;
 *   signe       true : « +12 € » pour un montant positif (un écart, une variation) ;
 *   arrondi     'binaire' (défaut, `toFixed`) · 'decimal' (`toLocaleString` : 1,005 ⇒ 1,01).
 */
export function montant(v, opts = {}) {
  const vide = opts.vide != null ? opts.vide : VIDE;
  let n = valeurMontant(v, opts);
  if (n == null) return vide;
  const devise = lireDevise(v, opts);
  if (devise !== 'EUR' && opts.etrangere === 'ecarter') return vide;
  const mode = opts.centimes || 'auto';
  let entier, decimales;
  if (mode === 'jamais') {
    const r = Math.round(n);               // celui de l'ancien fmtE0 (−2,5 ⇒ −2)
    n = r === 0 ? 0 : r;                   // jamais « -0 »
    entier = String(Math.abs(n)); decimales = '';
  } else {
    // L'arrondi au centime : celui de l'ancien `fmt` (`toFixed`, sur la valeur binaire)
    // par défaut ; `arrondi: 'decimal'` prend celui de `toLocaleString` (sur l'écriture
    // décimale : 1,005 ⇒ 1,01), celui de l'ancien `prixTxt`. Rien ne bouge d'un centime.
    const s = opts.arrondi === 'decimal'
      ? Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })
      : Math.abs(n).toFixed(2);
    [entier, decimales] = s.split('.');
    if (mode === 'auto' && decimales === '00') decimales = '';
    if (Number(s) === 0) n = 0;            // « -0,001 » ⇒ « 0 € », jamais « -0 € »
  }
  const signe = n < 0 ? '-' : (opts.signe && n > 0 ? '+' : '');
  const corps = (opts.milliers === false ? entier : grouper(entier)) + (decimales ? ',' + decimales : '');
  // L'espace avant la devise est INSÉCABLE (U+00A0) : « € » ne passe jamais seul à la ligne.
  return `${signe}${corps}\u00a0${devise === 'EUR' ? '€' : devise}`;
}

// ── Les quatre anciennes écritures, devenues des alias ──────────────────────
// Elles rendent ce qu'elles rendaient pour un nombre lu, SAUF les centimes
// inutiles (« 12,00 € » ⇒ « 12 € ») ; un montant absent ou illisible rend
// « — » (avant : « 0,00 € » ou « NaN € »). Liste exacte : audit-composants.
export const fmt = (n) => montant(n, { milliers: false });            // ex-App.jsx l. 11483
export const fmtE = (n) => montant(n, { milliers: false });           // ex-Comptabilité, l. 50905
export const fmtE0 = (n) => montant(n, { centimes: 'jamais' });       // ex-Comptabilité, l. 50910 (cartes-titres)
export const prixTxt = (p) => montant(p, { vide: 'sans prix', arrondi: 'decimal' });   // ex-ChoixAnnoncesVinted
