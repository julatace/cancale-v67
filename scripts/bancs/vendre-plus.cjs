// ═══════════════════════════════════════════════════════════════════════════
// BANC : « VENDRE PLUS » (9 novembre)
//        npm run build && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/vendre-plus.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Une base INVENTÉE (aucune donnée réelle), horloge fixée au vendredi 20 novembre
// 2026, 15 h. Deux comptes Vinted :
//   atelier_sneak (111) : 6 ventes finalisées « Nike Dunk Low » en novembre, mises en
//     ligne 2, 3, 4, 5, 6, 8 j avant (médiane 4,5 j), prix d'achat saisi sur 4 (25 €) ;
//     en ligne : 700001 (95 j, 120 vues, 3 favoris), 700002 (40 j, vues et favoris PAS
//     lus), 50 annonces AU MÊME TITRE « Nike Air Force 1 blanche taille 42 » (10 j,
//     6 favoris chacune), 700003 (5 j, 2 favoris) ;
//   paris_kicks (222) : 2 ventes « Adidas Samba » (1 et 2 j, médiane 1,5 j — la plus
//     rapide, mais 2 ventes : jamais classée), achat saisi sur 1 (20 €) ; en ligne 700004.
// À LA MAIN :
//   A. Annonces → À relancer · Qui dorment (30 j) : 700001 puis 700002 ; 700002 dit
//      « vues pas lues » et « favoris pas lus » (jamais 0) ; « Agir » sur 700001 ⇒
//      republier · prix · vinted · lbc · ebay · vestiaire · favoris (3 favoris lus) ;
//      sur 700002 ⇒ pas de « favoris ». Rien ne part : aucun POST vers l'extension.
//   B. Favoris sans vente (≥ 5) : les 50 annonces au même titre, 50 lignes, 50
//      identifiants distincts ; 700001 (3) et 700003 (2) n'y sont pas.
//   C. Ma journée : la carte « 2 paires en ligne depuis 30 j ou plus » (data-n 2) ;
//      la toucher ouvre Annonces sur « Qui dorment ».
//   D. Statistiques (Mois) : « Ce qui part vite » classe la Dunk (6 datées, 4,5 j),
//      la Samba (2) est « pas assez pour conclure » ; par Marque : Nike classée, Adidas
//      non ; « atelier_sneak vend le plus » (6 > 2, ≥ 5) ; brut 140 € « 4 sur 6 » et
//      30 € « 1 sur 2 » (la règle du bénéfice brut) ; jamais un prix conseillé.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390 tactile
// et 1512, clair et sombre.
const path=require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4511;
const CAPT=process.env.BANC_CAPTURE||'';

const MAINTENANT=new Date(2026,10,20,15,0,0);
const D=(y,m,j,h=12)=>new Date(y,m-1,j,h,0,0);
const iso=(d)=>d.toISOString();
const sec=(d)=>Math.floor(d.getTime()/1000);
const ilya=(j)=>new Date(MAINTENANT.getTime()-j*86400000);
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
];
const FIN='Commande finalisée';
// [compte, tx, prix, date de vente, titre, jours en ligne avant la vente, marque]
const VENTES=[
  ['111','94001',60,D(2026,11,3,10),'Nike Dunk Low taille 42',2,'Nike'],
  ['111','94002',60,D(2026,11,5,10),'Nike Dunk Low taille 43',3,'Nike'],
  ['111','94003',60,D(2026,11,8,10),'Nike Dunk Low taille 41',4,'Nike'],
  ['111','94004',60,D(2026,11,11,10),'Nike Dunk Low taille 42',5,'Nike'],
  ['111','94005',60,D(2026,11,14,10),'Nike Dunk Low taille 44',6,'Nike'],
  ['111','94006',60,D(2026,11,17,10),'Nike Dunk Low taille 42',8,'Nike'],
  ['222','94007',50,D(2026,11,6,10),'Adidas Samba taille 41',1,'Adidas'],
  ['222','94008',50,D(2026,11,12,10),'Adidas Samba taille 40',2,'Adidas'],
];
const OV={ '94001':{buyPrice:'25'}, '94002':{buyPrice:'25'}, '94003':{buyPrice:'25'}, '94004':{buyPrice:'25'}, '94007':{buyPrice:'20'} };
const MEME_TITRE='Nike Air Force 1 blanche taille 42';
const CINQUANTE=Array.from({length:50},(_,i)=>({ id:710000+i, title:MEME_TITRE, price:{amount:'70',currency_code:'EUR'}, created_at_ts:sec(ilya(10)), view_count:30, favourite_count:6 }));
const EN_LIGNE={ '111':[ {id:700001,title:'Nike Cortez taille 41',price:{amount:'80',currency_code:'EUR'},created_at_ts:sec(ilya(95)),view_count:120,favourite_count:3},
  {id:700002,title:'Puma Suede taille 42',price:{amount:'50',currency_code:'EUR'},created_at_ts:sec(ilya(40))},
  ...CINQUANTE,
  {id:700003,title:'Asics Gel taille 43',price:{amount:'60',currency_code:'EUR'},created_at_ts:sec(ilya(5)),view_count:9,favourite_count:2} ],
  '222':[ {id:700004,title:'Vans Old Skool taille 40',price:{amount:'40',currency_code:'EUR'},created_at_ts:sec(ilya(2)),view_count:4,favourite_count:0} ] };
