// (10 nov., lot K) Les listes gardées sur l'appareil, revalidées par leur version
// (src/copieLignes.js). Le banc scripts/bancs/ouverture-legere.cjs juge le vrai navigateur.
// node --test scripts/tests/copie-lignes.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { lireAvecCopie, stockageMemoire, versionDe, etatCopies, oublierEtatCopies } from '../../src/copieLignes.js';

const faux = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };
const ligne = (id, rev, contenu) => ({ id, updated_at: '2026-11-10T10:00:00Z', cap: '2026-11-10T09:00:00Z', rev: String(rev), payload: { contenu } });
function serveur(lignes) {
  const s = { lignes: new Map(lignes.map((l) => [l.id, l])), versions: 0, pleines: 0, octets: 0, panne: false, panneVersions: false };
  s.lireVersions = async (ids) => { s.versions++; if (s.panne || s.panneVersions) return null; return ids.filter((i) => s.lignes.has(i)).map((i) => { const l = s.lignes.get(i); return { id: i, updated_at: l.updated_at, cap: l.cap, rev: l.rev, sup: null, pg: null }; }); };
  s.lireLignes = async (ids) => { s.pleines++; if (s.panne) return null; const r = ids.filter((i) => s.lignes.has(i)).map((i) => JSON.parse(JSON.stringify(s.lignes.get(i)))); s.octets += JSON.stringify(r).length; return r; };
  return s;
}
const lire = (srv, stockage, uid = 'u1', ids = ['a', 'b'], local = null) => lireAvecCopie({ uid, famille: 'commandes', ids, stockage, local, lireVersions: srv.lireVersions, lireLignes: srv.lireLignes });

test('2e ouverture, versions identiques : rien téléchargé, mêmes lignes', async () => {
  const srv = serveur([ligne('a', 1, 'A'.repeat(5000)), ligne('b', 4, 'B')]); const st = stockageMemoire();
  const r1 = await lire(srv, st);
  assert.equal(r1.ok, true); assert.deepEqual(r1.telecharges, ['a', 'b']);
  srv.octets = 0; srv.pleines = 0;
  const r2 = await lire(srv, st);
  assert.equal(r2.ok, true); assert.equal(srv.pleines, 0); assert.equal(srv.octets, 0);
  assert.deepEqual(r2.depuisCopie, ['a', 'b']);
  assert.deepEqual(r2.rows, r1.rows);
});

test('une version changée : seule CETTE ligne est relue, et rendue fraîche', async () => {
  const srv = serveur([ligne('a', 1, 'A'), ligne('b', 4, 'B')]); const st = stockageMemoire();
  await lire(srv, st);
  srv.lignes.set('b', ligne('b', 5, 'B2'));
  const r = await lire(srv, st);
  assert.deepEqual(r.telecharges, ['b']);
  assert.equal(r.rows.find((x) => x.id === 'b').payload.contenu, 'B2');
  // Même date d'écriture, même capture, seul `rev` bouge : relue aussi.
  srv.lignes.set('a', { ...srv.lignes.get('a'), rev: '2', payload: { contenu: 'A2' } });
  const r3 = await lire(srv, st);
  assert.deepEqual(r3.telecharges, ['a']);
  assert.equal(r3.rows.find((x) => x.id === 'a').payload.contenu, 'A2');
});

test('ligne disparue du serveur : ni rendue, ni gardée', async () => {
  const srv = serveur([ligne('a', 1, 'A'), ligne('b', 4, 'B')]); const st = stockageMemoire();
  await lire(srv, st);
  srv.lignes.delete('b');
  const r = await lire(srv, st);
  assert.deepEqual(r.rows.map((x) => x.id), ['a']);
  assert.equal([...st.m.keys()].some((k) => k.endsWith('|b')), false);
});

