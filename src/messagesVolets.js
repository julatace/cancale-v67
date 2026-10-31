// (31 oct.) Messages en volets — les règles PURES de l'écran, testées par
// `scripts/bancs/messages-volets.cjs`.
//
// LA CONTRE-OFFRE PROPOSÉE sur la carte d'offre (« Refuser · 110 € · Accepter »).
// Une PROPOSITION, jamais un envoi : un tap ne fait que remplir le prix, c'est
// « Envoyer l'offre » qui part (§3). Règle :
//   - entre l'offre et le prix affiché : le milieu, arrondi aux 5 € au-dessus
//     (à l'euro sous 20 €), jamais sous le prix mini qu'il a posé ;
//   - toujours STRICTEMENT au-dessus de l'offre et sous le prix affiché ;
//   - prix affiché inconnu : son mini s'il est au-dessus de l'offre, sinon rien ;
//   - rien de sûr ⇒ `null` (le bouton dit « Contre-offre » sans montant).
export function contreOffreProposee(offre, prixAffiche, mini) {
  const o = Number(offre), p = Number(prixAffiche), m = Number(mini);
  if (!(o > 0) || !Number.isFinite(o)) return null;
  const aMini = Number.isFinite(m) && m > 0;
  if (!(p > 0) || !Number.isFinite(p)) return aMini && m > o ? m : null;
  if (p <= o) return null;
  const milieu = (o + p) / 2;
  const pas = p >= 20 ? 5 : 1;
  let c = Math.ceil(milieu / pas) * pas;
  if (!(c < p)) c = Math.ceil(milieu);
  if (aMini && c < m) c = m;
  if (!(c > o) || !(c < p)) return aMini && m > o && m < p ? m : null;
  return c;
}
