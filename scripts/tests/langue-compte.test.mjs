// (8 nov.) La langue des e-mails de compte : 'fr' ou 'en', jamais par-dessus une langue rangée.
import test from 'node:test';import assert from 'node:assert/strict';
import {langueNavigateur,langueRangee,poserLangueUneFois} from '../../src/langueCompte.js';
test('fr ou en seulement, français par défaut',()=>{
 assert.equal(langueNavigateur({languages:['en-GB'],language:'en-GB'}),'en');
 assert.equal(langueNavigateur({language:'en'}),'en');
 for(const l of ['fr-FR','de-DE','es','','engl']) assert.equal(langueNavigateur({language:l}),'fr');
 assert.equal(langueNavigateur(null),'fr');
 assert.equal(langueRangee({user_metadata:{langue:'de'}}),null);
});
const stockage=()=>{const o={};return{getItem:k=>o[k]??null,setItem:(k,v)=>{o[k]=String(v);},o};};
test('écrite une fois, seulement si absente ; une lecture ratée n’écrit rien',async()=>{
 const appels=[];const st=stockage();
 const fetcher=(user)=>async(url,init={})=>{appels.push(init.method||'GET');if(!init.method)return user?{ok:true,json:async()=>user}:{ok:false,json:async()=>({})};return{ok:true,json:async()=>({})};};
 const base={url:'https://p.supabase.co',cle:'k',jeton:'t',uid:'u1',stockage:st,nav:{language:'en-US'}};
 assert.equal(await poserLangueUneFois({...base,fetcher:fetcher(null)}),'pas-su');assert.deepEqual(appels,['GET']);assert.equal(st.o.vrm_langue_posee,undefined);
 appels.length=0;assert.equal(await poserLangueUneFois({...base,fetcher:fetcher({id:'u1',user_metadata:{langue:'fr'}})}),'pose');assert.deepEqual(appels,['GET']);
 assert.equal(await poserLangueUneFois({...base,fetcher:fetcher({id:'u1'})}),'deja');
 const st2=stockage();let corps=null;appels.length=0;
 await poserLangueUneFois({...base,stockage:st2,fetcher:async(url,init={})=>{appels.push(init.method||'GET');if(init.method)corps=JSON.parse(init.body);return{ok:true,json:async()=>({id:'u1',user_metadata:{}})};}});
 assert.deepEqual(appels,['GET','PUT']);assert.deepEqual(corps,{data:{langue:'en'}});assert.equal(st2.o.vrm_langue_posee,'u1');
 assert.equal(await poserLangueUneFois({...base,jeton:''}),'sans-session');
});
