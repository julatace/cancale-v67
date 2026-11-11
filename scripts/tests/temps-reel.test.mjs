// (11 nov., temps réel) La veille des lignes du vendeur (src/tempsReel.js).
// Le banc scripts/bancs/temps-reel.cjs juge le vrai navigateur.
// node --test scripts/tests/temps-reel.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { creerVeille, ouvrirCanal, quoiDe, SUJET_CANAL } from '../../src/tempsReel.js';

function horloge(t0 = Date.parse('2026-11-11T12:00:00Z')) {
  const h = { t: t0, timers: [] };
  h.maintenant = () => h.t;
  h.minuteur = (f, ms) => { const x = { f, at: h.t + ms }; h.timers.push(x); return x; };
  h.annuler = (x) => { h.timers = h.timers.filter((y) => y !== x); };
  h.avancer = (ms) => { h.t += ms; for (const x of h.timers.slice().sort((a, b) => a.at - b.at)) if (x.at <= h.t) { h.timers = h.timers.filter((y) => y !== x); x.f(); } };
  return h;
}
const iso = (t) => new Date(t).toISOString();
const ligne = (id, t, rev = 1) => ({ id, updated_at: iso(t), cap: iso(t), rev: String(rev), sup: null, pg: null });

function monter(h, rows) {
  const recus = []; const bornes = [];
  const srv = { rows, panne: false };
  const v = creerVeille({ uid: 'U', maintenant: h.maintenant, minuteur: h.minuteur, annuler: h.annuler,
    lireDepuis: async (x) => { bornes.push(x); return srv.panne ? null : srv.rows.filter((r) => r.updated_at > x || r.cap > x).map((r) => ({ ...r })); },
    diffuser: (d) => recus.push(d) });
  return { v, recus, bornes, srv };
}

test('quoiDe : chaque famille utile, rien pour le bruit', () => {
  assert.deepEqual(quoiDe('harvest_42_orders_sold'), { quoi: 'ventes', uid: '42' });
  assert.deepEqual(quoiDe('harvest_42_orders_purchased'), { quoi: 'achats', uid: '42' });
  assert.deepEqual(quoiDe('harvest_42_listings'), { quoi: 'annonces', uid: '42' });
  assert.deepEqual(quoiDe('harvest_42_txn_99'), { quoi: 'ventes', uid: '42' });
  assert.deepEqual(quoiDe('import_vinted_42'), { quoi: 'import', uid: '42' });
  assert.equal(quoiDe('harvest_42_wreq_api_v2_x'), null);
  assert.equal(quoiDe('harvest_42_seen_urls'), null);
  assert.equal(quoiDe('main'), null);
});

test('1er sondage : ce qui était là avant l’ouverture n’est pas « neuf » ; ce qui change ensuite l’est', async () => {
  const h = horloge(); const t = h.t;
  const m = monter(h, [ligne('harvest_1_orders_sold', t - 60000)]);
  await m.v.sonder();
  assert.equal(m.recus.length, 0);
  h.avancer(25000);
  m.srv.rows[0] = ligne('harvest_1_orders_sold', h.t, 2);
  await m.v.sonder();
  assert.equal(m.recus.length, 1);
  assert.deepEqual(m.recus[0].ids, ['harvest_1_orders_sold']);
  assert.deepEqual(m.recus[0].quoi, [{ quoi: 'ventes', uid: '1' }]);
  // Rien de changé ⇒ rien.
  h.avancer(25000); await m.v.sonder();
  assert.equal(m.recus.length, 1);
});

test('1er sondage : une ligne écrite APRÈS l’ouverture est signalée', async () => {
  const h = horloge(); const m = monter(h, []);
  h.avancer(2000); m.srv.rows.push(ligne('harvest_7_listings', h.t));
  await m.v.sonder();
  assert.equal(m.recus.length, 1);
  assert.deepEqual(m.recus[0].quoi, [{ quoi: 'annonces', uid: '7' }]);
});

test('lecture ratée ⇒ aucun signal, aucune version oubliée', async () => {
  const h = horloge(); const m = monter(h, [ligne('harvest_1_orders_sold', h.t - 1000)]);
  await m.v.sonder();
  m.srv.panne = true; h.avancer(25000);
  const r = await m.v.sonder();
  assert.equal(r.ok, false); assert.equal(m.recus.length, 0);
  assert.equal(m.v._etat().vus, 1);
  m.srv.panne = false; await m.v.sonder();
  assert.equal(m.recus.length, 0, 'version inchangée : rien');
});

