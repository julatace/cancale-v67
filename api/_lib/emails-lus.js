// ── LU / NON LU DANS LA BOÎTE « E-MAILS » (6 nov., v36 — Julien : « continue à
// améliorer la boîte mail de l'app, c'est pas ouf ») ─────────────────────────
// UNE règle (§11), lue par la route (`lireJournalEmail` : le drapeau `lu` de
// chaque ligne, le filtre « Non lus », le nombre de non-lus) ET par l'écran (le
// geste appliqué tout de suite, avant la réécriture). Rien d'autre ne décide.
//
// La ligne `vrm_emails_lus` (une par vendeur, sous SON owner, écrite par l'app sur
// SON geste — ouvrir un e-mail, « Marquer non lu », « Tout marquer lu ») :
//   { v: 1, jusqua: ISO, lus: [[cle, atMs], …], nonlus: [[cle, atMs], …], rev }
//   · `jusqua` : tout e-mail rangé (`at`) jusqu'à cet instant est LU ;
//   · `lus` : les e-mails plus récents ouverts un par un ;
//   · `nonlus` : les e-mails d'avant `jusqua` remis « non lu » par lui.
// `cle` = les 24 premiers caractères de l'empreinte de la ligne de suivi
// (`email_reception_<sha256>`), jamais un sujet ni une adresse.
//
// ⚠️ Pas de ligne (jamais rien touché) : tout ce qui est rangé avant
//    `LUS_DEPUIS` (la mise en service) est lu, le reste non lu — la boîte ne
//    s'allume pas de 900 points bleus le premier jour. Rien n'est écrit pour ça.
// ⚠️ « Pas su » ≠ « lu » : une lecture ratée de la ligne ⇒ `null` partout (aucun
//    point, aucun nombre, le filtre « Non lus » dit qu'il n'a pas pu lire).
// ⚠️ Lu / non lu ne cache RIEN : un e-mail lu reste dans la boîte (§5, « on ne
//    jette aucun email »). Il n'y a pas d'« archiver ».
export const LUS_ID = 'vrm_emails_lus';
export const LUS_DEPUIS = '2026-11-06T18:00:00.000Z';
export const LUS_MAX = 600, NONLUS_MAX = 150;
const CLE = /^email_reception_([0-9a-f]{16,64})$/;
export const cleLu = (id) => { const m = CLE.exec(String(id || '')); return m ? m[1].slice(0, 24) : null; };
const ms = (v) => { const t = Date.parse(v == null ? '' : String(v)); return Number.isFinite(t) ? t : null; };
const paires = (l, max) => (Array.isArray(l) ? l : [])
  .filter((p) => Array.isArray(p) && typeof p[0] === 'string' && /^[0-9a-f]{16,24}$/.test(p[0]) && Number.isFinite(p[1]))
  .slice(0, max);

// L'état lisible d'une ligne lue (`data`). `undefined`/absente ⇒ l'état de départ ;
// `null` (lecture ratée) ⇒ `null`.
export function etatLus(data) {
  if (data === null) return null;
  const d = data && typeof data === 'object' ? data : {};
  const jusqua = Math.max(ms(LUS_DEPUIS), ms(d.jusqua) || 0);
  return { jusqua, lus: new Map(paires(d.lus, LUS_MAX)), nonlus: new Map(paires(d.nonlus, NONLUS_MAX)) };
}
// Lu ? (`e` : { id, at }). `null` si l'état n'est pas su.
export function estLu(e, etat) {
  if (!etat) return null;
  const k = cleLu(e && e.id);
  if (k && etat.nonlus.has(k)) return false;
  const t = ms(e && e.at);
  if (t != null && t <= etat.jusqua) return true;
  return !!(k && etat.lus.has(k));
}
// Les gestes appliqués à un état (sur l'état RELU juste avant d'écrire : deux
// appareils ne s'écrasent pas, chacun rejoue SES gestes sur l'autre).
//   { k: 'lu', id, at } · { k: 'nonlu', id, at } · { k: 'tout', jusqua }
export function appliquerGestes(data, gestes) {
  const e = etatLus(data && typeof data === 'object' ? data : undefined);
  for (const g of Array.isArray(gestes) ? gestes : []) {
    if (!g) continue;
    if (g.k === 'tout') { const j = ms(g.jusqua); if (j != null && j > e.jusqua) e.jusqua = j; e.nonlus.clear(); continue; }
    const k = cleLu(g.id), t = ms(g.at);
    if (!k || t == null) continue;
    if (g.k === 'lu') { e.nonlus.delete(k); if (t > e.jusqua) e.lus.set(k, t); }
    else if (g.k === 'nonlu') { e.lus.delete(k); if (t <= e.jusqua) e.nonlus.set(k, t); }
  }
  // Ce que `jusqua` couvre déjà sort de `lus` ; les plus récents d'abord, bornés.
  const garde = (m, f, max) => [...m.entries()].filter(f).sort((a, b) => b[1] - a[1]).slice(0, max);
  return { v: 1, jusqua: new Date(e.jusqua).toISOString(),
    lus: garde(e.lus, ([, t]) => t > e.jusqua, LUS_MAX), nonlus: garde(e.nonlus, ([, t]) => t <= e.jusqua, NONLUS_MAX) };
}
