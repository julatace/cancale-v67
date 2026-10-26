// Vrai composant React, données fictives ; aucune session ou écriture externe.
const fs=require('node:fs'),assert=require('node:assert/strict');const{build}=require('esbuild');const{chromium}=require('playwright');
(async()=>{
 const ad=(id,status,subject)=>({id,status,subject,account:'compte-test',accountName:'Compte test',price:1299.95,images:['https://img.example.test/photo.svg'],url:'https://www.leboncoin.fr/ad/test/'+id});
 const annonces=[ad('1','active','Ordinateur portable avec un titre particulièrement long'),ad('2','paused','Appareil photo en pause'),ad('3','active','Article déjà vendu'),ad('4','sold','Autre vente'),ad('5','nouvel-etat','Article à vérifier')];
 const ventes={t:{itemId:'3',isSeller:true,stepLabel:'Colis en cours de livraison'}};
 const result=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import Catalogue from './src/AnnoncesLeboncoin.jsx';const root=createRoot(document.getElementById('root'));window.afficher=p=>root.render(<div className="vrm-app-shell"><main className="vrm-main"><Catalogue {...p}/></main></div>);`,loader:'jsx',resolveDir:process.cwd()},bundle:true,write:false,loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await chromium.launch({executablePath:(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});let n=0;
 try{for(const theme of ['light','dark'])for(const width of [320,390,1512]){
  const p=await browser.newPage({viewport:{width,height:900}});let erreurs=[];p.on('pageerror',e=>erreurs.push(e.message));
  await p.route('**/*',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="40" height="60"><rect width="40" height="60" fill="#abc"/></svg>'}));
  await p.setContent(`<html data-theme="${theme}"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;font-family:Arial"><div id="root"></div></body></html>`);
  await p.addStyleTag({content:fs.readFileSync('src/styles-gestion.css','utf8')+fs.readFileSync('src/annonces-leboncoin.css','utf8')});await p.addScriptTag({content:result.outputFiles[0].text});
  await p.evaluate(props=>window.afficher(props),{annonces,ventes});await p.locator('li').first().waitFor();
  assert.equal(await p.locator('[data-lbc-catalog-etat=vendue]').count(),2);assert.equal(await p.locator('[data-lbc-catalog-etat=pause]').count(),1);
  assert.equal(await p.locator('li').filter({hasText:'Article déjà vendu'}).getByText('Livraison · Colis en cours de livraison').count(),1);
  await p.getByRole('button',{name:/^En pause/}).click();assert.equal(await p.locator('li').count(),1);assert.match(await p.locator('li').innerText(),/Appareil photo/);
  await p.getByRole('button',{name:/^Actives/}).click();assert.equal(await p.locator('li').count(),1);
  await p.getByRole('button',{name:/^Toutes/}).click();await p.getByRole('searchbox').fill('à vérifier');assert.equal(await p.locator('li').count(),1);await p.getByRole('searchbox').fill('');
  const m=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,money:[...document.querySelectorAll('li>b')].some(e=>e.scrollWidth>e.clientWidth),small:[...document.querySelectorAll('button,a,input')].some(e=>e.getBoundingClientRect().height<44)}));assert.deepEqual(m,{overflow:false,money:false,small:false});assert.equal(erreurs.length,0);
  if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:process.env.SHOTS+`/annonces-${theme}-${width}.png`,fullPage:true});}
  await p.evaluate(()=>window.afficher({lectureKO:true}));await p.getByRole('status').waitFor();assert.equal(await p.locator('li').count(),0);assert.match(await p.getByRole('status').innerText(),/conservé/);
  await p.close();n++;console.log('OK annonces '+theme+' '+width);
 }console.log(n+' parcours catalogue validés');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
