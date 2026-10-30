// Le vrai composant React, uniquement des réponses synthétiques, aucun envoi.
const path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');
const fs=require('node:fs');
const racine=path.resolve(__dirname,'../..');
(async()=>{
 const bundle=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from 'react';import{createRoot}from'react-dom/client';
 import Diagnostic from './src/DiagnosticFavoris.jsx';
 const root=createRoot(document.getElementById('root'));
 window.owner='vendeur-test';window.appels=[];window.lecture='ok';
 window.fetch=async(url,opts)=>{window.appels.push({url,opts});if(window.lecture==='attente')await new Promise(r=>window.liberer=r);return{ok:window.lecture!=='erreur',json:async()=>window.lecture==='vide'?[]:[{owner:'vendeur-test',data:{uid:'123',type:'notifications',payload:{notifications:[{user:{id:555,login:'pseudo-confidentiel'},item:{id:456},conversation_id:789,body:'message-confidentiel'}]}}}]};};
 window.afficher=(uid='123',owner='vendeur-test',controle=null)=>root.render(<Diagnostic controle={controle} uid={uid} owner={owner} ownerActuel={()=>window.owner} base="https://base.invalid" headers={()=>({Authorization:'Bearer session-fictive'})}/>);
 Object.defineProperty(navigator,'clipboard',{value:{writeText:async x=>window.copie=x},configurable:true});
 window.afficher();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});
 let controles=0;const check=(condition,message)=>{assert.ok(condition,message);controles++;};
 try{for(const largeur of [320,390,1512]){
  const p=await b.newPage({viewport:{width:largeur,height:900}});
  await p.setContent('<html><body><div id="root"></div></body></html>');
  await p.addStyleTag({content:':root{--vrm-line:#d9e3e0;--vrm-surface:#fff;--vrm-card2:#edf1ee;--vrm-ink:#213b41;--vrm-muted:#53696d}body{font-family:Arial;margin:16px}'+fs.readFileSync(path.join(racine,'src/styles-captures.css'),'utf8')});
  await p.addScriptTag({content:bundle.outputFiles[0].text});
  const verifier=p.getByRole('button',{name:'Vérifier la capture des notifications'});
  await p.locator('summary').click();
  check(await p.evaluate(()=>window.appels.length)===0,'aucune lecture au montage ou au dépliage');
  await verifier.click();await p.locator('pre').waitFor();
  const texte=await p.locator('pre').innerText();
  check(texte.includes('conversation_id')&&!texte.includes('555')&&!texte.includes('789')&&!texte.includes('confidentiel'),'structure lisible, valeurs privées absentes');
  await p.getByRole('button',{name:'Copier le diagnostic'}).click();
  check(await p.evaluate(()=>window.copie)===texte,'copie du rapport affiché');
  check(JSON.parse(texte).verification.etat==='aucune_verification_dans_cette_vue','la capture seule ne prétend pas vérifier une ouverture');
  const avantControle=await p.evaluate(()=>window.appels.length);
  await p.evaluate(()=>window.afficher('123','vendeur-test',{extension:'5.223.0',ouvert:false,preuve:'ouverture_non_confirmee',etape:'commande',code:'favori_non_trouve'}));
  await p.getByRole('status').filter({hasText:'Blocage : le favori'}).waitFor();
  await p.getByRole('button',{name:'Copier le diagnostic'}).click();
  check(await p.evaluate(()=>JSON.parse(window.copie).verification.code==='favori_non_trouve'),'le même bouton joint le résultat réel de la dernière ouverture');
  check(await p.evaluate(()=>window.appels.length)===avantControle,'le nouveau contrôle ne relance aucune lecture ni action');
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'pas de débordement horizontal');
  check(await p.locator('button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)),'cibles tactiles de 44 px');
  await p.evaluate(()=>window.lecture='vide');await verifier.click();await p.getByRole('status').filter({hasText:'Aucune capture reçue'}).waitFor();
  check((await p.locator('pre').innerText()).includes('aucune_capture'),'absence distincte d’une erreur');
  await p.evaluate(()=>window.lecture='erreur');await verifier.click();await p.getByRole('alert').waitFor();
  check(await p.locator('pre').count()===0,'une erreur ne réutilise pas le précédent résultat');
  await p.evaluate(()=>window.afficher(''));
  await p.getByText('Choisis le compte Vinted à vérifier',{exact:false}).waitFor();/* root.render de React 18 est asynchrone : on attend le rendu sans compte */check(await verifier.isDisabled(),'compte non sélectionné : bouton inactif');
  await p.evaluate(()=>{window.afficher('123');window.lecture='attente';});await verifier.waitFor();await verifier.click();
  await p.waitForFunction(()=>typeof window.liberer==='function');
  await p.evaluate(()=>{window.owner='autre-vendeur';window.afficher('123','autre-vendeur');window.liberer();});
  await p.waitForTimeout(100);
  check(await p.locator('pre').count()===0,'réponse de l’ancien propriétaire rejetée');
  check(await p.evaluate(()=>window.appels.every(x=>!x.opts.method)),'aucun appel d’écriture ni action marketplace');
  await p.close();
 }}finally{await b.close();}
 console.log(`${controles} contrôles du diagnostic favoris réussis`);
})().catch(e=>{console.error(e.message);process.exitCode=1;});
