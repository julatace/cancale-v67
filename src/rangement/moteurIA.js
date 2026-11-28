// ════════════════════════════════════════════════════════════════════════════
//  L'ASSISTANT DE RANGEMENT — LE MOTEUR AVEC IA (28 nov. 2026, lot agent-rangement)
//  CLAUDE.md §2.9 : l'IA ne tourne QUE sur la clé DU VENDEUR (collée par lui, rangée chiffrée côté serveur,
//  api/_lib/ia-cle.js, jamais relue par le navigateur), ou — pour le seul propriétaire de l'installation — sur celle du
//  serveur (la règle d'api/ai.js). Jamais un repli sur la clé de Julien pour un autre vendeur : sans clé, le serveur
//  répond « no-key » et l'assistant continue SANS IA (src/rangement/entretien.js), en le disant.
//
//  Module PUR : ce que le navigateur ENVOIE (`corpsRequete`, un résumé sans aucune donnée d'annonce : pas de titre, pas
//  de N°, pas de prix — les meubles, leurs cases prises, le nombre d'articles) et la LECTURE de ce que le modèle rend
//  (`lireReponseIA`). Une réponse qui n'est ni une question bien formée ni un plan que `validerPlan` accepte est
//  REFUSÉE : jamais affichée, jamais appliquée — l'écran le dit et passe au moteur sans IA.
// ════════════════════════════════════════════════════════════════════════════
import { validerPlan, occupation } from './plan.js';
import { typeDe } from '../stockEtageres.js';

export const CHOIX_MAX = 8;
export const TEXTE_MAX = 400;
export const LIBELLE_MAX = 60;
export const TOURS_MAX = 40;       // l'entretien ne se prolonge pas sans fin
export const PHOTO_MAX = 1_600_000; // caractères base64 (≈ 1,2 Mo) — une photo plus lourde n'est pas envoyée

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

// L'historique : [{ role: 'assistant'|'user', texte }] borné ; la photo (facultative) accompagne la DERNIÈRE réponse.
export function corpsRequete({ historique = [], contexte, photo = null } = {}) {
  const h = (Array.isArray(historique) ? historique : []).slice(-TOURS_MAX).map((x) => ({ role: x.role === 'assistant' ? 'assistant' : 'user', texte: String(x.texte || '').slice(0, 1200) }));
  const p = typeof photo === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(photo) && photo.length <= PHOTO_MAX ? photo : null;
  return { mode: 'rangement', historique: h, contexte, ...(p ? { photo: p } : {}) };
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
