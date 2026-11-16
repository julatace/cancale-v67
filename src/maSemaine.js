// ═══════════════════════════════════════════════════════════════════════════
// « MA SEMAINE » (10 nov., lot BC) — L'ÉCRAN DU BILAN DE LA SEMAINE
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé) : un ÉCRAN, ouvert depuis la notification du dimanche soir, Ma
// journée et Statistiques : ventes (nombre, vendu), bénéfice, colis envoyés, paires
// qui dorment, et la comparaison avec la semaine d'avant (flèche + écart, neutre).
//
// AUCUNE RÈGLE ICI (§11) — ce fichier ne fait que BORNER et COMPARER :
//   · la semaine  = les bornes du bilan en notification (api/_lib/bilan-semaine.js) :
//                   `semaineCourante` (lundi 00:00 → MAINTENANT, heure de Paris — jamais
//                   une vente future) pour la semaine en cours, lundi → lundi sinon ;
//   · ventes, vendu, bénéfice brut, colis envoyés = `journalSemaine`
//                   (src/journalSemaine.js : `bilanLignes` sur les lignes de
//                   `ventesFaites` — la règle de l'app dont api/_lib/ventes-regle.js est
//                   la copie refabriquée —, `beneficeDesJours`/`chiffreBrut` sur
//                   `vrm_benefice_jours`, ses gestes « Colis fait ») ;
//   · reçu        = `recuEntre` (la ligne publiée par Ventes, au jour du VERSEMENT) —
//                   vendu ≠ reçu (§5), jamais additionnés ;
//   · qui dorment = `dormentDe` (api/_lib/bilan-semaine.js, la règle du bilan).
// La comparaison : la semaine d'avant AU MÊME MOMENT (lundi → même jour, même heure),
// pour qu'un mercredi ne se compare pas à une semaine entière. Un écart ne se dit que
// si les DEUX chiffres sont sus et complets : un « au moins » ou un « — » ⇒ pas
// d'écart (jamais une flèche fausse). Exécuté par scripts/audit-ma-semaine.cjs.
import { semaineCourante, minuitParis, dateParis, plusJours, dormentDe } from '../api/_lib/bilan-semaine.js';
import { journalSemaine, titreSemaine } from './journalSemaine.js';
// (16 nov., satisfaction-clients, point 6) « Temps gagné » : LA règle du calculateur (src/accueil/tempsGagne.js,
// durées de RÉFÉRENCE raisonnées, jamais un résultat de client), sur SES ventes de la semaine — une estimation, dite.
import { tempsGagne, CHAMPS as CHAMPS_TEMPS, arrondiSemaine } from './accueil/tempsGagne.js';

