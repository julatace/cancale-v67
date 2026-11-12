// ── RANGER UN ACHAT À SON ARRIVÉE (11 nov. 2026, lot rangement-guide) ─────────
// Julien (demande validée, « ça doit être TRÈS bien fait ») : quand un achat est
// RETIRÉ (« J'ai retiré », le scanner, le mode relais) ou reçu, une feuille
// « Ranger cet achat » : la photo, le PROCHAIN N° proposé, une CASE LIBRE
// proposée (meuble · niveau · case, d'après le plan du Stock, à la suite de sa
// dernière case), la fiche pré-remplie depuis l'achat (titre, marque, taille,
// prix d'achat lu — tout modifiable), puis UN geste « Rangé ». Un lot de N
// articles = N lignes, N° et cases consécutifs.
//
// Module PUR (aucun accès au navigateur ni à la base) : la feuille
// (src/RangerAchat.jsx), la coque (App.jsx, `RangerAchatCoque`) et
// `scripts/audit-rangement-guide.cjs` exécutent les MÊMES fonctions (§11).
//
// ⚠️ LE N° (§5) : `prochainLibre` de l'app (passé en paramètre, jamais recopié)
//    sur TOUS les N° servis — après le plus haut, jamais un trou, jamais un
//    ancien (« B » est l'archive). Un N° tapé (« Je numérote moi-même ») qui a
//    déjà servi est REFUSÉ, dit : un N° ne se redonne jamais. Le N° montré au
//    moment de « Rangé » entre dans le pool (append-only) À CE GESTE et y reste,
//    même après « Annuler » : il a pu être écrit sur le carton pendant que la
//    feuille était ouverte (§5 : « un trou peut être écrit sur un carton »).
// ⚠️ LA CASE : les règles du Stock (`placeCase`, `planchesCases`) ; une case
//    notée pour un N° — même parti — est PRISE ; un meuble empilé (`gravite`)
//    n'accepte que la case la plus basse libre de sa colonne. Meubles ou cases
//    pas lus ⇒ `null` : RIEN n'est proposé (« pas su » ≠ « libre »).
// ⚠️ L'IDENTITÉ (§5) : la fiche garde le n° de transaction de SON achat
//    (`achat.tx`), le n° de suivi du colis retiré s'il est connu — jamais un
//    titre. Rien n'est relié par ressemblance ; rien n'est deviné : un prix pas
//    lu reste vide, le prix d'un LOT n'est jamais divisé tout seul (une indication).
// ⚠️ RIEN SANS SON GESTE : ces fonctions PROPOSENT ; l'écriture (`opsRanger`)
//    n'est appelée que par « Rangé ».

import { placeCase } from './stockSortie.js';
import { planchesCases } from './stockRegles.js';

const estListe = Array.isArray;
const estObjet = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const str = (v) => String(v == null ? '' : v).trim();
export const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;
export const CLE_FICHES = 'vrm_fiches_neuves';
export const ORIGINE = 'arrivee';
// Une proposition oubliée s'éteint seule (la règle de la cloche « Où ranger »).
export const DUREE_PROPOSITION_MS = 14 * 86400000;
export const LOT_MAX = 40;

