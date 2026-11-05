require('./_porte-banc.cjs');
const {build}=require('esbuild'),{chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const debutScroll=source.indexOf('function MemoireDefilement('),scroll=source.slice(debutScroll,source.indexOf('\n}',debutScroll)+2);
const vue=source.slice(source.indexOf('function useVueSession('),source.indexOf('// Une ligne de la liste des ventes',source.indexOf('function useVueSession(')));
(async()=>{
 const bundle=await build({stdin:{resolveDir:root,loader:'jsx',contents:`
 import{MINERAL,MINERAL_DARK,variablesTheme}from'./src/themeMineral.js';
 Object.entries(variablesTheme(window.themeTest==='sombre'?MINERAL_DARK:MINERAL,window.themeTest==='sombre')).forEach(([k,v])=>document.documentElement.style.setProperty(k,v));document.body.style.fontFamily='system-ui';document.body.style.background='var(--vrm-bg)';document.body.style.color='var(--vrm-ink)';
 import React,{useState}from'react';import{createRoot}from'react-dom/client';
 import{installerMasque}from'./src/montantsCaches.js';
 import{RecapSelection,HistoriqueModifications}from'./src/OutilsParcours.jsx';import Periode from'./src/ChoixPeriode.jsx';
 import{lireParcours,garderParcours,noterChangements,restaurerVue}from'./src/parcoursQuotidien.js';
 import{stockageParcours}from'./src/repriseEcran.js';
 const AUTH={get user(){return{id:window.owner}}};${scroll}
 const vuesSession=new Map();window.viderVues=()=>vuesSession.clear();window.owner='A';const readSession=()=>({user:{id:window.owner}});${vue}
 const r=createRoot(document.getElementById('root'));window.changes=[];
 function App(){const[q,setQ]=useVueSession('commandes-recherche','');return <main><div className="vrm-main" style={{height:100,overflowY:'auto'}}><div style={{height:1500}}>Liste longue</div></div><MemoireDefilement ecran="ventes"/><input aria-label="Recherche conservée" value={q} onChange={e=>setQ(e.target.value)}/><RecapSelection lignes={[{cle:'1',site:'vinted',compte:'a',pdf:true},{cle:'2',site:'vestiaire',compte:'b',pdf:false,imprime:'hier'},{cle:'3',site:'ebay',cochable:false}]} coches={new Set(['1','2','3'])}/><HistoriqueModifications owner={window.owner} numero="7"/><Periode owner={window.owner} onChange={v=>window.changes.push(v)}/></main>}
 window.render=()=>r.render(<App key={window.owner+':'+(window.rev||0)}/>);
 window.masquer=()=>installerMasque(document.body);noterChangements(sessionStorage,'A','vinted_buyprice_by_num',{'7':10},{'7':15});window.render();`},bundle:true,write:false,outfile:'/tmp/parcours-banc.js',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [390,1280,1512])for(const theme of ['clair','sombre']){
 const p=await b.newPage({viewport:{width,height:900}});await p.route('http://vrm.test/**',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div>'}));await p.goto('http://vrm.test/');await p.evaluate(t=>window.themeTest=t,theme);
 for(const f of bundle.outputFiles)if(f.path.endsWith('.css'))await p.addStyleTag({content:f.text});else await p.addScriptTag({content:f.text});
 assert.equal(await p.locator('[data-recap-selection]').getAttribute('data-recap-selection'),'2');
 await p.locator('summary').click();assert.match(await p.locator('.vrm-parcours-historique').innerText(),/10 € → 15 €/);await p.evaluate(()=>window.finMasque=window.masquer());assert.ok(!(await p.locator('.vrm-parcours-historique').innerText()).includes('15 €'),'les prix du journal sont masqués');await p.evaluate(()=>window.finMasque());
 await p.locator('.vrm-main').evaluate(e=>{e.scrollTop=360;e.dispatchEvent(new Event('scroll'));});await p.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 await p.getByLabel('Recherche conservée').fill('N°7');await p.evaluate(()=>{window.viderVues();window.rev=1;window.render()});assert.equal(await p.getByLabel('Recherche conservée').inputValue(),'N°7');await p.waitForFunction(()=>document.querySelector('.vrm-main').scrollTop>=350);
 await p.evaluate(()=>{window.owner='B';window.render()});await p.getByLabel('Recherche conservée').waitFor();assert.equal(await p.getByLabel('Recherche conservée').inputValue(),'');assert.equal(await p.locator('.vrm-main').evaluate(e=>e.scrollTop),0);await p.locator('summary').click();assert.ok(!(await p.locator('.vrm-parcours-historique').innerText()).includes('10 € → 15 €'));
 await p.evaluate(()=>{window.owner='A';window.render()});await p.locator('[data-periode-ouvrir]').click();await p.locator('[data-periode-raccourci="mois"]').click();
 await p.locator('[data-periode-ouvrir]').click();assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'le calendrier ouvert ne déborde pas');
 if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'quotidien-'+width+'-'+theme+'.png'),fullPage:true});}
 await p.getByRole('button',{name:'Reprendre la dernière période choisie'}).click();assert.equal(await p.evaluate(()=>window.changes.length),2);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.close();console.log('✅ parcours '+width+'px '+theme+' : sélection exacte, état retrouvé, propriétaire isolé, période reprise');
 }}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
