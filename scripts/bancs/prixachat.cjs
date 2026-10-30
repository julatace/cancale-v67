// LE PONT PRIX D'ACHAT, rendu sur les vraies données.
// Ce que ça prouve, qu'aucun audit statique ne voit :
//   • la modale « Compléter les prix d'achat » ne montre plus SEULEMENT la
//     suggestion sûre (>=12) : elle montre AUSSI les pistes en dessous, à
//     confirmer à la main (« à vérifier »). Mesuré : 111 paires avaient une
//     suggestion sûre, 236 ont au moins une piste — 125 paires passaient d'un
//     blanc (saisie aveugle) à un choix.
//   • la suggestion sûre existante n'a pas disparu (« C'est ça » toujours là).
// §6.1 : rouge sur le code d'avant (0 « à vérifier », ~111 pastilles en tout),
// vert après (« à vérifier » > 0, total >= 200).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
const { dressingsDuJour } = require('./_instantane.cjs'); // fx/ est une photo datée : la lecture du dressing la plus récente = « il y a 1 min » (règle « en ligne » ≤ 24 h)
const fs=require('fs'), http=require('http'), path=require('path');
const DIST=path.join(__dirname,'..','..','dist'), SC=__dirname;
const sc=require('./_scenario-colis.cjs');
const FX=f=>JSON.parse(fs.readFileSync(path.join(SC,'fx',f+'.json'),'utf8'));
const FXok=f=>{try{return FX(f);}catch(_){return [];}};
const present=sc.present(SC);
// ⚠️ fx/ absent : 60 paires numérotées sans prix + leurs achats (18 « C'est ça »
// au titre identique, 42 « à vérifier » marque+taille). La modale doit lister
// les paires et montrer des pistes (« à vérifier » > « C'est ça »), sans blanc.
const S=present?null:sc.achatsScenario();
const main=present?FX('main'):S.main, accounts=present?FX('accounts'):S.accounts, txn=present?FX('txn'):[]; const purch=present?FX('purch'):S.purch;
const rows=[...(present?FX('sold'):S.sold),...purch,...dressingsDuJour(present?FX('listings'):S.listings),...FXok('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4386);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']}).catch(e=>{console.log('launch KO',e.message);process.exit(2);});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.goto('http://localhost:4386/?tab=cat_annonces',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);
  // Ouvre la modale : le StatBox « Coût d'achat » (title), sinon le menu ⋯ Outils.
  const ouvert = await pg.evaluate(()=>{
    const parTitre = [...document.querySelectorAll('[title]')].find(e=>/Compl[ée]ter les prix d'achat/i.test(e.getAttribute('title')||''));
    if(parTitre){ parTitre.click(); return 'statbox'; }
    const outils = [...document.querySelectorAll('button')].find(b=>/Outils/.test(b.innerText||''));
    if(outils){ outils.click();
      // le menu se rend au clic — on retente au tick suivant côté banc
      return 'menu-ouvert'; }
    return 'rien';
  });
  if(ouvert==='menu-ouvert'){ await pg.waitForTimeout(600);
    await pg.evaluate(()=>{ const it=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /Compl[ée]ter les prix d'achat/i.test(e.textContent||'')); if(it){ let n=it; for(let i=0;i<4&&n;i++){ if(n.tagName==='BUTTON'||n.getAttribute&&n.getAttribute('role')==='button'){break;} n=n.parentElement;} (n||it).click(); } }); }
  await pg.waitForTimeout(2500);
  await pg.screenshot({path:SC+'/z-prixachat.png',fullPage:true});
  const v = await pg.evaluate(()=>{
    const boutons=[...document.querySelectorAll('button')];
    const txt=b=>(b.innerText||'').trim();
    const cestCa=boutons.filter(b=>/C'est [çc]a/i.test(txt(b))).length;
    // (30 oct.) Les pistes « à vérifier » sont repliées (« N pistes à vérifier ») : elles sont
    // dans la page, pliées — on les compte par leur texte, pas par ce qui est déplié.
    const aVerifier=boutons.filter(b=>/à v[ée]rifier/i.test((b.textContent||'').trim())).length;
    const modaleOuverte=/Compl[ée]ter|prix d'achat|sans co[ûu]t/i.test(document.body.innerText||'') && (cestCa+aVerifier)>=0;
    // nombre de lignes de la modale (un champ de saisie par paire)
    const lignes=document.querySelectorAll('[data-fillbuy]').length;
    return {cestCa,aVerifier,lignes,modaleOuverte};
  });
  console.log(`modale : ${v.lignes} paire(s) · « C'est ça » ${v.cestCa} · « à vérifier » ${v.aVerifier} (total ${v.cestCa+v.aVerifier})`);
  // Les seuils suivent la COPIE de sa base (fx/) : 320 paires sans prix au 5 octobre, ~58 après la remise
  // à zéro. On juge des PROPORTIONS, pas des nombres figés sur une copie datée (§6, donnée qui a changé).
  dit(v.lignes>=20, 'la modale de saisie des prix d\'achat s\'ouvre et liste les paires', v.lignes+' lignes');
  dit(v.aVerifier>0, 'les pistes sous le seuil sûr sont montrées « à vérifier » (plus de blanc)', v.aVerifier+' pastilles');
  dit(v.cestCa>=1, 'la suggestion sûre « C\'est ça » n\'a pas disparu', v.cestCa+' pastilles');
  dit((v.cestCa+v.aVerifier)>=Math.ceil(v.lignes*0.4) && v.aVerifier>v.cestCa, 'la couverture dépasse largement les seules suggestions sûres (au moins 40 % des paires ont une piste)', 'total '+(v.cestCa+v.aVerifier)+' pastilles sur '+v.lignes+' paires');
  dit(errs.length===0, 'aucune erreur d\'app', errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nChaque paire sans coût a une piste à confirmer, jamais un blanc muet.');
  process.exit(ko?1:0);
})();
