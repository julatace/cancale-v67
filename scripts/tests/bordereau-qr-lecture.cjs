// Vrais PDF synthétiques : lit le QR AVANT/APRÈS le tampon réel de VRM.
// Cela ne remplace pas une impression et un scan avec le transporteur.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const PL=require('pdf-lib'),qrcode=require('qrcode-generator'),{chromium}=require('playwright');
const lecteur=process.env.VRM_JSQR_PATH||require.resolve('jsqr');
const source=fs.readFileSync(process.env.VRM_APP_SOURCE||path.join(__dirname,'../../src/App.jsx'),'utf8');
const extrait=nom=>source.match(new RegExp('const '+nom+' = [\\s\\S]*?\\n};'))[0];
const tampon=vm.runInNewContext(extrait('drawBordereauStamp')+';drawBordereauStamp');
const contenu='VRM-ESSAI-SYNTHETIQUE-QR-2026';
const qr=qrcode(0,'M');qr.addData(contenu);qr.make();
(async()=>{
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await nav.newPage();
  await page.route('http://vrm.test/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
  await page.route('**/pdf.worker.min.js',r=>r.fulfill({body:fs.readFileSync(path.join((process.env.VRM_PDFJS_DIR||require('path').join(__dirname,'..','..','public','pdfjs-3.11.174')),'pdf.worker.min.js')),contentType:'application/javascript'}));
  await page.goto('http://vrm.test/');
  await page.addScriptTag({content:fs.readFileSync(path.join((process.env.VRM_PDFJS_DIR||require('path').join(__dirname,'..','..','public','pdfjs-3.11.174')),'pdf.min.js'),'utf8')});
  await page.addScriptTag({content:fs.readFileSync(lecteur,'utf8')});
  await page.evaluate(()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='http://vrm.test/pdf.worker.min.js';window.chargerPdfjs=async()=>pdfjsLib;});
  for(const nom of ['trouverZoneBlanche','espaceBlancBordereau'])await page.addScriptTag({content:extrait(nom)+`;window.${nom}=${nom};`});
  async function lire(bytes){
   return page.evaluate(async bytes=>{
    const doc=await pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;
    try{const p=await doc.getPage(1),v=p.getViewport({scale:1.5}),c=document.createElement('canvas');c.width=Math.ceil(v.width);c.height=Math.ceil(v.height);const ctx=c.getContext('2d');await p.render({canvasContext:ctx,viewport:v}).promise;return jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height)?.data||null;}
    finally{await doc.destroy();}
   },Array.from(bytes));
  }
  for(const [w,h,rotation,assemble] of [[595,842,0],[595,842,90],[595,842,180],[595,842,270],[842,595,0],[283,425,0],[283,425,0,true]]){
   let doc=await PL.PDFDocument.create(),p=doc.addPage([w,h]);p.setRotation(PL.degrees(rotation));
   const n=qr.getModuleCount(),module=4,x=(w-n*module)/2,y=(h-n*module)/2;
   for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(qr.isDark(r,c))p.drawRectangle({x:x+c*module,y:y+(n-1-r)*module,width:module,height:module,color:PL.rgb(0,0,0)});
   const avant=await doc.save();assert.equal(await lire(avant),contenu,'Le témoin initial doit être lisible');
   // Même chemin que les vrais bordereaux : PDF reçu puis chargé, et non un
   // flux de dessin de fabrication déjà sérialisé par pdf-lib.
   doc=await PL.PDFDocument.load(avant);p=doc.getPages()[0];
   if(assemble){const original=p;doc=await PL.PDFDocument.create();const emb=await doc.embedPage(original);p=doc.addPage([w,h]);p.drawPage(emb);}
   const aAnalyser=await doc.save();
   const position=await page.evaluate(bytes=>espaceBlancBordereau({save:async()=>new Uint8Array(bytes)},true),Array.from(aAnalyser));
   const bold=await doc.embedFont(PL.StandardFonts.HelveticaBold),reg=await doc.embedFont(PL.StandardFonts.Helvetica);
   tampon(doc,PL.rgb,bold,reg,'B123','Article fictif',position);
   const apres=await doc.save();
   const texte=await page.evaluate(async bytes=>{const d=await pdfjsLib.getDocument({data:new Uint8Array(bytes),isEvalSupported:false}).promise;try{return (await (await d.getPage(1)).getTextContent()).items.map(i=>i.str).join(' ');}finally{await d.destroy();}},Array.from(apres));
   assert.match(texte,/B123/,'Le numéro doit vraiment figurer dans le PDF final');
   assert.equal(await lire(apres),contenu,'Le tampon ne doit pas casser la lecture du QR');
   assert.equal(p.getWidth(),w);assert.equal(p.getHeight(),h);
   if(w===283){const casse=await PL.PDFDocument.load(apres);casse.getPages()[0].drawRectangle({x:x-16,y:y-16,width:n*module+32,height:n*module+32,color:PL.rgb(0,0,0)});assert.equal(await lire(await casse.save()),null,'Le lecteur doit détecter un QR effectivement détruit');}
   console.log(`OK QR avant/après : ${w}×${h}, rotation ${rotation}°, page inchangée${assemble?', assemblage thermique':''}.`);
  }
 }finally{await nav.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
