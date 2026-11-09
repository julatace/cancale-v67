// scripts/tests/securite-routes.test.mjs — revue défensive du 9 nov. (multi-vendeurs)
// Chaque défaut corrigé est REJOUÉ sur la vraie route (fausse base, faux réseau).
// Sur le code d'avant (origin/main 9 nov.) les quatre premiers tests sont rouges.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '../..');
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
// Faux réseau : la session A est reconnue ; tout le reste est noté.
function fauxReseau({ vinted = () => new Response('{}', { status: 401 }) } = {}) {
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
    if (u.includes('vinted.')) return vinted(u, opts);
    if (u.includes('/rest/v1/')) return new Response('[]', { status: 200 });
    return new Response('{}', { status: 200 });
  };
  return { appels, rendre: () => { globalThis.fetch = avant; } };
}
process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';
process.env.CRON_SECRET = 'secret-du-cron-fictif';

test('/api/ai : une clé dans le corps sans session ne part PAS chez Anthropic (relais ouvert)', async () => {
  const { default: ai } = await import('../../api/ai.js');
  const net = fauxReseau();
  try {
    const r = reponse();
    await ai({ method: 'POST', query: {}, headers: {}, body: { title: 'x', key: 'sk-ant-volee' } }, r);
    assert.equal(r.statusCode, 401);
    assert.equal(net.appels.filter((x) => x.url.includes('anthropic.com')).length, 0, 'Anthropic appelé sans session');
    // Avec la session, la clé du vendeur sert (rien de cassé pour l'app).
    const r2 = reponse();
    await ai({ method: 'POST', query: {}, headers: { authorization: `Bearer ${SESSION_A}` }, body: { title: 'x', key: 'sk-ant-du-vendeur' } }, r2);
    assert.equal(net.appels.filter((x) => x.url.includes('anthropic.com')).length, 1);
  } finally { net.rendre(); }
});

test('/api/vinted-connect : un jeton fabriqué (exp lointain, account_id d’un autre) n’est jamais rangé', async () => {
  const { default: connect } = await import('../../api/vinted-connect.js');
  const net = fauxReseau();   // Vinted refuse le faux jeton (401)
  try {
    const faux = JWT({ account_id: 424242, exp: Math.floor(Date.now() / 1000) + 86400 * 365 });
    const r = reponse();
    await connect({ method: 'POST', query: {}, headers: { authorization: `Bearer ${SESSION_A}` }, body: { accessToken: faux } }, r);
    const ecritures = net.appels.filter((x) => x.url.includes('/rest/v1/vinted_accounts') && (x.opts.method || 'GET') !== 'GET');
    assert.equal(ecritures.length, 0, 'le compte Vinted d’un autre a été rangé chez A');
    assert.equal(r.statusCode, 401);
  } finally { net.rendre(); }
  // Un vrai jeton (Vinted rend le profil) : rangé.
  const net2 = fauxReseau({ vinted: () => new Response(JSON.stringify({ user: { id: 9, login: 'shop_a' } }), { status: 200 }) });
  try {
    const vrai = JWT({ account_id: 777, exp: Math.floor(Date.now() / 1000) + 3600 });
    const r = reponse();
    await connect({ method: 'POST', query: {}, headers: { authorization: `Bearer ${SESSION_A}` }, body: { accessToken: vrai } }, r);
    assert.equal(r.statusCode, 200);
    const ecrit = net2.appels.find((x) => x.url.includes('/rest/v1/vinted_accounts') && x.opts.method === 'POST');
    assert.ok(ecrit && JSON.parse(ecrit.opts.body)[0].owner === A && JSON.parse(ecrit.opts.body)[0].vinted_user_id === '777');
  } finally { net2.rendre(); }
});

test('/api/relais : lat/lon ne peuvent pas ajouter de paramètres à l’adresse de Nominatim', async () => {
  const { default: relais } = await import('../../api/relais.js');
  const net = fauxReseau();
  try {
    const r = reponse();
    await relais({ method: 'GET', query: { lat: '48.1&q=injecte', lon: '-1.6' }, headers: { authorization: `Bearer ${SESSION_A}` } }, r);
    const n = net.appels.filter((x) => x.url.includes('nominatim'));
    assert.ok(n.every((x) => !x.url.includes('injecte')), 'paramètre injecté dans Nominatim : ' + n.map((x) => x.url).join(' '));
    const r2 = reponse();
    await relais({ method: 'GET', query: { lat: '48.11', lon: '-1.68' }, headers: { authorization: `Bearer ${SESSION_A}` } }, r2);
    assert.ok(net.appels.some((x) => x.url.includes('nominatim') && x.url.includes('lat=48.11&lon=-1.68')));
  } finally { net.rendre(); }
});

test('/api/ship-reminders : la clé du cron se compare en temps constant', () => {
  const src = fs.readFileSync(path.join(RACINE, 'api/ship-reminders.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/auth\s*!==\s*`Bearer \$\{secret\}`/.test(src), 'comparaison `!==` de la clé du cron');
  assert.ok(/timingSafeEqual\([^)]*auth/.test(src), 'timingSafeEqual absent');
});

test('/api/ship-reminders : mauvaise clé ⇒ 401, aucune lecture', async () => {
  const { default: cron } = await import('../../api/ship-reminders.js');
  const net = fauxReseau();
  try {
    const r = reponse();
    await cron({ method: 'GET', query: {}, headers: { authorization: 'Bearer secret-du-cron-fictiX' } }, r);
    assert.equal(r.statusCode, 401);
    assert.equal(net.appels.filter((x) => x.url.includes('/rest/v1/')).length, 0);
  } finally { net.rendre(); }
});
