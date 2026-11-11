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
