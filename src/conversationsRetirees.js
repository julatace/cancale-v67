// ── RETIRER UNE CONVERSATION DE LA LISTE (29 octobre) ────────────────────────
// Julien : « il y a un message d'une XT-6 qui ne veut pas s'enlever, je veux que
// ça dégage ». La règle de l'offre (`annonceOffreEnVente`, offresVinted.js) règle
// CE cas tout seul ; ce geste-ci est le sien, pour tout le reste : une
// conversation qu'il ne veut plus voir sort de la liste de VRM — rien n'est
// supprimé ni marqué sur Vinted.
// ⚠️ Elle REVIENT dès qu'un nouveau message arrive : on garde, au moment du
//    geste, la date du dernier message que la boîte montrait (`maj`) ; une boîte
//    relue avec une date plus récente la remet dans la liste. Un acheteur qui
//    réécrit n'est jamais caché (une offre cachée fait rater une vente).
// Identité : le compte + le numéro de la conversation (jamais un titre, §5).
// `vrm_conversations_retirees` = { [`${uid}_${conv}`]: { at, maj } }, synchronisée,
// posée SEULEMENT sur son clic, remise d'un clic. Bornée (les plus anciennes
// partent) : une liste qui grandit pour toujours finirait par peser sur `main`.
export const CONVERSATIONS_RETIREES = 'vrm_conversations_retirees';
export const RETIREES_MAX = 400;
export const cleConversation = (uid, id) => `${String(uid == null ? '' : uid)}_${String(id == null ? '' : id)}`;
const instant = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : (/^\d{10,13}$/.test(String(v)) ? Number(v) : NaN);
  const t = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : Date.parse(v);
  return Number.isFinite(t) && t > 0 ? t : null;
};
const propre = (r) => (r && typeof r === 'object' && !Array.isArray(r) ? r : {});
// Vrai si la conversation `c` (de la boîte du compte `uid`) est retirée ET n'a
// rien reçu depuis. Une entrée illisible ne retire rien (« pas su » ne cache rien).
export function conversationRetiree(retirees, uid, c) {
  if (!c || c.id == null) return false;
  const e = propre(retirees)[cleConversation(uid, c.id)];
  if (!e || typeof e !== 'object') return false;
  const seuil = instant(e.maj) ?? instant(e.at);
  if (seuil == null) return false;
  const actuel = instant(c.updated_at);
  return actuel == null || actuel <= seuil;
}
// Le geste : rend la NOUVELLE table (jamais modifiée en place), bornée.
export function retirerConversation(retirees, uid, c, maintenant = Date.now()) {
  if (!c || c.id == null || uid == null || uid === '') return propre(retirees);
  const suivant = { ...propre(retirees), [cleConversation(uid, c.id)]: { at: new Date(maintenant).toISOString(), maj: c.updated_at != null ? String(c.updated_at) : null } };
  const cles = Object.keys(suivant);
  if (cles.length <= RETIREES_MAX) return suivant;
  cles.sort((a, b) => (instant(suivant[a] && suivant[a].at) || 0) - (instant(suivant[b] && suivant[b].at) || 0));
  for (const k of cles.slice(0, cles.length - RETIREES_MAX)) delete suivant[k];
  return suivant;
}
// (revue) La date gardée au moment du geste : la PLUS RÉCENTE de ce que la boîte
// montre (`updated_at`) et du dernier message que le FIL ouvert montre (lu en
// direct, ou la réponse qu'il vient d'envoyer). Avec la seule date de la boîte,
// un fil plus récent qu'elle faisait REVENIR la conversation à la relecture de
// la boîte, sans aucun nouveau message. Une date dans le futur (horloge
// décalée) n'est pas retenue : elle cacherait les vrais nouveaux messages.
export function majAuGeste(boiteMaj, messages, maintenant = Date.now()) {
  let max = instant(boiteMaj);
  for (const m of (Array.isArray(messages) ? messages : [])) {
    const t = instant(m && m.ts);
    if (t != null && t <= maintenant + 60000 && (max == null || t > max)) max = t;
  }
  return max == null ? null : new Date(max).toISOString();
}
// « Les remettre » : retire de la table les clés données (toutes si `cles` n'est
// pas une liste ; une liste vide ne remet rien).
export function remettreConversations(retirees, cles) {
  const suivant = { ...propre(retirees) };
  for (const k of (Array.isArray(cles) ? cles : Object.keys(suivant))) delete suivant[k];
  return suivant;
}
