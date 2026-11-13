// ════════════════════════════════════════════════════════════════════════════
//  QUEL COMPTE VINTED VEND LE MIEUX — LE TABLEAU (13 nov., lot 36-27, point 27)
//  Julien : « quel compte Vinted vend le mieux », sur 30 j, 90 j ou l'année.
//  Module PUR : il ne lit rien, il range ce que les propriétaires ont publié (§11) :
//    · VENTES et PRIX MOYEN : les lignes Vinted du VENDU (`liveStats.venduLignes`,
//      `ventesFaites` : ventes prouvées, date de la vente, comptes sélectionnés) —
//      la population de la tuile « Vendu ». Prix moyen = vendu ÷ ventes, à partir de
//      `MIN_DONNEES` ventes (la règle du « Panier moyen », src/statsPlus.js).
//    · JOURS POUR VENDRE : `delaisPar` (src/statsVentes.js) sur le relevé finalisé
//      (`vrm_stats_ventes` + date de mise en ligne LUE de l'annonce reliée par SA
//      transaction) — la MÉDIANE, comme tout l'écran (« Quel compte vend le mieux »).
//    · OFFRES ACCEPTÉES : `statsOffres` (src/statsOffres.js), acceptées ÷ reçues,
//      seulement si les conversations du compte sont lues jusqu'à la fin de la
//      période (sinon « — » et jusqu'à quand c'est lu) et à partir de MIN_DONNEES.
//  Un compte = une ligne, identifié par son uid Vinted (jamais un titre, §5).
//  Un compte exclu n'est pas dans `comptes` ni dans le vendu : il n'apparaît pas.
//  Compte dont les ventes n'ont pas pu être lues (`venduManque`) ⇒ « — » partout.
//  Exécuté par scripts/audit-comptes-vinted.cjs (données inventées, --prouve).
// ════════════════════════════════════════════════════════════════════════════
import { minuitLocal, delaisPar } from './statsVentes.js';
import { MIN_DONNEES } from './statsPlus.js';

export const PERIODES_COMPTES = { j30: '30 j', j90: '90 j', annee: 'Année' };
export const CLE_PERIODE_COMPTES = 'vrm_sv_comptes_periode';   // commodité de CET appareil

// [de, a) : 30 ou 90 jours, aujourd'hui compris (minuits LOCAUX), ou depuis le 1er janvier.
export const bornesComptes = (p, maintenant = Date.now()) => {
  const a = minuitLocal(maintenant, 1);
  if (p === 'annee') { const d = new Date(maintenant); return { p, de: new Date(d.getFullYear(), 0, 1).getTime(), a }; }
  const n = p === 'j90' ? 90 : 30;
  return { p: p === 'j90' ? 'j90' : 'j30', de: minuitLocal(maintenant, -(n - 1)), a };
};

const cts = (x) => Math.round(Number(x) * 100);
const ok = (l) => l && Number.isFinite(l.ts) && l.ts > 0 && Number.isFinite(Number(l.eur));