test('versions illisibles : jamais la copie — l’ancienne lecture, ou pas su ; copie gardée, « pas relu »', async () => {
  oublierEtatCopies();
  const srv = serveur([ligne('a', 1, 'A'), ligne('b', 4, 'B')]); const st = stockageMemoire(); const ls = faux();
  await lire(srv, st, 'u1', ['a', 'b'], ls);
  // Versions seules en panne : la ligne entière est relue (comme avant).
  srv.panneVersions = true; srv.lignes.set('a', ligne('a', 9, 'NEUF'));
  const r = await lire(srv, st, 'u1', ['a', 'b'], ls);
  assert.equal(r.ok, true); assert.equal(r.rows.find((x) => x.id === 'a').payload.contenu, 'NEUF');
  assert.equal(etatCopies(), null);
  // Tout en panne : pas su (jamais la copie), la copie reste sur l'appareil, « pas relu ».
  srv.panne = true;
  const r2 = await lire(srv, st, 'u1', ['a', 'b'], ls);
  assert.equal(r2.ok, false); assert.equal(r2.rows, undefined);
  assert.equal(st.m.size, 2);
  const e = etatCopies(); assert.ok(e && e.n === 2 && Number.isFinite(e.vuA));
  // Le réseau revient : relu, la mention s'en va.
  srv.panne = false; srv.panneVersions = false;
  const r3 = await lire(srv, st, 'u1', ['a', 'b'], ls);
  assert.equal(r3.ok, true); assert.equal(etatCopies(), null);
});

test('relecture d’une ligne changée ratée : pas su, jamais la copie périmée', async () => {
  const srv = serveur([ligne('a', 1, 'A'), ligne('b', 4, 'B')]); const st = stockageMemoire();
  await lire(srv, st);
  srv.lignes.set('a', ligne('a', 2, 'A2'));
  const plein = srv.lireLignes; srv.lireLignes = async () => null;
  const r = await lire(srv, st);
  assert.equal(r.ok, false);
  srv.lireLignes = plein;
});

test('un autre compte VRM ne voit jamais la copie ; écrire pour lui efface l’autre', async () => {
  const srv = serveur([ligne('a', 1, 'A'), ligne('b', 4, 'B')]); const st = stockageMemoire();
  await lire(srv, st, 'u1');
  const avant = srv.pleines;
  const r = await lire(srv, st, 'u2');
  assert.equal(srv.pleines, avant + 1);          // tout relu pour u2
  assert.deepEqual(r.telecharges, ['a', 'b']);
  assert.equal([...st.m.values()].some((e) => e.uid === 'u1'), false);
  // Sans compte : jamais de copie.
  const r0 = await lire(srv, st, '');
  assert.deepEqual(r0.depuisCopie, []);
});

test('la version est lue AVANT la ligne : une écriture entre les deux est relue la fois suivante', async () => {
  const srv = serveur([ligne('a', 1, 'A')]); const st = stockageMemoire();
  const plein = srv.lireLignes;
  srv.lireLignes = async (ids) => { srv.lignes.set('a', ligne('a', 2, 'A2')); return plein(ids); };
  await lire(srv, st, 'u1', ['a']);
  srv.lireLignes = plein;
  const r = await lire(srv, st, 'u1', ['a']);
  assert.deepEqual(r.telecharges, ['a']);
  assert.equal(r.rows[0].payload.contenu, 'A2');
});

test('un PDF n’est jamais gardé', async () => {
  const srv = serveur([{ ...ligne('a', 1, 'A'), pdfB64: 'JVBERi0xLjQK' }]); const st = stockageMemoire();
  await lire(srv, st, 'u1', ['a']);
  assert.equal(st.m.size, 0);
});

test('versionDe : scalaires seulement, vides égaux', () => {
  assert.equal(versionDe({ id: 'x', updated_at: 't', cap: '', rev: undefined }), versionDe({ id: 'y', updated_at: 't', cap: null, rev: null, sup: null, pg: null }));
  assert.notEqual(versionDe({ updated_at: 't', rev: '1' }), versionDe({ updated_at: 't', rev: '2' }));
  assert.notEqual(versionDe({ updated_at: 't', sup: 'true' }), versionDe({ updated_at: 't' }));
});

test('relecture qui ne rend pas une ligne que les versions disent exister : incohérent, rien deviné ni gardé', async () => {
  const srv = serveur([ligne('a', 1, 'A'), ligne('b', 4, 'B')]); const st = stockageMemoire();
  srv.lireLignes = async () => [];          // un serveur qui ne comprend pas `in.(…)`
  const r = await lire(srv, st);
  assert.equal(r.ok, false); assert.equal(r.incoherent, true); assert.equal(st.m.size, 0);
});
