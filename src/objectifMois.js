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

// ── CE QUI RESTE, ET LE RYTHME (9 nov., Julien) ─────────────────────────────
// « 1 240 € sur 2 000 € · encore 760 € · ≈ 35 €/jour d'ici le 30 ». Rien de
// recalculé : le reste vient de la progression (la valeur = la case « Vendu ·
// mois »). Aujourd'hui compte parmi les jours qui restent (on peut encore vendre
// aujourd'hui). Le rythme s'arrondit VERS LE HAUT (35 €/jour qui tiennent
// l'objectif, jamais 34 qui le ratent). Une valeur « au moins » rend un reste
// « au plus ». Pas su ⇒ null (la barre dit « — »).
export const joursRestantsMois = (maintenant = Date.now()) => {
  const d = new Date(maintenant);
  const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return { jours: dernier - d.getDate() + 1, dernier };
};
export const resteObjectif = (prog, maintenant = Date.now()) => {
  if (!prog || prog.valeur == null) return null;
  const { jours, dernier } = joursRestantsMois(maintenant);
  if (prog.atteint) return { atteint: true, reste: 0, parJour: null, jours, dernier, auPlus: false };
  const eur = prog.type === 'ca';
  const reste = eur ? Math.round((prog.objectif - prog.valeur) * 100) / 100 : prog.objectif - prog.valeur;
  const parJour = jours > 0 ? Math.ceil((eur ? Math.round(reste * 100) / 100 : reste) / jours - 1e-9) : null;
  return { atteint: false, reste, parJour, jours, dernier, auPlus: !!prog.partiel };
};
// La phrase sous la barre (`montre` met un montant ou un nombre en forme).
export const phraseResteObjectif = (prog, montre, maintenant = Date.now()) => {
  const r = resteObjectif(prog, maintenant);
  if (!prog) return '';
  if (!r) return 'Vendu du mois pas lu';
  if (r.atteint) return 'Objectif atteint';
  const eur = prog.type === 'ca';
  const ap = r.auPlus ? 'au plus ' : '';
  const reste = eur ? montre(r.reste) : `${r.reste} vente${r.reste > 1 ? 's' : ''}`;
  if (r.jours <= 1) return `encore ${ap}${reste} aujourd’hui`;
  const rythme = eur ? `${montre(r.parJour)}/jour` : `${r.parJour} vente${r.parJour > 1 ? 's' : ''} par jour`;
  return `encore ${ap}${reste} · ≈ ${ap}${rythme} d’ici le ${r.dernier}`;
};
