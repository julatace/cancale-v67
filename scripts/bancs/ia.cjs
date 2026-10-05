// L'ATELIER « Rédiger une annonce (IA) » — ABANDONNÉ LE 30 SEPTEMBRE.
// Ce banc prouvait le RACCORD de l'atelier (⋯ Outils → /api/ai → titre et
// description proposés, à copier). Le 30 septembre Julien l'a retiré (« ça ne
// va pas servir ») : l'entrée d'Outils, la section de Réglages « Rédaction
// d'annonces par l'IA » et le bouton IA du formulaire eBay sont partis
// (commentaires datés dans src/App.jsx ; CLAUDE.md, section eBay :
// `ebay-form.cjs` a fait la même bascule). Ce banc exigeait encore l'atelier et
// sortait rouge sur une app CONFORME à la décision.
// Même règle que `ebay-form.cjs` : il vérifie désormais que l'atelier NE
// REVIENT PAS, avec l'IA moquée « branchée » (GET → ready, POST → une
// rédaction) — c'est le cas où un bouton ressuscité s'afficherait. Chaque
// contrôle d'avant a sa forme actuelle :
//   • l'atelier s'ouvre depuis Outils → Outils s'ouvre, SANS l'entrée IA ;
//   • un seul appel de rédaction      → AUCUN appel (POST /api/ai), même après
//                                        avoir cliqué tout « Rédiger » trouvé ;
//   • la requête porte le vrai titre  → aucun point d'entrée n'envoie une paire
//                                        à l'IA (ni Outils, ni le ⋯ d'une carte) ;
//   • le titre proposé s'affiche      → aucun texte « proposé » par l'IA ;
//   • de quoi copier                  → aucun « Copier le titre / la description » ;
//   • sans clé → Réglages             → aucune impasse « Pas de clé IA » : elle
//                                        renverrait vers une section de Réglages
//                                        qui n'existe plus.
// ⚠️ On ne teste PAS la modale restée dans le code (`iaOpen`) : plus rien ne
// l'ouvre, et tester un chemin mort ne prouve rien (CLAUDE.md §4.11).
// ⚠️ Les contrôles d'ABSENCE seraient verts sur un écran mort : le premier exige
// que l'écran Annonces soit rendu (cartes `data-carte-annonce`) et qu'Outils
// liste ses outils.
// En plus, vu au rendu le 5 octobre : le menu ⋯ Outils, ancré à GAUCHE d'un
// bouton posé au bord droit, débordait de <main> (overflow hidden) et ses
// libellés étaient coupés (« Répartir un », « Inventaire p »…) à 1512 ET 390 px.
// Le banc mesure que chaque outil tient dans la zone visible, aux deux tailles.
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const { metaVersData } = require('./_meta.cjs');
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
const aiPosts=[]; let aiMode='ok';
// Ce qui désignerait une entrée de rédaction IA (bouton, lien, menu). Mesuré le
// 5 octobre : AUCUN libellé de l'écran Annonces ne matche aujourd'hui (pas de
// cri au loup), et « IA » se cherche en mot entier, sensible à la casse.
const RE_IA_SRC = String.raw`r[ée]dig|r[ée]daction|avec l['’]IA|\bIA\b|✨`;

