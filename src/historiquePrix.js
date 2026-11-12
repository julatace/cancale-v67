import { jourParis } from './dateParis.js';
// ── L'HISTORIQUE DE PRIX D'UNE ANNONCE (10 nov. 2026, lot L — validé par Julien) ──
// Sur la fiche d'une paire : les prix successifs de SES annonces Vinted, avec leurs
// dates. SEULEMENT CE QUI A ÉTÉ LU (§5, « mieux vaut un blanc qu'un faux ») :
//   · « lu » : le prix d'une annonce dans une lecture du dressing (la capture de
//     l'extension), daté par la date de CETTE lecture (`listings.lues[uid]`, la
//     même que « lu il y a … ») — jamais l'heure à laquelle l'app l'a regardé ;
//   · « VRM » : un prix changé depuis VRM et RELU par l'extension (Republier, baisse
//     en série du lot C : `vinted_prix_historique`, { item, avant, apres, at }).
// Une annonce se désigne par SON identifiant (§5) ; jamais par titre.
//
// Le journal des prix lus (`vrm_prix_lus`, synchronisé sur la ligne `main`) :
//   { v: 1, debut: 'AAAA-MM-JJ', a: { [item_id]: [[ms, centimes], …] } }
// Une ligne n'est AJOUTÉE que si le prix a changé depuis la dernière lue, ou si
// l'annonce est vue pour la première fois. Il commence le jour de ce lot : avant,
// rien n'est connu et c'est DIT (« prix lus depuis le … »).
// Une lecture plus ancienne que la dernière notée n'écrit rien (une capture en
// retard ne réécrit pas l'histoire). Une annonce garde au plus `MAX_POINTS` prix
// (le premier lu et les plus récents) ; le journal au plus `MAX_ANNONCES` annonces
// (les moins récemment changées partent d'abord).
//
// Module PUR : App.jsx (écriture au chargement des annonces, lecture de la fiche),
// src/histoireArticle.js et scripts/audit-calculette-emballages.cjs exécutent les
// MÊMES fonctions.

export const CLE_PRIX_LUS = 'vrm_prix_lus';
export const MAX_POINTS = 24;
export const MAX_ANNONCES = 4000;

const str = (v) => String(v == null ? '' : v).trim();
const jour = (ms) => jourParis(ms);   // (11 nov.) jour de PARIS

// Le prix d'une annonce lue, en centimes — ou null (pas su : rien noté).
// La forme Vinted : un objet { amount, currency_code } ; une ancienne capture : un nombre ou une chaîne.
export function centimesPrixAnnonce(it) {
  if (!it) return null;
  const p = it.price;
  let brut = p, devise = '';
  if (p && typeof p === 'object') { brut = p.amount; devise = str(p.currency_code || p.currency); }
  if (devise && devise.toUpperCase() !== 'EUR') return null;
  const s = str(brut).replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(Number(s) * 100);
  return c > 0 ? c : null;
}

const journalLisible = (j) => !!j && typeof j === 'object' && j.v === 1 && j.a && typeof j.a === 'object' && !Array.isArray(j.a);

// Ajoute au journal ce que la lecture des annonces apprend. `items` : les annonces
// lues (avec `_acc.vinted_user_id`) ; `lues` : { [uid]: ms } la date de la lecture
// de CHAQUE compte. Un compte sans date de lecture n'écrit rien (pas daté = pas su).
// Rend { journal, ajoutes } — le même objet si rien n'a changé.
export function noterPrixLus(journal, items, lues, { maintenant = Date.now() } = {}) {
  const base = journalLisible(journal) ? journal : { v: 1, debut: jour(maintenant), a: {} };
  const a = { ...base.a };
  let ajoutes = 0;
  for (const it of (Array.isArray(items) ? items : [])) {
    if (!it || it.id == null) continue;
    const id = str(it.id); if (!id) continue;
    const uid = str(it._acc && it._acc.vinted_user_id);
    const ts = uid && lues ? Number(lues[uid]) : NaN;
    if (!Number.isFinite(ts) || ts <= 0 || ts > maintenant + 60000) continue;
    const c = centimesPrixAnnonce(it);
    if (c == null) continue;
    const L = Array.isArray(a[id]) ? a[id] : [];
    const der = L[L.length - 1];
    if (der && (ts <= der[0] || der[1] === c)) continue;   // plus ancienne, ou prix inchangé
    let n = [...L, [Math.round(ts), c]];
    if (n.length > MAX_POINTS) n = [n[0], ...n.slice(n.length - (MAX_POINTS - 1))];
    a[id] = n; ajoutes += 1;
  }
  if (!ajoutes) return { journal: base === journal ? journal : base, ajoutes: 0 };
  let ids = Object.keys(a);
  if (ids.length > MAX_ANNONCES) {
    ids.sort((x, y) => (a[y][a[y].length - 1][0]) - (a[x][a[x].length - 1][0]));
    for (const k of ids.slice(MAX_ANNONCES)) delete a[k];
  }
  return { journal: { v: 1, debut: base.debut || jour(maintenant), a }, ajoutes };
}

