// ── UN LIEN DE CONNEXION NE S'OUVRE QUE DANS LE NAVIGATEUR QUI L'A DEMANDÉ ──
// (11 nov., revue de sécurité) Les e-mails de compte de Supabase (confirmation
// d'inscription, lien de connexion, renvoi) ramènent sur vrm.center avec la
// session EN CLAIR dans le fragment (`#access_token=…&refresh_token=…`, flux
// implicite). Avant : l'app adoptait n'importe quel fragment valide. Un lien
// fabriqué par un tiers avec SES propres jetons ouvrait donc l'app de la
// victime sur le compte du tiers — et l'extension suivait ce compte, rangeant
// chez lui les captures de la victime.
//
// La règle : un fragment n'est adopté que si
//   · CE navigateur a demandé un e-mail de compte récemment (`noterLienDemande`,
//     posé par l'inscription, le lien de connexion, le renvoi, le changement
//     d'adresse), ou que le compte du lien est DÉJÀ celui connecté ici ;
//   · et jamais par-dessus la session d'un AUTRE compte (on ne change pas de
//     compte tout seul).
// Le chemin `?code=` (PKCE) n'est pas concerné : il exige le vérificateur
// rangé par CE navigateur.
export const CLE_LIEN_DEMANDE = 'vrm_lien_demande';
// La confirmation d'inscription de Supabase vaut 24 h ; on laisse 48 h.
export const LIEN_DEMANDE_MS = 48 * 3600 * 1000;

export function noterLienDemande(st, maintenant = Date.now()) {
  try { st.setItem(CLE_LIEN_DEMANDE, String(maintenant)); } catch (_) {}
}
export function oublierLienDemande(st) {
  try { st.removeItem(CLE_LIEN_DEMANDE); } catch (_) {}
}
export function lienDemandeIci(st, maintenant = Date.now()) {
  let v = NaN;
  try { v = Number(st.getItem(CLE_LIEN_DEMANDE)); } catch (_) { return false; }
  if (!Number.isFinite(v) || v <= 0) return false;
  const age = maintenant - v;
  return age >= 0 && age <= LIEN_DEMANDE_MS;
}

// `sessionId` : le compte connecté ici avant le lien ('' si aucun) ;
// `jetonId` : le compte que désigne le jeton du lien (lu chez Supabase).
// Rend 'oui' · 'autre_session' · 'pas_demande'.
export function adopterJetonsDuLien({ demandeIci, sessionId, jetonId }) {
  const ici = String(sessionId || ''), lien = String(jetonId || '');
  if (!lien) return 'pas_demande';
  if (ici && ici !== lien) return 'autre_session';
  if (ici && ici === lien) return 'oui';
  return demandeIci ? 'oui' : 'pas_demande';
}

export const MSG_LIEN_PAS_DEMANDE = 'Ce lien de connexion n’a pas été demandé depuis ce navigateur : par prudence, VRM ne l’ouvre pas. Si tu viens de confirmer ton adresse, elle est confirmée — connecte-toi avec ton e-mail et ton mot de passe.';
export const MSG_LIEN_AUTRE_COMPTE = 'Ce lien ouvre un autre compte VRM que celui connecté ici : VRM ne change pas de compte tout seul. Ta session est conservée.';
