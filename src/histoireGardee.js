// ════════════════════════════════════════════════════════════════════════════
//  L'HISTOIRE DES N° GARDÉE ENTRE DEUX FICHES (17 nov., lot vitesse-cache)
//  Julien, sur iPhone : « ouvrir une vente ça prend du temps, ça bug ». Mesuré
//  (banc latence-gestes) : chaque fiche relisait TOUTE l'histoire des N° (dressings,
//  ventes de tous les comptes, transactions, bordereaux, Leboncoin, eBay) parce
//  qu'elle était jetée à la fermeture de la précédente.
//  La règle (src/App.jsx, `numData`) :
//   · gardée seulement si sa lecture était COMPLÈTE (une lecture ratée, « pas su »,
//     n'est jamais gardée au-delà de la fiche ouverte) ;
//   · fraîche tant qu'aucune donnée n'a changé depuis sa lecture — la génération
//     des écrans gardés (src/ecransGardes.jsx : sauvegarde qui compte, signal de
//     l'extension ou des transporteurs, relecture du nuage, retour au premier plan
//     après 20 s) — et au plus AGE_MAX_CACHE_MS (10 min) ;
//   · pas fraîche ⇒ OUBLIÉE avant d'être relue : la fiche dit « lecture… », jamais
//     l'ancienne histoire présentée comme fraîche.
// ════════════════════════════════════════════════════════════════════════════
import { generationDonnees, AGE_MAX_CACHE_MS } from './ecransGardes.jsx';

export const numDataGardable = (q) => !!(q && q.complet === true);
export function numDataFrais(q, maintenant = Date.now(), gen = generationDonnees()) {
  if (!numDataGardable(q)) return false;
  if (q.gen !== gen) return false;
  return Number.isFinite(q.at) && maintenant - q.at >= 0 && maintenant - q.at < AGE_MAX_CACHE_MS;
}
