import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';

const owner = '11111111-1111-4111-8111-111111111111';
const here = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const foreign = '44444444-4444-4444-8444-444444444444';
const token = 'banc.' + Buffer.from(JSON.stringify({ session_id: here })).toString('base64url') + '.banc';
const previousKey = process.env.SUPABASE_SERVICE_KEY;
process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';
const { default: handler, config } = await import('../../api/compte.js');
if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_KEY;
else process.env.SUPABASE_SERVICE_KEY = previousKey;

async function call(body, sessions = [{ id: other, user_id: owner, user_agent: 'iPhone Version/18 Safari/600' }]) {
  const originalFetch = globalThis.fetch;
  const previous = process.env.SUPABASE_SERVICE_KEY;
  process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(url);
    calls.push({ path: u.pathname, body: init.body ? JSON.parse(init.body) : null });
    if (u.pathname === '/auth/v1/user') return Response.json({ id: owner });
    if (u.pathname === '/rest/v1/rpc/vrm_sessions_de') return Response.json(sessions);
    if (u.pathname === '/rest/v1/rpc/vrm_fermer_session') return Response.json(1);
    throw new Error('Aucun accès réel permis dans ce test');
  };
  const bytes = Buffer.from(body);
  const req = Readable.from([bytes.subarray(0, 9), bytes.subarray(9)]);
  Object.assign(req, { method: 'POST', query: { mode: 'appareils' }, headers: { authorization: 'Bearer ' + token } });
  const res = { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  try { await handler(req, res); return { status: res.statusCode, body: res.body, calls }; }
  finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_KEY;
    else process.env.SUPABASE_SERVICE_KEY = previous;
  }
}

test('le vrai handler lit le flux JSON avec bodyParser désactivé et ferme seulement la session du vendeur vérifié', async () => {
  assert.equal(config.api.bodyParser, false);
  const r = await call(JSON.stringify({ session: other, userId: foreign }));
  assert.equal(r.status, 200);
  assert.equal(r.body.ferme, other);
  assert.deepEqual(r.calls.find(c => c.path.endsWith('/vrm_fermer_session')).body, { p_user: owner, p_id: other });
});

test('une session étrangère ou cet appareil ne peut pas être fermé', async () => {
  for (const [session, expected] of [[foreign, 404], [here, 409]]) {
    const r = await call(JSON.stringify({ session }));
    assert.equal(r.status, expected);
    assert.equal(r.calls.some(c => c.path.endsWith('/vrm_fermer_session')), false);
  }
});

test('un JSON invalide ne provoque aucune modification', async () => {
  for (const body of ['{', 'null', '[]', '"x"']) {
    const r = await call(body);
    assert.equal(r.status, 400);
    assert.equal(r.calls.some(c => c.path.startsWith('/rest/')), false);
  }
});
