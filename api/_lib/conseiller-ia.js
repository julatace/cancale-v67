// ════════════════════════════════════════════════════════════════════════════
//  « DEMANDE À VRM » — le mode `conseiller` de api/ai.js (23 nov.). docs/passation/2026-11-23-conseiller.md
// ════════════════════════════════════════════════════════════════════════════
// ⚠️⚠️ §2.9 : UNIQUEMENT LA CLÉ DU VENDEUR, rangée chiffrée dans le coffre (api/_lib/claude-cle.js) et relue ici par
//    la session. JAMAIS `AI_API_KEY` / `ANTHROPIC_API_KEY` (la clé de Julien), même pour le propriétaire ; jamais une clé
//    envoyée par le navigateur. Pas de clé ⇒ 200 `{ ok:false, reason:'no-key' }` : l'écran se tait, dit pourquoi et
//    montre les conseils sans IA. Aucune requête vers Anthropic sans sa clé (audit-conseiller-ia).
// ⚠️ L'IA ne voit QUE des agrégats déjà calculés par VRM (src/conseiller/sources.js, la même source que les écrans) :
//    le serveur les NETTOIE (nombres, textes courts, aucune clé qui nomme un acheteur, un message, une adresse),
//    borne la taille, et rien d'autre ne part. Elle cite ses chiffres ; elle ne fait AUCUNE action : elle peut proposer
//    UN geste dans une liste FERMÉE (les gestes des conseils), que l'app montre en bouton — c'est SON toucher qui agit.
// Modèle : Claude Haiku 5.5 (le plus économique de la génération actuelle, la demande de Julien) ; effort bas ; sortie
// structurée (JSON au schéma). Le coût réel de la question est rendu (jetons × prix publics).
import { utilisateurDe } from './session.js';
import { accesVendeur } from './abonnement.js';
import { lireCleClaude } from './claude-cle.js';
import { fetchAvecDelai } from './fetch-delai.js';

export const MODELE_CONSEILLER = 'claude-haiku-5-5';
// Prix publics (dollars par million de jetons, prompts sous 100 000 jetons) — pour dire le coût, jamais pour facturer.
export const PRIX_MTOK = Object.freeze({ entree: 0.10, sortie: 0.50 });
export const GESTES_IA = Object.freeze(['aucun', 'envoyer', 'offres', 'argent', 'baisses', 'prix', 'stats', 'dorment']);
const QUESTION_MAX = 500, CONTEXTE_MAX = 12000, HISTO_MAX = 4;
// Une clé qui pourrait porter quelqu'un d'autre que lui : jamais envoyée.
const CLE_INTERDITE = /acheteur|buyer|client|email|mail|adresse|address|telephone|phone|message|conversation|pseudo|login_acheteur|nom_acheteur|photo|url/i;

// Le contexte NETTOYÉ : nombres finis, booléens, textes de 80 caractères au plus, tableaux de 20, profondeur 4.
export function nettoyerContexte(x, prof = 0) {
  if (x == null) return null;
  if (typeof x === 'number') return Number.isFinite(x) ? Math.round(x * 100) / 100 : null;
  if (typeof x === 'boolean') return x;
  if (typeof x === 'string') return x.replace(/[\u0000-\u001f]/g, ' ').slice(0, 80);
  if (prof >= 4) return null;
  if (Array.isArray(x)) return x.slice(0, 20).map((v) => nettoyerContexte(v, prof + 1));
  if (typeof x === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(x).slice(0, 30)) { if (CLE_INTERDITE.test(k)) continue; const n = nettoyerContexte(v, prof + 1); if (n !== null && n !== undefined) o[k.slice(0, 40)] = n; }
    return o;
  }
  return null;
}

export const SYSTEME = `Tu es « VRM », le conseiller intégré à l'outil de gestion d'un revendeur de sneakers et vêtements d'occasion (Vinted, Leboncoin, eBay, Vestiaire Collective), en France.
Règles absolues :
1. Tu ne réponds QU'À PARTIR du CONTEXTE (des chiffres déjà calculés par VRM sur ses données). Tu n'inventes AUCUN chiffre, aucune tendance, aucune donnée de marché. Si le contexte ne permet pas de répondre, dis-le simplement et dis quelle donnée manque.
2. Chaque chiffre que tu donnes vient du contexte et tu le recopies dans "chiffres" (libellé court + valeur telle quelle).
3. "Pas su", null ou absent ne veut jamais dire zéro.
4. Tu ne fais aucune action. Tu peux proposer UN geste dans la liste fermée (envoyer = colis à envoyer, offres = répondre aux offres, argent = écran Argent, baisses = baisses conseillées, prix = saisir des prix d'achat, stats = statistiques, dorment = paires qui dorment) ou "aucun". C'est lui qui touche le bouton.
5. Jamais de prix conseillé pour une mise en ligne, jamais de « bonne affaire », jamais de saisonnalité, rien sur des acheteurs.
6. Réponds dans la langue de la question, en 2 à 5 phrases courtes, concrètes, tutoiement.`;

