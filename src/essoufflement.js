// ═══════════════════════════════════════════════════════════════════════════
// LES ANNONCES QUI S'ESSOUFFLENT — LA RÈGLE (28 nov., choix de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « Relance des annonces qui s'essoufflent : quand une annonce n'a plus ni vues ni favoris depuis plusieurs jours, elle
//   remonte en tête de "À republier", avec le gain estimé. C'est toujours toi qui lances. »
//
// UN PROPRIÉTAIRE (§5) : ce module. « À republier en priorité » (src/republierPriorite.js) le CONSOMME, l'écran le DIT,
// la notification (api/_lib/essoufflement-notif.js) ne fait que relayer le nombre publié par l'écran.
//
// LA SOURCE : la courbe de l'annonce (`courbes_annonces_{uid}_{nav}`, ext. 5.428, src/courbeAnnonce.js) — un point par
// jour LU = [jour local, vues, favoris, prix, minute], ce que Vinted a écrit ce jour-là. Plusieurs navigateurs : un jour
// garde la lecture la plus tardive (la règle de `serieCourbe`). RIEN n'est interpolé : un jour sans lecture est un TROU.
//
// « ESSOUFFLÉE » (etatCourbe) — on remonte depuis le DERNIER jour lu :
//   · le dernier jour lu doit être d'aujourd'hui ou d'hier (`ESS.fraicheur`) — sinon « pas su » (la courbe est vieille) ;
//   · chaque pas d'un jour au jour suivant (jours CONSÉCUTIFS, tous deux lus) est « plat » si les vues gagnent au plus
//     `ESS.vuesMax` (1) et les favoris EXACTEMENT 0 (une baisse de favoris peut cacher un favori neuf : pas plat) ;
//   · ESSOUFFLÉE quand au moins `ESS.jours` (4) pas de suite sont plats (5 jours lus de suite) ; `jours` = le nombre de
//     pas plats (« Presque aucune vue depuis 5 jours ») ;
//   · un pas NON plat avant d'atteindre 4 ⇒ « active » (elle vit encore) ;
//   · un TROU (jour non lu), un champ absent, des vues à 0 (Vinted écrit 0 quand il ne donne plus le nombre : pas su,
//     CLAUDE.md « ça met que mes annonces ont zéro vue »), des vues qui reculent, ou une courbe trop courte avant
//     d'atteindre 4 ⇒ « pas su » — JAMAIS essoufflée sur un doute.
//
// LE GAIN ESTIMÉ (gainCompte) — d'après SES republications passées, sur CE compte seulement :
//   · une republication = un repère « r » posé par le journal de VRM sur la NOUVELLE annonce (src/courbeAnnonce.js :
//     republiee → r sur l'ancienne ET la nouvelle). La nouvelle se reconnaît à sa courbe : aucun jour lu AVANT le jour du
//     repère (l'ancienne, elle, a été lue avant ; elle est supprimée ce jour-là) ;
//   · son gain = ses vues LUES le 3ᵉ jour après le repère (`ESS.gainJours`) : une annonce republiée est une annonce neuve,
//     son compteur part de 0 ; ce jour pas lu, ou vues à 0 (pas su) ⇒ cette republication n'est PAS comptée ;
//   · le gain du compte = la moyenne arrondie, AVEC sa couverture (`n` republications). Aucune ⇒ `moyenne: null` (« — »,
//     avec la raison : aucune republication relue sur ce compte). Jamais un chiffre d'un autre compte, jamais inventé.
//
// L'ANNONCE (essouffleesDe) : EN LIGNE d'après les articles (<enligne-regle> : état 'enligne', jamais « à confirmer »),
// et ni vendue (sur n'importe quel site), ni masquée, ni réservée — ces exclusions-là sont celles de republierPriorite.js,
// qui les compte. Tout site dont une courbe existe ; aujourd'hui seule l'extension de Vinted en écrit.
//
// Module PUR : aucune lecture, aucune écriture, aucune langue. Exécuté par scripts/audit-essoufflement.cjs.
// ═══════════════════════════════════════════════════════════════════════════
import { jourCourbe } from './courbeAnnonce.js';

