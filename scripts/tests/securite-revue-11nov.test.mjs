// scripts/tests/securite-revue-11nov.test.mjs — revue de sécurité adverse du 11 nov.
// Chaque défaut corrigé est REJOUÉ sur la vraie route (fausse base, faux réseau),
// rouge sur origin/main (git archive + ce fichier copié dedans), vert après.
//   node --test scripts/tests/securite-revue-11nov.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const A = '11111111-1111-4111-8111-111111111111';
const JWT = (o) => 'e30.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.sig';
const SESSION_A = JWT({ sub: A });

function reponse() {
  const r = { statusCode: 200, corps: undefined, entetes: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (j) => { r.corps = j; return r; };
  r.send = (j) => { r.corps = j; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.entetes[k.toLowerCase()] = v; };
  return r;
}
// Faux réseau : la session A est reconnue ; `rest(u, opts)` sert la base ; le reste est noté.
function fauxReseau({ rest = () => new Response('[]', { status: 200 }), autre = () => new Response('{}', { status: 200 }) } = {}) {
  const appels = [];
  const avant = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    appels.push({ url: u, opts });
    if (u.includes('/auth/v1/user')) {
      const h = opts.headers || {};
      return (h.Authorization || h.authorization) === `Bearer ${SESSION_A}`
        ? new Response(JSON.stringify({ id: A, email: 'a@exemple.fr', email_confirmed_at: '2026-01-01' }), { status: 200 })
        : new Response('{}', { status: 401 });
    }
    if (u.includes('/rpc/vrm_acces_pour')) return new Response('true', { status: 200 });
    if (u.includes('.supabase.co/rest/v1/')) return rest(u, opts);
    return autre(u, opts);
  };
  return { appels, rendre: () => { globalThis.fetch = avant; } };
}
process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';

test('/api/vinted-refresh : la colonne `domain` (écrite par le vendeur) ne choisit jamais l’hôte appelé', async () => {
  const { default: refresh } = await import('../../api/vinted-refresh.js');
  const expire = JWT({ exp: Math.floor(Date.now() / 1000) - 60 });
  const comptes = ['www.attaquant.example/x?', 'www.127.0.0.1.nip.io', 'www.vinted.fr.attaquant.example', 'www.vinted.it']
    .map((domain, i) => ({ owner: A, vinted_user_id: String(100 + i), domain, access_token: expire, refresh_token: 'r' }));
  const net = fauxReseau({ rest: (u, o) => new Response((o.method || 'GET') === 'GET' ? JSON.stringify(comptes) : '', { status: (o.method || 'GET') === 'GET' ? 200 : 204 }) });
  try {
    const r = reponse();
    await refresh({ method: 'GET', query: {}, headers: { authorization: `Bearer ${SESSION_A}` } }, r);
    const sortants = net.appels.filter((x) => !x.url.includes('.supabase.co/'));
    assert.equal(sortants.length, 4, 'un renouvellement par compte');
    for (const x of sortants) {
      const h = new URL(x.url).hostname;
      assert.match(h, /^www\.vinted\.(fr|it)$/, `hôte appelé : ${h}`);
      assert.notEqual(x.opts.redirect || 'follow', 'follow', 'redirection suivie');
      assert.ok(x.opts.signal, 'aucun délai');
    }
    assert.equal(sortants.filter((x) => new URL(x.url).hostname === 'www.vinted.it').length, 1, 'un site Vinted connu reste servi');
  } finally { net.rendre(); }
});