async function prepare(pg){
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route('**/rest/v1/**',route=>{const u=metaVersData(route.request().url());
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return j([]);
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/id=eq\.main/.test(u)) return j(main);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq){const k=decodeURIComponent(eq[1]);return j(rows.filter(r=>r.id===k));}
    const m=/id=like\.([^&]*)/.exec(u); if(m){const pat=decodeURIComponent(m[1]).replace(/[*%]/g,'.*');const re=new RegExp('^'+pat+'$');return j(rows.filter(r=>re.test(r.id)));}
    return j([]);});
  // ⚠️ Playwright prend la DERNIÈRE route enregistrée en premier (§6.6) : la
  // route GÉNÉRIQUE d'abord, la route IA SPÉCIFIQUE en dernier pour qu'elle gagne.
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  await pg.route('**/api/ai',route=>{
    const req=route.request();
    // L'IA est « branchée » : c'est exactement quand un bouton ressuscité apparaîtrait.
    if(req.method()==='GET') return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"ready":true,"model":"test"}'});
    let body={}; try{ body=JSON.parse(req.postData()||'{}'); }catch(_){}
    aiPosts.push(body);
    if(aiMode==='nokey') return route.fulfill({status:200,contentType:'application/json',body:'{"ok":false,"reason":"no-key"}'});
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,title:'Nike Zoom Fly 5 T42 très bon état',desc:'Paire authentique.\nEnvoi rapide et soigné. 👟',why:'titre plus précis'})});
  });
}
// Ouvre ⋯ Outils (s'il est fermé) et rend ses outils + leur géométrie par
// rapport à la zone VISIBLE : la fenêtre ET tout ancêtre dont overflow-x coupe.
async function ouvreOutils(pg){
  const trouve=await pg.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/Outils/.test(x.innerText||''));
    if(!b) return false; b.click(); return true; });
  await pg.waitForTimeout(500);
  const m=await pg.evaluate(()=>{
    const b=[...document.querySelectorAll('button')].find(x=>/Outils/.test(x.innerText||''));
    if(!b||!b.parentElement) return {outils:[]};
    const outils=[...b.parentElement.querySelectorAll('button')].filter(x=>x!==b);
    return {outils:outils.map(x=>{
      const r=x.getBoundingClientRect(); let gauche=0, droite=innerWidth;
      for(let n=x.parentElement;n&&n!==document.documentElement;n=n.parentElement){
        if(/hidden|clip|auto|scroll/.test(getComputedStyle(n).overflowX)){const q=n.getBoundingClientRect(); gauche=Math.max(gauche,q.left); droite=Math.min(droite,q.right);}
      }
      return {txt:(x.innerText||'').replace(/\s+/g,' ').trim(), left:Math.round(r.left), right:Math.round(r.right), gauche:Math.round(gauche), droite:Math.round(droite)};
    })};
  });
  return {trouve, ...m};
}
// Clique tout ce qui ressemble à une entrée de rédaction IA (Outils, cartes, ⋯).
async function cliqueToutRediger(pg){
  const n=await pg.evaluate(src=>{ const re=new RegExp(src,'i');
    const cibles=[...document.querySelectorAll('button,a,[role=button],[role=menuitem]')].filter(b=>re.test((b.innerText||'').replace(/\s+/g,' ')));
    cibles.forEach(b=>{ try{ b.click(); }catch(_){} }); return cibles.length; }, RE_IA_SRC);
  await pg.waitForTimeout(1200);
  return n;
}

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']}).catch(e=>{console.log('launch KO',e.message);process.exit(2);});
  const pg=await b.newPage({viewport:{width:1512,height:950}});
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await prepare(pg);
  await pg.goto('http://localhost:4388/?tab=cat_annonces',{waitUntil:'domcontentloaded'});
  await pg.waitForTimeout(4500);
  const ecran=await pg.evaluate(()=>({cartes:document.querySelectorAll('[data-carte-annonce]').length,
    mort:/n'a pas pu s'afficher|Cannot access|is not defined/.test(document.body.innerText||'')}));
  // 1 — ⋯ Outils s'ouvre, liste ses outils, et n'offre plus la rédaction IA.
  const menu1512=await ouvreOutils(pg);
  const reIA=new RegExp(RE_IA_SRC,'i');
  const entreeIA=menu1512.outils.filter(o=>reIA.test(o.txt));
  dit(ecran.cartes>0 && !ecran.mort && menu1512.trouve && menu1512.outils.length>0 && entreeIA.length===0,
    '⋯ Outils s\'ouvre et ne propose plus « Rédiger une annonce (IA) » (abandonnée le 30 sept., décision de Julien)',
    `${ecran.cartes} cartes · ${menu1512.outils.length} outil(s)`+(entreeIA.length?` · entrée IA : « ${entreeIA[0].txt.slice(0,50)} »`:'')+(ecran.mort?' · ÉCRAN MORT':''));
  // Le menu doit TENIR dans la zone visible : un outil coupé ne se lit pas.
  const coupes=m=>m.outils.filter(o=>o.left<o.gauche-1||o.right>o.droite+1);
  // Ouvre aussi le ⋯ de la première carte : une entrée IA y serait aussi un point d'entrée.
  await pg.evaluate(()=>{ const d=document.querySelector('[data-carte-annonce] details'); if(d) d.open=true; });
  await pg.waitForTimeout(300);
  // Ce que l'ancien atelier aurait laissé cliquer : « Rédiger une annonce » (menu) et « ✨ Rédiger » (paire).
  await pg.evaluate(()=>{ const it=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /R[ée]diger une annonce/i.test(e.textContent||''));
    if(it){ let n=it; for(let i=0;i<4&&n;i++){ if(n.tagName==='BUTTON'){break;} n=n.parentElement; } (n||it).click(); } });
  await pg.waitForTimeout(800);
  const entrees=await pg.evaluate(src=>{ const re=new RegExp(src,'i');
    return [...document.querySelectorAll('button,a,[role=button],[role=menuitem]')].map(b=>(b.innerText||'').replace(/\s+/g,' ').trim()).filter(t=>re.test(t)); }, RE_IA_SRC);
  await cliqueToutRediger(pg);
  const v=await pg.evaluate(()=>({txt:document.body.innerText||'',
    copierTitre:[...document.querySelectorAll('button')].some(b=>/Copier le titre/i.test(b.innerText||'')),
    copierDesc:[...document.querySelectorAll('button')].some(b=>/Copier la description/i.test(b.innerText||''))}));
  // 2 — aucune rédaction n'est envoyée à l'IA, même branchée, même après les clics.
  dit(aiPosts.length===0, 'aucun appel de rédaction n\'est parti vers l\'IA (POST /api/ai), même IA branchée', aiPosts.length+' appel(s)');
  // 3 — aucun point d'entrée (Outils, carte, ⋯ de carte) n'envoie une paire à l'IA.
  dit(entrees.length===0, 'aucun point d\'entrée de rédaction IA sur l\'écran Annonces (Outils, cartes, ⋯ d\'une carte)',
    entrees.length?('« '+entrees[0].slice(0,50)+' »'+(entrees.length>1?` (+${entrees.length-1})`:'')):'');
  // 4 — aucun texte « proposé » par l'IA ne s'affiche (ni l'en-tête, ni la rédaction moquée).
  const proposeIA=/Nike Zoom Fly 5 T42 très bon état|Titre proposé|Description proposée/.test(v.txt);
  dit(!proposeIA, 'aucun titre ni description « proposés par l\'IA » ne s\'affichent');
  await pg.screenshot({path:SC+'/z-ia.png',fullPage:true});
  // 5 — aucun bouton pour copier une rédaction IA.
  dit(!v.copierTitre && !v.copierDesc, 'aucun « Copier le titre / Copier la description » d\'une rédaction IA', 'titre:'+v.copierTitre+' desc:'+v.copierDesc);
  // COPIE SEULEMENT : la modale n'a AUCUN bouton qui publie (par construction §3).
  // ⚠️ ON NE REGARDE QUE DANS LA MODALE IA, pas toute la page : le libellé de
  //    navigation « À publier » (onglet Leboncoin) matche /publier/ et faisait
  //    crier le banc au loup (§6). Ce qui est interdit, c'est un bouton qui
  //    PUBLIE DANS L'ATELIER, pas un onglet du menu.
  const publieBtn=await pg.evaluate(()=>{
    // La modale IA est un overlay [data-noswipe] qui contient son titre. On
    // scanne UNIQUEMENT dedans (le libellé de navigation « À publier » matche
    // sinon /publier/ et fait crier le banc au loup, §6).
    const modal=[...document.querySelectorAll('[data-noswipe]')].find(o=>/R[ée]diger une annonce \(IA\)/.test(o.textContent||''));
    if(!modal) return false;
    return [...modal.querySelectorAll('button')].some(b=>/publier|mettre en ligne|d[ée]poser|envoyer sur vinted/i.test(b.innerText||''));
  });
  dit(!publieBtn, 'COPIE SEULEMENT : aucun bouton ne publie depuis l\'atelier (§3)');
  dit(errs.length===0, 'aucune erreur d\'app', errs.slice(0,2).join(' | '));
  // ── SANS CLÉ : aucune impasse « Pas de clé IA » (la section de Réglages qu'elle
  //    nommerait a été retirée le 30 sept.) et toujours aucun appel ──
  aiMode='nokey';
  const avant=aiPosts.length;
  await cliqueToutRediger(pg);
  const impasse=await pg.evaluate(()=>/Pas de cl[ée] IA|AI_API_KEY|ajoute-la dans|R[ée]daction d'annonces par l'IA/i.test(document.body.innerText||''));
  dit(!impasse && aiPosts.length===avant, 'sans clé non plus : aucune impasse « Pas de clé IA » vers une section de Réglages retirée, aucun appel',
    (impasse?'impasse affichée · ':'')+(aiPosts.length-avant)+' appel(s)');
  // ── Le menu ⋯ Outils tient dans l'écran, sur ordinateur ET sur iPhone ──
  await pg.mouse.click(5,5); await pg.waitForTimeout(300);
  const pg390=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  pg390.on('pageerror',e=>errs.push(e.message));
  await prepare(pg390);
  await pg390.goto('http://localhost:4388/?tab=cat_annonces',{waitUntil:'domcontentloaded'});
  await pg390.waitForTimeout(4500);
  const menu390=await ouvreOutils(pg390);
  const c1512=coupes(menu1512), c390=coupes(menu390);
  const det=(w,m,c)=>c.length?`${w} px : « ${c[0].txt.slice(0,24)} » ${c[0].left}→${c[0].right} pour une zone visible ${c[0].gauche}→${c[0].droite}`:`${w} px : ${m.outils.length} outil(s) visibles`;
  dit(menu1512.outils.length>0 && menu390.outils.length>0 && c1512.length===0 && c390.length===0,
    'le menu ⋯ Outils tient dans l\'écran : aucun outil coupé par le bord (1512 et 390 px)',
    det(1512,menu1512,c1512)+' · '+det(390,menu390,c390));
  await b.close(); srv.close();
  console.log(ko?('\n'+ko+' controle(s) non conforme(s).'):'\nLa rédaction IA reste abandonnée (décision du 30 sept.) : aucune entrée, aucun appel, rien d\'inventé à l\'écran.');
  process.exit(ko?1:0);
})();
