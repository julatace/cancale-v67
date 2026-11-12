// ═══════════════════════════════════════════════════════════════════════════
// PLUS DE STATISTIQUES (11 nov., lot stats-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « dans l'onglet Argent → Statistiques il n'y en a pas assez à mon
// goût ». Ce module ne LIT rien et n'invente aucune notion : il ASSEMBLE les
// règles propriétaires déjà là pour quatre blocs neufs de Statistiques.
//   · `resumePeriode`   — nombre de ventes, panier moyen et leur écart avec la
//                         période d'avant au MÊME point : les lignes de
//                         `venduPeriode` (src/statsVentes.js), rien d'autre.
//   · `margeConnue`     — le bénéfice brut et la marge des ventes finalisées au
//                         prix d'achat CONNU : la somme des groupes de
//                         `classementRapporte` (src/ceQuiRapporte.js), sa règle.
//   · `meilleuresVentes`— les 10 ventes qui ont le plus rapporté (vente − prix
//                         d'achat, la règle du brut), seulement au prix connu ;
//                         la couverture « sur N » à côté.
//   · `ageDuStock`      — les annonces en ligne par âge 0–30 / 30–90 / 90 j et
//                         plus : la publication `vrm_stats_stock` de l'écran
//                         Annonces (`stockQuiDort`, seuils cumulés 30/60/90) ;
//                         une annonce sans date est dite, jamais rangée.
//   · `venduEtRecu`     — par barre de la période, le VENDU (date de vente) et
//                         le REÇU (date de versement, `recuPublieEntre`) : vendu
//                         ≠ reçu, jamais additionnés ni confondus (§5).
// Trois états partout (§5) : `undefined` en cours · `null` pas su · valeur lue.
// Moins de `MIN_DONNEES` ventes : « pas assez de données », jamais une moyenne
// sur deux ventes présentée comme un repère. Exécuté par scripts/audit-stats-plus.cjs.

import { classementRapporte } from './ceQuiRapporte.js';
import { ecartPct } from './statsVentes.js';
import { moisParis } from './dateParis.js';

export const MIN_DONNEES = 3;
const cents = (v) => Math.round(Number(v) * 100);
const connu = (v) => v != null && String(v).trim() !== '' && isFinite(Number(v));

// ── EN BREF : ventes et panier moyen, comparés au même point ───────────────
// `V` = `venduPeriode(...)` : { n, eur, prec: { n, eur }, ecart } | null.
// `partiel` : des ventes dont l'argent n'est pas lu ⇒ la moyenne n'est pas sûre
// (« — »), le nombre reste un minimum (« au moins »).
export const resumePeriode = (V, partiel = false) => {
  if (V === undefined) return undefined;
  if (!V) return null;
  const panier = (x) => (x && x.n >= MIN_DONNEES ? Math.round(cents(x.eur) / x.n) / 100 : null);
  const p = partiel ? null : panier(V), pp = partiel ? null : panier(V.prec);
  return {
    n: V.n, nPrec: V.prec ? V.prec.n : null, ecartN: ecartPct(V.n, V.prec ? V.prec.n : null),
    panier: p, panierPrec: pp, ecartPanier: p == null || pp == null ? null : ecartPct(p, pp),
    pasAssez: !partiel && V.n > 0 && V.n < MIN_DONNEES, partiel: !!partiel,
  };
};

// ── LA MARGE CONNUE ────────────────────────────────────────────────────────
// La somme des groupes de `classementRapporte` (un seul passage, sa règle) :
// brut = ventes au prix d'achat connu − ces prix ; marge = brut ÷ ces ventes.
export const margeConnue = (lp) => {
  if (lp === undefined) return undefined;
  const C = classementRapporte(lp, 'compte');
  if (!C) return null;
  let n = 0, nCout = 0, ca = 0, caCouvert = 0, cout = 0;
  for (const g of C.groupes) { n += g.n; nCout += g.nCout; ca += cents(g.ca); caCouvert += cents(g.caCouvert); cout += cents(g.cout); }
  if (nCout < MIN_DONNEES) return { n, nCout, brut: null, marge: null, moyen: null, pasAssez: n > 0 };
  return {
    n, nCout, ca: ca / 100, brut: (caCouvert - cout) / 100,
    marge: caCouvert ? Math.round((caCouvert - cout) / caCouvert * 1000) / 10 : null,
    moyen: Math.round((caCouvert - cout) / nCout) / 100, pasAssez: false,
  };
};

