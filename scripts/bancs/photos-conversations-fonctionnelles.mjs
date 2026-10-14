import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fusionnerConversation} from '../../src/conversations.js';
import {photoArticle,photoCommande,photoVenteVinted} from '../../src/photosArticles.js';
const image='https://images1.vinted.net/t/paire/f800/image.jpeg';
assert.equal(photoArticle({photos:[null,{url:image}]}),image);
assert.equal(photoArticle({photo:{thumbnails:[{}, {url:image}]}}),image);
assert.equal(photoArticle({imageUrls:[image]}),image);
assert.equal(photoCommande({item_id:42},[{id:42,photo:image}]),image);
assert.equal(photoCommande({item_id:42},[{id:42,photo:image},{id:42,photo:image}]),null);
assert.equal(photoCommande({_compte:'B',lineItems:[{legacyItemId:'42'}]},[{itemId:'42',_compte:'A',photo:image}]),null);
const source=fs.readFileSync(new URL('../../vinted-sync-extension/background.js',import.meta.url),'utf8');
const extrait=nom=>{const start=source.indexOf('function '+nom+'(');assert.ok(start>=0);const end=source.indexOf('\n}',start)+2;return source.slice(start,end);};
const ctx=vm.createContext({});vm.runInContext(extrait('photoUtile')+'\n'+extrait('commandeMaigre')+'\n'+extrait('fusionnerConversation'),ctx);
assert.equal(ctx.photoUtile({photo:image}).url,image);
assert.equal(ctx.photoUtile({photos:[null,{url:image}]}).url,image);
assert.equal(ctx.commandeMaigre({transaction_id:1,item:{id:42,photo:{url:image}}}).item_id,42);
assert.equal(ctx.commandeMaigre({transaction_id:1,item:{id:42,photo:{url:image}}}).photo.url,image);
const old={conversation:{id:7,messages:[{entity_type:'status_message',entity:{id:1,body:'Code de retrait 001234',created_at_ts:1}},{entity_type:'message',entity:{id:2,body:'Bonjour',created_at_ts:2}}]}};
const fresh={conversation:{id:7,messages:[{entity_type:'message',entity:{id:2,body:'Bonjour corrigé',created_at_ts:2}},{entity_type:'offer_request_message',entity:{id:3,status:'pending',created_at_ts:3}}]}};
const snapshot=JSON.stringify(old);const merged=ctx.fusionnerConversation(old,fresh);
assert.equal(JSON.stringify(merged),JSON.stringify(fusionnerConversation(old,fresh)),'worker et app partagent la même fusion');
assert.equal(merged.conversation.messages.length,3);
assert.equal(merged.conversation.messages[0].entity.body,'Code de retrait 001234');
assert.equal(merged.conversation.messages[1].entity.body,'Bonjour corrigé');
assert.equal(merged.conversation.messages[2].entity.status,'pending');
assert.equal(JSON.stringify(old),snapshot);
assert.equal(ctx.fusionnerConversation(old,{conversation:{id:8,messages:[]}}),null);
assert.equal(ctx.fusionnerConversation(old,{conversation:{id:7}}),null);
assert.equal(ctx.fusionnerConversation(old,{conversation:{id:7,messages:[]}}).conversation.messages.length,2);
console.log('19 contrôles photos, identité et historique de conversation réussis.');

// Régression : une vente sans photo, liée à une annonce sortie du dressing.
const vente={transaction_id:7,_acc:{vinted_user_id:'111'}};
const archives={[JSON.stringify(['111','42'])]:{photo:image}};
assert.equal(photoVenteVinted(vente,[],42,archives),image);
assert.equal(photoVenteVinted({...vente,_acc:{vinted_user_id:'222'}},[],42,archives),null);
assert.equal(photoVenteVinted(vente,[],null,archives),null);
assert.equal(photoVenteVinted(vente,[{id:42,_acc:{vinted_user_id:'111'},photo:image}],42),image);
assert.equal(photoVenteVinted(vente,[{id:42,_acc:{vinted_user_id:'222'},photo:image}],42),null);
assert.equal(photoArticle({item_photo:{url:image}}),image);
assert.equal(photoArticle({item_photos:[{full_size_url:image}]}),image);
for(const raw of [{item_photo:{url:image}},{photo_url:image},{item_photos:[{full_size_url:image}]}]){
 assert.equal(ctx.commandeMaigre({transaction_id:7,...raw}).photo.url,image,'photo conservée par la capture de commandes');
}
console.log('10 régressions supplémentaires : archives par compte, lien transaction et champs photos conservés.');