const prixNombre = (p) => {
  if (p == null || p === '') return null;
  const n = Number(typeof p === 'object' ? p.amount : String(p).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
};
export const prixEnTexte = (n) => (n == null ? '' : String(n).replace('.', ','));

// ── Les cases ───────────────────────────────────────────────────────────────
// Les cases occupées : toute case notée dans `vrm_slots`, quel que soit le N°.
function casesPrises(slots) {
  const prises = new Set();
  for (const k of Object.keys(slots || {})) {
    const s = slots[k];
    if (s && s.m != null && Number.isInteger(Number(s.i))) prises.add(String(s.m) + ':' + Number(s.i));
  }
  return prises;
}
const dims = (m) => ({ cols: Math.max(1, Number(m && m.cols) || 1), rows: Math.max(1, Number(m && m.rows) || 1) });

// Une case peut-elle recevoir un article ? (existe, libre, et — meuble empilé —
// posée sur le fond ou sur une case prise : sinon l'article tomberait ailleurs.)
export function caseProposable(m, i, prises) {
  if (!m || m.id == null) return false;
  const { cols, rows } = dims(m);
  if (!Number.isInteger(i) || i < 0 || i >= cols * rows) return false;
  const prise = (j) => prises.has(String(m.id) + ':' + j);
  if (prise(i)) return false;
  if (m.gravite) {
    const planches = planchesCases(m.planches, cols, rows);
    const r = Math.floor(i / cols), c = i % cols;
    const fond = r === rows - 1 || planches.has((r + 1) + ':' + (c + 1));
    if (!fond && !prise((r + 1) * cols + c)) return false;
  }
  return true;
}

// La case dite en mots : « Étagère A · niveau 2 · case 3 » (niveau = la rangée
// comptée depuis le HAUT, comme la règle dessinée du Stock ; case = la colonne).
export const caseEnMots = (c) => (c ? `${c.meuble} · niveau ${c.rangee} · case ${c.colonne}` : '');
const decrire = (m, i) => { const p = placeCase(i, m); return { meubleId: String(m.id), meuble: String(m.name || 'Meuble'), i, rangee: p.rangee, colonne: p.colonne }; };

// L'habitude : la case de son DERNIER rangement à l'arrivée (fiches neuves
// `origine: 'arrivee'`), si son meuble existe encore. null sinon.
export function caseHabitude({ fiches, meubles } = {}) {
  if (!estObjet(fiches) || !estListe(meubles)) return null;
  let der = null;
  for (const f of Object.values(fiches)) {
    // (intégration g1) un gros lot rangé dans ses cases (src/grosLot.js, origine « gros-lot ») est aussi un rangement.
    if (!f || (f.origine !== ORIGINE && f.origine !== 'gros-lot') || !f.case || f.case.m == null) continue;
    // À la même heure (les N articles d'un lot), le dernier rang l'emporte : la suite repart après lui.
    const a = String(f.rangeAt || ''), b = der ? String(der.rangeAt || '') : '';
    if (!der || a > b || (a === b && (Number(f.rang) || 0) > (Number(der.rang) || 0))) der = f;
  }
  if (!der) return null;
  const m = meubles.find((x) => x && String(x.id) === String(der.case.m));
  const i = Number(der.case.i);
  if (!m || !Number.isInteger(i)) return null;
  return { m: String(m.id), i };
}

// L'ordre de recherche : d'abord le meuble de l'habitude, à partir de la case
// qui SUIT la sienne (puis le début de ce meuble), puis les autres meubles dans
// leur ordre. Sans habitude : l'ordre de « Où ranger » (meubles puis lecture).
function ordreCases(meubles, depuis) {
  const out = [];
  const ms = meubles.filter((m) => m && m.id != null);
  const iH = depuis ? ms.findIndex((m) => String(m.id) === String(depuis.m)) : -1;
  const suite = iH >= 0 ? [ms[iH], ...ms.slice(0, iH), ...ms.slice(iH + 1)] : ms;
  suite.forEach((m, k) => {
    const { cols, rows } = dims(m); const n = cols * rows;
    if (k === 0 && iH >= 0) { const d = Math.min(n, Math.max(0, Number(depuis.i) + 1)); for (let j = 0; j < n; j++) out.push([m, (d + j) % n]); }
    else for (let i = 0; i < n; i++) out.push([m, i]);
  });
  return out;
}

// N cases libres à la suite (une par ligne). Rend { cases: [case|null…], su:
// true } — une ligne sans case libre reçoit null (tout est plein) ; pas su ⇒
// { cases: null, su: false }. Aucun meuble ⇒ { cases: [null…], aucunMeuble: true }.
export function casesEnSerie({ meubles, slots, n = 1, habitude = null, reservees = [] } = {}) {
  const N = Math.max(0, Math.min(LOT_MAX, Number(n) || 0));
  if (!estListe(meubles) || !estObjet(slots)) return { cases: null, su: false };
  const ms = meubles.filter((m) => m && m.id != null);
  if (!ms.length) return { cases: Array(N).fill(null), su: true, aucunMeuble: true };
  const prises = casesPrises(slots);
  for (const r of reservees || []) if (r && r.m != null) prises.add(String(r.m) + ':' + Number(r.i));
  const out = []; let depuis = habitude;
  for (let k = 0; k < N; k++) {
    const t = ordreCases(ms, depuis).find(([m, i]) => caseProposable(m, i, prises));
    if (!t) { out.push(null); continue; }
    const [m, i] = t; prises.add(String(m.id) + ':' + i); out.push(decrire(m, i)); depuis = { m: String(m.id), i };
  }
  return { cases: out, su: true };
}

// La case touchée sur le plan est-elle acceptable pour CETTE ligne ? (les
// cases des AUTRES lignes de la feuille comptent comme prises.)
export function caseChoisie({ meubles, slots, m, i, autres = [] } = {}) {
  if (!estListe(meubles) || !estObjet(slots)) return null;
  const meuble = meubles.find((x) => x && String(x.id) === String(m));
  if (!meuble) return null;
  const prises = casesPrises(slots);
  for (const r of autres) if (r && r.meubleId != null) prises.add(String(r.meubleId) + ':' + Number(r.i));
  return caseProposable(meuble, Number(i), prises) ? decrire(meuble, Number(i)) : null;
}

// ── Les numéros ─────────────────────────────────────────────────────────────
// N numéros à la suite, par LA règle de l'app (`prochainLibre`), sur une copie
// des N° servis. Rend la liste, ou null (règle absente, ou un N° rendu déjà pris).
export function numerosEnSerie({ pris, pref = '', n = 1, prochainLibre, cleNum } = {}) {
  if (typeof prochainLibre !== 'function' || typeof cleNum !== 'function' || !pris) return null;
  const int = new Set(pris.int || []), cles = new Set(pris.cles || []);
  const avant = new Set([...cles].map(cleNum)); for (const x of int) avant.add(cleNum(x));
  const out = [];
  for (let k = 0; k < Math.max(0, Math.min(LOT_MAX, Number(n) || 0)); k++) {
    const num = String(prochainLibre(int, cles, pref));
    const c = cleNum(num);
    if (!c || avant.has(c) || out.some((x) => cleNum(x) === c)) return null;
    out.push(num);
  }
  return out;
}

// Un N° tapé à la main : { ok, cle } ou { ok: false, raison }.
//   pris : Set des cleNum servis · archive : la lettre des anciens N° ('' sinon)
//   autres : les N° des autres lignes de la feuille
export function validerNumeroTape(v, { pris, archive = '', cleNum, autres = [] } = {}) {
  const c = typeof cleNum === 'function' ? cleNum(v) : '';
  if (!c) return { ok: false, raison: 'vide' };
  if (!NUM_OK.test(c)) return { ok: false, raison: 'illisible' };
  if (archive && new RegExp('^' + archive + '\\d+$').test(c)) return { ok: false, raison: 'archive' };
  if (!(pris instanceof Set)) return { ok: false, raison: 'passu' };
  if (pris.has(c)) return { ok: false, raison: 'pris' };
  if ((autres || []).some((x) => cleNum(x) === c)) return { ok: false, raison: 'double' };
  return { ok: true, cle: c };
}

// ── L'achat ⇒ les lignes de la feuille ──────────────────────────────────────
// achat : { tx, titre, photo, prix, taille, marque?, n?, lot?, articles?: [{ titre, photo, prix, taille }] }
// Un achat SIMPLE : une ligne, son titre, sa marque (lue de son titre par la
// règle de l'app, `marqueDe`), sa taille, son prix LU. Un LOT de N : N lignes ;
// le détail lu de chaque article s'il existe, sinon des lignes vides (le titre
// du lot en indication) — jamais un prix divisé tout seul (`indicatif`).
export function lignesDeLAchat(achat, { n, marqueDe } = {}) {
  const a = achat || {};
  const art = estListe(a.articles) ? a.articles.filter(Boolean) : [];
  const N = Math.max(1, Math.min(LOT_MAX, Number(n) || (art.length > 1 ? art.length : 0) || Number(a.n) || 1));
  const marque = (t) => (typeof marqueDe === 'function' ? str(marqueDe(t)) : '');
  if (N === 1 && !a.lot) {
    const t = str(a.titre);
    return [{ k: 0, titre: t, marque: str(a.marque) || marque(t), taille: str(a.taille), prix: prixEnTexte(prixNombre(a.prix)), photo: a.photo || null }];
  }
  const prixLot = prixNombre(a.prix);
  const indicatif = prixLot != null ? Math.round((prixLot / N) * 100) / 100 : null;
  return Array.from({ length: N }, (_, k) => {
    const x = art.length === N ? art[k] : null;
    if (x) { const t = str(x.titre); return { k, titre: t, marque: marque(t), taille: str(x.taille), prix: prixEnTexte(prixNombre(x.prix)), photo: x.photo || a.photo || null }; }
    return { k, titre: '', marque: '', taille: '', prix: '', photo: a.photo || null, indicatif: prixEnTexte(indicatif), titreLot: str(a.titre) };
  });
}

// ── L'écriture de « Rangé » ─────────────────────────────────────────────────
// lignes : [{ numero, titre, marque, taille, prix, case: {meubleId, i} | null, photo }]
// Relit TOUT sur les valeurs courantes (fiches, cases, coûts, N° servis) et
// REFUSE plutôt que d'écraser : un N° servi entre-temps, une case prise, deux
// lignes au même N° ou à la même case. Rend { ok, ops, fiches, numeros } ou
// { ok: false, raison, ligne }.
//   fiches : `vrm_fiches_neuves` · slots : `vrm_slots` · couts : `vinted_buyprice_by_num`
//   pris : Set des cleNum servis AVANT ce geste (pool, fiches, ventes, réservés…)
export function opsRanger({ lignes, achat, fiches, slots, couts, meubles, pris, cleNum, ids, maintenant = new Date().toISOString() } = {}) {
  if (typeof cleNum !== 'function') return { ok: false, raison: 'regle' };
  if (!estListe(lignes) || !lignes.length) return { ok: false, raison: 'vide' };
  if (!estObjet(fiches) || !estObjet(slots) || !estObjet(couts) || !(pris instanceof Set)) return { ok: false, raison: 'lecture' };
  const a = achat || {};
  const tx = str(a.tx);
  // Déjà rangé (une fiche porte CET achat) : rien n'est écrit deux fois.
  if (tx && Object.values(fiches).some((f) => f && f.achat && str(f.achat.tx) === tx && f.origine === ORIGINE)) return { ok: false, raison: 'deja' };
  const vusN = new Set(), vusC = new Set(), prises = casesPrises(slots);
  const ops = [], nouvelles = [], numeros = [];
  for (let k = 0; k < lignes.length; k++) {
    const l = lignes[k] || {};
    const num = str(l.numero), c = cleNum(num);
    if (!c || !NUM_OK.test(c)) return { ok: false, raison: 'numero', ligne: k };
    if (pris.has(c) || slots[c]) return { ok: false, raison: 'pris', ligne: k };
    if (vusN.has(c)) return { ok: false, raison: 'double', ligne: k };
    vusN.add(c);
    let place = null;
    if (l.case && l.case.meubleId != null) {
      const m = (meubles || []).find((x) => x && String(x.id) === String(l.case.meubleId));
      const i = Number(l.case.i), cc = String(l.case.meubleId) + ':' + i;
      if (!m || vusC.has(cc) || !caseProposable(m, i, prises)) return { ok: false, raison: 'case', ligne: k };
      vusC.add(cc); prises.add(cc); place = { m: String(m.id), i };
    }
    const id = String((ids && ids[k]) || ('a' + k));
    if (fiches[id]) return { ok: false, raison: 'id', ligne: k };
    const prix = prixNombre(l.prix);
    const fiche = {
      id, numero: num, creeAt: maintenant, photos: [],
      titre: str(l.titre).slice(0, 200), marque: str(l.marque).slice(0, 80), taille: str(l.taille).slice(0, 40), etat: '', description: '', prix: null,
      origine: ORIGINE, rangeAt: maintenant,
      achat: { tx, site: str(a.site) || 'vinted', ...(str(a.suivi) ? { suivi: str(a.suivi) } : {}), ...(lignes.length > 1 ? { ligne: k + 1, sur: lignes.length } : {}) },
      ...(prix != null ? { prixAchat: prix } : {}),
      ...(l.photo || a.photo ? { photoAchat: String(l.photo || a.photo) } : {}),
      ...(place ? { case: place } : {}),
    };
    ops.push({ k: CLE_FICHES, type: 'cle', id, apres: fiche, avant: undefined });
    if (place) ops.push({ k: 'vrm_slots', type: 'cle', id: c, apres: place, avant: undefined });
    // Le coût suit le N° (`vinted_buyprice_by_num`) — seulement sur un N° qui n'en a aucun.
    if (prix != null && (couts[num] == null || str(couts[num]) === '')) ops.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: num, apres: prixEnTexte(prix), avant: couts[num] });
    nouvelles.push(fiche); numeros.push(num);
  }
  return { ok: true, ops, fiches: nouvelles, numeros };
}

