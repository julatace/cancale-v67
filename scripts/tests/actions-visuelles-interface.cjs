// Composants réels, données synthétiques et lecture tenue : aucun service externe.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');
 const bundle=await build({stdin:{resolveDir:root,loader:'jsx',contents:`
 import * as TH from './src/themeMineral.js';
 import React from 'react';import{createRoot}from'react-dom/client';
 import{ResumeOffre}from'./src/ActionsClaires.jsx';import{BoutonBase}from'./src/composants/Bouton.jsx';import{EtatPanne}from'./src/composants/EtatPanne.jsx';
 const sombre=document.documentElement.getAttribute('data-theme')==='dark',pal=sombre?TH.MINERAL_DARK:TH.MINERAL;for(const[k,v]of Object.entries(TH.variablesTheme(pal,sombre)))document.documentElement.style.setProperty(k,v);document.body.style.background=pal.bg;document.body.style.color=pal.text;
 window.appels=0;window.liens=0;window.minimum=40;
 const fmt=n=>new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(n);
 const r=createRoot(document.getElementById('root'));
 window.afficher=()=>r.render(<React.StrictMode><div className="vrm-app-shell"><main className="vrm-main"><ResumeOffre titre="Article de démonstration" affiche={59} offre={35} mini={window.minimum} fmt={fmt}/><BoutonBase href="#destination" occupe onClick={()=>window.liens++}>Préparation en cours</BoutonBase><EtatPanne quoi="Les conversations" onReessayer={()=>{window.appels++;return new Promise(r=>window.fin=r);}}/></main></div></React.StrictMode>);window.afficher();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of [390,1512])for(const theme of ['light','dark']){
  const p=await b.newPage({viewport:{width,height:900}});await p.setContent(`<html data-theme="${theme}"><body><div id="root"></div></body></html>`);
  const css=['styles-boutons.css','styles-composants.css','styles-design-2026.css','styles-parcours-clairs.css'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
  await p.addStyleTag({content:css+'body{font-family:Arial;margin:16px}.vrm-main{max-width:520px;margin:auto}.vrm-offre-comparer{margin-bottom:24px}'});await p.addScriptTag({content:bundle.outputFiles[0].text});
  await p.locator('a').waitFor();
  await p.locator('a').evaluate(e=>{e.click();e.dispatchEvent(new MouseEvent('auxclick',{bubbles:true,cancelable:true,button:1}));});check(await p.evaluate(()=>window.liens)===0,'busy link never calls its action');check(await p.locator('a').getAttribute('href')===null,'busy link cannot navigate via keyboard/context menu');
  await p.locator('[data-etat-panne-reessayer]').evaluate(e=>{e.click();e.click();});check(await p.evaluate(()=>window.appels)===1,'two immediate clicks only start one retry');check(await p.locator('[data-etat-panne-reessayer]').isDisabled(),'retry disabled during held read');
  await p.evaluate(()=>window.fin());await p.waitForFunction(()=>!document.querySelector('[data-etat-panne-reessayer]').disabled);
  await p.locator('[data-etat-panne-reessayer]').click();check(await p.evaluate(()=>window.appels)===2,'retry available after completion');await p.evaluate(()=>window.fin());
  check(await p.locator('.vrm-b-indicateur').evaluate(e=>getComputedStyle(e).animationName)==='vrm-action-attente','normal motion identifies ongoing action');
  await p.emulateMedia({reducedMotion:'reduce'});check(await p.locator('.vrm-b-indicateur').evaluate(e=>getComputedStyle(e).animationName)==='none','reduced motion stops loading animation');
  await p.locator('[data-offre-niveau="sous-minimum"]').waitFor();check(/5,00/.test(await p.locator('.vrm-offre-repere').innerText()),'exact gap below minimum');
  if(process.env.CAPTURE_DIR){fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CAPTURE_DIR,`offre-${width}-${theme}.png`)});}
  await p.evaluate(()=>{window.minimum=null;window.afficher();});await p.locator('[data-offre-niveau="minimum-inconnu"]').waitFor();check(await p.locator('[data-offre-prix="mini"] dd').innerText()==='—','missing minimum stays unknown');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  if(process.env.CAPTURE_DIR){fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CAPTURE_DIR,`actions-${width}-${theme}.png`)});}
  await p.close();
 }}finally{await b.close();}console.log(n+' contrôles des actions visuelles réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
