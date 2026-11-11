// ── LES NOTES REÇUES, COMPTE PAR COMPTE (3 nov.) — LECTURE SEULE ───────────
// Julien : moyenne, nombre, dernières, celles sous 5 étoiles, par compte.
// AUCUN rappel (il a refusé « rappel des évaluations à laisser » le 11 oct.).
// Règle PURE : Statistiques et `scripts/audit-notes-recues.cjs` l'appellent.
//
// MESURÉ LE 3 NOV. (vraie base, lecture seule) : VRM capte le PROFIL Vinted
// de chaque compte (`harvest_{uid}_profile`, `data.payload.user`) qui porte
// `feedback_reputation` (0…1), `feedback_count`, `positive_feedback_count`,
// `neutral_feedback_count`, `negative_feedback_count` et `data.capturedAt`.
// ⚠️ `feedback_reputation` N'EST PAS une moyenne d'étoiles (mesuré : 0,98
//    pour 7 avis tous positifs) : c'est la note que Vinted AFFICHE — dite
//    « note Vinted », ×5, à une décimale, jamais présentée comme une moyenne
//    calculée par VRM.
// ⚠️ La LISTE des avis (dernières, sous 5 étoiles) n'est PAS captée : la seule
//    ligne `user_feedbacks` en base est un ENVOI (`wreq`, il a laissé un avis),
//    pas une lecture. Tant que l'extension ne lit pas
//    GET /api/v2/user_feedbacks?user_id={uid}&page=1&per_page=20&by=all
//    (rangé `harvest_{uid}_feedbacks`, `payload.user_feedbacks[]`), `liste`
//    vaut `null` ⇒ « pas encore lu » — jamais « aucun avis ».
//    La forme de cette réponse n'est PAS mesurée : `lireAvis` ne garde qu'une
//    note entière 1…5 et une date lisible, et ignore tout le reste.
export const PROFIL_VIEUX_J = 7;

const num = (v) => (v == null || v === '' ? null : (isFinite(Number(v)) ? Number(v) : null));

// Un avis lu. Rend null si illisible.
// (10 nov., lot BN) FORME MESURÉE (lecture seule, sa base, 3 comptes) : chaque avis rangé par
// l'extension 5.319 est { id (10 chiffres), rating (entier), feedback (texte) } — **AUCUNE
// date** (`created_at` n'est jamais là) ; `pagination` { total_entries, total_pages }. L'ordre
// de la page va du plus récent au plus ancien (mesuré : les id décroissent sur les 3 comptes).
// Avant, un avis sans date était ÉCARTÉ : 60 avis captés, zéro montré. Désormais : date lue ⇒
// `ts` ; sinon `ts: null` et l'écran ne dit aucune date (jamais inventée) ; `rang` garde
// l'ordre de la page.
export const lireAvis = (f, rang = 0) => {
  if (!f || typeof f !== 'object') return null;
  const note = num(f.rating);
  if (!(note >= 1 && note <= 5 && Number.isInteger(note))) return null;
  const t = num(f.created_at_ts) != null ? num(f.created_at_ts) * 1000 : Date.parse(f.created_at || '');
  return { note, ts: isFinite(t) ? t : null, rang, texte: typeof f.feedback === 'string' ? f.feedback.trim() : '', id: String(f.id ?? '') };
};
// Le plus récent d'abord : par date quand les deux en ont une, sinon l'ordre de la page.
const parRecence = (x, y) => (x.ts != null && y.ts != null && x.ts !== y.ts ? y.ts - x.ts : x.rang - y.rang);
const moyNotes = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x.note, 0) / xs.length * 10) / 10 : null);
// L'évolution d'un compte, sur les avis LUS seulement : les 10 plus récents contre les 10
// d'avant (au moins 5 de chaque côté, sinon rien — jamais une flèche sur deux avis).
export const MIN_EVOLUTION = 5;
export const evolutionAvis = (lus) => {
  if (!Array.isArray(lus)) return null;
  const a = lus.slice(0, 10), b = lus.slice(10, 20);
  if (a.length < MIN_EVOLUTION || b.length < MIN_EVOLUTION) return null;
  const r = moyNotes(a), v = moyNotes(b);
  return { recent: r, avant: v, nRecent: a.length, nAvant: b.length, sens: r > v ? 'hausse' : r < v ? 'baisse' : 'egal' };
};
// (11 nov., extension 5.340) L'HISTORIQUE DATÉ par capture (`payload.historique` :
// [{ at, total, n, c:[1★…5★] }], des nombres seulement, 90 jours). Le premier point des
// 90 jours contre le dernier : « +N avis » (si Vinted a dit les deux totaux) et la
// moyenne de la page lue à chaque fois. Moins de deux jours de lecture ⇒ null (« pas su »).
export const HISTO_AVIS_JOURS = 90;
const moyC = (c) => { const n = c.reduce((a, b) => a + b, 0); return n ? Math.round(c.reduce((a, x, i) => a + x * (i + 1), 0) / n * 10) / 10 : null; };
export const evolutionHistorique = (hist, maintenant = Date.now()) => {
  if (!Array.isArray(hist)) return null;
  const lim = maintenant - HISTO_AVIS_JOURS * 86400000;
  const pts = hist.map((p) => {
    const t = Date.parse((p && p.at) || '');
    const c = p && Array.isArray(p.c) && p.c.length === 5 && p.c.every((x) => Number.isInteger(x) && x >= 0) ? p.c : null;
    if (!Number.isFinite(t) || t < lim || t > maintenant + 60000 || !c) return null;
    return { t, total: Number.isInteger(p.total) && p.total >= 0 ? p.total : null, moy: moyC(c) };
  }).filter(Boolean).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1];
  if (new Date(a.t).toISOString().slice(0, 10) === new Date(b.t).toISOString().slice(0, 10)) return null;
  const nouveaux = a.total != null && b.total != null && b.total >= a.total ? b.total - a.total : null;
  return { depuis: a.t, jusqua: b.t, points: pts.length, nouveaux, moyAvant: a.moy, moyApres: b.moy };
};
// Un texte d'avis COURT pour l'écran (jamais le pseudo : l'extension ne le range pas).
export const texteCourtAvis = (t, max = 90) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s; };

