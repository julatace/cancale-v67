// Capture réseau ET HTML initial : vrai Chromium, mondes distincts, vrai fond,
// base simulée. Aucun accès à un compte ni écriture de production.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');const{chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),src=fs.readFileSync(process.env.LBC_BACKGROUND||path.join(root,'vinted-sync-extension/background.js'),'utf8');
const audit=fs.readFileSync(path.join(root,'scripts/audit-lbc-session.cjs'),'utf8'),fixture=audit.slice(audit.indexOf('function faire('),audit.indexOf('const LIES ='));
const ads={ads:[{list_id:701,subject:'Article privé',price:[25],images:{urls:['https://img.leboncoin.fr/701.jpg']}}],recommendations:[{list_id:999,subject:'Tiers',price:[99]}]};
const transaction={purchase_id:778899,is_seller:true,item:{id:701,title:'Article privé',prices:{final:2500,total:2928}},step:{status:'done',label:'Terminée'}};
const identite={account:{account_id:'compte-35',type:'private'},member:{account_id:'compte-35',nickname:{value:'Mon compte'}}};
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});try{for(const mode of ['html-annonces','html-annonces-id-long','html-vente','grosse-reponse','ecriture-refusee','format-inconnu','page-publique'].filter(m=>!process.env.CAS_LBC||process.env.CAS_LBC===m)){
 const compte=mode==='html-annonces-id-long'?'a'.repeat(64):'compte-35';
 const chemin=mode.startsWith('html-annonces')?'/compte/part/mes-annonces':mode==='html-vente'?'/compte/part/transaction/778899':mode==='page-publique'?'/ad/chaussures/701':'/compte/part/mes-transactions';
 const documentUrl='https://www.leboncoin.fr'+chemin;
 const faire=new Function('vm','SRC',fixture.replace("url: 'https://www.leboncoin.fr/'",'url: '+JSON.stringify(documentUrl))+';return faire;')(vm,src),env=faire(),events=[];
 env.ctx.notifierApp=async e=>events.push(e);const vrai=env.ctx.supabaseUpsert;
 if(mode==='ecriture-refusee')env.ctx.supabaseUpsert=(table,rows,...rest)=>rows.some(r=>r.id==='lbc_ventes')?Promise.resolve(false):vrai(table,rows,...rest);
 const p=await b.newPage(),htmlData=mode==='html-vente'?{props:{pageProps:{transaction}}}:{props:{pageProps:{ads:ads.ads,recommendations:ads.recommendations}}};
 await p.route('https://www.leboncoin.fr/**',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(htmlData)}</script></body>`}));
 await p.route('https://api.leboncoin.fr/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(r.request().url().includes('members/me/account')?{...identite,account:{...identite.account,account_id:compte},member:{...identite.member,account_id:compte}}:mode==='format-inconnu'?{inconnu:true}:{pageProps:{messages:{gros:'a'.repeat(2000000)},transaction}})}));
 await p.goto(documentUrl);const c=await p.context().newCDPSession(p),tree=await c.send('Page.getFrameTree'),{executionContextId:id}=await c.send('Page.createIsolatedWorld',{frameId:tree.frameTree.frame.id,worldName:'vrm-revue'});
 await c.send('Runtime.addBinding',{name:'bancEnvoyer',executionContextId:id});const messages=[],reponses=[];
 c.on('Runtime.bindingCalled',async e=>{if(e.name!=='bancEnvoyer')return;const{n,m}=JSON.parse(e.payload);messages.push(m);const r=await env.envoyer(m);reponses.push({action:m.action,r});try{await c.send('Runtime.evaluate',{contextId:id,expression:`globalThis.__retours[${n}]?.(${JSON.stringify(r||{ok:false})});delete globalThis.__retours[${n}];`});}catch(_){}});
 await c.send('Runtime.evaluate',{contextId:id,expression:`globalThis.__retours={};let n=0;globalThis.chrome={runtime:{id:'banc',sendMessage:(m,cb)=>{const i=++n;__retours[i]=cb||(()=>{});bancEnvoyer(JSON.stringify({n:i,m}));}}};`});
 await c.send('Runtime.evaluate',{contextId:id,expression:fs.readFileSync(path.join(root,'vinted-sync-extension/lbc-relay.js'),'utf8')});
 await p.evaluate(fs.readFileSync(process.env.LBC_INJECT||path.join(root,'vinted-sync-extension/lbc-inject.js'),'utf8'));
 await p.evaluate(()=>fetch('https://api.leboncoin.fr/api/account/v2/members/me/account'));
 if(['grosse-reponse','ecriture-refusee','format-inconnu'].includes(mode))await p.evaluate(()=>fetch('https://api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/778899'));
 const fin=Date.now()+6000;while(Date.now()<fin){if(mode.startsWith('html-annonces')&&env.base.lbc_listings?.items?.['701'])break;if(!mode.startsWith('html-annonces')&&reponses.some(x=>x.action==='lbcVente'))break;if(mode==='page-publique')break;await new Promise(r=>setTimeout(r,25));}
 if(mode.startsWith('html-annonces')){assert.equal(env.base.lbc_listings.items['701'].account,'lbc-account:'+compte);assert.equal(env.base.lbc_listings.items['701'].images[0],'https://img.leboncoin.fr/701.jpg');assert.equal(env.base.lbc_listings.items['999'],undefined);assert(events.some(e=>e.quoi==='lbc'));}
 else if(mode==='page-publique'){assert.equal(env.base.lbc_listings,undefined);assert.equal(env.base.lbc_ventes,undefined);}
 else{const r=reponses.find(x=>x.action==='lbcVente')?.r;assert(r,'accusé attendu');if(['ecriture-refusee','format-inconnu'].includes(mode)){assert.equal(r.ok,false);assert.equal(env.base.lbc_ventes,undefined);assert.equal(events.some(e=>e.quoi==='lbc'),false);}else{assert.equal(r.ok,true);assert.equal(r.etat,'enregistre');assert.equal(env.base.lbc_ventes.ventes['778899'].price,2500);assert.equal(env.base.lbc_ventes.ventes['778899'].isSeller,true);assert(events.some(e=>e.quoi==='lbc'));assert.equal(messages.some(m=>m.body?.includes('a'.repeat(10000))),false);}}
 if(['html-vente','grosse-reponse'].includes(mode)){await p.waitForFunction(()=>JSON.parse(localStorage.getItem('vrm_lbc_detail_vus')||'{}')['778899']?.preuve==='detail-integre-v1');}
 if(['ecriture-refusee','format-inconnu'].includes(mode))assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('vrm_lbc_detail_vus')||'{}')['778899']),undefined);
 console.log('OK '+mode);try{vm.runInContext('clearTimeout(_lbcReconMinuteur)',env.ctx);}catch(_){}await p.close();
 }}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
