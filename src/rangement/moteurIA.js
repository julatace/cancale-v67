// ════════════════════════════════════════════════════════════════════════════
//  L'ASSISTANT DE RANGEMENT — LE MOTEUR « IA DE TON NAVIGATEUR » (28 nov. 2026, lots agent-rangement puis ia-sans-cle)
//  Julien (28 nov.) : « je ne veux pas avoir à mettre de clé, ni pour moi ni pour les utilisateurs ». Le modèle est celui
//  INTÉGRÉ au navigateur (Chrome, API Prompt, src/iaNavigateur.js) : il tourne sur l'appareil, rien ne part chez un tiers,
//  aucune clé n'existe. Sans lui (Safari, Firefox, Chrome sans modèle) : l'assistant guidé (src/rangement/entretien.js).
//
//  Module PUR : la consigne (`consigne`), le schéma de sortie imposé au modèle (`SCHEMA_REPONSE`, `responseConstraint`),
//  le premier message (`premierMessage` : un résumé sans aucune donnée d'annonce — pas de titre, pas de N°, pas de prix :
//  les meubles, leurs cases prises, le nombre d'articles) et la LECTURE de ce que le modèle rend (`lireReponseIA`). Une
//  réponse qui n'est ni une question bien formée ni un plan que `validerPlan` accepte est REFUSÉE : jamais affichée,
//  jamais appliquée — l'écran le dit et passe à l'assistant guidé.
// ════════════════════════════════════════════════════════════════════════════
import { validerPlan, occupation } from './plan.js';
import { typeDe } from '../stockEtageres.js';

export const CHOIX_MAX = 8;
export const TEXTE_MAX = 400;
export const LIBELLE_MAX = 60;
export const TOURS_MAX = 40;       // l'entretien ne se prolonge pas sans fin

const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);

// Le contexte envoyé au modèle : les meubles (id, nom, pièce, type, étages, cases par étage, cases prises, près de la
// porte), le nombre d'articles à loger, la méthode de numérotation (qui, série). Aucune annonce, aucun numéro.
export function contexteIA({ meubles = [], slots = {}, articles = null, methode = null, langue = 'fr' } = {}) {
  const occ = occupation(slots);
  return {
    langue,
    articles: Number.isFinite(articles) ? articles : null,
    numerotation: methode && methode.qui ? { qui: methode.qui, serie: methode.serie || 'chiffres' } : null,
    meubles: (Array.isArray(meubles) ? meubles : []).filter((m) => m && m.id != null).slice(0, 60).map((m) => ({
      ref: String(m.id), nom: String(m.name || '').slice(0, 40), piece: typeof m.piece === 'string' ? m.piece.slice(0, 40) : null,
      type: typeDe(m), etages: Math.max(1, Number(m.rows) || 1), casesParEtage: Math.max(1, Number(m.cols) || 1),
      prises: occ.get(String(m.id)) || 0, porte: m.porte === true })),
  };
}

const LANGUES = { fr: 'français', en: 'English', es: 'español', it: 'italiano', de: 'Deutsch' };
export function consigne(langue = 'fr') {
  const l = LANGUES[langue] || LANGUES.fr;
  return `Tu es l'assistant de rangement de VRM, l'outil d'un revendeur d'articles d'occasion (souvent rangés en boîtes). Tu l'aides à décrire SON espace réel de stockage et tu en déduis un plan : pièces → meubles → étages → cases. Une case contient UNE boîte (un carton numéroté). Un « étage » est une rangée du meuble ; « casesParEtage » est le nombre de boîtes côte à côte sur un étage.

Règles de l'entretien :
- Pose UNE seule question à la fois, courte, concrète, en ${l}. Propose 2 à 6 réponses en boutons quand c'est possible ; demande une saisie "nombre" ou "texte" quand il faut un chiffre ou un nom.
- Adapte tes questions aux réponses : s'il a plusieurs pièces, demande pour chacune ; plusieurs meubles, demande pour chacun (type, étages, boîtes par étage).
- Demande ce qu'il veut près de la porte (les nouveaux articles partent souvent vite : le meuble près de la porte reçoit les nouveaux en premier) et comment il numérote ses cartons (VRM numérote en chiffres, VRM avec une lettre, ou il numérote lui-même).
- Repère les incohérences et dis-les : plus d'articles que de places (propose d'ajouter des étages ou un meuble), une pile de plus de 12 boîtes, un meuble plein.
- S'il a déjà des meubles (liste fournie), propose d'abord de MODIFIER le plan existant : garde chaque meuble existant avec sa "ref" exacte. Ne retire un meuble que s'il le demande (liste "retirer"). Tu ne parles JAMAIS de numéros de cartons précis et tu n'en changes aucun : les boîtes gardent leur numéro, VRM proposera lui-même les déplacements.
- Quand tu as tout ce qu'il faut (en général 5 à 15 questions), rends le plan.

Tu réponds STRICTEMENT par UN objet JSON, sans texte autour, de l'une de ces deux formes :
{"type":"question","texte":"…","choix":["…","…"],"saisie":"nombre"|"texte"|"aucune"}
{"type":"plan","plan":{"version":1,"pieces":[{"nom":"…","meubles":[{"ref":"<ref existante>"|null,"nom":"…","type":"etagere"|"armoire"|"casier"|"pile"|"bac","etages":1-50,"casesParEtage":1-30,"porte":true|false}]}],"retirer":["<ref>"],"etiquetage":null|{"qui":"vrm"|"moi","serie":"chiffres"|"lettre","lettre":"C"}},"explication":"2 phrases max"}
Contraintes du plan : 1 à 12 pièces aux noms différents, noms de 1 à 40 caractères, au plus 30 meubles par pièce et 60 au total, entiers seulement, aucune autre clé. "etiquetage" vaut null s'il garde sa méthode actuelle.`;
}