// La série des prix de CES annonces (ids : les annonces de la paire, par identité),
// du plus ancien au plus récent. Chaque point : { at (ISO), prix (centimes), source:
// 'lu' | 'vrm', item }. Deux points de suite au même prix n'en font qu'un (le premier
// garde sa date). `null` = journal des prix lus pas lisible (pas su).
export function seriePrix(ids, { lus, prixVinted } = {}) {
  const set = new Set((ids || []).map(str).filter(Boolean));
  const pts = [];
  if (journalLisible(lus)) {
    for (const id of set) for (const p of (Array.isArray(lus.a[id]) ? lus.a[id] : [])) {
      if (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[1] > 0) pts.push({ t: p[0], prix: p[1], source: 'lu', item: id });
    }
  }
  for (const x of (Array.isArray(prixVinted) ? prixVinted : [])) {
    if (!x || !set.has(str(x.item))) continue;
    const t = Date.parse(x.at || ''); const c = Math.round(Number(x.apres) * 100);
    if (Number.isFinite(t) && Number.isFinite(c) && c > 0) pts.push({ t, prix: c, source: 'vrm', item: str(x.item) });
  }
  // Même instant : le prix changé depuis VRM d'abord (c'est lui qui explique la lecture qui suit).
  pts.sort((x, y) => x.t - y.t || (x.source === y.source ? 0 : x.source === 'vrm' ? -1 : 1));
  const out = [];
  for (const p of pts) {
    const der = out[out.length - 1];
    if (der && der.prix === p.prix) continue;
    out.push({ at: new Date(p.t).toISOString(), prix: p.prix, source: p.source, item: p.item });
  }
  return { points: out, depuis: journalLisible(lus) ? (lus.debut || null) : null, lisible: journalLisible(lus) };
}

// Ce que l'écran écrit d'un prix (centimes) : « 120 € », « 89,50 € ».
export const eurosPrix = (c) => {
  if (c == null || !Number.isFinite(c)) return '—';
  const e = c / 100;
  return (Number.isInteger(e) ? String(e) : e.toFixed(2).replace('.', ',')) + ' €';
};

// La forme du petit graphique en escalier : x de 0 à 1 (le temps), y de 0 à 1 (le prix,
// 1 = le plus haut). Le dernier palier va jusqu'à `maintenant`. null sous deux points.
export function escalierPrix(points, { maintenant = Date.now() } = {}) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const ts = points.map((p) => Date.parse(p.at));
  const t0 = ts[0], t1 = Math.max(ts[ts.length - 1], maintenant);
  const ps = points.map((p) => p.prix);
  const hi = Math.max(...ps), lo = Math.min(...ps);
  const X = (t) => (t1 > t0 ? (t - t0) / (t1 - t0) : 0);
  const Y = (c) => (hi > lo ? (c - lo) / (hi - lo) : 0.5);
  const marches = points.map((p, i) => ({ x0: X(ts[i]), x1: i < points.length - 1 ? X(ts[i + 1]) : 1, y: Y(p.prix), prix: p.prix, source: p.source }));
  return { marches, hi, lo };
}
