// ════════════════════════════════════════════════════════════════════════════
//  CE QUE TU VENDS LE MIEUX (21 nov., lot rentabilite — choix n° 36 de Julien)
//  Dans Statistiques › Finances, un classement par MODÈLE, MARQUE, TAILLE et MODÈLE × TAILLE : nombre vendu, prix de
//  vente moyen, marge brute moyenne par paire (SEULEMENT sur les ventes au prix d'achat connu, « sur N »), temps de vente
//  médian (mise en ligne → vente, dates LUES seulement), taux de vente (vendues ÷ mises en ligne sur la période) ; trois
//  tris (marge, vitesse, volume) ; « à racheter en priorité » = le meilleur score marge × vitesse, au moins 3 ventes.
//
//  Module PUR (aucune lecture, aucune écriture) et AUCUNE règle de chiffre neuve (§5, une règle par notion) :
//    · le GROUPE et ses chiffres (n, CA, brut, marge, médiane du délai) = `classementRapporte` (src/ceQuiRapporte.js,
//      « Ce qui rapporte le plus ») sur le relevé de Ventes (`vrm_stats_ventes` : ventes FINALISÉES, prix d'achat relié
//      par IDENTITÉ seulement — jamais deviné, un lot jamais divisé : le prix d'achat d'une ligne est pris tel quel) ;
//    · le SCORE et « à racheter » = `scoreRachat` / `quoiRacheter` (src/quoiRacheter.js, propriétaire de « quoi racheter ») ;
//    · le TRI = `trierRachat` (même module) ;
//    · seule règle propre à ce module : le TAUX DE VENTE d'un groupe — parmi les annonces Vinted MISES EN LIGNE dans la
//      période (date lue), combien sont vendues ; une annonce sans date de mise en ligne n'entre pas (dit : « sur N
//      annonces datées »), une annonce vendue n'est comptée qu'une fois (par SON identifiant d'annonce, jamais le titre).
//  ⚠️ Le MODÈLE n'est qu'une STATISTIQUE (§5) : `modeleSur` (catalogue fermé, marque lue) regroupe des titres pour
//     l'AFFICHAGE ; il ne relie aucune paire, ne pose aucun N°, n'entre dans aucune identité. La liste de ce qui a été
//     regroupé (les titres, tels quels) est rendue (`regroupes`) pour qu'il la voie. Ce module n'est importé que par
//     les écrans de statistiques (scripts/audit-rentabilite.cjs le vérifie).
//  Exécuté par scripts/audit-rentabilite.cjs (données inventées, mutations).
// ════════════════════════════════════════════════════════════════════════════
import { classementRapporte, cleAxe, modeleSur, texteNormal, AUTRES } from './ceQuiRapporte.js';
import { quoiRacheter, trierRachat, scoreRachat, MIN_RACHAT } from './quoiRacheter.js';

export const AXES_MIEUX = ['modele', 'marque', 'taille', 'modeleTaille'];
export const TRIS_MIEUX = ['marge', 'vitesse', 'volume'];
// Le tri demandé → le tri du propriétaire (src/quoiRacheter.js `trierRachat`).
const TRI_PROPRIO = { marge: 'moyen', vitesse: 'vite', volume: 'nombre' };
const MAX_TITRES = 6;

// Le modèle d'une ligne : l'objet `modeleSur` déjà posé par la lecture, un nom seul (relevé d'avant), sinon RIEN —
// jamais recalculé ici d'un titre (la lecture du relevé l'a fait, une fois, par la règle).
const modeleDe = (l) => {
  const m = l && l.modele;
  if (m && typeof m === 'object' && m.cle) return { cle: String(m.cle), nom: String(m.nom || m.cle) };
  if (typeof m === 'string' && m.trim()) return { cle: texteNormal(m), nom: m.trim() };
  return null;
};
// Une ligne du relevé (src/aujourdhui/lectures.js `lignesReleve`) → la forme de `classementRapporte`.
export const versClassement = (l) => ({ plateforme: l.plateforme, compte: l.compte, id: l.id, ts: l.ts, eur: l.eur, achat: l.achat, devise: l.devise,
  titre: l.titre || '', marque: l.marqueLue || l.marque || '', taille: l.taille || '', modeleSur: modeleDe(l), enLigne: l.enLigne, item: l.item || null });

