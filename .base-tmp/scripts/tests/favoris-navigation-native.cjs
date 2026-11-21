// Synthetic native router only; no real Vinted account or messages.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const source=fs.readFileSync('vinted-sync-extension/background.js','utf8');
 const fonction=source.slice(source.indexOf('function suivreFavoriAffiche('),source.indexOf('async function ouvrirFavoriNatif('));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),headless:true,args:['--no-sandbox']});
 try{
 const page=await browser.newPage();let documents=0;
 await page.route('**/*',r=>{documents++;return r.fulfill({contentType:'text/html',body:`<button aria-label="Notifications" aria-expanded="false" id="cloche">Notifications</button><section hidden id="liste"><a id="favori" href="/items/101/conversation/new?native_target=201">Camille a ajouté un favori</a></section><script>window.clics=0;window.cloches=0;document.querySelector('button').onclick=()=>{window.cloches++;document.getElementById('liste').hidden=false;document.querySelector('button').setAttribute('aria-expanded','true');};document.querySelector('a').onclick=e=>{e.preventDefault();window.clics++;history.pushState({},'', '/inbox/900');};</script>`});});
 await page.goto('https://www.vinted.fr/notifications');await page.addScriptTag({content:fonction});
 const cible='https://www.vinted.fr/items/101/conversation/new?native_target=201';
 const lancer=activer=>page.evaluate(({cible,activer})=>suivreFavoriAffiche(cible,activer),{cible,activer});
 assert.equal((await lancer(false)).trouve,false);
 assert.equal((await page.evaluate(()=>clocheFavorisNative(false,location.origin))).etat,'disponible');
 assert.equal(await page.evaluate(()=>cloches),0);
 assert.equal((await page.evaluate(()=>clocheFavorisNative(true,location.origin))).etat,'activee');
 assert.equal((await page.evaluate(()=>clocheFavorisNative(true,location.origin))).etat,'deja_ouverte');
 assert.equal(await page.evaluate(()=>cloches),1);
 assert.equal((await page.evaluate(()=>clocheFavorisNative(true,'https://evil.invalid'))).etat,'origine');
 assert.equal((await lancer(false)).trouve,true);assert.equal(await page.evaluate(()=>clics),0);
 assert.equal((await lancer(true)).trouve,true);assert.equal(page.url(),'https://www.vinted.fr/inbox/900');assert.equal(documents,1);
 await page.evaluate(()=>document.querySelector('a').style.display='none');assert.equal((await lancer(true)).trouve,false);
 await page.evaluate(()=>{const a=document.querySelector('a');a.style.display='';document.body.append(a.cloneNode(true));});assert.equal((await lancer(true)).trouve,false);
 assert.equal((await page.evaluate(()=>suivreFavoriAffiche('https://evil.invalid/items/101/conversation/new',true))).trouve,false);
 assert.equal(await page.evaluate(()=>clics),1);
 await page.evaluate(()=>document.body.append(document.querySelector('button').cloneNode(true)));assert.equal((await page.evaluate(()=>clocheFavorisNative(true,location.origin))).etat,'ambigue');
 assert.equal(await page.evaluate(()=>cloches),1);
 console.log('16 contrôles navigation native : route interne, aucun document 404, aucun appel API, ambiguïtés refusées');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