// profils : `undefined` en cours · `null` lecture ratée · tableau
//   [{ uid, login, at, rep, n, pos, neu, neg, avis? }] (avis : tableau brut ou absent).
// comptes : [{ uid, nom }] (les comptes sélectionnés — un exclu n'y est pas).
export const notesParCompte = ({ profils, comptes = [], maintenant = Date.now(), nDernieres = 5 } = {}) => {
  if (profils === undefined) return { etat: 'encours' };
  if (!Array.isArray(profils)) return { etat: 'passu' };
  const parUid = {};
  for (const p of profils) {
    if (!p) continue;
    const uid = String(p.uid ?? '');
    if (!uid) continue;
    const at = Date.parse(p.at || '');
    // Deux lignes du même compte : la plus fraîche gagne.
    if (parUid[uid] && !(isFinite(at) && at > parUid[uid].atMs)) continue;
    parUid[uid] = { ...p, atMs: isFinite(at) ? at : -Infinity };
  }
  const liste = comptes.map((c) => {
    const uid = String(c.uid ?? '');
    const p = parUid[uid];
    const rep = p ? num(p.rep) : null, n = p ? num(p.n) : null;
    if (!p || (rep == null && n == null)) return { uid, nom: c.nom || (p && p.login) || uid, etat: 'pasLu', note: null, n: null, pos: null, neu: null, neg: null, at: null, vieux: false, liste: null };
    const brut = Array.isArray(p.avis) ? p.avis : null;
    const lus = brut ? brut.map((f, i) => lireAvis(f, i)).filter(Boolean).sort(parRecence) : null;
    const totalVinted = p.pag && num(p.pag.total_entries) != null ? num(p.pag.total_entries) : null;
    return {
      uid, nom: c.nom || p.login || uid, etat: 'lu',
      note: rep != null && n > 0 ? Math.round(rep * 50) / 10 : null,        // la note affichée par Vinted, sur 5
      n: n ?? 0, pos: num(p.pos), neu: num(p.neu), neg: num(p.neg),
      at: isFinite(p.atMs) ? p.atMs : null,
      vieux: !(isFinite(p.atMs) && maintenant - p.atMs <= PROFIL_VIEUX_J * 86400000),
      liste: lus ? { dernieres: lus.slice(0, nDernieres), sousCinq: lus.filter((x) => x.note < 5), lus: lus.length, moyenneLus: moyNotes(lus), evolution: evolutionAvis(lus), total: totalVinted, historique: evolutionHistorique(p.hist, maintenant) } : null,
    };
  });
  const lus = liste.filter((x) => x.etat === 'lu');
  const total = lus.reduce((s, x) => s + (x.n || 0), 0);
  // Moyenne des notes Vinted, PONDÉRÉE par le nombre d'avis de chaque compte.
  const avecNote = lus.filter((x) => x.note != null && x.n > 0);
  const moyenne = avecNote.length ? Math.round(avecNote.reduce((s, x) => s + x.note * x.n, 0) / avecNote.reduce((s, x) => s + x.n, 0) * 10) / 10 : null;
  const negatifs = lus.every((x) => x.neg != null) ? lus.reduce((s, x) => s + x.neg, 0) : null;
  return {
    etat: lus.length ? 'lu' : 'pasLu', comptes: liste, total, moyenne, negatifs,
    partiel: lus.length > 0 && lus.length < liste.length,
    manquants: liste.filter((x) => x.etat !== 'lu').map((x) => x.nom),
    listeLue: liste.some((x) => x.liste),
  };
};
