import test from 'node:test';
import assert from 'node:assert/strict';
import { argentAVenir } from '../../src/argentAVenir.js';
import { comparerMois } from '../../src/comparerMois.js';
const eur = value => ({ value: String(value), currency: 'EUR' });
const order = holds => ({ orderId: 'exemple', orderPaymentStatus: 'PAID', paymentSummary: { totalDueSeller: eur(300), payments: [{ paymentHolds: holds }] } });
const sources = { vinted: [], lbc: [], vestiaire: [], versements: {}, R: { commandeEbayEngagee: () => true, montantRecuEbay: () => ({ eur: 280 }) } };

test('une retenue eBay sans montant ou en devise étrangère ne devient pas le prix total de la commande', () => {
  for (const holdAmount of [undefined, { value: '25', currency: 'USD' }, { value: '', currency: 'EUR' }]) {
    const a = argentAVenir({ ...sources, ebay: [order([{ holdState: 'HELD', holdAmount }])] });
    assert.equal(a.lignes.length, 0);
    assert.equal(a.partiel, true);
    assert.equal(a.nonComptees.length, 1);
  }
});

test('le montant retenu connu est compté exactement, sans la somme déjà libérée', () => {
  const a = argentAVenir({ ...sources, ebay: [order([{ holdState: 'HELD', holdAmount: eur(25) }, { holdState: 'RELEASED', holdAmount: eur(275) }])] });
  assert.equal(a.total, 25);
  assert.equal(a.n, 1);
});

test('un mois encore en cours de lecture ne présente ni total complet ni comparaison', () => {
  const a = comparerMois({ ymA: '2026-10', maintenant: Date.parse('2026-11-04T12:00:00Z'), vendu: { lignes: [], enAttente: true }, R: { bilanLignes: () => ({ n: 0, eur: 0 }) } });
  for (const cle of ['ventes', 'vendu']) {
    const l = a.lignes.find(l => l.cle === cle);
    assert.equal(l.a.valeur, null);
    assert.equal(l.b.valeur, null);
    assert.equal(l.ecart, null);
  }
});
