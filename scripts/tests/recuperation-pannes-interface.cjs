// Vraie page, faux service d'authentification : aucun email ni compte réel.
const {chromium}=require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.env.VRM_RECUPERATION_ROOT||path.join(__dirname,'../../public');
(async()=>{
 const serveur=http.createServer((req,res)=>{
  const nom=req.url.split('?')[0];
  if(!['/recuperation.html','/recuperation.js','/recuperation.css'].includes(nom)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',nom.endsWith('.js')?'text/javascript':nom.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(root+nom));
 });
 await new Promise(r=>serveur.listen(0,'127.0.0.1',r));
 const origine='http://127.0.0.1:'+serveur.address().port;
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  for(const width of [390,1512]){
   const page=await nav.newPage({viewport:{width,height:900}});
   page.setDefaultTimeout(10000);
   if(width===390)await page.addInitScript(()=>Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true}));
   let verification=503,enregistrement=503,appels=0,sorties=0;
   await page.route('**/*',r=>{
    const u=r.request().url();
    if(u.startsWith(origine+'/api/compte'))return r.fulfill({json:{ok:true,url:'https://projet.supabase.co',cle:'fictive'}});
    if(u.startsWith('https://projet.supabase.co/auth/v1/verify'))return r.fulfill({status:verification,json:verification===200?{access_token:'faux.jeton.test'}:{message:'service indisponible'}});
    if(u.startsWith('https://projet.supabase.co/auth/v1/user')){appels++;return r.fulfill({status:enregistrement,json:enregistrement===200?{id:'fictif'}:{message:'service indisponible'}});}
    if(u.includes('/logout?scope=global')){sorties++;return r.fulfill({status:503,json:{}});}
    if(u.startsWith(origine+'/'))return r.continue();return r.abort();
   });
   const lien=origine+'/recuperation.html#type=recovery&token_hash=abcdefghijklmnopqrstuvwxyz';
   await page.goto(lien);
   await page.getByText('Le service sécurisé est momentanément indisponible.',{exact:false}).waitFor();
   assert.doesNotMatch(await page.locator('#message').innerText(),/expiré/);
   verification=200;await page.locator('#lien').fill(lien);await page.locator('#secours [type=submit]').click();
   await page.locator('#password').waitFor({state:'visible'});
   await page.locator('#password').fill('NouveauSecret123');await page.locator('#confirmation').fill('NouveauSecret123');
   await page.locator('#nouveau [type=submit]').click();
   await page.getByText('L’enregistrement n’est pas confirmé.',{exact:false}).waitFor();
   assert.equal(appels,1);assert.equal(sorties,0);assert.equal(await page.locator('#password').inputValue(),'NouveauSecret123');
   enregistrement=200;await page.locator('#nouveau [type=submit]').click();
   await page.getByText('La fermeture des anciennes sessions n’a pas été confirmée.',{exact:false}).waitFor();
   assert.equal(appels,2);assert.equal(sorties,1);
   assert.equal(await page.locator('#password').inputValue(),'');
   assert.equal(await page.evaluate(()=>localStorage.length),0);
   assert.equal(new URL(page.url()).hash,'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.close();console.log(`OK ${width}px : panne distincte de l’expiration, reprise manuelle, ancien Safari, succès certain et fermeture non confirmée explicitée.`);
  }
 }finally{await nav.close();await new Promise(r=>serveur.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
