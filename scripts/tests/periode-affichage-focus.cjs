const fs=require('fs'),path=require('path'),assert=require('assert/strict');const{build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');const bundle=await build({stdin:{resolveDir:root,loader:'jsx',contents:`
 import *as TH from'./src/themeMineral.js';for(const[k,v]of Object.entries(TH.variablesTheme(TH.MINERAL,false)))document.documentElement.style.setProperty(k,v);document.body.style.background=TH.MINERAL.bg;document.body.style.color=TH.MINERAL.text;
 import React from'react';import{createRoot}from'react-dom/client';import ChoixPeriode from'./src/ChoixPeriode.jsx';
 window.applications=[];const r=createRoot(document.getElementById('root'));window.genre='ancien';
 window.afficher=()=>{const value=window.genre==='ancien'?{from:new Date(2026,10,1),to:new Date(2026,10,7),label:'7 derniers jours'}:{from:new Date(2026,10,2),to:new Date(2026,10,8),label:'7 derniers jours'};r.render(<><ChoixPeriode owner="vendeur-test" value={value} onChange={v=>window.applications.push(v)}/><input aria-label="Autre champ"/></>);};window.afficher();`},outfile:'periode-test.js',bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of[390,1512]){
 const p=await b.newPage({viewport:{width,height:900},timezoneId:'Europe/Paris'});await p.clock.install({time:new Date('2026-11-08T12:00:00+01:00')});await p.setContent('<div id="root"></div>');for(const f of bundle.outputFiles.filter(f=>f.path.endsWith('.css')))await p.addStyleTag({content:f.text});await p.addStyleTag({content:'body{font-family:Arial}input[aria-label="Autre champ"]{position:fixed;right:16px;bottom:16px}'});await p.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
 const bouton=p.locator('[data-periode-ouvrir]');await bouton.waitFor();
 if(process.env.TEST_PERIODE!=='focus'){
  const texte=await p.locator('[data-periode-libelle]').innerText();ok(!texte.toLowerCase().includes('derniers jours')&&/1/.test(texte)&&/7/.test(texte)&&/nov/.test(texte),'old relative label must reveal the actual stored dates');if(process.env.CAPTURE_DIR){fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CAPTURE_DIR,`periode-memorisee-${width}.png`)});}
  await bouton.click();ok(await p.locator('[data-periode-plage]').getAttribute('data-periode-du')==='2026-11-01'&&await p.locator('[data-periode-plage]').getAttribute('data-periode-au')==='2026-11-07','display correction does not change date bounds');if(process.env.CAPTURE_DIR){await p.evaluate(()=>document.getAnimations().forEach(a=>{try{a.finish()}catch(_){}}));await p.screenshot({path:path.join(process.env.CAPTURE_DIR,`periode-ouverte-${width}.png`)});}
  if(width<768)await p.getByRole('button',{name:'Fermer',exact:true}).click();else await p.getByRole('button',{name:'7 jours',exact:true}).press('Escape');ok(await p.evaluate(()=>window.applications.length)===0,'closing does not apply or rewrite dates');
  await p.evaluate(()=>{window.genre='actuel';window.afficher();});await p.waitForFunction(()=>document.querySelector('[data-periode-ouvrir]').dataset.periodeValeur==='2026-11-02..2026-11-08');ok((await p.locator('[data-periode-libelle]').innerText()).toLowerCase()==='7 derniers jours','a current shortcut keeps its short label');
 }
 if(process.env.TEST_PERIODE!=='libelle'){
  await bouton.click();await p.locator('[data-periode-panneau]').waitFor();if(width<768)await p.getByRole('button',{name:'Fermer',exact:true}).click();else {await p.getByRole('button',{name:'7 jours',exact:true}).focus();await p.keyboard.press('Escape');}
  await p.locator('[data-periode-panneau]').waitFor({state:'detached'});ok(await bouton.evaluate(e=>e===document.activeElement),'explicit closing returns focus to the period button');
  if(width>=768){await bouton.click();await p.getByRole('textbox',{name:'Autre champ'}).click();await p.locator('[data-periode-panneau]').waitFor({state:'detached'});ok(await p.getByRole('textbox',{name:'Autre champ'}).evaluate(e=>e===document.activeElement),'outside click preserves focus on its destination');}
 }
 if(process.env.CAPTURE_DIR){fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CAPTURE_DIR,`periode-${width}.png`)});}await p.close();
 }}finally{await b.close();}console.log(n+' contrôles périodes et focus réussis');
})().catch(e=>{console.error(e);process.exitCode=1});
