// ── src/achatDistinct.js — ce qui DISTINGUE un achat d'un autre à l'œil (23 nov., revue UX #10) ───────────────────────
// Julien relie à l'œil : trois « Nike achat 0 » à 21 € ne doivent jamais se ressembler. La photo de l'annonce quand elle est
// connue ; sinon (et toujours en méta) la date ET l'heure de la commande, et le n° de transaction court (ses 4 derniers
// chiffres) — une IDENTITÉ (§5), jamais une ressemblance. Rien de lu ⇒ rien d'inventé (chaîne vide).
export const txCourt = (tx) => { const s = String(tx == null ? '' : tx).replace(/\D/g, ''); return s.length > 4 ? '…' + s.slice(-4) : s; };
export function dateHeureAchat(date, locale = 'fr-FR') {
  const t = Date.parse(date || ''); if (!Number.isFinite(t)) return '';
  const d = new Date(t);
  const aHeure = /T\d{2}:\d{2}/.test(String(date)) && !/T00:00(:00(\.0+)?)?(Z|[+-]00:?00)?$/.test(String(date));
  try {
    const jour = d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    return aHeure ? jour + ' ' + d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : jour;
  } catch (_) { return ''; }
}
// La méta qui distingue : « n° …4821 · 21 nov. 2026 14:32 ». `avecTx` faux quand une photo suffit à distinguer.
export function metaDistincte(a, { avecTx = true, locale = 'fr-FR' } = {}) {
  if (!a) return '';
  return [avecTx && a.transaction_id != null ? 'n° ' + txCourt(a.transaction_id) : '', dateHeureAchat(a.date, locale)].filter(Boolean).join(' · ');
}
