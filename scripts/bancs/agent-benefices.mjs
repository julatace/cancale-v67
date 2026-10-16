import assert from 'node:assert/strict';
import {centimes,beneficePaire,beneficeVinted} from '../../src/beneficePaire.js';
import {preparerAgentEbay,executerAvecJournal} from '../../api/_lib/ebay-agent.js';
import {messagesEbay} from '../../api/_lib/ebay-gestion.js';
assert.equal(centimes('12,50'),1250);assert.equal(centimes('12abc'),null);assert.equal(centimes(''),null);assert.equal(centimes('-2'),null);assert.equal(centimes('1.234'),null);
assert.equal(beneficePaire('100',{buyPrice:'0'}).benefice,100);
assert.equal(beneficePaire('100',{}).benefice,null);
let b=beneficePaire('100',{buyPrice:'40',fees:'2',commission:'10',transportVendeur:'3',remboursement:'5',autresFrais:'0',fraisComplets:true});assert.equal(b.benefice,40);assert.equal(b.complet,true);
assert.equal(beneficePaire('0.30',{buyPrice:'0.10',commission:'0.10'}).benefice,0.1);
assert.equal(beneficePaire('100',{buyPrice:'40',commission:'x',fraisComplets:true}).benefice,null);
// Vinted : un boost vide est INCONNU (aucune source ne donne son prix) — jamais un 0 présenté comme complet.
b=beneficeVinted('100',{buyPrice:'40',commission:'10',fraisComplets:true});assert.equal(b.benefice,50);assert.equal(b.complet,false,'boost vide : bénéfice estimé');assert.equal(b.boostInconnu,true);
b=beneficeVinted('100',{buyPrice:'40',fees:'0',commission:'10',fraisComplets:true});assert.equal(b.complet,true,'boost 0 tapé : complet');assert.equal(b.boostInconnu,false);
assert.equal(beneficeVinted('100',{buyPrice:'40',fees:'2',fraisComplets:false}).complet,false);
assert.equal(messagesEbay({MemberMessage:{MemberMessageExchange:{Question:{MessageID:'1'},Response:[{Body:'Code 001234'},{Body:'Ancienne réponse'}]}}})[0].responses.join('|'),'Code 001234|Ancienne réponse');
const r=preparerAgentEbay({orders:{orders:[{orderId:'1',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED'},{orderId:'2',orderPaymentStatus:'PAID',orderFulfillmentStatus:'FULFILLED'},{orderId:'3',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED',cancelStatus:{cancelState:'CANCEL_REQUESTED'}}]},messages:{body:{ok:false}},offres:{body:{ok:true,offres:[{id:'a',status:'Pending',itemId:'123'}],totalPages:2}},journal:undefined});assert.equal(r.body.tasks.length,2);assert.equal(r.body.sources[1].ok,false);assert.equal(r.body.sources[2].partiel,true);assert.equal(r.body.journalLisible,false);
let d=null,calls=0;const modifier=async fn=>{d=fn(d);return true;};let result=await executerAvecJournal({action:'repondre',b:{itemId:'123',body:'private'},modifier,execute:async()=>{calls++;return {status:200,body:{ok:true}};}});assert.equal(result.body.ok,true);assert.equal(d.items[0].etat,'reussi');assert.ok(!JSON.stringify(d).includes('private'));assert.equal(calls,1);
result=await executerAvecJournal({action:'expedier',b:{},modifier:async()=>false,execute:async()=>{calls++;}});assert.equal(result.status,503);assert.equal(calls,1);
result=await executerAvecJournal({action:'expedier',b:{orderId:'123'},modifier,execute:async()=>{throw new Error('timeout');}});assert.equal(result.body.reason,'incertain');assert.equal(d.items[0].etat,'incertain');
let writes=0;result=await executerAvecJournal({action:'repondre',b:{},modifier:async()=>++writes===1,execute:async()=>({status:200,body:{ok:true}})});assert.equal(result.body.ok,true);assert.ok(result.body.journalAvertissement);
console.log('Bénéfices, préparation eBay, journal et réponses structurées : contrôles réussis (aucune action réelle).');

const now=Date.parse('2026-10-14T10:00:00Z');
const plan=preparerAgentEbay({orders:{capturedAt:now-2*86400000,orders:[{orderId:'ship',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED',lineItems:[{title:'Paire à expédier',fulfillmentInstructions:{shipByDate:'2026-10-14T14:00:00Z'}}]},{orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED'}]},messages:{body:{ok:true,messages:[],totalPages:1}},offres:{body:{ok:true,totalPages:1,offres:[{id:'later',itemId:'1',titre:'Offre demain',price:'85.00',currency:'EUR',status:'Pending',expiresAt:'2026-10-16T12:00:00Z'},{id:'soon',itemId:'2',titre:'Offre proche',price:'70.00',currency:'EUR',status:'Pending',expiresAt:'2026-10-14T12:00:00Z'},{id:'expired',itemId:'3',status:'Pending',expiresAt:'2026-10-13T12:00:00Z'},{id:'unknown',itemId:'4',status:'Pending',expiresAt:'illisible'},{id:'soon',itemId:'2',titre:'Offre proche',price:'70.00',currency:'EUR',status:'Pending',expiresAt:'2026-10-14T12:00:00Z'}]}},journal:null},now).body;
assert.deepEqual(plan.tasks.map(t=>t.id),['offer:soon','order:ship','offer:later']);
assert.equal(plan.tasks[0].title,'Offre proche');assert.equal(plan.tasks[0].price,'70.00');assert.equal(plan.tasks[0].urgent,true);assert.equal(plan.tasks[2].urgent,false);
assert.equal(plan.sources[0].ancien,true);assert.equal(plan.sources[1].partiel,false);
console.log('Priorités eBay : échéances, doublons, titres, commandes anciennes et états incomplets vérifiés.');
