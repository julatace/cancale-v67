// ═══════════════════════════════════════════════════════════════════════════
// LA DISCRÉTION — LES RÈGLES DE L'APP (12 nov., ext. 5.370 — validée par Julien)
// ═══════════════════════════════════════════════════════════════════════════
// L'extension tient la porte des gestes automatiques (vinted-sync-extension/
// background.js, « LA DISCRÉTION ») : plafond du jour, rythme, attente après
// l'ouverture, un compte à la fois, séries décalées entre comptes, montée d'un
// compte neuf, arrêt net sur une vérification (captcha). Ici, ce que l'APP
// décide et montre — pur, aucune lecture ni écriture :
//   · le réglage du plafond par jour (`vinted_discretion.parJour`, 200 par défaut) ;
//   · la vérification en cours d'un compte (et SA reprise : `reprises[uid]`) ;
//   · le carnet des 7 jours (refus 403/429, pauses, vérifications, prudences) ;
//   · Republier par petits groupes (3 à 6, pause de 15 à 45 min entre deux) ;
//   · les baisses de prix variées (± 20 % de SON choix, arrondies à l'euro, jamais
//     sous le plancher) et étalées dans la journée.
// REFUSÉ par Julien : aucun blocage la nuit ; aucun étalement des messages aux favoris.
// Exécuté par scripts/audit-discretion.cjs.
// ═══════════════════════════════════════════════════════════════════════════

export const CLE_DISCRETION = 'vinted_discretion';
export const PAR_JOUR_DEFAUT = 200;
export const PAR_JOUR_MIN = 20;
export const PAR_JOUR_MAX = 1000;
const J = 86400000;

// Le réglage lu (ou le défaut) : { parJour, reprises }.
export function reglageDiscretion(v) {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const pj = Math.round(Number(o.parJour));
  const reprises = {};
  if (o.reprises && typeof o.reprises === 'object') for (const k of Object.keys(o.reprises)) { const t = Number(o.reprises[k]); if (/^\d{1,20}$/.test(k) && Number.isFinite(t) && t > 0) reprises[k] = t; }
  return { parJour: Number.isFinite(pj) && pj >= PAR_JOUR_MIN && pj <= PAR_JOUR_MAX ? pj : PAR_JOUR_DEFAUT, reprises };
}
// Ce qu'il tape dans le champ : un entier entre 20 et 1000, sinon une phrase.
export function parJourTape(texte) {
  const s = String(texte == null ? '' : texte).trim();
  if (!/^\d{1,4}$/.test(s)) return { ok: false, erreur: 'Un nombre entier.' };
  const n = Number(s);
  if (n < PAR_JOUR_MIN) return { ok: false, erreur: `Au moins ${PAR_JOUR_MIN}.` };
  if (n > PAR_JOUR_MAX) return { ok: false, erreur: `Au plus ${PAR_JOUR_MAX}.` };
  return { ok: true, valeur: n };
}

// La vérification demandée par Vinted est-elle EN COURS ? (captcha posé après sa dernière reprise)
export function verificationEnCours(captcha, reprise) {
  const c = Number(captcha), r = Number(reprise);
  if (!(Number.isFinite(c) && c > 0)) return false;
  return !(Number.isFinite(r) && r > c);
}
// Sa reprise : le réglage avec l'heure de ce clic pour ce compte (rien d'autre ne change).
export function avecReprise(v, uid, maintenant = Date.now()) {
  const r = reglageDiscretion(v);
  const brut = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  return { ...brut, parJour: r.parJour, reprises: { ...r.reprises, [String(uid)]: maintenant } };
}

// ── LE CARNET DES 7 JOURS (point 14) ─────────────────────────────────────────
// `rows` : les lignes `actions_compte_{uid}_*` (projection `ev`). Chaque Chrome publie
// SES événements ; on les réunit (un même événement à moins d'une minute d'écart d'un
// Chrome à l'autre compte une fois). Aucune ligne ⇒ null (« pas su »), jamais « 0 ».
export const SORTES_CARNET = ['403', '429', 'pause', 'captcha', 'prudence'];
const ligneDuCompte = (uid, id) => new RegExp(`^actions_compte_${uid}_[0-9a-f]{16}$`).test(String(id || ''));
export function carnetDuCompte(rows, uid, maintenant = Date.now()) {
  if (!Array.isArray(rows) || !/^\d{1,20}$/.test(String(uid || ''))) return null;
  const miennes = rows.filter((r) => r && ligneDuCompte(String(uid), r.id));
  if (!miennes.length) return null;
  if (!miennes.some((r) => Array.isArray(r.ev))) return null;   // extension d'avant la 5.370 : pas su
  const tous = [];
  for (const r of miennes) for (const e of (Array.isArray(r.ev) ? r.ev : [])) {
    const t = Number(e && e.t);
    if (!e || !SORTES_CARNET.includes(e.s) || !Number.isFinite(t) || maintenant - t > 7 * J || t > maintenant + 60000) continue;
    tous.push({ t, s: e.s });
  }
  tous.sort((a, b) => a.t - b.t);
  const uniques = [];
  for (const e of tous) if (!uniques.some((u) => u.s === e.s && Math.abs(u.t - e.t) < 60000)) uniques.push(e);
  const compte = (s) => uniques.filter((e) => e.s === s).length;
  return {
    n403: compte('403'), n429: compte('429'), pauses: compte('pause'), captchas: compte('captcha'), prudences: compte('prudence'),
    total: uniques.length, dernier: uniques.length ? uniques[uniques.length - 1].t : null, liste: uniques.slice(-20).reverse(),
  };
}

