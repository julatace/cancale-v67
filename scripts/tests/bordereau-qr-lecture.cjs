// Vrais PDF synthétiques : lit le QR AVANT/APRÈS le tampon réel de VRM.
// Cela ne remplace pas une impression et un scan avec le transporteur.
require('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const PL=require('pdf-lib'),qrcode=require('qrcode-generator'),{chromium}=require('playwright');
const lecteur=process.env.VRM_JSQR_PATH||require.resolve('jsqr');
const source=fs.readFileSync(process.env.VRM_APP_SOURCE||path.join(__dirname,'../../src/App.jsx'),'utf8');
const extrait=nom=>source.match(new RegExp('const '+nom+' = [\\s\\S]*?\\n};'))[0];
const contenu='VRM-ESSAI-SYNTHETIQUE-QR-2026';
const qr=qrcode(0,'M');qr.addData(contenu);qr.make();
(async()=>{
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await nav.newPage();
  await page.route('http://vrm.test/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
  await page.route('**/pdf.worker.min.js',r=>r.fulfill({body:fs.readFileSync(path.join(process.env.VRM_PDFJS_DIR,'pdf.worker.min.js')),contentType:'application/javascript'}));
  await page.goto('http://vrm.test/');
  await page.addScriptTag({content:fs.readFileSync(path.join(process.env.VRM_PDFJS_DIR,'pdf.min.js'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(lecteur,'utf8')});
  await page.evaluate(()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='http://vrm.test/pdf.worker.min.js';window.chargerPdfjs=async()=>pdfjsLib;});
  await page.addScriptTag({path:require.resolve('pdf-lib/dist/pdf-lib.min.js')});
  // (11 nov.) + `zoneEtiquette` et ce qu'elle appelle : la mention « Créé par VRM » en a besoin.
  const bloc=n=>(source.match(new RegExp('const '+n+' = (?:async )?\\([\\s\\S]*?\\n\\};'))||[''])[0],ligne=n=>(source.match(new RegExp('const '+n+' = [^\\n]*\\n'))||[''])[0];
  const etiq=[ligne('PAS_L_ETIQUETTE'),ligne('_mulM'),ligne('_apM'),ligne('ETIQ_TH'),ligne('TAILLES_ETIQUETTE'),bloc('relevePage'),bloc('_couperSelon'),bloc('estTailleEtiquette'),bloc('avecSens'),bloc('zoneEtiquette')].join('\n');
  await page.addScriptTag({content:'const MM_PT=72/25.4;'+etiq+';'+(s=>s.slice(s.indexOf('// ── LE TAMPON DU BORDEREAU'),s.indexOf('// ── IMPRIMANTE NORMALE OU THERMIQUE')))(source)+';window.tamponnerBordereau=tamponnerBordereau;'});
  async function lire(bytes){
   return page.evaluate(async bytes=>{
    const doc=await pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
    try{const p=await doc.getPage(1),v=p.getViewport({scale:1.5}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const ctx=c.getContext('2d');await p.render({canvasContext:ctx,viewport:v}).promise;return jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height)?.data||null;}
    finally{await doc.destroy();}
   },Array.from(bytes));
  }
  for(const [w,h,rotation,assemble,cadre] of [[595,842,0],[595,842,90],[595,842,180],[595,842,270],[842,595,0],[283,425,0],[283,425,0,true],[595,842,0,false,true],[595,842,270,false,true]]){
   let doc=await PL.PDFDocument.create(),p=doc.addPage([w,h]);p.setRotation(PL.degrees(rotation));
   const n=qr.getModuleCount(),module=4;let x=(w-n*module)/2,y=(h-n*module)/2;
   // (11 nov.) Une étiquette ENCADRÉE (le QR dedans, du texte), le reste blanc :
   // le N° ET la mention « Créé par VRM » sont posés ; le QR doit se lire après.
   if(cadre){const f=await doc.embedFont(PL.StandardFonts.Helvetica);x=60;y=h-80-n*module;p.drawRectangle({x:40,y:h-420,width:283,height:400,borderColor:PL.rgb(0,0,0),borderWidth:1});
    ['Destinataire','Jeanne Exemple','12 rue Imaginaire','75000 PARIS','FRANCE','Poids 0,5 kg','Colis 1/1','Ref 000123','Agence 24R','Tournee 12'].forEach((l,i)=>p.drawText(l,{x:60,y:h-240-i*14,size:10,font:f,color:PL.rgb(0,0,0)}));
    p.drawRectangle({x:60,y:h-410,width:200,height:20,color:PL.rgb(0,0,0)});}
   for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))p.drawRectangle({x:x+c*module,y:y+(n-1-r)*module,width:module,height:module,color:PL.rgb(0,0,0)});
   const avant=await doc.save();assert.equal(await lire(avant),contenu,'Le témoin initial doit être lisible');
   // Même chemin que les vrais bordereaux : PDF reçu puis chargé, et non un
   // flux de dessin de fabrication déjà sérialisé par pdf-lib.
   doc=await PL.PDFDocument.load(avant);p=doc.getPages()[0];
   if(assemble){const original=p;doc=await PL.PDFDocument.create();const emb=await doc.embedPage(original);p=doc.addPage([w,h]);p.drawPage(emb);}
   // (3 nov.) Le vrai chemin, dans la page : zone libre, sinon bande, sinon fiche.
   const apres=Uint8Array.from(await page.evaluate(async bytes=>{const d=await PDFLib.PDFDocument.load(new Uint8Array(bytes));await tamponnerBordereau(PDFLib,d,{numero:'B123',titre:'Article fictif'});return Array.from(await d.save());},Array.from(await doc.save())));
   const texte=await page.evaluate(async bytes=>{const d=await pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;try{return (await (await d.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');}finally{await d.destroy();}},Array.from(apres));
   assert.match(texte,/B123/,'Le numéro doit vraiment figurer dans le PDF final');
   if(cadre)assert.match(texte,/Créé par VRM/,'Étiquette encadrée, page blanche autour : la mention est posée');
   if(w===283)assert.doesNotMatch(texte,/Créé par VRM/,'Page-étiquette 10×15 : jamais de mention');
   assert.equal(await lire(apres),contenu,'Le tampon ne doit pas casser la lecture du QR');
   
   if(w===283){const casse=await PL.PDFDocument.load(apres);casse.getPages()[0].drawRectangle({x:x-16,y:y-16,width:n*module+32,height:n*module+32,color:PL.rgb(0,0,0)});assert.equal(await lire(await casse.save()),null,'Le lecteur doit détecter un QR effectivement détruit');}
   console.log(`OK QR avant/après : ${w}×${h}, rotation ${rotation}°, page inchangée${assemble?', assemblage thermique':''}${cadre?', étiquette encadrée + mention « Créé par VRM »':''}.`);
  }
 }finally{await nav.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
