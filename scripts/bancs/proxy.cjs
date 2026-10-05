// ═══════════════════════════════════════════════════════════════════════════
// BANC : /api/vinted-proxy n'est plus un relais ouvert — la route EXÉCUTÉE
//        node scripts/bancs/proxy.cjs
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — une route n'est vérifiée que si un banc l'EXÉCUTE.
// Jusqu'au 4 octobre, n'importe qui pouvait envoyer à ce proxy un jeton Vinted
// et une adresse Vinted quelconque, avec n'importe quelle méthode (DELETE
// compris) : la requête partait de l'IP de VRM. Ce banc l'attaque comme le
// ferait un inconnu, puis vérifie l'autre sens (le vendeur, lui, lit bien).
//   1. sans session VRM : 401, AUCUNE requête à Vinted, aucune lecture de base ;
//   2. un geste (DELETE, POST, un corps) : refusé, rien ne part ;
//   3. une adresse que l'app ne lit pas : refusée, rien ne part ;
//   4. un compte qui n'est pas à lui : 403, rien ne part ;
//   5. la base ne répond pas : 503 — on ne relaie pas sur une mesure ratée ;
//   6. son compte, une lecture permise : la requête part AVEC LE JETON DE LA
//      BASE, jamais celui envoyé par le navigateur, et la base est lue avec SA
//      session et filtrée sur lui ;
//   7. jeton expiré : le relais rafraîchit, RANGE lui-même les jetons neufs en
//      base (avec la session du vendeur) et le dit à l'app — une écriture
//      refusée est dite (`persiste: false`), jamais supposée.
// Aucune donnée réelle : tout est inventé, le banc vit dans le dépôt.
const path = require('path');
const RACINE = process.env.RACINE || path.join(__dirname, '..', '..');

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '  ✅ ' : '  ❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, String(e && e.message || e).slice(0, 160)); } };

const VENDEUR = '22222222-2222-4222-8222-222222222222';
const SESSION = { authorization: 'Bearer ss.tt.uu' };
const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

let vinted = [], lectures = [], ecritures = [];
function poserFetch({ base = 'ok', expire = false, ecriture = 'ok' } = {}) {
  vinted = []; lectures = []; ecritures = [];
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    const h = opts.headers || {};
    if (/\/auth\/v1\/user/.test(u)) return String(h.Authorization || '') === 'Bearer ss.tt.uu' ? J({ id: VENDEUR, email: 'v@exemple.test' }) : J({ msg: 'invalid' }, 401);
    if (/\/rest\/v1\/app_data\?select=owner/.test(u)) return J([{ owner: VENDEUR }]);
    if (/\/rest\/v1\/vinted_accounts/.test(u) && String(opts.method || 'GET').toUpperCase() === 'PATCH') {
      ecritures.push({ u, auth: String(h.Authorization || ''), corps: JSON.parse(opts.body || '{}') });
      if (ecriture === 'panne') return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
      return J(/vinted_user_id=eq\.42(&|$)/.test(u) ? [{ vinted_user_id: '42' }] : []);
    }
    if (/\/rest\/v1\/vinted_accounts/.test(u)) {
      lectures.push({ u, auth: String(h.Authorization || '') });
      if (base === 'panne') return new Response('<html>522</html>', { status: 522, headers: { 'content-type': 'text/html' } });
      // Le compte 42 est à lui ; tout autre identifiant : RLS ne rend rien.
      if (/vinted_user_id=eq\.42(&|$)/.test(u)) return J([{ access_token: 'JETON_BASE', refresh_token: 'REF_BASE', anon_id: 'anon', csrf_token: 'csrf', domain: 'www.vinted.fr' }]);
      return J([]);
    }
    if (/vinted\./.test(u)) {
      vinted.push({ u, method: String(opts.method || 'GET').toUpperCase(), cookie: String(h.Cookie || ''), auth: String(h.Authorization || '') });
      if (/\/web\/api\/auth\/refresh$/.test(u)) return J({ access_token: 'JETON_NEUF', refresh_token: 'REF_NEUF' });
      if (expire && /JETON_BASE/.test(String(h.Authorization || ''))) return new Response('expired', { status: 401 });
      return J({ user: { id: 7, login: 'moncompte' } });
    }
    return J([]);
  };
}
const faireRes = () => {
  const r = { code: null, corps: null };
  r.status = (n) => { r.code = n; return r; };
  r.json = (o) => { r.corps = o; return r; };
  r.setHeader = () => {}; r.end = () => r;
  return r;
};

