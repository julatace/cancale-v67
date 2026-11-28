// ═════════════════════════════════════════════════════════════════════════════
//  CE QUE LE LOT SNEAKERS RANGE (28 nov. 2026, lot sneakers-cote)
// ═════════════════════════════════════════════════════════════════════════════
// UNE clé synchronisée (SYNC_KEYS d'App.jsx), écrite sur SON geste seulement :
//   vrm_sneakers = { v: 1,
//     fiches: { [N° (cleNum)]: { ref, pointure: { sys, val, texte }, marque, at } },   // la fiche d'un N°
//     tags:   [{ id, nom, couleur }],  poses: { [N° (cleNum)]: [id] } }                 // les étiquettes (tags.js)
// Le N° est l'identité de l'article (§5) ; la référence n'en est PAS une : elle est rangée SOUS le N°, jamais l'inverse
// (aucune table « référence → N° », rien ne se retrouve par référence).
// + `poserSourcesSneakers` : les lectures que l'app donne (ventes, annonces, envoi eBay, file), lues À LA DEMANDE.
// ═════════════════════════════════════════════════════════════════════════════
import { normaliserRef, normaliserPointure } from './reference.js';
import { etatTags } from './tags.js';

export const CLE_SNEAKERS = 'vrm_sneakers';
const cleNum = (v) => { let s = String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_.]/g, ''); if (/^\d+$/.test(s)) s = String(parseInt(s, 10)); return s; };
export { cleNum as cleNumSneakers };
const marquePropre = (v) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 30);

export function etatSneakers(x) {
  const t = x && typeof x === 'object' ? x : {};
  const fiches = {};
  for (const [k, f] of Object.entries(t.fiches && typeof t.fiches === 'object' ? t.fiches : {})) {
    const n = cleNum(k);
    if (!n || !f || typeof f !== 'object') continue;
    const ref = normaliserRef(f.ref), p = f.pointure && f.pointure.sys ? normaliserPointure(`${f.pointure.sys} ${f.pointure.val}`) : null, m = marquePropre(f.marque);
    if (ref || p || m) fiches[n] = { ...(ref ? { ref } : {}), ...(p ? { pointure: p } : {}), ...(m ? { marque: m } : {}), at: String(f.at || '') };
  }
  return { v: 1, fiches, ...etatTags(t) };
}
export const ficheDe = (x, num) => etatSneakers(x).fiches[cleNum(num)] || null;
// Pose (ou efface avec '') des champs sur des N° (un ou une sélection). Un champ illisible n'écrit rien de ce champ.
export function poserFiches(x, nums, champs, maintenant = new Date().toISOString()) {
  const e = etatSneakers(x);
  const fiches = { ...e.fiches };
  for (const n0 of [].concat(nums || [])) {
    const n = cleNum(n0); if (!n) continue;
    const f = { ...(fiches[n] || {}) };
    if ('ref' in champs) { const r = normaliserRef(champs.ref); if (r) f.ref = r; else if (String(champs.ref || '').trim() === '') delete f.ref; }
    if ('pointure' in champs) { const p = champs.pointure && champs.pointure.sys ? champs.pointure : normaliserPointure(champs.pointure); if (p) f.pointure = p; else if (!champs.pointure) delete f.pointure; }
    if ('marque' in champs) { const m = marquePropre(champs.marque); if (m) f.marque = m; else delete f.marque; }
    f.at = maintenant;
    if (f.ref || f.pointure || f.marque) fiches[n] = f; else delete fiches[n];
  }
  return { ...e, fiches };
}

// ── LES SOURCES, posées par l'app (aucune lecture ici) ─────────────────────
//   ventes()   → [{ site, prix|prixC, venduMs, misEnLigneMs, titre, taille, num }] · null (pas su)
//   annonces() → [{ cle, site, id, compte, titre, prix, devise, num, mini, achat, vues, favoris, fermee, enLigne, taille }] · null
//   ebay(s, euros) → { etat, raison }   (la route `revise`, src/prixPartout.js)
//   file(geste)    → envoyerGeste (src/agir/porte.js)
let sources = {};
export function poserSourcesSneakers(s) { sources = s && typeof s === 'object' ? s : {}; }
export const sourcesSneakers = () => sources;
// Les ventes, mémorisées 10 min (une lecture pour toutes les fiches ouvertes de suite).
let memoVentes = null;
export async function ventesPourCote(maintenant = Date.now()) {
  if (memoVentes && maintenant - memoVentes.at < 600000) return memoVentes.v;
  if (typeof sources.ventes !== 'function') return null;
  let v = null; try { v = await sources.ventes(); } catch (_) { v = null; }
  if (Array.isArray(v)) memoVentes = { at: maintenant, v };
  return Array.isArray(v) ? v : null;
}
export const oublierVentesCote = () => { memoVentes = null; };
// La référence et la pointure POSÉES d'une vente, par SON N° (connu par identité), sinon rien.
export function avecFiches(ventes, etat) {
  const e = etatSneakers(etat);
  return (ventes || []).map((v) => { const f = v && v.num ? e.fiches[cleNum(v.num)] : null; return f ? { ...v, ref: f.ref || v.ref, pointure: f.pointure || v.pointure } : v; });
}
