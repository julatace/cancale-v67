// « ME RECONNECTER AVEC DISCORD / GOOGLE » avant de supprimer son compte
// (11 nov., lot suppression-oauth). Une RE-AUTHENTIFICATION par le même
// fournisseur : retour sur « Supprimer mon compte », jamais un autre compte.
// Le contexte (qui, par quoi, quand) est gardé 10 min, comme la liaison :
// au retour, une session d'un AUTRE compte n'est pas écrite (la sienne reste).
export const CLE_RECONNEXION = 'vrm_oauth_reconnexion';
const DUREE_MS = 10 * 60 * 1000;
const PERMIS = ['google', 'discord'];

export function poserReconnexion(stockages, { owner, provider, maintenant = Date.now() }) {
  if (!owner || !PERMIS.includes(provider)) return false;
  const v = JSON.stringify({ owner, provider, at: maintenant });
  let ok = false;
  for (const s of stockages) { try { if (s) { s.setItem(CLE_RECONNEXION, v); ok = true; } } catch (_) {} }
  return ok;
}
// Lu une fois (puis effacé). `null` = pas de reconnexion en cours.
export function lireReconnexion(stockages, maintenant = Date.now()) {
  let c = null;
  for (const s of stockages) {
    try {
      const j = JSON.parse((s && s.getItem(CLE_RECONNEXION)) || 'null');
      if (s) s.removeItem(CLE_RECONNEXION);
      if (!c && j && j.owner && PERMIS.includes(j.provider) && maintenant - j.at >= 0 && maintenant - j.at < DUREE_MS) c = j;
    } catch (_) {}
  }
  return c;
}
// Le retour n'est accepté que pour le MÊME compte VRM.
export const reconnexionPermise = (contexte, reponse) => !contexte || !!(reponse && reponse.access_token && reponse.user && reponse.user.id === contexte.owner);
// L'adresse de retour : Paramètres → Mon compte → Supprimer mon compte.
export const RETOUR_RECONNEXION = '/?tab=settings&vue=compte&section=supprimer';
