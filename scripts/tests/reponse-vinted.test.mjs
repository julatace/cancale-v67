import test from 'node:test';import assert from 'node:assert/strict';
import {retourReponseVinted,cleReponseVinted,creerBrouillonsReponses} from '../../src/reponseVinted.js';
test('seul un retour positif annonce un message envoyé',()=>{assert.equal(retourReponseVinted({ok:true}).etat,'confirme');for(const r of [null,undefined,{}, {ok:false,error:'timeout'},{ok:false,status:500},{ok:false,status:408}])assert.equal(retourReponseVinted(r).etat,'incertain');});
test('un refus explicite conserve son erreur et ne prétend pas envoyer',()=>{for(const status of [400,401,403,404,429])assert.equal(retourReponseVinted({ok:false,status,error:'Refus Vinted'}).texte,'Refus Vinted');for(const code of ['plusieurs','perime'])assert.equal(retourReponseVinted({ok:false,code}).etat,'refuse');});
test('un état de réponse reste rattaché au compte et au fil exact',()=>{assert.notEqual(cleReponseVinted(1,9),cleReponseVinted(2,9));assert.notEqual(cleReponseVinted(1,9),cleReponseVinted(1,8));});

test('les brouillons sont séparés par compte et conversation sans perdre la mise en forme',()=>{
 const b=creerBrouillonsReponses(()=> 'a');b.ecrire('a',1,7,' Bonjour\nà bientôt ');b.ecrire('a',2,7,'Autre compte');b.ecrire('a',1,8,'Autre conversation');
 assert.equal(b.lire('a',1,7),' Bonjour\nà bientôt ');assert.equal(b.lire('a',2,7),'Autre compte');assert.equal(b.lire('a',1,8),'Autre conversation');assert.equal(b.lire('a',9,7),'');
 b.ecrire('a',1,7,'');assert.equal(b.lire('a',1,7),'');
});
test('l’accusé de réception efface seulement le brouillon envoyé',()=>{
 const b=creerBrouillonsReponses(()=> 'a');b.ecrire('a',1,7,'Premier');b.ecrire('a',1,7,'Deuxième');b.confirmer('a',1,7,'Premier');assert.equal(b.lire('a',1,7),'Deuxième');b.confirmer('a',1,7,'Deuxième');assert.equal(b.lire('a',1,7),'');
});
test('changement de propriétaire : effacement et aucun accusé tardif sur le nouveau compte',()=>{
 let owner='a';const b=creerBrouillonsReponses(()=>owner);b.ecrire('a',1,7,'Privé A');owner='b';assert.equal(b.lire('b',1,7),'');b.ecrire('b',1,7,'Privé B');b.ecrire('a',1,7,'Tardif A');b.confirmer('a',1,7,'Privé B');assert.equal(b.lire('b',1,7),'Privé B');assert.equal(b.lire('a',1,7),'');owner='a';assert.equal(b.lire('a',1,7),'');
});
