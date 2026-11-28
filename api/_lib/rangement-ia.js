// ════════════════════════════════════════════════════════════════════════════
//  L'ASSISTANT DE RANGEMENT AVEC IA — l'appel au modèle (28 nov. 2026, lot agent-rangement)
//  Mode `rangement` d'api/ai.js (le plan Hobby plafonne à 12 fonctions : pas de nouvelle route). La clé est résolue par
//  api/ai.js AVANT d'arriver ici (la clé du vendeur, dans le coffre ; celle du serveur pour le seul propriétaire de
//  l'installation ; sinon « no-key ») — ce module ne la choisit jamais.
//  Le modèle conduit l'entretien (une question à la fois) et rend, à la fin, un plan au FORMAT STRICT de
//  src/rangement/plan.js. Ici : la consigne, l'appel, et une première lecture (un objet JSON `question` ou `plan`) ;
//  le navigateur le VALIDE ensuite entièrement (`lireReponseIA` ⇒ `validerPlan`) avant tout affichage.
//  Ce qui part chez Anthropic : l'entretien (les réponses du vendeur), un résumé des meubles (noms, pièces, tailles, cases
//  prises) et le nombre d'articles — aucune annonce, aucun titre, aucun N°, aucun prix ; la photo seulement s'il en a
//  joint une.
// ════════════════════════════════════════════════════════════════════════════
import { fetchAvecDelai } from './fetch-delai.js';

export const MODELE_RANGEMENT = process.env.AI_MODEL_RANGEMENT || 'claude-opus-5-5';
const LANGUES = { fr: 'français', en: 'English', es: 'español', it: 'italiano', de: 'Deutsch' };

