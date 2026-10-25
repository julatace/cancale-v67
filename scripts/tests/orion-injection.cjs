// Browser executes the packaged loader/captor on synthetic pages only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {execFileSync}=require('node:child_process');
const os=require('node:os');
(async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'vrm-orion-page-'));let b,n=0;
 try{
 execFileSync('unzip',['-q',path.resolve('public/VRM-Orion.xpi'),'-d',dir]);
 const boot=fs.readFileSync(path.join(dir,'orion-main.js'),'utf8');
 b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const bloque of [false,true]){
 const c=await b.newContext(),p=await c.newPage();let api=0,assets=0;const messages=[];
 p.on('console',m=>messages.push(m.text()));p.on('pageerror',e=>messages.push(e.message));
 await c.route('**/*',r=>{
  const u=new URL(r.request().url());if(u.hostname==='vrm-fixture.invalid'){assets++;return r.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync(path.join(dir,'inject.js'),'utf8')});}
  if(u.pathname==='/api/v2/inbox'){api++;return r.fulfill({contentType:'application/json',body:'{"conversations":[],"code":0}'});}
  return r.fulfill({contentType:'text/html; charset=utf-8',headers:bloque?{'Content-Security-Policy':"default-src 'self'; script-src 'self'"}:{},body:'<!doctype html><html><head></head><body>Fixture de page Vinted</body></html>'});
 });
 await p.addInitScript({content:`window.captures=[];window.chrome=window.chrome||{};Object.defineProperty(window.chrome,'runtime',{value:{getURL:p=>'https://vrm-fixture.invalid/'+p},configurable:true});window.addEventListener('message',e=>{if(e.source===window&&e.data?.__tag==='CANCALE_VINTED')window.captures.push(e.data);});\n${boot}`});await p.goto('https://www.vinted.fr/');
 if(!bloque){
  await p.waitForFunction(()=>window.captures.some(x=>x.kind==='injectReady'),null,{timeout:8000}).catch(e=>{throw Error(e.message+' '+JSON.stringify({messages,assets}));});
  await p.evaluate(()=>fetch('/api/v2/inbox').then(r=>r.json()));await p.waitForFunction(()=>window.captures.some(x=>x.kind==='harvest'&&x.type==='inbox'));
  assert.equal(api,1);n++;assert.equal(assets,1);n++;
  await p.evaluate(boot);assert.equal(assets,1);n++;
 }else{
  await p.waitForFunction(()=>!document.querySelector('script[src*="vrm-fixture.invalid"]'));
  assert.ok(messages.some(m=>m.includes('capteur de page n’a pas pu être chargé')));n++;
  assert.equal(await p.evaluate(()=>window.captures.some(x=>x.kind==='injectReady')),false);n++;
  assert.equal(api,0);n++;
 }
 await c.close();
 }
 console.log(n+' contrôles navigateur du chargeur Orion réussis, sans Orion réel');
 }finally{if(b)await b.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
