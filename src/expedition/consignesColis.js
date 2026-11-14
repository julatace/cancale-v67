// ════════════════════════════════════════════════════════════════════════════
//  IDÉE 153 — CE QUE DEMANDE CHAQUE PLATEFORME POUR LE COLIS (14 nov.)
// ════════════════════════════════════════════════════════════════════════════
//  Dit AU BON MOMENT : à la préparation du colis (« Préparer mes colis », le mode samedi),
//  une fois par plateforme (l'en-tête du groupe, §7 : la même phrase n'est pas redite sur
//  chaque ligne). Les textes sont des clés `tr()` (5 langues), courts.
//
//  ⚠️ RIEN D'INVENTÉ. Un délai n'est écrit que s'il est LU pour CE colis (la date limite de
//  l'e-mail du bordereau Vinted, celle que Vestiaire donne, celle d'eBay) ; sinon la phrase
//  renvoie à la plateforme. La seule règle générale chiffrée est celle que VRM a MESURÉE
//  (api/_lib/limite-envoi.js : sur 202 ventes Vinted, la vraie limite ne tombe JAMAIS avant
//  vente + 7 jours) — dite « au plus tôt », jamais comme la limite.
//  ⚠️ eBay (§2.8) : l'acheteur a payé le port à eBay, l'étiquette est PRÉPAYÉE par eBay ; VRM
//  n'achète rien et n'ouvre aucune route d'achat d'étiquette : la consigne renvoie à eBay.
//  Les pages d'aide citées (SOURCES) sont celles à relire si une plateforme change ses règles
//  (récit : docs/passation/2026-11-14-idees-expedition.md).
// ════════════════════════════════════════════════════════════════════════════

export const PLATEFORMES_COLIS = Object.freeze(['vinted', 'leboncoin', 'ebay', 'vestiaire']);

// Les consignes, dans l'ordre du geste (bordereau → emballage → dépôt → délai).
export const CONSIGNES = Object.freeze({
  vinted: Object.freeze(['exp.consigne.vinted.bordereau', 'exp.consigne.vinted.emballage', 'exp.consigne.vinted.depot']),
  leboncoin: Object.freeze(['exp.consigne.leboncoin.bordereau', 'exp.consigne.leboncoin.emballage', 'exp.consigne.leboncoin.depot']),
  ebay: Object.freeze(['exp.consigne.ebay.etiquette', 'exp.consigne.ebay.emballage', 'exp.consigne.ebay.depot']),
  vestiaire: Object.freeze(['exp.consigne.vestiaire.centre', 'exp.consigne.vestiaire.emballage', 'exp.consigne.vestiaire.bordereau']),
});
// La phrase du délai : lue pour ce colis ⇒ `limite` (le texte déjà dit par l'écran Colis) ; pas lue ⇒ la règle de la plateforme.
export const DELAI_PAS_LU = Object.freeze({
  vinted: 'exp.delai.vinted.pasLu',
  leboncoin: 'exp.delai.leboncoin.pasLu',
  ebay: 'exp.delai.ebay.pasLu',
  vestiaire: 'exp.delai.vestiaire.pasLu',
});
export const SOURCES = Object.freeze({
  vinted: 'https://www.vinted.fr/help',
  leboncoin: 'https://assistance.leboncoin.info',
  ebay: 'https://www.ebay.fr/help/selling/shipping-items',
  vestiaire: 'https://faq.vestiairecollective.com',
});

// Ce que l'écran dit pour un groupe de colis d'une plateforme : { titre, lignes: [clé], delai: { cle, vars } }.
// `limite` : le texte de la date limite LUE (ou '' : pas lue).
export function consignesPour(site, limite = '') {
  if (!PLATEFORMES_COLIS.includes(site)) return null;
  const lu = typeof limite === 'string' && limite.trim() !== '';
  return {
    site,
    titre: `exp.consigne.${site}.titre`,
    lignes: [...CONSIGNES[site]],
    delai: lu ? { cle: 'exp.delai.lu', vars: { limite: limite.trim() } } : { cle: DELAI_PAS_LU[site], vars: {} },
    source: SOURCES[site],
  };
}
