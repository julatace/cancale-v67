// Les vrais scripts MAIN et relais, dans un navigateur. Aucune requête Leboncoin réelle.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const{chromium}=require('playwright');const root=path.resolve(__dirname,'../..');
const inject=fs.readFileSync(process.env.LBC_INJECT||path.join(root,'vinted-sync-extension/lbc-inject.js'),'utf8'),relay=fs.readFileSync(path.join(root,'vinted-sync-extension/lbc-relay.js'),'utf8');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});try{for(const ordre of ['capteur-avant','relais-avant']){
 const p=await browser.newPage();await p.route('https://www.leboncoin.fr/**',r=>r.fulfill({contentType:'text/html',body:'<html><body></body></html>'}));await p.goto('https://www.leboncoin.fr/');
 await p.evaluate(()=>{window.relayes=[];window.chrome={runtime:{sendMessage:(m,cb)=>{window.relayes.push(m);cb?.({ok:true});}}};window.fetch=async()=>new Response(JSON.stringify({unread:3}),{headers:{'content-type':'application/json'}});});
 const charge=()=>p.evaluate(async()=>{await fetch('https://api.leboncoin.fr/messaging/proxy/api/hal/aaaa1111-0000-4000-8000-000000000001/counter');await new Promise(r=>setTimeout(r,40));});
 if(ordre==='capteur-avant'){await p.addScriptTag({content:inject});await charge();assert.equal(await p.evaluate(()=>window.relayes.length),0);await p.addScriptTag({content:relay});}else{await p.addScriptTag({content:relay});await p.addScriptTag({content:inject});await charge();}
 await p.waitForFunction(()=>window.relayes.some(m=>m.action==='lbcMsgCompteur'),null,{timeout:2500});
 assert.equal(await p.evaluate(()=>window.relayes.filter(m=>m.action==='lbcMsgCompteur').length),1);
 // Un second accusé ne rejoue pas les réponses et un script réinjecté ne double pas les abonnements.
 await p.addScriptTag({content:relay});await p.evaluate(()=>window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*'));await p.waitForTimeout(50);
 assert.equal(await p.evaluate(()=>window.relayes.filter(m=>m.action==='lbcMsgCompteur').length),1);
 await charge();assert.equal(await p.evaluate(()=>window.relayes.filter(m=>m.action==='lbcMsgCompteur').length),2);
 await p.route('https://api.leboncoin.fr/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({unread:3})}));
 await p.evaluate(async()=>{await fetch(new URL('https://api.leboncoin.fr/messaging/proxy/api/hal/aaaa1111-0000-4000-8000-000000000001/counter'));});
 await p.waitForFunction(()=>window.relayes.filter(m=>m.action==='lbcMsgCompteur').length===3,null,{timeout:2500});
 await p.evaluate(()=>new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET','https://api.leboncoin.fr/messaging/proxy/api/hal/aaaa1111-0000-4000-8000-000000000001/counter');x.responseType='json';x.onload=resolve;x.onerror=reject;x.send();}));
 await p.waitForFunction(()=>window.relayes.filter(m=>m.action==='lbcMsgCompteur').length===4,null,{timeout:2500});
 console.log('OK : '+ordre+', compte reçu une seule fois, capture suivante conservée.');await p.close();
}}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