const vendues=(uid)=>VENTES.filter(v=>v[0]===uid).map(v=>({ id:Number(v[1])+500000, title:v[4], brand:v[6], price:{amount:String(v[2]),currency_code:'EUR'}, created_at_ts:sec(new Date(v[3].getTime()-v[5]*86400000)), is_closed:true, promoted:false }));
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:v[4], price:{amount:String(v[2]),currency_code:'EUR'}, status:FIN, date:iso(v[3]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(MAINTENANT), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(MAINTENANT.getTime()-60000)), payload:{ items:[...EN_LIGNE[uid].map(x=>({...x,promoted:false})),...vendues(uid)] } } });
}
for(const v of VENTES) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(MAINTENANT), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:FIN, status_updated_at:iso(v[3]), buyer:{ country_code:'FR' } } } } });
rows.push({ id:'vinted_listing_dates', data:{} });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });

function projette(row,select){
  if(!select||select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){ const reste=src.replace(/^data(->>|->)/,''); let v=row.data;
      for(const seg of reste.split(/->>|->/)) v=(v==null?null:v[seg]); out[alias]=(v==null)?null:(/->>[^>]*$/.test(src)&&typeof v!=='object'?String(v):v); continue; }
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
  const errs=[], posts=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript((sombre)=>{try{localStorage.setItem('vrm_acces_direct','1'); if(sombre) localStorage.setItem('vinted_dark','true');}catch(_){}}, !!opts.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  await pg.route('**/rest/v1/**',route=>{
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET'){
      try{ const corps=JSON.parse(route.request().postData()||'null'); for(const x of [].concat(corps||[])) { if(x&&x.id) posts.push(String(x.id)); if(x&&x.id==='main'&&x.data&&typeof x.data==='object') opts.main=x.data; } }catch(_){}
      return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}); }
    if(/select=owner/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:opts.main||{}},S)]);
    if(eq) return j(rows.filter(r=>r.id===eq[1]).map(r=>projette(r,S)));
    const lk=/id=like\.([^&]*)/.exec(u); if(lk){ const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$');
      return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S))); }
    return j([]);
  });
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  return { ctx, pg, errs, posts };
}
const aller=async(pg,tab,repere,ms=1500)=>{
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`,{waitUntil:'domcontentloaded'});
  if(repere) await pg.waitForFunction((r)=>document.querySelector(r)||/pas pu s'afficher/.test(document.body.innerText),repere,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(ms);
};
const publier=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_ventes')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await aller(pg,'vinted_annonces',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_stock')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(600);
};
const captureEl=async(pg,sel,nom)=>{ if(!CAPT) return; fs.mkdirSync(CAPT,{recursive:true}); const el=pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(()=>{}); await pg.waitForTimeout(250); await el.screenshot({ path:path.join(CAPT,nom+'.png') }).catch(e=>console.log('   (capture '+nom+' : '+e.message.slice(0,80)+')')); };
const lireQD=(pg)=>pg.evaluate(()=>{ const s=document.querySelector('[data-qui-dorment]'); if(!s) return null;
  return { mode:s.getAttribute('data-qd-mode'), seuil:s.getAttribute('data-qd-seuil'), n:s.getAttribute('data-qd-n'),
    lignes:[...s.querySelectorAll('[data-qd-ligne]')].map(e=>({ id:e.getAttribute('data-qd-ligne'), vues:e.getAttribute('data-qd-vues'), fav:e.getAttribute('data-qd-favoris'), texte:e.innerText.replace(/\s+/g,' ') })),
    texte:s.innerText, deb:document.documentElement.scrollWidth-document.documentElement.clientWidth }; });
const gestes=(pg)=>pg.evaluate(()=>[...document.querySelectorAll('[data-qd-choix-geste]')].map(e=>({ k:e.getAttribute('data-qd-choix-geste'), off:e.getAttribute('aria-disabled')==='true', h:e.getBoundingClientRect().height, texte:e.innerText.replace(/\s+/g,' ') })));

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      for(const sombre of CAPT ? [false,true] : [false]){
      const suf=`${T.nom}${sombre?'-sombre':''}`;
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}${sombre?' · sombre':''}`);

      console.log('── A/B. Annonces → À relancer');
      await essaie('AB'+suf,async()=>{
        const { ctx, pg, errs, posts }=await page(b,T,{ main:{ vinted_sale_overrides:OV, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        await aller(pg,'vinted_annonces','.vrm-stock-views',3000);
        await pg.locator('.vrm-stock-views button:has-text("À relancer")').first().click().catch(()=>{});
        await pg.waitForSelector('[data-qui-dorment]',{timeout:15000}).catch(()=>{});
        if(await pg.locator('[data-qd-mode-choix="dort"]').count()) { await pg.locator('[data-qd-mode-choix="dort"]').first().click(); await pg.waitForTimeout(300); }
        let r=await lireQD(pg);
        dit(r && r.mode==='dort' && r.lignes.map(x=>x.id).join(',')==='700001,700002','Qui dorment (30 j) : 700001 (95 j) puis 700002 (40 j)',r&&`${r.mode} ${r.lignes.map(x=>x.id).join(',')}`);
        const l2=r&&r.lignes.find(x=>x.id==='700002')||{};
        dit(l2.vues==='' && l2.fav==='' && /vues pas lues/.test(l2.texte) && /favoris pas lus/.test(l2.texte) && !/\b0 (vue|favori)/.test(l2.texte),'700002 : « vues pas lues », « favoris pas lus » (jamais 0)',l2.texte);
        dit(r && /Offres reçues par annonce : pas lues/.test(r.texte),'la phrase « offres pas lues » est dite une fois, en tête',r&&r.texte.slice(0,160).replace(/\n/g,' | '));
        dit(r && !/\d+\s?%|prix conseill|bonne affaire/i.test(r.texte),'aucun prix conseillé, aucun pourcentage, aucun badge');
        await captureEl(pg,'[data-qui-dorment]',`dorment-${suf}`);
        await pg.locator('[data-qd-agir="700001"]').click(); await pg.waitForSelector('[data-qd-menu]',{timeout:5000}).catch(()=>{});
        let g=await gestes(pg);
        dit(g.map(x=>x.k).join(',')==='republier,prix,vinted,lbc,ebay,vestiaire,favoris','Agir sur 700001 : Ajouter à Republier · Baisser le prix · Ouvrir sur Vinted · Leboncoin · eBay · Vestiaire · Offre aux favoris (3 favoris lus)',g.map(x=>x.k).join(','));
        dit(g.filter(x=>['republier','prix','favoris'].includes(x.k)).every(x=>x.off),'sans extension : Republier, Baisser et Offre aux favoris grisés (rien ne part)',JSON.stringify(g.map(x=>[x.k,x.off])));
        dit(g.every(x=>x.h>=44),'chaque geste fait 44 px ou plus',JSON.stringify(g.map(x=>Math.round(x.h))));
        dit(g.every(x=>!/\d+\s?€|\d+\s?%/.test(x.texte)),'aucun geste ne porte un prix',g.map(x=>x.texte).join(' / '));
        await captureEl(pg,'[data-qd-menu]',`dorment-agir-${suf}`);
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        if(await pg.locator('[data-qd-menu]').count()) { await pg.locator('.vrm-qd-fermer').first().click().catch(()=>{}); await pg.waitForTimeout(400); }
        await pg.locator('[data-qd-agir="700002"]').click(); await pg.waitForSelector('[data-qd-menu]',{timeout:5000}).catch(()=>{});
        g=await gestes(pg);
        dit(g.length>0 && !g.some(x=>x.k==='favoris'),'Agir sur 700002 (favoris pas lus) : pas d’« offre aux favoris »',g.map(x=>x.k).join(','));
        await pg.keyboard.press('Escape'); await pg.waitForTimeout(400);
        if(await pg.locator('[data-qd-menu]').count()) { await pg.locator('.vrm-qd-fermer').first().click().catch(()=>{}); await pg.waitForTimeout(400); }
        // B. Favoris sans vente
        await pg.locator('[data-qd-mode-choix="favoris"]').first().click(); await pg.waitForTimeout(500);
        r=await lireQD(pg);
        const ids=r?r.lignes.map(x=>x.id):[];
        dit(r && r.mode==='favoris' && r.seuil==='5' && ids.length===50 && new Set(ids).size===50 && ids.every(x=>/^7100\d\d$/.test(x)),'Favoris sans vente (≥ 5) : les 50 annonces au même titre, 50 identifiants distincts',r&&`${r.mode} ${r.seuil} ${ids.length} ${new Set(ids).size}`);
        dit(r && !ids.includes('700001') && !ids.includes('700003'),'700001 (3 favoris) et 700003 (2) n’y sont pas');
        dit(r && r.deb<=0,'aucun défilement horizontal',r&&r.deb);
        await captureEl(pg,'[data-qui-dorment]',`favoris-sans-vente-${suf}`);
        await pg.locator('[data-qd-choix="10"]').click(); await pg.waitForTimeout(400); r=await lireQD(pg);
        dit(r && r.lignes.length===0 && /Aucune annonce en ligne avec 10 favoris/.test(r.texte),'≥ 10 favoris : aucune, dit en mots',r&&r.lignes.length);
        await pg.locator('[data-qd-choix="5"]').click(); await pg.waitForTimeout(300);
        await pg.locator('[data-qd-mode-choix="dort"]').first().click(); await pg.waitForTimeout(300);
        dit(!posts.some(x=>/^cmd_|^vrm_cmd|relais/.test(x)),'aucune commande envoyée à l’extension',posts.filter(x=>/cmd|relais/.test(x)).join(','));
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });

      console.log('── C. Ma journée');
      await essaie('C'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        await aller(pg,'journee','[data-job]',3000);
        await pg.waitForSelector('[data-job="paires-dorment"]',{timeout:20000}).catch(()=>{});
        const c=await pg.evaluate(()=>{ const e=document.querySelector('[data-job="paires-dorment"]'); return e?{ n:e.getAttribute('data-n'), texte:e.innerText.replace(/\s+/g,' ') }:null; });
        dit(c && c.n==='2' && /2 (paires|articles) en ligne depuis 30 j ou plus/.test(c.texte),'la carte « 2 paires en ligne depuis 30 j ou plus »',c&&JSON.stringify(c));
        const casesDort=await pg.locator('[data-tendance="dort"]').count();
        dit(casesDort===0,'le même nombre n’est pas redit dans Tendances',String(casesDort));
        await captureEl(pg,'[data-job="paires-dorment"]',`journee-dorment-${suf}`);
        const btn=pg.locator('[data-job="paires-dorment"] button, [data-job="paires-dorment"] a').first();
        if(await btn.count()) await btn.click(); else await pg.locator('[data-job="paires-dorment"]').click();
        await pg.waitForSelector('[data-qui-dorment]',{timeout:15000}).catch(()=>{});
        const r=await lireQD(pg);
        dit(r && r.mode==='dort','la toucher ouvre Annonces → Qui dorment',r&&r.mode);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });

      console.log('── D. Statistiques');
      await essaie('D'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        await publier(pg);
        await aller(pg,'dashboard','[data-sv-periode]',2500);
        await pg.waitForSelector('[data-sv-carte="rapides"] [data-sv-etat="lu"]',{timeout:20000}).catch(()=>{});
        const lire=()=>pg.evaluate(()=>{ const c=document.querySelector('[data-stats-carte="sv-rapides"], [data-sv-carte="rapides"]'); const L=c&&c.querySelector('[data-sv-etat="lu"]');
          const cp=document.querySelector('[data-sv-carte="comptes"]');
          return { axe:L?L.getAttribute('data-sv-axe-vite'):null, peu:L?L.getAttribute('data-sv-peu'):null,
            classes:[...document.querySelectorAll('[data-sv-rapide]')].map(e=>[e.getAttribute('data-sv-rapide'),e.getAttribute('data-ndelai'),e.getAttribute('data-mediane')]),
            note:(document.querySelector('[data-sv-pas-conclu]')||{}).innerText||'',
            meilleur:(document.querySelector('[data-sv-meilleur]')||{getAttribute:()=>null}).getAttribute('data-sv-meilleur'),
            bruts:cp?[...cp.querySelectorAll('[data-sv-compte]')].map(e=>{ const x=e.querySelector('.vrm-sv-brut-compte'); return [e.getAttribute('data-sv-compte'), e.getAttribute('data-n'), x?x.getAttribute('data-benef-valeur'):null, x?x.getAttribute('data-sv-brut-couv'):null, e.innerText.replace(/\s+/g,' ')]; }):[],
            texte:(c?c.innerText:'')+' '+(cp?cp.innerText:''), deb:document.documentElement.scrollWidth-document.documentElement.clientWidth }; });
        let r=await lire();
        dit(r && r.axe==='modele' && r.classes.length===1 && r.classes[0][1]==='6' && r.classes[0][2]==='4.5','Ce qui part vite · Modèle : la Dunk seule classée (6 ventes datées, médiane 4,5 j)',r&&JSON.stringify(r.classes));
        dit(r && r.peu==='1' && /moins de 5 ventes datées/.test(r.note) && /pas assez pour conclure/.test(r.note),'la Samba (2 ventes, la plus rapide) : « pas assez pour conclure », jamais classée',r&&r.note);
        await captureEl(pg,'[data-sv-carte="rapides"]',`part-vite-${suf}`);
        await pg.locator('[data-sv-axe-choix="marque"]').first().click(); await pg.waitForTimeout(400); r=await lire();
        dit(r && r.axe==='marque' && r.classes.map(x=>x[0]).join(',')==='Nike' && r.peu==='1','par Marque (lue sur l’annonce) : Nike classée, Adidas non',r&&JSON.stringify(r.classes)+' peu '+r.peu);
        await pg.locator('[data-sv-axe-choix="compte"]').first().click(); await pg.waitForTimeout(400); r=await lire();
        dit(r && r.classes.map(x=>x[0]).join(',')==='atelier_sneak' && r.peu==='1','par Compte : atelier_sneak classé (6), paris_kicks non (2)',r&&JSON.stringify(r.classes));
        await pg.locator('[data-sv-axe-choix="modele"]').first().click(); await pg.waitForTimeout(300);
        dit(r && r.meilleur==='Vinted|atelier_sneak','« atelier_sneak vend le plus » (6 ventes > 2, au moins 5)',r&&r.meilleur);
        const ba=r&&r.bruts.find(x=>x[0]==='Vinted|atelier_sneak'), bp=r&&r.bruts.find(x=>x[0]==='Vinted|paris_kicks');
        dit(ba && ba[2]==='14000' && ba[3]==='4/6' && /4 sur 6/.test(ba[4]),'brut atelier_sneak 140 € sur 4 ventes au prix d’achat connu, « 4 sur 6 »',ba&&JSON.stringify(ba));
        dit(bp && bp[2]==='3000' && bp[3]==='1/2','brut paris_kicks 30 €, « 1 sur 2 »',bp&&JSON.stringify(bp));
        dit(r && !/prix conseill|bonne affaire|\bbaisse\b/i.test(r.texte),'aucune recommandation de prix');
        dit(r && r.deb<=0,'aucun défilement horizontal',r&&r.deb);
        await captureEl(pg,'[data-sv-carte="comptes"]',`compte-mieux-${suf}`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ vendre-plus : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ vendre-plus : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