// ── Les achats qui attendent d'être rangés ──────────────────────────────────
// proposes : { [tx]: { tx, titre, at, fait?, photo?, prix?, taille?, n?, lot? } }
// Rend la liste (la plus récente d'abord) des propositions vivantes : ni « fait »,
// ni vieille de 14 jours, ni déjà rangée (une fiche porte SON n° de transaction).
export function achatsARanger({ proposes, fiches, maintenant = Date.now() } = {}) {
  if (!estObjet(proposes)) return [];
  const ranges = new Set();
  for (const f of Object.values(estObjet(fiches) ? fiches : {})) if (f && f.origine === ORIGINE && f.achat && str(f.achat.tx)) ranges.add(str(f.achat.tx));
  return Object.values(proposes)
    .filter((p) => p && str(p.tx) && !p.fait && !ranges.has(str(p.tx)) && maintenant - (Number(p.at) || 0) < DUREE_PROPOSITION_MS)
    .sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0));
}

// Les N° des fiches rangées à l'arrivée qui ne sont pas encore dans le pool
// (rattrapage : un geste dont l'écriture du pool n'a pas abouti).
export function numerosAReserver({ fiches, pool, cleNum } = {}) {
  if (!estObjet(fiches) || !estListe(pool) || typeof cleNum !== 'function') return [];
  const dans = new Set(pool.map(cleNum));
  const out = [];
  for (const f of Object.values(fiches)) {
    if (!f || f.origine !== ORIGINE) continue;
    const c = cleNum(f.numero); if (c && NUM_OK.test(c) && !dans.has(c)) { dans.add(c); out.push(String(f.numero)); }
  }
  return out;
}
