// ═══════════════════════════════════════════════════════════════════════════
// LES REFUS DE GOOGLE / DISCORD / SUPABASE, EN FRANÇAIS, AVEC LE GESTE (11 nov., lot connexions-oauth)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « je veux qu'il n'y ait aucun bug sur les connexions Google ou Discord ».
// Avant, l'écran recopiait le texte anglais de Supabase (« Unverified email with
// discord… », « invalid flow state… ») ou disait « annulée » pour un refus qui
// n'en était pas un (Supabase répond `error=access_denied` AUSSI pour une adresse
// non vérifiée, une inscription fermée, un compte suspendu).
//
// Ce qui est lu (code source de Supabase Auth, `internal/api/external.go`,
// `identity.go`, `token.go`, `errors.go`, lu le 11 nov.) :
//   · retour chez VRM : `?error=…&error_code=…&error_description=…` (et la même
//     chose après `#`) ; `error_code` est la seule partie stable ;
//   · échange du code (`/token?grant_type=pkce`) : JSON `{ error_code, msg }` ;
//   · annulation chez Google/Discord : `error=access_denied` SANS `error_code`.
// Règle : le CODE d'abord, la phrase anglaise seulement en repli ; jamais de
// texte anglais à l'écran ; jamais « annulée » quand un code dit autre chose.
//
// ⚠️ Ce bloc est RECOPIÉ tel quel dans l'extension (background.js) par
//    `node scripts/audit-connexions-oauth.cjs --recopie` — ne pas le modifier là-bas.
// <regle-erreurs-oauth>
const NOMS_FOURNISSEURS_OAUTH = { google: 'Google', discord: 'Discord' };
// `e` : { error, code, description } · `fournisseur` : 'google' | 'discord' | '' (pas su) ·
// `contexte` : 'connexion' (app) · 'liaison' (Relier, connecté) · 'extension'.
function messageErreurOAuth(e, fournisseur, contexte) {
  const x = e || {};
  const code = String(x.code || '').toLowerCase().replace(/[^a-z_]/g, '');
  const err = String(x.error || '').toLowerCase();
  const desc = String(x.description || '');
  const nomConnu = NOMS_FOURNISSEURS_OAUTH[fournisseur] || '';
  const nom = nomConnu || 'ce compte';
  const ctx = contexte === 'liaison' || contexte === 'extension' ? contexte : 'connexion';
  const recommencer = ctx === 'liaison' ? (nomConnu ? `Reclique « Relier ${nomConnu} ».` : 'Recommence depuis Mon compte.')
    : ctx === 'extension' ? 'Recommence depuis le logo VRM.'
    : (nomConnu ? `Reclique « Continuer avec ${nomConnu} ».` : 'Recommence depuis la connexion.');
  const parEmail = ctx === 'liaison' ? '' : ' Ou connecte-toi avec ton e-mail VRM.';
  const a = (c) => code === c;
  // Liens reçus par e-mail (confirmation, mot de passe) : aucun fournisseur en jeu.
  if (a('otp_expired') || (!code && /email link is invalid|has expired/i.test(desc) && !nomConnu)) return 'Ce lien e-mail a expiré ou a déjà servi. Redemande un e-mail depuis la connexion.';
  if (a('provider_email_needs_verification') || a('email_not_confirmed') || /unverified email/i.test(desc)) {
    if (/confirmation email has been sent/i.test(desc) || a('email_not_confirmed')) return `Un e-mail de confirmation est parti vers ton adresse ${nom}. Ouvre-le, puis reviens te connecter.`;
    return `Ton adresse e-mail ${nom} n’est pas vérifiée. Vérifie-la chez ${nom}, puis réessaie.${parEmail}`;
  }
  if (/error getting user email/i.test(desc)) return `${nomConnu || 'Ce compte'} n’a pas donné d’adresse e-mail. Ajoute une adresse vérifiée chez ${nom}, puis réessaie.${parEmail}`;
  if (a('identity_already_exists') || /identity is already linked/i.test(desc)) {
    // « Identity is already linked » (à CE compte) ≠ « … to another user » (un autre compte VRM).
    if (/already linked\s*\.?$/i.test(desc.trim()) && !/another/i.test(desc)) return `${nomConnu || 'Ce compte'} est déjà relié à ton compte VRM. Rien à faire.`;
    // Le chemin en 3 gestes, le MÊME que l'écran de suppression (lot suppression-oauth).
    return `Ce ${nom} a déjà son propre compte VRM. 1. Déconnecte-toi, puis « Continuer avec ${nom} ». 2. Paramètres → Supprimer mon compte : tape SUPPRIMER. 3. Reconnecte-toi ici, puis relie ${nom}.`;
  }
  if (a('manual_linking_disabled') || /manual.?linking/i.test(desc)) return 'La liaison n’est pas encore activée sur VRM. Ton compte reste inchangé.';
  if (a('email_exists') || /already been registered/i.test(desc)) return `Cette adresse a déjà un compte VRM. Connecte-toi avec elle, puis relie ${nom} dans ton profil.`;
  if (a('signup_disabled') || /signups not allowed/i.test(desc)) return 'Les inscriptions sont fermées sur VRM pour le moment. Aucun compte n’a été créé.';
  if (a('user_banned') || /user is banned/i.test(desc)) return 'Ce compte VRM est suspendu. Écris au support de VRM.';
  if (['bad_oauth_state', 'bad_oauth_callback', 'flow_state_not_found', 'flow_state_expired', 'flow_state_already_used', 'bad_code_verifier'].includes(code)
    || /flow state|oauth state|code verifier|code challenge/i.test(desc)) return `Cette connexion a expiré ou a déjà servi. ${recommencer}`;
  if (!code && (err === 'access_denied' || /denied|cancel/i.test(desc))) return nomConnu ? `Connexion avec ${nomConnu} annulée. Rien n’a changé.` : 'Connexion annulée. Rien n’a changé.';
  return `La connexion${nomConnu ? ' avec ' + nomConnu : ''} n’a pas pu aboutir. Réessaie dans un instant. ${recommencer}`;
}
// </regle-erreurs-oauth>

export { NOMS_FOURNISSEURS_OAUTH, messageErreurOAuth };
