const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');const racine=path.resolve(__dirname,'../..');
(async()=>{
 const bundle=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import Auto from'./src/AutomatisationFavoris.jsx';
 const root=createRoot(document.getElementById('root'));window.owner='owner-test';window.appels=[];window.envois=[];window.cas=window.premierCas||'ok';window.n=0;window.saves=0;
 const attente={active:false,raison:'',jobs:[]},active={active:true,raison:'',jobs:[{id:'j1',notificationId:'n1',etat:'attente'}]},fini={active:false,raison:'',jobs:[{id:'j1',notificationId:'n1',etat:'envoye'}]};
 const interval=window.setInterval;window.setInterval=(fn)=>interval(fn,40);
 window.fetch=async(url,o={})=>{
  const c=o.body?JSON.parse(o.body):{};window.appels.push({url,c});
  if(window.cas==='lectureLente'&&!c.action)await new Promise(r=>window.libererLecture=r);
  if(window.cas==='fileIndisponible'&&!c.action)return{ok:false,json:async()=>({message:'Lecture temporairement indisponible.'})};
  if(window.cas==='retard'&&c.action==='suivant')await new Promise(r=>window.liberer=r);
  if(window.cas==='bloque'&&c.action==='lancer')return{ok:false,json:async()=>({message:'Le destinataire n’est pas confirmé.'})};
  if(window.cas==='perdu'&&c.action==='terminer')return{ok:false,json:async()=>({message:'Accusé interrompu.'})};
  let j={ok:true,vue:attente};
  if(c.action==='lancer')j={ok:true,vue:active};
  if(window.cas==='compteArebours'&&['lancer','suivant'].includes(c.action)){window.echeance=window.echeance||Date.now()+4000;j={ok:true,vue:{...active,prochain:window.echeance,intervalleMinutes:6}};}
  if(c.action==='suivant'&&window.cas!=='compteArebours')j=window.n++?{ok:true,vue:active}:{ok:true,vue:{...active,jobs:active.jobs.map(x=>({...x,etat:'reserve'}))},travail:{jeton:'jeton-unique',suivi:'s1'}};
  if(c.action==='terminer')j={ok:true,vue:{...fini,jobs:fini.jobs.map(x=>({...x,etat:c.resultat,raison:c.raison}))}};
  return{ok:true,json:async()=>j};
 };
 window.afficher=(disponible=true,prets=true,owner='owner-test',autoSave=false,ecranActif=true)=>root.render(<Auto ecranActif={ecranActif} key={owner} uid="123" owner={owner} ownerActuel={()=>window.owner} headers={()=>({Authorization:'Bearer fixture'})} selection={['n1','n2']} reglagesPrets={prets} reglages={{message:"Bonjour",pourcentage:10,intervalleMinutes:6}} disponible={disponible} preparerReglages={autoSave?async()=>{window.saves++;if(window.saveFail)throw Error('Sauvegarde non confirmée.');return{message:'Bonjour',pourcentage:10,intervalleMinutes:6};}:undefined} executer={async t=>{window.envois.push(t);if(window.pauseExec)await new Promise(r=>window.resoudreExec=r);return{ok:true,data:{resultat:'envoye'}};}}/>);
 window.afficher();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});let controles=0;
 const check=(v,m)=>{assert.ok(v,m);controles++;};
 try{for(const largeur of [320,390,1512]){
  const page=async(mode='ok')=>{const p=await b.newPage({viewport:{width:largeur,height:900}});await p.setContent('<html><body><section class="vrm-favoris-liste" id="root"></section></body></html>');await p.addStyleTag({content:':root{--vrm-line:#d9e3e0;--vrm-card2:#edf1ee;--vrm-muted:#53696d}body{font-family:Arial;margin:16px}button{min-height:44px}'+fs.readFileSync(path.join(racine,'src/styles-captures.css'),'utf8')});await p.evaluate(mode=>window.premierCas=mode,mode);await p.addScriptTag({content:bundle.outputFiles[0].text});await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).waitFor();await p.waitForFunction(()=>window.appels.length);return p;};
  let p=await page();const lancer=p.getByRole('button',{name:'Lancer les envois sélectionnés'});
  await p.waitForTimeout(80);check(await p.evaluate(()=>window.envois.length===0),'aucun envoi au montage');
  await p.evaluate(()=>window.afficher(false));check(await lancer.isEnabled(),'le bouton reste cliquable pour expliquer le blocage');await lancer.click();await p.getByRole('alert').waitFor();check(await p.evaluate(()=>window.envois.length===0&&!window.appels.some(x=>x.c.action==='lancer')),'absence extension : explication et aucun lancement');
  await p.evaluate(()=>window.afficher(true,false));await lancer.click();await p.getByRole('alert').filter({hasText:'Enregistre ton message'}).waitFor();check(await p.evaluate(()=>!window.appels.some(x=>x.c.action==='lancer')),'réglages manquants expliqués sans envoi');
  await p.evaluate(()=>window.afficher(true,true));await lancer.click();await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();
  check(await p.evaluate(()=>window.envois.length===1),'un seul dispatch');
  check(await p.evaluate(()=>JSON.stringify(window.appels.find(x=>x.c.action==='lancer').c.selection)==='["n1","n2"]'),'seule la sélection est lancée');
  check(await p.evaluate(()=>window.appels.filter(x=>x.c.action==='terminer').every(x=>x.c.resultat==='envoye')),'reçu affiché seulement après finition serveur');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement horizontal');check(await p.locator('summary').evaluate(e=>e.getBoundingClientRect().height>=44),'résumé tactile de 44px');
  if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'automatisation-'+largeur+'.png'),fullPage:true});}await p.close();
  p=await page('fileIndisponible');await p.getByRole('alert').waitFor();await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();check(await p.evaluate(()=>window.envois.length===1),'lecture initiale échouée ne verrouille pas le lancement serveur');await p.close();
  p=await page('lectureLente');await p.waitForFunction(()=>typeof window.libererLecture==='function');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();await p.evaluate(()=>window.libererLecture());await p.waitForTimeout(100);check(await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).count()===1,'ancienne lecture ne remplace pas la file lancée');await p.close();
  p=await page();await p.evaluate(()=>window.afficher(true,false,'owner-test',true));await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();check(await p.evaluate(()=>window.saves===1&&window.envois.length===1),'un clic sauvegarde le brouillon puis lance la sélection');await p.close();
  p=await page();await p.evaluate(()=>{window.saveFail=true;window.afficher(true,false,'owner-test',true);});await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('alert').waitFor();check(await p.evaluate(()=>window.envois.length===0&&!window.appels.some(x=>x.c.action==='lancer')),'sauvegarde non confirmée : aucun lancement');await p.close();
  p=await page();await p.evaluate(()=>window.cas='perdu');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('alert').waitFor();await p.waitForTimeout(200);
  check(await p.evaluate(()=>window.envois.length===1),'accusé perdu : jamais de deuxième dispatch');check((await p.getByRole('alert').innerText()).includes('Aucun renvoi automatique'),'incertitude visible');await p.close();
  p=await page();await p.evaluate(()=>window.pauseExec=true);await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.waitForFunction(()=>typeof window.resoudreExec==='function');
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('vrm:ext',{detail:{type:'favoris',uid:'123',suivi:'autre',etape:'envoi'}})));check(!await p.getByRole('status').filter({hasText:'Envoi du message'}).count(),'événement étranger ignoré');
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('vrm:ext',{detail:{type:'favoris',uid:'123',suivi:'s1',etape:'historique'}})));await p.getByRole('status').filter({hasText:'Vérification des messages existants'}).waitFor();if(process.env.SHOTS)await p.screenshot({path:path.join(process.env.SHOTS,'phase-'+largeur+'.png'),fullPage:true});const partiel=Number(await p.getByRole('progressbar').getAttribute('value'));check(partiel>0&&partiel<1,'barre partielle sur une étape réelle sans inventer un succès');
  await p.evaluate(()=>window.resoudreExec());await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();check(await p.getByRole('progressbar').getAttribute('value')==='1','barre avancée après accusé serveur');await p.close();
  p=await page();await p.evaluate(()=>window.cas='compteArebours');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('status').filter({hasText:'Prochaine vérification dans'}).waitFor();const avant=await p.getByRole('status').filter({hasText:'Prochaine vérification dans'}).innerText();await p.waitForTimeout(1200);const apres=await p.getByRole('status').filter({hasText:'Prochaine vérification dans'}).innerText();if(process.env.SHOTS)await p.screenshot({path:path.join(process.env.SHOTS,'attente-'+largeur+'.png'),fullPage:true});check(avant!==apres,'compte à rebours réellement actualisé');check(await p.evaluate(()=>window.envois.length===0),'attente sans envoi prématuré');await p.close();
  p=await page();await p.evaluate(()=>window.cas='bloque');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('alert').waitFor();check(await p.evaluate(()=>window.envois.length===0),'destinataire non confirmé : aucun dispatch');await p.close();
  p=await page();await p.evaluate(()=>{window.cas='retard';window.afficher(true,true,'owner-test',false,true);});await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.waitForFunction(()=>typeof window.liberer==='function');
  await p.evaluate(()=>window.afficher(true,true,'owner-test',false,false));await p.waitForTimeout(50);await p.evaluate(()=>window.liberer());await p.waitForTimeout(100);
  check(await p.evaluate(()=>window.envois.length===0),'écran quitté pendant la réservation : aucun message dispatché');check(await p.evaluate(()=>window.appels.some(x=>x.c.action==='terminer'&&x.c.resultat==='refuse'&&x.c.raison==='ecran_inactif')),'réservation annulée explicitement sans inventer un envoi');await p.close();
  p=await page();await p.evaluate(()=>{Object.defineProperty(AbortSignal,'timeout',{value:undefined,configurable:true});});await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.getByRole('status').filter({hasText:'1 envoyé(s)'}).waitFor();check(await p.evaluate(()=>window.envois.length===1),'ancien Safari : la fonction absente ne bloque plus le parcours');await p.close();
  p=await page();await p.evaluate(()=>window.cas='retard');await p.getByRole('button',{name:'Lancer les envois sélectionnés'}).click();await p.waitForFunction(()=>typeof window.liberer==='function');
  await p.evaluate(()=>{window.owner='autre-vendeur';window.afficher(true,true,'autre-vendeur');window.liberer();});await p.waitForTimeout(100);
  check(await p.evaluate(()=>window.envois.length===0),'session changée avant départ : aucune exécution');await p.close();
 }}finally{await b.close();}console.log(controles+' contrôles de la file React réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
