// ════════════════════════════════════════════════════════════════════════════
//  LEBONCOIN, TROIS OUTILS DE PLUS (11 nov., lot lbc-plus — validés par Julien)
// ════════════════════════════════════════════════════════════════════════════
// Règles PURES (aucune lecture, aucune écriture), exécutées par l'écran Leboncoin
// et par scripts/audit-lbc-plus.cjs :
//   1. « Baisser le prix » : quelles annonces PROPOSER (la liste vient des vues et
//      favoris déjà relevés, `lbcstats`) — une proposition, jamais un envoi : c'est
//      SON clic qui lance, et chaque prix est lu avant et relu après (extension 5.363).
//   2. Republier (le même atelier que Vinted) : la limite anti-abus par annonce
//      (une fois par mois par défaut, réglable) et l'espacement (fixe ou au hasard,
//      SON choix) entre deux annonces.
// ⚠️ « Pas su » ne vaut pas « oui » (§5) : des statistiques jamais relevées, trop
//    vieilles ou illisibles ne proposent RIEN (et le disent), jamais « 0 favori ».

export const JOURS_SANS_FAVORI = 30;
export const PCT_PROPOSE = 5;
export const STATS_FRAICHES_MS = 7 * 86400000;

const ms = (v) => { const t = typeof v === 'number' ? v : Date.parse(String(v || '')); return Number.isFinite(t) ? t : NaN; };
const entier = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

// UNE annonce Leboncoin (la forme de l'écran : { id, prix, favoris, vues, statsAt, publieeLe }).
// Rend { propose, raison, pasSu } :
//   propose : 0 favori (LU) et en ligne depuis au moins `jours` jours ;
//   pasSu   : pourquoi on ne peut pas juger (« stats pas relevées », « stats anciennes »,
//             « date de mise en ligne inconnue ») — l'écran le dit, rien n'est proposé.
export function propositionBaisse(a, { maintenant = Date.now(), jours = JOURS_SANS_FAVORI } = {}) {
  if (!a || a.id == null) return { propose: false, raison: '', pasSu: 'annonce' };
  const prix = Number(a.prix);
  if (!(Number.isFinite(prix) && prix > 1)) return { propose: false, raison: '', pasSu: 'prix' };
  const fav = entier(a.favoris);
  if (fav == null) return { propose: false, raison: '', pasSu: 'stats' };
  const lu = ms(a.statsAt);
  if (!Number.isFinite(lu) || maintenant - lu > STATS_FRAICHES_MS) return { propose: false, raison: '', pasSu: 'stats-anciennes' };
  const pub = ms(a.publieeLe);
  if (!Number.isFinite(pub)) return { propose: false, raison: '', pasSu: 'date' };
  const j = Math.floor((maintenant - pub) / 86400000);
  if (fav > 0 || j < jours) return { propose: false, raison: '', pasSu: '' };
  return { propose: true, raison: `0 favori en ${j} jours`, jours: j, pasSu: '' };
}
// La liste : les proposées d'abord (les plus anciennes en tête), puis les autres.
// Rend { lignes: [{ ...a, propose, raison, pasSu }], nProposees, nPasSu }.
export function propositionsBaisse(annonces, opts = {}) {
  const L = (Array.isArray(annonces) ? annonces : []).filter((a) => a && a.id != null).map((a) => ({ ...a, ...propositionBaisse(a, opts) }));
  L.sort((x, y) => (Number(y.propose) - Number(x.propose)) || ((y.jours || 0) - (x.jours || 0)));
  return { lignes: L, nProposees: L.filter((l) => l.propose).length, nPasSu: L.filter((l) => l.pasSu === 'stats' || l.pasSu === 'stats-anciennes').length };
}

// ── Republier : la limite anti-abus ─────────────────────────────────────────
// `journal` = { [cléN°]: ISO de la dernière republication FAITE (extension ou « fait »
// à la main) } (`vrm_lbc_repub_journal`). Réglage : `vrm_lbc_repub_jours` (7 · 14 · 30 · 60).
export const JOURS_REPUB_DEFAUT = 30;
export const CHOIX_JOURS_REPUB = [7, 14, 30, 60];
export const joursRepub = (v) => (CHOIX_JOURS_REPUB.includes(Number(v)) ? Number(v) : JOURS_REPUB_DEFAUT);
// Rend { permis, derniere (ms|null), prochaine (ms|null) }. Une date illisible ne bloque
// pas (on ne sait pas ⇒ on ne prétend pas qu'elle a été faite) mais n'est jamais réécrite ici.
export function limiteRepub(journal, cle, jours = JOURS_REPUB_DEFAUT, maintenant = Date.now()) {
  const d = ms(journal && cle ? journal[cle] : '');
  if (!Number.isFinite(d)) return { permis: true, derniere: null, prochaine: null };
  const prochaine = d + joursRepub(jours) * 86400000;
  return { permis: maintenant >= prochaine, derniere: d, prochaine };
}
export const noterRepub = (journal, cle, maintenant = Date.now()) => (cle ? { ...(journal && typeof journal === 'object' ? journal : {}), [cle]: new Date(maintenant).toISOString() } : journal);

// ── Republier : l'espacement entre deux annonces (SON choix) ─────────────────
// { mode: 'fixe', fixe: minutes } ou { mode: 'alea', min, max } (minutes). Bornes :
// 1 à 120 min. Rend le délai en ms. `alea` injectable (bancs).
export const ESP_DEFAUT = { mode: 'fixe', fixe: 3, min: 2, max: 8 };
const borne = (v, d) => { const n = Math.round(Number(String(v == null ? '' : v).replace(',', '.'))); return Number.isFinite(n) ? Math.min(120, Math.max(1, n)) : d; };
export function espacementPropre(e) {
  const o = e && typeof e === 'object' ? e : {};
  const mode = o.mode === 'alea' ? 'alea' : 'fixe';
  const fixe = borne(o.fixe, ESP_DEFAUT.fixe);
  let min = borne(o.min, ESP_DEFAUT.min), max = borne(o.max, ESP_DEFAUT.max);
  if (max < min) [min, max] = [max, min];
  return { mode, fixe, min, max };
}
export function delaiEspacement(e, alea = Math.random) {
  const p = espacementPropre(e);
  if (p.mode === 'fixe') return p.fixe * 60000;
  return Math.round((p.min + (p.max - p.min) * Math.min(1, Math.max(0, alea()))) * 60000);
}
// L'attente totale entre N annonces (pour la phrase « environ … en tout »), en minutes.
export function attenteTotale(e, n) {
  const p = espacementPropre(e);
  const k = Math.max(0, (Number(n) || 0) - 1);
  return p.mode === 'fixe' ? p.fixe * k : Math.round(((p.min + p.max) / 2) * k);
}
// L'ordre : déplacer une annonce d'un cran (−1 monter, +1 descendre). Rend une copie.
export function deplacer(ordre, id, sens) {
  const o = (ordre || []).slice();
  const i = o.indexOf(id);
  const j = i + (sens < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= o.length) return o;
  [o[i], o[j]] = [o[j], o[i]];
  return o;
}
