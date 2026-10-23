import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cibleEbay,bilanCommandeEbay,codesRetraitEbay} from '../../src/ebayParcours.js';
import {lireBrouillon,sauverBrouillon,effacerBrouillonSiIdentique} from '../../src/brouillonsMessages.js';
import {fusionCommandesEbay} from '../../api/_lib/ebay-synchronisation.js';
assert.deepEqual(cibleEbay('autre',{section:'messages',id:'message:123',ref:'456'}),{compte:'autre',section:'messages',id:'123',itemId:'456'});
assert.equal(cibleEbay('autre',{section:'messages',id:'j1',ref:'456'}),null);
assert.equal(cibleEbay('autre',{section:'inconnu',id:'message:123'}),null);
const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
assert.equal(sauverBrouillon('A','principal','1','Bonjour',storage),true);assert.equal(lireBrouillon('A','principal','1',storage),'Bonjour');
assert.equal(lireBrouillon('B','principal','1',storage),'');assert.equal(lireBrouillon('A','autre','1',storage),'');assert.equal(lireBrouillon('A','principal','2',storage),'');
sauverBrouillon('A','principal','1','Nouveau brouillon',storage);assert.equal(effacerBrouillonSiIdentique('A','principal','1','Bonjour',storage),false);assert.equal(lireBrouillon('A','principal','1',storage),'Nouveau brouillon');
assert.equal(sauverBrouillon('A','principal','1','',storage),true);assert.equal(lireBrouillon('A','principal','1',storage),'');
assert.equal(sauverBrouillon('A','principal','1','x',{setItem(){throw Error('quota');}}),false);
assert.deepEqual(codesRetraitEbay(['code de retrait : 001234','Code d’ouverture AA001234','suivi 1234567','Code de retrait 001234']),['001234','AA001234']);
const order={lineItems:[{quantity:1,lineItemCost:{value:'100',currency:'EUR'},total:{value:'115',currency:'EUR'}}],totalMarketplaceFee:{value:'12.50',currency:'EUR'},totalFeeBasisAmount:{value:'115',currency:'EUR'}};
let b=bilanCommandeEbay(order,{buyPrice:'40',fraisComplets:true,commissionLueConfirmee:'12.50'});assert.equal(b.benefice,47.5);assert.equal(b.complet,true);assert.equal(b.prixArticle,100);
assert.equal(bilanCommandeEbay(order,{buyPrice:'40',fraisComplets:true,commissionLueConfirmee:'10'}).complet,false);
assert.equal(bilanCommandeEbay({...order,lineItems:[{...order.lineItems[0],quantity:2}]}).benefice,null);
assert.equal(bilanCommandeEbay({...order,cancelStatus:{cancelState:'CANCELED'}},{buyPrice:'40',fraisComplets:true}).benefice,null);
assert.equal(bilanCommandeEbay({...order,lineItems:[{quantity:1,total:order.lineItems[0].total}]}).benefice,null);
assert.equal(bilanCommandeEbay({...order,lineItems:[{...order.lineItems[0],discounts:[{}]}]}).benefice,null);
assert.equal(bilanCommandeEbay({...order,lineItems:[{...order.lineItems[0],discountedLineItemCost:{value:'90',currency:'EUR'}}]},{buyPrice:'40'}).benefice,37.5);
for(const change of [{orderPaymentStatus:'PARTIALLY_REFUNDED'},{paymentSummary:{refunds:[{refundAmount:{value:'10',currency:'EUR'}}]}},{cancelStatus:{cancelState:'CANCEL_REQUESTED'}},{cancelStatus:{cancelState:'INCONNU'}}])assert.equal(bilanCommandeEbay({...order,...change},{buyPrice:'40',fraisComplets:true,commissionLueConfirmee:'12.50'}).benefice,null,'remboursement ou annulation ne conserve pas un bénéfice fictivement complet');
assert.equal(bilanCommandeEbay({...order,paymentSummary:{refunds:[]}},{buyPrice:'40',fraisComplets:true,commissionLueConfirmee:'12.50'}).benefice,47.5);
const prev={orders:[{orderId:'old',orderFulfillmentStatus:'NOT_STARTED'},{orderId:'same',orderFulfillmentStatus:'NOT_STARTED'}]},copy=JSON.stringify(prev);
const merged=fusionCommandesEbay(prev,{orders:[{orderId:'same',orderFulfillmentStatus:'FULFILLED'}],total:100,next:'page2'},42);
assert.equal(merged.orders.length,2);assert.equal(merged.orders[1].orderFulfillmentStatus,'FULFILLED');assert.equal(merged.complet,false);assert.equal(JSON.stringify(prev),copy);
assert.equal(fusionCommandesEbay(prev,{orders:[],total:0},42).orders.length,2);assert.equal(fusionCommandesEbay(prev,{orders:[{}]},42),null);
// Exécute la véritable synchronisation serveur contre des services simulés.
const source=fs.readFileSync(new URL('../../api/ebay.js',import.meta.url),'utf8');const start=source.indexOf('async function handleSync('),end=source.indexOf('\n// ── CONFORMITÉ',start);
const writes=[];let failStore=false;
const ctx=vm.createContext({crypto:{randomUUID:()=> 'lecture-test'},fusionCommandesEbay,Date,Set,Object,Number,Promise,jetonDe:async()=>({ok:true,token:'fake'}),EBAY_API:'https://ebay.test',ebayJson:async url=>({ok:true,status:200,data:url.includes('inventory_item')?{inventoryItems:[]}:{orders:[{orderId:'new'}],total:2}}),listeVendeur:async()=>({ok:true,actives:[],programmees:[],complet:true}),tradingGetItem:async()=>null,ligneDe:(id,c)=>id+c.compte.suffixe,storeData:async(id,d,owner)=>{writes.push({id,d,owner});return !failStore;},modifierDonnee:async(id,owner,fn)=>{writes.push({id,d:fn(prev),owner});return !failStore;},resumeProgrammee:x=>x,rangerReglesOffre:async()=>true,apprendrePrincipal:async()=>true,
  // (23 oct.) les inactives sont rangées par leur propre fonction (audit-ebay-route, section 14) : ici, rien à ranger.
  rangerInactives:async()=>false});
vm.runInContext(source.slice(start,end),ctx);
const route=await ctx.handleSync({owner:'vendeur-A',compte:{suffixe:'_autre',principal:false}});
assert.equal(route.body.lu.commandes,true);assert.equal(route.body.complet.commandes,false);assert.equal(writes.find(x=>x.id==='ebay_orders_autre').d.orders.length,3);assert.ok(writes.every(w=>w.owner==='vendeur-A'));
failStore=true;const failed=await ctx.handleSync({owner:'vendeur-A',compte:{suffixe:'_autre',principal:false}});assert.equal(failed.body.lu.commandes,false);assert.equal(failed.body.lu.annonces,false);
console.log('Parcours eBay : accès précis, brouillons cloisonnés, codes, bénéfices et capture partielle vérifiés ; synchronisation serveur exécutée avec services simulés.');

const actions=source.slice(source.indexOf('    const ACTIONS = {'),source.indexOf('    if (!Object.prototype.hasOwnProperty.call(ACTIONS'));
const names=[...actions.matchAll(/^      ([a-z]+):/gm)].map(m=>m[1]);
assert.equal(new Set(names).size,names.length,'aucune action serveur masquée par une clé dupliquée');
assert.ok(names.includes('offre') && names.includes('offredetail'),'envoi aux observateurs et lecture ciblée distincts');