// ── LES 10 MEILLEURES VENTES ───────────────────────────────────────────────
// Une vente au prix d'achat inconnu n'est PAS classée (son « bénéfice » serait
// le prix de vente entier) : elle est comptée dans « sur N », jamais montrée.
export const meilleuresVentes = (lp, max = 10) => {
  if (lp === undefined) return undefined;
  if (!Array.isArray(lp)) return null;
  const ok = [];
  let n = 0;
  for (const l of lp) {
    if (!l || !connu(l.eur) || !isFinite(Number(l.ts))) continue;
    if (l.devise && String(l.devise).toUpperCase() !== 'EUR') continue;
    n += 1;
    if (!connu(l.achat)) continue;
    ok.push({ ts: Number(l.ts), eur: Number(l.eur), achat: Number(l.achat), brut: (cents(l.eur) - cents(l.achat)) / 100, titre: String(l.titre || '').trim(), plateforme: l.plateforme || '', compte: l.compte || '', id: l.id == null ? '' : String(l.id) });
  }
  ok.sort((a, b) => b.brut - a.brut || b.ts - a.ts || (a.id < b.id ? -1 : 1));
  return { lignes: ok.slice(0, max), n, nCout: ok.length, pasAssez: ok.length < MIN_DONNEES };
};

// ── L'ÂGE DU STOCK ─────────────────────────────────────────────────────────
// `dort` = `{ total, datesConnues, seuils: { 30: {n}, 60: {n}, 90: {n} } }` (cumulés).
export const TRANCHES_AGE = [
  { k: '0-30', l: 'moins de 30 jours' },
  { k: '30-90', l: '30 à 90 jours' },
  { k: '90+', l: '90 jours et plus' },
];
export const ageDuStock = (dort) => {
  if (dort === undefined) return undefined;
  if (!dort || !dort.seuils || !Number.isFinite(dort.total) || !Number.isFinite(dort.datesConnues)) return null;
  const s = (j) => (dort.seuils[j] && Number.isFinite(dort.seuils[j].n) ? dort.seuils[j].n : null);
  const s30 = s(30), s90 = s(90);
  if (s30 == null || s90 == null || s30 < s90 || dort.datesConnues < s30) return null;
  const n = [dort.datesConnues - s30, s30 - s90, s90];
  return { total: dort.total, datesConnues: dort.datesConnues, sansDate: Math.max(0, dort.total - dort.datesConnues), tranches: TRANCHES_AGE.map((t, i) => ({ ...t, n: n[i] })) };
};

// ── VENDU ET REÇU, BARRE PAR BARRE ─────────────────────────────────────────
// `barres` = `barresPeriode(...)` ; `recuEntre(de, aInclus)` = `recuPublieEntre`
// sur la ligne publiée par Ventes. Une barre à venir n'a ni vendu ni reçu.
// Le reçu pas su d'une barre est `null` (« — »), jamais 0 ; partiel ⇒ minimum.
export const venduEtRecu = (barres, recuEntre) => {
  if (barres === undefined) return undefined;
  if (!Array.isArray(barres)) return null;
  let raison = '';
  const out = barres.map((x) => {
    if (x.avenir) return { ...x, vendu: null, recu: null, recuPartiel: false };
    const R = typeof recuEntre === 'function' ? recuEntre(x.debut, x.fin - 1) : null;
    if (!R || R.valeur == null) { if (!raison) raison = (R && R.raison) || 'absente'; return { ...x, vendu: x.eur, recu: null, recuPartiel: !!(R && R.partiel) }; }
    return { ...x, vendu: x.eur, recu: R.valeur, recuPartiel: !!R.partiel };
  });
  const lues = out.filter((x) => !x.avenir);
  const tous = lues.length > 0 && lues.every((x) => x.recu != null);
  return { barres: out, recuLu: lues.some((x) => x.recu != null), recuComplet: tous && !lues.some((x) => x.recuPartiel), raison: tous ? '' : raison };
};

