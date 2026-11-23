// ── « PLUS VUE DEPUIS N J » : UNE ANNONCE QUI A CESSÉ D'ÊTRE VUE (22 nov., choix n° 27 de Julien, côté app) ───────────────
// « Une annonce en ligne dont les vues lues n'ont pas bougé depuis N jours (réglable, défaut 5) alors qu'elle en gagnait
// avant […] est signalée […] ; jamais sur un jour non lu (« — »). »
//
// LA SOURCE (mesurée le 22 nov. sur la vraie base, lecture seule) : ni `vinted_suivi_{uid}` (ext. 5.429) ni
// `courbes_annonces_{uid}_{nav}` (ext. 5.428) n'existent encore chez lui (extensions pas installées) ; les deux sont écrites
// par l'extension servie. UNE source est retenue : `vinted_suivi_{uid}` — UNE ligne par compte (pas une par navigateur à
// fusionner), un relevé par annonce et par JOUR de Paris (« 20261121,123,4,1;… », src/boostPeriode.js `lireSerie`), lue
// PROJETÉE annonce par annonce (src/boostLecture.js `lireSeries`). Le journal `vrm_vues_lues` (src/vuesFavoris.js) n'est
// PAS une source : il n'écrit un point que quand un chiffre change — un jour sans point y est indiscernable d'un jour non lu.
//
// LA RÈGLE (`plusVue`) — sur les seuls jours LUS (`v` non vide) :
//   · le DERNIER relevé doit dater d'aujourd'hui ou d'hier (jour de Paris) ; plus vieux ⇒ « pas su » (null) — l'écran ne
//     dit rien, jamais « plus vue » sur une lecture qui n'a pas eu lieu ;
//   · le PALIER = les relevés de la fin qui portent le MÊME nombre de vues ; il commence au premier relevé de ce nombre ;
//   · « en gagnait avant » = un relevé AVANT le palier, avec MOINS de vues ; aucun relevé avant ⇒ pas su (null) ;
//     un relevé avant avec PLUS de vues (Vinted a remis le compteur) ⇒ pas su (null) ;
//   · « plus vue » si le palier couvre au moins `jours` jours entre deux relevés LUS (son premier et son dernier) — le
//     nombre dit est ce qui est MESURÉ (« depuis 6 j » = 6 jours entre deux lectures au même nombre), jamais compté
//     jusqu'à aujourd'hui sans lecture d'aujourd'hui. Les vues d'une annonce ne baissent jamais : deux relevés égaux aux
//     deux bouts disent que rien n'a bougé entre eux, même un jour non lu au milieu.
// Rend { etat: 'plus', jours, depuis } · { etat: 'vue' } · null (pas su). Module PUR : scripts/audit-plus-vue.cjs.
import { lireSerie } from './boostPeriode.js';

export const CLE_PLUS_VUE_JOURS = 'vrm_plus_vue_jours';
export const PLUS_VUE_CHOIX = Object.freeze([3, 5, 7, 10, 14]);
export const PLUS_VUE_DEFAUT = 5;
const JOUR = 86400000;

export const joursPlusVue = (v) => (PLUS_VUE_CHOIX.includes(Number(v)) ? Number(v) : PLUS_VUE_DEFAUT);

// Le jour de Paris d'un instant, en ms UTC de minuit (la forme des relevés de `lireSerie`).
export function jourParisMs(ms) {
  try {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ms));
    const g = (t) => Number((p.find((x) => x.type === t) || {}).value);
    return Date.UTC(g('year'), g('month') - 1, g('day'));
  } catch (_) { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }
}

// `serie` : le texte rangé par l'extension, ou déjà lu par `lireSerie`.
export function plusVue(serie, { jours = PLUS_VUE_DEFAUT, maintenant = Date.now() } = {}) {
  const s = (typeof serie === 'string' ? lireSerie(serie) : Array.isArray(serie) ? serie : []).filter((x) => x && Number.isFinite(x.t) && x.v != null && Number.isFinite(x.v));
  if (!s.length) return null;
  const der = s[s.length - 1];
  const auj = jourParisMs(maintenant);
  if (der.t > auj + JOUR || auj - der.t > JOUR) return null;          // dernier relevé ni d'aujourd'hui ni d'hier : pas su
  let i = s.length - 1;
  while (i > 0 && s[i - 1].v === der.v) i--;
  if (i === 0) return null;                                            // rien d'avant le palier : « en gagnait » pas su
  if (!(s[i - 1].v < der.v)) return null;                              // compteur remis : pas su
  const palier = Math.round((der.t - s[i].t) / JOUR);
  const seuil = joursPlusVue(jours);
  return palier >= seuil ? { etat: 'plus', jours: palier, depuis: s[i].t } : { etat: 'vue' };
}
