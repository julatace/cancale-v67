// Composant réel : une lecture échouée peut être relancée sans remonter la ligne.
const fs=require('fs'),assert=require('assert/strict'),{build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const source=fs.readFileSync('src/JournalEmails.jsx','utf8');
 const composant=source.slice(source.indexOf('function TexteEmail('),source.indexOf('\nfunction LigneEmail('));
 const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React,{useState,useEffect} from 'react';import{createRoot}from'react-dom/client';${composant}\nlet appels=0;window.requeteJsonBornee=async()=>{appels++;window.appels=appels;return appels===1?{ok:false}:{ok:true,json:{ok:true,id:'mail-test',texte:'Texte reçu <script>inactif</script>'}}};createRoot(document.getElementById('root')).render(<TexteEmail id="mail-test" headers={()=>({})}/>);`},bundle:true,write:false,logLevel:'silent'});
 const nav=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{const page=await nav.newPage({viewport:{width:390,height:844}});await page.setContent('<div id="root"></div>');await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:'Réessayer la lecture'}).click();await page.locator('[data-journal-texte="lu"]').waitFor();assert.equal(await page.evaluate(()=>window.appels),2);assert.equal(await page.locator('pre script').count(),0);assert.match(await page.locator('pre').innerText(),/<script>inactif/);console.log('OK : réessai ciblé et texte toujours échappé.');}finally{await nav.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
