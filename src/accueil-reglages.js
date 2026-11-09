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

// Le prix des CGV (public/legal/cgv.html : « abonnement à 16,99 € par mois », depuis le 31 octobre — 14,99 € du 27 au 31 oct.,
// depuis le 27 octobre — 12,99 € avant, 9,99 € avant le 11 octobre). Le banc
// compare les deux : la page ne peut pas dire un autre prix.
export const PRIX_MOIS = '16,99';
// (9 nov.) Deux offres. Solo = `PRIX_MOIS` (un compte vendeur + comptes d'achat).
// Pro = les ventes de tous les comptes, 19,99 € / mois (décision de Julien du
// 9 nov.) — le même montant que `PRIX_PRO_CGV` (api/compte.js) et les CGV. Le
// paiement Pro reste fermé tant que son prix Stripe n'est pas posé
// (`STRIPE_PRIX_PRO`) : la page dit « bientôt ».
export const PRIX_PRO_MOIS = '19,99';
// `true` le jour où le paiement Pro est ouvert (prix Stripe posé, `STRIPE_PRIX_PRO`) : la page cesse de dire « bientôt ».
export const PRO_OUVERT = false;

// (8 nov.) La durée de l'essai gratuit : celle que donne le serveur
// (api/compte.js `trial_period_days`, api/_lib/relances-essai.js
// `DUREE_ESSAI_JOURS`) et que disent les CGV (« essai gratuit de 7 jours »).
// Le banc compare les trois : la page ne peut pas promettre une autre durée.
export const ESSAI_JOURS = '7';
