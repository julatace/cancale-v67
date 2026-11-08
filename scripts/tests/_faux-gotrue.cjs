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
// ════════════════════════════════════════════════════════════════════════════
function fauxGoTrue({ maintenant = () => Date.now(), retardMs = 0, comptes = { 'julien@exemple.fr': 'bon-mot-de-passe' } } = {}) {
  let n = 0;
  const jetons = new Map();      // jeton → { famille, revoque, at, parent }
  const familles = new Map();    // famille → { actif, morte, uid, email }
  const j = { refresh: [], login: [], refus: [] };
  const neuf = (famille, parent) => { const t = 'rt-' + (++n) + '-' + Math.random().toString(36).slice(2, 8); jetons.set(t, { famille, revoque: false, at: maintenant(), parent }); familles.get(famille).actif = t; return t; };
  const acces = (f) => { const p = { sub: f.uid, email: f.email, exp: Math.floor(maintenant() / 1000) + 3600 }; return 'e30.' + Buffer.from(JSON.stringify(p)).toString('base64url') + '.sig'; };
  const session = (famille, rt) => { const f = familles.get(famille); return { access_token: acces(f), refresh_token: rt, expires_in: 3600, token_type: 'bearer', user: { id: f.uid, email: f.email } }; };
  const ouvrir = (email) => { const famille = 'fam-' + (familles.size + 1); familles.set(famille, { actif: null, morte: false, uid: '0000000a-0000-4000-8000-00000000000' + (familles.size % 10), email }); const rt = neuf(famille, null); return { famille, rt, corps: session(famille, rt) }; };
  async function token(url, corps) {
    if (retardMs) await new Promise((r) => setTimeout(r, retardMs));
    const g = new URL(url).searchParams.get('grant_type');
    if (g === 'password') {
      j.login.push({ email: corps.email, at: maintenant() });
      if (comptes[String(corps.email || '').toLowerCase()] !== corps.password) return { status: 400, body: { error: 'invalid_grant', error_description: 'Invalid login credentials' } };
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
    return { status: 400, body: { error: 'unsupported_grant_type' } };
  }
  const repondre = (status, body) => { const t = JSON.stringify(body); return { ok: status >= 200 && status < 300, status, headers: { get: () => 'application/json' }, json: async () => JSON.parse(t), text: async () => t }; };
  // Enveloppe le `fetch` d'un fond (`ctx.fetch`) : /auth/v1/token chez nous, le reste au banc.
  const brancher = (ctx) => {
    const avant = ctx.fetch;
    ctx.fetch = async (url, opts = {}) => {
      if (/\/auth\/v1\/token\?/.test(String(url))) { let c = {}; try { c = JSON.parse(opts.body || '{}'); } catch (_) {} const r = await token(String(url), c); return repondre(r.status, r.body); }
      if (/\/auth\/v1\/settings/.test(String(url))) return repondre(200, { external: { google: true, discord: true } });
      return avant(url, opts);
    };
  };
  return { j, ouvrir, token, brancher, familles, jetons };
}
module.exports = { fauxGoTrue };
