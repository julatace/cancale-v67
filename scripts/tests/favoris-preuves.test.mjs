import test from 'node:test';import assert from 'node:assert/strict';
import {lirePreuvesConversationsFavoris} from '../../api/_lib/favoris-preuves.js';
import {resoudreCiblesFavoris} from '../../api/_lib/favoris-cibles.js';
const uid='123',owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const capture={uid,type:'notifications',domain:'www.vinted.fr',payload:{notifications:[{id:'n1',user_id:201,body:'Camille a ajouté ton article à ses favoris.',link:'/items/101/conversation/new?from_notification=true'},{id:'n2',user_id:202,body:'Camille a ajouté ton article à ses favoris.',link:'/items/102/conversation/new?from_notification=true'}]}};
const trace={uid,method:'POST',path:'/api/v2/conversations',body:JSON.stringify({initiator:'native',item_id:999,opposite_user_id:888})};
const row={id:'harvest_123_conv_900',owner,uid,conversationId:'900',item:'101',transactionItem:null,nestedItem:null,recipient:'201'};
const req={headers:{authorization:'Bearer fixture'}},opts={uid,owner,capture,selection:['n1','n2']};
test('une conversation native captée prouve le couple exact même si la dernière création concerne un autre article',()=>{
 assert.throws(()=>resoudreCiblesFavoris({...opts,trace}),e=>e.code==='favoris_preuve_absente');
 const conversations=[{uid,conversationId:'900',itemId:'101',recipientId:'201'}];
 const r=resoudreCiblesFavoris({...opts,trace,conversations});assert.equal(r.length,2);assert.deepEqual(r.map(x=>x.recipientId),['201','202']);assert.equal(resoudreCiblesFavoris({...opts,selection:['n2'],trace,conversations})[0].recipientId,'202','une paire native d’un autre favori conservé peut confirmer la même forme');
 for(const faux of [{...conversations[0],uid:'999'},{...conversations[0],recipientId:'888'},{...conversations[0],itemId:'777'},{...conversations[0],conversationId:'invalide'}])assert.throws(()=>resoudreCiblesFavoris({...opts,trace,conversations:[faux]}));
 assert.throws(()=>resoudreCiblesFavoris({...opts,trace:{...trace,uid:'999'},conversations}));
});
test('le repli lit seulement les identifiants natifs des favoris conservés sous RLS',async()=>{
 const ancien=global.fetch;let appel;
 global.fetch=async(url,o)=>{appel={u:new URL(url),o};return new Response(JSON.stringify([row]));};
 try{
  const p=await lirePreuvesConversationsFavoris(req,opts);assert.deepEqual(p,[{uid,conversationId:'900',itemId:'101',recipientId:'201'}]);
  assert.equal(appel.u.searchParams.get('owner'),'eq.'+owner);assert.equal(appel.u.searchParams.get('id'),'like.harvest_123_conv_*');assert.equal(appel.u.searchParams.get('limit'),'100');assert.ok(appel.u.searchParams.get('or').includes('in.(101,102)'));
  assert.equal(appel.u.hostname.includes('vinted'),false);assert.equal(appel.o.method,undefined);assert.equal(appel.o.headers.Authorization,'Bearer fixture');assert.equal(appel.u.searchParams.get('select').includes('messages'),false);
 }finally{global.fetch=ancien;}
});
test('preuves incohérentes, autre compte ou panne ne deviennent pas une preuve',async()=>{
 const ancien=global.fetch;
 try{
  for(const faux of [{...row,uid:'456'},{...row,id:'harvest_123_conv_901'},{...row,transactionItem:'999'},{...row,recipient:'123'},{...row,conversationId:null}]){
   global.fetch=async()=>new Response(JSON.stringify([faux]));assert.deepEqual(await lirePreuvesConversationsFavoris(req,opts),[]);
  }
  global.fetch=async()=>new Response(JSON.stringify([{...row,owner:'autre'}]));await assert.rejects(lirePreuvesConversationsFavoris(req,opts));
  global.fetch=async()=>new Response('{}',{status:503});await assert.rejects(lirePreuvesConversationsFavoris(req,opts));
 }finally{global.fetch=ancien;}
});