(async () => {
  const route = await import('file://' + path.join(RACINE, 'api', 'vinted-proxy.js'));
  const appel = async (headers, body) => { const r = faireRes(); await route.default({ method: 'POST', headers, body }, r); return r; };
  // Ce qu'un inconnu enverrait : SON jeton (volé), une adresse de son choix.
  const attaque = { token: 'JETON_VOLE', refreshToken: 'REF_VOLE', endpoint: '/api/v2/users/current', uid: '42' };

  console.log('\n── Un inconnu, sans session VRM');
  await essaie('sans session', async () => {
    poserFetch();
    const r = await appel({}, attaque);
    dit(r.code === 401, 'sans session : 401', `HTTP ${r.code}`);
    dit(vinted.length === 0, 'et AUCUNE requête ne part chez Vinted', `${vinted.length} requête(s)`);
    dit(lectures.length === 0, 'et aucun compte n’est lu en base', `${lectures.length} lecture(s)`);
  });

  console.log('\n── Avec une session, mais un geste ou une adresse non permise');
  await essaie('gestes', async () => {
    for (const [nom, corps] of [
      ['DELETE d’une annonce', { ...attaque, method: 'DELETE', endpoint: '/api/v2/items/1' }],
      ['POST d’une réponse', { ...attaque, method: 'POST', endpoint: '/api/v2/conversations/1/replies', body: { reply: { body: 'x' } } }],
      ['GET avec un corps', { ...attaque, body: { a: 1 } }],
      ['adresse que l’app ne lit pas', { ...attaque, endpoint: '/api/v2/items/1' }],
      ['remontée de chemin', { ...attaque, endpoint: '/api/v2/users/current/../../items/1' }],
    ]) {
      poserFetch();
      const r = await appel(SESSION, corps);
      dit(r.code === 403 && vinted.length === 0, `${nom} : refusé, rien ne part chez Vinted`, `HTTP ${r.code} · ${vinted.length} requête(s)`);
    }
  });

  console.log('\n── Un compte qui n’est pas le sien');
  await essaie('autre compte', async () => {
    poserFetch();
    const r = await appel(SESSION, { ...attaque, uid: '99' });
    dit(r.code === 403 && vinted.length === 0, 'compte d’un autre vendeur : 403, rien ne part', `HTTP ${r.code} · ${vinted.length} requête(s)`);
  });

  console.log('\n── La base ne répond pas');
  await essaie('base en panne', async () => {
    poserFetch({ base: 'panne' });
    const r = await appel(SESSION, attaque);
    dit(r.code === 503 && vinted.length === 0, '522 : 503, on ne relaie pas sur une lecture ratée', `HTTP ${r.code} · ${vinted.length} requête(s)`);
  });

  console.log('\n── Le vendeur, sur SON compte, une lecture permise (l’autre sens)');
  await essaie('lecture légitime', async () => {
    poserFetch();
    const r = await appel(SESSION, attaque);
    dit(r.code === 200 && r.corps && r.corps.ok === true, 'la lecture passe et rend la réponse de Vinted', `HTTP ${r.code} · ok=${r.corps && r.corps.ok}`);
    const v = vinted[0] || {};
    dit(vinted.length === 1 && v.method === 'GET', 'une seule requête, en GET', `${vinted.length} · ${v.method}`);
    dit(/JETON_BASE/.test(v.auth) && !/JETON_VOLE/.test(v.auth + v.cookie), 'avec le jeton lu en BASE, jamais celui envoyé par le navigateur', v.auth.slice(0, 40));
    const l = lectures[0] || {};
    dit(l.auth === 'Bearer ss.tt.uu', 'la base est lue avec SA session (RLS), pas la clé de service', l.auth);
    dit(new RegExp('owner=eq\\.' + VENDEUR).test(l.u || ''), 'et filtrée sur lui', (l.u || '').slice(-80));
  });

  console.log('\n── Jeton expiré');
  await essaie('refresh', async () => {
    poserFetch({ expire: true });
    const r = await appel(SESSION, attaque);
    dit(r.code === 200 && r.corps && r.corps.ok === true, 'le relais rafraîchit puis rejoue la lecture', `HTTP ${r.code} · ok=${r.corps && r.corps.ok}`);
    dit(r.corps && r.corps.refreshed && r.corps.refreshed.access_token === 'JETON_NEUF', 'et rend les jetons neufs à l’app', JSON.stringify(r.corps && r.corps.refreshed));
    // Vinted vient de CONSOMMER l'ancien refresh_token : le relais, qui relit
    // les jetons en base à chaque appel, doit ranger les neufs LUI-MÊME.
    const e = ecritures[0] || {};
    dit(ecritures.length === 1 && e.corps && e.corps.refresh_token === 'REF_NEUF' && e.corps.access_token === 'JETON_NEUF',
      'le relais range lui-même les jetons neufs en base', `${ecritures.length} écriture(s) · ${JSON.stringify(e.corps || {}).slice(0, 80)}`);
    dit(e.auth === 'Bearer ss.tt.uu' && new RegExp('vinted_user_id=eq\\.42').test(e.u || '') && new RegExp('owner=eq\\.' + VENDEUR).test(e.u || ''),
      'avec SA session, sur SON compte, filtré sur lui', (e.u || '').slice(-90));
    dit(r.corps && r.corps.refreshed && r.corps.refreshed.persiste === true, 'et dit à l’app que c’est rangé (persiste: true)');
  });
  await essaie('refresh, écriture refusée', async () => {
    poserFetch({ expire: true, ecriture: 'panne' });
    const r = await appel(SESSION, attaque);
    dit(r.code === 200 && r.corps && r.corps.ok === true, 'écriture des jetons refusée : la lecture passe quand même', `HTTP ${r.code}`);
    dit(r.corps && r.corps.refreshed && r.corps.refreshed.persiste === false, 'et l’app est prévenue que rien n’est rangé (persiste: false) — jamais un succès supposé', JSON.stringify(r.corps && r.corps.refreshed));
  });

  console.log(ko ? `\n❌ vinted-proxy : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ vinted-proxy : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})();
