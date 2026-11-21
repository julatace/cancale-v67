import test from 'node:test';
import assert from 'node:assert/strict';
import { argentAVenir } from '../../src/argentAVenir.js';
import { comparerMois } from '../../src/comparerMois.js';
const eur = value => ({ value: String(value), currency: 'EUR' });
const order = holds => ({ orderId: 'exemple', orderPaymentStatus: 'PAID', paymentSummary: { totalDueSeller: eur(300), payments: [{ paymentHolds: holds }] } });
const sources = { vinted: [], lbc: [], vestiaire: [], versements: {}, R: { commandeEbayEngagee: () => true, montantRecuEbay: () => ({ eur: 280 }) } };

// (16 nov., parcours-vert) Règle du 15 nov. (src/argentAVenir.js, « Le montant est CE QUE LE VENDEUR RECEVRA ») :
// une retenue sans montant lisible compte l'argent REÇU (`montantRecuEbay` : dû − frais), jamais le prix total
// de la commande (`totalDueSeller`) ; une autre devise est écartée et dite, jamais convertie.
test('une retenue eBay sans montant ou en devise étrangère ne devient pas le prix total de la commande', () => {
  for (const holdAmount of [undefined, { value: '', currency: 'EUR' }]) {
    const a = argentAVenir({ ...sources, ebay: [order([{ holdState: 'HELD', holdAmount }])] });
    assert.equal(a.lignes.length, 1);
    assert.equal(a.lignes[0].eur, 280, 'l’argent reçu (dû − frais), pas les 300 € de la commande');
    assert.equal(a.lignes[0].estime, undefined);
    assert.equal(a.nonComptees.length, 0);
  }
  const usd = argentAVenir({ ...sources, ebay: [order([{ holdState: 'HELD', holdAmount: { value: '25', currency: 'USD' } }])] });
  assert.equal(usd.lignes.length, 0);
  assert.equal(usd.partiel, true);
  assert.equal(usd.nonComptees.length, 1);
  assert.equal(usd.nonComptees[0].sorte, 'devise');
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
