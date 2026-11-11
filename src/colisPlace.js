// ════════════════════════════════════════════════════════════════════════════
//  OÙ VIVENT LES COLIS (11 nov., lot DJ3)
//  Julien, mot pour mot : « Je pense que tu peux regrouper les colis à expédier
//  dans les ventes, les colis à retirer dans achats, ça évite les répétitions et
//  les erreurs. En veillant à bien tout garder, simplement déplacer pour pas
//  avoir 2 fois la même chose. »
//
//  L'onglet Colis (`cat_bord`) n'existe plus dans le menu. Ses deux moitiés
//  vivent en SECTION de tête :
//    · « À expédier » (À envoyer · Envoyés) en tête de Ventes ;
//    · « À retirer » en tête d'Achats.
//  Ce module ne porte que la RÈGLE (sans React) : où mène un ancien chemin vers
//  Colis — un lien `?tab=cat_bord`, une notification, la reprise, un raccourci,
//  une ligne d'À trancher, la recherche. Il est lu par `setTab` (App.jsx) et par
//  `poserCible` ; les audits l'exécutent.
//
//  ⚠️ Rien n'est deviné : un chemin qui ne dit pas « retirer » mène aux colis à
//  expédier (la moitié que l'ancien Colis ouvrait par défaut quand rien n'était
//  urgent). Un chemin qui dit « retirer » — le sous-onglet `retirer`, l'onglet
//  demandé `retirer`, une cible « retrait » ou la colonne « À retirer », les
//  anciens écrans `retraits` / `cat_achats` — mène à Achats.
// ════════════════════════════════════════════════════════════════════════════

export const ONGLETS_COLIS = Object.freeze(['cat_bord', 'cat_expedition']);
export const ONGLETS_RETRAIT = Object.freeze(['retraits', 'cat_achats']);
const SITES = ['vinted', 'leboncoin', 'ebay', 'vestiaire'];

// Une cible de notification (src/cibleNotif.js) qui désigne un colis À RETIRER.
export const cibleDeRetrait = (c) => !!(c && (c.type === 'retrait' || (c.type === 'colonne' && c.colonne === 'retirer')));
// Une cible qui désigne un colis ENVOYÉ (la colonne « Partis »).
const cibleEnvoyes = (c) => !!(c && c.type === 'colonne' && c.colonne === 'partis');

// tab    : l'onglet demandé ;
// sub    : la rubrique demandée (`retirer`, `leboncoin`, `site:ebay`, un site…) ;
// onglet : l'onglet de Colis demandé (`envoyer` · `envoyes` · `retirer`), ou null ;
// cible  : la cible posée par une notification (fraîche), ou null.
// Rend { tab, sub, onglet } — ou null quand `tab` n'est pas un ancien chemin vers Colis.
export function placeDesColis({ tab, sub = null, onglet = null, cible = null } = {}) {
  if (ONGLETS_RETRAIT.includes(tab)) return { tab: 'achats', sub: null, onglet: 'retirer' };
  if (!ONGLETS_COLIS.includes(tab)) return null;
  if (sub === 'retirer' || onglet === 'retirer' || cibleDeRetrait(cible)) return { tab: 'achats', sub: null, onglet: 'retirer' };
  let site = null;
  if (typeof sub === 'string') {
    const s = sub.startsWith('site:') ? sub.slice(5) : sub;
    if (SITES.includes(s)) site = s;
  }
  const o = (onglet === 'envoyes' || cibleEnvoyes(cible)) ? 'envoyes' : 'envoyer';
  // Sans site demandé : « Toutes » (tous les colis, comme l'ancien Colis par défaut), jamais le filtre
  // retenu d'hier (Ventes · eBay · « À traiter » cacherait la section).
  return { tab: 'ventes', sub: site || 'toutes', onglet: o };
}

// L'écran qu'attend une cible posée pour `tab` (déjà redirigé) : une cible de
// retrait vit dans Achats, même quand l'appelant a calculé « Ventes ».
export const ecranDeCible = (tab, c) => (tab === 'ventes' && cibleDeRetrait(c) ? 'achats' : tab);
