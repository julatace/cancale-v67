// LE BLOC « COLIS JAMAIS RETIRÉS », rendu pour la PREMIÈRE fois au banc.
// Julien : « il n'y a pas tous les codes de retrait ». Mesuré sur la vraie
// base : 6 colis rangés ici, dont **3 portent un QR** — et le bloc n'affichait
// que le code. Le QR, seul moyen de retrait d'un casier Pickup, ne s'affichait
// nulle part. §26 : un bloc conditionnel ne vaut que RENDU, avec des données.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
// ⚠️⚠️ JAMAIS UN CHEMIN ABSOLU ICI. La méthode de preuve du dossier (§6.1)
// extrait le code d'AVANT dans /tmp/avN, y copie le banc et le lance DEPUIS
// cet arbre. Avec '/home/user/cancale-v67/dist' écrit en dur, le banc servait
// le build COURANT : il mesurait le correctif en croyant mesurer le code
// d'avant, et sortait VERT sur le défaut. Un banc qui ne peut pas échouer est
// pire qu'absent — il rassure (même leçon qu'audit-coherence.cjs, qui sortait
// toujours en 0). Le dist se déduit de l'emplacement DU BANC.
const DIST=require('path').join(__dirname,'..','..','dist'), SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn'); const track=FX('track');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox'),...track];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.zip':'application/zip'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4401);
// ce que la base contient vraiment, pour comparer à l'écran
const coches=new Set(((main[0].data.vrm_colis_collected)||[]).map(String));
const env=new Set(rows.filter(r=>/^email_bord_/.test(r.id)).map(r=>String((r.data||{}).suivi||'').trim().toUpperCase()).filter(Boolean));
const j=(d)=>Math.round((Date.now()-new Date(d).getTime())/86400000);
const vieux=track.map(r=>r.data).filter(d=>d.status==='available' && !coches.has(String(d.suivi)) && !env.has(String(d.suivi||'').trim().toUpperCase()) && j(d.receivedAt)>14);
const avecQR=vieux.filter(d=>d.qrB64||d.qrUrl).length, avecCode=vieux.filter(d=>d.code&&String(d.code).trim()).length;
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  console.log('base servie : '+vieux.length+' colis trop vieux · '+avecCode+' avec code · '+avecQR+' avec QR');
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=route.request().url();
    const jj=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return jj([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/vinted_accounts/.test(u)) return jj(accounts);
    if(/id=eq\.main/.test(u)) return jj(main);
    if(/transaction->>id/.test(u)) return jj(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return jj(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return jj(rows.filter(r=>re.test(r.id)));}
    return jj([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  // ⚠️ LE BANC DOIT SERVIR LES IMAGES DE CODE-BARRES. Sans réseau, l'image
  // échoue, `noterImgMorte` retire le QR (comportement voulu de l'app) — et le
  // banc mesurait « 0 QR » sur un code parfaitement valide. On sert donc un
  // vrai PNG pour les URL de code-barres Pickup, les seules que l'app accepte.
  const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHUlEQVQoz2NgGAWjYBSMglEwCkbBKBgFo2AUUAcAB1QAAeYb1qEAAAAASUVORK5CYII=','base64');
  await pg.route('**/api/barcode/**',r2=>r2.fulfill({status:200,contentType:'image/png',body:PNG}));
  await pg.goto('http://localhost:4401/?tab=cat_achats',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(5000);
  await pg.screenshot({path:SC+'/z-oublies.png',fullPage:true});
  const v=await pg.evaluate(()=>({txt:document.body.innerText||'',
    qr:document.querySelectorAll('button[aria-label="Afficher le QR de retrait en grand"]').length}));
  // ⚠️ On ne compare PAS au compte de ma propre réplique des règles : elle est
  // plus grossière que celle de l'app (le sens entrant/sortant se lit sur le
  // sujet de l'email). Ce qui doit être vrai, c'est qu'AUCUN code et AUCUN QR
  // ne reste caché — c'est exactement la plainte de Julien.
  const mTitre=/(\d+) colis jamais retir/.exec(v.txt);
  dit(!!mTitre, 'le bloc des colis jamais retirés est rendu',
    mTitre?('affiché : '+mTitre[1]+' · ma réplique en comptait '+vieux.length):'titre introuvable');
  dit(v.qr>=avecQR, 'chaque QR encore disponible est affiché', v.qr+' bouton(s) QR pour '+avecQR+' QR en base');
  vieux.filter(d=>d.code&&String(d.code).trim()).forEach(d=>
    dit(v.txt.includes(String(d.code).trim()), 'le code '+d.code+' est affiché'));
  dit(/encore leur code ou leur QR|encore son code ou son QR/.test(v.txt),
    'le bloc dit combien peuvent encore être retirés', 'au lieu d\'envoyer tout le monde en réclamation');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):"\nAucun code, aucun QR ne reste cache.");
  process.exit(ko?1:0);
})();
