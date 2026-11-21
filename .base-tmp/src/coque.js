// ═══════════════════════════════════════════════════════════════════════════
// LA COQUE : TÉLÉPHONE, TABLETTE OU ORDINATEUR (11 nov., chantier iPad)
// ═══════════════════════════════════════════════════════════════════════════
// Une notion, une règle : ces requêtes sont la SEULE définition de « quelle
// coque ». Les CSS de la coque les recopient MOT POUR MOT (une requête média
// ne peut pas lire une constante JavaScript) ; `scripts/audit-coque-tablette.cjs`
// refuse toute copie qui s'en écarte, ou une ancienne copie restée en place.
//
// Le choix se fait sur la LARGEUR et le POINTEUR, jamais sur le nom de
// l'appareil (iPadOS se présente comme un Mac) :
//   · ordinateur : ≥ 1024 px, ou ≥ 768 px à la souris (Edge en demi-écran) ;
//   · tablette : au doigt (pas de survol, ou pointeur grossier), ≥ 744 px de
//     large (l'iPad mini en portrait) et ≥ 600 px de haut — un iPhone couché
//     (932 × 430) reste un téléphone. La tablette prend la coque ORDINATEUR
//     (rail à gauche, île, liste et fiche côte à côte) avec des commandes de
//     44 px et rien qui attende un survol (src/styles-tablette.css) ;
//     « large » ≥ 1024 px (paysage, iPad Pro portrait), « étroite » en dessous
//     (portrait : rail resserré, icône et libellé court) ;
//   · téléphone : tout le reste. MQ_TELEPHONE est le complément EXACT de
//     MQ_ORDINATEUR (aucune largeur n'a deux coques, aucune n'en a zéro).
// Tourner l'iPad ne change jamais de coque : l'écran n'est pas remonté, la
// fiche ouverte et le défilement restent (banc scripts/bancs/ipad.cjs).
// ═══════════════════════════════════════════════════════════════════════════

const AU_DOIGT = ['(hover: none)', '(pointer: coarse)', '(pointer: none)'];

export const MQ_ORDINATEUR = ['(min-width: 1024px)', '(min-width: 768px) and (hover: hover) and (pointer: fine)',
  ...AU_DOIGT.map((p) => `(min-width: 744px) and (min-height: 600px) and ${p}`)].join(', ');

export const MQ_TELEPHONE = ['(max-width: 743px)', '(max-width: 767px) and (hover: hover) and (pointer: fine)',
  ...AU_DOIGT.map((p) => `(max-width: 1023px) and (max-height: 599px) and ${p}`)].join(', ');

export const MQ_TABLETTE_LARGE = AU_DOIGT.map((p) => `(min-width: 1024px) and ${p}`).join(', ');

export const MQ_TABLETTE_ETROITE = AU_DOIGT.map((p) => `(min-width: 744px) and (max-width: 1023px) and (min-height: 600px) and ${p}`).join(', ');

// '' (pas une tablette) · 'large' · 'etroite'. `mm` : window.matchMedia (injectable pour l'audit).
export function dispositionTablette(mm) {
  try {
    const m = mm || (typeof window !== 'undefined' && window.matchMedia && window.matchMedia.bind(window));
    if (!m) return '';
    if (m(MQ_TABLETTE_ETROITE).matches) return 'etroite';
    if (m(MQ_TABLETTE_LARGE).matches) return 'large';
  } catch (_) {}
  return '';
}
