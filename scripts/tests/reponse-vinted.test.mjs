import test from 'node:test';import assert from 'node:assert/strict';
import {retourReponseVinted,cleReponseVinted} from '../../src/reponseVinted.js';
test('seul un retour positif annonce un message envoyé',()=>{assert.equal(retourReponseVinted({ok:true}).etat,'confirme');for(const r of [null,undefined,{}, {ok:false,error:'timeout'},{ok:false,status:500},{ok:false,status:408}])assert.equal(retourReponseVinted(r).etat,'incertain');});
test('un refus explicite conserve son erreur et ne prétend pas envoyer',()=>{for(const status of [400,401,403,404,429])assert.equal(retourReponseVinted({ok:false,status,error:'Refus Vinted'}).texte,'Refus Vinted');for(const code of ['plusieurs','perime'])assert.equal(retourReponseVinted({ok:false,code}).etat,'refuse');});
test('un état de réponse reste rattaché au compte et au fil exact',()=>{assert.notEqual(cleReponseVinted(1,9),cleReponseVinted(2,9));assert.notEqual(cleReponseVinted(1,9),cleReponseVinted(1,8));});
