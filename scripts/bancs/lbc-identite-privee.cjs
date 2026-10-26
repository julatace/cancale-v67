// MAIN + monde isolé réels, vrai background dans une base simulée. Aucun accès utilisateur.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const{chromium}=require('playwright');
const racine=path.resolve(__dirname,'../..'),src=fs.readFileSync(path.join(racine,'vinted-sync-extension/background.js'),'utf8');
const audit=fs.readFileSync(path.join(racine,'scripts/audit-lbc-session.cjs'),'utf8');
const fixture=audit.slice(audit.indexOf('function faire('),audit.indexOf('const LIES ='));
const faire=new Function('vm','SRC',fixture+';return faire;')(vm,src);
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});try{
 const env=faire(),ecrire=env.ctx.supabaseUpsert;
 const httpRefuse=process.env.BANC_HTTP_REFUSE==='1';
 const refuser=process.env.BANC_REFUSER_IDENTITE==='1',envoyer=env.envoyer;if(refuser)env.envoyer=m=>m.action==='lbcSessionPrivee'?Promise.resolve({ok:false}):envoyer(m);env.ctx.supabaseUpsert=async(...args)=>{await new Promise(r=>setTimeout(r,150));return ecrire(...args);};
 const p=await b.newPage();await p.route('https://www.leboncoin.fr/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body>Mes annonces</body>'}));
 await p.route('https://api.leboncoin.fr/**',r=>r.fulfill({status:httpRefuse&&r.request().url().includes('members/me/account')?403:200,contentType:'application/json',body:JSON.stringify(r.request().url().includes('members/me/account')?{account:{account_id:'compte-35',type:'private'},member:{account_id:'compte-35',nickname:{value:'Mon compte'},contact:{email:'NE-PAS-TRANSMETTRE@exemple.test'}}}:{ads:[{list_id:7,subject:'Article de test',price:[35],owner:{user_id:'aaaa1111-0000-4000-8000-000000000001'},images:{urls:['https://img.leboncoin.fr/photo-test.jpg']}}],recommendations:[{list_id:99,subject:'Recommandation tierce',price:[1]}]})}));
 await p.goto('https://www.leboncoin.fr/compte/part/mes-annonces');const c=await p.context().newCDPSession(p),tree=await c.send('Page.getFrameTree');
 const{executionContextId:id}=await c.send('Page.createIsolatedWorld',{frameId:tree.frameTree.frame.id,worldName:'vrm-relais-test'});
 await c.send('Runtime.addBinding',{name:'bancEnvoyer',executionContextId:id});const transmis=[];
 c.on('Runtime.bindingCalled',async e=>{if(e.name!=='bancEnvoyer')return;const{n,m}=JSON.parse(e.payload);transmis.push(m);const r=await env.envoyer(m);try{await c.send('Runtime.evaluate',{contextId:id,expression:`globalThis.__retours[${n}]?.(${JSON.stringify(r||{ok:false})});delete globalThis.__retours[${n}];`});}catch(_){}});
 await c.send('Runtime.evaluate',{contextId:id,expression:`globalThis.__retours={};let n=0;globalThis.chrome={runtime:{id:'banc',sendMessage:(m,cb)=>{const i=++n;__retours[i]=cb||(()=>{});bancEnvoyer(JSON.stringify({n:i,m}));}}};`});
 await c.send('Runtime.evaluate',{contextId:id,expression:fs.readFileSync(process.env.LBC_RELAY||path.join(racine,'vinted-sync-extension/lbc-relay.js'),'utf8')});
 await p.evaluate(fs.readFileSync(process.env.LBC_INJECT||path.join(racine,'vinted-sync-extension/lbc-inject.js'),'utf8'));
 // Le navigateur reçoit les annonces pendant que l'identité s'enregistre encore.
 await p.evaluate(async avant=>{if(avant)await fetch('https://api.leboncoin.fr/api/adfinder/v2/myads');await fetch('https://api.leboncoin.fr/api/account/v2/members/me/account');if(!avant)await fetch('https://api.leboncoin.fr/api/adfinder/v2/myads');},process.env.BANC_ANNONCES_AVANT==='1');
 const fin=Date.now()+5000;while(!env.base.lbc_listings?.items?.['7']&&Date.now()<fin)await new Promise(r=>setTimeout(r,25));
 if(httpRefuse){assert.equal(env.base.lbc_accounts,undefined);assert.equal(env.base.lbc_listings,undefined);assert.equal(transmis.some(m=>m.action==='lbcSessionPrivee'),false);console.log('OK : réponse HTTP 403 ignorée même avec un corps ressemblant à une identité privée.');return;}
 if(refuser){assert.equal(env.base.lbc_listings,undefined);assert.equal(transmis.some(m=>m.action==='lbcRaw'),false);assert.equal(env.local.vrmLbcTransport?.[1]?.erreurCapture,'identite');console.log('OK : identité refusée, aucune annonce envoyée sous un compte non confirmé, diagnostic explicite.');return;}
 assert.equal(env.base.lbc_accounts?.accounts?.['lbc-account:compte-35']?.name,'Mon compte');
 assert.equal(env.base.lbc_listings?.items?.['7']?.account,'lbc-account:compte-35');assert.equal(env.base.lbc_listings.items['7'].images[0],'https://img.leboncoin.fr/photo-test.jpg');
 assert.equal(env.base.lbc_listings.items['99'],undefined);assert.equal(JSON.stringify(transmis).includes('NE-PAS-TRANSMETTRE'),false);
 assert.equal(transmis.some(m=>m.action==='lbcMsgCompteur'),false);
 console.log('OK : identité privée sans compteur, mondes séparés, écriture lente, annonce/photo attribuées, recommandation et email exclus.');
 }finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
