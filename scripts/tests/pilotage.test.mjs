// Le tableau de bord du propriétaire (9 nov.) : la VRAIE route `/api/compte?mode=pilotage`
// exécutée contre un faux Supabase (REST + Auth admin) et un faux Stripe.
// Lancer : node --test scripts/tests/pilotage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const PROPRIO = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';
const C = '44444444-4444-4444-8444-444444444444';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const JETON = 'banc.' + Buffer.from('{}').toString('base64url') + '.banc';
const MAINTENANT = Date.parse('2026-11-09T10:00:00Z');
const jour = (k) => new Date(MAINTENANT - k * 864e5).toISOString();

process.env.SUPABASE_SERVICE_KEY = 'cle-service-fictive';
const { default: handler } = await import('../../api/compte.js');

// Les e-mails des comptes : ils ne doivent JAMAIS ressortir.
const COMPTES = [
  { id: PROPRIO, email: 'julien@proprio.fr', created_at: jour(200), last_sign_in_at: jour(0) },
  { id: A, email: 'alice.vendeuse@exemple.fr', created_at: jour(40), last_sign_in_at: jour(20) },
  { id: B, email: 'bob@exemple.fr', created_at: jour(10), last_sign_in_at: jour(9) },
  { id: C, email: 'chloe@exemple.fr', created_at: jour(100), last_sign_in_at: jour(80) },
];

// Un faux PostgREST qui applique le filtre `owner=not.in.(…)` comme la vraie base.
function filtrer(rows, u) {
  const o = u.searchParams.get('owner');
  if (o && o.startsWith('not.in.(')) { const ex = o.slice(8, -1).split(','); return rows.filter((r) => !ex.includes(r.owner)); }
  if (o && o.startsWith('eq.')) return rows.filter((r) => r.owner === o.slice(3));
  return rows;
}
function fauxMonde({ moi = PROPRIO, stripe = null, pannes = {}, histo = null } = {}) {
  const appels = [];
  const ecrits = [];
  const tables = {
    vu: [{ owner: A, jour: '2026-11-07' }, { owner: PROPRIO, jour: '2026-11-09' }],
    appareils: [{ owner: C, at: jour(15) }],
    abonnements: [
      { owner: A, statut: 'active', annule_fin_periode: true, client_stripe: 'cus_A', maj: jour(30) },
      { owner: B, statut: 'trialing', annule_fin_periode: false, client_stripe: 'cus_B', maj: jour(2) },
      { owner: C, statut: 'canceled', annule_fin_periode: false, client_stripe: 'cus_C', maj: jour(3) },
      { owner: PROPRIO, statut: 'active', annule_fin_periode: false, client_stripe: 'cus_P', maj: jour(3) },
    ],
    essais: [{ owner: A, cree: jour(39) }, { owner: B, cree: jour(2) }, { owner: C, cree: jour(90) }, { owner: PROPRIO, cree: jour(5) }],
    notes: [
      { owner: A, note: '4', mot: 'Super, écris-moi à alice.vendeuse@exemple.fr ou au 06 12 34 56 78', at: jour(1) },
      { owner: C, note: '2', mot: null, at: jour(4) },
      { owner: PROPRIO, note: '5', mot: 'moi-même', at: jour(1) },
    ],
  };
  const fetcher = async (url, init = {}) => {
    const u = new URL(url);
    appels.push(u.pathname + u.search);
    if (u.hostname === 'api.stripe.com') {
      if (!stripe || pannes.stripe) return Response.json({ error: { message: 'panne' } }, { status: 500 });
      return Response.json({ data: stripe, has_more: false });
    }
    if (u.pathname === '/auth/v1/user') return Response.json({ id: moi, email: 'quelquun@exemple.fr' });
    if (u.pathname === '/auth/v1/admin/users') return pannes.comptes ? new Response('x', { status: 500 }) : Response.json({ users: COMPTES });
    const id = u.searchParams.get('id') || '';
    if (u.pathname === '/rest/v1/vrm_reglages') return Response.json([]);
    if (u.pathname === '/rest/v1/abonnements') return pannes.abonnements ? new Response('x', { status: 503 }) : Response.json(filtrer(tables.abonnements, u));
    if (u.pathname === '/rest/v1/essais_gratuits') return Response.json(tables.essais);
    if (u.pathname === '/rest/v1/app_data') {
      if (init.method === 'POST' || init.method === 'PATCH') { const corps = JSON.parse(init.body); ecrits.push({ methode: init.method, corps }); return Response.json([Array.isArray(corps) ? corps[0] : corps]); }
      if (id === 'eq.vrm_vu') return Response.json(filtrer(tables.vu, u));
      if (id === 'like.ext_appareil_*') return Response.json(filtrer(tables.appareils, u));
      if (id === 'eq.vrm_satisfaction') return Response.json(filtrer(tables.notes, u).map(({ note, mot, at }) => ({ note, mot, at })));
      if (id === 'eq.statut_sondes') return Response.json(pannes.sondes ? [] : [{ data: { at: jour(0), composants: { emails: { etat: 'degrade', incident: { debut: jour(0.1) } } }, incidents: [{ composant: 'base', debut: jour(3), fin: jour(2.9), dureeMin: 12 }] } }]);
      if (id === 'like.plantages_terrain_*') return Response.json([{ id: 'plantages_terrain_2026-11-08', data: { types: { k1: { message: 'x', n: 3, garde: 1, ecrans: {}, versions: {} } } } }]);
      if (id === 'eq.pilotage_historique') return pannes.histo ? new Response('x', { status: 500 }) : Response.json(histo ? [{ data: histo }] : []);
    }
    throw new Error('Appel non prévu : ' + u.pathname + u.search);
  };
  return { fetcher, appels, ecrits };
}

