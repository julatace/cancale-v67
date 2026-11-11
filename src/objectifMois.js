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
//   · type   : 'ca' (vendu) | 'benefice' (brut, prix d'achat connus) | 'ventes' ;
//   · parMois, bilanVu : l'objectif de chaque mois et le bilan vu (11 nov., plus bas).
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
// (11 nov., lot objectifs-mois) + le BÉNÉFICE : la case « Bénéfice brut » du mois
// (`brut` : la somme des seules ventes au prix d'achat connu, `chiffreBrut`), dite
// « au moins … · sur N » quand des prix manquent (§5). Ordre = ordre des boutons.
export const TYPES_OBJECTIF = {
  ca: { nom: 'Vendu', chiffre: 'vendu', type: 'eur', ceMois: 'vendus ce mois' },
  benefice: { nom: 'Bénéfice', chiffre: 'brut', type: 'eur', ceMois: 'de bénéfice ce mois' },
  ventes: { nom: 'Ventes', chiffre: 'ventes', type: 'n', ceMois: 'ce mois' },
};
// Un objectif en euros (vendu, bénéfice) ou en nombre de ventes.
export const estEuros = (type) => type === 'ca' || type === 'benefice';

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
  return { type, valeur: estEuros(type) ? Math.round(v * 100) / 100 : v, cache };
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
// (11 nov.) L'HISTOIRE garde l'objectif de chaque mois (`parMois`, « AAAA-MM » ⇒
// { type, valeur } ou null s'il l'a retiré) : le bilan de fin de mois juge le mois
// passé sur l'objectif qu'il avait ALORS, jamais sur celui posé après. Un objectif
// tient jusqu'à ce qu'il le change (la dernière entrée ≤ au mois). Six mois gardés.
// `bilanVu` : le mois dont il a vu le bilan (« OK ») — dit une fois, plus après.
export const ymDe = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const histoire = (brut) => {
  const h = {};
  const src = brut && typeof brut === 'object' && brut.parMois && typeof brut.parMois === 'object' ? brut.parMois : {};
  for (const [k, x] of Object.entries(src)) {
    if (!/^\d{4}-\d{2}$/.test(k)) continue;
    if (x === null) { h[k] = null; continue; }
    const o = lireObjectif(x);
    if (o) h[k] = { type: o.type, valeur: o.valeur };
  }
  return h;
};
const garderSix = (h) => Object.fromEntries(Object.keys(h).sort().slice(-6).map((k) => [k, h[k]]));
const restes = (actuel) => {
  const out = {};
  const h = histoire(actuel);
  if (Object.keys(h).length) out.parMois = h;
  if (actuel && typeof actuel.bilanVu === 'string' && /^\d{4}-\d{2}$/.test(actuel.bilanVu)) out.bilanVu = actuel.bilanVu;
  return out;
};
export const objectifAEnregistrer = (actuel, changement, maintenant = Date.now()) => {
  const a = lireObjectif(actuel) || { cache: {} };
  const garde = restes(actuel);
  const ym = ymDe(maintenant);
  if (changement == null) return { v: 1, ...garde, parMois: garderSix({ ...(garde.parMois || {}), [ym]: null }) };
  if (changement.bilanVu) {
    if (!/^\d{4}-\d{2}$/.test(changement.bilanVu)) return null;
    return { ...(actuel && typeof actuel === 'object' && !Array.isArray(actuel) ? actuel : { v: 1 }), ...garde, bilanVu: changement.bilanVu };
  }
  const out = { v: 1, type: changement.type || a.type, valeur: changement.valeur != null ? changement.valeur : a.valeur, cache: { ...(a.cache || {}) }, ...garde };
  if (changement.page) out.cache[changement.page] = !!changement.cacher;
  if (!lireObjectif(out)) return null;
  if (changement.type || changement.valeur != null) out.parMois = garderSix({ ...(garde.parMois || {}), [ym]: { type: out.type, valeur: lireObjectif(out).valeur } });
  return out;
};
// L'objectif EN VIGUEUR pendant le mois `ym` : la dernière entrée de l'histoire
// ≤ ym. Aucune entrée (objectif d'avant le 11 nov., sans date) ⇒ null : on ne
// sait pas s'il tenait ce mois-là — jamais supposé.
export const objectifDuMoisYm = (brut, ym) => {
  const h = histoire(brut);
  const k = Object.keys(h).filter((x) => x <= ym).sort().pop();
  return k ? h[k] : null;
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
  return { type: obj.type, objectif: obj.valeur, valeur: val, pct, partiel: !!(x && x.partiel), atteint: val >= obj.valeur, manque: (x && x.manque) || [], couverture: (x && x.couverture) || '' };
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
  const eur = estEuros(prog.type);
  const reste = eur ? Math.round((prog.objectif - prog.valeur) * 100) / 100 : prog.objectif - prog.valeur;
  const parJour = jours > 0 ? Math.ceil((eur ? Math.round(reste * 100) / 100 : reste) / jours - 1e-9) : null;
  return { atteint: false, reste, parJour, jours, dernier, auPlus: !!prog.partiel };
};
// La phrase sous la barre (`montre` met un montant ou un nombre en forme).
export const phraseResteObjectif = (prog, montre, maintenant = Date.now()) => {
  const r = resteObjectif(prog, maintenant);
  if (!prog) return '';
  if (!r) return prog.type === 'benefice' ? 'Bénéfice du mois pas su' : 'Vendu du mois pas lu';
  if (r.atteint) return 'Objectif atteint ✓';
  const eur = estEuros(prog.type);
  const ap = r.auPlus ? 'au plus ' : '';
  const reste = eur ? montre(r.reste) : `${r.reste} vente${r.reste > 1 ? 's' : ''}`;
  if (r.jours <= 1) return `encore ${ap}${reste} aujourd’hui`;
  const rythme = eur ? `${montre(r.parJour)}/jour` : `${r.parJour} vente${r.parJour > 1 ? 's' : ''}/jour`;
  return `encore ${ap}${reste} en ${r.jours} jours · ≈ ${ap}${rythme}`;
};

