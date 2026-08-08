// SCORING SYSTEM — note d'annonce 0–100, 100 % déterministe.
//
// On part de 100 et on RETIRE des points pour chaque défaut RÉELLEMENT constaté
// (champ présent). Un champ absent ne retire jamais de point : pas de faux procès.
// Repris de la logique éprouvée de VRM (scoreAnnonce), généralisé.

import { ListingInput, clamp } from "../types.js";

export interface ScoreResult {
  score: number;
  cls: "top" | "mid" | "low";
  problems: string[];
  advice: string[];
}

const WORDY = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function scoreListing(it: ListingInput): ScoreResult {
  let score = 100;
  const problems: string[] = [];
  const advice: string[] = [];
  const has = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== "";

  // 1) Titre pauvre
  const title = it.title || "";
  if (WORDY(title) < 3) { score -= 12; problems.push("Titre trop court"); advice.push("Ajoute marque + modèle + taille au titre."); }
  if (has(it.brand) && !new RegExp(escapeRe(String(it.brand)), "i").test(title)) { score -= 6; advice.push("Mets la marque dans le titre (c'est ce qu'on cherche)."); }
  if (has(it.size) && !new RegExp(`\\b${escapeRe(String(it.size))}\\b`, "i").test(title)) { score -= 5; advice.push("Indique la taille dans le titre."); }

  // 2) Fiche incomplète
  const photos = it.photoCount ?? 0;
  if (photos > 0 && photos < 3) { score -= 10; problems.push("Moins de 3 photos"); advice.push("3 photos minimum : face, semelle, défauts."); }
  if (!has(it.brand)) { score -= 5; advice.push("Renseigne la marque."); }
  if (!has(it.size)) { score -= 5; advice.push("Renseigne la taille."); }
  const descLen = it.descLen ?? (it.description ? it.description.length : 0);
  if (descLen > 0 && descLen < 20) { score -= 8; problems.push("Description trop courte"); advice.push("Décris l'état, la matière, les défauts."); }

  // 3) Âge (l'annonce dort)
  const age = it.ageDays ?? 0;
  if (age >= 90) { score -= 18; problems.push("En ligne depuis 90 j+"); advice.push("Republie ou baisse nettement le prix."); }
  else if (age >= 60) { score -= 12; problems.push("En ligne depuis 60 j+"); }
  else if (age >= 30) { score -= 7; problems.push("En ligne depuis 30 j+"); advice.push("Une baisse de prix relance souvent les vues."); }

  // 4) Engagement
  const views = it.views ?? 0;
  const favs = it.favourites ?? 0;
  if (views >= 30 && favs === 0) { score -= 10; problems.push("Beaucoup de vues, aucun favori"); advice.push("Vue mais pas désirée → prix perçu trop haut."); }
  else if (views > 0 && views < 5 && age >= 14) { score -= 6; problems.push("Peu vue"); advice.push("Republie pour remonter dans le fil."); }

  // 5) Prix vs comparables
  if (has(it.peerPrice) && it.peerPrice! > 0) {
    const ratio = it.price / it.peerPrice!;
    if (ratio > 1.3) { score -= 8; problems.push("Prix au-dessus du marché"); advice.push(`Des paires comparables sont autour de ${Math.round(it.peerPrice!)} €.`); }
  }

  score = clamp(Math.round(score), 0, 100);
  const cls: ScoreResult["cls"] = score >= 80 ? "top" : score >= 55 ? "mid" : "low";
  return { score, cls, problems, advice };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
