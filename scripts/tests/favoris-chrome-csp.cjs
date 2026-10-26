// Real Chromium page and strict CSP, with native traffic fully simulated.
// The managed browser forbids installing unpacked extensions. This verifies
// the MAIN hook at document start and the manifest declaration separately;
// it does NOT claim to test an installed extension end to end.
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{const root=path.resolve(process.env.SOURCE_EXTENSION||'vinted-sync-extension'),manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8')),src=fs.readFileSync(path.join(root,'inject.js'),'utf8');
 assert.ok(manifest.content_scripts.some(s=>s.js.includes('inject.js')&&s.world==='MAIN'&&s.run_at==='document_start'),'the manifest must install the hook in MAIN before native scripts');let n=1;
 const b=await chromium.launch({executablePath:(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),headless:true,proxy:{server:'http://127.0.0.1:1'},args:['--no-sandbox']});
 try{for(const main of [false,true]){const c=await b.newContext();let requetes=0;
 await c.route('https://**/*',r=>{const u=new URL(r.request().url());if(u.hostname!=='www.vinted.fr')return r.abort();
  if(u.pathname==='/api/v2/conversations'){requetes++;return r.fulfill({status:200,contentType:'application/json',body:'{"code":0,"conversation":{"id":900}}'});}
  if(u.pathname==='/inject-fixture.js')return r.fulfill({status:200,contentType:'text/javascript',body:src});
  if(u.pathname.startsWith('/items/'))return r.fulfill({status:200,contentType:'text/html',headers:{'content-security-policy':"script-src 'nonce-native'; connect-src 'self'; object-src 'none'"},body:`<!doctype html><title>Native fixture</title><script nonce="native">${main?'':"const s=document.createElement('script');s.src='/inject-fixture.js';document.head.append(s);"}window.nativeBody=JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201});window.resultat=fetch(new Request('/api/v2/conversations',{method:'POST',body:window.nativeBody}));history.replaceState({},'', '/inbox/900');</script>`});
  return r.fulfill({status:200,contentType:'application/json',body:'{}'});
 });
 await c.addInitScript({content:`window.__captures=[];window.__readyNative=false;window.addEventListener('message',e=>{if(e.source!==window)return;if(e.data?.kind==='injectReady')window.__readyNative=true;if(e.data?.kind==='writereq')window.__captures.push(e.data);});\n${main?src:''}`});
 const p=await c.newPage();await p.goto('https://www.vinted.fr/items/101/conversation/new?native_target=201');await p.evaluate(()=>window.resultat);if(main)await p.waitForFunction(()=>window.__captures.length>0);else await p.waitForTimeout(150);
 assert.equal(await p.evaluate(()=>window.__readyNative),main,'MAIN readiness reaches the page relay');n++;
 const captures=await p.evaluate(()=>window.__captures);assert.equal(requetes,1,'observation adds no native API request');n++;
 assert.equal(captures.length,main?1:0,main?'MAIN hook survives CSP':'legacy DOM script is blocked by nonce-only CSP');n++;
 if(main){assert.equal(captures[0].body,await p.evaluate(()=>window.nativeBody));n++;assert.equal(captures[0].contexteFavori,'https://www.vinted.fr/items/101/conversation/new?native_target=201');n++;}
 await c.close();}}finally{await b.close();}console.log(n+' contrôles Chrome / CSP / hook MAIN réussis (extension installée non testée)');
})().catch(e=>{console.error(e);process.exitCode=1;});