async function appeler(monde, env = {}) {
  const avant = { fetch: globalThis.fetch, now: Date.now, env: { ...process.env } };
  globalThis.fetch = monde.fetcher;
  Date.now = () => MAINTENANT;
  Object.assign(process.env, { SUPABASE_SERVICE_KEY: 'cle-service-fictive', VRM_OWNER_UID: PROPRIO }, env);
  if (!env.STRIPE_SECRET_KEY) delete process.env.STRIPE_SECRET_KEY;
  const req = { method: 'GET', query: { mode: 'pilotage' }, headers: { authorization: 'Bearer ' + JETON } };
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end() { return this; } };
  try { await handler(req, res); return { status: res.statusCode, body: res.body }; }
  finally { globalThis.fetch = avant.fetch; Date.now = avant.now; for (const k of Object.keys(process.env)) if (!(k in avant.env)) delete process.env[k]; Object.assign(process.env, avant.env); }
}

const sansIdentite = (body) => {
  const t = JSON.stringify(body);
  assert.ok(!/@/.test(t), 'aucune adresse e-mail ne sort : ' + t.match(/[^"]*@[^"]*/));
  for (const id of [A, B, C, PROPRIO]) assert.ok(!t.includes(id), 'aucun identifiant de vendeur ne sort');
  assert.ok(!/06 12 34/.test(t), 'le numéro tapé dans un mot est masqué');
  assert.ok(!t.includes('cus_'), 'aucun client Stripe ne sort');
};

test('un vendeur qui n’est pas le propriétaire est refusé (403) et rien n’est lu', async () => {
  const m = fauxMonde({ moi: A });
  const r = await appeler(m);
  assert.equal(r.status, 403);
  assert.equal(r.body.ok, false);
  assert.ok(!m.appels.some((p) => p.startsWith('/auth/v1/admin') || p.startsWith('/rest/v1/app_data') || p.startsWith('/rest/v1/abonnements')), 'la clé de service ne lit rien avant la garde');
});

