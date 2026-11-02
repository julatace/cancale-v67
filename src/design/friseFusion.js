// ════════════════════════════════════════════════════════════════════════════
//  LES FRISES « FUSION » (2 nov., le style choisi par Julien sur les maquettes :
//  « j'aime la barre de progression pour le suivi »).
//
//  Ce module ne porte AUCUNE règle neuve : il PROJETTE.
//    · une vente : les cinq étapes de `friseVente` (src/recapVente.js — une
//      étape n'est cochée que PROUVÉE, ou déduite d'une étape plus loin prouvée)
//      deviennent quatre segments : Vendue · Postée (= « Déposée ») · Livrée ·
//      Payée (= « Argent reçu »). Le bordereau n'a pas de segment à lui : c'est
//      la préparation de « Postée » ;
//    · un colis : quatre preuves déjà lues par l'écran Colis (imprimé coché,
//      « Colis fait » / statut qui a bougé, statut du transporteur, livré) ;
//      la MÊME loi que `friseVente` : une étape est faite si SA preuve est lue
//      ou si une étape PLUS LOIN l'est. « Pas su » n'est jamais « oui ».
//  L'étape EN COURS est la première non faite (aucune si tout est fait). Son ton
//  est « urgent » (ambre) seulement quand l'écran dit qu'un geste est à faire
//  (§7 : l'ambre est la couleur d'un geste à faire), sinon l'encre.
// ════════════════════════════════════════════════════════════════════════════

export const ETAPES_VENTE_FUSION = [
  ['vendue', 'Vendue', 'vendue'],
  ['postee', 'Postée', 'deposee'],
  ['livree', 'Livrée', 'livree'],
  ['payee', 'Payée', 'argent'],
];

export const ETAPES_COLIS_FUSION = [
  ['imprime', 'Imprimé'],
  ['depose', 'Déposé'],
  ['enroute', 'En route'],
  ['livre', 'Livré'],
];

const avecCours = (etapes, geste) => {
  const i = etapes.findIndex((e) => !e.fait);
  if (i >= 0) { etapes[i].cours = true; etapes[i].ton = geste ? 'urgent' : 'encre'; }
  return etapes;
};

// `etapes5` : la sortie de `friseVente` (jamais recalculée ici).
export function friseVenteFusion(etapes5, { geste = false } = {}) {
  if (!Array.isArray(etapes5) || !etapes5.length) return null;
  const par = Object.fromEntries(etapes5.map((e) => [e.cle, e]));
  const etapes = ETAPES_VENTE_FUSION.map(([cle, label, source]) => {
    const e = par[source] || null;
    return { cle, label, fait: !!(e && e.fait), preuve: e ? e.preuve : null, t: e ? e.t : null, cours: false, ton: '' };
  });
  return avecCours(etapes, geste);
}

// `lues` : { imprime, depose, enroute, livre } — chacune un booléen LU par l'écran.
export function friseColisFusion(lues = {}, { geste = false } = {}) {
  const l = ETAPES_COLIS_FUSION.map(([cle]) => lues[cle] === true);
  const derniere = l.lastIndexOf(true);
  const etapes = ETAPES_COLIS_FUSION.map(([cle, label], i) => ({
    cle, label, fait: l[i] || i < derniere, preuve: l[i] ? 'lue' : (i < derniere ? 'deduite' : null), cours: false, ton: '',
  }));
  return avecCours(etapes, geste);
}
