// MESSAGING INTELLIGENCE — analyse d'un message acheteur → intention + réponses.
//
// Deux niveaux :
//  1) DÉTERMINISTE (toujours dispo, hors ligne) : détection d'intention par
//     signaux linguistiques + génération de réponses par gabarits VARIÉS (on
//     tire au sort la formulation pour ne jamais répéter le même texte).
//  2) IA (optionnelle) : si une clé Anthropic est fournie, on demande au LLM des
//     réponses plus naturelles. Voir services/api/src/ai.ts.
//
// ⚠️ On ne fait que PROPOSER. Le vendeur relit, choisit, adapte et envoie
//    lui-même. Aucun envoi, aucune automatisation.

import { Intent, ReplySuggestion } from "../../core/types.js";

export interface MessageAnalysis {
  intent: Intent;
  confidence: number; // 0–100
  signals: string[];  // ce qui a déclenché la détection (transparence)
  suggestions: ReplySuggestion[];
}

interface IntentRule {
  intent: Intent;
  weight: number;
  re: RegExp;
  label: string;
}

// Signaux d'intention (FR). Chaque match ajoute du poids ; l'intention gagnante
// est celle au plus fort score. Ordre pensé du plus spécifique au plus général.
const RULES: IntentRule[] = [
  { intent: "offre_basse", weight: 3, re: /\b(\d+)\s*€?\b.*(possible|ok|d'?accord|je (te |vous )?(prends|propose|offre|donne))/i, label: "propose un montant" },
  { intent: "offre_basse", weight: 3, re: /\b(je (te |vous )?(propose|offre|donne)|dernier prix|prix final|cash)\b/i, label: "offre directe" },
  { intent: "negociation", weight: 2, re: /\b(un (petit )?geste|baisser|r[ée]duction|moins cher|meilleur prix|n[ée]gociable|faire un prix|arranger)\b/i, label: "négociation" },
  { intent: "question", weight: 2, re: /\?|(\b(taille|pointure|mesure|dispo|disponible|[ée]tat|d[ée]faut|authentique|original|envoi|livraison|remise en main|quand|combien|est-ce que)\b)/i, label: "question" },
  { intent: "hesitation", weight: 2, re: /\b(je (r[ée]fl[ée]chis|h[ée]site|sais pas|verrai)|peut-[êe]tre|je reviens|je te dis)\b/i, label: "hésitation" },
  { intent: "interet", weight: 1, re: /\b(int[ée]ress[ée]|toujours (dispo|disponible)|encore (dispo|disponible)|ça m'?int[ée]resse|je (le |la )?veux|preneur|preneuse)\b/i, label: "intérêt" },
];

export function analyzeMessage(message: string, ctx?: { price?: number; article?: string }): MessageAnalysis {
  const text = String(message || "").trim();
  const scores: Record<string, number> = {};
  const signals: string[] = [];
  for (const r of RULES) {
    if (r.re.test(text)) {
      scores[r.intent] = (scores[r.intent] ?? 0) + r.weight;
      signals.push(r.label);
    }
  }
  // Un montant chiffré nettement sous le prix affiché → offre basse.
  const amount = extractAmount(text);
  if (amount != null && ctx?.price && amount < ctx.price * 0.7) {
    scores["offre_basse"] = (scores["offre_basse"] ?? 0) + 3;
    signals.push(`montant ${amount} € très sous le prix`);
  }

  let intent: Intent = "autre";
  let best = 0;
  for (const k of Object.keys(scores)) {
    if (scores[k]! > best) { best = scores[k]!; intent = k as Intent; }
  }
  const confidence = Math.min(95, 45 + best * 15);

  return {
    intent,
    confidence,
    signals: [...new Set(signals)],
    suggestions: templateReplies(intent, { ...ctx, amount }),
  };
}

/** Réponses de repli SANS IA : gabarits variés, tirés au sort → jamais le même
 *  texte deux fois, tons différents. Naturelles, courtes, humaines. */
export function templateReplies(intent: Intent, ctx?: { price?: number; article?: string; amount?: number | null }): ReplySuggestion[] {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;
  const art = ctx?.article ? ` (${ctx.article})` : "";

  const banks: Record<Intent, ReplySuggestion[]> = {
    interet: [
      { tone: "court", text: pick(["Oui, toujours dispo 🙂", "Oui c'est dispo !", "Toujours disponible 👍"]) },
      { tone: "chaleureux", text: pick(["Coucou ! Oui c'est toujours dispo, je peux te l'envoyer rapidement si tu veux 🙂", "Salut ! Oui dispo, n'hésite pas si tu as des questions !"]) },
      { tone: "pro", text: pick(["Bonjour, l'article est disponible. Je peux l'expédier sous 24–48h après commande.", "Bonjour, oui c'est disponible. Dites-moi si vous souhaitez plus de photos."]) },
    ],
    question: [
      { tone: "court", text: pick(["Je regarde et je te dis 👍", "Bonne question, je vérifie !"]) },
      { tone: "chaleureux", text: pick(["Bonne question ! Je te réponds au plus vite avec les détails 🙂", "Alors pour te répondre : … (précise ici). Dis-moi si tu veux d'autres infos !"]) },
      { tone: "pro", text: pick(["Bonjour, voici l'information demandée : … . N'hésitez pas pour toute autre question.", "Bonjour, je vous confirme les détails ci-dessous : … ."]) },
    ],
    negociation: [
      { tone: "court", text: pick(["Je peux faire un petit geste, mais pas trop 🙂", "Un petit effort possible, oui."]) },
      { tone: "chaleureux", text: pick(["Je peux te faire un petit geste avec plaisir, on peut trouver un terrain d'entente 🙂", "Ça marche pour un petit prix, dis-moi ce que tu avais en tête !"]) },
      { tone: "pro", text: pick(["Bonjour, je peux consentir une légère remise. Faites-moi une proposition raisonnable.", "Bonjour, une petite réduction est envisageable selon votre offre."]) },
    ],
    offre_basse: [
      { tone: "court", text: pick(["C'est un peu juste pour moi 🙂", "Là c'est trop bas désolé."]) },
      { tone: "chaleureux", text: pick([`Merci pour ta proposition ! ${ctx?.amount ? `${ctx.amount} €` : "Là"} c'est un peu bas pour moi, mais on peut se rapprocher si tu veux 🙂`, "C'est gentil mais un peu juste — je peux faire un petit geste par contre !"]) },
      { tone: "pro", text: pick(["Bonjour, merci pour votre offre. Elle est un peu basse ; je reste ouvert à une proposition plus proche du prix affiché.", "Bonjour, je ne peux pas descendre autant, mais une contre-proposition mesurée est la bienvenue."]) },
    ],
    hesitation: [
      { tone: "court", text: pick(["Pas de souci, prends ton temps 🙂", "Je te laisse réfléchir 👍"]) },
      { tone: "chaleureux", text: pick(["Aucun souci, prends ton temps ! Je te réserve rien mais n'hésite pas à revenir 🙂", "Tranquille ! Si tu as la moindre question pour t'aider à décider, je suis là."]) },
      { tone: "pro", text: pick(["Bonjour, prenez le temps qu'il vous faut. Je reste disponible pour toute précision.", "Bonjour, n'hésitez pas si une information peut vous aider à vous décider."]) },
    ],
    autre: [
      { tone: "court", text: pick(["Merci pour ton message 🙂", "Bien reçu, je te réponds !"]) },
      { tone: "chaleureux", text: pick([`Merci pour ton message${art} ! Je te réponds au plus vite 🙂`, "Coucou ! Merci, je reviens vers toi rapidement."]) },
      { tone: "pro", text: pick(["Bonjour, merci pour votre message. Je reviens vers vous rapidement.", "Bonjour, bien reçu. Je vous réponds dans les meilleurs délais."]) },
    ],
  };

  return banks[intent];
}

function extractAmount(text: string): number | null {
  const m = text.match(/(\d{1,4})\s*(?:€|euros?|balles?)/i) || text.match(/\b(\d{2,4})\b/);
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  return isNaN(n) ? null : n;
}
