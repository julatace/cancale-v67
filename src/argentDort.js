// ════════════════════════════════════════════════════════════════════════════
// « L'ARGENT QUI DORT, PAR MEUBLE » (16 nov., lot aide-decision — validé par Julien)
// ════════════════════════════════════════════════════════════════════════════
// Par meuble du Stock : combien d'articles présents y sont rangés, la somme de
// LEURS prix d'achat saisis (le manque NOMMÉ « N sans prix », jamais compté 0),
// l'âge moyen en ligne (le manque nommé aussi) ; trié du plus gros argent
// immobilisé. Toucher un meuble montre ses articles.
//
// Ce module NE RE-DÉCIDE RIEN (§5, une règle par notion) :
//   · les articles comptés sont les PAIRES PRÉSENTES de l'écran Annonces
//     (`annoncesPresentes`, la base de « Valeur du stock », `valeurStock`) ;
//   · le prix d'achat est celui de la règle du bénéfice (`beneficePaire(...).achat`,
//     prix saisis par lui) ; l'âge est `listedAgeDays` (date LUE de mise en ligne) ;
//   · la place d'un article est SA case (`vrm_slots`, clé `cleNum` de SON N°) —
//     l'identité est le N°, jamais un titre.
// Annonces publie `vrm_argent_dort` (localStorage de l'appareil, estampillé du
// compte VRM, comme `vrm_valeur_stock`) ; Statistiques la LIT avec les meubles.
// Trois états (§5) : rien publié / meubles pas lus ⇒ null (« — ») ; lu ⇒ valeur.
// Module PUR hors publier/lire. Exécuté par scripts/audit-aide-decision.cjs.

import { lireLocal, ecrireLocal, lireJSON } from './stockageSur.js';

const str = (v) => String(v == null ? '' : v);
const entier = (v) => (v != null && Number.isFinite(Number(v)) ? Math.round(Number(v)) : null);

// ── LES LIGNES PUBLIÉES ─────────────────────────────────────────────────────
// paires : [{ cle, achat (centimes | null), age (jours | null) }] — une par N° (la
// première fiche connue d'un N° porté par deux annonces garde son prix ; un prix
// SU gagne sur un prix pas su, jamais additionné deux fois).
export function lignesArgentDort(paires) {
  if (!Array.isArray(paires)) return null;
  const par = new Map();
  for (const p of paires) {
    const k = str(p && p.cle);
    if (!k) continue;
    const achat = entier(p.achat), age = p.age != null && Number.isFinite(Number(p.age)) && Number(p.age) >= 0 ? Math.floor(Number(p.age)) : null;
    const e = par.get(k);
    if (!e) { par.set(k, [k, achat, age]); continue; }
    if (e[1] == null && achat != null) e[1] = achat;
    if (age != null && (e[2] == null || age > e[2])) e[2] = age;
  }
  return [...par.values()];
}

// ── PAR MEUBLE ──────────────────────────────────────────────────────────────
// meubles : `vrm_meubles` ([{ id, name, … }]) ; slots : `vrm_slots` ({ cle: { m, i } }) ;
// lignes : `lignesArgentDort` ; cle(v) : la clé de N° de l'app (`cleNum`).
// Rend null (pas su) ou { meubles: [{ id, nom, n, nPrix, sansPrix, centimes, ageMoyen, nAge, articles }],
//   horsMeuble: { n, nPrix, sansPrix, centimes, ageMoyen, nAge, articles }, n, nPrix, centimes }.
export function argentDortParMeuble({ meubles, slots, lignes, cle = (v) => str(v).trim().toUpperCase() } = {}) {
  if (!Array.isArray(meubles) || !slots || typeof slots !== 'object' || Array.isArray(slots) || !Array.isArray(lignes)) return null;
  const ids = new Map(meubles.filter((m) => m && m.id != null).map((m) => [str(m.id), str(m.name || '')]));
  const ou = new Map();
  for (const k of Object.keys(slots)) {
    const s = slots[k];
    if (!s || s.m == null || !ids.has(str(s.m))) continue;
    const ck = cle(k);
    if (ck && !ou.has(ck)) ou.set(ck, { m: str(s.m), i: Number(s.i) });
  }
  const vide = () => ({ n: 0, nPrix: 0, sansPrix: 0, c: 0, ages: 0, nAge: 0, articles: [] });
  const g = new Map(), hors = vide();
  for (const [k, achat, age] of lignes) {
    const ck = cle(k);
    if (!ck) continue;
    const place = ou.get(ck);
    const e = place ? (g.get(place.m) || (g.set(place.m, vide()), g.get(place.m))) : hors;
    e.n += 1;
    if (achat != null) { e.nPrix += 1; e.c += achat; } else e.sansPrix += 1;
    if (age != null) { e.nAge += 1; e.ages += age; }
    e.articles.push({ cle: ck, achat, age, i: place ? place.i : null });
  }
  const fin = (e) => ({
    n: e.n, nPrix: e.nPrix, sansPrix: e.sansPrix,
    centimes: e.nPrix ? e.c : (e.n ? null : 0),
    ageMoyen: e.nAge ? Math.round(e.ages / e.nAge) : null, nAge: e.nAge,
    articles: e.articles.sort((a, b) => (b.achat ?? -1) - (a.achat ?? -1) || (b.age ?? -1) - (a.age ?? -1) || a.cle.localeCompare(b.cle)),
  });
  const liste = [...g.entries()].map(([id, e]) => ({ id, nom: ids.get(id) || '', ...fin(e) }))
    .sort((a, b) => (b.centimes ?? -1) - (a.centimes ?? -1) || b.n - a.n || a.nom.localeCompare(b.nom));
  const tout = [...g.values(), hors];
  const nPrix = tout.reduce((s, e) => s + e.nPrix, 0);
  return { meubles: liste, horsMeuble: fin(hors), n: tout.reduce((s, e) => s + e.n, 0), nPrix, centimes: nPrix ? tout.reduce((s, e) => s + e.c, 0) : null };
}

// ── LA PUBLICATION ──────────────────────────────────────────────────────────
export const CLE_ARGENT_DORT = 'vrm_argent_dort';
export const EVT_ARGENT_DORT = 'vrm:argent-dort';
// partiel : une lecture des annonces manque — les totaux sont alors des minimums, dit.
export function publierArgentDort(lignes, { owner = '', partiel = false } = {}) {
  if (!Array.isArray(lignes)) return;
  const p = { v: 1, owner: str(owner), partiel: !!partiel, l: lignes };
  // (stockage protégé, src/stockageSur.js) : refusé ⇒ rien écrit, Statistiques dit « — ».
  const avant = lireLocal(CLE_ARGENT_DORT, null);
  const neuf = JSON.stringify(p);
  if (avant && avant.replace(/,"at":\d+}$/, '}') === neuf) return;
  ecrireLocal(CLE_ARGENT_DORT, JSON.stringify({ ...p, at: Date.now() }));
  try { window.dispatchEvent(new CustomEvent(EVT_ARGENT_DORT)); } catch (_) {}
}
// null = jamais publiée pour CE compte VRM (pas su ⇒ « — »).
export function lireArgentDort(owner = '') {
  const p = lireJSON(lireLocal(CLE_ARGENT_DORT, null), null);
  if (!p || p.v !== 1 || str(p.owner) !== str(owner) || !Array.isArray(p.l)) return null;
  return { partiel: !!p.partiel, at: p.at || null, lignes: p.l.filter((x) => Array.isArray(x) && x.length === 3) };
}
