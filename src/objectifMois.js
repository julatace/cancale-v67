// ═══════════════════════════════════════════════════════════════════════════
// L'OBJECTIF DU MOIS (4 novembre) — UNE notion, UN réglage, UNE règle
// ═══════════════════════════════════════════════════════════════════════════
// Julien fixe un objectif : un CA vendu OU un nombre de ventes (son choix).
// Une barre fine dans la carte sombre montre où il en est, par la MÊME règle
// que le chiffre « vendu » / « ventes » du mois (VENDU = `ventesFaites`, lue
// par `valeurChiffre` de src/design/carteChiffres.js, tous les sites, tous
// les comptes) — aucune seconde somme.
//
// Le réglage (`vrm_objectif_mois`, synchronisé) : { v: 1, type, valeur, cache }
//   · type   : 'ca' | 'ventes' ;
//   · valeur : > 0 (euros au centime, ou un nombre entier de ventes) ;
//   · cache  : { [page]: true | false } — true : il ne veut pas la barre sur
//     cette carte ; false : il l'y veut (sur Achats et Colis, qui ne disent aucun
//     chiffre de vente, elle est absente tant qu'il ne l'y a pas mise).
// Absent, illisible, valeur ≤ 0 ⇒ AUCUN objectif ⇒ rien n'apparaît (pas de
// phrase d'invitation : « Objectif » se fixe dans « Modifier »).
// Avant ce jour, deux objectifs vivaient sous deux clés (`vrm_ca_objectif` dans
// Statistiques, `vinted_goal` dans Ventes) : mesuré le 4 nov., aucun des deux
// n'était posé en base. Ils lisent et écrivent désormais CE réglage (§11).
// Exécuté par scripts/audit-objectif-mois.cjs.

export const CLE_OBJECTIF = 'vrm_objectif_mois';
export const TYPES_OBJECTIF = {
  ca: { nom: 'CA vendu', chiffre: 'vendu', type: 'eur' },
  ventes: { nom: 'Nombre de ventes', chiffre: 'ventes', type: 'n' },
};

// Le réglage rangé → { type, valeur, cache } ou null (aucun objectif).
export const lireObjectif = (brut) => {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const type = brut.type;
  if (!Object.prototype.hasOwnProperty.call(TYPES_OBJECTIF, type)) return null;
  const v = Number(brut.valeur);
  if (!Number.isFinite(v) || !(v > 0)) return null;
  if (type === 'ventes' && !Number.isInteger(v)) return null;
  const cache = {};
  if (brut.cache && typeof brut.cache === 'object') for (const [k, x] of Object.entries(brut.cache)) if (x === true || x === false) cache[k] = x;
  return { type, valeur: type === 'ca' ? Math.round(v * 100) / 100 : v, cache };
};

// Une saisie (« 2 000 », « 1500,50 », « 40 ») → la valeur, ou null si elle
// n'est pas lisible (jamais devinée : « 2k » ne vaut rien).
export const lireSaisieObjectif = (type, saisie) => {
  if (!Object.prototype.hasOwnProperty.call(TYPES_OBJECTIF, type)) return null;
  const s = String(saisie == null ? '' : saisie).replace(/[\s  €]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(s)) return null;
  const v = Number(s);
  if (!(v > 0)) return null;
  if (type === 'ventes' && !Number.isInteger(v)) return null;
  return v;
};

// Ce qui s'enregistre : un objectif posé, ou retiré (`null` ⇒ `{ v: 1 }` sans
// type — lu « aucun objectif » partout, et la suppression se synchronise).
export const objectifAEnregistrer = (actuel, changement) => {
  const a = lireObjectif(actuel) || { cache: {} };
  if (changement == null) return { v: 1 };
  const out = { v: 1, type: changement.type || a.type, valeur: changement.valeur != null ? changement.valeur : a.valeur, cache: { ...(a.cache || {}) } };
  if (changement.page) out.cache[changement.page] = !!changement.cacher;
  return lireObjectif(out) ? out : null;
};

// L'objectif est-il montré sur CETTE carte ? Son choix d'abord ; sinon partout
// sauf sur les cartes sans chiffre de vente.
export const PAGES_SANS_OBJECTIF = ['achats', 'colis'];
export const objectifSurPage = (obj, page) => {
  if (!obj) return false;
  const c = obj.cache && obj.cache[page];
  if (c === true) return false;
  if (c === false) return true;
  return !PAGES_SANS_OBJECTIF.includes(page);
};

// La progression, à partir de la valeur DU CHIFFRE (`valeurChiffre` : vendu ou
// ventes, mois, tous les sites) — trois états, jamais un 0 inventé :
//   valeur null ⇒ pct null (« — ») ; partielle ⇒ « au moins » (le pct est un
//   minimum, `partiel`) ; atteint dès que la valeur lue (même minimale) y est.
export const progressionObjectif = (obj, x) => {
  if (!obj) return null;
  const val = x && x.valeur != null && Number.isFinite(Number(x.valeur)) ? Number(x.valeur) : null;
  if (val == null) return { type: obj.type, objectif: obj.valeur, valeur: null, pct: null, partiel: false, atteint: false, manque: (x && x.manque) || [] };
  const pct = Math.max(0, Math.min(100, Math.floor((val / obj.valeur) * 100)));
  return { type: obj.type, objectif: obj.valeur, valeur: val, pct, partiel: !!(x && x.partiel), atteint: val >= obj.valeur, manque: (x && x.manque) || [] };
};
