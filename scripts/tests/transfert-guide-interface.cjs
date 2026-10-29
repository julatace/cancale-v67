const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),esbuild=require('esbuild');
(async()=>{
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 for(const width of [390,1512]){
 const p=await b.newPage({viewport:{width,height:950}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://vrm.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('http://vrm.test/');
 for(const file of ['react/umd/react.development.js','react-dom/umd/react-dom.development.js'])await p.addScriptTag({path:path.resolve('node_modules',file)});
 await p.addStyleTag({content:fs.readFileSync('src/reception-emails.css','utf8')});
 const helper=fs.readFileSync('src/receptionEmail.js','utf8').slice(fs.readFileSync('src/receptionEmail.js','utf8').indexOf('export function etapesTransfert')).replace('export function','function');
 const source=fs.readFileSync('src/ConfigurerTransfert.jsx','utf8').replace(/^import .*\n/gm,'').replace('export default function','function');
 await p.addScriptTag({content:esbuild.transformSync(`const {useState,useEffect}=React;const ADRESSE_COLLECTRICE='reception@example.test';${helper}\n${source};window.ConfigurerTransfert=ConfigurerTransfert;`,{loader:'jsx'}).code});
 await p.evaluate(()=>{window.root=ReactDOM.createRoot(document.getElementById('root'));window.actualisations=0;root.render(React.createElement(ConfigurerTransfert,{adresses:[{adresse:'vendeur@example.test',comptes:[{id:1,nom:'Boutique test'}],declaree:false}],preuves:{cloisonnee:true,adresses:{}},onDeclarer:async()=>false,onActualiser:async()=>{actualisations++;return true;},onComptes:()=>{}}));});
 await p.getByText('Configurer un transfert · étape par étape',{exact:true}).click();
 await p.getByRole('combobox',{name:'Compte et adresse'}).selectOption('vendeur@example.test');
 await p.getByRole('button',{name:'Déclarer cette adresse',exact:true}).click();await p.getByText(/La demande n’a pas abouti/).waitFor();
 assert.equal(await p.locator('[data-etape-transfert="declaration"]').getAttribute('data-etat'),'a-faire');
 await p.locator('[data-etape-transfert="transfert"]').click();await p.getByText(/VRM ne peut pas vérifier directement/).waitFor();
 await p.locator('[data-etape-transfert="reception"]').click();await p.getByRole('button',{name:'Actualiser la réception',exact:true}).click();
 await p.getByText(/Demande traitée/).waitFor();assert.equal(await p.evaluate(()=>actualisations),1);
 assert.equal(await p.locator('[data-etape-transfert="reception"]').getAttribute('data-etat'),'attente');
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
 console.log(`OK ${width}px : échec de déclaration conservé, transfert externe distingué, réception non inventée, une seule actualisation, sans débordement.`);await p.close();
 }
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
