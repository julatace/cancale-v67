import test from 'node:test';
import assert from 'node:assert/strict';
import { lirePlateformes, plateformesAffichees } from '../../src/plateformesAffichage.js';
import { siteMontre } from '../../src/profilVendeur.js';
test('un nouveau vendeur ne voit pas les sites qu’il n’a pas choisis', () => {
  assert.deepEqual(plateformesAffichees(null, { ebay: null }), ['vinted']);
  assert.deepEqual(plateformesAffichees({sites:['ebay','inconnu','ebay']}), ['ebay']);
  assert.equal(siteMontre('vinted', { mode:'complet', plateformes:['ebay'], choisi:'vinted' }), false);
  assert.equal(siteMontre('toutes', { plateformes:['ebay'] }), true);
});
test('un compte réellement relié apparaît sans prendre une panne pour une connexion', () => {
  assert.deepEqual(plateformesAffichees({sites:['vinted']}, {leboncoin:true,ebay:null,vestiaire:false}), ['vinted','leboncoin']);
  assert.deepEqual(lirePlateformes({sites:['ebay',null,'autre']}), {sites:['ebay'],at:null});
  assert.equal(lirePlateformes({sites:'ebay'}), null);
});
