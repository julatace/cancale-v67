// api/ai.js — Assistant de rédaction d'annonces (RESELL AI).
// Réécrit un titre + une description d'annonce Vinted pour la rendre plus
// vendeuse, à partir de l'annonce existante et de SES vraies caractéristiques.
//
// SÉCURITÉ : la clé de l'IA ne vit JAMAIS dans le code du site ni dans
// l'extension. Deux sources possibles, dans cet ordre :
//   1. une variable d'environnement Vercel  AI_API_KEY  (recommandé) ;
//   2. à défaut, la clé fournie par l'app depuis l'appareil de Julien (sa
//      propre clé, stockée en local, jamais synchronisée, envoyée en HTTPS).
// Sans aucune clé → réponse 200 { ok:false, reason:'no-key' } : l'app le sait
// et retombe sur ses suggestions calculées (aucune rédaction inventée).
//
// L'IA a une consigne stricte : NE RIEN INVENTER. Elle ne reformule que ce
// qu'on lui donne (marque, taille, état) — jamais un état ou une matière non
// fournis. On ne veut pas de belles annonces mensongères.

const MODEL = process.env.AI_MODEL || 'claude-haiku-4-5-20251001';

export default async function handler(req, res) {
  // Santé : l'app interroge cette route pour afficher « IA branchée / non ».
  if (req.method === 'GET') {
    res.status(200).json({ ok: true, ready: !!(process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY), model: MODEL });
    return;
  }
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }

  const b = req.body || {};
  const key = process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || b.key;
  if (!key) { res.status(200).json({ ok: false, reason: 'no-key' }); return; }

  // ── MODE « aide à la réponse » (spec Messaging Intelligence) : on analyse le
  //    message d'un ACHETEUR et on propose des réponses NATURELLES. L'humain
  //    relit, modifie et envoie LUI-MÊME sur Vinted — aucune action automatique,
  //    aucun auto-envoi : strictement conforme (assistance seule). ──
  if (b.mode === 'reply') return handleReply(res, key, b);

  const it = {
    title: String(b.title || '').slice(0, 200),
    brand: String(b.brand || '').slice(0, 80),
    size: String(b.size || '').slice(0, 40),
    condition: String(b.condition || '').slice(0, 60),
    price: b.price,
    desc: String(b.desc || '').slice(0, 1500),
  };

  const sys = `Tu es un expert de la revente de sneakers et de vêtements d'occasion sur Vinted (marché français). Tu réécris une annonce pour la rendre plus vendeuse SANS JAMAIS MENTIR : n'invente aucune caractéristique (état, matière, pointure, coloris) qui ne t'est pas explicitement donnée. Style Vinted : titre court et précis (marque + modèle + taille + état quand ils sont connus), description claire, honnête, chaleureuse, en français, avec au maximum 1 à 2 émojis. Tu réponds STRICTEMENT en JSON, rien d'autre.`;

  const user = `Annonce actuelle :
- Titre : ${it.title || '(vide)'}
- Marque : ${it.brand || '(inconnue)'}
- Taille : ${it.size || '(inconnue)'}
- État : ${it.condition || '(inconnu)'}
- Prix : ${it.price != null ? it.price + ' €' : '(inconnu)'}
- Description actuelle : ${it.desc || '(vide)'}

Réponds par un JSON de la forme :
{"title": "...", "desc": "...", "why": "une phrase courte expliquant ce que tu as amélioré"}
Contraintes : le titre fait au plus 70 caractères ; la description fait 2 à 4 lignes ; n'ajoute jamais une info non fournie ci-dessus.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system: sys, messages: [{ role: 'user', content: user }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(200).json({ ok: false, reason: 'api-error', detail: (j && j.error && j.error.message) || String(r.status) }); return; }
    const text = (j.content || []).map(c => c.text || '').join('').trim();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    if (!parsed || !parsed.title) { res.status(200).json({ ok: false, reason: 'parse' }); return; }
    res.status(200).json({
      ok: true,
      title: String(parsed.title).slice(0, 120),
      desc: String(parsed.desc || '').slice(0, 1200),
      why: String(parsed.why || '').slice(0, 200),
    });
  } catch (err) {
    res.status(200).json({ ok: false, reason: 'network', detail: String(err) });
  }
}

// Analyse d'un message d'acheteur → intention + réponses suggérées (le vendeur
// choisit, adapte et envoie lui-même sur Vinted). RIEN n'est envoyé d'ici.
async function handleReply(res, key, b) {
  const article = String(b.article || '').slice(0, 160);
  const price = b.price;
  const msg = String(b.message || '').slice(0, 1000);
  if (!msg.trim()) { res.status(200).json({ ok: false, reason: 'no-message' }); return; }

  const sys = `Tu es un vendeur français de sneakers et vêtements d'occasion sur Vinted, sympathique et efficace. On te donne le message d'un ACHETEUR. Tu proposes des réponses que LE VENDEUR relira, pourra modifier, et enverra LUI-MÊME (tu n'envoies rien, tu ne fais aucune action). Les réponses doivent sonner HUMAINES : variées dans le ton et la formulation, avec de petites variations naturelles, JAMAIS des modèles répétés ni un ton robotique ou sur-optimisé. Français, courtes, 0 à 2 émojis maximum, toujours polies. Ne promets rien d'irréaliste, n'invente aucune info sur l'article. Tu réponds STRICTEMENT en JSON, rien d'autre.`;

  const user = `Article concerné : ${article || '(inconnu)'}${price != null ? ` — prix affiché ${price} €` : ''}
Message de l'acheteur : "${msg}"

Réponds par un JSON de la forme :
{"intent":"un seul mot parmi: interet|negociation|hesitation|offre_basse|question|autre","confidence":0-100,"suggestions":[{"tone":"court","text":"..."},{"tone":"chaleureux","text":"..."},{"tone":"pro","text":"..."}]}
Donne 3 à 5 suggestions, chacune dans un ton DIFFÉRENT, prêtes à copier. Adapte-les au message : négociation → propose un petit geste sans brader ; question → réponds clairement ; offre trop basse → refuse poliment en gardant la porte ouverte ; simple intérêt → confirme la dispo chaleureusement.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: sys, messages: [{ role: 'user', content: user }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { res.status(200).json({ ok: false, reason: 'api-error', detail: (j && j.error && j.error.message) || String(r.status) }); return; }
    const text = (j.content || []).map(c => c.text || '').join('').trim();
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { const m = text.match(/\{[\s\S]*\}/); if (m) { try { parsed = JSON.parse(m[0]); } catch {} } }
    if (!parsed || !Array.isArray(parsed.suggestions)) { res.status(200).json({ ok: false, reason: 'parse' }); return; }
    const suggestions = parsed.suggestions.filter(s => s && s.text).slice(0, 5)
      .map(s => ({ tone: String(s.tone || '').slice(0, 20), text: String(s.text).slice(0, 400) }));
    if (!suggestions.length) { res.status(200).json({ ok: false, reason: 'parse' }); return; }
    res.status(200).json({
      ok: true,
      intent: String(parsed.intent || 'autre').slice(0, 20),
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
      suggestions,
    });
  } catch (err) {
    res.status(200).json({ ok: false, reason: 'network', detail: String(err) });
  }
}
