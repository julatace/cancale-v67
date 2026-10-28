// Contrôle le vrai panneau, avec stockage synthétique uniquement.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),esbuild=require('esbuild');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage();await p.route('http://vrm.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('http://vrm.test/');
 for(const file of ['react/umd/react.development.js','react-dom/umd/react-dom.development.js'])await p.addScriptTag({path:path.resolve('node_modules',file)});
 await p.evaluate(()=>{localStorage.setItem('vrm_num_prefixe','"C"');localStorage.setItem('articles-fixture','[{"numero":"C125"}]');window.prefixeNumeros=()=>JSON.parse(localStorage.getItem('vrm_num_prefixe')||'""');window.archiveNumeros=()=> 'B';window.onCloudReady=()=>()=>{};window.save=(k,v)=>{window.appels.push({k,v});};window.appels=[];window.C={text:'#123',muted:'#456',bg:'#eee',border:'#ccc',card:'#fff',accent:'#245',onAccent:'#fff'};window.GuideReglage=()=>null;});
 const s=fs.readFileSync('src/App.jsx','utf8');const code=s.slice(s.indexOf('function NumerosSetting('),s.indexOf('// ⛔ DÉTOURAGE DES PHOTOS'));
 await p.addScriptTag({content:esbuild.transformSync(code+';window.NumerosSetting=NumerosSetting;',{loader:'jsx'}).code});
 await p.evaluate(()=>ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(NumerosSetting,{nu:true})));
 const input=p.getByRole('textbox',{name:'Lettres de la série'});
 await input.fill('B');assert.equal(await p.evaluate(()=>prefixeNumeros()),'C');assert.equal(await p.evaluate(()=>appels.length),0);
 await input.fill('D');assert.equal(await p.evaluate(()=>prefixeNumeros()),'D');
 await p.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};});
 await input.fill('E');await p.getByRole('alert').waitFor();assert.equal(await p.evaluate(()=>prefixeNumeros()),'D');assert.equal(await input.inputValue(),'D');
 assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('articles-fixture'))[0].numero),'C125');
 console.log('OK : série archivée refusée, format appliqué explicite, stockage plein signalé sans changement, articles existants inchangés.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
