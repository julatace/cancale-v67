// ═══════════════════════════════════════════════════════════════════════════
// BANC : STATISTIQUES, LA PAGE DE LA MAQUETTE (31 octobre — images/4.png)
//        npm run build && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/stats-vitrine.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « applique ça », puis « fais exactement cette mise en page ».
// Le sélecteur Semaine · Mois · Année gouverne les 4 tuiles et les 5 cartes ;
// chaque chiffre est CALCULÉ À LA MAIN ci-dessous, pour CHAQUE période, sur des
// ventes INVENTÉES de forme réelle (le dépôt est public). L'horloge de la page
// est FIXÉE au jeudi 29 octobre 2026, 15 h : les bornes de période sont donc
// connues d'avance (jamais « relatif à aujourd'hui », qui changerait de mois).
//   A. tout lu : Vendu, Bénéfice (« au moins », « N sur M »), Délai médian
//      (couverture), En ligne (dont qui dorment), barres (en cours en cobalt),
//      Ce qui part vite, Par compte (somme = la tuile), Par taille (la plus
//      vendue en cobalt), Boost (coût saisi, ventes, « pas assez ») — Mois,
//      puis Semaine, puis Année ;
//   P. cas PARTIEL : un compte illisible ⇒ « au moins », aucun écart affiché ;
//   C. cas « pas su » : ventes illisibles ⇒ « — », aucun montant, la raison.
// Jugé sur des `data-*` et des nombres, jamais sur un libellé (§6.4).
// `BANC_CAPTURE=<dossier>` : captures 1512/390, clair et sombre.
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4493;
const CAPT=process.env.BANC_CAPTURE||'';

// L'heure de la page : jeudi 29 octobre 2026, 15 h (heure locale de la machine).
const MAINTENANT=new Date(2026,9,29,15,0,0);
const D=(y,m,j,h=12)=>new Date(y,m-1,j,h,0,0);
const iso=(d)=>d.toISOString();
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
];
// [compte, tx, prix, statut, date de vente, titre, mise en ligne (ou null)]
const FIN='Commande finalisée';
const VENTES=[
  ['111','93001',60,FIN,D(2026,10,27,10),'Nike Air Max 90 taille 42',D(2026,10,24,10)],
  ['222','93002',50,FIN,D(2026,10,26,11),'Nike Air Max 90 taille 43',D(2026,10,16,11)],
  ['111','93003',70,FIN,D(2026,10,21,14),'Adidas Samba taille 42',D(2026,10,20,14)],
  ['222','93004',40,FIN,D(2026,10,5,10),'Adidas Samba taille 41',null],
  ['111','93005',30,'Le paiement a été validé',D(2026,10,29,9),'Nike Dunk taille 40',null],
  ['222','93006',25,'Commande annulée',D(2026,10,12,9),'Nike Dunk taille 39',null],
  ['111','93007',80,FIN,D(2026,9,15,12),'Adidas Samba taille 42',D(2026,9,1,12)],
  ['111','93008',45,FIN,D(2026,9,30,18),'Puma Suede taille 41',D(2026,9,28,18)],
  ['222','93009',100,FIN,D(2026,3,10,12),'Nike Cortez taille 44',D(2026,3,1,12)],
  ['111','93010',55,FIN,D(2025,11,20,12),'Nike Cortez taille 44',null],
  ['111','93011',35,FIN,D(2025,2,2,12),'Puma Suede taille 40',null],
];
// Prix d'achat saisis : 93002 et 93008 n'en ont PAS.
const OV={ '93001':{buyPrice:'20'}, '93003':{buyPrice:'30'}, '93004':{buyPrice:'10'}, '93007':{buyPrice:'50'}, '93009':{buyPrice:'40'} };
// Boost payé saisi sur deux fiches (2,40 € et 1,50 €).
const FICHES={ '593001':{ fees:'2,40' }, '593002':{ fees:'1,50' } };
const sec=(d)=>Math.floor(d.getTime()/1000);
const ilya=(j)=>new Date(MAINTENANT.getTime()-j*86400000);
// En ligne : 111 → 95, 40 et 5 jours ; 222 → 2 jours ⇒ 4 annonces, 2 depuis 30 j et plus.
const EN_LIGNE={ '111':[ {id:700001,title:'Nike Cortez taille 41',price:{amount:'80',currency_code:'EUR'},created_at_ts:sec(ilya(95))},
  {id:700002,title:'Puma Suede taille 42',price:{amount:'50',currency_code:'EUR'},created_at_ts:sec(ilya(40))},
  {id:700003,title:'Asics Gel taille 43',price:{amount:'60',currency_code:'EUR'},created_at_ts:sec(ilya(5))} ],
  '222':[ {id:700004,title:'Vans Old Skool taille 40',price:{amount:'40',currency_code:'EUR'},created_at_ts:sec(ilya(2))} ] };
