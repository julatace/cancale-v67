// ════════════════════════════════════════════════════════════════════════════
//  LE SEUIL DE TVA, À CÔTÉ DES FACTURES (10 nov., lot T)
// ════════════════════════════════════════════════════════════════════════════
// Julien (proposition 30, validée) : « Contrôle du seuil de TVA relié aux
// factures : “tu factures sans TVA, tu es à 71 % du seuil” » — pour ne pas
// dépasser le seuil sans le savoir.
//
// ⚠️ AUCUN CHIFFRE NI AUCUN SEUIL N'EST RECALCULÉ ICI (§11, une règle par notion) :
//   · le CA de l'année et son état face à la franchise viennent de
//     `jaugeSeuils` (src/microEntreprise.js) — la MÊME jauge que Comptabilité →
//     « Ta micro-entreprise », sur la ligne publiée par Ventes
//     (`vinted_urssaf_mois` : CA déclaré, DATÉ AU VERSEMENT, comptes exclus
//     retirés) ;
//   · les seuils 2026 sont ceux vérifiés de `SEUILS_MICRO` (F21746 : 85 000 € /
//     93 500 € pour la vente de marchandises) ; une année sans seuils vérifiés ⇒
//     rien n'est dit ;
//   · « proche » = `PROCHE_PCT` (80 %) du seuil, la même borne que la jauge.
//
// Ce module ajoute UNE lecture : le régime de TVA choisi dans « Ma facture »
// (`vrm_pro_facture.tva_regime`). Le seuil de franchise ne concerne que celui
// qui facture SANS TVA :
//   · 'normal' ou 'marge' : il est déjà assujetti, aucune alerte ;
//   · 'franchise' : « tu factures sans TVA » ;
//   · '' (pas choisi) : l'alerte vaut aussi, et la porte dit « choisis ».
//
// « PAS SU » NE DÉCLENCHE JAMAIS RIEN (§5) :
//   · pas de ligne publiée / pas de seuils vérifiés ⇒ `null` (l'écran se tait) ;
//   · fiche « Ma facture » en cours de lecture (`undefined`) ou illisible
//     (`null`) ⇒ la jauge peut se montrer, jamais l'alerte ;
//   · un CA partiel est un MINIMUM : à 80 % ou au-delà, c'est une certitude
//     (le vrai CA est au moins celui-là) ; en dessous, « au moins », sans alerte.
import { jaugeSeuils, PROCHE_PCT } from './microEntreprise.js';

export const ASSUJETTIS = ['normal', 'marge'];
export { PROCHE_PCT };

// `regime` : undefined (fiche en lecture) · null (fiche illisible) · '' (pas
// choisi) · 'franchise' · 'marge' · 'normal'.
export function alerteSeuilTva({ ligne, now = new Date(), activite = 'vente', regime } = {}) {
  const j = jaugeSeuils({ ligne, now, activite });
  if (!j) return null;
  const regimeSu = typeof regime === 'string';
  const assujetti = regimeSu && ASSUJETTIS.includes(regime);
  const etat = j.tva.etat;                       // ok · proche · base_depasse · majore_depasse · due_depuis_janvier
  const franchi = etat === 'base_depasse' || etat === 'majore_depasse' || etat === 'due_depuis_janvier';
  const niveau = etat === 'ok' ? 'ok' : etat === 'proche' ? 'proche' : 'depasse';
  // L'alerte : seulement sur un régime LU, sans TVA (ou pas choisi), et un état
  // qui ne dépend d'aucun « pas su ».
  const alerte = regimeSu && !assujetti && niveau !== 'ok' ? niveau : null;
  return {
    annee: j.annee,
    ca: j.ca,
    partiel: !!j.partiel,
    raisons: j.raisons || [],
    seuil: j.seuils.tvaBase,
    majore: j.seuils.tvaMajore,
    pct: j.tva.pct,
    reste: j.tva.reste,
    resteMajore: j.tva.resteMajore,
    etat,
    franchi,
    niveau,
    regime: regimeSu ? regime : null,
    regimeSu,
    assujetti,
    sansTva: regimeSu && !assujetti,
    alerte,                                      // null · 'proche' · 'depasse'
  };
}

// Ce que ça change, en une phrase courte par état (≤ 12 mots), avec la date.
// La même source que le chiffre (§5 : « la phrase vient de la même source »).
export function phrasesSeuilTva(a) {
  if (!a) return null;
  const eur = (n) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;
  switch (a.etat) {
    case 'proche': return { titre: `Tu factures sans TVA : ${String(Math.floor(a.pct)).replace('.', ',')} % du seuil.`, change: `Au-delà de ${eur(a.seuil)}, TVA dès le 1er janvier ${a.annee + 1}.` };
    case 'base_depasse': return { titre: `Seuil de TVA de ${eur(a.seuil)} dépassé.`, change: `Tu factures la TVA dès le 1er janvier ${a.annee + 1}.`, plus: `Au-delà de ${eur(a.majore)}, elle serait due le jour même.` };
    case 'majore_depasse': return { titre: `Seuil majoré de ${eur(a.majore)} dépassé.`, change: 'La TVA est due depuis le jour du dépassement.', plus: 'Appelle ton service des impôts des entreprises.' };
    case 'due_depuis_janvier': return { titre: `Ton CA ${a.annee - 1} a dépassé ${eur(a.seuil)}.`, change: `La TVA est due depuis le 1er janvier ${a.annee}.` };
    default: return { titre: null, change: null };
  }
}
