// VISIBILITY / LISTING OPTIMIZATION — améliore titre + description.
//
// Déterministe : on reconstruit un titre propre (marque + modèle + taille +
// état) à partir des champs connus, on suggère des mots-clés utiles, et on
// étoffe la description SANS RIEN INVENTER (on ne parle que de ce qu'on sait).
// La version IA (api/ai.ts) reformule plus finement quand une clé est présente.

import { ListingInput } from "../../core/types.js";

export interface ListingImprovement {
  title: string;
  description: string;
  keywords: string[];
  notes: string[];
}

export function improveListing(it: ListingInput): ListingImprovement {
  const notes: string[] = [];
  const parts: string[] = [];

  // Titre : marque + (ce qui reste du titre, nettoyé) + taille + état.
  const rawTitle = (it.title || "").replace(/\s+/g, " ").trim();
  if (it.brand && !new RegExp(escapeRe(it.brand), "i").test(rawTitle)) parts.push(it.brand);
  parts.push(rawTitle);
  if (it.size && !new RegExp(`\\b${escapeRe(String(it.size))}\\b`, "i").test(rawTitle)) parts.push(`T.${it.size}`);
  if (it.condition && !new RegExp("état|neuf|bon", "i").test(rawTitle)) parts.push(it.condition);
  let title = dedupeWords(parts.filter(Boolean).join(" ")).slice(0, 70);
  if (title.length >= 68) notes.push("Titre resserré à 70 caractères (limite Vinted).");

  // Description : on garde l'existante et on complète les champs manquants,
  // toujours honnêtement.
  const lines: string[] = [];
  if (it.description && it.description.trim()) lines.push(it.description.trim());
  const bullets: string[] = [];
  if (it.brand) bullets.push(`Marque : ${it.brand}`);
  if (it.size) bullets.push(`Taille : ${it.size}`);
  if (it.condition) bullets.push(`État : ${it.condition}`);
  if (bullets.length) lines.push(bullets.join(" · "));
  if (!/envoi|exp[ée]di|remise/i.test(it.description || "")) lines.push("Envoi rapide et soigné 📦");
  const description = lines.join("\n").slice(0, 600);

  // Mots-clés utiles (aident la recherche interne). On ne bourre pas.
  const keywords = uniq([
    it.brand,
    it.size ? `taille ${it.size}` : null,
    it.condition,
    ...guessCategoryKeywords(rawTitle),
  ].filter(Boolean) as string[]).slice(0, 8);

  if (!it.brand) notes.push("Ajoute la marque : c'est le 1er filtre de recherche.");
  if ((it.photoCount ?? 0) < 3) notes.push("Vise 3 photos minimum (face, semelle/dos, défaut éventuel).");

  return { title, description, keywords, notes };
}

function guessCategoryKeywords(title: string): string[] {
  const t = title.toLowerCase();
  const out: string[] = [];
  if (/basket|sneaker|air|jordan|dunk|samba|gazelle|new balance|nb\b/.test(t)) out.push("sneakers", "baskets");
  if (/veste|manteau|pull|sweat|hoodie|jean|pantalon|robe|chemise/.test(t)) out.push("vêtement");
  return out;
}

function dedupeWords(s: string): string {
  const seen = new Set<string>();
  return s.split(" ").filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).join(" ");
}
const uniq = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];
function escapeRe(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
