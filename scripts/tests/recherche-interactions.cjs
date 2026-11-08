const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const{build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');const js=await build({stdin:{resolveDir:root,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import{ChampRecherche}from'./src/composants/ChampRecherche.jsx';
 window.recs=[];window.changements=0;window.validations=0;window.echappements=0;
 window.SpeechRecognition=class{constructor(){window.recs.push(this)}start(){}stop(){}abort(){this.annule=true}};
 const root=createRoot(document.getElementById('root'));
 function App(){const[v,setV]=React.useState('article');return <div onKeyDown={e=>{if(e.key==='Escape')window.echappements++;}}><ChampRecherche valeur={v} micro onChange={x=>{window.changements++;setV(x);}} onValider={()=>window.validations++}/></div>};root.render(<App/>);window.fermer=()=>root.unmount();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const browser=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of[390,1512]){
 const p=await browser.newPage({viewport:{width,height:700}});await p.setContent('<div id="root"></div>');await p.addScriptTag({content:js.outputFiles[0].text});
 const input=p.getByRole('searchbox');await input.waitFor();
 await p.getByRole('button',{name:'Dicter la recherche'}).click();await p.getByRole('button',{name:'Effacer la recherche'}).click();
 const changementsAvant=await p.evaluate(()=>window.changements);await p.evaluate(()=>window.recs[0].onresult({results:[[{transcript:'ancien texte'}]]}));ok(await p.evaluate(()=>window.changements)===changementsAvant,'cleared dictation cannot call the change handler');ok(await input.inputValue()==='','an old voice result cannot restore a cleared query');ok(await p.evaluate(()=>window.recs[0].annule),'clear aborts recording');
 await p.getByRole('button',{name:'Dicter la recherche'}).click();await input.fill('texte saisi');await p.evaluate(()=>window.recs[1].onresult({results:[[{transcript:'texte périmé'}]]}));ok(await input.inputValue()==='texte saisi','typing wins over an old voice result');
 await input.dispatchEvent('compositionstart');await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true});await input.dispatchEvent('keydown',{key:'Escape',code:'Escape',isComposing:true});
 ok(await p.evaluate(()=>window.validations===0&&window.echappements===0),'composition neither validates nor closes a surrounding dialog');ok(await input.inputValue()==='texte saisi','composition escape does not clear the query');
 await input.dispatchEvent('compositionend');await input.press('Enter');ok(await p.evaluate(()=>window.validations)===1,'enter validates once after composition');await input.press('Escape');ok(await input.inputValue()===''&&await input.evaluate(e=>e===document.activeElement),'escape clears and retains focus');
 await p.getByRole('button',{name:'Dicter la recherche'}).click();await input.press('Escape');await p.evaluate(()=>window.recs[2].onresult({results:[[{transcript:'trop tard'}]]}));ok(await input.inputValue()===''&&await p.evaluate(()=>window.recs[2].annule),'escape cancels dictation even in an empty input');
 await p.getByRole('button',{name:'Dicter la recherche'}).click();await p.evaluate(()=>window.recs[3].onend());await p.getByRole('button',{name:'Dicter la recherche'}).click();await p.evaluate(()=>{window.recs[3].onend();window.recs[3].onresult({results:[[{transcript:'ancienne session'}]]});});ok(await p.getByRole('button',{name:'Arrêter la dictée'}).getAttribute('aria-pressed')==='true','old end event cannot stop a new recording');
 await p.evaluate(()=>window.recs[4].onresult({results:[[{transcript:'numéro 124'}]]}));await p.waitForFunction(()=>document.querySelector('input').value==='124');ok(await input.inputValue()==='124','current recording still normalizes a storage number');
 const before=await p.evaluate(()=>window.changements);await p.evaluate(()=>{window.fermer();window.recs[4].onresult({results:[[{transcript:'après fermeture'}]]});});ok(await p.evaluate(()=>window.changements)===before,'unmounted search ignores late results');await p.close();
 }}finally{await browser.close();}console.log(n+' contrôles recherche et dictée réussis');
})().catch(e=>{console.error(e);process.exitCode=1});
