// ════════════════════════════════════════════════════════════════════════════
//  UN FAUX GoTrue (Supabase Auth) À ÉTAT — 5.329, bancs « reste connecté » et
//  « carte Orion sans onglet ». Rien de réel : comptes et jetons inventés.
//
//  Les règles de rotation des jetons de renouvellement, celles du vrai GoTrue
//  (relues dans son code et mesurées le 11 octobre, voir background.js) :
//   · un jeton VIVANT ⇒ il est révoqué, un enfant neuf est rendu (rotation) ;
//   · un jeton révoqué qui est le PARENT du jeton actif ⇒ le jeton actif est
//     rendu tel quel (le client n'a pas pu ranger sa réponse) ;
//   · un jeton révoqué rejoué dans les 10 s (intervalle de réutilisation) ⇒ le
//     jeton actif ;
//   · sinon ⇒ 400 `refresh_token_already_used` et TOUTE la famille est révoquée
//     (Supabase croit à un vol) — c'est « déconnecté ».
//  `maintenant()` : l'horloge du banc (on peut l'avancer de 6 h).
//  5.330 : aussi /auth/v1/otp (code par e-mail, `create_user:false` : une
//  adresse inconnue est refusée en 422 `otp_disabled`, un second envoi en moins
//  de 60 s en 429), /auth/v1/verify (type `email`, faux code ⇒ 403
//  `otp_expired`, comme GoTrue) et `grant_type=pkce` (le code rendu par
//  `autoriser(défi, email)` ne s'échange qu'avec le BON vérificateur).
//  Un compte à `null` n'a pas de mot de passe (créé avec Google / Discord).
// ════════════════════════════════════════════════════════════════════════════
function fauxGoTrue({ maintenant = () => Date.now(), retardMs = 0, comptes = { 'julien@exemple.fr': 'bon-mot-de-passe', 'google@exemple.fr': null }, codeOtp = '482913' } = {}) {
  let n = 0;
  const jetons = new Map();      // jeton → { famille, revoque, at, parent }
  const familles = new Map();    // famille → { actif, morte, uid, email }
  const j = { refresh: [], login: [], refus: [], otp: [], verify: [], pkce: [], corps: [] };
  const codes = new Map();       // email → { code, at }
  const pkce = new Map();        // code d'autorisation → { defi, email }
  const neuf = (famille, parent) => { const t = 'rt-' + (++n) + '-' + Math.random().toString(36).slice(2, 8); jetons.set(t, { famille, revoque: false, at: maintenant(), parent }); familles.get(famille).actif = t; return t; };
  const acces = (f) => { const p = { sub: f.uid, email: f.email, exp: Math.floor(maintenant() / 1000) + 3600 }; return 'e30.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.sig'; };
  const session = (famille, rt) => { const f = familles.get(famille); return { access_token: acces(f), refresh_token: rt, expires_in: 3600, token_type: 'bearer', user: { id: f.uid, email: f.email } }; };
  const ouvrir = (email) => { const famille = 'fam-' + (familles.size + 1); familles.set(famille, { actif: null, morte: false, uid: '0000000a-0000-4000-8000-00000000000' + (familles.size % 10), email }); const rt = neuf(famille, null); return { famille, rt, corps: session(famille, rt) }; };
  async function token(url, corps) {
    if (retardMs) await new Promise((r) => setTimeout(r, retardMs));
    const g = new URL(url).searchParams.get('grant_type');
    if (g === 'password') {
      j.login.push({ email: corps.email, at: maintenant() });
      const mdp = comptes[String(corps.email || '').toLowerCase()];
      if (typeof mdp !== 'string' || mdp !== corps.password) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } };
      return { status: 200, body: ouvrir(String(corps.email).toLowerCase()).corps };
    }
    if (g === 'refresh_token') {
      const t = String(corps.refresh_token || '');
      j.refresh.push({ jeton: t, at: maintenant() });
      const x = jetons.get(t);
      if (!x) { j.refus.push('introuvable'); return { status: 400, body: { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' } }; }
      const f = familles.get(x.famille);
      if (f.morte) { j.refus.push('famille_morte'); return { status: 400, body: { error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' } }; }
      if (!x.revoque) { x.revoque = true; x.at = maintenant(); const rt = neuf(x.famille, t); return { status: 200, body: session(x.famille, rt) }; }
      const actif = jetons.get(f.actif);
      if ((actif && actif.parent === t) || maintenant() - x.at < 10000) return { status: 200, body: session(x.famille, f.actif) };
      f.morte = true; j.refus.push('deja_utilise');
      return { status: 400, body: { error_code: 'refresh_token_already_used', msg: 'Invalid Refresh Token: Already Used' } };
    }
    if (g === 'pkce') {
      j.pkce.push({ code: corps.auth_code, at: maintenant() });
      const x = pkce.get(String(corps.auth_code || ''));
      if (!x) return { status: 404, body: { error_code: 'flow_state_not_found', msg: 'invalid flow state, no valid flow state found' } };
      pkce.delete(String(corps.auth_code));
      const defi = require('crypto').createHash('sha256').update(String(corps.code_verifier || '')).digest('base64url');
      if (defi !== x.defi) return { status: 403, body: { error_code: 'bad_code_verifier', msg: 'code challenge does not match previously saved code verifier' } };
      const o = ouvrir(x.email).corps; o.user.created_at = new Date(maintenant() - 86400000).toISOString(); o.user.identities = [{ provider: 'google' }];
      return { status: 200, body: o };
    }
    return { status: 400, body: { error: 'unsupported_grant_type' } };
  }
  async function otp(corps) {
    const email = String(corps.email || '').toLowerCase();
    j.otp.push({ email, create_user: corps.create_user, at: maintenant() });
    if (corps.create_user !== false || !(email in comptes)) return { status: 422, body: { code: 422, error_code: 'otp_disabled', msg: 'Signups not allowed for otp' } };
    const avant = codes.get(email);
    if (avant && maintenant() - avant.at < 60000) return { status: 429, body: { code: 429, error_code: 'over_email_send_rate_limit', msg: `For security purposes, you can only request this after ${Math.ceil((60000 - (maintenant() - avant.at)) / 1000)} seconds.` } };
    codes.set(email, { code: codeOtp, at: maintenant() });
    return { status: 200, body: {} };
  }
  async function verify(corps) {
    const email = String(corps.email || '').toLowerCase();
    j.verify.push({ email, type: corps.type, at: maintenant() });
    const c = codes.get(email);
    if (corps.type !== 'email' || !c || String(corps.token) !== c.code) return { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } };
    codes.delete(email);
    return { status: 200, body: ouvrir(email).corps };
  }
  // Ce que ferait Supabase après Google : un code d'autorisation lié au défi.
  const autoriser = (defi, email = 'google@exemple.fr') => { const c = 'auth-' + (++n) + '-' + Math.random().toString(36).slice(2, 10); pkce.set(c, { defi, email }); return c; };
  const repondre = (status, body) => { const t = JSON.stringify(body); return { ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' }, json: async () => JSON.parse(t), text: async () => t }; };
  // Enveloppe le `fetch` d'un fond (`ctx.fetch`) : /auth/v1/token chez nous, le reste au banc.
  const brancher = (ctx) => {
    const avant = ctx.fetch;
    ctx.fetch = async (url, opts = {}) => {
      if (/\/auth\/v1\/(token\?|otp$|verify$)/.test(String(url))) {
        let c = {}; try { c = JSON.parse(opts.body || '{}'); } catch (_) {}
        j.corps.push(String(url) + ' ' + String(opts.body || ''));
        const r = /\/otp$/.test(String(url)) ? await otp(c) : /\/verify$/.test(String(url)) ? await verify(c) : await token(String(url), c);
        return repondre(r.status, r.body);
      }
      if (/\/auth\/v1\/settings/.test(String(url))) return repondre(200, { external: { google: true, discord: true } });
      return avant(url, opts);
    };
  };
  return { j, ouvrir, token, brancher, familles, jetons, codes, autoriser, otp, verify };
}
module.exports = { fauxGoTrue };
