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
//  (§7 : l'ambre est la couleur d'un geste à faire), sinon neutre (`attente`).
//  (5 nov., revue 2.20) L'ENCRE NE VA QU'À LA DERNIÈRE ÉTAPE FAITE (`derniere`) :
//  l'étape suivante, à l'encre, se lisait comme faite — « Livré » sur un colis en
//  route, « Imprimé » sur un colis dont rien n'est imprimé. Rien de fait ⇒ aucune
//  encre ; l'étape en cours ne dit qu'elle est la suivante (ou le geste, en ambre).
// ════════════════════════════════════════════════════════════════════════════

import { ETAPE_CENTRE } from '../verificationArticle.js';

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
  if (i >= 0) { etapes[i].cours = true; etapes[i].ton = geste ? 'urgent' : 'attente'; }
  const d = etapes.map((e) => !!e.fait).lastIndexOf(true);
  etapes.forEach((e, k) => { e.derniere = k === d; });
  return etapes;
};

// `etapes5` : la sortie de `friseVente` (jamais recalculée ici).
// (6 nov., vague 2) `verification` : l'état de LA transaction dit « Envoi au centre
// de vérification » (src/verificationArticle.js, `auCentreDeVerification`) ⇒ une
// étape « Au centre de vérification » entre Postée et Livrée. Elle n'a pas de
// preuve à elle : faite seulement si « Livrée » l'est (déduite, la même loi) ;
// sinon c'est l'étape en cours une fois le colis posté. Sans l'état lu, rien.
export function friseVenteFusion(etapes5, { geste = false, verification = false } = {}) {
  if (!Array.isArray(etapes5) || !etapes5.length) return null;
  const par = Object.fromEntries(etapes5.map((e) => [e.cle, e]));
  const etapes = ETAPES_VENTE_FUSION.map(([cle, label, source]) => {
    const e = par[source] || null;
    return { cle, label, fait: !!(e && e.fait), preuve: e ? e.preuve : null, t: e ? e.t : null, cours: false, ton: '' };
  });
  if (verification === true) {
    const i = etapes.findIndex((e) => e.cle === 'livree');
    const apres = etapes.slice(i).some((e) => e.fait);
    etapes.splice(i, 0, { cle: ETAPE_CENTRE.cle, label: ETAPE_CENTRE.label, court: ETAPE_CENTRE.court, fait: apres, preuve: apres ? 'deduite' : null, t: null, cours: false, ton: '' });
  }
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

// (3 nov., critique #3) Les ventes Leboncoin, eBay et Vestiaire portent la MÊME frise que Vinted.
// `lues` : { vendue, postee, livree, payee } — chacune un booléen LU par l'écran de la plateforme
// (statut capté, jamais deviné) ; la même loi : faite si lue ou si une étape PLUS LOIN l'est.
export function friseVenteLue(lues = {}, { geste = false } = {}) {
  const l = ETAPES_VENTE_FUSION.map(([cle]) => lues[cle] === true);
  const derniere = l.lastIndexOf(true);
  const etapes = ETAPES_VENTE_FUSION.map(([cle, label], i) => ({
    cle, label, fait: l[i] || i < derniere, preuve: l[i] ? 'lue' : (i < derniere ? 'deduite' : null), t: null, cours: false, ton: '',
  }));
  return avecCours(etapes, geste);
}
