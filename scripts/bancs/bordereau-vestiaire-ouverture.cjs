require('./_porte-banc.cjs');
const {build}=require('esbuild'),{chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),PL=require('pdf-lib');
const root=path.resolve(__dirname,'../..'),s=fs.readFileSync(path.join(root,'src/App.jsx'),'utf8');
const code=s.slice(s.indexOf('async function imprimerBordereauVc('),s.indexOf('// Le prix d\'achat d\'une vente Vestiaire'));
(async()=>{const pdf=await PL.PDFDocument.create();pdf.addPage();const b64=Buffer.from(await pdf.save()).toString('base64');
 const bundle=await build({stdin:{resolveDir:root,loader:'jsx',contents:`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{lireBordereauVestiaire}from'./src/bordereauVestiaire.js';
 window.owner='A';window.mode='reseau';window.lus=0;window.ouverts=0;window.marques=0;
 const AUTH={get user(){return{id:window.owner}}},readSession=()=>({user:{id:window.owner}}),SUPABASE_URL='https://base.invalid',C={accent:'#0066cc',muted:'#6e6e73',warn:'#9a5200'},Icon=()=>null,Bouton=p=><button {...p}/>;
 const lireBaseRelue=async()=>{window.lus++;if(window.mode==='reseau')throw Error('Réseau');if(window.mode==='lent')await new Promise(r=>window.fin=r);return window.mode==='absent'?[]:[{b64:${JSON.stringify(b64)}}]};
 const b64ToBytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),libererOngletPdf=()=>{},estTamponAnnule=()=>false,marquerVc=()=>window.marques++,ouvrirPdfOnglet=()=>{window.ouverts++;return true},annotateAndDownloadBordereau=async(n,t,b,p,o)=>{o.avantOuverture();window.ouverts++;return{ouvert:true}};
 ${code}
 const r=createRoot(document.getElementById('root'));window.archiver=()=>r.render(<BoutonImprimerVc key="archive" lectureSeule v={{id:'123',bordereau:{id:'vc_label_123'}}}/>);r.render(<BoutonImprimerVc v={{id:'123',num:'7',titre:'Article fictif',bordereau:{id:'vc_label_123'}}}/>);`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const width of [390,1512]){const p=await b.newPage({viewport:{width,height:850}});await p.setContent('<div id="root"></div>');await p.addScriptTag({content:bundle.outputFiles[0].text});
 const imprimer=p.locator('[data-vc-imprimer]'),original=p.locator('[data-vc-original]');await imprimer.click();await p.getByRole('alert').waitFor();assert.ok(await imprimer.isEnabled(),'réseau refusé : le bouton peut réessayer');
 await p.evaluate(()=>window.mode='ok');await original.click();await p.waitForFunction(()=>window.ouverts===1);assert.equal(await p.evaluate(()=>window.marques),0,'ouvrir l’original ne marque pas imprimé');
 await imprimer.click();await p.waitForFunction(()=>window.marques===1);assert.equal(await p.evaluate(()=>window.ouverts),2,'réessai d’impression réussi');
 await p.evaluate(()=>window.mode='lent');await imprimer.click();await p.waitForFunction(()=>typeof window.fin==='function');await p.locator('[data-vc-imprimer]').dispatchEvent('click');assert.equal(await p.evaluate(()=>window.lus),4,'double clic : une seule lecture');
 await p.evaluate(()=>{window.owner='B';window.fin()});await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>window.ouverts),2,'le résultat privé A n’ouvre pas de PDF pour B');assert.equal(await p.evaluate(()=>window.marques),1,'aucun marquage sous B');
 await p.evaluate(()=>{window.owner='A';window.mode='ok';window.archiver()});await p.locator('[data-vc-original]').waitFor();assert.equal(await p.locator('[data-vc-imprimer]').count(),0,'archive : ouverture seule, sans impression automatique');await p.locator('[data-vc-original]').click();await p.waitForFunction(()=>window.ouverts===3);assert.equal(await p.evaluate(()=>window.marques),1);
 await p.close();console.log('✅ Vestiaire '+width+' : reprise, PDF original réel, impression et propriétaire');
 }}finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
