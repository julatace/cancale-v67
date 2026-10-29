const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),esbuild=require('esbuild');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const s=fs.readFileSync('src/App.jsx','utf8');const component=s.slice(s.indexOf('function LigneVenteCompacte('),s.indexOf('function LigneVente(',s.indexOf('function LigneVenteCompacte(')));
 for(const width of [390,1512]){
 const p=await b.newPage({viewport:{width,height:950}});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('http://vrm.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('http://vrm.test/');
 for(const file of ['react/umd/react.development.js','react-dom/umd/react-dom.development.js'])await p.addScriptTag({path:path.resolve('node_modules',file)});
 for(const file of ['styles-gestion.css','styles-annonces-ventes.css'])await p.addStyleTag({content:fs.readFileSync('src/'+file,'utf8')});
 await p.evaluate(()=>{window.createPortal=ReactDOM.createPortal;window.FermeAuRetour=()=>null;window.Icon=()=>React.createElement('span');window.PhotoVente=()=>React.createElement('span',null,'Photo');window.ouvertures=[];window.addEventListener('vrm:fiche-article',e=>ouvertures.push(e.detail));});
 await p.addScriptTag({content:esbuild.transformSync(component+';window.LigneVenteCompacte=LigneVenteCompacte;',{loader:'jsx'}).code});
 await p.evaluate(()=>{ReactDOM.createRoot(document.getElementById('root')).render(React.createElement('div',{className:'vrm-app-shell vrm-main'},['vinted','leboncoin','ebay'].map((plateforme,i)=>React.createElement(LigneVenteCompacte,{key:plateforme,plateforme,titre:'Article '+plateforme,sous:'Compte test',etat:'À expédier',montant:'50 €',numerosArticle:i===2?['C125','C126']:['C125']},React.createElement('p',null,'Actions de cette vente')))));});
 for(const plateforme of ['vinted','leboncoin','ebay']){
 const row=p.locator(`[data-plateforme-vente="${plateforme}"]`);await row.locator('button').first().click();
 const fiche=p.getByRole('button',{name:'Fiche article N°C125 →',exact:true});await fiche.waitFor();await fiche.click();
 assert.equal(await row.getAttribute('data-ligne-ouverte'),'false');
 }
 assert.deepEqual(await p.evaluate(()=>ouvertures),['C125','C125','C125']);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);console.log(`OK ${width}px : même entrée vers la fiche depuis les trois plateformes, fermeture du tiroir, sans débordement.`);await p.close();
 }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
