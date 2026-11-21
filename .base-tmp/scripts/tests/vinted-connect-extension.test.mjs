// scripts/tests/vinted-connect-extension.test.mjs — défaut #5 (revue sécurité du 9 nov.)
// La route qui relie un compte Vinted NEUF une fois la migration 029 posée
// (`POST /api/vinted-connect { source:'extension' }`), EXÉCUTÉE contre une
// fausse base et un faux Vinted. Rien n'est rangé sans : session, aucun autre
// compte VRM sur ce compte Vinted, et Vinted qui accepte le jeton. « Pas su »
// (Vinted muet, base muette) n'écrit rien. Jamais de renouvellement du jeton
// pour l'extension (il déconnecterait l'onglet).
// `VRM_ROUTE=chemin` : une autre copie de la route (preuve sur le code d'avant).
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const ROUTE = process.env.VRM_ROUTE ? path.resolve(process.env.VRM_ROUTE) : path.resolve(ICI, '../../api/vinted-connect.js');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const JWT = (o) => 'e30.' + Buffer.from(JSON.stringify(o)).toString('base64url') + '.sig';
const SESSION_A = JWT({ sub: A });
const JETON = JWT({ account_id: 777, exp: Math.floor(Date.now() / 1000) + 3600 });
process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';

function reponse() {
  const r = { statusCode: 200, corps: undefined, entetes: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (j) => { r.corps = j; return r; };
  r.send = (j) => { r.corps = j; return r; };
  r.end = () => r;
  r.setHeader = (k, v) => { r.entetes[k.toLowerCase()] = v; };
  return r;
}
// `proprietaires` : ce que la base rend pour `vinted_user_id=eq.777&select=owner`.
function reseau({ vinted = () => new Response(JSON.stringify({ user: { id: 9, login: 'shop_a' } }), { status: 200 }), proprietaires = [], lectureKO = false, acces = true } = {}) {
  const appels = [];
  const avant = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    appels.push({ url: u, methode: opts.method || 'GET', corps: opts.body });
    if (u.includes('/auth/v1/user')) {
      const h = opts.headers || {};
      return (h.Authorization || h.authorization) === `Bearer ${SESSION_A}`
        ? new Response(JSON.stringify({ id: A, email: 'a@exemple.fr', email_confirmed_at: '2026-01-01' }), { status: 200 })
        : new Response('{}', { status: 401 });
    }
    if (u.includes('/rpc/vrm_acces_pour')) return new Response(JSON.stringify(acces), { status: 200 });
    if (u.includes('vinted.')) return vinted(u, opts);
    if (u.includes('/rest/v1/vinted_accounts') && (opts.method || 'GET') === 'GET') {
      if (lectureKO) return new Response('oups', { status: 500 });
      return new Response(JSON.stringify(proprietaires.map((o) => ({ owner: o }))), { status: 200 });
    }
    if (u.includes('/rest/v1/rpc/vrm_vinted_relier')) return new Response('{"code":"PGRST202"}', { status: 404 });   // 042 pas passée (la forme de PostgREST)
    if (u.includes('/rest/v1/')) return new Response('', { status: 201 });
    return new Response('{}', { status: 200 });
  };
  const ecritComptes = () => appels.filter((x) => x.url.includes('/rest/v1/vinted_accounts') && x.methode !== 'GET');
  return { appels, ecritComptes, rendre: () => { globalThis.fetch = avant; } };
}
const appeler = async (corps, { session = SESSION_A, origine = 'chrome-extension://abcdefghijklmnop', methode = 'POST' } = {}) => {
  const { default: route } = await import(pathToFileURL(ROUTE).href);
  const r = reponse();
  await route({ method: methode, query: {}, headers: { authorization: `Bearer ${session}`, origin: origine }, body: corps }, r);
  return r;
};
const EXT = (o = {}) => Object.assign({ source: 'extension', accessToken: JETON, refreshToken: 'r-onglet', anonId: 'anon', domain: 'www.vinted.fr' }, o);

test('extension : Vinted accepte le jeton, personne d’autre ne porte ce compte ⇒ rangé chez le vendeur de la SESSION', async () => {
  const n = reseau();
  try {
    const r = await appeler(EXT({ owner: B }));
    assert.equal(r.statusCode, 200, JSON.stringify(r.corps));
    const w = n.ecritComptes();
    assert.equal(w.length, 1);
    const ligne = JSON.parse(w[0].corps)[0];
    assert.equal(ligne.owner, A, 'le propriétaire vient du jeton, jamais du corps');
    assert.equal(ligne.vinted_user_id, '777');
    assert.equal(ligne.login, 'shop_a');
    assert.ok(!('tokens' in r.corps), 'l’extension a ses jetons : ils ne repartent pas');
    assert.equal(r.entetes['access-control-allow-origin'], 'chrome-extension://abcdefghijklmnop');
  } finally { n.rendre(); }
});

