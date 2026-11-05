// Vrai popup et adaptateur Orion ; APIs simulées, aucune connexion réelle.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{chromium}=require('playwright');
const racine=process.env.VRM_UI_ROOT||path.resolve(__dirname,'../..');
(async()=>{
 const html=fs.readFileSync(path.join(racine,'vinted-sync-extension/popup.html'),'utf8').replace('<script src="popup.js">','<script src="compat-orion.js"></script><script src="popup.js">').replace('<script src="parcours-popup.js"></script>','');
 const srv=http.createServer((q,r)=>{if(q.url==='/logo-vrm-96.png'){r.setHeader('Content-Type','image/png');return r.end(fs.readFileSync(path.join(racine,'vinted-sync-extension/logo-vrm-96.png')));}r.setHeader('Content-Type',q.url.includes('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');if(q.url.startsWith('/compat-orion.js'))return r.end(fs.readFileSync(path.join(racine,'scripts/extension-orion/compat-orion.js')));if(q.url.startsWith('/popup.js'))return r.end(fs.readFileSync(path.join(racine,'vinted-sync-extension/popup.js')));r.end(html);});
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+srv.address().port;
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});let n=0;
 try{for(const mode of ['promesse','rappel'])for(const carte of [false,true]){
  const p=await nav.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(5000);
  await p.addInitScript(({mode})=>{
   window.actions=[];window.ouvertures=0;window.etat='attente';window.connecte=false;const natif=window.setTimeout;window.setTimeout=(f,ms,...a)=>natif(f,ms===25000?1000:ms,...a);
   const reponse=m=>{window.actions.push(m);if(m.action==='authEtat')return{ok:true,connecte:window.connecte};if(m.action==='authLogin'){if(window.etat==='muet')return new Promise(()=>{});if(window.etat==='refus')return{ok:false,error:'Email ou mot de passe incorrect.'};if(window.etat==='rejete')throw Error('Port fermé');return new Promise(r=>window.finLogin=()=>{window.connecte=true;r({ok:true,email:'vendeur@example.test'});});}return{ok:true,accorde:true};};
   const asyncApi=fn=>mode==='promesse'?async(...a)=>{if(typeof a.at(-1)==='function')throw Error('Rappel non pris en charge');return fn(...a);}:function(...a){const cb=a.pop();Promise.resolve().then(()=>fn(...a)).then(cb);};
   window.chrome={runtime:{id:'orion-fixture',lastError:null,getManifest:()=>({version:'5.320.0'}),sendMessage:asyncApi(reponse)},storage:{local:{get:mode==='promesse'?async()=>({}):(k,cb)=>cb?.({})}},tabs:{query:asyncApi(()=>[{url:'https://www.vinted.fr/'}]),create:asyncApi(()=>window.ouvertures++),update:asyncApi(()=>window.ouvertures++)}};
   window.open=()=>{window.ouvertures++;return{};};
  },{mode});
  await p.goto(base+(carte?'/?mode=carte':'/'));await p.locator('#mdpLien').click();await p.locator('#mail').fill('vendeur@example.test');await p.locator('#pw').fill('mot-de-passe-fictif');await p.locator('#inBtn').click();await p.waitForFunction(()=>typeof window.finLogin==='function');await p.locator('#pw').press('Enter');assert.equal(await p.evaluate(()=>window.actions.filter(m=>m.action==='authLogin').length),1);n++;
  await p.evaluate(()=>window.finLogin());await p.locator('#vrmBtn').waitFor();assert.equal(await p.evaluate(()=>window.ouvertures),0);assert.equal(await p.locator('#pw').count(),0);assert.equal(await p.evaluate(()=>window.actions.find(m=>m.action==='authLogin').ouvrir),false);n+=3;
  assert.match(await p.locator('#auth').innerText(),/vendeur@example.test/);assert.match(await p.locator('#auth').innerText(),/écran d’accueil/);n+=2;
  if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,`orion-connecte-${mode}-${carte?'carte':'icone'}.png`)});}
  for(const etat of mode==='promesse'?['refus','rejete','muet']:['refus','muet']){
   await p.evaluate(etat=>{window.connecte=false;window.etat=etat;},etat);await p.reload();await p.locator('#mdpLien').click();await p.locator('#mail').fill('vendeur@example.test');await p.locator('#pw').fill('essai-fictif');await p.locator('#inBtn').click();await p.locator('#authErr').waitFor();assert.equal(await p.locator('#inBtn').isEnabled(),true);assert.equal(await p.evaluate(()=>window.ouvertures),0);n+=2;
  }
  await p.close();
 }}finally{await nav.close();await new Promise(r=>srv.close(r));}console.log(n+' contrôles : connexion sans ouvrir VRM, APIs promesse/rappel, erreurs, délai et double clic. Aucun iPhone réel testé.');
})().catch(e=>{console.error(e);process.exitCode=1;});
