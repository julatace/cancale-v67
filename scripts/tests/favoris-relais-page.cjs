// Real MAIN + isolated JS worlds, synthetic Vinted UI only. No account login.
const fs=require('node:fs'),assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});let n=0;
 try{
 const source=fs.readFileSync('vinted-sync-extension/background.js','utf8');const dom=source.slice(source.indexOf('function suivreFavoriAffiche('),source.indexOf('// Closed navigation protocol:'));assert.ok(fs.readFileSync('vinted-sync-extension/inject.js','utf8').includes(dom));n++;
 const c=await b.newContext(),p=await c.newPage();let creations=0;
 await c.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.pathname.startsWith('/fake-extension/'))return r.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync('vinted-sync-extension/inject.js','utf8')});
  if(u.pathname==='/api/v2/conversations'){creations++;return r.fulfill({contentType:'application/json',body:'{"conversation":{"id":900}}'});}
  return r.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><button aria-label="Notifications" aria-expanded="false">Cloche</button><section hidden><a href="/items/101/conversation/new?native_target=201">Favori natif</a></section><script>window.cloches=0;window.ouvertures=0;document.querySelector('button').onclick=()=>{cloches++;document.querySelector('section').hidden=false;document.querySelector('button').setAttribute('aria-expanded','true');};document.querySelector('a').onclick=e=>{e.preventDefault();ouvertures++;fetch('/api/v2/conversations',{method:'POST',body:JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201})});history.pushState({},'', '/inbox/900');};</script>`});
 });
 // (5.356) Le CANAL PRIVÉ : inject.js remet son port UNE fois, au chargement, à content.js qui doit déjà écouter (dans Chrome,
 // content.js — monde isolé — passe avant inject.js — monde MAIN — au même document_start). inject.js n'est donc plus posé
 // avant : c'est content.js qui le charge (sa ressource web-accessible, servie ici par /fake-extension/), après s'être mis à l'écoute.
 await p.goto('https://www.vinted.fr/');
 const cd=await c.newCDPSession(p);const {frameTree}=await cd.send('Page.getFrameTree');const {executionContextId}=await cd.send('Page.createIsolatedWorld',{frameId:frameTree.frame.id,worldName:'vrm-test-content'});
 const config=`window.relais=[];window.messagesExt=[];globalThis.chrome={runtime:{id:'fixture-extension',lastError:null,getURL:f=>'https://www.vinted.fr/fake-extension/'+f,onMessage:{addListener:f=>relais.push(f)},sendMessage:(m,cb)=>{messagesExt.push(m);if(cb)cb({veux:false});}},storage:{local:{get:(k,cb)=>cb({}),set(){}},onChanged:{addListener(){}}}};window.commander=(m,sender='fixture-extension')=>new Promise(res=>{let pris=false;for(const f of relais)if(f(m,{id:sender},res)===true){pris=true;break;}if(!pris)res(null);});`;
 await cd.send('Runtime.evaluate',{contextId:executionContextId,expression:config+'\n'+fs.readFileSync('vinted-sync-extension/content.js','utf8')});
 await p.waitForFunction(()=>window.__cancaleVintedInjected===true);
 const cible='https://www.vinted.fr/items/101/conversation/new?native_target=201';let numero=0;
 const commande=async(action,opts={})=>{const id=opts.id||'f'+(++numero).toString(16).padStart(32,'0');const m={vrm:'favoriPage',id,action,cible:opts.cible||cible};const r=await cd.send('Runtime.evaluate',{contextId:executionContextId,expression:`commander(${JSON.stringify(m)},${JSON.stringify(opts.sender||'fixture-extension')})`,awaitPromise:true,returnByValue:true});assert.ok(!r.exceptionDetails,JSON.stringify(r.exceptionDetails));return r.result.value;};
 assert.equal(await p.evaluate(()=>typeof messagesExt),'undefined');n++;
 assert.equal((await commande('sonder')).resultat.trouve,false);n++;
 assert.equal((await commande('cloche_sonder')).resultat.etat,'disponible');n++;
 // (5.356, e83a41265) plus de clic synthétique : « cloche_ouvrir » ENTOURE la cloche, c'est SON clic (réel, Playwright) qui l'ouvre.
 const id='f'+'a'.repeat(32);assert.equal((await commande('cloche_ouvrir',{id})).resultat.etat,'disponible');n++;
 await commande('cloche_ouvrir',{id});assert.equal(await p.evaluate(()=>cloches),0);n++;
 await p.click('button');assert.equal(await p.evaluate(()=>cloches),1);assert.equal((await commande('cloche_sonder')).resultat.etat,'deja_ouverte');n+=2;
 const sondeVisible=await commande('sonder');assert.equal(sondeVisible.resultat.trouve,true);n++;
 assert.deepEqual(sondeVisible.resultat.inspection,{liensFavoris:1,memeArticle:1,exacts:1,visibles:1,natifsMemeArticle:0,natifs:0,natifsVisibles:0});n++;
 const idOuverture='f'+'b'.repeat(32);assert.equal((await commande('ouvrir',{id:idOuverture})).resultat.trouve,true);n++;
 await commande('ouvrir',{id:idOuverture});assert.equal(await p.evaluate(()=>ouvertures),0);assert.equal(creations,0);n+=2;
 assert.equal(await p.evaluate(()=>document.querySelector('a').style.outlineStyle),'solid');n++;
 await p.click('a');
 await p.waitForFunction(()=>ouvertures===1);assert.equal(p.url(),'https://www.vinted.fr/inbox/900');n++;
 // 5.455.6 (CI intermittente, #1451 / #1457) : la création part par un `fetch` NON attendu de la page ; la route de Playwright
 //    (`creations`) et la trace d'inject.js (`writereq`) arrivent APRÈS `ouvertures===1`, au rythme de la machine. On attend
 //    leur ÉTAT réel (borné à 10 s), jamais un délai fixe (§6.5).
 const jusqua=async(f,ms=10000)=>{const fin=Date.now()+ms;for(;;){const v=await f();if(v)return v;if(Date.now()>fin)return v;await new Promise(r=>setTimeout(r,25));}};
 await jusqua(()=>creations>=1);
 assert.equal(creations,1);n++;
 const lireTrace=()=>cd.send('Runtime.evaluate',{contextId:executionContextId,expression:`messagesExt.filter(m=>m.kind==='writereq')`,returnByValue:true});
 await jusqua(async()=>(await lireTrace()).result.value.length>=1);
 const trace=await lireTrace();assert.equal(trace.result.value.length,1);assert.equal(JSON.parse(trace.result.value[0].body).opposite_user_id,201);n++;
 for(const opts of [{cible:'https://evil.invalid/items/101/conversation/new'},{cible:'https://www.vinted.fr/api/v2/conversations/900/replies'},{sender:'another-extension'}]){assert.equal(await commande('ouvrir',opts),null);n++;}
 assert.equal(await commande('envoyerMessage'),null);n++;
 assert.equal(await p.evaluate(()=>ouvertures),1);assert.equal(creations,1);n++;
 await c.close();console.log(n+' contrôles du vrai relais de navigation page/monde isolé réussis (fixtures uniquement)');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
