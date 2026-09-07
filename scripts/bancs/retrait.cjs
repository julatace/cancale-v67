// Le RETRAIT d'un colis, rendu sur les vraies données (copie du 6 septembre).
// Ce que ça prouve, qu'aucun audit statique ne peut voir :
//   • chaque colis à retirer porte un lien, et ce lien mène à SA conversation
//     (l'identifiant de la commande, pas un titre) ;
//   • les colis « non réclamés » sont affichés avec leur montant ;
//   • rien ne les annonce comme une perte.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn'); const purch=FX('purch');
const rows=[...FX('sold'),...purch,...FX('listings'),...FX('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4383);
// Ce que la VRAIE base contient, calculé ici pour comparer à l'écran.
const AT=(s)=>/d[ée]pos[ée]/i.test(s||'')&&/point\s+relais|bureau\s+de\s+poste/i.test(s||'');
const cmds=[]; purch.forEach(r=>(((r.data||{}).payload||{}).my_orders||[]).forEach(o=>cmds.push(o)));
const aRetirer=cmds.filter(o=>AT(o.status));
const nonRecl=cmds.filter(o=>/non r[ée]clam/i.test(o.status||''));
const totNR=nonRecl.reduce((t,o)=>t+parseFloat(String((o.price&&o.price.amount)||0)||0),0);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  console.log('base servie : '+aRetirer.length+' colis a retirer · '+nonRecl.length+' non reclames ('+totNR.toFixed(2)+' EUR)');
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
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
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.goto('http://localhost:4383/?tab=cat_achats',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4000);
  await pg.screenshot({path:SC+'/z-retrait.png',fullPage:true});
  const v=await pg.evaluate(()=>{
    const liens=[...document.querySelectorAll('a[href*="/inbox/"]')].map(a=>({h:a.getAttribute('href'),t:(a.innerText||'').trim()}));
    return {liens, txt:document.body.innerText||''};
  });
  // 1) une porte par colis a retirer
  // ⚠️ On reconnaît le lien par ce qu'il FAIT (ouvrir la conversation), pas par
  // une formule exacte : le libellé a changé pour dire ce que ça rapporte
  // (« le code revient ici »), et le banc mesurait alors 3 liens sur 6.
  const codeLiens=v.liens.filter(l=>/conversation|code de retrait/i.test(l.t));
  dit(codeLiens.length>=aRetirer.length,
    'chaque colis a retirer offre une porte vers son code',
    codeLiens.length+' lien(s) pour '+aRetirer.length+' colis');
  // 2) chaque lien porte un VRAI identifiant de conversation de la base
  const convs=new Set(aRetirer.concat(nonRecl).map(o=>String(o.conversation_id)));
  const inconnus=v.liens.filter(l=>!convs.has(String((/inbox\/(\d+)/.exec(l.h)||[])[1])));
  dit(inconnus.length===0, 'aucun lien ne pointe vers une conversation inventee',
    inconnus.slice(0,2).map(x=>x.h).join(' '));
  // 3) les colis non reclames sont dits, avec leur montant
  const attendu=totNR.toFixed(2).replace('.',',')+' €';
  dit(v.txt.includes(attendu), 'le montant des colis non reclames est affiche', attendu);
  dit(new RegExp(nonRecl.length+' colis (sont repartis|est reparti)').test(v.txt),
    'ils sont annonces par leur nombre', nonRecl.length+'');
  nonRecl.forEach(o=>dit(v.txt.includes(String(o.title||'').slice(0,20)),
    'la paire « '+String(o.title||'').slice(0,26)+' » est nommee'));
  // 4) on n'annonce pas une perte qu'on ne sait pas prouver
  dit(!/perdu|perte/i.test(v.txt), "aucun ecran n'annonce une perte non prouvee");
  dit(/a verifier|à vérifier/i.test(v.txt), 'le montant est presente « a verifier »');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe retrait a toujours une porte, et rien ne repart en silence.');
  process.exit(ko?1:0);
})();
