// ═══════════════════════════════════════════════════════════════════════════
// BANC : STATISTIQUES → « PAR CATÉGORIE » (11 nov., lot stats-categories)
//        npm run build && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/stats-categories.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Ventes INVENTÉES de forme réelle (le dépôt est public), horloge FIXÉE au
// jeudi 29 octobre 2026, 15 h. La catégorie vient du `catalog_id` de l'annonce
// (dressing, ou fiche de la page quand le dressing dit `null`), traduite par le
// catalogue de Vinted (`vinted_catalogue`, forme mesurée) — jamais du titre :
// TOUS les titres sont « Article » ici, et la vente sans catégorie lue reste
// « Sans catégorie » jusqu'à SON choix.
//   A. deux catégories : lunettes 2 ventes 120 € (brut 40 €, 1 sans prix d'achat,
//      5,5 j), chaussures 2 ventes 100 € (brut 70 €, 3 j), vêtements 0 vente
//      1 en ligne ; « Sans catégorie (1) · 30 € » ; la somme = la tuile Vendu ;
//   G. le geste : « Poser la catégorie » → cocher → « Sacs » : la vente passe
//      dans Sacs, « Sans catégorie » disparaît, le choix est écrit (synchronisé) ;
//   U. une seule catégorie : le bloc n'est pas montré.
// Jugé sur des `data-*` et des nombres (§6.4). `BANC_CAPTURE=<dossier>` : captures.
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4494;
const CAPT=process.env.BANC_CAPTURE||'';
const MAINTENANT=new Date(2026,9,29,15,0,0);
const D=(y,m,j,h=12)=>new Date(y,m-1,j,h,0,0);
const iso=(d)=>d.toISOString();
const sec=(d)=>Math.floor(d.getTime()/1000);
const ilya=(j)=>new Date(MAINTENANT.getTime()-j*86400000);
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_a', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'atelier_b', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
];
// Le catalogue Vinted, à la forme mesurée (racine > famille > feuille, `path`).
const CATALOGUE={ catalogs:[
  { id:1904, title:'Femmes', path:'', catalogs:[
    { id:1, title:'Accessoires', path:'Femmes', catalogs:[{ id:26, title:'Lunettes de soleil', path:'Femmes > Accessoires', catalogs:[] }] },
    { id:16, title:'Chaussures', path:'Femmes', catalogs:[{ id:2632, title:'Baskets', path:'Femmes > Chaussures', catalogs:[] }] },
    { id:19, title:'Sacs', path:'Femmes', catalogs:[{ id:157, title:'Sacs à dos', path:'Femmes > Sacs', catalogs:[] }] } ] },
  { id:5, title:'Hommes', path:'', catalogs:[{ id:2050, title:'Vêtements', path:'Hommes', catalogs:[{ id:76, title:'Tee-shirts', path:'Hommes > Vêtements', catalogs:[] }] }] },
] };
const FIN='Commande finalisée';
// [compte, tx, prix, statut, date de vente, catalog_id du dressing (null = pas lu), mise en ligne]
function donnees(variante){
  const VENTES = variante==='une' ? [
    ['111','93001',60,FIN,D(2026,10,27,10),2632,D(2026,10,24,10)],
    ['222','93004',40,FIN,D(2026,10,5,10),2632,D(2026,10,1,10)],
  ] : [
    ['111','93001',60,FIN,D(2026,10,27,10),2632,D(2026,10,24,10)],
    ['222','93002',50,FIN,D(2026,10,26,11),26,D(2026,10,16,11)],
    ['111','93003',70,FIN,D(2026,10,21,14),26,D(2026,10,20,14)],
    ['222','93004',40,FIN,D(2026,10,5,10),null,null],
    ['111','93005',30,'Le paiement a été validé',D(2026,10,29,9),undefined,null],
    ['222','93006',25,'Commande annulée',D(2026,10,12,9),2632,null],
  ];
  const EN_LIGNE = variante==='une' ? { '111':[ {id:700001,title:'Article',price:{amount:'80',currency_code:'EUR'},created_at_ts:sec(ilya(5)),catalog_id:2632} ], '222':[] } : {
    '111':[ {id:700001,title:'Article',price:{amount:'80',currency_code:'EUR'},created_at_ts:sec(ilya(5)),catalog_id:76},
            {id:700002,title:'Article',price:{amount:'50',currency_code:'EUR'},created_at_ts:sec(ilya(40)),catalog_id:26},
            {id:700003,title:'Article',price:{amount:'60',currency_code:'EUR'},created_at_ts:sec(ilya(3)),catalog_id:null} ],
    '222':[ {id:700004,title:'Article',price:{amount:'40',currency_code:'EUR'},created_at_ts:sec(ilya(2)),catalog_id:2632} ] };
  const vendues=(uid)=>VENTES.filter(v=>v[0]===uid&&v[5]!==undefined).map(v=>({ id:Number(v[1])+500000, title:'Article', price:{amount:String(v[2]),currency_code:'EUR'}, created_at_ts:v[6]?sec(v[6]):undefined, is_closed:true, promoted:false, catalog_id:v[5] }));
  const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:'Article', price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
  const rows=[];
  for(const a of accounts){ const uid=a.vinted_user_id;
    rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(MAINTENANT), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
    rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(MAINTENANT.getTime()-60000)), payload:{ items:[...EN_LIGNE[uid].map(x=>({...x,promoted:false})),...vendues(uid)] } } }); }
  for(const v of VENTES) if(v[3]===FIN) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(MAINTENANT), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:FIN, status_updated_at:iso(v[4]), buyer:{ country_code:'FR' } } } } });
  rows.push({ id:'vinted_listing_dates', data:{} });
  rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
  rows.push({ id:'ebay_orders', data:{ orders:[] } });
  rows.push({ id:'vinted_catalogue', data:{ at:'2026-10-28T10:00:00.000Z', taille:1, corps:JSON.stringify(CATALOGUE) } });
  // La fiche de la PAGE de 593004 porte la catégorie que le dressing ne dit pas.
  rows.push({ id:'vinted_item_details', data:{ '593004':{ catalogId:2632, description:'x' } } });
  return rows;
}
// Prix d'achat : 93002 n'en a PAS.
const OV={ '93001':{buyPrice:'20'}, '93003':{buyPrice:'30'}, '93004':{buyPrice:'10'} };
let rows=donnees('deux');
function projette(row,select){
  if(!select||select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){ const reste=src.replace(/^data(->>|->)/,''); let v=row.data;
      for(const seg0 of reste.split(/->>|->/)){ const seg=seg0.replace(/^"|"$/g,''); v=(v==null?null:v[seg]); } out[alias]=(v==null)?null:(/->>[^>]*$/.test(src)&&typeof v!=='object'?String(v):v); continue; }
    out[alias]=row[src];
  }
  return out;
}
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.onnx':'application/octet-stream'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.on('error',(e)=>{ console.log('❌ le port '+PORT+' est pris ('+e.code+') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko=0, ok=0; const dit=(c,m,d)=>{ if(c) ok++; else ko++; console.log((c?'  ✅ ':'  ❌ ')+m+(d!=null&&d!==''?' — '+d:'')); };
const essaie=async(nom,f)=>{ try{ await f(); }catch(e){ dit(false,nom,String(e.message||e).slice(0,200)); } };
const TAILLES=[ { nom:'1512', vp:{width:1512,height:950} }, { nom:'390', vp:{width:390,height:844}, isMobile:true, hasTouch:true } ].filter((t)=>!process.env.BANC_TAILLE || t.nom===process.env.BANC_TAILLE);
async function page(b, T, opts={}){
  const ctx=await b.newContext({viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch, colorScheme: opts.sombre ? 'dark' : 'light'});
  const pg=await ctx.newPage();
  await pg.clock.setFixedTime(MAINTENANT);
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript((sombre)=>{try{localStorage.setItem('vrm_acces_direct','1'); if(sombre) localStorage.setItem('vinted_dark','true');}catch(_){}}, !!opts.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  await pg.route('**/rest/v1/**',route=>{
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET'){
      try{ const pd=route.request().postData()||''; if(/vrm_categories_main/.test(pd)) (opts.envois=opts.envois||[]).push(route.request().method()+' '+u.split('?')[0].split('/').pop()+' '+pd.slice(0,0)); }catch(_){}
      try{ const corps=JSON.parse(route.request().postData()||'null'); for(const x of [].concat(corps||[])) if(x&&x.id==='main'&&x.data&&typeof x.data==='object') opts.main=x.data; }catch(_){}
      return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}); }
    if(opts.ventesKO && /orders_sold|orders_\*|_orders_/.test(u)) return route.fulfill({status:522,contentType:'text/html',body:'<html>522</html>'});
    if(opts.ko222 && /harvest_222_orders_sold/.test(u)) return route.fulfill({status:522,contentType:'text/html',body:'<html>522</html>'});
    if(/select=owner/.test(u)) return j([{ owner: process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:opts.main||{}},S)]);
    if(eq) return j(rows.filter(r=>r.id===eq[1]).map(r=>projette(r,S)));
    const lk=/id=like\.([^&]*)/.exec(u); if(lk){ const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$');
      let liste=rows.filter(r=>re.test(r.id));
      if(opts.ko222) liste=liste.filter(r=>!/harvest_222_orders_sold/.test(r.id));
      return j(liste.map(r=>projette(r,S))); }
    return j([]);
  });
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  return { ctx, pg, errs };
}
const aller=async(pg,tab,repere,ms=1500)=>{
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`,{waitUntil:'domcontentloaded'});
  if(repere) await pg.waitForFunction((r)=>document.querySelector(r)||/pas pu s'afficher/.test(document.body.innerText),repere,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(ms);
};
const publier=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_ventes')||'null') && !!JSON.parse(localStorage.getItem('vrm_benefice_jours')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await aller(pg,'vinted_annonces',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_stock')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(600);
};
const lire=(pg)=>pg.evaluate(()=>{
  const carte=document.querySelector('[data-sv-carte="categories"]');
  const cats=Object.fromEntries([...document.querySelectorAll('[data-sv-cat]')].map(e=>[e.getAttribute('data-sv-cat'),{ n:e.getAttribute('data-n'), eur:e.getAttribute('data-eur'), brut:e.getAttribute('data-brut'), couv:e.getAttribute('data-couv'), med:e.getAttribute('data-mediane'), stock:e.getAttribute('data-stock'), texte:e.innerText.replace(/\s+/g,' ') }]));
  const sans=document.querySelector('[data-sv-cat-sans]');
  const t=document.querySelector('[data-sv-tuile="vendu"]');
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--vrm-accent').trim();
  const pistes=carte?[...carte.querySelectorAll('.vrm-sv-piste > span')].map(x=>getComputedStyle(x).backgroundColor):[];
  return { carte:!!carte, cache:(document.querySelector('[data-sv-categories-cache]')||{getAttribute:()=>null}).getAttribute('data-sv-categories-cache'), cats, ordre:Object.keys(cats).join(','),
    sans:sans?sans.getAttribute('data-sv-cat-sans'):null, sansTxt:sans?sans.innerText:'', stockSans:(document.querySelector('[data-sv-cat-stock-sans]')||{getAttribute:()=>null}).getAttribute('data-sv-cat-stock-sans'),
    vendu:t?{ n:t.getAttribute('data-sv-n'), eur:t.getAttribute('data-sv-eur') }:null, pistes, accent,
    deb:document.documentElement.scrollWidth-document.documentElement.clientWidth };
});
const versCarte=async(pg)=>{
  for(let i=0;i<12;i++){ await pg.evaluate(()=>{ const e=document.querySelector('[data-sv-carte="categories"],[data-sv-categories-cache]'); if(e) e.scrollIntoView({block:'center'}); else window.scrollTo(0,document.body.scrollHeight); }); await pg.waitForTimeout(500);
    if(await pg.evaluate(()=>!!document.querySelector('[data-sv-carte="categories"]')||document.querySelector('[data-sv-categories-cache]')?.getAttribute('data-sv-categories-cache')==='une')) break; }
  await pg.waitForTimeout(400);
};
const capture=async(pg,nom,sel)=>{
  if(!CAPT) return; fs.mkdirSync(CAPT,{recursive:true});
  const e=await pg.$(sel); if(!e) return;
  await e.scrollIntoViewIfNeeded(); await pg.waitForTimeout(300);
  await e.screenshot({ path:path.join(CAPT,`${nom}.png`) });
};
(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}`);
      for(const sombre of (CAPT?[false,true]:[false])){
      console.log(`── A${sombre?' (sombre)':''}. Deux catégories, lues par identifiant`);
      rows=donnees('deux');
      await essaie('A'+T.nom,async()=>{
        const o={ main:{ vinted_sale_overrides:OV, ...(sombre?{vinted_dark:true}:{}) }, sombre };
        const { ctx, pg, errs }=await page(b,T,o);
        await publier(pg);
        await aller(pg,'dashboard','[data-sv-tuile="vendu"][data-sv-etat="lu"]',3000);
        await versCarte(pg);
        const r=await lire(pg);
        const L=r.cats.lunettes||{}, Ch=r.cats.chaussures||{}, V=r.cats.vetements||{};
        dit(r.carte,'la carte « Par catégorie » est montrée (deux catégories)',JSON.stringify({cache:r.cache}));
        dit(L.n==='2'&&L.eur==='12000'&&L.brut==='4000'&&L.couv==='1/2'&&L.med==='5.5'&&L.stock==='1','Lunettes : 2 ventes, 120 €, brut 40 € (1 sur 2), 5,5 j, 1 en ligne',JSON.stringify(L));
        dit(/1 sans prix d.achat/.test(L.texte||'')&&!/au moins/.test(L.texte||''),'Lunettes : le manque NOMMÉ (« 1 sans prix d’achat »), jamais « au moins »',L.texte);
        dit(Ch.n==='2'&&Ch.eur==='10000'&&Ch.brut==='7000'&&Ch.couv==='2/2'&&Ch.med==='3'&&Ch.stock==='1','Chaussures : 2 ventes, 100 €, brut 70 € (2 sur 2), 3 j, 1 en ligne — 93004 par la fiche de sa page',JSON.stringify(Ch));
        dit(V.n==='0'&&V.stock==='1'&&V.brut==='','Vêtements : aucune vente, 1 en ligne',JSON.stringify(V));
        dit(r.ordre.startsWith('lunettes,chaussures'),'rangées par ventes puis montant',r.ordre);
        dit(r.sans==='1'&&/30\s*€/.test(r.sansTxt.replace(/[  ]/g,' ')),'« Sans catégorie (1) · 30 € » : la vente en cours sans annonce lue',r.sansTxt);
        dit(r.stockSans==='1','1 annonce en ligne sans catégorie lue, dite',String(r.stockSans));
        const somme=Object.values(r.cats).reduce((s,c)=>s+Number(c.n||0),0)+Number(r.sans||0);
        dit(somme===5,'catégories + sans catégorie = 5 ventes = le vendu du mois (annulée exclue)',String(somme));
        dit(r.pistes.length>0&&r.pistes.every(c=>!/0, 113, 227|10, 132, 255/.test(c)),'aucune barre dans la couleur d’accent (§7)',JSON.stringify([...new Set(r.pistes)]));
        dit(r.deb<=1,'aucun débordement horizontal',`${r.deb}px`);
        await capture(pg,`stats-categories-${T.nom}${sombre?'-sombre':''}`,'[data-sv-carte="categories"]');
        if(!sombre){
          console.log('── G. Le geste : poser la catégorie');
          await pg.locator('[data-sv-cat-poser]').first().click();
          await pg.waitForSelector('[data-feuille-categories] [data-cat-vente]',{timeout:5000});
          const lignes=await pg.$$eval('[data-cat-vente]',xs=>xs.map(x=>x.getAttribute('data-cat-vente')));
          dit(lignes.join(',')==='vinted:93005','la feuille liste la vente sans catégorie par SON identifiant',lignes.join(','));
          const off=await pg.$eval('[data-cat-choix="sacs"]',x=>x.disabled);
          dit(off===true,'rien de coché ⇒ aucun choix possible');
          const h=await pg.$eval('[data-cat-vente]',x=>x.getBoundingClientRect().height);
          dit(h>=44,'une ligne de la feuille fait au moins 44 px',String(h));
          await capture(pg,`stats-categories-feuille-${T.nom}`,'[data-feuille-categories]');
          await pg.locator('[data-cat-vente="vinted:93005"] input').check();
          await pg.locator('[data-cat-choix="sacs"]').click();
          await pg.waitForSelector('[data-cat-fini]',{timeout:5000}).catch(()=>{});
          const ecrit=await pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('vrm_categories_main')||'null'); }catch(_){ return null; } });
          dit(ecrit&&ecrit['vinted:93005']&&ecrit['vinted:93005'].f==='sacs'&&Object.keys(ecrit).length===1,'SON choix est écrit par l’identifiant de la vente, rien d’autre',JSON.stringify(ecrit));
          await pg.keyboard.press('Escape'); await pg.waitForTimeout(600);
          const fermee=await pg.$('[data-feuille-categories]'); if(fermee) { await pg.locator('[data-feuille-categories] button[aria-label]').first().click().catch(()=>{}); await pg.waitForTimeout(500); }
          const r2=await lire(pg);
          dit(r2.cats.sacs&&r2.cats.sacs.n==='1'&&r2.cats.sacs.eur==='3000'&&r2.sans==null,'après le choix : Sacs 1 vente 30 €, plus de « Sans catégorie »',JSON.stringify({sacs:r2.cats.sacs,sans:r2.sans}));
          await pg.waitForTimeout(2500);
          dit((o.envois||[]).length>0,'le choix part vers le nuage (clé synchronisée)',JSON.stringify(o.envois||[]));
        }
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      }
      console.log('── U. Une seule catégorie : rien d’inutile');
      rows=donnees('une');
      await essaie('U'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV } });
        await publier(pg);
        await aller(pg,'dashboard','[data-sv-tuile="vendu"][data-sv-etat="lu"]',3000);
        await versCarte(pg);
        const r=await lire(pg);
        dit(!r.carte&&r.cache==='une','une seule catégorie (Chaussures) ⇒ la carte n’est pas montrée',JSON.stringify({carte:r.carte,cache:r.cache}));
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ stats-categories : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ stats-categories : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
