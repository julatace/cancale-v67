const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');const racine=path.resolve(__dirname,'../..');
(async()=>{
 const bundle=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import Auto from'./src/AutomatisationFavoris.jsx';
 const root=createRoot(document.getElementById('root'));window.owner='owner-test';window.appels=[];window.envois=[];window.cas='ok';window.n=0;
 const attente={active:false,raison:'',jobs:[]},active={active:true,raison:'',jobs:[{id:'j1',notificationId:'n1',etat:'attente'}]},fini={active:false,raison:'',jobs:[{id:'j1',notificationId:'n1',etat:'envoye'}]};
 const interval=window.setInterval;window.setInterval=(fn)=>interval(fn,40);
 window.fetch=async(url,o={})=>{
  const c=o.body?JSON.parse(o.body):{};window.appels.push({url,c});
  if(window.cas==='retard'&&c.action==='suivant')await new Promise(r=>window.liberer=r);
  if(window.cas==='bloque'&&c.action==='lancer')return{ok:false,json:async()=>({message:'Le destinataire n’est pas confirmé.'})};
  if(window.cas==='perdu'&&c.action==='terminer')return{ok:false,json:async()=>({message:'Accusé interrompu.'})};
  let j={ok:true,vue:attente};
  if(c.action==='lancer')j={ok:true,vue:active};
  if(c.action==='suivant')j=window.n++?{ok:true,vue:active}:{ok:true,vue:active,travail:{jeton:'jeton-unique'}};
  if(c.action==='terminer')j={ok:true,vue:fini};
  return{ok:true,json:async()=>j};
 };
 window.afficher=(disponible=true,prets=true,owner='owner-test')=>root.render(<Auto key={owner} uid="123" owner={owner} ownerActuel={()=>window.owner} headers={()=>({Authorization:'Bearer fixture'})} selection={['n1','n2']} reglagesPrets={prets} reglages={{message:"Bonjour",pourcentage:10,intervalleMinutes:6}} disponible={disponible} executer={async t=>{window.envois.push(t);return{ok:true,data:{resultat:'envoye'}};}}/>);
 window.afficher();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});let controles=0;
 const check=(v,m)=>{assert.ok(v,m);controles++;};
 try{for(const largeur of [320,390,1512]){
  const page=async()=>{const p=await b.newPage({viewport:{width:largeur,height:900}});await p.setContent('<html><body><section class="vrm-favoris-liste" id="root"></section></body></html>');await p.addStyleTag({content:':root{--vrm-line:#d9e3e0;--vrm-card2:#edf1ee;--vrm-muted:#53696d}body{font-family:Arial;margin:16px}button{min-height:44px}'+fs.readFileSync(path.join(racine,'src/styles-captures.css'),'utf8')});await p.addScriptTag({content:bundle.outputFiles[0].text});await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).waitFor();await p.waitForFunction(()=>window.appels.length);return p;};
  let p=await page();const lancer=p.getByRole('button',{name:'Lancer les envois sélectionnés'});
  await p.waitForTimeout(80);check(await p.evaluate(()=>window.envois.length===0),'aucun envoi au montage');
  await p.evaluate(()=>window.afficher(false));check(await lancer.isDisabled(),'navigateur sans extension bloqué');
  await p.evaluate(()=>window.afficher(true,false));check(await lancer.isDisabled(),'réglages non enregistrés bloqués');
  await p.evaluate(()=>window.afficher(true,true));await lancer.click();await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();
  check(await p.evaluate(()=>window.envois.length===1),'un seul dispatch');
  check(await p.evaluate(()=>JSON.stringify(window.appels.find(x=>x.c.action==='lancer').c.selection)==='["n1","n2"]'),'seule la sélection est lancée');
  check(await p.evaluate(()=>window.appels.filter(x=>x.c.action==='terminer').every(x=>x.c.resultat==='envoye')),'reçu affiché seulement après finition serveur');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement horizontal');check(await p.locator('summary').evaluate(e=>e.getBoundingClientRect().height>=44),'résumé tactile de 44px');
  if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'automatisation-'+largeur+'.png'),fullPage:true});}await p.close();
  p=await page();await p.evaluate(()=>window.cas='perdu');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('alert').waitFor();await p.waitForTimeout(200);
  check(await p.evaluate(()=>window.envois.length===1),'accusé perdu : jamais de deuxième dispatch');check((await p.getByRole('alert').innerText()).includes('Aucun renvoi automatique'),'incertitude visible');await p.close();
  p=await page();await p.evaluate(()=>window.cas='bloque');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('alert').waitFor();check(await p.evaluate(()=>window.envois.length===0),'destinataire non confirmé : aucun dispatch');await p.close();
  p=await page();await p.evaluate(()=>window.cas='retard');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.waitForFunction(()=>typeof window.liberer==='function');
  await p.evaluate(()=>{window.owner='autre-vendeur';window.afficher(true,true,'autre-vendeur');window.liberer();});await p.waitForTimeout(100);
  check(await p.evaluate(()=>window.envois.length===0),'session changée avant départ : aucune exécution');await p.close();
 }}finally{await b.close();}console.log(controles+' contrôles de la file React réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
