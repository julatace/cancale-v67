// ════════════════════════════════════════════════════════════════════════════
//  LES DRAPEAUX DE RACINE DISENT-ILS VRAI ? (19 nov., vite-et-sans-bug)
//
//    node scripts/bancs/drapeaux-justes.cjs [dist]        MUTATION=sourd : l'observateur coupé (doit être ROUGE)
//
//  Les `:has()` de racine réécrits par scripts/alleger-has.cjs deviennent des attributs `data-vrm-<mot>` posés par
//  src/drapeauxRacine.js. Un drapeau en retard = un style faux, sans aucune erreur. Ce banc compare, à chaque écran
//  (la suite de chiffres-volume par chargement, puis 13 changements d'écran DANS la page, 60 ms après le toucher et
//  après le calme), chaque attribut posé à la réponse EN DIRECT du navigateur (`element.matches(':has(ARG)')`),
//  390 tactile et 1512. Base inventée (_base-volume) ; rien de réel, aucune écriture ne sort.
// ════════════════════════════════════════════════════════════════════════════
require('./_porte-banc.cjs');
const path=require('path'),fs=require('fs'),http=require('http');
const R=path.join(__dirname,'..','..');
const {chromium}=require(R+'/node_modules/playwright');
const {fabriquer,repondre}=require(R+'/scripts/bancs/_base-volume.cjs');
const DIST=process.argv[2]||path.join(R,'dist'), PORT=25000+Math.floor(Math.random()*3000);
const TABLE=fs.readFileSync(R+'/src/drapeauxRacine.table.js','utf8'); const D=JSON.parse(TABLE.match(/DRAPEAUX = (\[[\s\S]*?\]);/)[1]);
const base=fabriquer({volumeReel:true,qr:true});
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
http.createServer((q,r)=>{let f=q.url.split('?')[0];if(f==='/'||!path.extname(f))f='/index.html';const p=path.join(DIST,f);if(!fs.existsSync(p)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});r.end(fs.readFileSync(p));}).listen(PORT);
const att=(ms)=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-angle=swiftshader']});
let faux=0, vus=0;
for (const vp of [{width:1512,height:982},{width:390,height:844,isMobile:true,hasTouch:true}]) {
const ctx=await b.newContext({serviceWorkers:'block',viewport:{width:vp.width,height:vp.height},isMobile:!!vp.isMobile,hasTouch:!!vp.hasTouch});
await ctx.addInitScript(()=>{localStorage.setItem('vrm_acces_direct','1');localStorage.setItem('vrm_visite_vue','1');localStorage.setItem('vrm_visite_bulles_vue','1');});
if(process.env.MUTATION==='sourd')await ctx.addInitScript(()=>{window.MutationObserver=undefined;});
const pg=await ctx.newPage();
await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,r=>r.abort());
await pg.route('**/rest/v1/**',async route=>{const rq=route.request();if(rq.method()!=='GET')return route.fulfill({status:201,body:'[]'});const h=await rq.allHeaders();const rep=repondre(rq.url(),h.range,base);return route.fulfill({status:rep.status,contentType:'application/json',headers:{...(rep.headers||{})},body:JSON.stringify(rep.body)});});
await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
const verifier=async(ou)=>{const r=await pg.evaluate((D)=>{const el=(a)=>a==='html'?[document.documentElement]:a==='body'?[document.body]:[...document.querySelectorAll(a)];const out=[];for(const d of D){for(const e of el(d.a)){let vrai=false;try{vrai=e.matches(':has('+d.s+')');}catch(_){}const pose=e.hasAttribute('data-vrm-'+d.m);if(vrai!==pose)out.push(d.m+' '+d.a+':has('+d.s+') vrai='+vrai+' posé='+pose);}}return out;},D);vus++;if(r.length){faux+=r.length;console.log('  ❌ '+ou+' : '+r.join(' | '));}};
for(const t of 'journee,ventes,achats,cat_bord,argent,argent_declarer,stats'.split(',')){await pg.goto(`http://localhost:${PORT}/?tab=${t}`,{waitUntil:'commit'});await pg.waitForSelector('.vrm-main',{timeout:90000}).catch(()=>{});await att(5000);await verifier(vp.width+' goto '+t);}
// puis les changements d'écran DANS la page (écrans gardés), sans attendre, puis après le calme
for(const t of 'annonces,achats,journee,ventes,compta,achats,messages,garage,settings,journee,emails,annonces,ventes'.split(',')){await pg.evaluate((t)=>window.dispatchEvent(new CustomEvent('vrm:aller',{detail:'?tab='+t})),t);await att(60);await verifier(vp.width+' aller '+t+' (60 ms)');await att(2500);await verifier(vp.width+' aller '+t+' (calme)');}
await ctx.close();}
console.log(`${vus} vérifications, ${faux} drapeau(x) faux${process.env.MUTATION?' (mutation '+process.env.MUTATION+')':''}`);await b.close();process.exit(faux?1:0);})();