test('budget : jamais deux signaux pour une ligne en moins de 10 s ; le second part à la fin du délai', async () => {
  const h = horloge(); const m = monter(h, []);
  await m.v.sonder();
  m.v.recu(ligne('harvest_1_orders_sold', h.t + 1, 1));
  assert.equal(m.recus.length, 1);
  h.avancer(2000); m.v.recu(ligne('harvest_1_orders_sold', h.t, 2));
  h.avancer(1000); m.v.recu(ligne('harvest_1_orders_sold', h.t, 3));
  assert.equal(m.recus.length, 1, 'retenu');
  h.avancer(6999); assert.equal(m.recus.length, 1);
  h.avancer(10); assert.equal(m.recus.length, 2, 'parti, une fois');
  assert.ok(m.recus[1].at - m.recus[0].at >= 10000);
  h.avancer(60000); assert.equal(m.recus.length, 2);
});

test('la fenêtre est bornée (jamais toute la base)', async () => {
  const h = horloge(); const m = monter(h, []);
  await m.v.sonder();
  assert.ok(Date.parse(m.bornes[0]) >= h.t - 10 * 60000 - 1);
});

test('arreter() : plus rien ne part', async () => {
  const h = horloge(); const m = monter(h, []);
  await m.v.sonder(); m.v.arreter();
  m.v.recu(ligne('harvest_1_orders_sold', h.t + 5));
  m.srv.rows.push(ligne('harvest_1_orders_sold', h.t + 5)); await m.v.sonder();
  assert.equal(m.recus.length, 0);
});

// ── Le canal Realtime (protocole Phoenix), sur une fausse prise ───────────────
function fausseWS() {
  const prises = [];
  function WS(url) { this.url = url; this.readyState = 0; this.envoyes = []; prises.push(this); }
  WS.prototype.send = function (t) { this.envoyes.push(JSON.parse(t)); };
  WS.prototype.close = function () { this.readyState = 3; if (this.onclose) this.onclose(); };
  WS.prototype.ouvrir = function () { this.readyState = 1; this.onopen(); };
  WS.prototype.recevoir = function (o) { this.onmessage({ data: JSON.stringify(o) }); };
  return { WS, prises };
}
test('canal : rejoint SON sujet privé avec le jeton ; ne prend que les lignes de SON vendeur', () => {
  const { WS, prises } = fausseWS(); const lignes = [];
  const c = ouvrirCanal({ url: 'https://x.supabase.co', cleApi: 'cle', jeton: () => 'JWT', uid: 'U1', surLigne: (r) => lignes.push(r), WS, intervalle: () => 1, arretIntervalle: () => {} });
  const p = prises[0]; assert.match(p.url, /^wss:\/\/x\.supabase\.co\/realtime\/v1\/websocket\?apikey=cle/);
  p.ouvrir();
  const j = p.envoyes[0];
  assert.equal(j.event, 'phx_join'); assert.equal(j.topic, `realtime:${SUJET_CANAL}U1`);
  assert.equal(j.payload.config.private, true); assert.equal(j.payload.access_token, 'JWT');
  p.recevoir({ topic: j.topic, event: 'phx_reply', ref: j.ref, payload: { status: 'ok' } });
  assert.equal(c.etat(), 'joint');
  p.recevoir({ topic: j.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'ligne', payload: { id: 'harvest_1_orders_sold', owner: 'U1', rev: '2' } } });
  p.recevoir({ topic: j.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'ligne', payload: { id: 'harvest_9_orders_sold', owner: 'AUTRE', rev: '2' } } });
  p.recevoir({ topic: 'realtime:vrm-lignes:AUTRE', event: 'broadcast', payload: { event: 'ligne', payload: { id: 'x', owner: 'U1' } } });
  assert.deepEqual(lignes.map((l) => l.id), ['harvest_1_orders_sold']);
  c.fermer(); assert.equal(c.etat(), 'ferme');
});
test('canal refusé (migration pas posée) ⇒ ne réessaie plus', () => {
  const { WS, prises } = fausseWS(); let relances = 0;
  ouvrirCanal({ url: 'https://x.supabase.co', cleApi: 'cle', jeton: () => 'JWT', uid: 'U1', surLigne: () => {}, WS, minuteur: () => { relances++; return 1; }, intervalle: () => 1, arretIntervalle: () => {} });
  const p = prises[0]; p.ouvrir(); const j = p.envoyes[0];
  p.recevoir({ topic: j.topic, event: 'phx_reply', ref: j.ref, payload: { status: 'error', response: { reason: 'Unauthorized' } } });
  assert.equal(relances, 0); assert.equal(prises.length, 1);
});
