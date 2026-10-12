// ── LA PAGE D'ACCUEIL PUBLIQUE : CE QUI CHANGE LE JOUR J ─────────────────────
// Un seul endroit à changer, et le banc (scripts/bancs/accueil.cjs) lit ces
// valeurs pour juger la page rendue : une phrase qui dépend d'un réglage ne
// s'affiche que si le réglage le permet.

// L'accès est offert tant que l'abonnement n'est pas exigé
// (`vrm_reglages.abonnement_obligatoire` = '0'). Le jour où Julien le passe à
// '1' : mettre `false` ici — « Gratuit pour l'instant » et « Aucune carte
// bancaire » disparaissent d'un coup de toute la page.
export const ACCES_OFFERT = true;

// `true` le jour où la fiche de l'extension existe sur le Chrome Web Store
// (aujourd'hui elle s'installe à la main, VRM guide pas à pas).
export const EXTENSION_SUR_LE_STORE = false;

// `true` quand le détourage Photoroom est ouvert à tous les vendeurs
// (`PHOTOROOM_POUR=tous`, chantier Vestiaire + Photoroom). Tant qu'il vaut
// `false`, la page n'en dit RIEN : il est réservé au propriétaire.
export const DETOURAGE_POUR_TOUS = false;

// `true` quand VRM compte vraiment les ventes Vestiaire Collective. Tant qu'il
// vaut `false`, Vestiaire n'apparaît que dans la FAQ (« pas encore »).
export const VESTIAIRE_BRANCHE = false;

// Le prix des CGV (public/legal/cgv.html : « abonnement à 12,99 € par mois »,
// depuis le 11 octobre — 9,99 € avant). Le banc compare les deux : la page ne
// peut pas dire un autre prix.
export const PRIX_MOIS = '12,99';