export const ESS = Object.freeze({ jours: 4, vuesMax: 1, favorisMax: 0, fraicheur: 1, gainJours: 3 });
export const CLE_NOTIF_ESS = 'vrm_essouffle';          // ce que l'écran publie pour la notification (ligne du vendeur)
export const CAT_ESSOUFFLE = 'essouffle';               // la catégorie du serveur (famille « Rappels »)

const str = (v) => (v == null ? '' : String(v).trim());
const entier = (v) => (Number.isInteger(v) && v >= 0 ? v : null);

// Les points d'une annonce (une ou plusieurs listes — un navigateur chacune) ⇒ [{ j, v, f }] triés, un par jour, la
// lecture la plus tardive du jour. Un point illisible est ignoré.
export function fusionPoints(listes) {
  const parJour = new Map();
  for (const l of Array.isArray(listes) ? listes : []) {
    for (const x of Array.isArray(l) ? l : []) {
      if (!Array.isArray(x) || x.length < 5 || !Number.isInteger(x[0]) || x[0] <= 0) continue;
      const m = Number.isInteger(x[4]) ? x[4] : -1;
      const cur = parJour.get(x[0]);
      if (!cur || m > cur.m) parJour.set(x[0], { j: x[0], v: entier(x[1]), f: entier(x[2]), m });
    }
  }
  return [...parJour.values()].sort((a, b) => a.j - b.j).map(({ j, v, f }) => ({ j, v, f }));
}

// Des vues LUES (un 0 de Vinted = « il ne donne plus le nombre » : pas su) et des favoris lus.
const lisible = (p) => p && p.v != null && p.v > 0 && p.f != null;

// L'état d'UNE courbe : { etat: 'essoufflee', jours, dernier } · { etat: 'active', dernier } · { etat: 'passu', raison }.
// raison : 'aucune' (rien lu) · 'ancienne' (dernier jour lu trop vieux) · 'trou' (un jour non lu) · 'champ' (vues ou
// favoris pas lus) · 'recul' (vues qui reculent) · 'courte' (pas assez de jours lus).
export function etatCourbe(points, { maintenant = Date.now() } = {}) {
  const pts = fusionPoints([points]);
  if (!pts.length) return { etat: 'passu', raison: 'aucune' };
  const auj = jourCourbe(maintenant);
  const z = pts[pts.length - 1];
  if (auj - z.j > ESS.fraicheur) return { etat: 'passu', raison: 'ancienne', dernier: z.j };
  let plats = 0, arret = 'courte';
  for (let i = pts.length - 1; i > 0; i--) {
    const b = pts[i], a = pts[i - 1];
    if (b.j - a.j !== 1) { arret = 'trou'; break; }
    if (!lisible(a) || !lisible(b)) { arret = 'champ'; break; }
    const dv = b.v - a.v, df = b.f - a.f;
    if (dv < 0) { arret = 'recul'; break; }
    if (dv <= ESS.vuesMax && df === ESS.favorisMax) { plats++; continue; }
    arret = 'vit'; break;
  }
  if (plats >= ESS.jours) return { etat: 'essoufflee', jours: plats, dernier: z.j };
  if (arret === 'vit') return { etat: 'active', dernier: z.j };
  return { etat: 'passu', raison: arret };
}

