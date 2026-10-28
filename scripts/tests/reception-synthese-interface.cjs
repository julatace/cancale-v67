// Composant réel, réseau simulé : contrôle regroupement, concurrence et propriétaire.
const {build}=require('esbuild'),{chromium}=require('playwright');const path=require('path'),assert=require('assert/strict'),fs=require('fs');
const racine=process.env.VRM_UI_ROOT||path.join(__dirname,'../..');
(async()=>{
 const bundle=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from 'react';import{createRoot}from'react-dom/client';import Reception from './src/ReceptionEmails.jsx';
 window.owner='A';window.version=7;window.appels=[];window.attendre=false;window.reponses=[];window.retour=[];
 window.IntersectionObserver=class{constructor(fn){window.observer=fn;}observe(){}disconnect(){}};
 const interval=window.setInterval;window.setInterval=(fn,ms)=>ms===60000?(window.passage=fn,1):interval(fn,ms);
 const data=owner=>({ok:true,emails:[{id:'1',subject:'Mail '+owner,adresses:['a@example.test'],compte:{id:'1',nom:'Compte '+owner},etat:'integre',type:'connu-sans-action',at:new Date().toISOString()},{id:'2',subject:'À vérifier',adresses:['b@example.test'],compte:{id:'2',nom:'Second '+owner},etat:'a-verifier',type:'information',at:new Date().toISOString()}],adresses:[{adresse:'a@example.test',declaree:true,comptes:[{id:'1',nom:'Compte '+owner}]},{adresse:'b@example.test',declaree:true,comptes:[{id:'2',nom:'Second '+owner}]}],collecteur:{dernierSucces:new Date().toISOString()}});
 window.fetch=async(url,o)=>{const owner=window.owner;window.appels.push({owner,signal:o.signal});if(window.attendre)await new Promise(r=>window.reponses.push(r));return{ok:true,json:async()=>data(owner)};};
 const root=createRoot(document.getElementById('root'));window.afficher=()=>root.render(<Reception owner={window.owner} headers={()=>({Authorization:'Bearer fictif'})} version={window.version} onAdresses={d=>window.retour.push(d.owner)}/>);window.afficher();
 `},bundle:true,write:false,outfile:'/tmp/reception-test.js',logLevel:'silent'});
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [390,1512]){
  const p=await nav.newPage({viewport:{width,height:900}});p.setDefaultTimeout(10000);await p.setContent('<div id="root"></div>');
  for(const f of bundle.outputFiles)if(f.path.endsWith('.css'))await p.addStyleTag({content:f.text});
  await p.addScriptTag({content:bundle.outputFiles.find(f=>f.path.endsWith('.js')).text});
  await p.locator('.vrm-reception-liste').getByText('Mail A',{exact:true}).waitFor();assert.equal(await p.evaluate(()=>window.appels.length),1,'Une version initiale non nulle ne double pas la lecture');
  await p.locator('.vrm-reception-synthese > summary').click();await p.getByRole('button',{name:'Voir les emails de b@example.test',exact:true}).click();assert.equal(await p.locator('.vrm-reception-liste > li').count(),1);
  await p.getByLabel('Compte / adresse').selectOption('toutes');await p.getByRole('button',{name:'Tous les états',exact:true}).click();await p.getByRole('searchbox').fill('Compte A');assert.equal(await p.locator('.vrm-reception-liste > li').count(),1);await p.getByRole('searchbox').fill('');
  await p.evaluate(()=>{window.observer([{isIntersecting:false}]);window.observer([{isIntersecting:true}]);});await p.waitForTimeout(40);assert.equal(await p.evaluate(()=>window.appels.length),1,'Défiler ne relit pas un suivi qui vient d’être reçu');
  await p.evaluate(()=>{window.observer([{isIntersecting:false}]);window.passage();});await p.waitForTimeout(40);assert.equal(await p.evaluate(()=>window.appels.length),1,'Le panneau masqué ne relit pas le serveur');
  await p.evaluate(()=>{window.attendre=true;window.observer([{isIntersecting:true}]);window.passage();window.passage();});await p.waitForTimeout(40);assert.equal(await p.evaluate(()=>window.appels.length),2,'Les lectures concurrentes partagent la même requête');
  await p.evaluate(()=>{window.owner='B';window.attendre=false;window.afficher();});await p.locator('.vrm-reception-liste').getByText('Mail B',{exact:true}).waitFor();
  assert.equal(await p.evaluate(()=>window.appels[1].signal.aborted),true);await p.evaluate(()=>window.reponses.forEach(r=>r()));await p.waitForTimeout(40);
  assert.equal(await p.locator('.vrm-reception-liste').getByText('Mail A',{exact:true}).count(),0);assert.equal(await p.evaluate(()=>window.retour.at(-1)),'B');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'reception-synthese-'+width+'.png'),fullPage:true});}await p.close();console.log('OK réception '+width+'px : synthèse, recherche, lecture unique, panneau masqué et réponse périmée isolée.');
 }}finally{await nav.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
