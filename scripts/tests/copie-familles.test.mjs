// (11 nov., ouverture-legere-2) Les FAMILLES gardées sur l'appareil, revalidées par leur
// version (`lireFamilleAvecCopie`, src/copieLignes.js). Le banc ouverture-legere-2.cjs
// juge le vrai navigateur.  node --test scripts/tests/copie-familles.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { lireFamilleAvecCopie, stockageMemoire, etatCopies, oublierEtatCopies, borneDepuis, FENETRE_FAMILLE_MS } from '../../src/copieLignes.js';

const H = Date.parse('2026-11-11T10:00:00.000Z');
const iso = (t) => new Date(t).toISOString();
const ligne = (id, cap, s = 'x') => ({ id, updated_at: null, cap: iso(cap), rev: null, sup: null, pg: null, s });
function serveur(lignes) {
  const S = { m: new Map(lignes.map((l) => [l.id, l])), compte: 0, depuis: 0, complet: 0, recues: 0, panne: false, panneCompte: false };
  const tri = () => [...S.m.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).map((x) => ({ ...x }));
  S.lireCompte = async () => { S.compte++; return S.panne || S.panneCompte ? null : S.m.size; };
  S.lireDepuis = async (X) => { S.depuis++; if (S.panne) return null; const r = tri().filter((x) => (x.cap && x.cap >= X) || (x.pg && x.pg >= X)); S.recues += r.length; return r; };
  S.lireComplet = async () => { S.complet++; if (S.panne) return null; const r = tri(); S.recues += r.length; return r; };
  return S;
}
const lire = (S, st, opts = {}) => lireFamilleAvecCopie({ uid: opts.uid || 'u1', famille: 'txn', stockage: st, lireCompte: S.lireCompte, lireDepuis: S.lireDepuis, lireComplet: S.lireComplet, maintenant: () => opts.t || H });
const base = () => Array.from({ length: 50 }, (_, i) => ligne(`t${String(i).padStart(3, '0')}`, H - (i + 1) * 86400000));

test('2e ouverture sans écriture : la copie, aucune ligne reçue, mêmes lignes', async () => {
  const S = serveur(base()); const st = stockageMemoire();
  const r1 = await lire(S, st); assert.equal(r1.mode, 'entiere'); assert.equal(r1.rows.length, 50);
  S.recues = 0; S.complet = 0;
  const r2 = await lire(S, st, { t: H + 60000 });
  // Seule la ligne la plus récente (dans la fenêtre de 6 h avant elle) revient : 1 sur 50.
  assert.equal(r2.ok, true); assert.equal(r2.mode, 'copie'); assert.equal(S.complet, 0); assert.equal(S.recues, 1);
  assert.deepEqual(r2.rows, r1.rows);
});

test('une ligne réécrite (date neuve) : elle seule reçue, rendue fraîche', async () => {
  const S = serveur(base()); const st = stockageMemoire();
  await lire(S, st);
  S.m.set('t010', ligne('t010', H + 30000, 'neuf'));
  S.recues = 0;
  const r = await lire(S, st, { t: H + 60000 });
  assert.equal(r.mode, 'copie'); assert.equal(S.recues, 2);   // elle + la plus récente d'avant
  assert.equal(r.rows.find((x) => x.id === 't010').s, 'neuf');
});

test('une ligne neuve : reçue ; une ligne partie : famille relue entière', async () => {
  const S = serveur(base()); const st = stockageMemoire();
  await lire(S, st);
  S.m.set('t999', ligne('t999', H + 1000, 'nouvelle'));
  const r = await lire(S, st, { t: H + 60000 });
  assert.equal(r.mode, 'copie'); assert.equal(r.rows.length, 51);
  S.m.delete('t020'); S.complet = 0;
  const r2 = await lire(S, st, { t: H + 120000 });
  assert.equal(r2.mode, 'entiere'); assert.equal(S.complet, 1); assert.equal(r2.rows.length, 50);
  assert.ok(!r2.rows.some((x) => x.id === 't020'));
});

test('horloge en retard de moins de 6 h : la réécriture est vue', async () => {
  const S = serveur(base()); const st = stockageMemoire();
  await lire(S, st);
  S.m.set('t030', ligne('t030', H - 5 * 3600000, 'retard'));   // date plus vieille que la plus récente copie
  const r = await lire(S, st, { t: H + 60000 });
  assert.equal(r.rows.find((x) => x.id === 't030').s, 'retard');
});

test('une date dans le futur ne repousse jamais la borne', () => {
  const X = borneDepuis({ max: H + 365 * 86400000, lu: H });
  assert.equal(X, iso(H - FENETRE_FAMILLE_MS));
});

test('version illisible : JAMAIS la copie — la lecture d’avant ; ratée aussi ⇒ pas su, « pas relu »', async () => {
  oublierEtatCopies();
  const S = serveur(base()); const st = stockageMemoire();
  await lire(S, st);
  S.m.set('t005', ligne('t005', H + 30000, 'neuf'));
  S.panneCompte = true; S.complet = 0;
  const r = await lire(S, st, { t: H + 60000 });
  assert.equal(r.mode, 'entiere'); assert.equal(S.complet, 1);
  assert.equal(r.rows.find((x) => x.id === 't005').s, 'neuf');
  S.panne = true;
  const r2 = await lire(S, st, { t: H + 120000 });
  assert.equal(r2.ok, false); assert.equal(r2.rows, undefined);
  assert.equal(etatCopies().n, 1);
  assert.equal(st.m.size, 1);   // la copie reste sur l'appareil
  oublierEtatCopies();
});

test('relue entière après 24 h, quoi qu’il arrive', async () => {
  const S = serveur(base()); const st = stockageMemoire();
  await lire(S, st); S.complet = 0;
  const r = await lire(S, st, { t: H + 25 * 3600000 });
  assert.equal(r.mode, 'entiere'); assert.equal(S.complet, 1);
});

test('date pas au format ISO : la famille n’est pas gardée', async () => {
  const L = base(); L[3] = { ...L[3], cap: '1731300000000' };
  const S = serveur(L); const st = stockageMemoire();
  await lire(S, st); assert.equal(st.m.size, 0);
  S.complet = 0; await lire(S, st, { t: H + 60000 }); assert.equal(S.complet, 1);
});

test('un autre compte VRM : jamais la copie de l’autre', async () => {
  const S = serveur(base()); const st = stockageMemoire();
  await lire(S, st, { uid: 'u1' }); S.complet = 0;
  const r = await lire(S, st, { uid: 'u2', t: H + 60000 });
  assert.equal(r.mode, 'entiere'); assert.equal(S.complet, 1);
  assert.ok([...st.m.values()].every((e) => e.uid === 'u2'));
});
