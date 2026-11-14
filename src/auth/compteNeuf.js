// ═══════════════════════════════════════════════════════════════════════════
// « CONTINUER AVEC DISCORD / GOOGLE » NE CRÉE PLUS UN COMPTE EN SILENCE (11 nov., lot DJ6)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « quand j'avais tenté de me connecter avec Discord ça avait créé un
// compte avec l'adresse mail associée ». Supabase (GoTrue) CRÉE un compte à toute
// identité Discord/Google inconnue (aucun réglage « se connecter seulement ») :
// son compte VRM a un autre e-mail, donc Discord était « inconnu ».
// ⇒ Le bouton de CONNEXION pose une intention (`connexion`) ; au retour, un compte
//   que CE clic vient de créer (règle ci-dessous) est annulé par le serveur
//   (api/compte.js `?mode=oauth-sans-compte`, qui refait la même règle sur la fiche
//   lue avec la clé de service, et exige un compte VIDE) et l'écran le dit.
//   Créer un compte avec Discord/Google reste possible, mais EXPLICITE (inscription).
// Même règle ici et sur le serveur (le serveur importe ce fichier).
export const FOURNISSEURS_OAUTH = Object.freeze(['google', 'discord', 'apple']);   // (14 nov., 143) Apple : prêt, éteint tant que Supabase ne l'active pas
export const FENETRE_NEUF_MS = 10 * 60 * 1000;   // créé il y a moins de 10 min
export const ECART_CONNEXION_MS = 2 * 60 * 1000; // et jamais reconnecté depuis (mesuré : 1,4 s entre création et 1re connexion)
export const CLE_INTENTION = 'vrm_oauth_intention';

const ts = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? t : null; };

// Le fournisseur si `u` (fiche GoTrue : identities, created_at, last_sign_in_at) est
// un compte que la connexion EN COURS vient de créer, sinon ''. « Pas su » ⇒ ''.
export function compteOAuthAnnulable(u, maintenant = Date.now()) {
  try {
    const ids = Array.isArray(u && u.identities) ? u.identities : [];
    if (ids.length !== 1) return '';                       // une identité de plus = un compte relié, déjà vécu
    const p = String((ids[0] && ids[0].provider) || '');
    if (!FOURNISSEURS_OAUTH.includes(p)) return '';        // e-mail, téléphone… jamais
    const cree = ts(u.created_at);
    if (cree === null) return '';
    const age = maintenant - cree;
    if (age < -60000 || age > FENETRE_NEUF_MS) return '';
    const derniere = ts(u.last_sign_in_at);
    if (derniere !== null && derniere - cree > ECART_CONNEXION_MS) return '';
    return p;
  } catch (_) { return ''; }
}

// L'intention du clic, gardée 10 min (le retour peut arriver dans un nouvel onglet).
export function poserIntention(stockages, intention, fournisseur, maintenant = Date.now()) {
  if (!['connexion', 'inscription'].includes(intention) || !FOURNISSEURS_OAUTH.includes(fournisseur)) return;
  const v = JSON.stringify({ i: intention, p: fournisseur, at: maintenant });
  for (const s of stockages) { try { s && s.setItem(CLE_INTENTION, v); } catch (_) {} }
}
export function lireIntention(stockages, maintenant = Date.now()) {
  let r = null;
  for (const s of stockages) {
    try {
      const j = JSON.parse((s && s.getItem(CLE_INTENTION)) || 'null');
      if (s) s.removeItem(CLE_INTENTION);
      if (!r && j && ['connexion', 'inscription'].includes(j.i) && FOURNISSEURS_OAUTH.includes(j.p) && maintenant - j.at >= 0 && maintenant - j.at <= FENETRE_NEUF_MS) r = { intention: j.i, fournisseur: j.p };
    } catch (_) {}
  }
  return r;
}
export const nomFournisseur = (p) => (p === 'google' ? 'Google' : 'Discord');