// Le schéma imposé au modèle (`responseConstraint`) : il ne peut rendre qu'une question ou un plan. Le navigateur
// revalide quand même tout (`lireReponseIA` ⇒ `validerPlan`) : le schéma guide, il ne prouve rien.
const MEUBLE_SCHEMA = { type: 'object', additionalProperties: false, required: ['nom', 'type', 'etages', 'casesParEtage'],
  properties: { ref: { type: ['string', 'null'] }, nom: { type: 'string', minLength: 1, maxLength: 40 }, type: { enum: ['etagere', 'armoire', 'casier', 'pile', 'bac'] },
    etages: { type: 'integer', minimum: 1, maximum: 50 }, casesParEtage: { type: 'integer', minimum: 1, maximum: 30 }, porte: { type: 'boolean' } } };
export const SCHEMA_REPONSE = {
  anyOf: [
    { type: 'object', additionalProperties: false, required: ['type', 'texte'], properties: {
      type: { const: 'question' }, texte: { type: 'string', minLength: 1, maxLength: TEXTE_MAX },
      choix: { type: 'array', maxItems: CHOIX_MAX, items: { type: 'string', minLength: 1, maxLength: LIBELLE_MAX } },
      saisie: { enum: ['nombre', 'texte', 'aucune'] } } },
    { type: 'object', additionalProperties: false, required: ['type', 'plan'], properties: {
      type: { const: 'plan' }, explication: { type: 'string', maxLength: 600 },
      plan: { type: 'object', additionalProperties: false, required: ['version', 'pieces'], properties: {
        version: { const: 1 },
        pieces: { type: 'array', minItems: 1, maxItems: 12, items: { type: 'object', additionalProperties: false, required: ['nom', 'meubles'], properties: {
          nom: { type: 'string', minLength: 1, maxLength: 40 }, meubles: { type: 'array', maxItems: 30, items: MEUBLE_SCHEMA } } } },
        retirer: { type: 'array', items: { type: 'string' } },
        etiquetage: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['qui'], properties: {
          qui: { enum: ['vrm', 'moi'] }, serie: { enum: ['chiffres', 'lettre'] }, lettre: { type: 'string', maxLength: 2 } } }] } } } } },
  ],
};

// Le premier message de la session : le contexte (sans aucune annonce) et la consigne de commencer.
export function premierMessage(contexte) {
  const c = estObjet(contexte) ? contexte : {};
  return `Contexte (JSON) : ${JSON.stringify({ articles: c.articles ?? null, numerotation: c.numerotation ?? null, meubles: Array.isArray(c.meubles) ? c.meubles.slice(0, 60) : [] }).slice(0, 12000)}\nCommence l'entretien.`;
}

// ── LIRE LA RÉPONSE DU MODÈLE ────────────────────────────────────────────────
// `r` : l'objet JSON rendu par le serveur (`reponse`). Rend :
//   { ok: true, type: 'question', texte, choix: [texte…], saisie: 'nombre'|'texte'|null, photo: bool }
//   { ok: true, type: 'plan', plan (validé), explication }
//   { ok: false, raison: 'forme'|'question'|'plan', erreurs? }
export function lireReponseIA(r, { existants = [] } = {}) {
  if (!estObjet(r)) return { ok: false, raison: 'forme' };
  if (r.type === 'question') {
    const permis = ['type', 'texte', 'choix', 'saisie', 'photo'];
    const texte = typeof r.texte === 'string' ? r.texte.trim() : '';
    const choix = r.choix === undefined ? [] : r.choix;
    const err = [];
    for (const k of Object.keys(r)) if (!permis.includes(k)) err.push('cle:' + k);
    if (!texte || texte.length > TEXTE_MAX) err.push('texte');
    if (!Array.isArray(choix) || choix.length > CHOIX_MAX || choix.some((c) => typeof c !== 'string' || !c.trim() || c.length > LIBELLE_MAX)) err.push('choix');
    if (r.saisie !== undefined && r.saisie !== null && !['nombre', 'texte', 'aucune'].includes(r.saisie)) err.push('saisie');
    if (r.photo !== undefined && typeof r.photo !== 'boolean') err.push('photo');
    const saisie = r.saisie === 'nombre' || r.saisie === 'texte' ? r.saisie : null;
    if (!saisie && Array.isArray(choix) && !choix.length) err.push('sansReponse');   // une question à laquelle on ne peut pas répondre
    if (err.length) return { ok: false, raison: 'question', erreurs: err };
    return { ok: true, type: 'question', texte, choix: [...new Set(choix.map((c) => c.trim()))], saisie, photo: r.photo === true };
  }
  if (r.type === 'plan') {
    const err = [];
    for (const k of Object.keys(r)) if (!['type', 'plan', 'explication'].includes(k)) err.push('cle:' + k);
    if (r.explication !== undefined && (typeof r.explication !== 'string' || r.explication.length > 600)) err.push('explication');
    const v = validerPlan(r.plan, { existants });
    if (!v.ok) err.push(...v.erreurs);
    if (err.length) return { ok: false, raison: 'plan', erreurs: err };
    return { ok: true, type: 'plan', plan: v.plan, explication: typeof r.explication === 'string' ? r.explication.trim() : '' };
  }
  return { ok: false, raison: 'forme' };
}
