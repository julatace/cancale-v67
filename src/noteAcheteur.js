// ══════════════════════════════════════════════════════════════════════════════
//  LA NOTE DES ACHETEURS (21 nov. 2026, ext. 5.430.0, `noteacheteur`)
//  docs/passation/2026-11-21-ext-5430.md
// ══════════════════════════════════════════════════════════════════════════════
// Julien (21 nov., choix n° 75) : sur chaque offre et chaque conversation, la note et le nombre d'évaluations de
// l'acheteur (« ★ 4,9 · 132 évaluations », « Compte neuf · 0 évaluation » en ambre, « ★ 1,0 · 3 évaluations » en ambre).
// SA décision, mot pour mot : « tu n'acceptes pas les comptes 1 étoile » :
//   · l'acceptation automatique (`autoAccepterOffres`), l'Agent VRM et la relance automatique N'ACCEPTENT JAMAIS une
//     offre d'un acheteur dont la note moyenne est ≤ SON seuil (1,5 ★ par défaut), ni ne lui font de contre-offre
//     automatique : la conversation passe « à toi », avec la raison ;
//   · note PAS LUE ⇒ pas d'acceptation automatique non plus (« pas su » ≠ « oui ») : l'offre attend, la lecture est
//     retentée au passage suivant ;
//   · compte SANS évaluation : réglage « accepter quand même » (défaut : oui, mais signalé en ambre) ;
//   · son acceptation À LA MAIN reste possible, après un avertissement.
// La note vient de Vinted : `feedback_reputation` (0 à 1, × 5 = étoiles) et le nombre d'évaluations (`review_count`
// dans une conversation, `feedback_count` sur un profil). MESURÉ sur la vraie base (21 nov., 944 conversations
// rangées) : les deux champs sont des nombres ; un compte à 0 évaluation porte `feedback_reputation: 0` — ce n'est
// PAS « 0 étoile » mais « compte neuf » (96 cas sur 944). Rien n'est deviné : un champ absent ou hors bornes ⇒ null.
// Le bloc <note-acheteur-regle> est recopié TEL QUEL dans vinted-sync-extension/background.js
// (node scripts/audit-note-acheteur.cjs --recopie) ; l'audit exécute la copie livrée.
// <note-acheteur-regle> — la RÈGLE, recopiée telle quelle dans background.js (node scripts/audit-note-acheteur.cjs --recopie).
const NA_SEUIL_DEFAUT = 1.5;
const NA_SEUIL_BORNES = [0.5, 4.5];
const NA_MEMO_MS = 7 * 86400000;          // une note lue vaut 7 jours
const NA_REESSAI_MS = 15 * 60000;         // une lecture ratée est retentée après 15 min (jamais en rafale)
// SON réglage (`vinted_bleam.comptes[uid].noteAcheteurs`) : rien à allumer (la protection est toujours là) ;
// `seuil` (étoiles, pas de 0,1, 0,5 à 4,5), `neufAccepter` (compte sans évaluation : accepter quand même, signalé).
function naReglage(o) {
  const v = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const s = Number(v.seuil);
  const seuil = Number.isFinite(s) && s >= NA_SEUIL_BORNES[0] && s <= NA_SEUIL_BORNES[1] ? Math.round(s * 10) / 10 : NA_SEUIL_DEFAUT;
  return { actif: false, seuil, neufAccepter: v.neufAccepter !== false };
}
// La note d'un acheteur depuis ce que Vinted renvoie (conversation ou profil) : { etoiles (1 décimale) | null, n }.
// `n === 0` ⇒ compte neuf (etoiles null). Champ absent, pas un nombre, hors bornes ⇒ null (pas su).
function naNote(u) {
  if (!u || typeof u !== 'object') return null;
  const brutN = u.review_count != null ? u.review_count : u.feedback_count != null ? u.feedback_count : u.n;
  const brutR = u.feedback_reputation != null ? u.feedback_reputation : u.rep;
  if (brutN == null || brutN === '' || typeof brutN === 'boolean') return null;
  const n = Number(brutN);
  if (!Number.isInteger(n) || n < 0 || n > 10000000) return null;
  if (n === 0) return { etoiles: null, n: 0 };
  if (brutR == null || brutR === '' || typeof brutR === 'boolean') return null;
  const r = Number(brutR);
  if (!Number.isFinite(r) || r < 0 || r > 1) return null;
  return { etoiles: Math.round(r * 50) / 10, n };
}
// La DÉCISION pour un geste automatique : 'ok' · 'neuf' (sans évaluation, permis mais signalé) · 'basse' (≤ seuil)
// · 'neuf-refuse' (sans évaluation, il a choisi de ne pas accepter) · 'pas-su' (note pas lue).
function naDecision(note, reglage) {
  const R = naReglage(reglage);
  if (!note || typeof note !== 'object' || !Number.isInteger(note.n) || note.n < 0) return 'pas-su';
  if (note.n === 0) return R.neufAccepter ? 'neuf' : 'neuf-refuse';
  const e = Number(note.etoiles);
  if (!Number.isFinite(e)) return 'pas-su';
  return e <= R.seuil + 1e-9 ? 'basse' : 'ok';
}
// Un geste automatique qui ENGAGE (accepter, contre-offre, relance) est-il permis ? Seulement 'ok' et 'neuf'.
const naPermetAuto = (decision) => decision === 'ok' || decision === 'neuf';
// Ce que l'étiquette dit (le texte est posé par l'écran, dans SA langue) : { k: 'note'|'neuf'|'pas-su', etoiles, n, ambre }.
function naEtiquette(note, reglage) {
  const d = naDecision(note, reglage);
  if (d === 'pas-su') return { k: 'pas-su', etoiles: null, n: null, ambre: false };
  if (note.n === 0) return { k: 'neuf', etoiles: null, n: 0, ambre: true };
  return { k: 'note', etoiles: note.etoiles, n: note.n, ambre: d === 'basse' };
}
// La note mémorisée encore valable (7 jours) : { e, n, at } (e = etoiles) → note, sinon null.
function naMemo(entree, maintenant) {
  if (!entree || typeof entree !== 'object') return null;
  const at = Number(entree.at), t = Number(maintenant);
  if (!Number.isFinite(at) || !Number.isFinite(t) || at > t + 60000 || t - at > NA_MEMO_MS) return null;
  const n = Number(entree.n);
  if (!Number.isInteger(n) || n < 0) return null;
  if (n === 0) return { etoiles: null, n: 0 };
  const e = Number(entree.e);
  return Number.isFinite(e) && e >= 0 && e <= 5 ? { etoiles: Math.round(e * 10) / 10, n } : null;
}
// </note-acheteur-regle>
export { NA_SEUIL_DEFAUT, NA_SEUIL_BORNES, NA_MEMO_MS, NA_REESSAI_MS, naReglage, naNote, naDecision, naPermetAuto, naEtiquette, naMemo };