// LE TAUX DE VENTE d'un axe. `vendues` : les lignes de la période (forme `versClassement`) ; `annonces` : les annonces
// Vinted lues { item, enLigne (ms|null), marque, taille, titre } ; [de, a). Rend Map(k → { mises, vendues }) et la
// couverture { datees, sansDate }.
export function tauxDeVente({ vendues, annonces, axe, de, a }) {
  const par = new Map(), dans = (t) => Number.isFinite(Number(t)) && Number(t) >= de && Number(t) < a;
  const g = (k) => par.get(k) || (par.set(k, { mises: new Set(), vendues: new Set() }), par.get(k));
  let datees = 0, sansDate = 0;
  const vu = new Set();
  for (const l of (Array.isArray(vendues) ? vendues : [])) {
    if (!l || l.plateforme !== 'Vinted' || !l.item || !dans(l.enLigne)) continue;
    const it = String(l.item); if (vu.has(it)) continue; vu.add(it);
    const { k } = cleAxe(l, axe); const G = g(k); G.mises.add(it); G.vendues.add(it); datees += 1;
  }
  for (const x of (Array.isArray(annonces) ? annonces : [])) {
    if (!x || x.item == null) continue;
    const it = String(x.item); if (vu.has(it)) continue;
    if (x.enLigne == null || !Number.isFinite(Number(x.enLigne))) { sansDate += 1; continue; }
    if (!dans(x.enLigne)) continue;
    vu.add(it); datees += 1;
    const l = { marque: x.marque || '', taille: x.taille || '', modeleSur: modeleSur(x.marque || '', x.titre || '') };
    g(cleAxe(l, axe).k).mises.add(it);
  }
  return { par, datees, sansDate };
}

// CE QUI A ÉTÉ REGROUPÉ : pour chaque groupe nommé, les écritures différentes rassemblées (le titre de la vente pour le
// modèle, la marque lue pour la marque, la taille lue pour la taille), chacune avec son nombre — pour qu'il VOIE ce que
// la normalisation a fait. « Autres » : ce qui n'a pas été reconnu, compté.
export function regroupements(lignes, groupes, axe) {
  const source = (l) => (axe === 'marque' ? l.marque : axe === 'taille' ? l.taille : l.titre) || '';
  return groupes.filter((g) => g.k !== '').map((g) => {
    const c = new Map();
    for (const i of g.lignes) { const s = String(source(lignes[i])).trim(); if (!s) continue; const e = c.get(s) || 0; c.set(s, e + 1); }
    const titres = [...c.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
    return { k: g.k, nom: g.nom, n: g.n, variantes: titres.length, titres: titres.slice(0, MAX_TITRES).map(([t, n]) => ({ t, n })), reste: Math.max(0, titres.length - MAX_TITRES) };
  }).filter((r) => r.variantes > 1 || axe === 'modele' || axe === 'modeleTaille');
}

// LE CLASSEMENT D'UN AXE sur la période. `lignes` : le relevé de la période ; `annonces` : les annonces Vinted lues (ou
// null : taux pas su). Rend null (relevé pas lu) ou { axe, n, nCout, nDelai, ecartees, groupes, ordre, aRacheter, peu,
// min, taux: { datees, sansDate } | null, autres, regroupes }.
export function vendsMieuxAxe({ lignes, annonces = null, axe = 'modele', de, a }) {
  if (!Array.isArray(lignes)) return null;
  const L = lignes.map(versClassement);
  const C = classementRapporte(L, axe);
  const Q = quoiRacheter(L, { axe });
  const parK = new Map(Q.groupesReliees.map((g) => [g.k, g]));
  const T = Array.isArray(annonces) ? tauxDeVente({ vendues: L, annonces, axe, de, a }) : null;
  const groupes = C.groupes.filter((g) => g.k !== '').map((g) => {
    const r = parK.get(g.k) || null;
    const t = T ? T.par.get(g.k) : null;
    const mises = t ? t.mises.size : 0, vendues = t ? t.vendues.size : 0;
    return {
      k: g.k, nom: g.nom, n: g.n, nCout: g.nCout, nDelai: g.nDelai,
      prixMoyen: g.n ? Math.round((g.ca * 100) / g.n) / 100 : null,
      moyen: g.moyen, marge: g.marge, brut: g.brut, mediane: g.mediane,
      taux: T && mises > 0 ? Math.round((vendues / mises) * 100) : null, mises: T ? mises : null, venduesMises: T ? vendues : null,
      score: r ? scoreRachat(r) : null,
    };
  });
  const ordre = Object.fromEntries(TRIS_MIEUX.map((t) => [t, trierRachat(groupes, TRI_PROPRIO[t]).map((g) => g.k)]));
  const autres = C.groupes.find((g) => g.k === '') || null;
  return {
    axe, n: C.n, nCout: C.nCout, nDelai: C.nDelai, ecartees: C.ecartees, groupes, ordre,
    aRacheter: Q.prioritaires.map((g) => ({ k: g.k, nom: g.nom, score: g.score, moyen: g.moyen, mediane: g.mediane, n: g.n })),
    peu: Q.prioritaires.length === 0, min: MIN_RACHAT,
    taux: T ? { datees: T.datees, sansDate: T.sansDate } : null,
    autres: autres ? { n: autres.n, nom: AUTRES } : { n: 0, nom: AUTRES },
    regroupes: regroupements(L, C.groupes, axe),
  };
}

// Les quatre axes d'un coup (le modèle de Statistiques les porte tous : changer d'axe ne recalcule rien dans la vue).
export function vendsMieux({ lignes, annonces = null, de, a }) {
  if (!Array.isArray(lignes)) return lignes === undefined ? undefined : null;
  return Object.fromEntries(AXES_MIEUX.map((axe) => [axe, vendsMieuxAxe({ lignes, annonces, axe, de, a })]));
}