// comptes : [{ uid, nom }] (sélectionnés) ; vendu : lignes | null | undefined ;
// manque : `venduManque` (noms) ; nonComptees : `venduNonComptees` ;
// releve : lignes du relevé ({ plateforme, compte, ts, enLigne }) | null (Ventes pas ouvert) | undefined ;
// annonces : les dates de mise en ligne 'lu' · 'passu' · 'encours' ;
// offres : `statsOffres(...)` sur les MÊMES bornes | null (pas lu) | undefined (lecture).
export function tableauComptesVinted({ comptes = [], vendu, manque = [], nonComptees = [], releve, annonces = 'lu', offres, de, a } = {}) {
  if (vendu === undefined) return { etat: 'encours', lignes: [] };
  if (!Array.isArray(vendu)) return { etat: 'passu', lignes: [] };
  const pasLus = new Set((Array.isArray(manque) ? manque : []).map(String));
  const dans = (l) => l.ts >= de && l.ts < a;
  // Les comptes : ceux de la liste, puis ceux du vendu qu'elle ne nomme pas (déjà filtrés par la coque).
  const par = new Map();
  for (const c of (Array.isArray(comptes) ? comptes : [])) { const u = String((c && c.uid) || ''); if (u && !par.has(u)) par.set(u, { uid: u, nom: String(c.nom || u), L: [] }); }
  for (const l of vendu) {
    if (!ok(l) || l.plateforme !== 'Vinted') continue;
    const u = String(l.uid || ''); if (!u) continue;
    if (!par.has(u)) par.set(u, { uid: u, nom: String(l.compte || u), L: [] });
    if (dans(l)) par.get(u).L.push(l);
  }
  const rel = Array.isArray(releve) ? releve.filter((l) => l && l.plateforme === 'Vinted' && Number.isFinite(l.ts) && dans(l)) : releve;
  const offresDe = (u) => (offres && Array.isArray(offres.comptes) ? offres.comptes.find((x) => String(x.compte) === u) || null : null);
  const lignes = [...par.values()].map((g) => {
    if (pasLus.has(g.nom) || pasLus.has(g.uid)) return { uid: g.uid, nom: g.nom, pasLu: true, n: null, eur: null, prix: null, prixRaison: 'passu', delai: null, delaiRaison: 'passu', nDelai: 0, nFin: 0, offres: null, offresRaison: 'passu' };
    let c = 0; for (const l of g.L) c += cts(l.eur);
    const n = g.L.length;
    const prix = n >= MIN_DONNEES ? Math.round(c / n) / 100 : null;
    // Délai : le relevé finalisé de CE compte (son nom de compte, la clé du relevé).
    let delai = null, delaiRaison = null, nDelai = 0, nFin = 0;
    if (rel === undefined || annonces === 'encours') delaiRaison = 'encours';
    else if (!Array.isArray(rel)) delaiRaison = 'releve';
    else if (annonces === 'passu') delaiRaison = 'passu';
    else {
      const D = delaisPar(rel.filter((l) => String(l.compte || '') === g.nom || String(l.compte || '') === g.uid), () => 'x');
      nFin = D.n; nDelai = D.nDelai;
      if (!D.n) delaiRaison = 'aucune';
      else if (!D.nDelai) delaiRaison = 'sansdate';
      else delai = D.mediane;
    }
    // Offres acceptées.
    let taux = null, offresRaison = null, luJusqua = null, recues = null;
    if (offres === undefined) offresRaison = 'encours';
    else if (!offres || !offres.offresLues) offresRaison = 'passu';
    else {
      const o = offresDe(g.uid);
      if (!o || o.recues == null) offresRaison = 'passu';
      else if (o.partielOffres) { offresRaison = 'partiel'; luJusqua = o.luJusqua; }
      else if (o.recues < MIN_DONNEES) { offresRaison = 'peu'; recues = o.recues; }
      else { recues = o.recues; taux = Math.round((o.acceptees / o.recues) * 100); }
    }
    return { uid: g.uid, nom: g.nom, pasLu: false, n, eur: c / 100, prix, prixRaison: prix == null ? (n ? 'peu' : 'aucune') : null,
      delai, delaiRaison, nDelai, nFin, offres: taux, offresRaison, recues, luJusqua };
  }).sort((x, y) => (y.n == null ? -1 : y.n) - (x.n == null ? -1 : x.n) || (y.eur || 0) - (x.eur || 0) || (x.nom < y.nom ? -1 : 1));
  // Les ventes Vinted vendues dont le prix n'est pas lu : hors du tableau (pas de compte), dites.
  const nNonComptees = (Array.isArray(nonComptees) ? nonComptees : []).filter((x) => x && x.plateforme === 'Vinted' && Number.isFinite(x.ts) && x.ts >= de && x.ts < a).length;
  return { etat: 'lu', lignes, nNonComptees, de, a };
}
