// ═══════════════════════════════════════════════════════════════════════════
// L'ÉCRAN VENTES — les petites règles de rendu (5 nov., chantier E2)
// ═══════════════════════════════════════════════════════════════════════════
// Rien n'est recalculé ici : ce module MET EN FORME ce que d'autres règles
// rendent (`etapeVente` dans App.jsx, `argentAVenir`, `annulationsParCompte`).
// Exécuté par scripts/audit-ventes-e2.cjs (avec ses mutations).
import { L } from './libelles.js';

// ── LES MOTS DE L'ÉTAT D'UNE VENTE ──────────────────────────────────────────
// `etapeVente` (App.jsx) garde ses étiquettes historiques : `audit-statuts` et
// d'autres écrans (Colis, recherche) les lisent telles quelles. L'écran Ventes,
// lui, écrit le vocabulaire retenu le 5 nov. (`src/libelles.js`) : un colis à
// faire partir est « À envoyer », un colis en chemin « En route ».
const MOTS = { 'À expédier': L.aEnvoyer, 'À poster': L.aEnvoyer, 'En transit': L.enRoute };
export const motEtatVente = (label) => {
  const t = String(label == null ? '' : label).trim();
  return MOTS[t] || t;
};

// ── L'ARGENT À VENIR : UN MONTANT, UNE FOIS (revue 2.12) ─────────────────────
// Une ligne par site et par compte n'a de sens que s'il y en a PLUSIEURS : avec
// un seul groupe, sa ligne redisait le total, au centime près (« À venir 124 € ·
// Vinted · vendeuse_a 124 € »). Un seul groupe ⇒ le total seul, et le groupe
// devient une phrase sans montant (« Vinted · vendeuse_a · 2 ventes »).
// → { lignes: [groupes à écrire avec leur montant], resume: groupe | null }
// ── LE PRIX D'ACHAT SE DIT UNE FOIS, EN TÊTE (6 nov., vague 2) ───────────────
// La ligne Vinted à l'ordinateur répétait « Achat · à saisir » en ambre sur chaque
// vente (E2, « ce qui reste »). Comme dans Annonces (chantier C, `data-ann-achats`) :
// UN bandeau « Prix d'achat N/M connus · Compléter », la case de la ligne en gris.
// M = les ventes affichées qui ont un coût : ni annulées (aucun coût à poser), ni
// masquées, ni dans une autre devise ; N = celles dont le prix d'achat est connu,
// par la règle de la ligne (`achatConnu(o)`, `beneficeLigneVente(...).achat != null`).
// → { n, m } quand il en manque, sinon null (tout est connu, ou rien à compter).
// Exécuté par scripts/audit-ventes-prix-achat.cjs.
export function bandeauPrixAchat(ventes, { annulee, masquee = null, achatConnu } = {}) {
  let m = 0, n = 0;
  for (const o of (Array.isArray(ventes) ? ventes : [])) {
    if (!o || o.transaction_id == null) continue;
    if (typeof annulee === 'function' && annulee(o)) continue;
    if (typeof masquee === 'function' && masquee(o)) continue;
    const dv = o.price && o.price.currency_code; if (dv && dv !== 'EUR') continue;
    m++;
    if (typeof achatConnu === 'function' && achatConnu(o)) n++;
  }
  return m && n < m ? { n, m } : null;
}

export const lignesAVenir = (groupes) => {
  const g = Array.isArray(groupes) ? groupes.filter(Boolean) : [];
  if (g.length <= 1) return { lignes: [], resume: g[0] || null };
  return { lignes: g, resume: null };
};

// ── UN COMPTE QUI ANNULE NETTEMENT PLUS QUE LES AUTRES (30 jours) ────────────
// Entrée : le résultat de `annulationsParCompte` (src/annulationsCompte.js, la
// règle de Statistiques — jamais recopiée) sur les 30 derniers jours.
// Un compte est signalé quand, À LA FOIS :
//   · il a assez de ventes pour qu'une part veuille dire quelque chose
//     (`minVentes`) et au moins `minAnnulees` annulations ;
//   · ses AUTRES comptes lus ont assez de ventes pour servir de repère
//     (`minAutres`) — un seul compte, rien à comparer ;
//   · sa part est au moins `facteur` fois celle des autres ET la dépasse d'au
//     moins `ecartPoints` points (2 % contre 1 %, c'est double mais ce n'est rien).
// ⚠️ « Pas su » ne vaut pas « non » ni « oui » (§5) : une lecture en cours, ratée
//    ou PARTIELLE (un compte pas lu : le repère « les autres » est faux) ⇒ aucune
//    alerte. Un compte exclu n'entre jamais (`annulationsParCompte` l'écarte).
export const SEUILS_ANNULATIONS = Object.freeze({ jours: 30, minVentes: 5, minAnnulees: 2, minAutres: 5, facteur: 2, ecartPoints: 15 });
const arrondi1 = (x) => Math.round(x * 10) / 10;
export const comptesQuiAnnulent = (R, s = SEUILS_ANNULATIONS) => {
  if (!R || R.etat !== 'lu' || R.partiel || !Array.isArray(R.comptes)) return [];
  const comptes = R.comptes.filter((g) => g && Number(g.n) > 0);
  if (comptes.length < 2) return [];
  const out = [];
  for (const g of comptes) {
    if (g.n < s.minVentes || g.annulees < s.minAnnulees) continue;
    let nA = 0, aA = 0;
    for (const x of comptes) if (x !== g) { nA += x.n; aA += x.annulees; }
    if (nA < s.minAutres) continue;
    const t = g.annulees / g.n * 100, tA = aA / nA * 100;
    if (t >= tA * s.facteur && t - tA >= s.ecartPoints) {
      out.push({ uid: g.uid, compte: g.compte, n: g.n, annulees: g.annulees, taux: arrondi1(t), tauxAutres: arrondi1(tA), nAutres: nA, annuleesAutres: aA, liste: (g.liste || []).slice() });
    }
  }
  return out.sort((x, y) => y.taux - x.taux);
};
// La fenêtre : les `jours` derniers jours, jusqu'à maintenant (bornes de
// `annulationsParCompte` : [de, a)).
export const fenetreAnnulations = (maintenant = Date.now(), s = SEUILS_ANNULATIONS) => ({ de: maintenant - s.jours * 86400000, a: maintenant + 1 });
// « 3 annulations sur 6 ventes (50 %) » — un pourcentage à la virgule française.
export const pctFr = (t) => (t == null ? '—' : `${String(t).replace('.', ',')} %`);
