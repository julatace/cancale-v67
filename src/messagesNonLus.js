// ── UNE CONVERSATION « NON LUE » : UNE RÈGLE POUR TOUS LES ÉCRANS (§11) ──────
// (31 oct.) Mesuré le 20 oct. : Messages disait « Non lues 156 » pendant que
// Ma journée disait « 8 » — deux règles pour une notion. Ma journée suivait la
// décision de Julien du 16 oct. (« enlève répondre à 112 messages, c'est
// incohérent ») : seules comptent les conversations non lues qui ont bougé ces
// 7 derniers jours ; le reste est de vieux drapeaux « non lu » d'échanges jamais
// rouverts (souvent sur un compte qui n'a pas été relu). Messages, la tuile de
// Ma journée et le point « nouveau » de l'onglet lisent désormais TOUS cette
// règle. Une date illisible vaut « ancienne » (jamais « récente » par défaut).

export const MSG_RECENT_MS = 7 * 864e5;

export function messageRecent(quand, now = Date.now()) {
  const ms = Date.parse(quand);
  if (!Number.isFinite(ms)) return false;
  return now - ms < MSG_RECENT_MS;
}

// Une conversation captée (`unread`, `updated_at`).
export function conversationNonLue(c, now = Date.now()) {
  return !!(c && c.unread) && messageRecent(c.updated_at, now);
}

// Les non-lues PLUS ANCIENNES (drapeau Vinted encore posé, plus de 7 jours) :
// pas comptées, mais dites à part — jamais cachées en silence.
export function conversationNonLueAncienne(c, now = Date.now()) {
  return !!(c && c.unread) && !messageRecent(c.updated_at, now);
}
