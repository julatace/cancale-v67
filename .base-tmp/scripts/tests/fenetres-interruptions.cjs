const fs=require('fs'),path=require('path'),assert=require('assert/strict');const{build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const root=path.resolve(__dirname,'../..');const js=await build({stdin:{resolveDir:root,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import{SheetShell}from'./src/composants/SheetShell.jsx';import{useConversationFocus}from'./src/conversationFocus.js';
 window.fermetures=0;function Chat({fermer}){const ref=useConversationFocus('conversation-test',fermer);return <section ref={ref} role="dialog" aria-label="Conversation"><button aria-label="Fermer la conversation eBay" onClick={fermer}>Fermer</button><textarea aria-label="Brouillon" defaultValue="Message en préparation"/><button>Envoyer</button></section>}
 function App(){const[feuille,F]=React.useState(false),[chat,C]=React.useState(false);const fermer=f=>()=>{window.fermetures++;f(false)};return <><button onClick={()=>F(true)}>Ouvrir la fiche</button><button onClick={()=>C(true)}>Ouvrir la conversation</button>{feuille&&<SheetShell titre="Modifier un article" onClose={fermer(F)}><input aria-label="Référence" defaultValue="VRM-17"/></SheetShell>}{chat&&<Chat fermer={fermer(C)}/>}</>};createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of[390,1512])for(const reducedMotion of['reduce','no-preference']){
 const p=await b.newPage({viewport:{width,height:900},reducedMotion});await p.setContent('<div id="root"></div>');await p.addStyleTag({content:fs.readFileSync(path.join(root,'src/styles-composants.css'),'utf8')+'body{font-family:Arial}[role=dialog] textarea{display:block;width:220px}'});await p.addScriptTag({content:js.outputFiles[0].text});
 const finir=()=>p.evaluate(()=>document.getAnimations().forEach(a=>{try{a.finish()}catch(_){}}));
 if(process.env.TEST_BUG!=='conversation'){
 for(const type of['pointercancel','lostpointercapture']){
  await p.getByRole('button',{name:'Ouvrir la fiche'}).click();await p.locator('[data-feuille]').waitFor();await finir();await p.getByRole('textbox',{name:'Référence'}).fill('Valeur non enregistrée');const avant=await p.evaluate(()=>window.fermetures);
  await p.locator('[data-feuille-poignee]').evaluate((el,type)=>{const h=document.querySelector('[data-feuille]').offsetHeight,y=100;for(const[t,pos]of[['pointerdown',y],['pointermove',y+h+80],[type,y+h+80]])el.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:7,pointerType:'touch',button:0,clientY:pos}));},type);await finir();
  ok(await p.evaluate(()=>window.fermetures)===avant,type+' must not dismiss the sheet');ok(await p.getByRole('textbox',{name:'Référence'}).inputValue()==='Valeur non enregistrée',type+' preserves unsaved input');ok(await p.locator('[data-feuille]').evaluate(e=>Math.abs(new DOMMatrix(getComputedStyle(e).transform).m42)<1),type+' restores the sheet position');if(process.env.CAPTURE_DIR){fs.mkdirSync(process.env.CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.CAPTURE_DIR,`feuille-${width}-${reducedMotion}-${type}.png`)});}await p.getByRole('button',{name:'Fermer',exact:true}).click();
 }
 await p.getByRole('button',{name:'Ouvrir la fiche'}).click();await p.locator('[data-feuille]').waitFor();await finir();const avant=await p.evaluate(()=>window.fermetures);
 await p.locator('[data-feuille-poignee]').evaluate(el=>{const h=document.querySelector('[data-feuille]').offsetHeight;for(const[t,y]of[['pointerdown',100],['pointermove',h+200],['pointerup',h+200]])el.dispatchEvent(new PointerEvent(t,{bubbles:true,pointerId:8,pointerType:'touch',button:0,clientY:y}));});await finir();await p.waitForFunction(v=>window.fermetures>v,avant);ok(await p.locator('[data-feuille]').count()===0,'deliberate release still closes the sheet');
 }
 if(process.env.TEST_BUG!=='feuille'){
 await p.getByRole('button',{name:'Ouvrir la conversation'}).click();const champ=p.getByRole('textbox',{name:'Brouillon'});await champ.waitFor();await champ.fill('Texte à conserver');const avant=await p.evaluate(()=>window.fermetures);
 for(const props of[{isComposing:true},{keyCode:229},{bloque:true}]){await champ.evaluate((el,props)=>{const e=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,...props});if(props.bloque)e.preventDefault();el.dispatchEvent(e);},props);ok(await p.evaluate(()=>window.fermetures)===avant,'composition or consumed escape does not close the conversation');}
 await champ.dispatchEvent('compositionstart');await champ.dispatchEvent('keydown',{key:'Escape',isComposing:false,keyCode:27});ok(await p.evaluate(()=>window.fermetures)===avant,'composition events protect browsers missing isComposing');await champ.dispatchEvent('compositionend');
 ok(await champ.inputValue()==='Texte à conserver','ignored escape retains the draft');await champ.focus();await champ.press('Escape');await p.waitForFunction(v=>window.fermetures>v,avant);ok(await p.getByRole('dialog',{name:'Conversation'}).count()===0,'ordinary escape still closes');ok(await p.getByRole('button',{name:'Ouvrir la conversation'}).evaluate(e=>e===document.activeElement),'focus returns to opener');
 }
 await p.close();
 }}finally{await b.close();}console.log(n+' contrôles des interruptions de fenêtres réussis');
})().catch(e=>{console.error(e);process.exitCode=1});