test('déjà relié à un AUTRE compte VRM ⇒ 409 « contacte le support », rien rangé, litige noté chez le demandeur, Vinted pas appelé', async () => {
  const n = reseau({ proprietaires: [B] });
  try {
    const r = await appeler(EXT());
    assert.equal(r.statusCode, 409);
    assert.equal(r.corps.raison, 'deja_relie');
    assert.match(r.corps.error, /déjà relié à un autre compte VRM — contacte le support/);
    assert.equal(n.ecritComptes().length, 0);
    assert.equal(n.appels.filter((x) => x.url.includes('vinted.fr')).length, 0);
    const litige = n.appels.find((x) => x.url.includes('/rest/v1/app_data') && x.methode === 'POST');
    assert.ok(litige, 'litige non noté');
    const l = JSON.parse(litige.corps)[0];
    assert.equal(l.owner, A); assert.equal(l.id, 'vrm_vinted_litige_777');
    assert.ok(!JSON.stringify(l).includes(B) && !JSON.stringify(l).includes(JETON), 'le litige ne nomme pas l’autre propriétaire et ne garde aucun jeton');
  } finally { n.rendre(); }
});

test('Vinted muet (403 anti-robot, réseau) ⇒ 503, rien rangé (« pas su » ne vaut pas « oui »)', async () => {
  for (const vinted of [() => new Response('<html>blocked</html>', { status: 403 }), () => { throw new Error('réseau'); }, () => new Response('{}', { status: 502 })]) {
    const n = reseau({ vinted });
    try {
      const r = await appeler(EXT());
      assert.equal(r.statusCode, 503, JSON.stringify(r.corps));
      assert.equal(r.corps.raison, 'vinted_muet');
      assert.equal(n.ecritComptes().length, 0);
    } finally { n.rendre(); }
  }
});

test('jeton refusé par Vinted (401) ⇒ 401, rien rangé', async () => {
  const n = reseau({ vinted: () => new Response('{}', { status: 401 }) });
  try {
    const r = await appeler(EXT());
    assert.equal(r.statusCode, 401);
    assert.equal(n.ecritComptes().length, 0);
  } finally { n.rendre(); }
});

test('extension avec un jeton expiré ⇒ jamais de renouvellement côté serveur (l’onglet resterait déconnecté)', async () => {
  const n = reseau();
  try {
    const r = await appeler(EXT({ accessToken: JWT({ account_id: 777, exp: Math.floor(Date.now() / 1000) - 10 }) }));
    assert.equal(r.statusCode, 400);
    assert.equal(r.corps.raison, 'jeton_expire');
    assert.equal(n.appels.filter((x) => /auth\/refresh/.test(x.url)).length, 0, 'refresh_token de l’onglet consommé par le serveur');
    assert.equal(n.ecritComptes().length, 0);
  } finally { n.rendre(); }
});

test('base muette à la lecture des propriétaires ⇒ 503, rien rangé', async () => {
  const n = reseau({ lectureKO: true });
  try {
    const r = await appeler(EXT());
    assert.equal(r.statusCode, 503);
    assert.equal(n.ecritComptes().length, 0);
  } finally { n.rendre(); }
});

test('sans session ⇒ 401 ; abonnement coupé ⇒ 402 ; préalable OPTIONS d’une extension ⇒ 204 (Orion)', async () => {
  let n = reseau();
  try {
    const r = await appeler(EXT(), { session: 'faux' });
    assert.equal(r.statusCode, 401);
    assert.equal(n.ecritComptes().length, 0);
    const o = await appeler(undefined, { methode: 'OPTIONS' });
    assert.equal(o.statusCode, 204);
  } finally { n.rendre(); }
  n = reseau({ acces: false });
  try {
    const { oublierAcces } = await import(pathToFileURL(path.resolve(ICI, '../../api/_lib/abonnement.js')).href);
    oublierAcces();
    const r = await appeler(EXT());
    assert.equal(r.statusCode, 402);
    assert.equal(n.ecritComptes().length, 0);
  } finally { n.rendre(); }
});
