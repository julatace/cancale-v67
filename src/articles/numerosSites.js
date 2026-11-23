// ══════════════════════════════════════════════════════════════════════════
//  UN N° POUR UNE ANNONCE LEBONCOIN OU eBAY QUI N'EST PAS SUR VINTED (19 nov. 2026)
//
//  Julien, 19 novembre : « Les annonces qui n'ont pas de numéro : donne-leur un numéro, c'est à
//  l'application de le faire, pas à moi. » — et : « ce n'est pas parce que Vinted est ma
//  plateforme principale que c'est la plateforme principale des autres ».
//
//  Vinted numérote déjà seul (App.jsx <numerotation-passage>), Vestiaire aussi
//  (src/numerosVestiaire.js). Ici : Leboncoin et eBay, par le MÊME `prochainLibre` d'App.jsx
//  (passé en paramètre : après le plus haut, jamais un trou, jamais un N° déjà servi, jamais un
//  ancien N° d'avant la remise à zéro — le pool est append-only).
//
//  ⚠️ L'IDENTITÉ : l'identifiant de l'annonce chez son site. Jamais le titre : 50 annonces au
//     même titre ⇒ 50 numéros.
//  ⚠️ UNE PAIRE N'A QU'UN N° (§5). Un vendeur qui a AUSSI des annonces Vinted : son annonce
//     Leboncoin sans lien est peut-être une paire déjà numérotée par Vinted (elle a un carton).
//     Elle ne reçoit donc PAS un N° neuf toute seule : elle est « à relier » — UN toucher dans le
//     parcours de liaison la règle (« c'est celle-ci » ⇒ le N° de la paire ; « elle n'est pas sur
//     Vinted » ⇒ `propre`, et son N° lui est donné ici, tout seul). Un vendeur SANS Vinted : tout
//     de suite, sans rien demander.
//  ⚠️ Seulement une annonce EN LIGNE, vue par une lecture fraîche de SON site (l'app la juge
//     avec la règle du site et passe `etat: 'enligne'`) ; « à confirmer », pas su ⇒ rien.
//  ⚠️ « Je numérote moi-même » ⇒ aucun N° neuf (son N° se lit dans son annonce).
//  Où vit le N° : Leboncoin ⇒ `vrm_lbc_liens[id]` (l'identité que toute l'app lit déjà) ;
//  eBay ⇒ `vrm_ebay_liens[id] = { numero, propre: true, at }` (lu par `numEbayLu` avant le SKU).
//  Chaque N° donné est noté « à écrire » dans `vrm_articles_sites` jusqu'à « C'est écrit ».
//  Module PUR : `scripts/audit-parite-sites.cjs` l'exécute avec le VRAI `prochainLibre`.
// ══════════════════════════════════════════════════════════════════════════
import { CLE_ARTICLES, cleSite, cleDefaut } from './modele.js';

const arr = (a) => (Array.isArray(a) ? a : []);
const objet = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);
export const SITES_NUMEROTES_ICI = ['leboncoin', 'ebay'];
export const CLE_LIENS_SITE = { leboncoin: 'vrm_lbc_liens', ebay: 'vrm_ebay_liens' };

// Quelles annonces reçoivent un N° maintenant, et pourquoi les autres attendent.
//   annonces : la forme commune (src/articles/sources.js)
//   mode     : 'vrm' | 'moi' (src/numerosNouvelles.js `modeNumerotation`)
//   aVinted  : true · false · null (pas su) — le vendeur a-t-il des annonces Vinted ?
// Rend { ids: [{ site, id }], attendent: [{ site, id, raison: 'moi'|'a-relier'|'pas-su'|'pas-en-ligne' }] }.
export function annoncesSitesANumeroter({ annonces, mode = 'vrm', aVinted = null, cle = cleDefaut } = {}) {
  const ids = [], attendent = [];
  const vus = new Set();
  const liste = arr(annonces).filter((a) => a && SITES_NUMEROTES_ICI.includes(a.site) && a.id != null && /^[\w-]{1,40}$/.test(String(a.id)));
  // L'ordre : la plus ancienne mise en ligne d'abord (1, 2, 3… comme il les poste), puis l'identifiant.
  liste.sort((x, y) => ((Number(x.depuis) || Infinity) - (Number(y.depuis) || Infinity)) || String(x.id).localeCompare(String(y.id), 'fr', { numeric: true }));
  for (const a of liste) {
    const k = a.site + '#' + String(a.id);
    if (vus.has(k)) continue; vus.add(k);
    if (cle(a.numero || '') || String(a.vintedId || '').trim()) continue;      // elle a déjà son identité
    if (a.etat !== 'enligne') { if (!['vendue', 'retiree'].includes(a.etat)) attendent.push({ site: a.site, id: String(a.id), raison: 'pas-en-ligne' }); continue; }
    if (mode !== 'vrm') { attendent.push({ site: a.site, id: String(a.id), raison: 'moi' }); continue; }
    if (a.propre || aVinted === false) { ids.push({ site: a.site, id: String(a.id) }); continue; }
    attendent.push({ site: a.site, id: String(a.id), raison: aVinted === true ? 'a-relier' : 'pas-su' });
  }
  return { ids, attendent };
}

