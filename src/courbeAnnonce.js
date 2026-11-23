// ═══════════════════════════════════════════════════════════════════════════
// LA COURBE DE CHAQUE ANNONCE — LA RÈGLE (21 nov., ext. 5.428, choix 58 de Julien)
// ═══════════════════════════════════════════════════════════════════════════
// « À chaque lecture du dressing, garder un point par annonce et par jour (vues, favoris, prix) ; dans la fiche, une
// petite courbe vues/favoris jour après jour avec les repères des événements (prix changé, republiée, masquée, offre
// envoyée aux favoris) tirés du journal ; « — » les jours non lus (jamais interpolés comme mesures). »
//
// · UN POINT = ce que Vinted a ÉCRIT dans une lecture du dressing de SON compte (`view_count`, `favourite_count`,
//   `price`) : [jour, vues, favoris, prix en centimes, minute du jour]. Un champ absent reste `null` (jamais 0).
//   Une annonce d'un AUTRE membre (`user_id` ≠ le compte) n'entre jamais. Un jour lu deux fois garde la lecture la
//   plus TARDIVE de ce jour (la minute).
// · 120 jours au plus, 500 annonces au plus par compte (celles lues le plus récemment).
// · LES REPÈRES viennent du journal des gestes de VRM (`journal_vrm_*` : baisse_prix → p, republiee/modifiee → r
//   sur l'ancienne ET la nouvelle, masquee → m, favori → f), plus « prix changé » MESURÉ quand deux lectures de
//   suite portent deux prix différents (q) — jamais deviné entre deux jours non lus.
// · LA SÉRIE (`serieCourbe`) : un jour par jour de la fenêtre ; un jour sans lecture est `lu: false` et ses valeurs
//   `null` — l'écran le dit « — » et ne trace AUCUN trait à travers (jamais une interpolation).
//
// Ligne : `courbes_annonces_{uid}_{nav}` = { uid, nav, v, majAt, a: { [id]: [[j, v, f, c, m]] }, ev: { [id]: [[j, code]] } }
// (un seul écrivain : l'extension de ce navigateur). L'app lit UNE annonce par projection
// (`p:data->a->"ID",e:data->ev->"ID"`), jamais la ligne entière.
// Le bloc entre les balises est RECOPIÉ dans l'extension (`node scripts/audit-ext-5428.cjs --recopie`).
// ═══════════════════════════════════════════════════════════════════════════

