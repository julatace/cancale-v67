// ════════════════════════════════════════════════════════════════════════════
//  LE BÉNÉFICE SUR LA LIGNE D'UNE VENTE (1er nov., maquettes « ventes-B-journal »
//  et « ventes-ordi »)
//  UNE règle, celle qui existe : `beneficePaire` (src/beneficePaire.js), la même
//  que le tiroir de la vente, `vrm_benefice_jours` (`ajouterVenteBenefice` sur
//  `achatDe` + `chargesVente`) et `CoutAchatVente` : prix − prix d'achat − frais
//  CONNUS, en centimes entiers. Ce module ne fait que dire l'état :
//   · `achat`   — le prix d'achat manque : « — » (jamais un achat à 0 €, §5) ; le
//                 geste « Prix d'achat » est déjà sur la ligne ;
//   · `partiel` — achat connu, frais pas confirmés (« Tous les frais sont
//                 renseignés » pas coché) : ce qui reste à déduire ne peut que
//                 BAISSER le bénéfice ⇒ « au plus » (un plafond, pas un plancher) ;
//   · `ok`      — achat connu, frais confirmés : le bénéfice exact ;
//   · `illisible` — un montant saisi n'est pas lisible : « — » ;
//   · `prix`    — le prix de vente n'est pas lu : « — » ;
//   · `annulee` — une vente annulée n'a pas de bénéfice (rien d'affiché).
// ════════════════════════════════════════════════════════════════════════════
import { beneficePaire } from './beneficePaire.js';

export function beneficeLigneVente(prix, entree, { annulee = false } = {}) {
  if (annulee) return { etat: 'annulee', achat: null, benefice: null };
  const b = beneficePaire(prix, entree);
  const achat = b.achat == null ? null : b.achat / 100;
  if (b.vente == null) return { etat: 'prix', achat, benefice: null };
  if (!b.valid) return { etat: 'illisible', achat, benefice: null };
  if (b.achat == null) return { etat: 'achat', achat: null, benefice: null };
  return { etat: b.complet ? 'ok' : 'partiel', achat, benefice: b.benefice, frais: b.total };
}

// « 43 », « 12,50 » — sans « € » (l'écran l'ajoute).
export const euros = (v) => {
  if (v == null || !Number.isFinite(v)) return '';
  const a = Math.round(v * 100) / 100;
  return Number.isInteger(a) ? String(a) : a.toFixed(2).replace('.', ',');
};
// Le texte de la colonne « Bénéfice » : « +43 € », « au plus +43 € », « — ».
export function texteBenefice(r) {
  if (!r || r.etat === 'annulee') return '';
  if (r.benefice == null) return '—';
  const s = (r.benefice >= 0 ? '+' : '−') + euros(Math.abs(r.benefice)) + '\u00a0€';
  return r.etat === 'partiel' ? `au plus ${s}` : s;
}