// ── REPUBLIER PAR PETITS GROUPES (point 11) ─────────────────────────────────
// `ids` : l'ordre de passage ; `espace()` → secondes entre deux paires d'un même groupe
// (SON réglage) ; `hasard()` → [0,1[. Rend { plan: {id: secondes avant}, groupes: [[id…]],
// pauses: {id: secondes} } — la première paire part tout de suite ; la première de chaque
// groupe suivant attend une PAUSE de 15 à 45 min (au lieu de l'espacement).
export const GROUPE_MIN = 3, GROUPE_MAX = 6;
export const PAUSE_GROUPE_MIN_S = 15 * 60, PAUSE_GROUPE_MAX_S = 45 * 60;
export function planParGroupes(ids, { espace = () => 0, hasard = Math.random, groupes = true } = {}) {
  const L = (Array.isArray(ids) ? ids : []).map(String);
  const entre = (a, b) => a + Math.floor(hasard() * (b - a + 1));
  const plan = {}, pauses = {}, gs = [];
  if (!groupes || L.length <= GROUPE_MAX) {
    L.forEach((id, i) => { plan[id] = i === 0 ? 0 : Math.max(0, Math.round(espace())); });
    return { plan, groupes: L.length ? [L.slice()] : [], pauses };
  }
  let i = 0;
  while (i < L.length) {
    const reste = L.length - i;
    let taille = entre(GROUPE_MIN, GROUPE_MAX);
    // Jamais un dernier groupe de 1 ou 2 : il est rattaché (ou la taille ajustée).
    if (reste - taille > 0 && reste - taille < GROUPE_MIN) taille = reste - GROUPE_MIN >= GROUPE_MIN ? reste - GROUPE_MIN : Math.min(reste, GROUPE_MAX);
    if (taille > reste) taille = reste;
    gs.push(L.slice(i, i + taille));
    i += taille;
  }
  gs.forEach((g, k) => g.forEach((id, j) => {
    if (k === 0 && j === 0) plan[id] = 0;
    else if (j === 0) { const p = entre(PAUSE_GROUPE_MIN_S, PAUSE_GROUPE_MAX_S); pauses[id] = p; plan[id] = p; }
    else plan[id] = Math.max(0, Math.round(espace()));
  }));
  return { plan, groupes: gs, pauses };
}

// ── LES BAISSES VARIÉES ET ÉTALÉES (point 12) ───────────────────────────────
// SON choix (−10 % ou −5 €) varie de ± 20 % par annonce (−8 à −12 %, −4 à −6 €). Le
// facteur est tiré une fois par annonce et MONTRÉ dans l'aperçu ; l'arrondi à l'euro et
// le plancher restent ceux de src/baissePrix.js.
export const VARIATION = 0.2;
export function facteursBaisse(ids, hasard = Math.random) {
  const o = {};
  for (const id of Array.isArray(ids) ? ids : []) o[String(id)] = Math.round((1 - VARIATION + hasard() * 2 * VARIATION) * 100) / 100;
  return o;
}
// Les heures des baisses, étalées sur `heures` heures à partir de `debut` : une par tranche,
// au hasard dans sa tranche, au moins 5 min d'écart. Jamais toutes à la même minute.
export const ETALEMENT_H = 6;
export function heuresEtalees(n, { debut = Date.now(), heures = ETALEMENT_H, hasard = Math.random } = {}) {
  const k = Math.max(0, Math.floor(Number(n) || 0));
  if (!k) return [];
  const span = Math.max(1, heures) * 3600000;
  const tranche = span / k;
  const out = [];
  let prec = -Infinity;
  for (let i = 0; i < k; i++) {
    let t = Math.round(debut + 2 * 60000 + i * tranche + hasard() * Math.max(0, tranche - 5 * 60000));
    if (t - prec < 5 * 60000) t = prec + 5 * 60000;
    out.push(t); prec = t;
  }
  return out;
}
