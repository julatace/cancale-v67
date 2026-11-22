// ══════════════════════════════════════════════════════════════════════════════
//  LA NOTE DE SANTÉ D'UN COMPTE, LA CADENCE QUI BAISSE SEULE, LE COMPTE PRÉCIEUX (22 nov. 2026, ext. 5.438.0)
//  docs/passation/2026-11-22-ext-5438.md
// ══════════════════════════════════════════════════════════════════════════════
// Julien (22 nov., choix 1 et 2) :
//  1. « une note par compte (refus, 403/429, captchas vus, annonces masquées par Vinted, vues en baisse mesurée,
//     messages refusés) avec la raison de chaque point ; quand elle baisse, la cadence du compte baisse SEULE (palier
//     dit : « cadence réduite à 30/h : 2 captchas en 24 h ») et remonte progressivement quand ça va mieux » ;
//  2. « compte précieux » (un interrupteur par compte) : cadence divisée par deux, pas de republication en série, favoris
//     seulement à la main, pas d'acceptation automatique — dit partout où c'est bloqué.
// LA NOTE (sur 100) : 100 moins des points retirés, CHAQUE point avec sa raison (sa sorte, combien en 24 h, combien en
// 72 h, ce qu'il retire). Un événement retire tout son poids pendant 24 h, la moitié de 24 à 48 h, le quart de 48 à 72 h,
// puis plus rien : la note REMONTE SEULE, par marches, quand plus rien n'arrive (aucune horloge cachée, aucune remise à
// zéro d'un coup). « Pas su » ne vaut pas « bon » : carnet illisible ⇒ `note: null` (l'écran dit « — ») ; une source
// illisible (masquées, vues) est NOMMÉE dans `manque` et ne retire rien — jamais un chiffre inventé.
// LE PALIER : la note donne la part de SA cadence gardée (≥ 85 : toute ; 70–84 : 60 % ; 50–69 : 40 % ; < 50 : 20 %), sur
// ses actions/h ET ses favoris/h — jamais plus que SA cadence, jamais moins de 5 actions/h et 1 favori/h (ses clics
// gardent leur réserve). Le compte précieux divise encore par deux. Rien ne monte jamais AU-DESSUS de son réglage.
// Module PUR (aucun réseau, aucune horloge implicite) : le bloc <sante-note-regle> est recopié TEL QUEL dans
// vinted-sync-extension/background.js (node scripts/audit-ext-5438.cjs --recopie) ; l'audit exécute la copie livrée.
// <sante-note-regle> — la RÈGLE, recopiée telle quelle dans background.js (node scripts/audit-ext-5438.cjs --recopie).
const SN_POIDS = { captcha: 15, '403': 10, '429': 10, masquee: 10, msgrefus: 6, refus: 4, pasvu: 2, vues: 10 };
const SN_SORTES_CARNET = ['captcha', '403', '429', 'refus', 'msgrefus', 'pasvu'];
const SN_FENETRES_H = [[24, 1], [48, 0.5], [72, 0.25]];
const SN_PALIERS = [[85, 100], [70, 60], [50, 40], [0, 20]];
const SN_MIN = { actionsHeure: 5, favorisHeure: 1 };
const SN_VUES = { jours: 3, minAnnonces: 5, minVues: 20, seuil: 0.5 };
// Ce qu'un événement de l'instant `t` pèse à `maintenant` (1, ½, ¼, puis 0). Une date fausse ou à venir ne pèse rien.
function snPoidsAge(t, maintenant) {
  const age = Number(maintenant) - Number(t);
  if (!Number.isFinite(age) || age < 0) return 0;
  for (const [h, w] of SN_FENETRES_H) if (age < h * 3600000) return w;
  return 0;
}
// LES VUES EN BAISSE, MESURÉE : `memo` = la courbe de chaque annonce ({ [id]: [[jour, vues cumulées, fav, prix, minute]] },
// celle de la 5.428) ; `jourFin` = le jour d'aujourd'hui (même échelle). Les vues GAGNÉES ces 3 jours contre les 3 jours
// d'avant, sur les SEULES annonces lues aux trois bornes (une lecture le jour même ou la veille). Trop peu lu ⇒
// { lu: false, raison } ; jamais une baisse inventée sur deux lectures.
function snVuesTendance(memo, jourFin) {
  const m = memo && typeof memo === 'object' ? memo : null;
  const fin = Number(jourFin);
  if (!m || !Number.isInteger(fin)) return { lu: false, raison: 'pas_lu' };
  const D = SN_VUES.jours;
  const vueA = (l, j) => { let best = null; for (const x of l) if (Array.isArray(x) && Number.isInteger(x[0]) && x[0] <= j && x[0] >= j - 1 && Number.isInteger(x[1]) && x[1] >= 0 && (!best || x[0] > best[0])) best = x; return best ? best[1] : null; };
  let n = 0, avant = 0, apres = 0;
  for (const id of Object.keys(m)) {
    const l = Array.isArray(m[id]) ? m[id] : [];
    const a = vueA(l, fin - 2 * D), b = vueA(l, fin - D), c = vueA(l, fin);
    if (a == null || b == null || c == null || b < a || c < b) continue;
    n++; avant += b - a; apres += c - b;
  }
  if (n < SN_VUES.minAnnonces) return { lu: false, raison: 'peu_annonces', n };
  if (avant < SN_VUES.minVues) return { lu: false, raison: 'peu_vues', n, avant, apres };
  const baisse = apres < avant * SN_VUES.seuil;
  return { lu: true, n, avant, apres, baisse, pct: Math.round((1 - apres / avant) * 100) };
}
// LA NOTE. `f` : { ev: [{ t, s }] (le carnet des 7 jours) | null, masquees: [t] (annonces masquées PAR VINTED, prouvées) |
// null, vues: sortie de snVuesTendance | null }. Rend { note, pct, points: [{ k, n24, n72, retire }], principal, manque }.
function snNote(f, maintenant) {
  const x = f && typeof f === 'object' ? f : {};
  if (!Array.isArray(x.ev)) return { note: null, pct: 100, points: [], principal: null, manque: ['carnet'] };
  const t0 = Number(maintenant) || 0;
  const points = [], manque = [];
  const compter = (k, liste) => {
    let n24 = 0, n72 = 0, retire = 0;
    for (const t of liste) { const w = snPoidsAge(t, t0); if (!w) continue; n72++; if (w === 1) n24++; retire += SN_POIDS[k] * w; }
    if (n72) points.push({ k, n24, n72, retire: Math.round(retire * 10) / 10 });
  };
  for (const k of SN_SORTES_CARNET) compter(k, x.ev.filter((e) => e && e.s === k).map((e) => Number(e.t)));
  if (Array.isArray(x.masquees)) compter('masquee', x.masquees.map(Number)); else manque.push('masquees');
  const v = x.vues && typeof x.vues === 'object' ? x.vues : null;
  if (v && v.lu === true) { if (v.baisse === true) points.push({ k: 'vues', n24: 0, n72: 0, retire: SN_POIDS.vues, avant: v.avant, apres: v.apres, pctBaisse: v.pct }); }
  else manque.push('vues');
  const total = points.reduce((s, p) => s + p.retire, 0);
  const note = Math.max(0, Math.min(100, Math.round(100 - total)));
  let pct = 100;
  for (const [seuil, p] of SN_PALIERS) if (note >= seuil) { pct = p; break; }
  const principal = points.length ? points.slice().sort((a, b) => b.retire - a.retire || (a.k < b.k ? -1 : 1))[0] : null;
  return { note, pct, points: points.sort((a, b) => b.retire - a.retire || (a.k < b.k ? -1 : 1)), principal, manque };
}
// LA CADENCE APPLIQUÉE : `cad` = SA cadence ({ actionsHeure, favorisHeure }) ; `sn` = sortie de snNote (ou null) ;
// `precieux` = son interrupteur. Jamais au-dessus de son réglage, jamais sous les minimums.
function snCadence(cad, sn, precieux) {
  const c = cad && typeof cad === 'object' ? cad : {};
  const a = Number(c.actionsHeure) > 0 ? Math.floor(Number(c.actionsHeure)) : 50;
  const fv = Number(c.favorisHeure) > 0 ? Math.floor(Number(c.favorisHeure)) : 15;
  const pNote = sn && sn.note != null && Number(sn.pct) > 0 && Number(sn.pct) < 100 ? Number(sn.pct) : 100;
  const k = (precieux === true ? 0.5 : 1) * pNote / 100;
  const borne = (v, base, min) => Math.min(base, Math.max(Math.min(min, base), Math.floor(v)));
  const par = [];
  if (pNote < 100) par.push('note');
  if (precieux === true) par.push('precieux');
  return { actionsHeure: borne(a * k, a, SN_MIN.actionsHeure), favorisHeure: borne(fv * k, fv, SN_MIN.favorisHeure), reglage: { actionsHeure: a, favorisHeure: fv }, reduite: k < 1, par, pctNote: pNote };
}
// LA PHRASE (clé + valeurs, les mots sont dans les langues) : « cadence réduite à 30/h : 2 captchas en 24 h ».
function snPhrase(sn, ce) {
  if (!sn || sn.note == null) return { cle: 'passu', v: {} };
  if (!ce || !ce.reduite) return { cle: 'normale', v: { note: sn.note } };
  const p = sn.principal;
  const raison = p ? { k: p.k, n: p.n24 || p.n72, h: p.n24 ? 24 : 72, pct: p.pctBaisse } : null;
  return { cle: ce.par.includes('note') ? (ce.par.includes('precieux') ? 'reduite_precieux' : 'reduite') : 'precieux', v: { cap: ce.actionsHeure, fav: ce.favorisHeure, note: sn.note }, raison };
}
// LE COMPTE PRÉCIEUX : ce qu'il bloque (et rien d'autre — ses clics un par un passent toujours).
const SN_PRECIEUX_BLOQUE = ['repub-serie', 'favoris-auto', 'offre-auto', 'agent', 'relance-auto', 'lot-auto', 'brouillon-auto'];
function snPrecieux(section) { return !!(section && typeof section === 'object' && section.actif === true); }
function snPrecieuxBloque(precieux, sorte) { return precieux === true && SN_PRECIEUX_BLOQUE.includes(String(sorte || '')); }
// </sante-note-regle>
export { SN_POIDS, SN_SORTES_CARNET, SN_FENETRES_H, SN_PALIERS, SN_MIN, SN_VUES, SN_PRECIEUX_BLOQUE, snPoidsAge, snVuesTendance, snNote, snCadence, snPhrase, snPrecieux, snPrecieuxBloque };
