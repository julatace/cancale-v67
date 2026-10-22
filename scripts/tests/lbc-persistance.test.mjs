import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
const src=fs.readFileSync(new URL('../../vinted-sync-extension/background.js',import.meta.url),'utf8'),audit=fs.readFileSync(new URL('../audit-lbc-session.cjs',import.meta.url),'utf8');
const fixture=audit.slice(audit.indexOf('function faire('),audit.indexOf('const LIES ='));
const faire=new Function('vm','SRC',fixture+';return faire;')(vm,src);
test('deux onglets ne perdent ni leurs comptes ni leurs annonces lors de captures simultanées',async()=>{
 const e=faire();e.ctx.noterDiag=()=>{};
 const a=await Promise.all([e.ctx.storeLbcAccount({id:'a',name:'A',session:true}),e.ctx.storeLbcAccount({id:'b',name:'B',session:true})]);assert.deepEqual(a,[true,true]);assert.equal(Object.keys(e.base.lbc_accounts.accounts).length,2);
 await Promise.all([e.ctx.storeLbcListings('https://www.leboncoin.fr', [{id:1,subject:'A',price:1,images:[]}]),e.ctx.storeLbcListings('https://www.leboncoin.fr',[{id:2,subject:'B',price:2,images:[]}])]);assert.equal(Object.keys(e.base.lbc_listings.items).length,2);
});
test('une bascule de compte VRM entre lecture et écriture ne réattribue pas les anciennes données',async()=>{
 for(const famille of ['compte','annonces','transactions']){
 const e=faire();e.ctx.noterDiag=()=>{};let owner='a';const session=async()=>({access_token:'jeton-test',user_id:owner,expires_at:Date.now()+3600e3});e.ctx.authToken=session;e.ctx.loadSession=session;
 const lire=e.ctx.sbGet;e.ctx.sbGet=async q=>{const r=await lire(q);owner='b';return r;};
 const r=famille==='compte'?await e.ctx.storeLbcAccount({id:'secret',name:'Nom privé',courant:true,source:'session:messagerie'}):famille==='annonces'?await e.ctx.storeLbcListings('https://www.leboncoin.fr',[{id:1,subject:'Article privé'}]):await e.ctx.rangerLbcVentes([{txId:'42',isSeller:true,price:2500}]);
 assert.equal(typeof r==='object'?r.ok:r,false,famille);assert.equal(e.ecrits.length,0,famille);assert.equal(e.local.vrmLbcCompte,undefined,famille);
 }
});

test('le tampon technique d’un ancien vendeur ne part pas dans le compte suivant',async()=>{
 const e=faire();e.ctx.noterDiag=()=>{};let owner='a';const session=async()=>({access_token:'jeton-test',user_id:owner,expires_at:Date.now()+3600e3});e.ctx.authToken=session;e.ctx.loadSession=session;
 const lire=e.ctx.sbGet;e.ctx.sbGet=async()=>null;
 await e.ctx.storeLbcRecon({sample:{body:'PRIVE_ANCIEN_VENDEUR'}});assert.equal(e.local.vrmLbcReconTampon.owner,'a');
 owner='b';e.ctx.sbGet=lire;await e.ctx.storeLbcRecon({schemaOne:{endpoint:'api.leboncoin.fr/api/adfinder/v2/myads',cles:['ads[].id:number']}});
 assert.equal(e.local.vrmLbcReconTampon.owner,'b');assert.equal(JSON.stringify(e.ecrits).includes('PRIVE_ANCIEN_VENDEUR'),false);
 vm.runInContext('clearTimeout(_lbcReconMinuteur)',e.ctx);
});

test('le capteur conserve aussi le propriétaire fixé avant les lectures de preuve',async()=>{
 const e=faire();e.ctx.noterDiag=()=>{};let owner='a';const session=async()=>({access_token:'jeton-test',user_id:owner,expires_at:Date.now()+3600e3});e.ctx.authToken=session;e.ctx.loadSession=session;
 e.ctx.comptesMiens=async()=>{owner='b';return new Set();};e.ctx.sessionDeListe=async()=>({id:'lbc-account:compte',name:'Compte privé',prive:true});
 const r=await e.ctx.handleLbcRaw('https://api.leboncoin.fr/api/adfinder/v2/myads',JSON.stringify({ads:[{list_id:7,subject:'Article privé',price:[25]}]}),'lbc-account:compte');
 assert.equal(r.ok,false);assert.equal(e.ecrits.length,0);
});