// Donne un N° NEUF à chaque annonce de `ids`. `pris` (entiers) et `prisCles` (clés) : TOUS les N° déjà servis.
// `cartes` : { lbc, ebay, faits } relues à l'instant — une carte `null` ⇒ { refus: 'pas-su' }, rien n'est donné.
// Rend { ops, nouveaux: [{ site, id, numero }] } ; l'app ajoute les N° au pool (append-only) avant de jouer `ops`.
export function attribuerNumerosSites({ ids, pris, prisCles, pref = '', prochainLibre, cle = cleDefaut, cartes, maintenant = new Date().toISOString() } = {}) {
  const C = cartes || {};
  const L = { leboncoin: objet(C.lbc), ebay: objet(C.ebay) }, F = objet(C.faits);
  if (!L.leboncoin || !L.ebay || !F || typeof prochainLibre !== 'function' || !(pris instanceof Set) || !(prisCles instanceof Set)) return { refus: 'pas-su' };
  const ops = [], nouveaux = [];
  for (const x of arr(ids)) {
    if (!x || !SITES_NUMEROTES_ICI.includes(x.site) || x.id == null) continue;
    const id = String(x.id), carte = L[x.site];
    const deja = carte[id];
    // Jamais renumérotée : un lien, un N° déjà posé (même par un autre appareil, relu à l'instant).
    if (deja != null && (typeof deja !== 'object' ? String(deja).trim() : (deja.pairId || deja.numero))) continue;
    const servis = new Set(prisCles);                       // avant l'appel : `prochainLibre` y ajoute lui-même un N° à lettres
    const n = String(prochainLibre(pris, prisCles, pref));
    if (!cle(n) || servis.has(cle(n))) return { refus: 'numero' };   // un N° déjà servi ne se redonne JAMAIS : rien n'est écrit
    prisCles.add(cle(n)); if (/^\d+$/.test(cle(n))) pris.add(Number(cle(n)));
    ops.push({ k: CLE_LIENS_SITE[x.site], type: 'cle', id, apres: x.site === 'leboncoin' ? n : { numero: n, propre: true, at: maintenant }, avant: deja });
    const kf = cleSite(x.site, id), av = objet(F[kf]);
    ops.push({ k: CLE_ARTICLES, type: 'cle', id: kf, apres: { ...(av || {}), numero: { valeur: n, at: maintenant, auto: true, ecrit: null } }, avant: av || undefined });
    nouveaux.push({ site: x.site, id, numero: n });
  }
  return { ops, nouveaux };
}

// « Nouveaux N° à écrire » : les N° donnés ici, jusqu'à « C'est écrit ».
export function numerosSitesAEcrire(faits) {
  return Object.entries(objet(faits) || {}).filter(([, e]) => objet(e) && objet(e.numero) && e.numero.auto && !e.numero.ecrit && String(e.numero.valeur || '').trim())
    .map(([k, e]) => ({ cle: k, numero: String(e.numero.valeur), at: e.numero.at || '' }))
    .sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }));
}
export function opsNumeroEcrit({ cles, faits, maintenant = new Date().toISOString() } = {}) {
  const F = objet(faits);
  if (!F) return { refus: 'pas-su' };
  const ops = [];
  for (const k of arr(cles)) { const e = objet(F[k]); if (!e || !objet(e.numero) || e.numero.ecrit) continue; ops.push({ k: CLE_ARTICLES, type: 'cle', id: k, apres: { ...e, numero: { ...e.numero, ecrit: maintenant } }, avant: e }); }
  return { ops };
}
