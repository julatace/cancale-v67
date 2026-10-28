// Rendu PDF réel dans Chromium ; VRM_PDFJS_DIR contient pdf.js 3.11.174 et son worker.
const {chromium}=require('playwright');
const PL=require('pdf-lib'),fs=require('fs'),assert=require('assert/strict');
(async()=>{
const s=fs.readFileSync('src/App.jsx','utf8');
const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{
const p=await b.newPage();await p.route('http://vrm.test/**',r=>r.fulfill({body:'<html></html>',contentType:'text/html'}));
await p.route('**/pdf.worker.min.js',r=>r.fulfill({body:fs.readFileSync(require('path').join(process.env.VRM_PDFJS_DIR,'pdf.worker.min.js')),contentType:'application/javascript'}));
await p.goto('http://vrm.test/');await p.addScriptTag({content:fs.readFileSync(require('path').join(process.env.VRM_PDFJS_DIR,'pdf.min.js'),'utf8')});
await p.evaluate(()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='http://vrm.test/pdf.worker.min.js';window.chargerPdfjs=async()=>pdfjsLib;});
for(const name of ['trouverZoneBlanche','espaceBlancBordereau'])await p.addScriptTag({content:s.match(new RegExp('const '+name+' = [\\s\\S]*?\\n};'))[0]+`;window.${name}=${name};`});
for(const rot of [0,90,180,270]){
const d=await PL.PDFDocument.create();const pg=d.addPage([595,842]);pg.setRotation(PL.degrees(rot));pg.drawRectangle({x:150,y:150,width:300,height:500,color:PL.rgb(0,0,0)});
const bytes=Array.from(await d.save());const pos=await p.evaluate(bytes=>espaceBlancBordereau({save:async()=>new Uint8Array(bytes)},true),bytes);
assert.ok(pos.verifie);assert.ok(Math.abs(pos.w-160)<.01&&Math.abs(pos.h-38)<.01);assert.ok(pos.x+pos.w<150 || pos.x>450 || pos.y+pos.h<150 || pos.y>650);console.log('OK rendu PDF réel, rotation',rot);
}
const d=await PL.PDFDocument.create();d.addPage([595,842]).drawRectangle({x:0,y:0,width:595,height:842,color:PL.rgb(0,0,0)});
const err=await p.evaluate(async bytes=>{try{await espaceBlancBordereau({save:async()=>new Uint8Array(bytes)},true);return '';}catch(e){return e.message;}},Array.from(await d.save()));assert.match(err,/aucun espace blanc/);console.log('OK page occupée refusée');
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
