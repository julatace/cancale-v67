// ════════════════════════════════════════════════════════════════════════════
//  CE QUE VRM PROPOSE POUR eBAY ET LEBONCOIN — UN SEUL CRITÈRE (3 novembre 2026)
// ════════════════════════════════════════════════════════════════════════════
// Julien, 3 nov. 9 h 45 : « je ne vois pas comment tu peux me proposer des
// paires en stock mais pas en ligne si je n'ai pas fait de photo sur Vinted ».
// Son choix — un article est PROPOSÉ pour un site quand il est :
//   (a) EN LIGNE sur Vinted (même N°, mêmes photos, même fiche), ou
//   (b) supprimé de Vinted et marqué « Toujours chez moi » (VRM garde les photos
//       et la fiche de sa dernière annonce lue — `src/cycleArticle.js`).
// Toujours exclus : déjà sur ce site, vendu (prouvé), « Je m'en sépare »,
// « Vendu en main propre », lecture incertaine (« pas su », « à confirmer »).
// Un article sans photo NI fiche connue n'est JAMAIS proposé.
// Module PUR : l'agent eBay (`src/agentEbay.js`), la liste des paires eBay et
// `scripts/audit-cycle-article.cjs` lisent CETTE règle (§11).
import { etatCycle } from './cycleArticle.js';

export const LIBELLE_PROPOSITION = 'En ligne ou chez toi';
export const ETATS_PROPOSABLES = Object.freeze(['en-ligne', 'chez-moi']);

// Pourquoi un article n'est pas proposé (un code, jamais une phrase technique).
export const RAISONS_PAS_PROPOSE = Object.freeze({
  'deja-sur-site': 'déjà sur ce site',
  vendue: 'vendu',
  sortie: 'plus chez toi',
  'sans-photo': 'sans photo',
  'pas-su': 'pas encore lu',
  'a-trancher': 'supprimé de Vinted, à trancher',
  'pas-en-ligne': 'pas en ligne',
});

// Un article (fiche) est-il proposable sur `site` ? Rend { ok, etat, raison? }.
//  surSite(id, fiche) : déjà sur ce site (true) · pas dessus (false) · pas su (null)
//  photoDe(id, fiche) : une photo connue (URL) ou ''
//  les autres entrées sont celles d'`etatCycle`.
export function propositionSite(id, fiche, x) {
  const o = x || {};
  if (!fiche || !String(fiche.numero == null ? '' : fiche.numero).trim()) return { ok: false, etat: 'sans-numero', raison: 'pas-en-ligne' };
  const r = etatCycle(id, { ...o, fiche });
  if (r.etat === 'vendue') return { ok: false, etat: r.etat, raison: 'vendue' };
  if (r.etat === 'sortie') return { ok: false, etat: r.etat, raison: 'sortie' };
  if (r.etat === 'pas-su' || r.etat === 'a-confirmer') return { ok: false, etat: r.etat, raison: 'pas-su' };
  if (r.etat === 'a-demander') return { ok: false, etat: r.etat, raison: 'a-trancher' };
  if (!ETATS_PROPOSABLES.includes(r.etat)) return { ok: false, etat: r.etat, raison: 'pas-en-ligne' };
  const sur = typeof o.surSite === 'function' ? o.surSite(String(id), fiche) : false;
  if (sur === null || sur === undefined) return { ok: false, etat: r.etat, raison: 'pas-su' };
  if (sur === true) return { ok: false, etat: r.etat, raison: 'deja-sur-site' };
  const photo = typeof o.photoDe === 'function' ? String(o.photoDe(String(id), fiche) || '') : String(fiche.photo || '');
  if (!photo || !String(fiche.title || '').trim()) return { ok: false, etat: r.etat, raison: 'sans-photo' };
  return { ok: true, etat: r.etat };
}

// Les identifiants proposables parmi `fiches`, et le décompte des écartés.
export function propositionsSite(fiches, x) {
  const ids = [], ecartes = {};
  for (const id of Object.keys(fiches || {})) {
    const p = propositionSite(id, fiches[id], x);
    if (p.ok) ids.push(String(id));
    else if (p.etat !== 'sans-numero' && p.etat !== 'hors-compte') ecartes[p.raison] = (ecartes[p.raison] || 0) + 1;
  }
  return { ids, ecartes };
}

// Les articles « Toujours chez moi » (b) qui ne sont plus en ligne : la liste
// eBay les ajoute à celles qu'elle lit en ligne (a). `Set` d'identifiants.
export function chezMoiProposables(fiches, x) {
  const s = new Set();
  for (const id of Object.keys(fiches || {})) {
    const f = fiches[id];
    const r = etatCycle(id, { ...(x || {}), fiche: f });
    if (r.etat === 'chez-moi' && f && f.photo && String(f.title || '').trim()) s.add(String(id));
  }
  return s;
}
