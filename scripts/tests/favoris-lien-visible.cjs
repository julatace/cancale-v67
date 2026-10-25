// Synthetic DOM only. Exact link stays mandatory; no actual Vinted messages.
const fs=require('node:fs'),assert=require('node:assert/strict');const {chromium}=require('playwright');
(async()=>{
 const src=fs.readFileSync(process.env.SOURCE_FAVORIS_BG||'vinted-sync-extension/background.js','utf8');
 const fn=src.slice(src.indexOf('function suivreFavoriAffiche('),src.indexOf('// Semantic native controls only.'));
 const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let n=0;
 try{const p=await b.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<main></main>'}));await p.goto('https://www.vinted.fr/');await p.addScriptTag({content:fn});
 const url='/items/101/conversation/new?native_target=201';
 const cas=async(html)=>{await p.evaluate(html=>{document.querySelector('main').innerHTML=html;window.clics=0;document.querySelector('main').onclick=e=>{e.preventDefault();window.clics++;};},html);return p.evaluate(url=>suivreFavoriAffiche(location.origin+url,true),url);};
 let r=await cas(`<a style="display:contents" href="${url}"><span style="display:block">Notification visible</span></a>`);
 assert.equal(r.trouve,true);assert.equal(await p.evaluate(()=>clics),1);n+=2;
 r=await cas(`<a href="${url}">Photo</a><a href="${url}">Texte</a>`);assert.equal(r.trouve,false);assert.equal(r.inspection.exacts,2);assert.equal(r.inspection.visibles,2);assert.equal(await p.evaluate(()=>clics),0);n+=4;
 r=await cas('<a href="/items/101/conversation/new?native_target=999">Autre destinataire</a>');assert.equal(r.trouve,false);assert.equal(r.inspection.memeArticle,1);assert.equal(r.inspection.exacts,0);assert.equal(await p.evaluate(()=>clics),0);n+=4;
 r=await cas(`<a href="${url}" style="display:none">Caché</a>`);assert.equal(r.trouve,false);assert.equal(r.inspection.exacts,1);assert.equal(r.inspection.visibles,0);n+=3;
 r=await cas(`<div inert><a href="${url}">Inerte</a></div>`);assert.equal(r.trouve,false);assert.equal(await p.evaluate(()=>clics),0);n+=2;
 r=await cas(`<div aria-hidden="true"><a href="${url}">Masqué</a></div>`);assert.equal(r.trouve,false);n++;
 r=await cas(`<a href="https://evil.invalid${url}">Externe</a>`);assert.equal(r.trouve,false);assert.equal(r.inspection.exacts,0);n+=2;
 r=await cas('<a href="/items/102/conversation/new?native_target=201">Autre article</a>');assert.equal(r.trouve,false);assert.equal(r.inspection.liensFavoris,1);assert.equal(r.inspection.memeArticle,0);n+=3;
 r=await cas(`<a style="display:contents" href="${url}"><span style="display:none">Caché</span></a>`);assert.equal(r.trouve,false);n++;
 assert.ok(!JSON.stringify(r.inspection).includes('native_target'));n++;
 console.log(n+' contrôles du lien favori visible et de l’inspection bornée réussis');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
