require('./_porte-banc.cjs');
// Vraie app et faux service d'inscription : ni compte ni email de production.
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const dist=process.env.BANC_DIST||path.join(__dirname,'../../dist');
(async()=>{
 const serveur=http.createServer((req,res)=>{
  let fichier=new URL(req.url,'http://localhost').pathname;if(fichier==='/')fichier='/index.html';
  const p=path.join(dist,fichier);if(!fs.existsSync(p)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(p));
 });
 await new Promise(r=>serveur.listen(0,'127.0.0.1',r));const origine='http://127.0.0.1:'+serveur.address().port;
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const largeur of [320,390,1512])for(const mode of ['confirmation','incertain']){
  const p=await nav.newPage({viewport:{width:largeur,height:900}});let appels=0,liberer,corps,retour;
  await p.route('**/*',async r=>{
   const u=r.request().url(),json=(status,data)=>r.fulfill({status,json:data});
   if(u.includes('/auth/v1/signup')){appels++;corps=r.request().postDataJSON();retour=new URL(u).searchParams.get('redirect_to');await new Promise(resolve=>{liberer=resolve;});return json(mode==='confirmation'?200:503,mode==='confirmation'?{id:'11111111-1111-4111-8111-111111111111'}:{message:'Service indisponible'});}
   if(u.includes('/auth/v1/settings'))return json(200,{external:{},mailer_autoconfirm:false});
   if(u.includes('/rest/v1/')){assert.equal(r.request().method(),'GET','Aucune donnée de test en base');return json(200,[]);}
   if(u.includes('/api/'))return json(200,{});
   if(u.startsWith(origine+'/'))return r.continue();return r.abort();
  });
  await p.goto(origine+'/?inscription');await p.getByPlaceholder('Email',{exact:true}).fill('Client@exemple.test');await p.getByPlaceholder('Mot de passe',{exact:true}).fill('Secret123');
  assert.equal(await p.getByRole('textbox',{name:'Adresse email',exact:true}).count(),1,'Libellé email permanent');
  const secret=p.locator('#vrm-cx-password');
  assert.equal(await secret.getAttribute('type'),'password');
  await p.getByRole('button',{name:'Afficher le mot de passe',exact:true}).click();
  assert.equal(await secret.getAttribute('type'),'text');
  assert.equal(await secret.inputValue(),'Secret123','Afficher conserve la saisie');
  await p.getByRole('button',{name:'Masquer le mot de passe',exact:true}).click();
  assert.equal(await secret.getAttribute('type'),'password');
  assert.equal(await p.locator('#vrm-cx-regles [data-valide=true]').count(),2,'Les règles reflètent la saisie');
  await secret.fill('abc');
  assert.equal(await p.locator('#vrm-cx-regles [data-valide=true]').count(),0);
  await p.getByRole('button',{name:'Créer mon compte',exact:true}).click();
  await p.getByRole('alert').filter({hasText:'au moins 8 caractères'}).waitFor();
  assert.equal(appels,0,'Un mot de passe incomplet ne lance pas une inscription');
  await secret.fill('Secret123');
  assert.equal(await p.getByRole('button',{name:'Mot de passe oublié ?',exact:true}).count(),0,'Pas de diversion de récupération pendant la création');
  await p.screenshot({path:`/tmp/vrm-inscription-${largeur}.png`,fullPage:true});
  await p.evaluate(()=>{const f=document.querySelector('[data-connexion] form');f.requestSubmit();f.requestSubmit();});
  for(let i=0;i<100&&!liberer;i++)await p.waitForTimeout(20);
  assert.ok(liberer);await p.waitForTimeout(100);assert.equal(appels,1,'Une seule demande pour les deux validations');
  assert.equal(await p.getByPlaceholder('Email',{exact:true}).isDisabled(),true);assert.equal(await p.getByPlaceholder('Mot de passe',{exact:true}).isDisabled(),true);
  assert.equal(corps.email,'client@exemple.test');assert.equal(new URL(retour).origin,origine);
  liberer();
  await p.getByRole('status').filter({hasText:mode==='confirmation'?'Ton compte est créé':'Je ne peux pas confirmer le résultat'}).waitFor();
  assert.equal(await p.getByRole('button',{name:'Se connecter',exact:true}).isEnabled(),true);
  assert.equal(await p.getByRole('alert').count(),0,'Un résultat incertain ne devient pas un faux échec définitif');
  assert.equal(await p.evaluate(()=>localStorage.getItem('vrm_session')),null,'Aucune session inventée avant confirmation');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.close();console.log(`OK inscription ${largeur}px · ${mode} : demande unique, identité figée pendant la demande, état clair et connexion accessible.`);
 }}finally{await nav.close();await new Promise(r=>serveur.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
