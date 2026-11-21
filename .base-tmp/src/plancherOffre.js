// ════════════════════════════════════════════════════════════════════════════
//  LE PRIX PLANCHER SOUS UNE OFFRE (9 nov., lot F, proposition 1 validée)
// ════════════════════════════════════════════════════════════════════════════
// Julien : sous chaque offre reçue, « En dessous de 62 € tu perds de l'argent ».
//
// Ce n'est PAS un prix conseillé (refusé le 11 oct., CLAUDE.md §3) : rien ici ne
// dit à quel prix vendre — seulement OÙ commence la perte, d'après SES chiffres.
//
// UNE règle (§5 « une seule règle par notion ») : le bénéfice d'une paire est
// `beneficePaire` (src/beneficePaire.js) = prix − prix d'achat − frais CONNUS de
// la fiche (`coutsVente` : frais/boost, commission, port payé par lui,
// remboursement, autres). Le plancher est le prix où ce bénéfice vaut 0 :
// on le LIT dans la même fonction (le bénéfice d'une vente à 0 € est −plancher),
// jamais une seconde formule.
//
// Trois états (§5 « pas su ne vaut pas oui ») :
//   · `achat`     — prix d'achat pas saisi (§2.5 : jamais deviné) : AUCUN plancher ;
//                   l'écran peut dire « prix d'achat pas saisi » avec la porte de saisie ;
//   · `illisible` — un montant saisi ne se lit pas : rien (pas su) ;
//   · `ok`        — prix d'achat ET frais confirmés (« Tous les frais sont renseignés ») ;
//   · `partiel`   — prix d'achat connu, frais pas confirmés (ou commission de la
//                   plateforme pas lue, Vestiaire) : le vrai plancher est AU MOINS
//                   celui-ci — une offre dessous perd à coup sûr, une offre au-dessus
//                   n'est pas dite « sans perte ».
// Vinted ne prend aucune commission au vendeur (src/fraisPlateformes.js, mesuré le
// 4 nov.) : ses frais sont ceux qu'il a saisis sur la fiche.
//
// Module PUR : scripts/audit-plancher-stock.cjs l'EXÉCUTE.
import { beneficePaire } from './beneficePaire.js';

// fiche : la fiche de la paire (`vinted_annonce_numeros[item_id]`, par IDENTITÉ).
// commissionLue : false quand la plateforme prend une commission que VRM ne lit pas.
export function plancherVente(fiche, { commissionLue = true } = {}) {
  if (!fiche || typeof fiche !== 'object') return { etat: 'achat', plancher: null };
  const b = beneficePaire('0', fiche);              // la MÊME règle que le bénéfice
  if (b.achat == null) {
    const tape = fiche.buyPrice != null && String(fiche.buyPrice).trim() !== '';
    return { etat: tape ? 'illisible' : 'achat', plancher: null };
  }
  if (!b.valid || b.benefice == null) return { etat: 'illisible', plancher: null };
  const plancher = Math.round(-b.benefice * 100);  // centimes : achat + frais connus
  return { etat: b.complet && commissionLue ? 'ok' : 'partiel', plancher, achat: b.achat, frais: b.cents };
}

// Une offre (en euros) face au plancher. Rend null quand rien ne se compare.
//   'sous'     : l'offre est sous le plancher — tu perds de l'argent (au moins `perte`) ;
//   'dessus'   : au-dessus d'un plancher EXACT ;
//   'incertain': au-dessus d'un plancher partiel (les frais manquants peuvent le monter).
const cts = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && Number.isSafeInteger(Math.round(v * 100)) ? Math.round(v * 100) : null);
export function offreFacePlancher(offreEuros, p) {
  const o = cts(offreEuros);
  if (o == null || !p || p.plancher == null || (p.etat !== 'ok' && p.etat !== 'partiel')) return null;
  if (o < p.plancher) return { niveau: 'sous', perte: p.plancher - o };
  return { niveau: p.etat === 'ok' ? 'dessus' : 'incertain', perte: 0 };
}

// Le prix mini posé à côté du N° (offres automatiques) face au plancher : une
// INFORMATION (le moteur n'est pas touché, le mini n'est jamais changé).
export function miniSousPlancher(mini, p) {
  const m = cts(mini);
  return m != null && p && p.plancher != null && (p.etat === 'ok' || p.etat === 'partiel') && m < p.plancher;
}

const eurosC = (c) => {
  const v = c / 100;
  return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) + ' €';
};

// Les phrases, venues de la MÊME source que les chiffres (§5). Jamais « vends à ».
// Rend null quand l'écran ne doit rien dire.
export function textePlancher(p, { offre = null, mini = null } = {}) {
  if (!p) return null;
  if (p.etat === 'achat') return { niveau: 'achat', ligne: 'Prix d’achat pas saisi : VRM ne sait pas où tu commences à perdre de l’argent.' };
  if (p.etat !== 'ok' && p.etat !== 'partiel') return null;
  const partiel = p.etat === 'partiel';
  const f = offreFacePlancher(offre, p);
  const ligne = `En dessous de ${eurosC(p.plancher)} tu perds de l’argent`;
  const precision = partiel ? 'au moins : tes frais ne sont pas tous confirmés' : '';
  const offreDit = f && f.niveau === 'sous' ? `Cette offre te ferait perdre ${partiel ? 'au moins ' : ''}${eurosC(f.perte)}.` : '';
  const miniDit = mini != null && miniSousPlancher(mini, p) ? `Ton prix mini (${eurosC(cts(mini))}) est sous ce plancher.` : '';
  return { niveau: f ? f.niveau : 'plancher', ligne, precision, offre: offreDit, mini: miniDit, plancher: p.plancher, partiel };
}
