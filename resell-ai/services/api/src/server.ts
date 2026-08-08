// API RESELL AI — câble tous les moteurs derrière des routes HTTP simples.
// AUCUN effet de bord externe : on lit des entrées, on renvoie des suggestions.
// Rien n'est envoyé sur une plateforme tierce depuis ici.

import express from "express";
import cors from "cors";
import { z } from "zod";

import { scoreListing } from "../../../core/scoring-system/index.js";
import { decide } from "../../../core/decision-engine/index.js";
import { analyzeMessage } from "../../messaging/index.js";
import { recommendPrice } from "../../pricing/index.js";
import { improveListing } from "../../visibility/index.js";
import { marketInsight } from "../../market-intelligence/index.js";
import { aiEnabled, aiReplySuggestions } from "./ai.js";
import { getStore } from "./store.js";

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: (process.env.CORS_ORIGIN || "*") === "*" ? true : process.env.CORS_ORIGIN!.split(",") }));

const store = await getStore();

const listingSchema = z.object({
  title: z.string().default(""),
  description: z.string().optional(),
  brand: z.string().nullish(),
  size: z.string().nullish(),
  condition: z.string().nullish(),
  price: z.number().nonnegative().default(0),
  photoCount: z.number().int().optional(),
  descLen: z.number().int().optional(),
  views: z.number().int().optional(),
  favourites: z.number().int().optional(),
  ageDays: z.number().optional(),
  peerPrice: z.number().nullish(),
  buyPriceFloor: z.number().nullish(),
});

// ── Santé ────────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, ai: aiEnabled(), store: store.kind }));

// ── Messaging Intelligence ────────────────────────────────────────────────────
// Analyse un message d'acheteur → intention + réponses suggérées.
// L'IA affine si disponible ; sinon gabarits variés. TOUJOURS des suggestions,
// jamais un envoi.
app.post("/messaging/analyze", async (req, res) => {
  const body = z.object({ message: z.string().min(1), price: z.number().optional(), article: z.string().optional(), itemId: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ ok: false, error: "message requis" });
  const { message, price, article, itemId } = body.data;

  const base = analyzeMessage(message, { price, article }); // déterministe (toujours)
  const ai = await aiReplySuggestions(message, { price, article }); // optionnel
  const result = ai
    ? { intent: ai.intent, confidence: ai.confidence, signals: base.signals, suggestions: ai.suggestions, source: "ai" as const }
    : { ...base, source: "rules" as const };

  if (itemId) await store.saveSuggestion(itemId, "reply", result).catch(() => {});
  res.json({ ok: true, ...result });
});

// ── Pricing ───────────────────────────────────────────────────────────────────
app.post("/pricing/recommend", async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues });
  const rec = recommendPrice(parsed.data);
  if (req.body?.itemId) await store.saveSuggestion(req.body.itemId, "price", rec).catch(() => {});
  res.json({ ok: true, ...rec });
});

// ── Listing optimization ────────────────────────────────────────────────────
app.post("/listing/improve", async (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues });
  const out = improveListing(parsed.data);
  const score = scoreListing(parsed.data);
  if (req.body?.itemId) await store.saveSuggestion(req.body.itemId, "listing", out).catch(() => {});
  res.json({ ok: true, ...out, score });
});

// ── Decision engine ───────────────────────────────────────────────────────────
app.post("/decision", (req, res) => {
  const parsed = listingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.issues });
  res.json({ ok: true, ...decide(parsed.data) });
});

// ── Market insight (simulé) ─────────────────────────────────────────────────
app.get("/market/:brand", (req, res) => {
  const ref = req.query.price ? Number(req.query.price) : undefined;
  res.json({ ok: true, ...marketInsight(req.params.brand, ref) });
});

// ── Items (dashboard) : chaque item + sa note + sa décision recommandée. ──────
app.get("/items", async (_req, res) => {
  const items = await store.listItems();
  const enriched = items.map((it) => {
    const input = { ...it, buyPriceFloor: it.buyPrice ?? null };
    return { ...it, score: scoreListing(input).score, decision: decide(input), pricing: recommendPrice(input) };
  });
  res.json({ ok: true, items: enriched });
});

app.listen(PORT, () => {
  console.log(`RESELL AI API → http://localhost:${PORT}  (store: ${store.kind}, IA: ${aiEnabled() ? "on" : "off"})`);
});
