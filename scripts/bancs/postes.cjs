// Le SÉPARATEUR « Déjà postés » : quand il coche « Colis fait », la carte
// descend et un intertitre l'annonce — sinon l'en-tête dit 6 et la liste en
// montre 14 (§26 : un bloc conditionnel se vérifie RENDU, avec des données).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST='/home/user/cancale-v67/dist', SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4379);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
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
  await pg.goto('http://localhost:4379/?tab=cat_bord',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(3500);
  const compte=()=>pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s*\n?\s*colis à envoyer/.exec(t);
    return {entete: m?+m[1]:null,
            cartes: document.querySelectorAll('[data-bord-card]').length,
            sep: (/Déjà postés · (\d+)/.exec(t)||[])[1]||null};
  });
  const a=await compte();
  dit(a.cartes>0, 'la liste des colis est rendue', a.cartes+' cartes · en-tête '+a.entete);
  // ⚠️ La liste est maintenant DÉCOUPÉE EN GROUPES (en retard / aujourd'hui /
  // demain / déjà postés) : ce banc supposait un seul séparateur. Ce qui compte
  // reste le même — le compte du haut plus les postés font la liste entière.
  dit(a.entete + (+a.sep||0) === a.cartes, 'au départ déjà, le compte du haut plus les postés font la liste',
      `${a.entete} + ${a.sep||0} = ${a.cartes}`);
  // On coche « Colis fait » sur DEUX colis (c'est SON geste, jamais automatique).
  for(let i=0;i<2;i++){
    await pg.evaluate(()=>{const b=[...document.querySelectorAll('[data-bord-card] button')].find(x=>/Colis fait/.test(x.textContent)); if(b)b.click();});
    await pg.waitForTimeout(700);
  }
  await pg.waitForTimeout(1200);
  const c=await compte();
  await pg.screenshot({path:SC+'/z-postes.png',fullPage:true});
  dit((+c.sep||0) === (+a.sep||0) + 2, 'l\'intertitre « Déjà postés » monte de 2',
      `${a.sep||0} -> ${c.sep}`);
  dit(c.cartes===a.cartes, 'aucun colis ne disparaît en le cochant', c.cartes+' cartes');
  dit(c.entete===a.entete-2, "l'en-tête ne compte plus que les colis qui restent", `${a.entete} -> ${c.entete}`);
  dit(c.entete + (+c.sep||0) === c.cartes, 'le compte du haut plus les postés font la liste entière',
      `${c.entete} + ${c.sep} = ${c.cartes}`);
  // le séparateur est bien AVANT le premier colis posté, pas ailleurs
  const ordre=await pg.evaluate(()=>{
    const g=[...document.querySelectorAll('[data-bord-card]')][0]?.parentElement;
    if(!g) return null;
    return [...g.children].map(el=>el.hasAttribute('data-bord-card')
      ? (/Pas encore/.test(el.innerText)?'poste':'a-envoyer') : 'SEP').join(',');
  });
  // Chaque groupe s'ouvre par son intertitre, et TOUS les postés sont après le
  // dernier — aucun colis à envoyer ne se retrouve sous « Déjà postés ».
  const cases=(ordre||'').split(',');
  const dernierSep=cases.lastIndexOf('SEP');
  const apres=cases.slice(dernierSep+1);
  const avant=cases.slice(0,dernierSep);
  dit(dernierSep>0 && apres.length>0 && apres.every(x=>x==='poste') && !avant.includes('poste'),
      'tous les colis postés sont sous le dernier intertitre, et eux seuls', ordre);
  dit(cases[0]==='SEP', 'la liste s\'ouvre par un intertitre');
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe compte du haut et la liste disent la meme chose.');
  process.exit(ko?1:0);
})();
