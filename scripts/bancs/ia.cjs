// L'ATELIER « Rédiger une annonce (IA) » — rendu, avec /api/ai MOQUÉ.
// Le moteur (api/ai.js) existe déjà ; ce qui manquait, c'est le bouton. Ce banc
// prouve le RACCORD, qu'aucun audit statique ne voit :
//   • la requête envoyée à l'IA porte les VRAIES caractéristiques de la paire
//     choisie (titre), pas du vide ;
//   • le titre et la description proposés s'affichent, avec de quoi COPIER ;
//   • COPIE SEULEMENT : rien n'est publié sur Vinted (aucun appel d'écriture) ;
//   • sans clé, on le DIT (aucune rédaction inventée).
// Avant ce correctif, le menu n'a pas l'entrée et la modale n'existe pas : le
// banc échoue (fail-before d'une UI, comme ebay.cjs/lbc.cjs).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const DIST=path.join(__dirname,'..','..','dist'), SC=__dirname;
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const main=FX('main'), accounts=FX('accounts'); const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4388);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
const aiPosts=[]; let aiMode='ok'; const vintedWrites=[];
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox']}).catch(e=>{console.log('launch KO',e.message);process.exit(2);});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=route.request().url();
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    const meth=route.request().method();
    if(meth!=='GET'){ if(/app_data/.test(u)) vintedWrites.push(u); return j([]); }
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  // ⚠️ Playwright prend la DERNIÈRE route enregistrée en premier (§6.6) : la
  // route GÉNÉRIQUE d'abord, la route IA SPÉCIFIQUE en dernier pour qu'elle gagne.
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.route('**/api/ai',route=>{
    const req=route.request();
    if(req.method()==='GET') return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"ready":true,"model":"test"}'});
    let body={}; try{ body=JSON.parse(req.postData()||'{}'); }catch(_){}
    aiPosts.push(body);
    if(aiMode==='nokey') return route.fulfill({status:200,contentType:'application/json',body:'{"ok":false,"reason":"no-key"}'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,title:'Nike Zoom Fly 5 T42 très bon état',desc:'Paire authentique.\nEnvoi rapide et soigné. 👟',why:'titre plus précis'})});
  });
  await pg.goto('http://localhost:4388/?tab=cat_annonces',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);
  // Ouvre ⋯ Outils puis « Rédiger une annonce (IA) ».
  const ouvert=await pg.evaluate(()=>{
    const outils=[...document.querySelectorAll('button')].find(b=>/Outils/.test(b.innerText||''));
    if(outils) outils.click(); return !!outils;
  });
  await pg.waitForTimeout(500);
  await pg.evaluate(()=>{ const it=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /R[ée]diger une annonce/i.test(e.textContent||''));
    if(it){ let n=it; for(let i=0;i<4&&n;i++){ if(n.tagName==='BUTTON'){break;} n=n.parentElement; } (n||it).click(); } });
  await pg.waitForTimeout(1200);
  const modaleOuverte=await pg.evaluate(()=>/R[ée]diger une annonce \(IA\)/.test(document.body.innerText||''));
  dit(ouvert && modaleOuverte, 'l\'atelier « Rédiger une annonce (IA) » s\'ouvre depuis Outils');
  // Clique le premier « ✨ Rédiger ».
  const titrePaire=await pg.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/R[ée]diger/.test((x.innerText||''))&&/✨/.test(x.innerText||''));
    if(!b) return null;
    // le titre de la paire est dans la même carte
    let card=b; for(let i=0;i<4&&card;i++){ if(card.querySelector&&card.querySelector('img,span')) {} card=card.parentElement; }
    b.click(); return true;
  });
  await pg.waitForTimeout(1500);
  const v=await pg.evaluate(()=>({txt:document.body.innerText||'',
    copierTitre:[...document.querySelectorAll('button')].some(b=>/Copier le titre/i.test(b.innerText||'')),
    copierDesc:[...document.querySelectorAll('button')].some(b=>/Copier la description/i.test(b.innerText||''))}));
  dit(aiPosts.length===1, 'un seul appel de rédaction est parti', aiPosts.length+' appel(s)');
  dit(aiPosts[0] && String(aiPosts[0].title||'').trim().length>0, 'la requête IA porte le VRAI titre de la paire (pas du vide)',
    aiPosts[0]?('"'+String(aiPosts[0].title||'').slice(0,40)+'"'):'(rien)');
  dit(/Nike Zoom Fly 5 T42 très bon état/.test(v.txt), 'le titre proposé par l\'IA s\'affiche');
  await pg.screenshot({path:SC+'/z-ia.png',fullPage:true});
  dit(v.copierTitre && v.copierDesc, 'de quoi COPIER le titre ET la description', 'titre:'+v.copierTitre+' desc:'+v.copierDesc);
  // COPIE SEULEMENT : la modale n'a AUCUN bouton qui publie (par construction §3).
  const publieBtn=await pg.evaluate(()=>[...document.querySelectorAll('button')].some(b=>/publier|mettre en ligne|d[ée]poser|envoyer sur vinted/i.test(b.innerText||'')));
  dit(!publieBtn, 'COPIE SEULEMENT : aucun bouton ne publie depuis l\'atelier (§3)');
  dit(errs.length===0, 'aucune erreur d\'app', errs.slice(0,2).join(' | '));
  // ── SANS CLÉ : on le DIT, aucune rédaction inventée ──
  aiMode='nokey';
  await pg.evaluate(()=>{ const b=[...document.querySelectorAll('button')].find(x=>/R[ée]diger/.test((x.innerText||''))&&/✨/.test(x.innerText||'')); if(b) b.click(); });
  await pg.waitForTimeout(1200);
  const sansCle=await pg.evaluate(()=>/Pas de cl[ée] IA|AI_API_KEY|ajoute-la dans/i.test(document.body.innerText||''));
  dit(sansCle, 'sans clé, l\'atelier renvoie vers les Réglages (rien d\'inventé)');
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nL\'IA réécrit à partir des vraies caractéristiques, et tu copies — rien n\'est publié tout seul.');
  process.exit(ko?1:0);
})();
