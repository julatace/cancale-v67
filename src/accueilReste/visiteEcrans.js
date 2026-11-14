// ── LA VISITE GUIDÉE DE 4 ÉCRANS (14 nov., idée d'accueil 136) ──────────────
// Des bulles montrent les boutons qui comptent sur Ma journée, Annonces, Ventes et
// Achats — la bulle de la visite en bulles (src/VisiteBulles.jsx, une à la fois, sur
// l'élément RÉEL, « Passer », Échap), avec SES étapes ici.
//   · la PREMIÈRE ouverture d'un de ces écrans par un compte NEUF (≤ 30 jours) : sa
//     visite part une fois ; « Passer », « Terminer », Échap ou un toucher dehors la
//     rangent (`vrm_aides_accueil.vues[ecran]`, par compte, synchronisé) ;
//   · rejouable depuis le « ? » de l'écran (« Revoir la visite ») et Paramètres → Aide ;
//   · désactivable (Paramètres → Aide) ; jamais en même temps qu'une feuille ouverte,
//     ni pendant la visite d'arrivée ;
//   · JAMAIS AU-DESSUS D'UN GESTE URGENT : tant qu'un geste urgent est à l'écran (un
//     colis en retard, deux paires sous un N°, une alerte qui coûte), la visite ne
//     part PAS d'elle-même (`gesteUrgent`) — elle attend une autre ouverture ;
//   · un bouton absent (écran vide, pas de compte) ⇒ sa bulle est sautée ; aucun
//     bouton présent ⇒ rien n'est montré ET rien n'est noté vu.
// Titres et phrases : les dictionnaires (`vis.<ecran>.<cle>.t` / `.p`, 5 langues),
// 12 mots au plus par phrase. JS pur : scripts/audit-accueil-reste.cjs l'exécute.
import { aideActive, lireAides } from './aides.js';

export const ECRANS_VISITE = Object.freeze(['journee', 'annonces', 'ventes', 'achats']);
// L'onglet de la coque → l'écran de la visite (Ventes et Achats ont leurs alias).
export const ONGLET_VERS_ECRAN = Object.freeze({ journee: 'journee', annonces: 'annonces', cat_annonces: 'annonces', ventes: 'ventes', cat_ventes: 'ventes', achats: 'achats', cat_achats: 'achats' });

// `cible` : l'élément RÉEL (sélecteurs CSS ; le premier visible gagne).
export const ETAPES_ECRANS = Object.freeze({
  journee: [
    { cle: 'geste', cible: '[data-prochain], [data-job]' },
    { cle: 'chiffres', cible: '[data-fu-case]' },
    { cle: 'loupe', cible: '[data-recherche-loupe]' },
    { cle: 'aide', cible: '[data-aide-ouvrir="journee"]' },
  ],
  annonces: [
    { cle: 'cherche', cible: '.vrm-champ-recherche-saisie' },
    { cle: 'numero', cible: '[data-edition="numero"]' },
    { cle: 'republier', cible: '[data-actions-ouvrir]' },
    { cle: 'aide', cible: '[data-aide-ouvrir="annonces"]' },
  ],
  ventes: [
    { cle: 'envoyer', cible: '[data-colis-onglet-choix="envoyer"]' },
    { cle: 'imprimer', cible: '[data-colis-barre-btn="imprimer"]' },
    { cle: 'scanner', cible: '[data-scan-mode-bouton="envoi"]' },
    { cle: 'aide', cible: '[data-aide-ouvrir="ventes"]' },
  ],
  achats: [
    { cle: 'retire', cible: '[data-colis-retire], [data-lg-retire]' },
    { cle: 'relais', cible: '[data-relais-ouvrir]' },
    { cle: 'calculette', cible: '[data-achats-calculette]' },
    { cle: 'aide', cible: '[data-aide-ouvrir="achats"]' },
  ],
});
export const cleTitre = (ecran, cle) => `vis.${ecran}.${cle}.t`;
export const cleTexte = (ecran, cle) => `vis.${ecran}.${cle}.p`;

// Les étapes d'un écran, prêtes pour la bulle (textes passés par `tr`).
export function etapesVisite(ecran, tr) {
  return (ETAPES_ECRANS[ecran] || []).map((e) => ({ cle: `${ecran}-${e.cle}`, cible: e.cible, titre: tr(cleTitre(ecran, e.cle)), texte: tr(cleTexte(ecran, e.cle)) }));
}

// Ce qui est urgent à l'écran (les marques des écrans eux-mêmes) : un onglet de colis
// urgent, le bloc rouge des N° portés deux fois, une carte de Ma journée en retard.
export const SEL_URGENT = '[data-urgent="1"], [data-numeros-double], [data-job="double-vente"], [data-job="retrait-dernier-jour"], [data-retard="1"]';
export function gesteUrgent(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false;
  try {
    for (const el of doc.querySelectorAll(SEL_URGENT)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return true; }
  } catch (_) {}
  return false;
}

// La visite part-elle d'elle-même sur cet écran ? (Le rejeu, lui, part sur SON geste.)
export function visiteAuto(reglage, ecran, { creeLe, maintenant = Date.now(), exemple = false, feuilleOuverte = false, urgent = false, arrivee = false } = {}) {
  if (!ECRANS_VISITE.includes(ecran)) return false;
  if (!aideActive(reglage, 'visite', { creeLe, maintenant, exemple })) return false;
  if (lireAides(reglage).vues[ecran]) return false;
  if (feuilleOuverte || arrivee || urgent) return false;
  return true;
}
