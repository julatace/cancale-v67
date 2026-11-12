// ── LE MODE « GROS LOT » À L'ACHAT (11 nov. 2026, lot gros-lot) ─────────────
// Julien (demande validée) : quand il achète N articles d'un coup (même vendeur,
// brocante, déstockage), UNE saisie : le prix total (+ frais / port), le nombre
// d'articles, puis la répartition du coût selon SON choix — parts égales ; au
// prorata d'un prix de revente visé qu'il tape par article ; ou à la main —, le
// total tombant juste AU CENTIME (le reste dit et placé). Puis N fiches en
// série (titre, taille, photo facultative), N° consécutifs réservés au pool (ou
// tapés en « Je numérote moi-même »). Le lot reste UN achat (une identité, une
// pièce justificative) relié à ses N fiches ; la compta compte le coût réparti.
//
// Module PUR (aucun accès au navigateur ni à la base) : l'écran
// (src/GrosLot.jsx), la coque (App.jsx, `creerGrosLot`) et
// `scripts/audit-gros-lot.cjs` exécutent les MÊMES fonctions (§11).
//
// ⚠️ LA RÈGLE DU CENTIME : celle des ventes en lot (src/venteLot.js,
//    `repartirPrixLot`, plus grand reste) — la même règle, pas une copie.
//    L'ancien « Répartir un lot » (menu d'Annonces, retiré de la vue le 11 nov.,
//    lot DJ4) N'EST PAS repris : il arrondissait chaque part avec `toFixed` et
//    faisait absorber TOUT l'écart par le dernier article (au prorata, l'écart
//    pouvait faire plusieurs centimes, et le dernier article recevait un coût
//    qui n'était pas le sien). Ici, chaque centime de reste est DIT et posé sur
//    un article nommé.
// ⚠️ §2.5 : il saisit les prix lui-même. Rien n'est deviné : un prix visé
//    manquant (mode prorata) bloque et le dit ; à la main, un écart bloque, sauf
//    si des cases sont laissées VIDES — le reste y est réparti, et dit.
// ⚠️ §5 : les N° viennent de `prochainLibre` (la règle de l'app, passée en
//    paramètre, jamais recopiée) sur TOUS les N° servis : après le plus haut,
//    consécutifs, jamais un trou, jamais un ancien. Un N° tapé qui a déjà servi
//    est refusé. Les N° entrent au pool (append-only) à « Ajouter » et y restent
//    même après « Annuler » (ils ont pu être écrits sur les cartons).
// ⚠️ L'IDENTITÉ : chaque fiche porte l'id de SON lot (`achat`) et son rang ; le
//    lot porte la liste de ses fiches. Jamais un titre.

import { repartirPrixLot } from './venteLot.js';

export const LOT_MIN = 2;
export const LOT_MAX = 60;
export const ORIGINE_LOT = 'gros-lot';
export const MODES = ['egal', 'revente', 'main'];
export const PREFIXE_PHOTO_LOT = 'achat_lot_photo_';
const NUM_OK = /^([A-Z]{1,3})?\d{1,6}$/;

const str = (v) => String(v == null ? '' : v).trim();

