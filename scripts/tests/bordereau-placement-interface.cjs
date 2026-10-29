// Éditeur réel, PDF synthétique, aucune impression ni mutation externe.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),PL=require('pdf-lib'),{chromium}=require('playwright'),esbuild=require('esbuild');
(async()=>{
 const code=fs.readFileSync('src/App.jsx','utf8'),doc=await PL.PDFDocument.create();
 doc.addPage([595,842]).drawRectangle({x:150,y:180,width:300,height:460,color:PL.rgb(0,0,0)});
 const bytes=Array.from(await doc.save());
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage({viewport:{width:1000,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('http://vrm.test/**',r=>r.fulfill({body:'<div id="root"></div>',contentType:'text/html'}));
 await p.route('**/pdf.worker.min.js',r=>r.fulfill({body:fs.readFileSync(path.join((process.env.VRM_PDFJS_DIR||require('path').join(__dirname,'..','..','public','pdfjs-3.11.174')),'pdf.worker.min.js')),contentType:'application/javascript'}));
 await p.goto('http://vrm.test/');
 for(const file of ['react/umd/react.development.js','react-dom/umd/react-dom.development.js','pdf-lib/dist/pdf-lib.min.js'])await p.addScriptTag({path:path.resolve('node_modules',file)});
 await p.addScriptTag({path:path.join((process.env.VRM_PDFJS_DIR||require('path').join(__dirname,'..','..','public','pdfjs-3.11.174')),'pdf.min.js')});
 await p.addStyleTag({content:fs.readFileSync('src/styles-reglages.css','utf8')});
 await p.evaluate(()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='http://vrm.test/pdf.worker.min.js';window.chargerPdfjs=async()=>pdfjsLib;window.C={card:'#fff',text:'#123',muted:'#456'};window.createPortal=ReactDOM.createPortal;window.FermeAuRetour=()=>null;});
 for(const name of ['trouverZoneBlanche','espaceBlancBordereau','drawBordereauStamp','dessinerPdf'])await p.addScriptTag({content:code.match(new RegExp('const '+name+' = [\\s\\S]*?\\n};'))[0]+`;window.${name}=${name};`});
 const component=code.slice(code.indexOf('function BordPlacer('),code.indexOf('// Réponses rapides prêtes')).replace("await import('pdf-lib')",'window.PDFLib');
 await p.addScriptTag({content:esbuild.transformSync(component+';window.BordPlacer=BordPlacer;',{loader:'jsx'}).code});
 await p.evaluate(bytes=>{window.confirmations=0;ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(BordPlacer,{place:{pdfBuf:new Uint8Array(bytes),numero:'C125',title:'Test'},onConfirm:async()=>{window.confirmations++;},onCancel:()=>{}}));},bytes);
 const valider=p.getByRole('button',{name:'Valider et ouvrir le PDF'});
 assert.equal(await valider.isDisabled(),true);
 await p.getByRole('button',{name:'Trouver un espace blanc'}).click();
 await p.getByText('Zone blanche vérifiée.',{exact:true}).waitFor();assert.equal(await valider.isEnabled(),true);
 const canvas=p.locator('canvas').first(),r=await canvas.boundingBox();
 await canvas.click({position:{x:r.width/2,y:r.height/2}});
 await p.getByText(/cette zone contient/).waitFor();assert.equal(await valider.isDisabled(),true);
 await p.getByRole('button',{name:'Trouver un espace blanc'}).click();await p.getByText('Zone blanche vérifiée.',{exact:true}).waitFor();await valider.click();
 assert.equal(await p.evaluate(()=>confirmations),1);assert.deepEqual(errors,[]);
 console.log('OK : aperçu réel, validation désactivée avant contrôle, recherche automatique, clic sur zone occupée refusé, confirmation unique.');
 } finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