// ── EN AVANCE OU EN RETARD SUR SON RYTHME (11 nov., lot objectifs-mois) ─────
// Le rythme régulier : à l'instant t, il « devrait » en être à objectif × la part
// du mois écoulée (à l'heure près, heure de l'appareil). L'écart à ± 5 % de
// l'objectif près ⇒ « dans ton rythme ». Une valeur « au moins » (un site pas lu,
// des prix d'achat manquants) peut dire « en avance » (le minimum y est déjà),
// JAMAIS « en retard » (le manque peut combler l'écart) ⇒ null, rien dit.
// Pas su, atteint ⇒ null (la barre dit déjà tout).
export const TOLERANCE_RYTHME = 0.05;
export const rythmeObjectif = (prog, maintenant = Date.now()) => {
  if (!prog || prog.valeur == null || prog.atteint) return null;
  const d = new Date(maintenant);
  const de = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const a = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const part = Math.min(1, Math.max(0, (maintenant - de) / (a - de)));
  const attendu = prog.objectif * part;
  const eur = estEuros(prog.type);
  const brutEcart = prog.valeur - attendu;
  const ecart = Math.round(Math.abs(brutEcart));
  if (Math.abs(brutEcart) <= prog.objectif * TOLERANCE_RYTHME || ecart === 0) return { etat: 'dans', ecart: 0, attendu };
  if (brutEcart > 0) return { etat: 'avance', ecart, attendu };
  if (prog.partiel) return null;
  return { etat: 'retard', ecart, attendu };
};
export const phraseRythme = (ry, type, montre) => {
  if (!ry) return '';
  if (ry.etat === 'dans') return 'Dans ton rythme';
  const q = estEuros(type) ? montre(ry.ecart) : `${ry.ecart} vente${ry.ecart > 1 ? 's' : ''}`;
  return ry.etat === 'avance' ? `En avance de ${q} sur ton rythme` : `En retard de ${q} sur ton rythme`;
};

