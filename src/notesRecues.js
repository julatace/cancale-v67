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

// Un avis lu (forme non mesurée : défensive). Rend null si illisible.
export const lireAvis = (f) => {
  if (!f || typeof f !== 'object') return null;
  const note = num(f.rating);
  if (!(note >= 1 && note <= 5 && Number.isInteger(note))) return null;
  const ts = num(f.created_at_ts) != null ? num(f.created_at_ts) * 1000 : Date.parse(f.created_at || '');
  if (!isFinite(ts)) return null;
  return { note, ts, texte: typeof f.feedback === 'string' ? f.feedback : '', id: String(f.id ?? '') };
};

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
    const lus = brut ? brut.map(lireAvis).filter(Boolean).sort((x, y) => y.ts - x.ts) : null;
    return {
      uid, nom: c.nom || p.login || uid, etat: 'lu',
      note: rep != null && n > 0 ? Math.round(rep * 50) / 10 : null,        // la note affichée par Vinted, sur 5
      n: n ?? 0, pos: num(p.pos), neu: num(p.neu), neg: num(p.neg),
      at: isFinite(p.atMs) ? p.atMs : null,
      vieux: !(isFinite(p.atMs) && maintenant - p.atMs <= PROFIL_VIEUX_J * 86400000),
      liste: lus ? { dernieres: lus.slice(0, nDernieres), sousCinq: lus.filter((x) => x.note < 5), lus: lus.length } : null,
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
