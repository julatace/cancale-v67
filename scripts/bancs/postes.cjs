// Cocher « Colis fait » ne fait disparaître PERSONNE en silence, et le compte
// du haut colle à la liste (§26 : un bloc conditionnel se vérifie RENDU, avec
// des données ; §5 : « un colis caché est un colis perdu »).
// ⚠️ LA FORME A CHANGÉ EXPRÈS LE 30 SEPTEMBRE (5853696, Julien : « les
// bordereaux doivent s'enlever quand les ventes sont expédiées ») : un colis
// coché « posté » QUITTE la liste affichée, et une ligne l'ANNONCE (« Afficher
// les N colis marqués « postés » ») ; un clic les remontre sous l'intertitre
// « Déjà postés · N » (`data-groupe="fait"`). Avec un seul groupe, la liste n'a
// volontairement aucun intertitre. Ce banc cherchait encore l'intertitre
// toujours visible : il juge maintenant la MÊME règle sur la forme actuelle —
// affichés + annoncés = la liste d'avant, et dérouler les postés montre
// exactement ceux qui ont été annoncés, rangés sous leur intertitre.
// ⚠️ Et il n'attend plus 3,5 s à l'aveugle : sous charge (bancs lancés
// ensemble) la liste n'était pas encore là, rien n'était coché, et six
// contrôles tombaient sur un artefact. Il attend que le RÉSEAU se taise et que
// l'écran ne bouge plus (plafond 20 s : une liste qui n'arrive jamais reste
// rouge).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
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
const main=FX('main'), accounts=FX('accounts'), txn=FX('txn');
const rows=[...FX('sold'),...FX('purch'),...FX('listings'),...FX('inbox')];
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.listen(4379);
let ko=0; const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  let derniere=Date.now();
  await pg.route('**/rest/v1/**',route=>{derniere=Date.now(); const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    if(/transaction->>id/.test(u)) return j(txn);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  await pg.route('**/api/**',r2=>{derniere=Date.now(); return r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'});});
  await pg.goto('http://localhost:4379/?tab=cat_bord',{waitUntil:'domcontentloaded'});
  // Ce que l'écran DIT, lu sur le rendu :
  //  · entete  — le nombre du haut (« N colis à envoyer » ; « Aucun » = 0) ;
  //  · cartes  — les cartes affichées ;
  //  · postes  — le nombre ANNONCÉ par la ligne « … les N colis marqués postés »
  //              (0 si la ligne n'est pas là) ; montres = la liste les montre ;
  //  · sep     — le nombre écrit sur l'intertitre du groupe « fait ».
  const compte=()=>pg.evaluate(()=>{
    const t=document.body.innerText||'';
    const m=/(\d+)\s*\n?\s*colis à envoyer/.exec(t);
    const lig=[...document.querySelectorAll('button')].find(x=>/colis marqué/.test(x.textContent));
    const n=lig?/les (\d+) colis marqué/.exec(lig.textContent):null;
    const g=document.querySelector('[data-groupe="fait"]');
    const ns=g?/·\s*(\d+)/.exec(g.textContent):null;
    return {entete: m?+m[1]:(/Aucun colis à envoyer/.test(t)?0:null),
            cartes: document.querySelectorAll('[data-bord-card]').length,
            postes: n?+n[1]:0, montres: !!(lig && /^\s*Cacher/.test(lig.textContent)),
            sep: g?(ns?+ns[1]:NaN):null};
  });
  // L'écran est « posé » quand le réseau s'est tu depuis 1,2 s ET que ce qu'il
  // dit n'a pas bougé sur 1,5 s.
  const stable=async(besoinCartes)=>{
    const t0=Date.now(); let prev='', n=0, s=null;
    while(Date.now()-t0<20000){
      await pg.waitForTimeout(250);
      s=await compte(); const k=JSON.stringify(s);
      if(k===prev) n++; else {n=0; prev=k;}
      if(n>=6 && Date.now()-derniere>1200 && (!besoinCartes || s.cartes>0)) return s;
    }
    return s;
  };
  const voirPostes=async(voulu)=>{
    await pg.evaluate(v=>{const b=[...document.querySelectorAll('button')].find(x=>/colis marqué/.test(x.textContent));
      if(b && /^\s*Cacher/.test(b.textContent)!==v) b.click();},voulu);
    return stable(false);
  };
  const a=await stable(true);
  dit(a.cartes>0, 'la liste des colis est rendue', a.cartes+' cartes · en-tête '+a.entete+' · '+a.postes+' postés annoncés');
  // Au départ déjà : le compte du haut, c'est la liste affichée, et les postés
  // (déjà cochés dans la vraie base) sont annoncés à part. Dérouler l'annonce
  // doit les montrer TOUS, sous « Déjà postés », et le compte du haut plus eux
  // doit faire la liste entière.
  let a2=a;
  if(a.postes>0){ a2=await voirPostes(true); await voirPostes(false); }
  dit(a.entete===a.cartes && a.entete+(+a2.sep||0)===a2.cartes && (+a2.sep||0)===a.postes,
      'au départ déjà, le compte du haut plus les postés font la liste',
      `${a.entete} affichés + ${a2.sep||0} postés = ${a2.cartes} (annoncés : ${a.postes})`);
  // On coche « Colis fait » sur DEUX colis (c'est SON geste, jamais automatique),
  // dans l'état où il ouvre l'écran : les postés repliés.
  for(let i=0;i<2;i++){
    await pg.evaluate(()=>{const b=[...document.querySelectorAll('[data-bord-card] button')].find(x=>/Colis fait/.test(x.textContent)); if(b)b.click();});
    await pg.waitForTimeout(700);
  }
  const c=await stable(false);
  dit(c.postes===a.postes+2, 'l\'annonce des colis « postés » monte de 2',
      `${a.postes} -> ${c.postes}`);
  dit(c.cartes+c.postes===a.cartes+a.postes, 'aucun colis ne disparaît en le cochant (affichés + annoncés)',
      `${c.cartes} + ${c.postes} (avant ${a.cartes} + ${a.postes})`);
  dit(c.entete===a.entete-2, "l'en-tête ne compte plus que les colis qui restent", `${a.entete} -> ${c.entete}`);
  // On déroule les postés : ceux qui ont été annoncés doivent tous être là.
  const d=await voirPostes(true);
  await pg.screenshot({path:SC+'/z-postes.png',fullPage:true});
  dit(d.montres && d.sep===c.postes && d.cartes===a.cartes+a.postes,
      'dérouler les postés montre exactement ceux annoncés, aucun perdu',
      `annoncés ${c.postes} · intertitre ${d.sep} · ${d.cartes} cartes (liste d'avant ${a.cartes+a.postes})`);
  dit(d.entete + (+d.sep||0) === d.cartes, 'le compte du haut plus les postés font la liste entière',
      `${d.entete} + ${d.sep} = ${d.cartes}`);
  // le séparateur est bien AVANT le premier colis posté, pas ailleurs
  const ordre=await pg.evaluate(()=>{
    const g=[...document.querySelectorAll('[data-bord-card]')][0]?.parentElement;
    if(!g) return null;
    return [...g.children].map(el=>el.hasAttribute('data-bord-card')
      ? (/Pas encore/.test(el.innerText)?'poste':'a-envoyer')
      : el.hasAttribute('data-groupe') ? 'SEP:'+el.getAttribute('data-groupe') : 'AUTRE').join(',');
  });
  // Chaque groupe s'ouvre par son intertitre, et TOUS les postés sont après le
  // dernier — qui est celui des postés — : aucun colis à envoyer ne se
  // retrouve sous « Déjà postés ».
  const cases=(ordre||'').split(',');
  const dernierSep=cases.map(x=>x.startsWith('SEP')).lastIndexOf(true);
  const apres=cases.slice(dernierSep+1);
  const avant=cases.slice(0,dernierSep);
  dit(dernierSep>0 && cases[dernierSep]==='SEP:fait' && apres.length>0 && apres.every(x=>x==='poste') && !avant.includes('poste'),
      'tous les colis postés sont sous le dernier intertitre, et eux seuls', ordre);
  dit((cases[0]||'').startsWith('SEP'), 'la liste s\'ouvre par un intertitre', cases[0]);
  dit(errs.length===0, "aucune erreur d'app", errs.slice(0,2).join(' | '));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLe compte du haut et la liste disent la meme chose.');
  process.exit(ko?1:0);
})();