test('sans session : 401', async () => {
  const m = fauxMonde();
  const req = { method: 'GET', query: { mode: 'pilotage' }, headers: {} };
  const res = { statusCode: 200, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  const avant = globalThis.fetch; globalThis.fetch = m.fetcher;
  try { await handler(req, res); } finally { globalThis.fetch = avant; }
  assert.equal(res.statusCode, 401);
});

test('propriétaire sans Stripe : totaux justes, « — Stripe pas branché », aucune donnée personnelle', async () => {
  const m = fauxMonde();
  const r = await appeler(m);
  assert.equal(r.status, 200);
  const b = r.body;
  sansIdentite(b);
  assert.equal(b.inscrits.total, 3, 'le propriétaire ne compte pas');
  assert.equal(b.inscrits.nouveaux30, 1);
  assert.equal(b.inscrits.courbe.length, 90);
  assert.equal(b.inscrits.courbe.at(-1).n, 3);
  // A : vu le 7 nov. (app) ⇒ actif 7 j ; C : extension il y a 15 j ⇒ actif 30 j ; B : connecté il y a 9 j ⇒ 30 j.
  assert.deepEqual(b.actifs, { j7: 1, j30: 3 });
  assert.equal(b.revenus.etat, 'stripe-absent');
  assert.equal(b.revenus.mensuelCentimes, undefined, 'aucun montant inventé sans Stripe');
  assert.deepEqual({ ...b.abonnes, parPlan: undefined }, { total: 1, impayes: 0, resiliationsProgrammees: 1, parPlan: undefined });
  assert.deepEqual(b.essais, { enCours: 1, finis: 2, convertis: 1 });
  assert.deepEqual(b.desabonnements, { n: 1, source: 'base' });
  assert.equal(b.incidents.ouverts.length, 1);
  assert.equal(b.incidents.fermes30, 1);
  assert.deepEqual(b.plantages, { types: 1, n: 3, tombes: 1 });
  assert.equal(b.satisfaction.n, 2, 'la note du propriétaire ne compte pas');
  assert.equal(b.satisfaction.moyenne, 3);
  assert.equal(b.satisfaction.commentaires.length, 1);
  assert.equal(b.satisfaction.commentaires[0].jour, '2026-11-08');
  assert.ok(m.appels.some((p) => p.includes('owner=not.in.(' + PROPRIO)), 'les lectures écartent le propriétaire');
  assert.ok(m.appels.every((p) => !/select=data(&|$)/.test(p) || /statut_sondes|plantages_terrain|pilotage_historique|vrm_reglages/.test(p)), 'jamais select=data sur une ligne de vendeur');
  // Un point d'historique est noté pour aujourd'hui.
  assert.equal(m.ecrits.length, 1);
  assert.equal(m.ecrits[0].corps[0].owner, PROPRIO);
  assert.deepEqual(m.ecrits[0].corps[0].data.jours['2026-11-09'], { inscrits: 3, actifs7: 1, actifs30: 3, abonnes: 1, mensuelCentimes: null });
});

test('propriétaire avec Stripe : revenus mensuels, plans, autre devise écartée, désabonnements du mois', async () => {
  const debut = Math.floor(Date.parse('2026-11-03T10:00:00Z') / 1000);
  const art = (montant, interval = 'month', currency = 'eur', lookup = 'vrm_mensuel') => ({ items: { data: [{ quantity: 1, price: { unit_amount: montant, currency, lookup_key: lookup, recurring: { interval, interval_count: 1 } } }] } });
  const stripe = [
    { id: 'sub_1', customer: 'cus_A', status: 'active', ...art(1699) },
    { id: 'sub_2', customer: 'cus_X', status: 'past_due', ...art(12000, 'year', 'eur', 'vrm_pro_annuel') },
    { id: 'sub_3', customer: 'cus_Y', status: 'active', ...art(1999, 'month', 'usd') },
    { id: 'sub_4', customer: 'cus_P', status: 'active', ...art(1699) },
    { id: 'sub_5', customer: 'cus_C', status: 'canceled', canceled_at: debut, ...art(1699) },
    { id: 'sub_6', customer: 'cus_Z', status: 'canceled', canceled_at: debut - 30 * 86400, ...art(1699) },
    { id: 'sub_7', customer: 'cus_B', status: 'trialing', ...art(1699) },
  ];
  const r = await appeler(fauxMonde({ stripe }), { STRIPE_SECRET_KEY: 'sk_test_banc' });
  assert.equal(r.status, 200);
  sansIdentite(r.body);
  const v = r.body.revenus;
  assert.equal(v.etat, 'ok');
  assert.equal(v.mensuelCentimes, 1699 + 1000, 'mensuel + annuel/12, sans l’essai, sans le propriétaire, sans l’USD');
  assert.equal(v.abonnements, 2);
  assert.equal(v.ecartes, 1);
  assert.equal(v.modeTest, true);
  assert.deepEqual(r.body.abonnes.parPlan, [{ plan: 'Mensuel', n: 1 }, { plan: 'vrm_pro_annuel', n: 1 }]);
  assert.deepEqual(r.body.desabonnements, { n: 1, source: 'stripe' });
});

test('Stripe branché mais muet : revenus « pas su », jamais 0', async () => {
  const r = await appeler(fauxMonde({ stripe: [], pannes: { stripe: true } }), { STRIPE_SECRET_KEY: 'sk_test_banc' });
  assert.equal(r.body.revenus.etat, 'pas-su');
  assert.equal(r.body.revenus.mensuelCentimes, undefined);
});

test('lectures ratées : le bloc est null avec sa raison (jamais 0), et l’historique pas lu n’écrit rien', async () => {
  const m = fauxMonde({ pannes: { comptes: true, abonnements: true, histo: true, sondes: true } });
  const r = await appeler(m);
  assert.equal(r.status, 200);
  assert.equal(r.body.inscrits, null);
  assert.equal(r.body.actifs, null);
  assert.equal(r.body.abonnes, null);
  assert.equal(r.body.essais, null);
  assert.equal(r.body.incidents, null);
  assert.equal(r.body.raisons.inscrits, 'comptes-illisibles');
  assert.equal(r.body.raisons.incidents, 'sondes-absentes');
  assert.equal(r.body.raisons.historique, 'base');
  assert.equal(m.ecrits.length, 0, 'lecture ratée ⇒ aucune écriture');
});

test('l’historique garde une valeur lue plus tôt quand elle n’est plus sue', async () => {
  const histo = { v: 1, rev: 4, jours: { '2026-11-09': { inscrits: 3, actifs7: 2, actifs30: 3, abonnes: 1, mensuelCentimes: 1699 }, '2026-11-01': { inscrits: 2, actifs7: 1, actifs30: 2, abonnes: 1, mensuelCentimes: 1699 } } };
  const m = fauxMonde({ histo, pannes: { comptes: true } });
  const r = await appeler(m);
  assert.equal(m.ecrits[0].methode, 'PATCH');
  assert.deepEqual(m.ecrits[0].corps.data.jours['2026-11-09'], { inscrits: 3, actifs7: 2, actifs30: 3, abonnes: 1, mensuelCentimes: 1699 });
  assert.equal(r.body.historique.depuis, '2026-11-01');
  assert.equal(r.body.historique.actifs7.length, 2);
});
