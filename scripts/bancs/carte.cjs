// LA CARTE DES POINTS RELAIS, rendue. Julien : « prends la carte des points
// relais dans les achats, pour chaque ville je veux renseigner ma ville (ou
// qu'elle soit détectée) et que l'app fasse la simulation ».
// Mesuré avant : `vrm_ville` = « Cancale » (il l'a DÉJÀ renseignée), mais
// `vrm_ville_points` est absent de la base — la liste de la ville n'a jamais
// été enregistrée. Ce banc sert la VRAIE réponse de /api/relais.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox')];
const RELAIS=fs.readFileSync(path.join(SC,'fx','relais-cancale.json'),'utf8');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4393);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
const W=+(process.env.W||1512), H=+(process.env.H||950);
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:W,height:H}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  let appelsRelais=0;
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=route.request().url();
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  // ⚠️ PLAYWRIGHT PREND LA DERNIÈRE ROUTE ENREGISTRÉE EN PREMIER. Le fourre-tout
  // `**/api/**` posé APRÈS avalait donc /api/relais et répondait `{pret:true}` :
  // la carte restait vide sans lever la moindre erreur, et le banc mesurait
  // « 0 appel » alors que l'app en faisait bien un. On pose le général d'abord,
  // le particulier ensuite.
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.route('**/api/relais**',r2=>{appelsRelais++; r2.fulfill({status:200,contentType:'application/json',body:RELAIS});});
  // les tuiles OSM : on ne sort pas du banc
  await pg.route('**tile.openstreetmap**',r2=>r2.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64')}));
  await pg.goto('http://localhost:4393/?tab=cat_achats',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);
  dit(appelsRelais>0, 'la ville deja renseignee declenche la recherche de ses points', appelsRelais+' appel(s) a /api/relais');
  // ouvrir la carte
  const ouvert=await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Carte|Points relais/i.test(x.textContent)); if(!b) return false; b.click(); return true;});
  dit(ouvert, 'un bouton ouvre la carte');
  await pg.waitForTimeout(2500);
  await pg.screenshot({path:SC+'/z-carte'+(W<500?'-tel':'')+'.png',fullPage:true});
  const v=await pg.evaluate(()=>({txt:document.body.innerText||'', canv:document.querySelectorAll('canvas').length, svg:document.querySelectorAll('svg').length}));
  const pts=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')||'{}');
  dit(/Cancale/i.test(v.txt), 'la ville est affichee', 'Cancale');
  await b.close(); srv.close();
  console.log('\n--- texte de la carte ---\n'+v.txt.split('\n').filter(l=>l.trim()).slice(-40).join('\n'));
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLa carte repond.');
  process.exit(ko?1:0);
})();
