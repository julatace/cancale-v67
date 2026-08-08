// PRICING ENGINE — prix recommandé + raisonnement + urgence.
//
// Entrées : prix de base, vues, favoris, temps en ligne (+ prix comparable
// optionnel). Sortie : prix recommandé, explication lisible, niveau d'urgence.
// 100 % déterministe et explicable — aucune boîte noire.

import { ListingInput, Urgency, psychologicalPrice, clamp } from "../../core/types.js";

export interface PriceRecommendation {
  currentPrice: number;
  recommendedPrice: number;
  deltaPct: number;      // variation conseillée en %
  urgency: Urgency;
  reasoning: string[];   // pourquoi, en clair
  tips: string[];        // astuces prix psychologique
}

export function recommendPrice(it: ListingInput): PriceRecommendation {
  const price = it.price;
  const views = it.views ?? 0;
  const favs = it.favourites ?? 0;
  const age = it.ageDays ?? 0;
  const reasoning: string[] = [];
  const tips: string[] = [];

  // Demande = favoris rapportés aux vues (intérêt réel), pondérée par le volume.
  const favRate = views > 0 ? favs / views : 0;
  let delta = 0; // variation en fraction (−0.15 = −15 %)

  if (views >= 20 && favRate >= 0.15) {
    // Forte demande : on tient, voire on monte un peu.
    delta = favRate >= 0.25 ? +0.05 : 0;
    reasoning.push(`Forte demande : ${favs} favoris pour ${views} vues (${Math.round(favRate * 100)} %). Tu peux tenir le prix${delta > 0 ? ", voire le monter légèrement" : ""}.`);
  } else if (views >= 25 && favs === 0) {
    // Beaucoup vue, pas désirée → prix perçu trop haut.
    delta = -0.12;
    reasoning.push(`${views} vues mais 0 favori : le prix est perçu trop haut. Une baisse d'environ 12 % débloque souvent l'intérêt.`);
  } else if (age >= 30 && favRate < 0.08) {
    // Dort et peu d'intérêt → baisse proportionnelle à l'âge.
    delta = age >= 90 ? -0.2 : age >= 60 ? -0.15 : -0.1;
    reasoning.push(`En ligne depuis ${age} j avec peu d'accroche : une baisse de ${Math.abs(Math.round(delta * 100))} % la fait remonter dans le fil et relance les vues.`);
  } else if (views < 5 && age >= 14) {
    // Peu vue : le problème est la visibilité, pas forcément le prix.
    delta = -0.05;
    reasoning.push(`Peu de vues (${views}) : d'abord un souci de visibilité. Une petite baisse (5 %) + une republication valent mieux qu'une grosse casse de prix.`);
  } else {
    reasoning.push("Engagement dans la norme : garde le prix et laisse le temps faire, ou republie pour un coup de projecteur.");
  }

  // Plancher : ne jamais conseiller sous le prix d'achat (si connu) + petite marge.
  let recommended = price * (1 + delta);
  if (it.buyPriceFloor != null && recommended < it.buyPriceFloor) {
    recommended = it.buyPriceFloor;
    reasoning.push(`Bloqué à ${Math.round(recommended)} € : ne descends pas sous ton prix d'achat.`);
  }

  recommended = psychologicalPrice(recommended);
  tips.push("Un prix en …,90 se lit « moins cher » qu'un rond (42,90 plutôt que 45).");
  if (delta < 0) tips.push("Baisser de plusieurs euros d'un coup notifie parfois les personnes qui ont mis en favori.");

  const deltaPct = price > 0 ? Math.round(((recommended - price) / price) * 100) : 0;
  const urgency: Urgency = age >= 90 || (views >= 25 && favs === 0)
    ? "high"
    : age >= 30 ? "medium" : "low";

  return {
    currentPrice: Math.round(price * 100) / 100,
    recommendedPrice: Math.round(recommended * 100) / 100,
    deltaPct: clamp(deltaPct, -60, 60),
    urgency,
    reasoning,
    tips,
  };
}
