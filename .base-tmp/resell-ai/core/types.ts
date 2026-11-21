// Types partagés par tous les moteurs. Aucune dépendance, aucun I/O.

export interface ListingInput {
  title: string;
  description?: string;
  brand?: string | null;
  size?: string | null;
  condition?: string | null;
  price: number;
  photoCount?: number;
  descLen?: number;
  views?: number;
  favourites?: number;
  ageDays?: number;       // ancienneté de mise en ligne
  peerPrice?: number | null; // prix médian de paires comparables (même marque+taille)
  buyPriceFloor?: number | null; // plancher : ne pas conseiller un prix sous l'achat
}

export type Urgency = "low" | "medium" | "high";

export type DecisionAction = "improve_listing" | "adjust_price" | "no_action";

export type Intent =
  | "interet"
  | "negociation"
  | "hesitation"
  | "offre_basse"
  | "question"
  | "autre";

export type Tone = "court" | "chaleureux" | "pro";

export interface ReplySuggestion {
  tone: Tone | string;
  text: string;
}

/** Petit utilitaire : borne une valeur dans [min, max]. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

/** Prix psychologique : arrondit joliment (…,90 / …,99 selon le palier). */
export function psychologicalPrice(p: number): number {
  if (p <= 0) return 0;
  if (p < 15) return Math.round(p) - 0.1 <= 0 ? Math.round(p) : Math.floor(p) + 0.9;
  if (p < 100) return Math.floor(p) + 0.9;   // 42,90
  return Math.round(p / 5) * 5 - 0.1;        // 145 → 144,90 arrondi au pas de 5
}
