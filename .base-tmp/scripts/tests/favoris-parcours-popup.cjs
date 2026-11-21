const fs=require('node:fs'),assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({executablePath:(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});let n=0;
 try{for(const width of [320,390,1512]){const p=await b.newPage({viewport:{width,height:950}});await p.route('**/*',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({contentType:path.endsWith('.js')?'application/javascript':'text/html; charset=utf-8',body:path.endsWith(process.env.PARCOURS_POPUP?'/popup.js':'parcours-popup.js')?fs.readFileSync(process.env.PARCOURS_POPUP||'vinted-sync-extension/parcours-popup.js','utf8'):path.endsWith('.js')?'':fs.readFileSync(process.env.PARCOURS_HTML||'vinted-sync-extension/popup.html','utf8')});});
 await p.addInitScript(()=>{window.calls=[];window.state=null;window.chrome={runtime:{lastError:null,sendMessage:(m,cb)=>{window.calls.push(m.action);if(m.action==='demarrer')window.state={diagnostic:'VRM-parcours-favoris-v1',actif:true,evenements:[]};if(m.action==='arreter')window.state={...window.state,actif:false,evenements:[{type:'clic',balise:'a',route:'creation_conversation'}]};if(m.action==='effacer')window.state=null;cb({ok:true,rapport:window.state});}}};Object.defineProperty(navigator,'clipboard',{value:{writeText:async x=>window.copie=x}});});
 await p.goto('https://extension.test/popup.html');
 const start=p.getByRole('button',{name:'Enregistrer le parcours',exact:true});await start.waitFor();assert.deepEqual(await p.evaluate(()=>calls),['etat']);n++;
 await start.click();assert.equal(await start.isDisabled(),true);assert.equal(await p.getByRole('button',{name:'Copier le rapport',exact:true}).isDisabled(),true);n+=2;
 await p.getByRole('button',{name:'Arrêter et voir le rapport',exact:true}).click();assert.ok((await p.getByRole('textbox',{name:'Rapport du parcours Vinted'}).inputValue()).includes('creation_conversation'));n++;
 await p.getByRole('button',{name:'Copier le rapport',exact:true}).click();assert.equal(await p.evaluate(()=>JSON.parse(copie).actif),false);n++;
 await p.getByRole('button',{name:'Effacer le rapport',exact:true}).click();assert.equal(await p.getByRole('textbox',{name:'Rapport du parcours Vinted'}).isVisible(),false);n++;
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));n++;
 await p.close();}console.log(n+' contrôles du panneau parcours réussis');}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
