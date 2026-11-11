import assert from 'node:assert/strict';
import {resumerStockJournee} from '../../src/stockJournee.js';
const a=(id,uid='1')=>({id,_acc:{vinted_user_id:uid}});
assert.deepEqual(resumerStockJournee([]),{total:0,renseignes:0,manquants:0,cout:0});
assert.deepEqual(resumerStockJournee([a(1),a(2)]),{total:2,renseignes:0,manquants:2,cout:0});
assert.deepEqual(resumerStockJournee([a(1),a(2)],{1:{buyPrice:0},2:{buyPrice:'12.50'}}),{total:2,renseignes:2,manquants:0,cout:12.5});
assert.equal(resumerStockJournee([a(1),a(1)]).total,1);
assert.equal(resumerStockJournee([a(1),a(1,'2')]).total,2);
assert.equal(resumerStockJournee([a(1),a(2),a(3)],{1:{buyPrice:' '},2:{buyPrice:-1},3:{buyPrice:Infinity}}).renseignes,0);
assert.equal(resumerStockJournee([a(1),a(2)],{1:{buyPrice:.1},2:{buyPrice:.2}}).cout,.3);
// (11 nov., DJ4) Une paire sous le même N° sur deux comptes (deux annonces) = UNE paire ; deux N° = deux.
assert.equal(resumerStockJournee([a(1),a(2,'2')],{1:{numero:'7'},2:{numero:'007'}}).total,1);
assert.equal(resumerStockJournee([a(1),a(2,'2')],{1:{numero:'7',title:'X'},2:{numero:'8',title:'X'}}).total,2);
console.log('9 contrôles stock : données manquantes, zéro réel, comptes, doublons, identité par N° et centimes.');