// <courbe-regle>
const COURBE_LIGNE = 'courbes_annonces_';
const COURBE_JOURS = 120;
const COURBE_MAX_ANNONCES = 500;
const RE_ID_COURBE = /^\d{4,15}$/;
const CODES_REPERE = ['p', 'q', 'r', 'm', 'f'];
// Le jour LOCAL (celui de son navigateur) d'un instant, en jours depuis 1970.
function jourCourbe(t) { const d = new Date(Number(t)); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5); }
function minuteCourbe(t) { const d = new Date(Number(t)); return d.getHours() * 60 + d.getMinutes(); }
function entierCourbe(v) { if (v == null || v === '' || typeof v === 'boolean') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 && n < 1e9 ? Math.round(n) : null; }
function centimesCourbe(p) {
  const v = p && typeof p === 'object' ? p.amount : p;
  if (v == null || v === '' || typeof v === 'boolean') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) : null;
}
// Le point d'UNE annonce lue à l'instant `t` — `null` si rien n'est lisible ou si l'annonce n'est pas au compte `uid`.
function pointCourbe(it, t, uid) {
  if (!it || typeof it !== 'object' || it.id == null || !RE_ID_COURBE.test(String(it.id))) return null;
  const proprio = it.user_id != null ? it.user_id : (it.user && typeof it.user === 'object' ? it.user.id : null);
  if (uid != null && proprio != null && String(proprio) !== String(uid)) return null;
  const v = entierCourbe(it.view_count);
  const f = entierCourbe(it.favourite_count != null ? it.favourite_count : it.favourites_count);
  const c = centimesCourbe(it.price);
  if (v === null && f === null && c === null) return null;
  return { id: String(it.id), p: [jourCourbe(t), v, f, c, minuteCourbe(t)] };
}
function pointValide(x) { return Array.isArray(x) && x.length === 5 && Number.isInteger(x[0]) && x[0] > 0 && [1, 2, 3].every((i) => x[i] === null || (Number.isInteger(x[i]) && x[i] >= 0)) && Number.isInteger(x[4]) && x[4] >= 0 && x[4] < 1440; }
// Range les points d'une lecture dans `memo` ({ [id]: [[j,v,f,c,m]] }) — rend { memo, change }.
function ajouterPointsCourbe(memo, items, t, uid) {
  const out = {}; let change = false;
  for (const [id, l] of Object.entries(memo && typeof memo === 'object' ? memo : {})) {
    if (!RE_ID_COURBE.test(id) || !Array.isArray(l)) { change = true; continue; }
    const ok = l.filter(pointValide);
    if (ok.length !== l.length) change = true;
    if (ok.length) out[id] = ok;
  }
  for (const it of Array.isArray(items) ? items : []) {
    const pt = pointCourbe(it, t, uid);
    if (!pt) continue;
    const l = out[pt.id] || (out[pt.id] = []);
    const i = l.findIndex((x) => x[0] === pt.p[0]);
    if (i < 0) { l.push(pt.p); change = true; }
    else if (pt.p[4] >= l[i][4] && JSON.stringify(l[i]) !== JSON.stringify(pt.p)) { l[i] = pt.p; change = true; }
  }
  const lim = jourCourbe(t) - COURBE_JOURS + 1;
  for (const id of Object.keys(out)) {
    const l = out[id].filter((x) => x[0] >= lim).sort((p, q) => p[0] - q[0]);
    if (l.length !== out[id].length) change = true;
    if (l.length) out[id] = l; else delete out[id];
  }
  const ids = Object.keys(out);
  if (ids.length > COURBE_MAX_ANNONCES) {
    ids.sort((a, b) => out[b][out[b].length - 1][0] - out[a][out[a].length - 1][0]);
    for (const id of ids.slice(COURBE_MAX_ANNONCES)) delete out[id];
    change = true;
  }
  return { memo: out, change };
}
// Les repères tirés du journal des gestes ([{ t, s, a, b }]) : { [id]: [[j, code]] }.
function reperesJournalCourbe(journal, t) {
  const out = {};
  const lim = jourCourbe(t) - COURBE_JOURS + 1;
  const poser = (id, j, c) => { const k = String(id || ''); if (!RE_ID_COURBE.test(k) || j < lim) return; const l = out[k] || (out[k] = []); if (!l.some((x) => x[0] === j && x[1] === c)) l.push([j, c]); };
  for (const e of Array.isArray(journal) ? journal : []) {
    if (!e || !Number.isFinite(Number(e.t))) continue;
    const j = jourCourbe(Number(e.t));
    if (e.s === 'baisse_prix') poser(e.a, j, 'p');
    else if (e.s === 'republiee' || e.s === 'modifiee') { poser(e.a, j, 'r'); if (e.b) poser(e.b, j, 'r'); }
    else if (e.s === 'masquee') poser(e.a, j, 'm');
    else if (e.s === 'favori') poser(e.a, j, 'f');
  }
  for (const k of Object.keys(out)) out[k].sort((p, q) => p[0] - q[0] || (p[1] < q[1] ? -1 : 1));
  return out;
}
// LA SÉRIE d'une annonce sur `jours` jours (jusqu'à aujourd'hui), depuis les lignes de un ou plusieurs navigateurs
// (`sources` : [{ p: points, e: repères }]). Rend { jours: [{ j, lu, vues, fav, prix }], reperes: [{ j, code }], lus }.
function serieCourbe(sources, { maintenant = Date.now(), jours = 30 } = {}) {
  const parJour = new Map();
  const reps = new Map();
  for (const s of Array.isArray(sources) ? sources : []) {
    for (const x of Array.isArray(s && s.p) ? s.p : []) {
      if (!pointValide(x)) continue;
      const cur = parJour.get(x[0]);
      if (!cur || x[4] > cur[4]) parJour.set(x[0], x);
    }
    for (const r of Array.isArray(s && s.e) ? s.e : []) {
      if (!Array.isArray(r) || !Number.isInteger(r[0]) || !CODES_REPERE.includes(r[1])) continue;
      reps.set(r[0] + ':' + r[1], { j: r[0], code: r[1] });
    }
  }
  const fin = jourCourbe(maintenant);
  const n = Math.max(1, Math.min(COURBE_JOURS, Math.round(Number(jours) || 30)));
  const debut = fin - n + 1;
  const out = [];
  let lus = 0, precedent = null;
  // Le prix MESURÉ qui change entre deux lectures de suite (même avant la fenêtre : la dernière lecture d'avant compte).
  const tous = [...parJour.keys()].sort((a, b) => a - b);
  for (const j of tous) {
    const x = parJour.get(j);
    if (x[3] !== null) { if (precedent !== null && precedent !== x[3] && j >= debut) reps.set(j + ':q', { j, code: 'q' }); precedent = x[3]; }
  }
  for (let j = debut; j <= fin; j++) {
    const x = parJour.get(j);
    if (x) { lus++; out.push({ j, lu: true, vues: x[1], fav: x[2], prix: x[3] }); }
    else out.push({ j, lu: false, vues: null, fav: null, prix: null });
  }
  const reperes = [...reps.values()].filter((r) => r.j >= debut && r.j <= fin)
    // un prix changé PAR VRM le même jour n'est pas redit « mesuré »
    .filter((r) => !(r.code === 'q' && reps.has(r.j + ':p')))
    .sort((a, b) => a.j - b.j || (a.code < b.code ? -1 : 1));
  return { jours: out, reperes, lus, debut, fin };
}
// </courbe-regle>

// ── CE QUI SUIT N'EST PAS DANS L'EXTENSION (l'app) ──────────────────────────
export const LIGNE_COURBES = COURBE_LIGNE;
// La projection d'UNE annonce (jamais la ligne entière : 500 annonces × 120 jours).
export function selectCourbe(id) { const k = String(id || ''); return RE_ID_COURBE.test(k) ? `id,p:data->a->%22${k}%22,e:data->ev->%22${k}%22` : null; }
// Le jour (index) ⇒ une date (minuit local de ce jour).
export function dateDuJour(j) { const t = Number(j) * 864e5; const d = new Date(t); return new Date(t + d.getTimezoneOffset() * 60000); }

export {
  COURBE_JOURS, COURBE_MAX_ANNONCES, CODES_REPERE, jourCourbe, pointCourbe, ajouterPointsCourbe, reperesJournalCourbe, serieCourbe,
};
