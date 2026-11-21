// ════════════════════════════════════════════════════════════════════════════
//  LE MINI-RÉSUMÉ DE LA CARTE DU LOGO (11 nov., ext. 5.354) — côté APP.
//
//  La carte du logo VRM (vinted-sync-extension/vrm-badge.js) montre, repliée :
//  « Ce mois : 1 340 € vendus · 42 ventes · 3 à expédier ». L'extension ne
//  recalcule RIEN (§5, un propriétaire par règle) : elle lit la ligne que l'app
//  publie déjà pour le widget de l'iPhone (`widget_stats` : `caMois`,
//  `ventesMois`, `caMoisNonComptees`, `updatedAt`).
//
//  Le nombre de colis à expédier, lui, n'était publié QUE sur l'appareil
//  (`vrm_colis_aposter`, le badge de Colis — §11) : l'app le recopie ici dans
//  `widget_stats.aExpedier`, tel quel, avec SA fraîcheur (12 h, la règle du
//  badge `publicationColisFraiche`). Publication absente ou trop vieille ⇒
//  `n: null` (« pas su », la carte dit « — », jamais 0). Un site illisible
//  (eBay, Leboncoin ou Vestiaire à `null`) ⇒ `auMoins` (un minimum, jamais un
//  total partiel présenté complet).
// ════════════════════════════════════════════════════════════════════════════
import { publicationColisFraiche } from './design/carteChiffres.js';

export function aExpedierPourCarte(pub, maintenant = Date.now()) {
  if (!pub || typeof pub !== 'object') return { n: null, auMoins: false, at: null };
  const at = Number(pub.at);
  if (!Number.isFinite(at) || at <= 0 || !Number.isFinite(Number(pub.total)) || !publicationColisFraiche(pub, maintenant)) {
    return { n: null, auMoins: false, at: Number.isFinite(at) && at > 0 ? at : null };
  }
  const auMoins = pub.ebay === null || pub.leboncoin === null || pub.vestiaire === null;
  return { n: Math.max(0, Math.round(Number(pub.total))), auMoins, at };
}
