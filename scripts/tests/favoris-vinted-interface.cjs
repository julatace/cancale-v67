// Vrai composant React, captures inventées et aucune action Vinted.
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');
const racine=path.resolve(__dirname,'../..');
(async()=>{
 const bdl=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import Favoris from'./src/FavorisVinted.jsx';
 const root=createRoot(document.getElementById('root'));window.owner='owner-test';window.appels=[];
 const notifications=Array.from({length:12},(_,i)=>({id:'notif-'+i,body:'Camille '+i+' a ajouté ton article à ses favoris.',actor:{login:'Camille '+i},image:{url:'https://images1.vinted.net/photo.png'},link:'/inbox/'+(100+i),updated_at:'2026-10-24T10:00:00Z'}));
 notifications.push({id:'autre',body:'Tu as reçu une offre de 45 €'});
 window.reglagesSauves={};
 window.fetch=async(url,opts)=>{
  window.appels.push({url,opts});if(window.attente)await new Promise(r=>window.liberer=r);
  const u=new URL(url);
  if(url.includes('vrm_favoris_reglages_')||opts.method==='POST'){
    if(opts.method==='POST'){const row=JSON.parse(opts.body);window.reglagesSauves[row.owner+'|'+row.id]=row;return{ok:!window.erreurSauvegarde,json:async()=>[row]};}
    const id=(u.searchParams.get('id')||'').slice(3),owner=(u.searchParams.get('owner')||'').slice(3),row=window.reglagesSauves[owner+'|'+id];
    return{ok:!window.erreurPreferences,json:async()=>row?[row]:[]};
  }
  return{ok:!window.erreur,json:async()=>[{owner:'owner-test',data:{uid:'123',domain:'www.vinted.fr',type:'notifications',payload:{notifications,pagination:{total_pages:4}}}}]};
 };
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async x=>window.copie=x},configurable:true});
 window.afficher=(uid='123',owner='owner-test')=>root.render(<Favoris uid={uid} owner={owner} ownerActuel={()=>window.owner} base="https://base.invalid" headers={()=>({Authorization:'Bearer fixture'})} nomCompte="Compte de démonstration"/>);window.afficher();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});let n=0;
 const check=(ok,m)=>{assert.ok(ok,m);n++;};
 try{for(const largeur of [320,390,1512]){
  const p=await b.newPage({viewport:{width:largeur,height:950}});
  await p.route('https://images1.vinted.net/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGz8AAAAASUVORK5CYII=','base64')}));
  await p.setContent('<html><body><div id="root"></div></body></html>');
  await p.addStyleTag({content:':root{--vrm-line:#d9e3e0;--vrm-surface:#fff;--vrm-card2:#edf1ee;--vrm-ink:#213b41;--vrm-muted:#53696d}body{font-family:Arial;margin:16px}'+fs.readFileSync(path.join(racine,'src/styles-captures.css'),'utf8')});
  await p.addScriptTag({content:bdl.outputFiles[0].text});
  await p.getByRole('button',{name:'Afficher les favoris'}).waitFor();
  check(await p.evaluate(()=>window.appels.length)===0,'pas de lecture au montage');
  await p.getByRole('button',{name:'Afficher les favoris'}).click();await p.locator('.vrm-favoris-rows article').first().waitFor();
  check(await p.locator('.vrm-favoris-rows article').count()===12,'12 favoris, pas la notification d’offre');
  check((await p.locator('.vrm-favoris-note').innerText()).includes('4 pages'),'couverture partielle explicite');
  const ligne=p.locator('.vrm-favoris-rows article').first();
  check(await ligne.locator('img').getAttribute('src')==='https://images1.vinted.net/photo.png','photo reçue affichée');
  const position=await ligne.evaluate(e=>{const a=e.querySelector('img').getBoundingClientRect(),b=e.querySelector('.vrm-favoris-texte').getBoundingClientRect(),c=e.querySelector('label').getBoundingClientRect();return a.right<=b.left&&b.right<=c.left;});
  check(position,'photo, texte et sélection alignés');
  await p.getByRole('checkbox',{name:'Sélectionner Camille 0',exact:true}).check();
  await p.getByRole('textbox',{name:'Ton message'}).fill('Bonjour, je peux proposer une remise de 10 %.');
  await p.getByRole('button',{name:'Copier le message'}).click();
  check(await p.evaluate(()=>window.copie)==='Bonjour, je peux proposer une remise de 10 %.','seul le message saisi est copié');
  check(await ligne.getByRole('link').getAttribute('href')==='https://www.vinted.fr/inbox/100','la destination est celle de la notification');
  check(await p.evaluate(()=>window.appels.every(x=>!x.opts.method)),'aucune écriture avant enregistrement explicite');
  await p.getByRole('textbox',{name:'Ton message',exact:true}).fill('Bonjour, merci pour ton favori !');
  await p.getByRole('button',{name:'−10 %',exact:true}).click();
  const apercu=await p.getByLabel('Aperçu du message',{exact:true}).innerText();
  check(apercu.includes('réduction de 10 %')&&!apercu.includes('€'),'remise proposée sans prix inventé');
  await p.getByRole('button',{name:'Copier le message'}).click();
  check(await p.evaluate(()=>window.copie)===apercu,'copie exacte du message et de la proposition de réduction');
  await p.getByLabel('Réduction proposée (%)',{exact:true}).fill('100');
  check(await p.getByRole('button',{name:'Copier le message'}).isDisabled(),'100 % reste invalide au lieu d’être tronqué en 10 %');
  await p.getByRole('button',{name:'−10 %',exact:true}).click();
  if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'parametres-'+largeur+'.png'),fullPage:true});}
  await p.getByLabel('Intervalle minimum prévu (minutes)',{exact:true}).fill('0');
  await p.getByRole('button',{name:'Enregistrer mes réglages',exact:true}).click();
  await p.getByRole('alert').waitFor();
  check(await p.evaluate(()=>window.appels.every(x=>!x.opts.method)),'cadence invalide : aucune écriture');
  await p.getByLabel('Intervalle minimum prévu (minutes)',{exact:true}).fill('7');
  await p.getByRole('button',{name:'Enregistrer mes réglages',exact:true}).click();
  await p.getByRole('status').filter({hasText:'Réglages enregistrés pour ce compte'}).waitFor();
  const sauves=await p.evaluate(()=>Object.values(window.reglagesSauves)[0]);
  check(sauves.owner==='owner-test'&&sauves.data.intervalleMinutes===7&&sauves.data.pourcentage===10&&sauves.data.envoisActifs===false,'préférences conservées pour le propriétaire et le compte sans activer l’envoi');

  await p.getByRole('button',{name:'Sélectionner les 10 premiers'}).click();
  check(await p.getByRole('checkbox',{checked:true}).count()===10,'préparation plafonnée à dix');
  check(await p.getByRole('checkbox',{name:'Sélectionner Camille 11',exact:true}).isDisabled(),'onzième choix désactivé');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement horizontal');
  const petits=await p.locator('button,a,.vrm-favoris-check').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&r.height<44;}).length);
  check(petits===0,'cibles tactiles au moins 44 px');
  check((await p.locator('.vrm-favoris-compose').innerText()).includes('n’est pas encore activé'),'envoi direct non promis');
  if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'favoris-'+largeur+'.png'),fullPage:true});}
  await p.getByRole('button',{name:'Masquer',exact:true}).click();check(await p.locator('.vrm-favoris-rows').count()===0,'liste repliable pour retrouver la messagerie');
  await p.getByRole('button',{name:'Afficher les favoris'}).click();await p.locator('.vrm-favoris-rows article').first().waitFor();
  await p.getByRole('button',{name:'Actualiser'}).click();await p.locator('.vrm-favoris-rows article').first().waitFor();
  await p.evaluate(()=>window.afficher('456'));await p.getByRole('button',{name:'Afficher les favoris'}).waitFor();
  await p.evaluate(()=>window.afficher('123'));await p.getByRole('button',{name:'Afficher les favoris'}).waitFor();
  await p.getByRole('button',{name:'Afficher les favoris'}).click();await p.locator('.vrm-favoris-rows article').first().waitFor();
  await p.getByRole('checkbox',{name:'Sélectionner Camille 0',exact:true}).check();
  check(await p.getByLabel('Intervalle minimum prévu (minutes)',{exact:true}).inputValue()==='7'&&await p.getByLabel('Réduction proposée (%)',{exact:true}).inputValue()==='10','message, remise et cadence réhydratés après changement de compte');
  await p.getByRole('button',{name:'Actualiser'}).click();await p.locator('.vrm-favoris-rows article').first().waitFor();

  check(await p.getByRole('checkbox',{checked:true}).count()===0,'actualisation remet la sélection à zéro');
  await p.evaluate(()=>window.erreur=true);await p.getByRole('button',{name:'Actualiser'}).click();await p.getByRole('alert').waitFor();
  check(await p.locator('.vrm-favoris-rows').count()===0,'une erreur ne présente pas une ancienne liste comme actuelle');
  await p.evaluate(()=>{window.erreur=false;window.attente=true;});await p.getByRole('button',{name:'Afficher les favoris'}).click();await p.waitForFunction(()=>typeof window.liberer==='function');
  await p.evaluate(()=>{window.owner='autre-owner';window.afficher('123','autre-owner');window.liberer();});await p.waitForTimeout(100);
  check(await p.locator('.vrm-favoris-rows').count()===0,'réponse de l’ancien propriétaire rejetée');
  check(await p.evaluate(()=>window.appels.every(x=>!x.opts.method||(x.opts.method==='POST'&&x.url.includes('/rest/v1/app_data?on_conflict=owner,id')&&JSON.parse(x.opts.body).data.envoisActifs===false))),'seuls les réglages explicitement sauvegardés sont écrits, aucun envoi Vinted');
  await p.close();
 }}finally{await b.close();}
 console.log(n+' contrôles de la liste favoris réussis');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
