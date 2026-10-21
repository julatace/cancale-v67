import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {qrMfa} from '../../src/qrMfa.js';
const app=fs.readFileSync('src/App.jsx','utf8'),ext=fs.readFileSync('vinted-sync-extension/background.js','utf8');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const extraire=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const auth=()=>({user:{id:A},session:{access_token:'token-a'}});
test('liste des comptes : filtre obligatoire, rejet d’un propriétaire étranger et réponse périmée',async()=>{
 const code=extraire(app,'const fetchVintedAccounts =','// Retire un compte de');
 for(const mode of ['bon','etranger','sans-owner','bascule']){
  const c=vm.createContext({AUTH:auth(),SUPABASE_URL:'https://base.test',encodeURIComponent,sbAuth:()=>({Authorization:'Bearer token-a'}),fetch:async(url)=>{
   assert.equal(new URL(url).searchParams.get('owner'),'eq.'+A);
   if(url.includes('/vinted_accounts')){if(mode==='bascule')c.AUTH=authB();return Response.json([{owner:mode==='etranger'?B:mode==='sans-owner'?undefined:A,vinted_user_id:'42'}]);}return Response.json([]);
  }});vm.runInContext(code+';globalThis.lire=fetchVintedAccounts;',c);
  const r=await c.lire();assert.equal(mode==='bon'?r.length:r,mode==='bon'?1:null);
 }
 function authB(){return {user:{id:B},session:{access_token:'token-b'}};}
});
test('les sauvegardes différées du vendeur A ne sont pas écrites après une bascule vers B dans un autre onglet',()=>{
 const code=extraire(app,'let _saveTimers = {}','// localStorage est partagé entre les onglets');let travail,ecrit=0;
 const c=vm.createContext({AUTH:auth(),readSession:()=>({user:{id:B}}),setTimeout:fn=>(travail=fn,1),clearTimeout(){},localStorage:{setItem(){ecrit++;}},SYNC_KEYS:[],window:{dispatchEvent(){}},CustomEvent:class{},cloudPush(){throw Error('Interdit');}});
 vm.runInContext(code+';globalThis.sauver=save;',c);c.sauver('vinted_sales',[{id:'vente-a'}]);travail();assert.equal(ecrit,0);
});
test('cloud privé : jamais choisir la première ligne de plusieurs boutiques',async()=>{
 const code=extraire(app,'const cloudLoad =','// Envoie TOUT le contenu local');
 const c=vm.createContext({AUTH:auth(),SUPABASE_URL:'https://base.test',SUPABASE_ROW:'main',encodeURIComponent,sbAuth:()=>({}),fetch:async url=>{assert.equal(new URL(url).searchParams.get('owner'),'eq.'+A);return Response.json([{owner:A,data:{}},{owner:B,data:{secret:'autre'}}]);}});
 vm.runInContext(code+';globalThis.lire=cloudLoad;',c);assert.equal(await c.lire(),undefined);
});
test('extension : aucune lecture anonyme ni retour des comptes d’une session remplacée',async()=>{
 const code=extraire(ext,'async function getStoredAccounts(opts)','// ── FETCH ACTIF');
 for(const mode of ['absente','bon','etranger','bascule']){
  let lectures=0;
  const c=vm.createContext({authToken:async()=>mode==='absente'?null:{user_id:A,access_token:'token-a'},loadSession:async()=>({user_id:mode==='bascule'?B:A}),SUPABASE_URL:'https://base.test',SUPABASE_KEY:'anon',encodeURIComponent,fetch:async(url,{headers})=>{lectures++;assert.equal(new URL(url).searchParams.get('owner'),'eq.'+A);assert.equal(headers.Authorization,'Bearer token-a');return Response.json([{owner:mode==='etranger'?B:A}]);}});
  vm.runInContext(code,c);const r=await c.getStoredAccounts({ouNull:true});assert.equal(mode==='bon'?r.length:r,mode==='bon'?1:null);if(mode==='absente')assert.equal(lectures,0);
 }
});
test('QR TOTP généré localement depuis l’URI native ; aucune URL externe acceptée',()=>{
 const secret='JBSWY3DPEHPK3PXP';const qr=qrMfa({secret,uri:`otpauth://totp/VRM:test?secret=${secret}&issuer=VRM`});assert.match(qr,/^data:image\/gif;base64,/);assert.ok(qr.length>100);assert.equal(qrMfa({qr_code:'https://externe.test/secret'}),'');assert.equal(qrMfa({secret:'DIFFERENT',uri:`otpauth://totp/VRM?secret=${secret}`}), '');
});
test('proxy et renouvellement refusent une ligne étrangère même si la base ne filtre pas',async()=>{
 const original=global.fetch;
 try{
  const {default:proxy}=await import('../../api/vinted-proxy.js');
  const {default:refresh}=await import('../../api/vinted-refresh.js');
  for(const route of [proxy,refresh]){
   let vinted=0;
   global.fetch=async(url,opts={})=>{
    if(String(url).includes('/auth/v1/user'))return Response.json({id:A,email:'a@example.test'});
    if(String(url).includes('/rest/v1/vinted_accounts')){assert.equal(new URL(url).searchParams.get('owner'),'eq.'+A);return Response.json([{owner:B,vinted_user_id:'42',access_token:'autre',refresh_token:'secret'}]);}
    vinted++;throw Error('Aucune requête externe permise');
   };
   const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(j){this.body=j;return this;}};
   await route({method:'POST',headers:{authorization:'Bearer aa.bb.cc'},body:{uid:'42',endpoint:'/api/v2/users/current'}},res);
   assert.ok(res.code===403||res.code===503);assert.equal(vinted,0);assert.equal(res.headers['Cache-Control'],'no-store');assert.equal(JSON.stringify(res.body).includes('secret'),false);
  }
 }finally{global.fetch=original;}
});
