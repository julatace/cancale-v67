// api/_lib/ebay-messages-nonlus.js
// ────────────────────────────────────────────────────────────────────────────
// LES MESSAGES eBAY SANS RÉPONSE, COMPTÉS POUR MA JOURNÉE (21 octobre).
// Julien : les non-lus eBay dans Ma journée, à côté de ceux de Vinted.
//
// eBay ne dit pas « lu / non lu » d'un échange : il dit `MessageStatus`
// (Unanswered · Answered). VRM appelait déjà « non lu » un échange
// `Unanswered` sans aucune réponse (eBay → Messages, `data-nonlu`) : c'est LA
// règle, importée par l'écran eBay → Messages ET par la route (§11).
//
// Le résumé rangé (`ebay_messages{suffixe}`) ne porte AUCUNE donnée
// personnelle : le nombre, les identifiants d'échange (pour retirer celui
// auquel il vient de répondre), la date de lecture. Ni nom, ni texte.
// ────────────────────────────────────────────────────────────────────────────

// Même fenêtre que les messages Vinted de Ma journée (`MSG_RECENT_MS`, 7 j).
export const MSG_EBAY_RECENT_MS = 7 * 86400000;

export function messageEbayNonLu(m) {
  return !!m && /^unanswered$/i.test(String(m.status || '')) && !(Array.isArray(m.responses) && m.responses.length);
}

// Le résumé d'une PAGE 1 lue chez eBay. `null` si la liste n'est pas lisible
// (« pas su » : on n'écrit rien). `complet` faux quand eBay annonce d'autres
// pages : le nombre devient « au moins ».
export function resumeMessagesEbay(messages, totalPages, maintenant = Date.now()) {
  if (!Array.isArray(messages)) return null;
  const ids = [];
  for (const m of messages) {
    if (!messageEbayNonLu(m)) continue;
    const t = Date.parse(m.date || '');
    if (!Number.isFinite(t) || maintenant - t >= MSG_EBAY_RECENT_MS) continue;
    if (m.id) ids.push(String(m.id).slice(0, 64));
  }
  return { nonLus: ids.length, ids: ids.slice(0, 200), complet: !(Number.isInteger(totalPages) && totalPages > 1), capturedAt: maintenant };
}

// Après une réponse acceptée par eBay : l'échange sort du compte, sans
// relire eBay. Rend `undefined` (rien à écrire) si la ligne ne le portait pas.
export function retirerMessageRepondu(d, messageId) {
  if (!d || !Array.isArray(d.ids)) return undefined;
  const id = String(messageId || '');
  if (!d.ids.includes(id)) return undefined;
  const ids = d.ids.filter((x) => x !== id);
  return { ...d, ids, nonLus: Math.max(0, (Number(d.nonLus) || 0) - 1) };
}