// Le temps gagné de la semaine : les gestes « par vente » et le suivi de ses colis, pour `ventes` ventes
// (`{ valeur, partiel }` de `journalSemaine`). Pas su ⇒ pas su ; au-delà du plafond du calculateur, ou des
// ventes partielles ⇒ « au moins » (jamais plus que ce que la règle sait compter). En minutes, arrondi du calculateur.
const MAX_VENTES_TEMPS = (CHAMPS_TEMPS.find((c) => c.id === 'ventes') || { max: 100 }).max;
export function tempsSemaine(ventes) {
  if (!ventes || ventes.valeur == null) return { valeur: null, partiel: false, manque: [], raison: (ventes && ventes.raison) || 'pasSu' };
  const n = Math.max(0, Math.round(Number(ventes.valeur) || 0));
  const t = tempsGagne({ ventes: Math.min(n, MAX_VENTES_TEMPS), achats: 0, comptes: 1, plateformes: 1, baisses: 0 });
  return { valeur: arrondiSemaine(t.secondes), partiel: !!ventes.partiel || n > MAX_VENTES_TEMPS, manque: ventes.manque || [], estimation: true };
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const lundiDe = (ymd) => { const [y, m, d] = ymd.split('-').map(Number); const j = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; return plusJours(ymd, -j); };
export const LETTRES_SEMAINE = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
// Le plus loin qu'on remonte (la publication du bénéfice couvre l'année d'avant).
export const SEMAINES_MAX = 52;

// Les bornes de la semaine du lundi `lundi` (AAAA-MM-JJ ; absent, invalide ou futur ⇒
// la semaine en cours). `finJours` : le minuit qui suit le dernier jour COMPTÉ (la
// publication du bénéfice et celle du reçu sont au jour).
export function bornesSemaine(lundi, maintenant = Date.now()) {
  const C = semaineCourante(maintenant);
  let l = typeof lundi === 'string' && ISO.test(lundi) ? lundiDe(lundi) : C.lundi;
  if (!(l < C.lundi) || l < plusJours(C.lundi, -7 * SEMAINES_MAX)) l = C.lundi;
  if (l === C.lundi) {
    const auj = dateParis(maintenant);
    return { lundi: l, dimanche: plusJours(l, 6), debut: C.debut, fin: maintenant, finJours: minuitParis(plusJours(auj, 1)), enCours: true, aujourdhui: auj };
  }
  return semaineEntiere(l);
}
const semaineEntiere = (l) => {
  const fin = minuitParis(plusJours(l, 7));
  return { lundi: l, dimanche: plusJours(l, 6), debut: minuitParis(l), fin, finJours: fin, enCours: false, aujourdhui: null };
};

// La semaine d'avant, AU MÊME MOMENT : entière si la semaine montrée l'est ; sinon du
// lundi d'avant au même jour, à la même heure (à l'heure de Paris, passage d'heure compris).
export function semaineAvant(S, maintenant = Date.now()) {
  const l = plusJours(S.lundi, -7);
  if (!S.enCours) return semaineEntiere(l);
  const ilYa7 = plusJours(S.aujourdhui, -7);
  const fin = minuitParis(ilYa7) + (maintenant - minuitParis(S.aujourdhui));
  return { lundi: l, dimanche: plusJours(l, 6), debut: minuitParis(l), fin, finJours: minuitParis(plusJours(ilYa7, 1)), enCours: false, coupe: true, aujourdhui: null };
}

// L'écart entre deux chiffres `{ valeur, partiel }` : seulement sus ET complets.
export function ecart(x, y) {
  if (!x || !y || x.valeur == null || y.valeur == null || x.partiel || y.partiel) return null;
  const delta = Math.round((Number(x.valeur) - Number(y.valeur)) * 100) / 100;
  if (!Number.isFinite(delta)) return null;
  return { delta, sens: delta > 0 ? 'hausse' : delta < 0 ? 'baisse' : 'egal' };
}

// Entrées (celles de la coque, rien de relu ici) :
//   vendu      { lignes, manque, nonComptees } | null (pas su) | undefined (en cours)
//   joursBenef la publication `vrm_benefice_jours` | null
//   colisFaits { vinted, lbc, vc } — ses gestes « Colis fait »
//   dorment    la publication `vrm_paires_dorment` | null
//   recuEntre  (de, a) → { valeur, partiel, manque, raison } (a = dernier instant compté)
//   R          { bilanLignes, beneficeDesJours, chiffreBrut } (les fonctions d'App.jsx)
// (16 nov., satisfaction-clients) `aVenir` : `aVenirPour(liveStats.aVenir)` (src/argentAVenir.js, la règle de la coque) —
// un chiffre d'AUJOURD'HUI : seulement montré pour la semaine en cours.
export function maSemaine({ maintenant = Date.now(), lundi = null, vendu, joursBenef, colisFaits = {}, dorment = null, recuEntre = null, aVenir = null, R } = {}) {
  const S = bornesSemaine(lundi, maintenant);
  const A = semaineAvant(S, maintenant);
  const lire = (sem) => journalSemaine({ maintenant, vendu, joursBenef, colisFaits, R: { ...R, semainePassee: () => sem } });
  const J = lire(S), P = lire(A);
  const recu = (sem) => (typeof recuEntre === 'function' ? recuEntre(sem.debut, sem.fin - 1) : { valeur: null, partiel: false, manque: [], raison: 'absente' });
  const chiffres = { ventes: J.ventes, vendu: J.vendu, brut: J.brut, recu: recu(S), colis: J.colis };
  const avant = { ventes: P.ventes, vendu: P.vendu, brut: P.brut, recu: recu(A), colis: P.colis };
  const ecarts = {};
  for (const k of Object.keys(chiffres)) ecarts[k] = ecart(chiffres[k], avant[k]);

  // Les sept jours (lundi → dimanche) : le vendu de chacun, par la même règle. Un jour
  // pas encore venu n'a pas de chiffre (jamais « 0 »).
  const jours = LETTRES_SEMAINE.map((lettre, i) => {
    const iso = plusJours(S.lundi, i);
    const debut = minuitParis(iso), finJ = minuitParis(plusJours(iso, 1));
    if (debut > maintenant) return { iso, lettre, futur: true, valeur: null, n: null };
    const fin = Math.min(finJ, maintenant);
    const D = lire({ lundi: iso, dimanche: iso, debut, fin, finJours: finJ });
    return { iso, lettre, futur: false, aujourdhui: iso === S.aujourdhui, valeur: D.vendu.valeur, n: D.ventes.valeur, partiel: !!D.vendu.partiel };
  });

  return {
    lundi: S.lundi, dimanche: S.dimanche, debut: S.debut, fin: S.fin, enCours: S.enCours,
    titre: titreSemaine(S.lundi),
    lundiAvant: A.lundi, lundiApres: S.enCours ? null : plusJours(S.lundi, 7),
    premiere: S.lundi <= plusJours(semaineCourante(maintenant).lundi, -7 * SEMAINES_MAX),
    chiffres, avant, ecarts, jours,
    dorment: dormentDe(dorment, maintenant),
    aVenir: S.enCours ? (aVenir || { valeur: null, partiel: false, manque: [], raison: 'pasSu' }) : null,
    temps: tempsSemaine(J.ventes),
  };
}