// ═══════════════════════════════════════════════════════════════════════════
// MES RECORDS (11 nov., ajout de Julien au lot stats-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Sur TOUT l'historique lu (comptes sélectionnés : la coque a déjà retiré les
// écartés), recalculés à chaque lecture — rien n'est rangé :
//   · meilleur mois / meilleure semaine : le VENDU (lignes de `ventesFaites`,
//     date de vente, mois et semaine LOCAUX, lundi → lundi) ;
//   · meilleure vente : vente − prix d'achat (la règle du brut), SEULEMENT parmi
//     les ventes finalisées au prix d'achat connu (dit, « N sur M ») ;
//   · vente la plus rapide : mise en ligne → vente (Vinted, date connue).
// Un record a besoin de matière : moins de 2 mois / 2 semaines vendus, ou moins
// de `MIN_DONNEES` ventes classables ⇒ `pasAssez`, jamais un « record » d'une
// vente. `partiel` (un site pas lu, des montants pas lus) ⇒ « parmi les ventes lues ».
const J = 86400000;
const ymLocal = (ts) => moisParis(ts);   // (11 nov.) mois de PARIS
const lundiLocal = (ts) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime(); };
const meilleurGroupe = (vendu, cle) => {
  const par = new Map();
  for (const l of vendu) {
    if (!l || !isFinite(Number(l.ts)) || !(Number(l.ts) > 0) || !connu(l.eur)) continue;
    const k = cle(Number(l.ts));
    const g = par.get(k) || (par.set(k, { k, n: 0, c: 0 }), par.get(k));
    g.n += 1; g.c += cents(l.eur);
  }
  const gs = [...par.values()];
  if (gs.length < 2) return { pasAssez: true, nGroupes: gs.length };
  gs.sort((a, b) => b.c - a.c || (a.k < b.k ? 1 : -1));   // égalité : le plus récent
  const m = gs[0];
  return { k: m.k, n: m.n, eur: m.c / 100, nGroupes: gs.length, pasAssez: false };
};
export const recordsDe = ({ vendu, releve, partiel = false } = {}) => {
  const out = {};
  if (vendu === undefined) { out.mois = undefined; out.semaine = undefined; }
  else if (!Array.isArray(vendu)) { out.mois = null; out.semaine = null; }
  else {
    out.mois = { ...meilleurGroupe(vendu, ymLocal), partiel: !!partiel };
    const s = meilleurGroupe(vendu, lundiLocal);
    out.semaine = { ...s, partiel: !!partiel, ...(s.k != null ? { de: s.k, a: lundiLocal(s.k + 8 * J) } : {}) };
  }
  if (releve === undefined) { out.vente = undefined; out.rapide = undefined; return out; }
  if (!Array.isArray(releve)) { out.vente = null; out.rapide = null; return out; }
  const T = meilleuresVentes(releve, 1);
  out.vente = T.nCout >= MIN_DONNEES ? { ...T.lignes[0], n: T.n, nCout: T.nCout, pasAssez: false } : { n: T.n, nCout: T.nCout, pasAssez: true };
  let best = null, nDelai = 0;
  for (const l of releve) {
    if (!l || !isFinite(Number(l.ts))) continue;
    const e = Number(l.enLigne);
    if (l.enLigne == null || !isFinite(e) || e <= 0 || Number(l.ts) < e) continue;
    nDelai += 1;
    const j = (Number(l.ts) - e) / J;
    if (!best || j < best.jours || (j === best.jours && Number(l.ts) > best.ts)) best = { jours: Math.round(j * 10) / 10, heures: Math.round((Number(l.ts) - e) / 3600000), ts: Number(l.ts), enLigne: e, eur: Number(l.eur), titre: String(l.titre || '').trim(), plateforme: l.plateforme || '', compte: l.compte || '', id: l.id == null ? '' : String(l.id) };
  }
  out.rapide = nDelai >= MIN_DONNEES ? { ...best, nDelai, pasAssez: false } : { nDelai, pasAssez: true };
  return out;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPARER DEUX COMPTES (11 nov., ajout de Julien au lot stats-plus)
// ═══════════════════════════════════════════════════════════════════════════
// Une colonne par compte vendeur, sur la période ; chaque chiffre vient de la
// règle de son bloc : ventes et vendu = « Quel compte vend le mieux » (les
// lignes de la tuile « Vendu ») ; bénéfice connu = `brutParCompte` (avec sa
// couverture « N sur M ») ; délai = la médiane de `delaisPar` (Vinted seulement :
// Leboncoin, eBay et Vestiaire ne donnent pas la date de mise en ligne ⇒ hors) ;
// taux de vente = `tauxVenteMois` : vendues ÷ (vendues + en ligne aujourd'hui),
// Vinted seulement, le nombre en ligne LU par compte (sinon « — »).
// `c` = une ligne de « Quel compte vend le mieux » { k, plat, nom, n, eur, mediane, nDelai } ;
// `bc` = `brutParCompte(...)[cleBrutCompte]` ou null ; `enLigne` = nombre lu | null ;
// `tauxVente` = la règle (src/statsVentes.js) passée par l'écran.
export const colonneCompte = (c, bc, enLigne, tauxVente) => {
  if (!c) return null;
  const vinted = c.plat === 'Vinted';
  return {
    k: c.k, nom: c.nom, plat: c.plat, n: c.n, eur: c.eur,
    panier: c.n >= MIN_DONNEES ? Math.round(cents(c.eur) / c.n) / 100 : null,
    brut: bc && bc.brut != null ? bc.brut : null, nCout: bc ? bc.nCout : 0, nFin: bc ? bc.n : 0,
    delai: vinted ? (c.nDelai > 0 ? c.mediane : null) : undefined, nDelai: c.nDelai || 0,
    taux: vinted && Number.isFinite(enLigne) ? tauxVente(c.n, enLigne) : (vinted ? null : undefined),
    enLigne: vinted && Number.isFinite(enLigne) ? enLigne : null,
  };
};
