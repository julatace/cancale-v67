import assert from 'node:assert/strict';
import {fusionCommandesEbay,fusionPageCommandesEbay} from '../../api/_lib/ebay-synchronisation.js';
import {creerLectureCommandesEbay} from '../../api/_lib/ebay-commandes-pages.js';
const row=id=>({orderId:String(id)}),first={orders:[row(1),row(2)],offset:0,limit:2,total:3,next:'https://api.ebay.com/sell/fulfillment/v1/order?offset=2&limit=2'};
const previous=fusionCommandesEbay({orders:[row('ancien')]},first,1,'gen1');
assert.equal(previous.pagination.nextOffset,2);assert.equal(previous.complet,false);
const second={orders:[row(3)],offset:2,limit:2,total:3};
const complete=fusionPageCommandesEbay(previous,second,2,2,'gen1');
assert.equal(complete.complet,true);assert.equal(complete.pagination.lues,3);assert.equal(complete.orders.length,4);
assert.equal(fusionPageCommandesEbay(previous,second,2,2,'autre-generation'),null);
assert.equal(fusionPageCommandesEbay(previous,{...second,offset:50},2,2,'gen1'),null);
assert.equal(fusionPageCommandesEbay(previous,{...second,total:4},2,2,'gen1').complet,false);
assert.equal(fusionPageCommandesEbay(previous,{...second,orders:[row(2)]},2,2,'gen1').complet,false);
for(const next of ['https://evil.example/sell/fulfillment/v1/order?offset=2','https://api.ebay.com/other?offset=2','https://api.ebay.com/sell/fulfillment/v1/order?offset=4'])assert.equal(fusionCommandesEbay(null,{...first,next},1,'gen1').pagination.issue,'pagination');
const serviceFirst=fusionCommandesEbay({orders:[row('ancien')]},{orders:Array.from({length:50},(_,i)=>row(i+1)),offset:0,limit:50,total:51,next:'https://api.ebay.com/sell/fulfillment/v1/order?offset=50&limit=50'},1,'gen1');
const serviceSecond={orders:[row(51)],offset:50,limit:50,total:51};
function banc({read=serviceFirst,failPage=false,failWrite=false,changeDuringRead=false}={}){
 let state=structuredClone(read),gets=[],writes=[];
 const charger=creerLectureCommandesEbay({apiOrigin:'https://api.ebay.com',identifier:()=> 'gen2',lire:async(id,owner)=>{gets.push({id,owner});if(state==null)return state;const {rev,capturedAt,pagination}=state;const {generation,nextOffset,complete,lues,total}=pagination || {};return {rev,capturedAt,...(pagination?{pagination:{generation,nextOffset,complete,lues,total}}:{})};},jeton:async ctx=>({ok:true,token:ctx.owner+ctx.compte.suffixe}),json:async(url,token)=>{gets.push({url,token});if(changeDuringRead)state={...state,rev:99};return {ok:!failPage,data:serviceSecond};},modifier:async(id,owner,fn)=>{if(failWrite)return false;const result=fn(state);if(result!==undefined){writes.push({id,owner});state=result;}return true;}});
 return {charger,gets,writes,state:()=>state};
}
const ctx={owner:'vendeur-A',compte:{suffixe:'_secondaire'}};
let b=banc(),r=await b.charger(ctx);assert.equal(r.body.complete,true);assert.equal(b.writes[0].id,'ebay_orders_secondaire');assert.equal(b.writes[0].owner,'vendeur-A');assert.ok(b.gets[1].url.endsWith('limit=50&offset=50'));assert.equal(b.gets[1].token,'vendeur-A_secondaire');assert.equal(b.state().orders.length,52);assert.equal(b.state().pagination.ids.length,51);
for(const options of [{read:undefined},{failPage:true},{failWrite:true},{changeDuringRead:true}]){
 // Destructure default values separately for the unreadable-store scenario.
 if(options.read===undefined && Object.hasOwn(options,'read')){
  let tokens=0;const charger=creerLectureCommandesEbay({lire:async()=>undefined,jeton:async()=>{tokens++;},modifier:async()=>{throw Error('écriture interdite');}});r=await charger(ctx);assert.equal(r.body.ok,false);assert.equal(tokens,0);continue;
 }
 b=banc(options);r=await b.charger(ctx);assert.equal(r.body.ok,false);assert.equal(b.writes.length,0);
}
b=banc({read:complete});r=await b.charger(ctx);assert.equal(r.body.deja,true);assert.equal(b.gets.length,1);assert.equal(b.writes.length,0);
console.log('Pagination eBay : fusion, couverture, déplacement de liste, compte, concurrence et échecs vérifiés.');

const pasConnecte=creerLectureCommandesEbay({lire:async()=>null,jeton:async()=>({ok:false,status:401,reason:'not-connected',error:'Compte non relié'}),json:async()=>{throw Error('Aucun appel eBay autorisé');}});
const refuse=await pasConnecte(ctx);assert.equal(refuse.status,401);assert.equal(refuse.body.reason,'not-connected');
