import test from 'node:test';import assert from 'node:assert/strict';
import {destinationEmail,resumeReceptionComptes,etatCollecteur} from '../../src/receptionEmail.js';
import {suiviComptes,controlesSources,suiviLeboncoin} from '../../src/suiviComptes.js';
import {requeteJsonBornee} from '../../src/requeteJsonBornee.js';
import {progressionFavoris} from '../../src/favorisProgression.js';
test('les adresses gardent leurs propres compteurs et ne déduisent aucun compte ambigu',()=>{
 const adresses=[{adresse:'a@example.test',comptes:[{id:'1',nom:'A'}],declaree:true},{adresse:'b@example.test',comptes:[{id:'2',nom:'B'},{id:'3',nom:'C'}],declaree:true}];
 const emails=[{id:'1',adresses:['a@example.test'],etat:'integre',type:'connu-sans-action',at:'2026-10-28T10:00:00Z',subject:'Information'},{id:'2',adresses:['b@example.test'],etat:'erreur',at:'2026-10-28T11:00:00Z'},{id:'3',adresses:['a@example.test'],etat:'a-verifier',at:'2030-01-01'}];
 const [a,b]=resumeReceptionComptes(adresses,emails,Date.parse('2026-10-28T12:00:00Z'));
 assert.equal(a.integres,1);assert.equal(a.sansAction,1);assert.equal(a.erreurs,0);assert.equal(a.dernier.id,'1');assert.equal(b.nom,'Association à corriger');assert.equal(b.erreurs,1);assert.match(b.action,/Corrige/);
});
test('réception traitée sans action et reprise ne promettent pas des pièces jointes disponibles',()=>{
 assert.match(destinationEmail({etat:'integre',type:'connu-sans-action'}),/sans action/);
 assert.match(destinationEmail({etat:'erreur',type:'achat'}),/Aucune intégration complète/);
 assert.match(destinationEmail({etat:'integre',type:'bordereau'}),/ne certifie pas/);
});
test('un passage sans résultat et une erreur datée du futur ne sont pas des confirmations',()=>{
 const now=Date.parse('2026-10-28T12:00:00Z');
 assert.equal(etatCollecteur({dernierPassage:'2026-10-28T11:59:00Z'},now).etat,'inconnu');
 assert.equal(etatCollecteur({dernierPassage:'2030-01-01',etat:'erreur'},now).etat,'inconnu');
});
test('le diagnostic indexe les captures une seule fois pour 2000 comptes',()=>{
 let lectures=0;const rows=Array.from({length:2000},(_,i)=>({get id(){lectures++;return `harvest_${i}_orders_sold`;},cap:'2026-10-28T11:00:00Z'}));
 const r=suiviComptes(Array.from({length:2000},(_,i)=>({vinted_user_id:String(i)})),rows,Date.parse('2026-10-28T12:00:00Z'));
 assert.equal(lectures,2000);assert.equal(r[1999].sources.ventes.etat,'observe');assert.equal(r[0].sources.achats.etat,'non-observe');
});
test('enregistrement local, capture ancienne et lecture absente restent distincts',()=>{
 const now=Date.parse('2026-10-28T12:00:00Z'),r=suiviComptes([{vinted_user_id:'1'}],[{id:'harvest_1_listings',updated_at:'2026-10-26T10:00:00Z'}],now)[0];
 assert.equal(r.sources.annonces.origineDate,'enregistrement');assert.match(controlesSources(r.sources,now)[0].raison,/24 h/);
 assert.match(controlesSources({ventes:{etat:'inconnu'}},now)[0].action,/avant de conclure/);
 const lbc=suiviLeboncoin({comptes:[{accounts:{1:{sessionAt:'2026-10-28'}}}],annonces:[{items:{10:{account:1,images:[]},11:{account:1,images:['https://example.test/photo']}}}],transactions:[]});
 assert.equal(lbc[0].sansPhoto,1);assert.equal(lbc[0].avecPhoto,1);
});
test('le délai couvre aussi le JSON : une mutation bloquée n’est pas relancée',async()=>{
 let appels=0;await assert.rejects(requeteJsonBornee('/fictif',{method:'POST'},5,async(_,o)=>{appels++;return {ok:true,status:200,json:()=>new Promise((_,reject)=>o.signal.addEventListener('abort',()=>reject(Error('abort'))))};}),{name:'AbortError'});assert.equal(appels,1);
 await assert.rejects(requeteJsonBornee('/fictif',{},100,async()=>({ok:true,json:async()=>{throw Error('contenu privé à ne pas afficher');}})),/réponse du service n’est pas lisible/);
});
test('une clôture manuelle ne devient pas un message confirmé envoyé',()=>{
 const p=progressionFavoris({active:false,jobs:[{etat:'verifie'},{etat:'envoye'}]},Date.now());assert.equal(p.verifies,1);assert.equal(p.envoyes,1);assert.equal(p.termines,2);
});
