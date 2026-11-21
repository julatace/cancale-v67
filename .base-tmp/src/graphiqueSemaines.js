// ════════════════════════════════════════════════════════════════════════════
//  LE VENDU PAR SEMAINE, FAÇON SANTÉ (8 nov. 2026, « beauté », point 5) — la règle
//  Les semaines viennent de `rythmeVendu(liveStats.venduLignes).semaines`
//  (src/statsVentes.js) : `ventesFaites`, date de VENTE, toutes plateformes,
//  comptes sélectionnés (§5 « Vendu ≠ reçu »). Rien n'est recalculé ici : ce
//  module ne fait que l'échelle (graduations rondes), le détail d'une semaine
//  touchée et sa comparaison à la précédente. Exécuté par
//  `scripts/audit-graphique-semaines.cjs` (--prouve).
// ════════════════════════════════════════════════════════════════════════════

// Des graduations rondes (1, 2, 2,5 ou 5 × 10ⁿ), 0 compris, la dernière ≥ max.
export function graduations(max, nb = 3) {
  const m = Number(max);
  if (!(m > 0)) return [0];
  const brut = m / nb;
  const p = Math.pow(10, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s * nb >= m) || 10 * p;
  const k = Math.max(1, Math.ceil(m / pas - 1e-9));
  const out = [];
  for (let i = 0; i <= k; i++) out.push(Math.round(i * pas * 100) / 100);
  return out;
}

// Le détail d'une semaine : son montant et ses ventes TELS QUELS, et l'écart à la
// semaine d'avant (montant, %). Une semaine d'avant à 0 € : pas de % (division par
// zéro), l'écart en euros seulement. `partiel` : une plateforme pas lue ⇒ « au moins ».
export function detailSemaine(semaines, i, { partiel = false } = {}) {
  if (!Array.isArray(semaines) || !semaines[i]) return null;
  const s = semaines[i], p = i > 0 ? semaines[i - 1] : null;
  const eur = Number(s.eur) || 0;
  const avant = p ? Number(p.eur) || 0 : null;
  const ecart = avant == null ? null : Math.round((eur - avant) * 100) / 100;
  const pct = avant ? Math.round(((eur - avant) / avant) * 100) : null;
  return { debut: s.debut, eur, n: Number(s.n) || 0, enCours: !!s.enCours, auMoins: !!partiel, avant, ecart, pct };
}

// La semaine sous le doigt (ou la souris) : x dans [0, largeur[ ⇒ son indice.
export function semaineSous(x, largeur, n) {
  if (!(n > 0) || !(largeur > 0)) return null;
  return Math.max(0, Math.min(n - 1, Math.floor((x / largeur) * n)));
}
