// Pont IA OPTIONNEL (Anthropic). Sans clé → renvoie null, et l'appelant retombe
// sur la logique déterministe. La clé ne vit QUE côté serveur (env), jamais dans
// l'extension ni le dashboard.

import type { Intent, ReplySuggestion } from "../../../core/types.js";

const MODEL = process.env.AI_MODEL || "claude-haiku-4-5-20251001";

export function aiEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

interface AiReply {
  intent: Intent;
  confidence: number;
  suggestions: ReplySuggestion[];
}

/** Réponses générées par le LLM. Renvoie null si pas de clé ou en cas d'échec
 *  (l'appelant garde alors les suggestions déterministes). */
export async function aiReplySuggestions(
  message: string,
  ctx?: { price?: number; article?: string },
): Promise<AiReply | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const sys =
    "Tu es un vendeur français d'occasion sympathique et efficace. On te donne le message d'un ACHETEUR. Tu proposes des réponses que le vendeur relira et enverra LUI-MÊME (tu n'envoies rien). Réponses HUMAINES : variées, naturelles, petites variations, jamais robotiques ni répétées. Français, courtes, 0–2 émojis. N'invente aucune info. Réponds STRICTEMENT en JSON.";
  const user = `Article : ${ctx?.article || "(inconnu)"}${ctx?.price != null ? ` — prix ${ctx.price} €` : ""}
Message acheteur : "${message}"
JSON attendu : {"intent":"interet|negociation|hesitation|offre_basse|question|autre","confidence":0-100,"suggestions":[{"tone":"court","text":"..."},{"tone":"chaleureux","text":"..."},{"tone":"pro","text":"..."}]}
Donne 3 à 5 suggestions, tons différents, prêtes à copier.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: sys, messages: [{ role: "user", content: user }] }),
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    const text = (j.content || []).map((c: any) => c.text || "").join("").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    if (!parsed || !Array.isArray(parsed.suggestions)) return null;
    return {
      intent: (parsed.intent || "autre") as Intent,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 60)),
      suggestions: parsed.suggestions.slice(0, 5).map((s: any) => ({ tone: String(s.tone || ""), text: String(s.text || "") })).filter((s: ReplySuggestion) => s.text),
    };
  } catch {
    return null;
  }
}
