// MARKET INTELLIGENCE — insight marché (SIMULÉ / mock, comme demandé au spec).
//
// Pas de scraping ni d'API externe : on produit un signal DÉTERMINISTE et
// plausible à partir de la marque (et d'un prix de référence si fourni). Le but
// est de câbler l'UI ; à remplacer plus tard par de vraies données comparables.

export interface MarketInsight {
  brand: string;
  demand: "faible" | "moyenne" | "forte";
  avgPriceRange: { min: number; max: number };
  trend: "hausse" | "stable" | "baisse";
  note: string;
  simulated: true;
}

// Popularité relative de quelques marques (0–1). Sert de base au signal.
const BRAND_HEAT: Record<string, number> = {
  nike: 0.9, jordan: 0.95, adidas: 0.85, "new balance": 0.88, asics: 0.7,
  puma: 0.6, vans: 0.55, converse: 0.5, salomon: 0.75, "yeezy": 0.9,
};

export function marketInsight(brand: string, refPrice?: number): MarketInsight {
  const key = String(brand || "").toLowerCase().trim();
  const heat = BRAND_HEAT[key] ?? hashUnit(key); // marque inconnue → pseudo-aléatoire stable
  const base = refPrice && refPrice > 0 ? refPrice : 45 + heat * 80;

  const demand = heat >= 0.8 ? "forte" : heat >= 0.55 ? "moyenne" : "faible";
  const spread = 0.25 + (1 - heat) * 0.2; // marques moins chaudes = fourchette plus large
  const avgPriceRange = {
    min: Math.round(base * (1 - spread)),
    max: Math.round(base * (1 + spread)),
  };
  // Tendance stable/déterministe dérivée de la marque (mock).
  const t = hashUnit(key + "_trend");
  const trend = t > 0.6 ? "hausse" : t < 0.4 ? "baisse" : "stable";

  return {
    brand: brand || "(inconnue)",
    demand,
    avgPriceRange,
    trend,
    note: `Signal simulé : demande ${demand}, tendance ${trend}. À remplacer par de vraies ventes comparables.`,
    simulated: true,
  };
}

/** Hash déterministe d'une chaîne → [0,1). Même entrée = même sortie. */
function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}
