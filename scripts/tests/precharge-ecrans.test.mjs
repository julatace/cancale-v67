// (11 nov., chargement léger) La règle du préchargement des écrans (src/prechargeEcrans.js) :
// quelle famille pour quel écran, lesquelles précharger, et quand le réseau l'interdit.
// node --test scripts/tests/precharge-ecrans.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { familleEcran, famillesProbables, reseauPermet, noterEcranVu, CLE_FREQUENTS, MIN_VISITES, MAX_PRECHARGES } from '../../src/prechargeEcrans.js';

test('les écrans du morceau App n’ont pas de famille (rien à précharger)', () => {
  for (const [t, s, u] of [['journee', 'journee', ''], ['cat_bord', 'cat_bord', ''], ['ventes', 'vinted', 'ventes'], ['annonces', 'vinted', 'annonces'], ['ventes', 'toutes', ''], ['messages', 'vinted', 'messages']]) {
    assert.equal(familleEcran(t, s, u), '', `${t}/${s}`);
  }
});

test('chaque gros écran a SA famille', () => {
  assert.equal(familleEcran('settings', 'settings', ''), 'reglages');
  assert.equal(familleEcran('vintedaccounts', '', ''), 'reglages');
  assert.equal(familleEcran('dashboard', '', 'stats'), 'stats');
  assert.equal(familleEcran('dashboard', '', 'prix'), 'prix');
  assert.equal(familleEcran('compta', '', 'urssaf'), 'compta');
  assert.equal(familleEcran('garage', '', ''), 'stock');
  assert.equal(familleEcran('ventes', 'leboncoin', 'leboncoin'), 'leboncoin');
  assert.equal(familleEcran('annonces', 'ebay', 'ebay'), 'ebay');
  assert.equal(familleEcran('ebay_ventes', '', ''), 'ebay');
  assert.equal(familleEcran('plat_vestiaire', 'vestiaire', ''), 'vestiaire');
});

test('précharger : les plus ouvertes, au moins MIN_VISITES, jamais la courante, au plus MAX_PRECHARGES', () => {
  const f = { reglages: 9, stats: 4, ebay: 4, stock: 1, compta: 3 };
  assert.deepEqual(famillesProbables(f, ''), ['reglages', 'ebay'].slice(0, MAX_PRECHARGES));
  assert.deepEqual(famillesProbables(f, 'reglages'), ['ebay', 'stats']);
  assert.deepEqual(famillesProbables({ stock: MIN_VISITES - 1 }, ''), []);
  assert.deepEqual(famillesProbables({}, ''), []);
  assert.deepEqual(famillesProbables({ inconnue: 50, stats: 2 }, '', ['stats']), ['stats']);
  assert.deepEqual(famillesProbables({ reglages: 'x', stats: 2 }, ''), ['stats']);
});

test('le réseau : économie de données et 2G interdisent', () => {
  assert.equal(reseauPermet({}), true);
  assert.equal(reseauPermet({ connection: { effectiveType: '4g' } }), true);
  assert.equal(reseauPermet({ connection: { effectiveType: '3g' } }), true);
  assert.equal(reseauPermet({ connection: { effectiveType: '2g' } }), false);
  assert.equal(reseauPermet({ connection: { effectiveType: 'slow-2g' } }), false);
  assert.equal(reseauPermet({ connection: { saveData: true, effectiveType: '4g' } }), false);
});

test('noter : une visite par famille et par page, stockage refusé sans erreur', () => {
  const m = new Map();
  const st = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) };
  noterEcranVu('stats', st); noterEcranVu('stats', st); noterEcranVu('ebay', st); noterEcranVu('', st);
  assert.deepEqual(JSON.parse(m.get(CLE_FREQUENTS)), { stats: 1, ebay: 1 });
  assert.doesNotThrow(() => noterEcranVu('compta', { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); } }));
});
