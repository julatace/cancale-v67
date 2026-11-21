// ═══════════════════════════════════════════════════════════════════════════
// ARTICLES QUI DORMENT (3 novembre) — la liste de l'écran Annonces
// ═══════════════════════════════════════════════════════════════════════════
// Une règle pour « qui dort » : en ligne (la base de la grille, `annBase`, la
// règle `<enligne-regle>` : lecture complète la plus récente, « à confirmer »
// hors liste) depuis AU MOINS `seuil` jours (âge lu : date « Ajouté il y a… »
// ou date Vinted, `listedAgeDays` ; inconnu ⇒ dans aucune liste, compté à part).
// Le seuil se choisit : 30, 60 ou 90 jours (les seuils de `stockQuiDort`,
// src/statsVentes.js, que Statistiques compte — mêmes bornes, « au moins »).
// Tri : le plus ancien d'abord ; à âge égal, l'identifiant (stable).
// Rien n'est fait ici : la liste PROPOSE, chaque geste reste son clic.
// Exécuté par scripts/audit-qui-dorment.cjs.
export const SEUILS_QUI_DORMENT = [30, 60, 90];
export const seuilValide = (s) => (SEUILS_QUI_DORMENT.includes(Number(s)) ? Number(s) : 30);
// `annonces` : [{ id, age (jours | null), … }] → { total, datesConnues, n, liste }.
export const articlesQuiDorment = (annonces, seuil = 30) => {
  if (!Array.isArray(annonces)) return null;
  const s = seuilValide(seuil);
  let total = 0, datesConnues = 0;
  const liste = [];
  for (const a of annonces) {
    if (!a) continue;
    total += 1;
    const age = a.age == null ? NaN : Number(a.age);
    if (!Number.isFinite(age)) continue;
    datesConnues += 1;
    if (age >= s) liste.push(a);
  }
  liste.sort((x, y) => Number(y.age) - Number(x.age) || (String(x.id) < String(y.id) ? -1 : String(x.id) > String(y.id) ? 1 : 0));
  return { total, datesConnues, n: liste.length, seuil: s, liste };
};
