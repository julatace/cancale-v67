// ═══════════════════════════════════════════════════════════════════════════
// LE BÉNÉFICE : UN NOM PAR NOTION, UNE RÈGLE PAR NOM (3 novembre)
// ═══════════════════════════════════════════════════════════════════════════
// Constat d'une critique, sur les MÊMES données : « bénéfice du mois » à « — »
// dans Ma journée, 103 € dans Statistiques, 80,93 € dans Comptabilité. Mesuré
// (banc `benefice-unique`) : trois notions différentes portaient le même nom.
//   · Comptabilité « Ton bénéfice » = ventes − prix d'achat − frais − dépenses
//     − URSSAF (`beneficePeriode().netFinal`, « — » si un prix d'achat manque) ;
//   · Statistiques « Bénéfice » = ventes − prix d'achat seulement (le BRUT),
//     « au moins » quand des prix manquent (faux : une paire au prix d'achat
//     inconnu peut être vendue à perte, ce n'est pas un plancher) ;
//   · Ma journée « Bénéfice » = le net de Comptabilité, ou — sans prévenir
//     autrement qu'en changeant son libellé — le brut partiel.
//   · Ventes « Bénéfice » / « Bénéfice net » = ventes − prix d'achat (− frais de
//     vente), sans dépenses ni URSSAF.
// LA RÈGLE (§5 « une seule règle par notion ») — trois notions, trois noms :
//   « Bénéfice »            = ce qu'il te reste : ventes − prix d'achat − frais de
//                             vente − dépenses − URSSAF DE CES VENTES.
//                             Propriétaire : `beneficePeriode` (App.jsx) sur la
//                             publication `vrm_benefice_jours` de l'écran Ventes.
//                             « — » ⇔ la règle dit « pas su » (prix d'achat
//                             manquant, frais eBay pas lus, rien publié) ou
//                             « rien à calculer » (ni vente ni dépense) :
//                             le même « — » sur tous les écrans.
//   « Bénéfice brut »       = ventes − prix d'achat, sur les seules ventes au prix
//                             d'achat connu, avec sa couverture (« 2 sur 3 »),
//                             JAMAIS « au moins ».
//   « Après frais de vente » = le brut − boosts et frais de vente (ni dépenses, ni
//                             URSSAF : ce n'est pas le bénéfice).
// (3 nov., Julien : « Bénéfice du mois −5 € — je ne comprends pas du tout »)
// L'URSSAF du « Bénéfice » = le taux × le montant des MÊMES ventes que celles
// qu'il compte (la cotisation attachée à la vente) — jamais celle du CA déclaré
// du mois, daté au VERSEMENT (un autre ensemble : une vente d'octobre versée en
// novembre retirait 4,71 € d'un novembre sans vente). La déclaration (CA déclaré,
// « à payer », registre, rappels) reste datée au versement. Aucune vente comptée
// ET aucune dépense ⇒ « — » (raison `rien` : rien à calculer), jamais 0 ni un
// négatif ; un négatif n'apparaît que s'il est réel (vente à perte, dépenses).
// La règle vit dans `beneficePeriode` (App.jsx), sa seule propriétaire.
// Chaque chiffre rendu porte `data-benef-notion` et `data-benef-valeur`
// (centimes, '' = « — ») : le banc compare les nombres d'une même notion.
export const NOM_BENEFICE = 'Bénéfice';
export const NOM_BENEFICE_BRUT = 'Bénéfice brut';
export const NOM_APRES_FRAIS = 'Après frais de vente';
export const NOMS_BENEFICE = { benefice: NOM_BENEFICE, brut: NOM_BENEFICE_BRUT, 'apres-frais': NOM_APRES_FRAIS };

const cents = (x) => (x == null || !isFinite(Number(x)) ? '' : String(Math.round(Number(x) * 100)));

// « Bénéfice » d'une période, tel que TOUT écran l'affiche. `B` = le résultat de
// `beneficePeriode` (ou `null` : rien de publié). `etat` : 'encours' | 'passu' | 'lu'.
// → { notion, valeur (nombre | null = « — »), raison, n, nCout, attrs }
export const chiffreBenefice = (B, etat = B ? 'lu' : 'passu') => {
  if (!B) {
    const raison = etat === 'encours' ? 'encours' : 'publication';
    return { notion: 'benefice', valeur: null, raison, n: null, nCout: null, attrs: { 'data-benef-notion': 'benefice', 'data-benef-valeur': '', 'data-benef-pourquoi': raison } };
  }
  const valeur = B.netFinal == null ? null : B.netFinal;
  const raison = valeur == null ? (B.raison || 'achats') : '';
  return { notion: 'benefice', valeur, raison, n: B.n, nCout: B.nCout, attrs: { 'data-benef-notion': 'benefice', 'data-benef-valeur': cents(valeur), 'data-benef-pourquoi': raison } };
};

// « Bénéfice brut » d'un cumul (`resumeBenefice`/`beneficeDesJours`) :
// la somme des seules ventes au prix d'achat connu ; aucune vente ⇒ 0 ; des
// ventes mais AUCUN prix connu ⇒ « — ». `partiel` : la couverture est à dire.
export const chiffreBrut = (R) => {
  if (!R) return { notion: 'brut', valeur: null, partiel: false, n: null, nCout: null, attrs: { 'data-benef-notion': 'brut', 'data-benef-valeur': '' } };
  const valeur = R.nCout > 0 ? R.brut : (R.n === 0 ? 0 : null);
  return { notion: 'brut', valeur, partiel: R.nCout < R.n, n: R.n, nCout: R.nCout, attrs: { 'data-benef-notion': 'brut', 'data-benef-valeur': cents(valeur) } };
};

// « Après frais de vente » : le brut − boosts et frais ; `null` si des frais ne
// sont pas sus (eBay) ou si aucun prix d'achat n'est connu.
export const chiffreApresFrais = (R) => {
  const valeur = !R ? null : R.nCout > 0 ? (R.net == null ? null : R.net) : (R.n === 0 ? 0 : null);
  return { notion: 'apres-frais', valeur, partiel: !!R && R.nCout < R.n, attrs: { 'data-benef-notion': 'apres-frais', 'data-benef-valeur': cents(valeur) } };
};

// Le dernier instant d'un mois « AAAA-MM » (heure locale) : le `maintenant` qui
// fait dire à `beneficePeriode` le bénéfice de CE mois-là (récap mensuel).
export const finDuMois = (ym) => {
  const [y, m] = String(ym || '').split('-').map(Number);
  if (!y || !m) return null;
  return new Date(y, m, 1).getTime() - 1;
};
// La publication couvre l'année d'avant et l'année en cours (`an0` de Ventes) :
// un mois plus ancien n'y est pas — son bénéfice n'est pas su (jamais « 0 »).
export const moisCouvertParPublication = (ym, maintenant = Date.now()) => {
  const an0 = new Date(maintenant).getFullYear() - 1;
  return String(ym || '') >= `${an0}-01`;
};
