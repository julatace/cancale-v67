// ════════════════════════════════════════════════════════════════════════════
//  AUDIT « CONNEXIONS GOOGLE / DISCORD » (11 nov., lot connexions-oauth)
//
//  Julien : « je veux qu'il n'y ait aucun bug sur les connexions Google ou Discord ».
//  Les réponses servies sont celles du code de Supabase Auth (lu le 11 nov. :
//  external.go, identity.go, token.go, errors.go) — textes et codes exacts.
//   M1  chaque refus réel de Supabase / Google / Discord a SA phrase française :
//       jamais l'anglais, jamais « annulée » quand un code dit autre chose
//       (`access_denied` vaut AUSSI pour une adresse non vérifiée) ; le fournisseur
//       nommé est celui du clic ; lien e-mail expiré ≠ fournisseur.
//   M2  « Identity is already linked » (à CE compte) ≠ « … to another user ».
//   D1  « Délier » : jamais la dernière identité ; l'e-mail de connexion qui change
//       est DIT (règle de Supabase : vérifiée d'abord, puis la plus ancienne).
//   A1  l'app lit `error_code` au retour, traduit l'échange du code, nomme le bon
//       fournisseur, consomme le vérificateur ; « Délier » relit la fiche.
//   X1  l'extension (VRAI background.js, `_fond-vm.cjs`) : refus traduits par code ;
//       un compte que « Continuer avec … » vient de créer est ANNULÉ par vrm.center,
//       la session n'est PAS rangée ; refus du serveur ⇒ comme avant.
//   R0  la règle de l'extension est la copie exacte de src/auth/erreursOAuth.js.
//  `--recopie` : recopie la règle dans background.js. `--arbre <dossier>` : un autre
//  arbre (preuve sur le code d'avant). Aucune donnée réelle.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path');
const iArbre = process.argv.indexOf('--arbre');
const RACINE = iArbre > 0 ? path.resolve(process.argv[iArbre + 1]) : path.join(__dirname, '..');
const lire = (p) => { try { return fs.readFileSync(path.join(RACINE, p), 'utf8'); } catch (_) { return ''; } };
const BLOC = /\/\/ <regle-erreurs-oauth>\n[\s\S]*?\/\/ <\/regle-erreurs-oauth>/;
const SRC_REGLE = lire('src/auth/erreursOAuth.js');
const BG_CHEMIN = path.join(RACINE, 'vinted-sync-extension', 'background.js');

