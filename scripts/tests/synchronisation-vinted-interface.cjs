const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');const bundle=await build({stdin:{resolveDir:root,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import Sync from'./src/SynchronisationVinted.jsx';
 const root=createRoot(document.getElementById('root'));window.owner='a';window.mode='ok';window.lectures=0;
 const cap=new Date(Date.now()-3600000).toISOString();
 const rows=o=>o==='a'?[{id:'harvest_123_inbox',owner:o,cap,pages:'1'},{id:'harvest_123_notifications',owner:o,cap,pages:'5'},{id:'harvest_456_inbox',owner:o,cap,pages:'1'},{id:'harvest_456_favoris_archive',owner:o,cap,sync:{complete:true},limite:false}]:[{id:'harvest_123_inbox',owner:o,cap,pages:'1'}];
 window.afficher=o=>root.render(<Sync comptes={o==='a'?[{uid:'123',nom:'Compte Alice'},{uid:'456',nom:'Compte Bob'}]:[{uid:'123',nom:'Compte nouveau'}]} owner={o} ownerActuel={()=>window.owner} lire={async q=>{window.lectures++;if(window.mode==='panne')return null;if(window.mode==='lent'&&o==='a')await new Promise(r=>window.finAncienneLecture=r);return rows(o);}}/>);window.afficher('a');`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined,args:['--no-sandbox']});let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of [320,390,1512]){const p=await b.newPage({viewport:{width,height:900}});await p.setContent('<div id="root"></div>');await p.addStyleTag({content:'body{font-family:Arial;margin:12px}'+fs.readFileSync(path.join(root,'src/styles-captures.css'),'utf8')});await p.addScriptTag({content:bundle.outputFiles[0].text});
 await p.getByText(/^Synchronisation par compte · 2 comptes/).waitFor();check(await p.locator('details').evaluate(e=>!e.open),'panel collapsed initially');await p.locator('summary').click();await p.getByText('Compte Alice',{exact:true}).waitFor();
 check(await p.locator('.vrm-sync-lignes article').count()===2,'one row per linked account');check(await p.locator('time[datetime]').count()===4,'dates come from four received sources');check(await p.getByText('Historique à compléter',{exact:true}).count()===1,'incomplete notification history is identified');
 check((await p.locator('.vrm-sync-lignes').innerText()).includes('Récupérer toutes les pages'),'incomplete favorite history has a precise next action');check(await p.getByRole('link',{name:/Ouvrir Vinted/}).getAttribute('href')==='https://www.vinted.fr','read-only route to Vinted');
 await p.evaluate(()=>window.mode='lent');await p.getByRole('button',{name:'Actualiser l’état',exact:true}).click();await p.waitForFunction(()=>typeof window.finAncienneLecture==='function');
 await p.evaluate(()=>{window.owner='b';window.mode='ok';window.afficher('b');});await p.getByText('Compte nouveau',{exact:true}).waitFor();await p.evaluate(()=>window.finAncienneLecture());await p.waitForTimeout(100);
 check(await p.getByText('Compte Alice',{exact:true}).count()===0,'late old-owner result cannot reappear');check(await p.locator('.vrm-sync-lignes article').count()===1,'only current-owner accounts remain');
 await p.evaluate(()=>window.mode='panne');await p.getByRole('button',{name:'Actualiser l’état',exact:true}).click();await p.getByRole('alert').waitFor();check(await p.locator('time').count()===0,'failed read does not retain a misleading success state');check(await p.getByText('Aucune capture',{exact:true}).count()===0,'failed read is not an empty history');check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');await p.close();}}
 finally{await b.close();}console.log(n+' contrôles synchronisation React réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
