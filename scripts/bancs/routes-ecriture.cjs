// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES ROUTES QUI ÉCRIVENT LES JETONS VINTED, EXÉCUTÉES POUR DE VRAI
//        node scripts/bancs/routes-ecriture.cjs
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — « une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE ».
// `serveur.cjs` couvre email-inbound / widget / push. Restaient DEUX routes qui
// écrivent la donnée la PLUS coûteuse à perdre — les jetons Vinted : un jeton
// perdu, c'est une reconnexion forcée sur vinted.fr (§5.22, « une lecture ratée
// pouvait effacer un compte Vinted »). Aucun banc ne les avait jamais lancées.
//
//   api/vinted-refresh  Rafraîchit les jetons de tous les comptes. L'INVARIANT
//                       qui compte : un refresh que Vinted REFUSE ne doit JAMAIS
//                       réécrire la ligne — sinon on remplace un bon jeton par
//                       du vide, et le compte est mort jusqu'à reconnexion.
//   api/vinted-connect  Connexion par jeton collé. Un jeton que Vinted refuse ne
//                       doit JAMAIS créer de ligne (pas de compte fantôme sans
//                       jeton valide), et répondre l'échec — pas « ok ».
//
// §6.1 : la preuve que ces contrôles MORDENT se fait en réaffaiblissant la route
// (persister même sur échec / upsert même sur jeton refusé) — voir le bandeau
// final. Sur le code sain ils sont verts ; réaffaiblis, ils passent au rouge.
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');

let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

// ── Une fausse base + un faux Vinted ────────────────────────────────────────
// `vintedRefuse` : Vinted répond non-ok au /auth/refresh (jeton expiré/invalide).
const ecrites = []; // { method, table, body } de chaque écriture vers Supabase
function poserFetch({ vintedRefuse }) {
  ecrites.length = 0;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

    // ── Vinted ────────────────────────────────────────────────────────────
    if (/\/web\/api\/auth\/refresh$/.test(u)) {
      if (vintedRefuse) return new Response('refused', { status: 401 });
      return J({ access_token: 'ACC_FRAIS', refresh_token: 'REF_FRAIS' });
    }
    if (/\/api\/v2\/users\/current$/.test(u)) return J({ user: { login: 'moncompte', id: 7 } });

    // ── Supabase ────────────────────────────────────────────────────────────
    if (/\/rest\/v1\/vinted_accounts/.test(u)) {
      if (method === 'GET') {
        // Un compte dont l'access_token est EXPIRÉ (exp dans le passé) mais qui a
        // un refresh_token : vinted-refresh va donc tenter un refresh.
        const vieux = jwtExpire(-3600);
        return J([{ vinted_user_id: '42', access_token: vieux, refresh_token: 'REF_BON', domain: 'www.vinted.fr' }]);
      }
      // PATCH (refresh) ou POST (connect) : on note ce qui est écrit.
      let body = {};
      try { body = JSON.parse(opts.body || '{}'); } catch (_) {}
      ecrites.push({ method, table: 'vinted_accounts', body });
      return new Response('', { status: method === 'POST' ? 201 : 200 });
    }
    return J([]);
  };
}
// Fabrique un access_token JWT dont l'exp est `decalage` secondes par rapport à maintenant.
function jwtExpire(decalage) {
  const payload = Buffer.from(JSON.stringify({ account_id: 42, exp: Math.floor(Date.now() / 1000) + decalage })).toString('base64url');
  return 'x.' + payload + '.y';
}
const faireRes = () => {
  const r = { code: null, corps: null };
  r.status = (n) => { r.code = n; return r; };
  r.json = (o) => { r.corps = o; return r; };
  r.setHeader = () => {};
  r.end = () => r;
  return r;
};

(async () => {
  const refresh = await import('file://' + path.join(RACINE, 'api', 'vinted-refresh.js'));
  const connect = await import('file://' + path.join(RACINE, 'api', 'vinted-connect.js'));

  // ── 1. vinted-refresh : Vinted REFUSE → on ne réécrit PAS le jeton ─────────
  poserFetch({ vintedRefuse: true });
  {
    const res = faireRes();
    await refresh.default({ method: 'GET', query: {}, headers: {} }, res);
    const patchs = ecrites.filter(e => e.method === 'PATCH');
    dit(patchs.length === 0,
      'vinted-refresh : refresh refusé → la ligne du compte n\'est PAS réécrite (bon jeton préservé)',
      patchs.length ? `PATCH écrit ${JSON.stringify(patchs[0].body)}` : '');
    const l = res.corps && Array.isArray(res.corps.summary) ? res.corps.summary.find(s => s.id === '42') : null;
    dit(l && l.action === 'refresh_failed',
      'vinted-refresh : et il le DIT (action=refresh_failed, pas « refreshed »)',
      'action=' + (l && l.action));
  }

  // ── 2. vinted-refresh : Vinted ACCEPTE → on écrit le jeton frais ───────────
  poserFetch({ vintedRefuse: false });
  {
    const res = faireRes();
    await refresh.default({ method: 'GET', query: {}, headers: {} }, res);
    const patchs = ecrites.filter(e => e.method === 'PATCH');
    dit(patchs.length === 1 && patchs[0].body.access_token === 'ACC_FRAIS',
      'vinted-refresh : refresh accepté → le jeton frais est bien persisté',
      'patchs=' + patchs.length + ' acc=' + (patchs[0] && patchs[0].body.access_token));
  }

  // ── 3. vinted-connect : Vinted REFUSE le jeton collé → aucune ligne créée ──
  poserFetch({ vintedRefuse: true });
  {
    const res = faireRes();
    await connect.default({ method: 'POST', query: {}, headers: {}, body: { refreshToken: 'REF_POURRI' } }, res);
    const posts = ecrites.filter(e => e.method === 'POST');
    dit(posts.length === 0,
      'vinted-connect : jeton refusé → AUCUNE ligne vinted_accounts créée (pas de compte fantôme)',
      posts.length ? `POST écrit ${JSON.stringify(posts[0].body)}` : '');
    dit(res.code >= 400 && !(res.corps && res.corps.ok),
      'vinted-connect : et il répond l\'échec, jamais « ok »', `HTTP ${res.code} ${JSON.stringify(res.corps)}`);
  }

  // ── 4. vinted-connect : jeton valide → la ligne est écrite, avec le jeton ──
  poserFetch({ vintedRefuse: false });
  {
    const res = faireRes();
    // access_token frais fourni directement (chemin le plus fiable, pas de refresh)
    await connect.default({ method: 'POST', query: {}, headers: {}, body: { accessToken: jwtExpire(3600) } }, res);
    const posts = ecrites.filter(e => e.method === 'POST');
    dit(posts.length === 1 && posts[0].body[0] && posts[0].body[0].access_token,
      'vinted-connect : jeton valide → la ligne est bien écrite avec son jeton',
      'posts=' + posts.length);
  }

  console.log(ko
    ? `\n${ko} contrôle(s) en échec`
    : "\nTous les contrôles passent — un refresh refusé n'efface jamais un bon jeton, un jeton refusé ne crée aucune ligne."
    + "\n(§6.1 : réaffaiblir — persister malgré l'échec dans vinted-refresh, ou retirer le 401 de vinted-connect — passe ces contrôles au rouge.)");
  process.exit(ko ? 1 : 0);
})();