// ── LA PROPOSITION : SES TROIS DERNIERS MOIS (11 nov.) ──────────────────────
// `mois` : les valeurs des 3 mois PLEINS d'avant (par la MÊME règle que la barre,
// `valeurObjectifMois`), du plus ancien au plus récent. Un mois pas su, partiel
// (site pas lu, prix d'achat manquants) ou d'avant le début de l'historique
// (`couvert` faux : aucune vente lue avant ce mois) ⇒ AUCUNE proposition — jamais
// une moyenne sur un historique troué. Euros : la moyenne arrondie à 10 € près ;
// ventes : à l'unité. Rien à proposer sous 10 € ou 1 vente.
export const propositionObjectif = (type, mois) => {
  if (!Object.prototype.hasOwnProperty.call(TYPES_OBJECTIF, type) || !Array.isArray(mois) || mois.length !== 3) return null;
  if (mois.some((m) => !m || m.valeur == null || !Number.isFinite(Number(m.valeur)) || m.partiel || m.couvert === false)) return null;
  const moyenne = mois.reduce((t, m) => t + Number(m.valeur), 0) / 3;
  const valeur = estEuros(type) ? Math.round(moyenne / 10) * 10 : Math.round(moyenne);
  if (!(valeur >= (estEuros(type) ? 10 : 1))) return null;
  return { type, valeur, moyenne: estEuros(type) ? Math.round(moyenne * 100) / 100 : Math.round(moyenne * 10) / 10 };
};
// Les bornes [de, a) des `n` mois pleins avant celui de `maintenant`, du plus ancien au plus récent.
export const moisPleinsAvant = (maintenant = Date.now(), n = 3) => {
  const d = new Date(maintenant);
  const out = [];
  for (let i = n; i >= 1; i--) {
    const de = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const a = new Date(d.getFullYear(), d.getMonth() - i + 1, 1);
    out.push({ ym: ymDe(de.getTime()), de: de.getTime(), a: a.getTime() });
  }
  return out;
};

// ── LE BILAN DU MOIS PASSÉ, UNE FOIS (11 nov.) ──────────────────────────────
// Du 1er au 7 du mois, tant qu'il n'a pas touché « OK » (`bilanVu`) : l'objectif
// EN VIGUEUR le mois passé (histoire) contre la valeur de ce mois-là (même règle).
// Atteint ⇒ « Octobre : objectif atteint ✓ » ; sinon l'écart ; « au moins » sous
// l'objectif ⇒ l'écart n'est pas su (le manque est nommé, aucun écart dit).
export const JOURS_BILAN = 7;
const NOMS_MOIS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
export const moisPasse = (maintenant = Date.now()) => moisPleinsAvant(maintenant, 1)[0];
export const bilanMoisPasse = (brut, x, maintenant = Date.now()) => {
  const d = new Date(maintenant);
  if (d.getDate() > JOURS_BILAN) return null;
  const mp = moisPasse(maintenant);
  if (brut && brut.bilanVu === mp.ym) return null;
  const obj = objectifDuMoisYm(brut, mp.ym);
  if (!obj) return null;
  const prog = progressionObjectif({ type: obj.type, valeur: obj.valeur, cache: {} }, x);
  const nom = NOMS_MOIS[Number(mp.ym.slice(5)) - 1];
  const eur = estEuros(obj.type);
  const ecart = prog.valeur == null || prog.atteint || prog.partiel ? null : (eur ? Math.round((obj.valeur - prog.valeur) * 100) / 100 : obj.valeur - prog.valeur);
  return { ym: mp.ym, nom, prog, ecart };
};
export const phraseBilan = (b, montre) => {
  if (!b) return '';
  const p = b.prog;
  const eur = estEuros(p.type);
  const m = (v) => (eur ? montre(v) : `${v} vente${v > 1 ? 's' : ''}`);
  if (p.valeur == null) return `${b.nom} : pas su`;
  if (p.atteint) return `${b.nom} : objectif atteint ✓`;
  if (b.ecart == null) return `${b.nom} : au moins ${m(p.valeur)} sur ${m(p.objectif)}`;
  return `${b.nom} : ${m(p.valeur)} sur ${m(p.objectif)} · il a manqué ${m(b.ecart)}`;
};
