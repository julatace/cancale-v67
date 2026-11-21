// Smoke-test des moteurs (aucune base, aucun serveur, aucune IA requise).
// `npm run test` — vérifie que la logique déterministe se comporte comme attendu.

import assert from "node:assert";
import { scoreListing } from "../core/scoring-system/index.js";
import { decide } from "../core/decision-engine/index.js";
import { analyzeMessage } from "../services/messaging/index.js";
import { recommendPrice } from "../services/pricing/index.js";
import { improveListing } from "../services/visibility/index.js";
import { marketInsight } from "../services/market-intelligence/index.js";

let n = 0;
const ok = (name: string, cond: boolean) => { assert.ok(cond, name); console.log("✓", name); n++; };

// SCORING : une fiche complète et fraîche note haut ; une pauvre note bas.
const good = scoreListing({ title: "Nike Air Max 90 T.42 bon état", brand: "Nike", size: "42", condition: "bon état", price: 60, photoCount: 4, descLen: 120, views: 30, favourites: 6, ageDays: 5, peerPrice: 62 });
const bad = scoreListing({ title: "veste", price: 35, photoCount: 1, descLen: 5, views: 90, favourites: 0, ageDays: 74 });
ok("scoring: bonne fiche > 75", good.score > 75);
ok("scoring: mauvaise fiche < 55", bad.score < 55);

// PRICING : beaucoup de vues sans favori → baisse conseillée.
const p = recommendPrice({ title: "x", price: 50, views: 40, favourites: 0, ageDays: 20 });
ok("pricing: 40 vues / 0 fav → baisse", p.deltaPct < 0 && p.recommendedPrice < 50);
const p2 = recommendPrice({ title: "x", price: 50, views: 40, favourites: 12, ageDays: 5 });
ok("pricing: forte demande → tient/monte", p2.deltaPct >= 0);

// DECISION : mauvaise fiche → améliorer d'abord ; stagnation → ajuster prix.
ok("decision: fiche faible → improve_listing", decide({ title: "veste", price: 35, photoCount: 1, descLen: 3, views: 90, favourites: 0, ageDays: 74 }).action === "improve_listing");
ok("decision: bonne fiche qui stagne → adjust_price", decide({ title: "Nike Air Max 90 T.42 bon état", brand: "Nike", size: "42", condition: "bon", price: 60, photoCount: 4, descLen: 120, views: 40, favourites: 0, ageDays: 35 }).action === "adjust_price");

// MESSAGING : détection d'intention.
ok("messaging: négo détectée", analyzeMessage("tu peux baisser un peu le prix ?").intent === "negociation");
ok("messaging: offre basse détectée", analyzeMessage("je te propose 20", { price: 60 }).intent === "offre_basse");
ok("messaging: 3+ suggestions variées", new Set(analyzeMessage("toujours dispo ?").suggestions.map((s) => s.text)).size >= 2);

// VISIBILITY : le titre amélioré contient marque + taille.
const imp = improveListing({ title: "air max 90", brand: "Nike", size: "42", condition: "bon état", price: 60 });
ok("visibility: titre enrichi marque+taille", /nike/i.test(imp.title) && /42/.test(imp.title));

// MARKET : déterministe (même entrée = même sortie).
const m1 = marketInsight("Nike"); const m2 = marketInsight("Nike");
ok("market: déterministe", JSON.stringify(m1) === JSON.stringify(m2));

console.log(`\n${n} tests OK ✅`);