const SCHEMA = {
  type: 'object',
  properties: {
    reponse: { type: 'string' },
    chiffres: { type: 'array', items: { type: 'object', properties: { libelle: { type: 'string' }, valeur: { type: 'string' } }, required: ['libelle', 'valeur'], additionalProperties: false } },
    geste: { type: 'string', enum: [...GESTES_IA] },
  },
  required: ['reponse', 'chiffres', 'geste'],
  additionalProperties: false,
};

export const coutUsd = (u) => {
  if (!u) return null;
  const e = Number(u.input_tokens || 0) + Number(u.cache_creation_input_tokens || 0) * 1.25 + Number(u.cache_read_input_tokens || 0) * 0.1;
  const s = Number(u.output_tokens || 0);
  return Math.round(((e * PRIX_MTOK.entree + s * PRIX_MTOK.sortie) / 1e6) * 1e6) / 1e6;
};

export function corpsRequete({ question, contexte, historique }) {
  const messages = [];
  for (const h of (Array.isArray(historique) ? historique : []).slice(-HISTO_MAX)) {
    const q = String((h && h.q) || '').slice(0, QUESTION_MAX), r = String((h && h.r) || '').slice(0, 600);
    if (q && r) { messages.push({ role: 'user', content: q }); messages.push({ role: 'assistant', content: r }); }
  }
  messages.push({ role: 'user', content: `CONTEXTE (chiffres calculés par VRM, JSON) :\n${JSON.stringify(contexte)}\n\nQUESTION : ${question}` });
  return {
    model: MODELE_CONSEILLER, max_tokens: 1200,
    system: [{ type: 'text', text: SYSTEME, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages,
  };
}

export async function handleConseiller(req, res, { lireCle = lireCleClaude, appeler = fetchAvecDelai, session = utilisateurDe, acces = accesVendeur } = {}) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.status(405).json({ ok: false, error: 'POST' }); return; }
  const u = await session(req);
  if (u === undefined) { res.status(503).json({ ok: false, reason: 'connexion-injoignable' }); return; }
  if (!u) { res.status(401).json({ ok: false, reason: 'session' }); return; }
  if ((await acces(u.id)) === false) { res.status(402).json({ ok: false, reason: 'abonnement' }); return; }
  const b = req.body || {};
  const question = String(b.question || '').trim().slice(0, QUESTION_MAX);
  if (!question) { res.status(400).json({ ok: false, reason: 'question' }); return; }
  // LA CLÉ DU VENDEUR, et elle seule (jamais b.key, jamais la clé du serveur).
  const key = await lireCle(u.id);
  if (key === undefined) { res.status(503).json({ ok: false, reason: 'cle-pas-su' }); return; }
  if (!key) { res.status(200).json({ ok: false, reason: 'no-key' }); return; }
  const contexte = nettoyerContexte(b.contexte || {});
  if (JSON.stringify(contexte).length > CONTEXTE_MAX) { res.status(400).json({ ok: false, reason: 'contexte' }); return; }
  try {
    const r = await appeler('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(corpsRequete({ question, contexte, historique: b.historique })),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 || r.status === 403) { res.status(200).json({ ok: false, reason: 'cle-refusee' }); return; }
    if (!r.ok) { res.status(200).json({ ok: false, reason: 'api-error', detail: String((j && j.error && j.error.type) || r.status).slice(0, 60) }); return; }
    const cout = coutUsd(j.usage);
    if (j.stop_reason === 'refusal') { res.status(200).json({ ok: false, reason: 'refus', facture: true, cout }); return; }
    const text = (j.content || []).filter((c) => c && c.type === 'text').map((c) => c.text || '').join('').trim();
    let p = null; try { p = JSON.parse(text); } catch (_) { const m = text.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch (_) {} } }
    if (!p || typeof p.reponse !== 'string' || !p.reponse.trim()) { res.status(200).json({ ok: false, reason: 'parse', facture: true, cout }); return; }
    res.status(200).json({
      ok: true,
      reponse: p.reponse.slice(0, 1500),
      chiffres: (Array.isArray(p.chiffres) ? p.chiffres : []).slice(0, 8).map((c) => ({ libelle: String((c && c.libelle) || '').slice(0, 60), valeur: String((c && c.valeur) || '').slice(0, 40) })).filter((c) => c.libelle && c.valeur),
      geste: GESTES_IA.includes(p.geste) ? p.geste : 'aucun',
      cout, jetons: j.usage ? { entree: Number(j.usage.input_tokens || 0), sortie: Number(j.usage.output_tokens || 0) } : null,
    });
  } catch (err) {
    res.status(502).json({ ok: false, reason: 'network', detail: String((err && err.name) || 'erreur').slice(0, 60) });
  }
}
