// ════════════════════════════════════════════════════════════════════════════
//  LA MEILLEURE HEURE POUR REPUBLIER (14 nov., idée 158 — demandée par Julien)
// ════════════════════════════════════════════════════════════════════════════
// À partir de SES ventes (date ET heure de vente LUES), le moment de la semaine où
// ses paires se vendent le plus — proposé dans l'atelier Republier, à côté de
// « Programmer », comme une SUGGESTION : un toucher met ce moment dans le champ,
// c'est toujours SON clic « Programmer » qui décide (§3 Republication : jamais un
// lancement automatique, jamais une heure tirée à sa place).
//
// LA SOURCE : « Quand tu vends » de Statistiques (`quandTuVends`, src/statsVentes.js)
//   — la même règle, une seule (§11) : les ventes FAITES (`ventesFaites`, toutes
//   plateformes, annulées exclues) des 365 derniers jours ; une vente SANS heure
//   lue (Leboncoin daté à la main, import sans heure, minuit pile) n'entre dans
//   AUCUNE case — elle est comptée à part (« sans heure »), jamais dans « 0 h ».
// LE CALCUL : 7 jours × 8 créneaux de 3 h = 56 cases. La meilleure case est dite
//   seulement si :
//     · au moins SEUIL_VENTES ventes ont leur heure (sinon « pas assez de ventes ») ;
//     · elle porte au moins MIN_CASE ventes ET au moins 1,5 fois la moyenne d'une
//       case (sinon « aucun moment ne se détache » — dire « dimanche 18 h » sur
//       un hasard serait un chiffre invendable, §2.7).
//   Toujours avec la COUVERTURE : « sur 412 ventes datées à l'heure ».
// Module PUR : ./MeilleureHeure.jsx et scripts/audit-idees-paires.cjs.
// ════════════════════════════════════════════════════════════════════════════

export const SEUIL_VENTES = 30;
export const MIN_CASE = 5;
export const FACTEUR = 1.5;
export const CRENEAU_H = 3;
export const CRENEAUX = 24 / CRENEAU_H;

// Q : la sortie de `quandTuVends` (undefined : en cours · null : pas su).
// Rend { etat: 'encours'|'passu'|'peu'|'plat'|'ok', n, sansHeure, seuil, ... }.
//   'ok' : { jour (0 = lundi), debut, fin (heures), nCase, part (%), parJour, parCreneau }
export function meilleureHeure(Q, { seuil = SEUIL_VENTES } = {}) {
  if (Q === undefined) return { etat: 'encours' };
  if (!Q || !Array.isArray(Q.grille)) return { etat: 'passu' };
  const n = Number(Q.avecHeure) || 0, sansHeure = Number(Q.sansHeure) || 0;
  if (n < seuil) return { etat: 'peu', n, sansHeure, seuil };
  const cases = [];
  for (let j = 0; j < 7; j++) for (let c = 0; c < CRENEAUX; c++) {
    let k = 0; for (let h = c * CRENEAU_H; h < (c + 1) * CRENEAU_H; h++) k += Number((Q.grille[j] || [])[h]) || 0;
    cases.push({ jour: j, c, n: k });
  }
  // La plus forte ; à égalité, le jour puis le créneau le plus tôt (déterministe).
  cases.sort((a, b) => (b.n - a.n) || (a.jour - b.jour) || (a.c - b.c));
  const best = cases[0];
  const moyenne = n / cases.length;
  if (best.n < MIN_CASE || best.n < FACTEUR * moyenne) return { etat: 'plat', n, sansHeure, seuil };
  return { etat: 'ok', n, sansHeure, seuil, jour: best.jour, debut: best.c * CRENEAU_H, fin: (best.c + 1) * CRENEAU_H, nCase: best.n,
    part: Math.round(best.n / n * 100) };
}

// Le prochain moment « ce jour-là, à cette heure » (heure locale), au moins `marge` ms après `maintenant`.
// jour : 0 = lundi … 6 = dimanche (comme `quandTuVends`).
export function prochainMoment(jour, heure, maintenant = Date.now(), marge = 10 * 60 * 1000) {
  const d = new Date(maintenant);
  const auj = (d.getDay() + 6) % 7;
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((jour - auj + 7) % 7), heure, 0, 0, 0);
  if (c.getTime() < maintenant + marge) c.setDate(c.getDate() + 7);
  return c.getTime();
}
