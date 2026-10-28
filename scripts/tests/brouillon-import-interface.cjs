const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),esbuild=require('esbuild');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage();await p.route('http://vrm.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('http://vrm.test/');
 for(const file of ['react/umd/react.development.js','react-dom/umd/react-dom.development.js'])await p.addScriptTag({path:path.resolve('node_modules',file)});
 const helpers=fs.readFileSync('src/brouillonsReglages.js','utf8').replace(/export /g,'');
 const s=fs.readFileSync('src/App.jsx','utf8'),code=s.slice(s.indexOf('function EmailStartSetting('),s.indexOf('// Notifications push :'));
 const bindings=`const {useState,useEffect}=React;const AUTH={user:{id:'A'}},C={text:'#123',card:'#fff',border:'#ccc',bg:'#eee',muted:'#456',warn:'#a50',accent:'#245',onAccent:'#fff',danger:'#b00'};const REGLAGE_PAS_LU='indisponible';const sbAuth=()=>({}),lireReglage=async()=>({startDate:'2026-07-01'});const SUPABASE_URL='http://vrm.test',SB_CONFLICT='owner,id';const withOwner=x=>({...x,owner:AUTH.user.id});const askConfirm=()=>new Promise(ok=>window.valider=ok);window.ecritures=0;window.fetch=async()=>{window.ecritures++;return {ok:true};};`;
 await p.addScriptTag({content:esbuild.transformSync(`${helpers}\n${bindings}\nconst brouillonsParametres=creerBrouillonsReglages();${code};window.AUTH=AUTH;window.drafts=brouillonsParametres;window.root=ReactDOM.createRoot(document.getElementById('root'));window.afficher=()=>root.render(React.createElement(EmailStartSetting,{nu:true}));afficher();`,{loader:'jsx'}).code});
 const input=p.locator('input[type=date]');await input.waitFor();await p.waitForFunction(()=>document.querySelector('input[type=date]').value==='2026-07-01');
 await input.fill('2026-07-10');await p.waitForFunction(()=>drafts.existe('A'));
 await p.evaluate(()=>root.render(null));await input.waitFor({state:'detached'});await p.evaluate(()=>afficher());await p.getByText(/Une modification non enregistrée a été reprise/).waitFor();
 assert.equal(await input.inputValue(),'2026-07-10');assert.equal(await p.evaluate(()=>ecritures),0);
 await p.getByRole('button',{name:'Revenir à la date en ligne',exact:true}).click();assert.equal(await input.inputValue(),'2026-07-01');assert.equal(await p.evaluate(()=>drafts.existe('A')),false);
 await input.fill('2026-07-12');await input.fill('2026-07-01');await p.waitForFunction(()=>!drafts.existe('A'));
 await input.fill('2026-07-11');await p.getByRole('button',{name:'Enregistrer la date',exact:true}).click();
 await p.evaluate(()=>{AUTH.user={id:'B'};drafts.activer('B');valider(true);});
 await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>ecritures),0,'La confirmation d’une ancienne session ne doit rien écrire');
 await p.evaluate(()=>root.render(null));await input.waitFor({state:'detached'});await p.evaluate(()=>afficher());await p.waitForFunction(()=>document.querySelector('input[type=date]')?.value==='2026-07-01');
 assert.equal(await p.getByText(/Une modification non enregistrée a été reprise/).count(),0);
 console.log('OK : reprise après navigation sans écriture, annulation, retour manuel à la date initiale, changement de vendeur pendant confirmation sans envoi.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