// Le gain estimé d'UN compte : `compte` = { a: { [id]: points }, ev: { [id]: [[j, code]] } } (ses lignes de courbes,
// fusionnées). Rend { n, moyenne (null si n = 0), echantillons: [{ id, jour, vues }] }.
export function gainCompte(compte, { maintenant = Date.now() } = {}) {
  const A = compte && compte.a && typeof compte.a === 'object' ? compte.a : {};
  const EV = compte && compte.ev && typeof compte.ev === 'object' ? compte.ev : {};
  const auj = jourCourbe(maintenant);
  const ech = [];
  for (const id of Object.keys(EV).sort()) {
    const jours = (Array.isArray(EV[id]) ? EV[id] : []).filter((r) => Array.isArray(r) && Number.isInteger(r[0]) && r[1] === 'r').map((r) => r[0]).sort((x, y) => x - y);
    if (!jours.length) continue;
    const pts = fusionPoints([A[id]]);
    if (!pts.length) continue;
    const jr = jours[0];
    if (pts.some((p) => p.j < jr)) continue;              // lue avant le repère : c'est l'ANCIENNE annonce
    const cible = jr + ESS.gainJours;
    if (cible > auj) continue;                             // trop récente pour être mesurée
    const p = pts.find((x) => x.j === cible);
    if (!p || !(p.v != null && p.v > 0)) continue;         // ce jour-là pas lu (ou vues pas sues) : pas comptée
    ech.push({ id, jour: jr, vues: p.v });
  }
  const n = ech.length;
  return { n, moyenne: n ? Math.round(ech.reduce((t, e) => t + e.vues, 0) / n) : null, echantillons: ech };
}

// Les courbes lues (`lireCourbesEssoufflement`) ⇒ { [uid]: { a, ev, lus: Set } } ; tout autre chose ⇒ tel quel (undefined / null).
// `rows` : [{ id: 'courbes_annonces_{uid}_{nav}', a: { [id]: points }, ev: { [id]: reperes } }], `lus` : { [uid]: [ids lus] }.
export function courbesParCompte(rows, lus) {
  if (!Array.isArray(rows)) return rows === undefined ? undefined : null;
  const out = {};
  const pre = 'courbes_annonces_';
  for (const r of rows) {
    const id = str(r && r.id);
    if (!id.startsWith(pre)) continue;
    const uid = id.slice(pre.length).split('_')[0];
    if (!/^\d{1,20}$/.test(uid)) continue;
    const c = out[uid] || (out[uid] = { a: {}, ev: {}, lus: new Set() });
    for (const [k, l] of Object.entries(r.a && typeof r.a === 'object' ? r.a : {})) if (Array.isArray(l)) (c.a[k] = c.a[k] || []).push(...l);
    for (const [k, l] of Object.entries(r.ev && typeof r.ev === 'object' ? r.ev : {})) if (Array.isArray(l)) (c.ev[k] = c.ev[k] || []).push(...l);
  }
  for (const [uid, ids] of Object.entries(lus && typeof lus === 'object' ? lus : {})) {
    const c = out[uid] || (out[uid] = { a: {}, ev: {}, lus: new Set() });
    for (const x of Array.isArray(ids) ? ids : []) c.lus.add(str(x));
  }
  return out;
}

// L'état d'UNE annonce d'un compte : lue ⇒ etatCourbe ; pas lue (paquet raté, compte absent) ⇒ pas su.
export function etatAnnonce(courbes, compte, id, opts = {}) {
  const c = courbes && courbes[str(compte)];
  if (!c || !c.lus || !c.lus.has(str(id))) return { etat: 'passu', raison: 'pasLue' };
  return etatCourbe(c.a[str(id)] || [], opts);
}

// Le texte de la notification (une fois par jour au plus) — un nombre, jamais un titre.
export function notificationEssouffle(n) {
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1) return null;
  return { title: k > 1 ? `${k} annonces s’essoufflent` : '1 annonce s’essouffle', body: 'Elles remontent en tête de « À republier ». C’est toi qui lances.', tag: 'vrm-essouffle', url: '/?tab=annonces&vue=arepublier' };
}
// Le jour de Paris (AAAA-MM-JJ) : la borne « une par jour ».
export function jourParis(t = Date.now()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t)); } catch (_) { return new Date(t).toISOString().slice(0, 10); }
}