// Un montant TAPÉ, en centimes. '' ⇒ null (vide) ; illisible ⇒ NaN (dit à l'écran).
// « 12 », « 12,5 », « 12,50 », « 12.50 », « 1 200,00 ». Jamais négatif.
export function centimesTapes(v) {
  const s = str(v).replace(/[\s  ]/g, '').replace(/€$/, '').replace(',', '.');
  if (s === '') return null;
  if (!/^\d{1,7}(?:\.\d{0,2})?$/.test(s)) return NaN;
  const [a, b = ''] = s.split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
// Centimes ⇒ « 12,50 » (la forme des champs et de `vinted_buyprice_by_num`).
export const texteCentimes = (c) => {
  if (!Number.isSafeInteger(c)) return '';
  const neg = c < 0; const a = Math.abs(c);
  return (neg ? '-' : '') + Math.floor(a / 100) + ',' + String(a % 100).padStart(2, '0');
};
export const nombreArticles = (v) => {
  const n = Number(str(v));
  return Number.isInteger(n) && n >= LOT_MIN && n <= LOT_MAX ? n : null;
};

// ── LA RÉPARTITION ──────────────────────────────────────────────────────────
// { total, frais } : centimes (frais null ⇒ 0) · n · mode · visees / manuels :
// tableaux de centimes|null|NaN (un par article).
// Rend { ok, cible, parts: [centimes]|null, reste: { centimes, sur: [rangs 0..] },
//        raison?, rangs? (les articles en cause), ecart? }.
// `raison` : 'total' (prix du lot absent/illisible) · 'frais' (illisible) · 'n' ·
// 'mode' · 'visee' (un prix visé manquant/illisible) · 'illisible' (un montant à
// la main) · 'trop' (les montants dépassent le total) · 'ecart' (la somme ≠ total).
export function repartirGrosLot({ total, frais = null, n, mode = 'egal', visees = [], manuels = [] } = {}) {
  const echec = (raison, plus = {}) => ({ ok: false, cible: null, parts: null, reste: { centimes: 0, sur: [] }, raison, ...plus });
  if (!(Number.isSafeInteger(total) && total > 0)) return echec('total');
  if (frais != null && !(Number.isSafeInteger(frais) && frais >= 0)) return echec('frais');
  if (!(Number.isInteger(n) && n >= LOT_MIN && n <= LOT_MAX)) return echec('n');
  if (!MODES.includes(mode)) return echec('mode');
  const cible = total + (frais || 0);
  const rangs = [...Array(n).keys()];
  // Le reste d'une répartition : les centimes posés au-delà de la part « plancher ».
  const resteDe = (parts, poids, somme, base, indices) => {
    const sur = []; let c = 0;
    indices.forEach((i, k) => { const plancher = Math.floor((base * poids[k]) / somme); const plus = parts[k] - plancher; if (plus > 0) { sur.push(i); c += plus; } });
    return { centimes: c, sur };
  };
  if (mode === 'egal') {
    const r = repartirPrixLot(cible, rangs.map(() => ({ prix: null })));
    return { ok: true, cible, parts: r.parts, reste: resteDe(r.parts, rangs.map(() => 1), n, cible, rangs) };
  }
  if (mode === 'revente') {
    const v = rangs.map((i) => visees[i]);
    const manquent = rangs.filter((i) => !(Number.isSafeInteger(v[i]) && v[i] > 0));
    if (manquent.length) return echec('visee', { rangs: manquent });
    const r = repartirPrixLot(cible, v.map((p) => ({ prix: p, devise: 'EUR' })));
    if (r.mode !== 'prorata') return echec('visee', { rangs });
    const somme = v.reduce((s, p) => s + p, 0);
    return { ok: true, cible, parts: r.parts, reste: resteDe(r.parts, v, somme, cible, rangs) };
  }
  // À la main : ce qu'il a tapé est gardé tel quel ; les cases VIDES reçoivent le reste.
  const m = rangs.map((i) => manuels[i]);
  const illisibles = rangs.filter((i) => Number.isNaN(m[i]) || (m[i] != null && !(Number.isSafeInteger(m[i]) && m[i] >= 0)));
  if (illisibles.length) return echec('illisible', { rangs: illisibles });
  const vides = rangs.filter((i) => m[i] == null);
  const tape = rangs.reduce((s, i) => s + (m[i] == null ? 0 : m[i]), 0);
  const ecart = cible - tape;
  if (ecart < 0) return echec('trop', { ecart, cible });
  if (!vides.length) {
    if (ecart !== 0) return echec('ecart', { ecart, cible });
    return { ok: true, cible, parts: m.slice(), reste: { centimes: 0, sur: [] } };
  }
  const r = repartirPrixLot(ecart, vides.map(() => ({ prix: null })));
  const parts = m.slice(); vides.forEach((i, k) => { parts[i] = r.parts[k]; });
  // Ici le « reste », c'est tout ce qui a été posé dans les cases vides.
  return { ok: true, cible, parts, reste: { centimes: ecart, sur: vides, cases: true } };
}

// La phrase du reste (une ligne, en français : le texte passe par tr() à l'écran,
// ces données-là — rangs et montants — sont rendues en `data-*`).
// Rangs dits à partir de 1 : « articles 1 et 2 », « articles 1, 4 et 9 ».
export const listeRangs = (sur) => {
  const r = (sur || []).map((i) => String(i + 1));
  if (r.length <= 1) return r.join('');
  return r.slice(0, -1).join(', ') + ' et ' + r[r.length - 1];
};

// ── LES N° ──────────────────────────────────────────────────────────────────
// Les N° du lot, consécutifs, après le plus haut servi : `prochainLibre` appelé n
// fois sur une COPIE des N° pris (il ajoute chaque N° rendu ⇒ le suivant suit).
// Rend [n N°] ; lève si un N° rendu avait déjà servi ou si la suite n'est pas
// consécutive (rien ne sera écrit).
export function numerosDuLot(n, { pris, pref = '', prochainLibre, cleNum } = {}) {
  if (typeof prochainLibre !== 'function' || typeof cleNum !== 'function') throw new Error('règles absentes');
  if (!(Number.isInteger(n) && n >= 1 && n <= LOT_MAX)) throw new Error('nombre');
  const int = new Set(pris && pris.int ? pris.int : []), cles = new Set(pris && pris.cles ? pris.cles : []);
  const avant = new Set([...cles].map(cleNum)); for (const x of int) avant.add(cleNum(x));
  const out = [];
  for (let i = 0; i < n; i++) {
    const num = String(prochainLibre(int, cles, pref));
    const k = cleNum(num);
    if (!num || avant.has(k) || out.some((x) => cleNum(x) === k)) throw new Error('numéro déjà servi');
    out.push(num);
  }
  const valeur = (x) => Number(/(\d+)$/.exec(cleNum(x))[1]);
  for (let i = 1; i < out.length; i++) if (valeur(out[i]) !== valeur(out[i - 1]) + 1) throw new Error('pas consécutifs');
  return out;
}

// « Je numérote moi-même » : la suite à partir du 1er N° tapé (« 45 » ⇒ 45, 46… ;
// « A12 » ⇒ A12, A13…). Rien de lisible ⇒ [].
export function suiteDepuis(depart, n, cleNum) {
  const c = typeof cleNum === 'function' ? cleNum(depart) : str(depart).toUpperCase();
  const m = /^([A-Z]{0,3})(\d{1,6})$/.exec(c || '');
  if (!m || !(Number.isInteger(n) && n >= 1)) return [];
  const pref = m[1], v = Number(m[2]);
  return Array.from({ length: n }, (_, i) => pref + String(v + i));
}

// Un N° tapé : la règle du rangement (rangement-guide) — vide, illisible, de la
// série d'archive, déjà servi, ou deux fois dans le lot ⇒ refusé, dit.
export function verifierNumerosTapes(tapes, { pris, archive = '', cleNum } = {}) {
  const erreurs = [];
  const vus = new Map();
  (tapes || []).forEach((v, i) => {
    const c = typeof cleNum === 'function' ? cleNum(v) : '';
    let raison = null;
    if (!c) raison = 'vide';
    else if (!NUM_OK.test(c)) raison = 'illisible';
    else if (archive && new RegExp('^' + archive + '\\d+$').test(c)) raison = 'archive';
    else if (!(pris instanceof Set)) raison = 'passu';
    else if (pris.has(c)) raison = 'pris';
    else if (vus.has(c)) raison = 'double';
    if (raison) erreurs.push({ i, raison, num: c }); else vus.set(c, i);
  });
  return { ok: erreurs.length === 0, erreurs };
}

// ── LE PLAN D'ÉCRITURE ──────────────────────────────────────────────────────
// Tout ce que « Ajouter » écrit, calculé ici (la coque n'invente rien) :
//   · achat : UNE ligne de `vinted_offvinted_buys` (le lot, prix = total + frais,
//     ce qui est sorti de sa poche) avec `lot` : { n, prix, frais, mode, articles:
//     [{ fiche, numero, part }] } ;
//   · fiches : N fiches neuves (`vrm_fiches_neuves`, la liste « À publier »),
//     chacune avec SON coût réparti, l'id du lot et son rang ;
//   · couts : `vinted_buyprice_by_num` — le coût de chaque N° (« 12,50 »), la
//     clé que le bénéfice et la compta lisent déjà (`prixAchatDe`).
// `articles` : [{ titre, taille, visee (centimes|null), photo: bool }] ; `ids` : n ids de fiche.
// (intégration g1, branchement rangement-guide) `cases` (facultatif) : une place par article, { m, i } ou null,
// déjà choisie par la règle du rangement guidé (src/rangementArrivee.js, `casesEnSerie`) et VÉRIFIÉE par l'appelant.
// Une place ⇒ la fiche la porte (`case`, `rangeAt`) et la case du Stock est notée (`vrm_slots`, par N°).
export function planGrosLot({ lotId, titre, date, source = '', ref = '', total, frais = null, mode, articles, numeros, repartition, ids, cases = null, maintenant = new Date().toISOString() } = {}) {
  const n = (articles || []).length;
  if (!lotId || !n || !repartition || !repartition.ok || repartition.parts.length !== n) throw new Error('répartition');
  if (!Array.isArray(numeros) || numeros.length !== n || !Array.isArray(ids) || ids.length !== n) throw new Error('numéros');
  if (cases != null && (!Array.isArray(cases) || cases.length !== n)) throw new Error('cases');
  const somme = repartition.parts.reduce((s, p) => s + p, 0);
  if (somme !== total + (frais || 0)) throw new Error('somme');
  const nomLot = str(titre) || `Lot de ${n} articles`;
  const fiches = {}, couts = {}, slots = {};
  const liste = articles.map((a, i) => {
    const id = String(ids[i]); const numero = String(numeros[i]); const part = repartition.parts[i];
    const titreA = str(a && a.titre).slice(0, 200) || `${nomLot} · ${i + 1}/${n}`;
    fiches[id] = {
      id, numero, creeAt: maintenant, photos: [], titre: titreA, marque: '', taille: str(a && a.taille).slice(0, 40), etat: '', description: '',
      prix: a && Number.isSafeInteger(a.visee) && a.visee > 0 ? a.visee / 100 : null,
      origine: ORIGINE_LOT, achat: String(lotId), rang: i + 1, cout: part,
      ...(a && a.photo ? { photoLigne: PREFIXE_PHOTO_LOT + id } : {}),
    };
    const place = cases && cases[i] && cases[i].m != null && Number.isInteger(Number(cases[i].i)) ? { m: String(cases[i].m), i: Number(cases[i].i) } : null;
    if (place) { fiches[id].case = place; fiches[id].rangeAt = maintenant; slots[numero] = place; }
    couts[numero] = texteCentimes(part);
    return { fiche: id, numero, part };
  });
  const achat = {
    id: String(lotId), createdAt: maintenant, title: nomLot.slice(0, 200), price: texteCentimes(total + (frais || 0)),
    date: str(date), source: str(source), ...(str(ref) ? { ref: str(ref).slice(0, 40) } : {}),
    lot: { n, prix: total, frais: frais || 0, mode, articles: liste },
  };
  return { achat, fiches, couts, slots };
}

// Les morceaux du geste annulable (src/corbeille.js : 'element' / 'cle').
// Ajouter = poser ; « Annuler » (sens 'avant') = retirer exactement ce qui a été posé
// — sauf le pool des N°, écrit hors du geste (jamais rendu, §5).
export function morceauxGrosLot(plan) {
  const m = [{ k: 'vinted_offvinted_buys', type: 'element', idCle: 'id', id: plan.achat.id, avant: undefined, apres: plan.achat, index: 0, defaut: [] }];
  for (const [id, f] of Object.entries(plan.fiches)) m.push({ k: 'vrm_fiches_neuves', type: 'cle', id, avant: undefined, apres: f });
  for (const [num, c] of Object.entries(plan.couts)) m.push({ k: 'vinted_buyprice_by_num', type: 'cle', id: num, avant: undefined, apres: c });
  for (const [num, c] of Object.entries(plan.slots || {})) m.push({ k: 'vrm_slots', type: 'cle', id: num, avant: undefined, apres: c });
  return m;
}

// Le coût d'un lot relu (contrôle de la compta) : somme des parts = ce qui est sorti.
export const lotJuste = (achat) => {
  const l = achat && achat.lot;
  if (!l || !Array.isArray(l.articles) || l.articles.length !== l.n) return false;
  return l.articles.reduce((s, a) => s + (Number.isSafeInteger(a.part) ? a.part : NaN), 0) === l.prix + (l.frais || 0);
};
