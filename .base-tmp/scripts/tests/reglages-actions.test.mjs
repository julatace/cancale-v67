import test from 'node:test';import assert from 'node:assert/strict';import {actionsReglages} from '../../src/reglagesActions.js';
test('une lecture inconnue ne crée aucune action fictive',()=>assert.deepEqual(actionsReglages({comptes:[{vinted_user_id:1}]}),[]));
test('une adresse manquante est distinguée d’une adresse non confirmée',()=>{
const r=actionsReglages({comptes:[{vinted_user_id:1},{vinted_user_id:2}],emails:{1:'a@example.test'},preuves:{cloisonnee:true,adresses:{'a@example.test':{etat:'envoyee'},'b@example.test':{etat:'prouvee'}}}});
assert.deepEqual(r.map(x=>x.id),['adresses','confirmation']);assert.match(r[0].titre,/1 compte/);assert.match(r[1].titre,/1 adresse/);
});
test('une adresse retenue ou un lien en préparation ne déclenche pas une fausse demande de clic',()=>assert.deepEqual(actionsReglages({comptes:[{vinted_user_id:1}],emails:{1:'a@example.test'},preuves:{cloisonnee:true,adresses:{'a@example.test':{etat:'transition'},'b@example.test':{etat:'preparation'}}}}),[]));
