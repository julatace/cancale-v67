// ── src/ventes/marqueTaille.js — « Marque · T42 » sous le titre d'une vente (21 nov., ventes-lisibles) ─────────────────────
// AFFICHAGE SEULEMENT (jamais une identité, §5). Julien veut « le nom de la paire en entier avec la taille » ; « rien en double » :
// une marque déjà écrite dans le titre (« New Balance xt-6 taille 40 ») ne se répète pas dessous, une taille déjà écrite non plus.
const sansAccents = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const echappe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function marqueDejaDite(titre, marque) {
  const m = sansAccents(marque).trim();
  return !!m && sansAccents(titre).includes(m);
}

export function tailleDejaDite(titre, taille) {
  const t = sansAccents(taille).trim();
  if (!t) return false;
  // « taille 40 », « T40 », « T 40 », « EU 40 », « size 40 », « pointure 40 » : la taille est dans le titre.
  return new RegExp('(?:^|[^a-z0-9])(?:taille|pointure|size|eu|t)\\s*' + echappe(t) + '(?![0-9a-z])', 'i').test(sansAccents(titre));
}

// Les morceaux à écrire (0, 1 ou 2) : la marque si le titre ne la dit pas, la taille (déjà mise en mots par `motTaille`) si le titre ne la dit pas.
export function morceauxMarqueTaille({ titre = '', marque = '', taille = '' } = {}, motTaille = (t) => t) {
  return [marque && !marqueDejaDite(titre, marque) ? marque : '', taille && !tailleDejaDite(titre, taille) ? motTaille(taille) : ''].filter(Boolean);
}