export function consigne(langue = 'fr') {
  const l = LANGUES[langue] || LANGUES.fr;
  return `Tu es l'assistant de rangement de VRM, l'outil d'un revendeur d'articles d'occasion (souvent des chaussures en boîtes). Tu l'aides à décrire SON espace réel de stockage et tu en déduis un plan : pièces → meubles → étages → cases. Une case contient UNE boîte (un carton numéroté). Un « étage » est une rangée du meuble ; « casesParEtage » est le nombre de boîtes côte à côte sur un étage.

Règles de l'entretien :
- Pose UNE seule question à la fois, courte, concrète, en ${l}. Propose 2 à 6 réponses en boutons quand c'est possible ; demande une saisie "nombre" ou "texte" quand il faut un chiffre ou un nom.
- Adapte tes questions aux réponses : s'il a plusieurs pièces, demande pour chacune ; plusieurs meubles, demande pour chacun (type, étages, boîtes par étage). S'il joint une photo, sers-t'en pour proposer les nombres (étages, boîtes) et fais-les CONFIRMER.
- Demande ce qu'il veut près de la porte (les nouvelles paires partent souvent vite : le meuble près de la porte reçoit les nouvelles en premier) et comment il numérote ses cartons (VRM numérote en chiffres, VRM avec une lettre, ou il numérote lui-même).
- Repère les incohérences et dis-les : plus d'articles que de places (propose d'ajouter des étages ou un meuble), une pile de plus de 12 boîtes, un meuble plein.
- S'il a déjà des meubles (liste fournie), propose d'abord de MODIFIER le plan existant : garde chaque meuble existant avec sa "ref" exacte. Ne retire un meuble que s'il le demande (liste "retirer"). Tu ne parles JAMAIS de numéros de cartons précis et tu n'en changes aucun : les boîtes gardent leur numéro, VRM proposera lui-même les déplacements.
- Quand tu as tout ce qu'il faut (en général 5 à 15 questions), rends le plan.

Tu réponds STRICTEMENT par UN objet JSON, sans texte autour, de l'une de ces deux formes :
{"type":"question","texte":"…","choix":["…","…"],"saisie":"nombre"|"texte"|"aucune","photo":true|false}
{"type":"plan","plan":{"version":1,"pieces":[{"nom":"…","meubles":[{"ref":"<ref existante>"|null,"nom":"…","type":"etagere"|"armoire"|"casier"|"pile"|"bac","etages":1-50,"casesParEtage":1-30,"porte":true|false}]}],"retirer":["<ref>"],"etiquetage":null|{"qui":"vrm"|"moi","serie":"chiffres"|"lettre","lettre":"C"}},"explication":"2 phrases max"}
Contraintes du plan : 1 à 12 pièces aux noms différents, noms de 1 à 40 caractères, au plus 30 meubles par pièce et 60 au total, entiers seulement, aucune autre clé. "etiquetage" vaut null s'il garde sa méthode actuelle.`;
}

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
// Le premier objet JSON d'un texte (le modèle peut l'entourer de ```json). Rend l'objet ou null.
export function extraireJson(texte) {
  const t = String(texte || '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a || b - a > 40000) return null;
  try { const o = JSON.parse(t.slice(a, b + 1)); return estObjet(o) ? o : null; } catch (_) { return null; }
}

// Les messages pour l'API : un premier tour « utilisateur » qui porte le contexte, puis l'entretien, la photo jointe à
// la dernière réponse. L'API exige un dernier message « user ».
export function messagesDe(b) {
  const ctx = estObjet(b.contexte) ? b.contexte : {};
  const h = Array.isArray(b.historique) ? b.historique.slice(-40) : [];
  const out = [{ role: 'user', content: `Contexte (JSON) : ${JSON.stringify({ articles: ctx.articles ?? null, numerotation: ctx.numerotation ?? null, meubles: Array.isArray(ctx.meubles) ? ctx.meubles.slice(0, 60) : [] }).slice(0, 12000)}\nCommence l'entretien (ou continue-le).` }];
  for (const x of h) {
    if (!x || typeof x.texte !== 'string' || !x.texte.trim()) continue;
    out.push({ role: x.role === 'assistant' ? 'assistant' : 'user', content: x.texte.slice(0, 1200) });
  }
  if (out[out.length - 1].role !== 'user') out.push({ role: 'user', content: 'Continue.' });
  const photo = typeof b.photo === 'string' ? /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(b.photo) : null;
  if (photo && photo[2].length <= 1_600_000) {
    const dernier = out[out.length - 1];
    dernier.content = [{ type: 'image', source: { type: 'base64', media_type: 'image/' + photo[1], data: photo[2] } }, { type: 'text', text: String(dernier.content) }];
  }
  return out;
}

// `appel` : fetch (remplacé par les audits qui simulent la réponse du modèle).
export async function handleRangement(res, key, b, { appel = fetchAvecDelai } = {}) {
  const langue = b && typeof b.contexte === 'object' && b.contexte && typeof b.contexte.langue === 'string' ? b.contexte.langue : 'fr';
  try {
    const r = await appel('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELE_RANGEMENT, max_tokens: 4000, output_config: { effort: 'medium' }, system: consigne(langue), messages: messagesDe(b || {}) }),
      signal: AbortSignal.timeout(50000),   // jamais pendu jusqu'à la coupure de la fonction
    });
    if (r.status === 401 || r.status === 403) { res.status(200).json({ ok: false, reason: 'cle-refusee', message: 'Ta clé IA est refusée par Anthropic : vérifie-la dans l’assistant.' }); return; }
    if (!r.ok) { res.status(502).json({ ok: false, reason: 'ia', status: r.status }); return; }
    const j = await r.json();
    if (j && j.stop_reason === 'refusal') { res.status(200).json({ ok: false, reason: 'refus' }); return; }
    const texte = (j && Array.isArray(j.content) ? j.content : []).filter((c) => c && c.type === 'text').map((c) => c.text).join('');
    const o = extraireJson(texte);
    if (!o || (o.type !== 'question' && o.type !== 'plan')) { res.status(200).json({ ok: false, reason: 'format', facture: true }); return; }   // appel PAYÉ : dit, jamais redemandé seul
    res.status(200).json({ ok: true, reponse: o, modele: MODELE_RANGEMENT });
  } catch (_) {
    res.status(502).json({ ok: false, reason: 'reseau' });
  }
}