// Les annonces VENDUES (fermées) restent dans le dressing lu, avec leur date de mise en ligne.
const vendues=(uid)=>VENTES.filter(v=>v[0]===uid&&v[6]).map(v=>({ id:Number(v[1])+500000, title:v[5], price:{amount:String(v[2]),currency_code:'EUR'}, created_at_ts:sec(v[6]), is_closed:true, promoted:false }));
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:v[5], price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(MAINTENANT), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(MAINTENANT.getTime()-60000)), payload:{ items:[...EN_LIGNE[uid].map(x=>({...x,promoted:false})),...vendues(uid)] } } });
}
for(const v of VENTES) if(v[3]===FIN) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(MAINTENANT), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:FIN, status_updated_at:iso(v[4]), buyer:{ country_code:'FR' } } } } });
rows.push({ id:'vinted_listing_dates', data:{} });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });

// ── LES CHIFFRES ATTENDUS, À LA MAIN ────────────────────────────────────────
// VENDU (non annulées, en cours comprises) :
//   Mois (1er → 29 oct. 15 h) : 60+50+70+40+30 = 250 € (5). Septembre AU MÊME
//     POINT (1er → 29 sept. 15 h) : 80 € (1) — le 45 € du 30 sept. n'y est PAS ⇒
//     (250−80)/80 = +212,5 % ⇒ +213 %.
//   Semaine (lundi 26) : 60+50+30 = 140 € (3) ; la précédente jusqu'au jeudi
//     22, 15 h : 70 € (1) ⇒ +100 %.
//   Année 2026 : 250+80+45+100 = 475 € (8) ; 2025 jusqu'au 29 oct. 15 h : 35 €
//     (1) — le 55 € du 20 nov. 2025 n'y est PAS ⇒ (475−35)/35 = +1257 %.
// BÉNÉFICE (finalisées, brut des seules ventes au prix d'achat connu) :
//   Mois : 93001 40 + 93003 40 + 93004 30 = 110 € sur 3 ventes sur 4 ⇒ « au moins ».
//   Semaine : 93001 40 € ; 1 sur 2.  Année : 110 + 93007 30 + 93009 60 = 200 € ; 5 sur 7.
// DÉLAI (Vinted finalisées, mise en ligne → vente) : 93001 3 j, 93002 10 j,
//   93003 1 j, 93004 sans date, 93007 14 j, 93008 2 j, 93009 9 j.
//   Mois : 1, 3, 10 ⇒ 3 j, sur 3/4. Semaine : 3, 10 ⇒ 6,5 j, 2/2. Année : 1,2,3,9,10,14 ⇒ 6 j, 6/7.
// CE QUI PART VITE (mois, par modèle) : Samba 1 j (1 datée sur 2), Air Max 90 6,5 j.
// PAR COMPTE (mois, vendu) : atelier_sneak 3 ventes (délai 1 et 3 ⇒ 2 j),
//   paris_kicks 2 ventes (10 j ; 93004 sans date) — 3 + 2 = 5 = la tuile.
// PAR TAILLE (mois, finalisées) : 41 → 1 (—), 42 → 2 (1 et 3 ⇒ 2 j, la plus vendue), 43 → 1 (10 j).
// EN LIGNE : 4 annonces, dont 2 depuis 30 j et plus (toutes périodes).
// BOOST : 93001 et 93002 boostées (montants saisis 2,40 + 1,50 = 3,90 €),
//   93003 non boostée ; 2 contre 1 ⇒ pas assez pour comparer les délais (« — »).
//   Semaine : les deux mêmes ; Année : les deux mêmes (aucune autre boostée).
const ATT={
  mois:    { vendu:{n:5,eur:25000,prec:8000,ecart:213}, benef:{n:4,ncout:3,brut:11000}, delai:{med:'3',couv:'3/4'},
             barres:'s37…s44', rapides:'1,6.5', comptes:{ '111':{n:3,med:'2'}, '222':{n:2,med:'10'} }, tailles:{ '41':{n:1,med:''}, '42':{n:2,med:'2'}, '43':{n:1,med:'10'} }, plus:'42',
             boost:{ etat:'lu', b:'2', cout:'390', ventes:'2', delai:'' } },
  semaine: { vendu:{n:3,eur:14000,prec:7000,ecart:100}, benef:{n:2,ncout:1,brut:4000}, delai:{med:'6.5',couv:'2/2'},
             comptes:{ '111':{n:2,med:'3'}, '222':{n:1,med:'10'} }, tailles:{ '42':{n:1,med:'3'}, '43':{n:1,med:'10'} },
             boost:{ etat:'lu', b:'2', cout:'390', ventes:'2', delai:'' } },
  annee:   { vendu:{n:8,eur:47500,prec:3500,ecart:1257}, benef:{n:7,ncout:5,brut:20000}, delai:{med:'6',couv:'6/7'},
             comptes:{ '111':{n:5}, '222':{n:3} }, plus:'42',
             boost:{ etat:'lu', b:'2', cout:'390', ventes:'2', delai:'' } },
};
// Barres : semaine (lun→dim) 50 (lun), 60 (mar), 0, 30 (jeu, en cours), vendredi → dimanche à venir.
const BARRES={ semaine:'5000,6000,0,3000,0,0,0', semaineEnCours:'3', mois:'0,8000,0,4500,4000,0,7000,14000', moisEnCours:'7',
  annee:'0,0,10000,0,0,0,0,0,12500,25000,0,0', anneeEnCours:'9' };

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
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript((sombre)=>{try{localStorage.setItem('vrm_acces_direct','1'); if(sombre) localStorage.setItem('vinted_dark','true');}catch(_){}}, !!opts.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  await pg.route('**/rest/v1/**',route=>{
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET'){
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
// Tout ce que la page dit, en data-*.
const lire=(pg)=>pg.evaluate(()=>{
  const q=(s)=>document.querySelector(s), A=(e,a)=>e?e.getAttribute(a):null;
  const t=(k)=>{ const e=q(`[data-sv-tuile="${k}"]`); if(!e) return null; const o={ texte:e.innerText.replace(/\s+/g,' ') }; for(const a of e.getAttributeNames()) if(a.startsWith('data-sv-')) o[a.slice(8)]=e.getAttribute(a); return o; };
  const lignes=(sel,cle)=>Object.fromEntries([...document.querySelectorAll(sel)].map(e=>[e.getAttribute(cle),{ n:e.getAttribute('data-n'), med:e.getAttribute('data-mediane'), texte:e.innerText.replace(/\s+/g,' ') }]));
  const br=q('[data-sv-barres]');
  const cours=br?[...br.querySelectorAll('.vrm-sv-barre')].filter(x=>x.hasAttribute('data-en-cours')).map(x=>getComputedStyle(x).backgroundColor):[];
  const autres=br?[...br.querySelectorAll('.vrm-sv-barre')].filter(x=>!x.hasAttribute('data-en-cours')).map(x=>getComputedStyle(x).backgroundColor):[];
  const accent=getComputedStyle(document.documentElement).getPropertyValue('--vrm-accent').trim();
  const plus=[...document.querySelectorAll('[data-sv-taille] [data-plus]')].map(x=>x.closest('[data-sv-taille]').getAttribute('data-sv-taille'));
  const boost=q('[data-sv-carte="boost"]');
  return {
    periode:A(q('[data-sv-periode]'),'data-sv-periode'), sous:(q('[data-sv-sous-titre]')||{}).innerText||'',
    vendu:t('vendu'), benef:t('benefice'), delai:t('delai'), enligne:t('enligne'),
    online:(q('[data-dash-stat="online"]')||{}).innerText||'', nOnline:document.querySelectorAll('[data-dash-stat="online"]').length,
    barres:A(br,'data-sv-barres'), barresN:A(br,'data-sv-barres-n'), enCours:A(br,'data-sv-encours'), libs:br?[...br.querySelectorAll('.vrm-sv-barre-lib')].map(x=>x.innerText).join(','):'', cours, autres, accent,
    rapides:[...document.querySelectorAll('[data-sv-rapide]')].map(e=>e.getAttribute('data-mediane')).join(','),
    comptes:lignes('[data-sv-compte]','data-sv-compte'), tailles:lignes('[data-sv-taille]','data-sv-taille'), plus,
    boost:boost?{ etat:boost.getAttribute('data-sv-etat'), b:boost.getAttribute('data-sv-boostees'), cout:A(q('[data-sv-boost="cout"]'),'data-v'), ventes:A(q('[data-sv-boost="ventes"]'),'data-v'), delai:A(q('[data-sv-boost="delai"]'),'data-v'), texte:boost.innerText.replace(/\s+/g,' ') }:null,
    deb:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
});
const choisir=async(pg,p)=>{ await pg.locator(`[data-sv-choix="${p}"]`).first().click(); await pg.waitForFunction((p)=>{ const e=document.querySelector('[data-sv-periode]'); return e && e.getAttribute('data-sv-periode')===p; },p,{timeout:5000}).catch(()=>{}); await pg.waitForTimeout(300); };
const capture=async(pg,nom)=>{
  if(!CAPT) return;
  fs.mkdirSync(CAPT,{recursive:true});
  const h=await pg.evaluate(()=>{ const v=document.querySelector('.vrm-stats-vitrine'); if(!v) return 0; const r=v.getBoundingClientRect(); return Math.ceil(r.bottom+(document.scrollingElement||document.documentElement).scrollTop); });
  const vp=pg.viewportSize(); await pg.setViewportSize({ width:vp.width, height:Math.max(vp.height, Math.min(4000, h+40)) }); await pg.waitForTimeout(400);
  await pg.screenshot({ path:path.join(CAPT,`${nom}.png`), clip:{ x:0, y:0, width:vp.width, height:Math.min(4000,h+40) } });
  await pg.setViewportSize(vp);
};

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}`);
      console.log('── A. Tout lu : Mois, Semaine, Année');
      await essaie('A'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, vinted_annonce_numeros:FICHES } });
        await publier(pg);
        await aller(pg,'dashboard','[data-sv-tuile="vendu"][data-sv-etat="lu"]',3500);
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-sv-carte="boost"]'); return e && e.getAttribute('data-sv-etat')!=='encours'; },null,{timeout:15000}).catch(()=>{});
        for(const p of ['mois','semaine','annee']){
          if(p!=='mois') await choisir(pg,p);
          const r=await lire(pg), a=ATT[p];
          console.log(`   · ${p} — « ${r.sous} »`);
          dit(r.periode===p,`${p} : la période choisie est appliquée`,String(r.periode));
          const v=r.vendu||{};
          dit(v.etat==='lu' && v.n===String(a.vendu.n) && v.eur===String(a.vendu.eur) && v.prec===String(a.vendu.prec) && v.ecart===String(a.vendu.ecart) && v.partiel==='0',
            `${p} : Vendu ${a.vendu.eur/100} € (${a.vendu.n}), avant ${a.vendu.prec/100} € au même point ⇒ ${a.vendu.ecart>0?'+':''}${a.vendu.ecart} %`,JSON.stringify(v));
          dit(new RegExp(`\\+${a.vendu.ecart} %`).test(v.texte||'') && /(^|\s)\d+,\d\d €/.test(v.texte||'') && !/au moins/.test(v.texte||''),`${p} : la tuile écrit le montant et « +${a.vendu.ecart} % », sans « au moins » (tout est lu)`,v.texte);
          const bn=r.benef||{};
          dit(bn.etat==='lu' && bn.n===String(a.benef.n) && bn.ncout===String(a.benef.ncout) && bn.brut===String(a.benef.brut),`${p} : Bénéfice ${a.benef.brut/100} € sur ${a.benef.ncout} ventes sur ${a.benef.n}`,JSON.stringify(bn));
          dit(/au moins/.test(bn.texte||'') && new RegExp(`${a.benef.ncout} ventes? sur ${a.benef.n}`).test(bn.texte||''),`${p} : cas partiel dit — « au moins » et « ${a.benef.ncout} sur ${a.benef.n} »`,bn.texte);
          const dl=r.delai||{};
          dit(dl.etat==='lu' && dl.mediane===a.delai.med && dl.couv===a.delai.couv,`${p} : délai médian ${a.delai.med} j, sur ${a.delai.couv}`,JSON.stringify(dl));
          const el=r.enligne||{};
          dit(el.dort==='2' && /^4\b/.test(r.online.trim()) && r.nOnline===1,'En ligne : 4 annonces, dont 2 qui dorment — écrit UNE fois sur l’écran',JSON.stringify({online:r.online,n:r.nOnline,dort:el.dort}));
          const bar=BARRES[p], bcours=BARRES[p+'EnCours'];
          dit(r.barres===bar && r.enCours===bcours,`${p} : barres ${bar} (en cours n° ${bcours})`,`${r.barres} · ${r.enCours} · ${r.libs}`);
          dit(r.cours.length===1 && r.autres.length>0 && r.autres.every(c=>c!==r.cours[0]),`${p} : la barre en cours seule dans la couleur d’accent, les autres en gris`,JSON.stringify({cours:r.cours,autres:[...new Set(r.autres)]}));
          if(p==='mois') dit(r.libs==='s37,s38,s39,s40,s41,s42,s43,s44','mois : 8 semaines s37 → s44',r.libs);
          if(a.rapides) dit(r.rapides===a.rapides,`${p} : ce qui part vite — médianes ${a.rapides} (du plus rapide au plus lent)`,r.rapides);
          const cA=r.comptes['Vinted|atelier_sneak']||{}, cP=r.comptes['Vinted|paris_kicks']||{};
          dit(cA.n===String(a.comptes['111'].n) && cP.n===String(a.comptes['222'].n) && (a.comptes['111'].med==null || (cA.med===a.comptes['111'].med && cP.med===a.comptes['222'].med)),
            `${p} : par compte — atelier_sneak ${a.comptes['111'].n}, paris_kicks ${a.comptes['222'].n}${a.comptes['111'].med?` (délais ${a.comptes['111'].med} j et ${a.comptes['222'].med} j)`:''}`,JSON.stringify(r.comptes));
          const somme=Object.values(r.comptes).reduce((s,c)=>s+Number(c.n||0),0);
          dit(somme===a.vendu.n,`${p} : la somme des comptes = la tuile Vendu (${a.vendu.n})`,String(somme));
          if(a.tailles){ const ok2=Object.entries(a.tailles).every(([k,x])=>r.tailles[k] && r.tailles[k].n===String(x.n) && r.tailles[k].med===x.med) && Object.keys(r.tailles).length===Object.keys(a.tailles).length;
            dit(ok2,`${p} : par taille ${Object.entries(a.tailles).map(([k,x])=>`${k}→${x.n}${x.med?` (${x.med} j)`:''}`).join(', ')}`,JSON.stringify(r.tailles));
            dit(Object.keys(r.tailles).join(',')===Object.keys(a.tailles).sort((x,y)=>Number(x)-Number(y)).join(','),`${p} : tailles rangées dans l’ordre des pointures`,Object.keys(r.tailles).join(',')); }
          if(a.plus) dit(r.plus.length===1 && r.plus[0]===a.plus,`${p} : la taille la plus vendue (${a.plus}) seule en cobalt`,JSON.stringify(r.plus));
          const bo=r.boost||{};
          dit(bo.etat===a.boost.etat && bo.b===a.boost.b && bo.cout===a.boost.cout && bo.ventes===a.boost.ventes && bo.delai===a.boost.delai,`${p} : boost — coût saisi 3,90 €, 2 ventes, délais « — » (pas assez)`,JSON.stringify(bo));
          dit(r.deb<=1,`${p} : aucun débordement horizontal`,`${r.deb}px`);
          if(p==='mois') await capture(pg,`stats-vitrine-${T.nom}`);
        }
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      if(CAPT) await essaie('A-sombre'+T.nom,async()=>{
        const { ctx, pg }=await page(b,T,{ main:{ vinted_sale_overrides:OV, vinted_annonce_numeros:FICHES, vinted_dark:true }, sombre:true });
        await publier(pg);
        await aller(pg,'dashboard','[data-sv-tuile="vendu"][data-sv-etat="lu"]',3500);
        await capture(pg,`stats-vitrine-${T.nom}-sombre`);
        await ctx.close();
      });

      console.log('── P. Un compte illisible : total partiel');
      await essaie('P'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV }, ko222:true });
        await aller(pg,'dashboard','[data-sv-tuile="vendu"]',5000);
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-sv-tuile="vendu"]'); return e && e.getAttribute('data-sv-etat')==='lu'; },null,{timeout:15000}).catch(()=>{});
        const r=await lire(pg); const v=r.vendu||{};
        // Seul atelier_sneak est lu : 60 + 70 + 30 = 160 € (3) en octobre.
        dit(v.etat==='lu' && v.partiel==='1' && v.eur==='16000' && v.n==='3','Vendu partiel : 160 € (3) d’atelier_sneak, marqué partiel',JSON.stringify(v));
        dit(/au moins/.test(v.texte||'') && !/%/.test(v.texte||'') && /paris_kicks/.test(v.texte||''),'« au moins », aucun écart affiché, le compte manquant NOMMÉ',v.texte);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });

      console.log('── C. Ventes illisibles : pas su');
      await essaie('C'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ ventesKO:true });
        await aller(pg,'dashboard','[data-sv-tuile="vendu"]',4000);
        const r=await lire(pg);
        const txt=await pg.evaluate(()=>{ const e=document.querySelector('.vrm-stats-vitrine'); return e?e.innerText:''; });
        dit(r.vendu && r.vendu.etat==='passu' && /—/.test(r.vendu.texte),'Vendu « pas su » : un tiret et la raison',JSON.stringify(r.vendu));
        dit(r.benef && r.benef.etat==='passu' && r.delai && r.delai.etat==='passu','Bénéfice et délai : aucun relevé ⇒ « — » et le geste',JSON.stringify([r.benef&&r.benef.texte,r.delai&&r.delai.texte]));
        dit(!/\d+,\d\d\s*€/.test(txt),'aucun montant nulle part dans le bloc',txt.replace(/\n/g,' | ').slice(0,160));
        dit(!r.barres && Object.keys(r.comptes).length===0,'ni barre ni compte inventés');
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ stats-vitrine : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ stats-vitrine : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
