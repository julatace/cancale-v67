import {etatOffreVinted} from '../../src/offresVinted.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const s=fs.readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8');
const code=s.slice(s.indexOf('const normalizeConversationMessages ='),s.indexOf("// L'offre d'un ACHETEUR"));
const normaliser=new Function('extractLinks','extractEventText','etatOffreVinted',code+';return normalizeConversationMessages;')(()=>[],(e,t)=>e.body||t,etatOffreVinted);
const offre=(user,price,extra={})=>({entity_type:'offer_request_message',created_at:'2026-10-25T08:00:00Z',entity:{user_id:user,price,status:10,current:true,...extra}});
test('les offres reçues et envoyées sont des événements financiers distincts',()=>{
 const r=normaliser({opposite_user:{id:22},messages:[offre(22,{amount:'45,50',currency_code:'EUR'}),offre(11,{amount:'50.00',currency:'EUR'})]});
 assert.equal(r[0].kind,'offer');assert.deepEqual(r[0].offre,{montant:45.5,devise:'EUR',sens:'recue',statut:'En attente'});assert.equal(r[1].offre.sens,'envoyee');
});
test('aucune direction ni devise n’est inventée si la source ne les donne pas',()=>{
 const [r]=normaliser({messages:[offre(null,{amount:'19'})]});assert.equal(r.offre.sens,'inconnu');assert.equal(r.offre.devise,null);
});
test('offre précédente et libellé natif conservent leur statut réel',()=>{
 const [r,a]=normaliser({messages:[offre(2,{amount:'30'},{current:false}),offre(2,{amount:'35'},{status:30,status_title:'Offre refusée'})]});assert.equal(r.offre.statut,'Offre précédente');assert.equal(a.offre.statut,'Offre refusée');
});
test('un montant illisible ne devient pas une offre chiffrée',()=>{
 for(const price of [{amount:'45 euros'},{amount:'NaN'},null,{amount:'-5'},{amount:'0'}])assert.equal(normaliser({messages:[offre(2,price)]})[0].kind,'event');
});
test('messages et événements de retrait restent présents et classés par date',()=>{
 const r=normaliser({opposite_user:{id:22},messages:[offre(22,{amount:'20'}),{entity_type:'message',created_at:'2026-10-25T07:00:00Z',entity:{user_id:11,body:'Bonjour'}},{entity_type:'status_message',created_at:'2026-10-25T09:00:00Z',entity:{body:'Code de retrait 123456'}}]});assert.deepEqual(r.map(m=>m.kind),['message','offer','event']);assert.equal(r[0].mine,true);assert.match(r[2].body,/123456/);
});
