// (9 nov., vitesse) `achatDuColis` et `suivisAchat` mémorisés pour UN calcul synchrone
// (src/liensColis.js) : le résultat doit être EXACTEMENT celui de la boucle d'origine
// (`achatDuColisCalc`), sur des achats faits pour piéger un index (même transaction sur deux
// comptes, même n° sur deux achats, entrée d'un autre compte, n° écrits différemment, achats
// sans transaction, colis sans rien), et jamais un résultat d'avant une modification.
// node --test scripts/tests/liens-colis-memo.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { achatDuColis, achatDuColisCalc, suivisAchat } from '../../src/liensColis.js';

let graine = 7;
const hasard = (n) => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine % n; };
const SUIVIS = ['AB123456789FR', 'ab 123-456789 fr', 'ZZ987654321FR', '6A1234', '6a 1234', 'XX1', '', null];
function monde() {
  const achats = []; const index = {};
  const n = 1 + hasard(40);
  for (let i = 0; i < n; i++) {
    const tx = hasard(6) === 0 ? '' : String(100 + hasard(15));   // des transactions en double
    const acc = ['A', 'B', { vinted_user_id: 'A' }, { vinted_user_id: 'C' }, undefined][hasard(5)];
    achats.push({ transaction_id: tx, _acc: acc, title: 'Même paire' });
    if (tx && hasard(3)) {
      const uid = typeof acc === 'object' && acc ? acc.vinted_user_id : (acc || '');
      const cle = hasard(2) && uid ? uid + ':' + tx : tx;
      index[cle] = { suivi: SUIVIS[hasard(SUIVIS.length)], suivis: hasard(2) ? [SUIVIS[hasard(SUIVIS.length)]] : undefined, uid: hasard(4) === 0 ? ['A', 'B', 'C'][hasard(3)] : undefined };
    }
  }
  return { achats, index };
}
const colisAuHasard = () => {
  const c = {}; const k = hasard(4);
  if (k === 0 || k === 2) c.suivi = SUIVIS[hasard(SUIVIS.length)];
  if (k === 1 || k === 2) c[hasard(2) ? 'transaction' : 'transactionId'] = String(100 + hasard(15));
  return c;
};

test('même achat trouvé (ou personne) que la boucle d’origine, sur 3 000 colis', () => {
  let trouves = 0, personne = 0;
  for (let m = 0; m < 300; m++) {
    const { achats, index } = monde();
    for (let i = 0; i < 10; i++) {
      const c = colisAuHasard();
      const attendu = achatDuColisCalc(c, achats, index);
      const obtenu = achatDuColis(c, achats, index);
      assert.equal(obtenu, attendu, JSON.stringify({ c, achats, index }));
      if (attendu) trouves++; else personne++;
    }
  }
  assert.ok(trouves > 200 && personne > 200, `les deux cas servis (trouvés ${trouves}, personne ${personne})`);
});

test('les n° d’un achat : mêmes valeurs, et une copie (la modifier ne change pas la suivante)', () => {
  const a = { transaction_id: '1', _acc: 'A' }; const index = { 1: { suivi: 'ab 1', suivis: ['AB1', 'cd-2'] } };
  const s1 = suivisAchat(a, index); assert.deepEqual(s1, ['AB1', 'CD2']);
  s1.push('FAUX'); assert.deepEqual(suivisAchat(a, index), ['AB1', 'CD2']);
});

test('jamais un résultat d’avant : après la microtâche, une modification est vue', async () => {
  const a = { transaction_id: '1', _acc: 'A' }, b = { transaction_id: '2', _acc: 'A' };
  const achats = [a, b]; const index = { 1: { suivi: 'AB1' }, 2: { suivi: 'CD2' } };
  assert.equal(achatDuColis({ suivi: 'AB1' }, achats, index), a);
  await Promise.resolve();
  index['2'] = { suivi: 'AB1' };   // deux achats sous le même n° : personne
  assert.equal(achatDuColis({ suivi: 'AB1' }, achats, index), null);
});