if (process.argv.includes('--recopie')) {
  const bloc = (BLOC.exec(SRC_REGLE) || [])[0];
  const bg = fs.readFileSync(BG_CHEMIN, 'utf8');
  if (!bloc || !BLOC.test(bg)) { console.log('❌ bloc <regle-erreurs-oauth> introuvable'); process.exit(1); }
  fs.writeFileSync(BG_CHEMIN, bg.replace(BLOC, () => bloc));
  console.log('✅ règle recopiée dans background.js');
  process.exit(0);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + String(d).slice(0, 600) : ''}`); };
const ANGLAIS = /\b(the|with|email has|has been|invalid|flow state|is already|linked|Verify|denied|request|error|provider|Unverified|Signups|banned|registered)\b/;

// La règle, chargée telle quelle (sans `export`), comme l'extension la charge.
function chargerRegle(texte) {
  const bloc = (BLOC.exec(texte) || [])[0];
  if (!bloc) return null;
  try { return new Function(bloc + '\nreturn messageErreurOAuth;')(); } catch (_) { return null; }
}

(async () => {
  const m = chargerRegle(SRC_REGLE);
  dit(typeof m === 'function', 'M0 · la règle existe (src/auth/erreursOAuth.js, bloc <regle-erreurs-oauth>)');
  if (typeof m === 'function') {
    // Les retours RÉELS (textes de Supabase Auth, mot pour mot).
    const CAS = [
      ['M1 Discord adresse non vérifiée, e-mail parti (inscription, confirmation allumée)', { error: 'access_denied', code: 'provider_email_needs_verification', description: 'Unverified email with discord. A confirmation email has been sent to your discord email' }, 'discord', 'connexion', /e-mail de confirmation est parti vers ton adresse Discord/],
      ['M1 Discord adresse non vérifiée, même adresse qu’un compte VRM (aucun e-mail parti)', { error: 'access_denied', code: 'provider_email_needs_verification', description: 'Unverified email with discord. Verify the email with discord in order to sign in' }, 'discord', 'connexion', /adresse e-mail Discord n’est pas vérifiée.*e-mail VRM/],
      ['M1 Discord sans adresse (« sans e-mail » éteint)', { error: 'server_error', description: 'Error getting user email from external provider' }, 'discord', 'connexion', /Discord n’a pas donné d’adresse e-mail/],
      ['M1 annulé chez Google', { error: 'access_denied', description: 'The resource owner or authorization server denied the request' }, 'google', 'connexion', /^Connexion avec Google annulée\. Rien n’a changé\.$/],
      ['M1 annulé chez Discord (sans description)', { error: 'access_denied' }, 'discord', 'extension', /^Connexion avec Discord annulée/],
      ['M1 inscriptions fermées', { error: 'access_denied', code: 'signup_disabled', description: 'Signups not allowed for this instance' }, 'google', 'connexion', /inscriptions sont fermées/],
      ['M1 compte suspendu', { error: 'access_denied', code: 'user_banned', description: 'User is banned' }, 'google', 'connexion', /suspendu/],
      ['M1 code déjà servi (double clic, retour arrière)', { code: 'flow_state_not_found', description: 'invalid flow state, no valid flow state found' }, 'google', 'connexion', /expiré ou a déjà servi\. Reclique « Continuer avec Google »/],
      ['M1 code expiré', { code: 'flow_state_expired', description: 'invalid flow state, flow state has expired' }, 'discord', 'liaison', /expiré ou a déjà servi\. Reclique « Relier Discord »/],
      ['M1 vérificateur d’un autre onglet', { code: 'bad_code_verifier', description: 'code challenge does not match previously saved code verifier' }, 'google', 'extension', /déjà servi\. Recommence depuis le logo VRM/],
      ['M1 état OAuth périmé', { error: 'invalid_request', code: 'bad_oauth_state', description: 'OAuth state has expired' }, 'google', 'connexion', /expiré ou a déjà servi/],
      ['M1 lien e-mail expiré (pas un fournisseur)', { error: 'access_denied', code: 'otp_expired', description: 'Email link is invalid or has expired' }, '', 'connexion', /^Ce lien e-mail a expiré/],
      ['M1 liaison : adresse déjà prise', { error: 'invalid_request', code: 'email_exists', description: 'A user with this email address has already been registered' }, 'discord', 'liaison', /déjà un compte VRM.*relie Discord/],
      ['M1 liaison : manual linking éteint', { code: 'manual_linking_disabled', description: 'Manual linking is disabled' }, 'discord', 'liaison', /pas encore activée/],
      ['M1 inconnu (500)', { error: 'server_error', description: 'Multiple accounts with the same email address in the same linking domain detected: default' }, 'google', 'connexion', /La connexion avec Google n’a pas pu aboutir/],
      ['M2 identité déjà reliée à un AUTRE compte', { error: 'server_error', code: 'identity_already_exists', description: 'Identity is already linked to another user' }, 'discord', 'liaison', /Ce Discord a déjà son propre compte VRM/],
      ['M2 identité déjà reliée à CE compte', { error: 'server_error', code: 'identity_already_exists', description: 'Identity is already linked' }, 'google', 'liaison', /^Google est déjà relié à ton compte VRM\. Rien à faire\.$/],
    ];
    for (const [nom, e, f, c, attendu] of CAS) {
      const t = m(e, f, c);
      dit(attendu.test(t) && !ANGLAIS.test(t), nom, t);
    }
    dit(!/annulée/.test(m({ error: 'access_denied', code: 'provider_email_needs_verification' }, 'discord', 'extension')), 'M1 `access_denied` + un code ⇒ jamais « annulée »');
    dit(!/Discord/.test(m({ error: 'access_denied', code: 'signup_disabled' }, 'google', 'connexion')) && !/Discord|Google/.test(m({ error: 'access_denied' }, '', 'connexion')), 'M1 le fournisseur nommé est celui du clic (jamais « Discord » par défaut)');
    const phrases = CAS.map(([, e, f, c]) => m(e, f, c)).join(' ').split(/(?<=[.!?])\s+/);
    const longues = phrases.filter((p) => p.replace(/\([^)]*\)/g, '').split(/\s+/).filter(Boolean).length > 12);
    dit(!longues.length, 'M1 ≤ 12 mots par phrase (hors parenthèse du chemin)', longues.join(' | '));
  }

  // ── D1 : « Délier » ─────────────────────────────────────────────────────
  let D = null;
  try { D = await import(path.join(RACINE, 'src', 'auth', 'delierOAuth.js')); } catch (_) { D = null; }
  dit(!!D && typeof D.planDelier === 'function', 'D0 · la règle de « Délier » existe (src/auth/delierOAuth.js)');
  if (D && D.planDelier) {
    const id = (p, email, v, at, n) => ({ provider: p, identity_id: n, created_at: at, identity_data: { email, email_verified: v } });
    const seul = D.planDelier({ email: 'a@gmail.test', identities: [id('google', 'a@gmail.test', true, '2026-01-01', 'g')] }, 'google', 'g');
    dit(!seul.ok && /seule façon/.test(seul.error), 'D1 Google seule identité : refusé avant tout appel', JSON.stringify(seul));
    const garde = D.planDelier({ email: 'a@vrm.test', identities: [id('email', 'a@vrm.test', true, '2026-01-01', 'e'), id('google', 'a@gmail.test', true, '2026-02-01', 'g')] }, 'google', 'g');
    dit(garde.ok && !garde.nouveauEmail && !/deviendra/.test(garde.avertissement), 'D1 un mot de passe reste : l’e-mail ne change pas, rien d’inquiétant dit', JSON.stringify(garde));
    const change = D.planDelier({ email: 'a@gmail.test', identities: [id('google', 'a@gmail.test', true, '2026-01-01', 'g'), id('discord', 'b@discord.test', true, '2026-02-01', 'd')] }, 'google', 'g');
    dit(change.ok && change.nouveauEmail === 'b@discord.test' && /deviendra b@discord\.test/.test(change.avertissement), 'D1 Google + Discord, e-mail Google : « Ton e-mail de connexion deviendra b@… » dit AVANT', JSON.stringify(change));
    const rang = D.planDelier({ email: 'a@gmail.test', identities: [id('google', 'a@gmail.test', true, '2026-01-01', 'g'), id('discord', 'n@x.test', false, '2026-01-02', 'd'), id('discord', 'v@x.test', true, '2026-03-01', 'd2')] }, 'google', 'g');
    dit(rang.nouveauEmail === 'v@x.test', 'D1 la règle de Supabase : adresse vérifiée d’abord, même plus récente', JSON.stringify(rang));
    dit(!D.planDelier(null, 'google', 'g').ok && !D.planDelier({ identities: [] }, 'discord', 'x').ok, 'D1 fiche pas lue, ou identité absente : rien n’est délié');
    dit(/seule façon/.test(D.refusDelier(422, { error_code: 'single_identity_not_deletable', msg: 'User must have at least 1 identity after unlinking' }, 'google'))
      && /déjà plus relié/.test(D.refusDelier(422, { error_code: 'identity_not_found', msg: "Identity doesn't exist" }, 'discord'))
      && /adresse restante est déjà prise/.test(D.refusDelier(422, { error_code: 'email_conflict_identity_not_deletable', msg: 'Unable to unlink identity due to email conflict' }, 'discord')), 'D1 les refus réels du retrait, en français');
  }

  // ── A1 : l'app ──────────────────────────────────────────────────────────
  const APP = lire('src/App.jsx'), REG = lire('src/ecrans/Reglages.jsx');
  const consume = (/const consumeAuthRedirect = async \(\) => \{[\s\S]*?\n\};/.exec(APP) || [''])[0];
  dit(/error_code/.test(consume) && /erreurRetourOAuth\(e,/.test(consume), 'A1 le retour lit `error_code` et le traduit');
  dit(/lireIntentionOAuth\(/.test((/if \(err\) \{[\s\S]*?\n  \}/.exec(consume) || [''])[0]) && /removeItem\(PKCE_KEY\)/.test(consume), 'A1 sur un refus : le fournisseur du clic, et le vérificateur consommé');
  dit(/erreurRetourOAuth\(\{ code: r\.code/.test(consume) && /code: json\.error_code/.test(APP), 'A1 l’échange du code (déjà servi, expiré) est traduit, jamais recopié');
  dit(/messageErreurOAuth/.test((/const erreurRetourOAuth=[^\n]*/.exec(APP) || [''])[0]), 'A1 une seule règle : erreurRetourOAuth passe par src/auth/erreursOAuth.js');
  dit(/identiteRelieeAuto\(/.test(consume) && /maintenant relié à ton compte VRM/.test(APP), 'A1 même adresse, liaison automatique de Supabase : c’est DIT une fois');
  dit(/planDelier\(fiche,provider,id\)/.test(REG) && /auth\/v1\/user`,\{headers/.test((/const oauthDelier = [\s\S]*?\n\};/.exec(REG) || [''])[0]), 'A1 « Délier » relit la fiche au clic (src/auth/delierOAuth.js)');

  // ── R0 / X1 : l'extension ───────────────────────────────────────────────
  const BG = lire('vinted-sync-extension/background.js');
  const blocSrc = (BLOC.exec(SRC_REGLE) || [])[0], blocBg = (BLOC.exec(BG) || [])[0];
  dit(!!blocSrc && blocSrc === blocBg, 'R0 la règle de l’extension est la copie exacte de l’app (sinon : --recopie)');
  dit(/error_code: q\.get\('error_code'\)/.test(lire('vinted-sync-extension/oauth-retour.js')), 'X1 oauth-retour.js remet aussi `error_code`');
  let faireFond = null;
  try { ({ faireFond } = require(path.join(RACINE, 'scripts', '_fond-vm.cjs'))); } catch (_) { faireFond = null; }
  if (faireFond && blocBg) {
    const RETOUR = { tab: { id: 9, url: 'https://vrm.center/extension-retour.html' } };
    const monte = (rep, serveur) => {
      const f = faireFond({ src: BG_CHEMIN, store: { __sansSession: true, vrmOAuthDepart: { f: 'discord', v: 'x'.repeat(64), at: Date.now() } } });
      const f0 = f.ctx.fetch; f.annuler = 0; f.tokens = 0;
      f.ctx.fetch = async (u, o) => {
        const s = String(u);
        if (/\/auth\/v1\/token\?grant_type=pkce/.test(s)) { f.tokens++; return { ok: rep.status === 200, status: rep.status, json: async () => rep.body }; }
        if (/vrm\.center\/api\/compte\?mode=oauth-sans-compte/.test(s)) { f.annuler++; f.auth = o && o.headers && o.headers.Authorization; if (serveur === 'reseau') throw new TypeError('Failed to fetch'); return { ok: serveur === 'annule', status: serveur === 'annule' ? 200 : 409, json: async () => (serveur === 'annule' ? { ok: true, annule: true } : { ok: false, annule: false, raison: 'pas-vide' }) }; }
        return f0(u, o);
      };
      return f;
    };
    {
      const f = monte({ status: 200, body: {} });
      const r = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, error: 'access_denied', error_code: 'provider_email_needs_verification', error_description: 'Unverified email with discord. A confirmation email has been sent to your discord email' }, RETOUR);
      dit(r && r.ok === false && /e-mail de confirmation est parti/.test(r.message || '') && !/annulée/.test(r.message || '') && ((f.store.vrmOAuthEtat || {}).message || '') === r.message, 'X1 Discord non vérifié : la vraie raison (pas « annulée »), notée pour la carte', JSON.stringify(r));
    }
    {
      const f = monte({ status: 404, body: { code: 404, error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' } });
      const r = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, RETOUR);
      dit(r && r.ok === false && /expiré ou a déjà servi\. Recommence depuis le logo VRM/.test(r.message || '') && !ANGLAIS.test(r.message || ''), 'X1 code déjà servi : la phrase, jamais « code 404 » ni l’anglais', JSON.stringify(r));
    }
    const NEUF = { access_token: 'a.neuf', refresh_token: 'r.neuf', expires_in: 3600, user: { id: 'u-neuf', email: 'autre@discord.test', created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString(), identities: [{ provider: 'discord' }] } };
    {
      const f = monte({ status: 200, body: NEUF }, 'annule');
      const r = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, RETOUR);
      dit(f.annuler === 1 && f.auth === 'Bearer a.neuf', 'X1 compte que ce clic vient de créer : vrm.center est appelé pour l’annuler, avec CETTE session', JSON.stringify({ n: f.annuler, a: f.auth }));
      dit(r && r.ok === false && r.code === 'sans-compte' && !(f.store.vrmSession && f.store.vrmSession.access_token) && /Aucun compte VRM n’est relié à ce Discord/.test(r.message || '') && (f.store.vrmOAuthEtat || {}).sansCompte === true, 'X1 annulé : AUCUNE session rangée, la phrase avec le geste', JSON.stringify({ r, s: f.store.vrmSession }));
    }
    for (const serveur of ['refuse', 'reseau']) {
      const f = monte({ status: 200, body: NEUF }, serveur);
      const r = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, RETOUR);
      dit(r && r.ok === true && r.neuf === true && (f.store.vrmSession || {}).access_token === 'a.neuf', `X1 serveur ${serveur === 'refuse' ? 'refuse (409)' : 'injoignable'} : comme avant (session rangée, « compte neuf » dit) — rien deviné`, JSON.stringify(r));
    }
    {
      const f = monte({ status: 200, body: { access_token: 'a.vieux', refresh_token: 'r', expires_in: 3600, user: { id: 'u-1', email: 'x@test', created_at: '2026-01-01T00:00:00Z', identities: [{ provider: 'discord' }] } } }, 'annule');
      const r = await f.envoyer({ from: 'vrm-oauth-retour', action: 'oauthRetour', fixe: true, code: 'abcdefgh123' }, RETOUR);
      dit(r && r.ok === true && f.annuler === 0 && (f.store.vrmSession || {}).access_token === 'a.vieux', 'X1 compte existant relié : connecté, aucune annulation demandée', JSON.stringify({ r, n: f.annuler }));
    }
  } else dit(false, 'X1 le vrai background.js a pu être monté (règle recopiée ?)');

  console.log(`\n${ko ? '❌' : '✅'} audit-connexions-oauth : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
