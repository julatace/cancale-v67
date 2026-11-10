// ═══════════════════════════════════════════════════════════════════════════
// L'AVIS REÇU SUR UNE VENTE (10 nov., lot U) — la règle, une seule (§11)
// ═══════════════════════════════════════════════════════════════════════════
// Validé par Julien (propositions du 9 nov., n° 32) : « l'avis reçu sur chaque
// vente ». ⚠️ Aucun rappel d'évaluation à laisser (REFUSÉ le 11 oct.).
//
// §5 : un avis ne se relie à une vente QUE par son n° de transaction. Jamais par
// la date, le titre, le prix ou l'ordre de la page — avec 50 paires identiques
// l'avis irait sur la mauvaise vente.
//
// MESURÉ le 10 nov. (lecture seule, sa base, 3 comptes, 60 avis) : chaque avis
// rangé par l'extension (`harvest_{uid}_feedbacks`, 5.319) porte SEULEMENT
// { id, rating, feedback } — ni date, ni n° de transaction, ni annonce. Les
// 1 375 transactions captées ne portent aucun champ d'avis non plus. Donc
// aujourd'hui AUCUN avis ne peut être relié : la vente dit « pas relié », jamais
// un avis deviné. La règle relie déjà si un jour l'avis porte `transaction_id`
// (l'extension devra le garder : `avisPropre` ne le range pas aujourd'hui).
// Fonctions PURES : scripts/audit-annonces-a-completer.cjs (partie « avis »).
// ─────────────────────────────────────────────────────────────────────────────

const txDe = (f) => {
  if (!f || typeof f !== 'object') return '';
  const v = f.transaction_id != null ? f.transaction_id : (f.transaction && typeof f.transaction === 'object' ? f.transaction.id : null);
  return v != null && /^\d{1,20}$/.test(String(v)) ? String(v) : '';
};
const noteDe = (f) => { const n = Number(f && f.rating); return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null; };

// tx : le n° de transaction de la vente. avis : les avis BRUTS du compte de la vente
// (`undefined` en cours · `null` pas lus · tableau). Rend :
//   { etat: 'encours' } · { etat: 'pasLu' } ·
//   { etat: 'relie', note, texte, ts } (un avis porte CE n° de transaction) ·
//   { etat: 'nonRelie', lus } (des avis lus, aucun ne dit sa transaction) ·
//   { etat: 'aucun', lus } (des avis portent leur transaction, aucun celle-ci).
export function avisDeLaVente(tx, avis) {
  if (avis === undefined) return { etat: 'encours' };
  if (!Array.isArray(avis)) return { etat: 'pasLu' };
  const t = tx != null && /^\d{1,20}$/.test(String(tx)) ? String(tx) : '';
  const lus = avis.filter((f) => noteDe(f) != null);
  const avecTx = lus.filter((f) => txDe(f));
  if (!avecTx.length) return { etat: 'nonRelie', lus: lus.length };
  if (!t) return { etat: 'aucun', lus: lus.length };
  const siens = avecTx.filter((f) => txDe(f) === t);
  if (!siens.length) return { etat: 'aucun', lus: lus.length };
  // Deux avis sur la même transaction : on ne choisit pas — pas relié.
  const notes = new Set(siens.map(noteDe));
  if (siens.length > 1 && notes.size > 1) return { etat: 'nonRelie', lus: lus.length };
  const f = siens[0];
  const ts = Number(f.created_at_ts) > 0 ? Number(f.created_at_ts) * 1000 : Date.parse(f.created_at || '');
  return { etat: 'relie', note: noteDe(f), texte: typeof f.feedback === 'string' ? f.feedback.trim() : '', ts: Number.isFinite(ts) ? ts : null };
}
