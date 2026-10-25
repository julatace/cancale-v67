// Native semantic controls in synthetic DOM; no authenticated site or message.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const src=fs.readFileSync(process.env.SOURCE_FAVORIS_BG||'vinted-sync-extension/background.js','utf8');
 const debut=src.indexOf('function clocheFavorisNative('),fin=src.indexOf('// Closed navigation protocol:',debut);
 const fn=src.slice(debut,fin);let n=0;
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const p=await b.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<main></main>'}));await p.goto('https://www.vinted.fr/');await p.addScriptTag({content:fn});
 const cas=async(html,etat)=>{
  await p.evaluate(html=>{document.querySelector('main').innerHTML=html;window.clics=0;document.querySelector('main').onclick=e=>{e.preventDefault();window.clics++;};},html);
  const r=await p.evaluate(()=>clocheFavorisNative(true,location.origin));assert.equal(r.etat,etat,html);assert.equal(await p.evaluate(()=>clics),etat==='activee'?1:0,html);n+=2;
 };
 await cas('<button aria-labelledby="nom"><svg></svg></button><span id="nom" hidden>Notifications</span>','activee');
 await cas('<a href="/notifications" aria-label="Notifications"><svg></svg></a>','activee');
 await cas('<button>Notifications <span>3</span></button>','activee');
 await cas('<button title="Notifications"><svg></svg></button>','activee');
 await cas('<button><svg><title>Notifications</title></svg></button>','activee');
 await cas('<button aria-label="Mes notifications"></button>','activee');
 await cas('<button aria-label="Notifications, 3 non lues"></button>','activee');
 await cas('<button aria-label="Notifiche"></button>','activee');
 await cas('<button aria-label="Benachrichtigungen"></button>','activee');
 await cas('<button aria-label="Notifications" aria-expanded="true"></button>','deja_ouverte');
 await cas('<button aria-label="Supprimer"><svg><title>Notifications</title></svg></button>','absente');
 await cas('<a href="https://evil.invalid" aria-label="Notifications"></a>','absente');
 await cas('<button aria-labelledby="absent" aria-label="Notifications"></button>','absente');
 await cas('<div inert><button aria-label="Notifications"></button></div>','absente');
 await cas('<div aria-hidden="true"><button aria-label="Notifications"></button></div>','absente');
 await cas('<button aria-label="Notifications" disabled></button>','indisponible');
 await cas('<button aria-label="Notifications" aria-disabled="true"></button>','indisponible');
 await cas('<button aria-label="Notifications"></button><a href="/notifications">Notifications</a>','ambigue');
 await cas('<form><button aria-label="Notifications"></button></form>','absente');
 await cas('<button aria-label="Activer les notifications marketing"></button>','absente');
 await cas('<button style="display:none" aria-label="Notifications"></button>','absente');
 console.log(n+' contrôles de cloche accessible réussis');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
