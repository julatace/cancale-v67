// DECISION ENGINE — quoi faire d'une annonce, avec explication.
//
// Croise la NOTE d'annonce (scoring), l'ENGAGEMENT et le TEMPS ÉCOULÉ pour
// recommander UNE action : améliorer la fiche, ajuster le prix, ou ne rien
// faire. Renvoie toujours un « pourquoi » lisible. Aucune action n'est exécutée
// ici : c'est une recommandation que l'humain suivra ou non.

import { ListingInput, DecisionAction } from "../types.js";
import { scoreListing } from "../scoring-system/index.js";
import { recommendPrice } from "../../services/pricing/index.js";

export interface Decision {
  action: DecisionAction;
  reason: string;
  score: number;
  priceHint?: number;
  urgency: "low" | "medium" | "high";
}

export function decide(it: ListingInput): Decision {
  const s = scoreListing(it);
  const p = recommendPrice(it);
  const age = it.ageDays ?? 0;
  const views = it.views ?? 0;
  const favs = it.favourites ?? 0;

  // 1) Fiche faible → d'abord améliorer la fiche (avant de brader).
  //    Une mauvaise fiche qui ne convertit pas ne se règle pas par le prix.
  const ficheFaible = s.problems.some((x) => /titre|photo|description|marque|taille/i.test(x));
  if (s.score < 55 && ficheFaible) {
    return {
      action: "improve_listing",
      reason: `Note ${s.score}/100 : la fiche a des lacunes (${s.problems.slice(0, 2).join(", ")}). On améliore d'abord la fiche — baisser le prix d'une annonce mal présentée ne convertit pas.`,
      score: s.score,
      urgency: age >= 60 ? "high" : "medium",
    };
  }

  // 2) Fiche correcte mais ça ne bouge pas (vue sans favori / dort) → ajuster le prix.
  const stagne = (views >= 25 && favs === 0) || (age >= 30 && (favs / Math.max(views, 1)) < 0.08);
  if (stagne && p.deltaPct < 0) {
    return {
      action: "adjust_price",
      reason: `Fiche correcte (note ${s.score}) mais l'annonce stagne. ${p.reasoning[0]}`,
      score: s.score,
      priceHint: p.recommendedPrice,
      urgency: p.urgency,
    };
  }

  // 3) Forte demande → tenir (éventuellement monter), ne rien précipiter.
  if (views >= 20 && favs / Math.max(views, 1) >= 0.15) {
    return {
      action: "no_action",
      reason: `Bonne dynamique (note ${s.score}, ${favs} favoris / ${views} vues). Laisse tourner ; tu peux même tenir le prix.`,
      score: s.score,
      urgency: "low",
    };
  }

  // 4) Défaut : rien d'urgent.
  return {
    action: "no_action",
    reason: `Note ${s.score}/100, engagement dans la norme. Rien d'urgent — republie pour un coup de projecteur si tu veux accélérer.`,
    score: s.score,
    urgency: "low",
  };
}
