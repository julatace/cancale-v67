// (31 oct.) Messages en volets — les règles PURES de l'écran, testées par
// `scripts/bancs/messages-volets.cjs`.
//
// LA CONTRE-OFFRE EN UN TAP (3 nov., choisie par Julien) — « Proposer X € » sur
// une offre reçue TROP BASSE. X vient de SON prix mini seulement (posé à côté du
// N°, par identité) : jamais deviné, jamais un « milieu » calculé. Règle :
//   - X = le prix mini arrondi à l'euro supérieur ;
//   - jamais sous le prix mini, jamais au-dessus du prix affiché (un mini qui
//     s'arrondit au-dessus du prix affiché ⇒ X = le prix affiché, qui reste ≥ mini) ;
//   - seulement si l'offre est SOUS le mini (sinon c'est « Accepter » qu'on montre) ;
//   - pas de mini, pas de prix affiché lu, ou un mini au-dessus du prix affiché ⇒
//     `null` : pas de bouton.
// Le tap envoie la contre-offre par le chemin existant (extension, plafond
// d'actions) ; rien ne part sans lui (§3).
export function contreOffreMini(offre, prixAffiche, mini) {
  const o = Number(offre), p = Number(prixAffiche), m = Number(mini);
  if (!Number.isFinite(o) || !(o > 0)) return null;
  if (!Number.isFinite(m) || !(m > 0)) return null;
  if (!Number.isFinite(p) || !(p > 0)) return null;
  if (o >= m) return null;
  if (p < m) return null;
  const x = Math.min(Math.ceil(Math.round(m * 100) / 100 - 1e-9), p);
  const c = Math.round(x * 100) / 100;
  if (c < m || c > p || !(c > o)) return null;
  return c;
}
