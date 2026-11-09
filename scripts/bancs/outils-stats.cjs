// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES TROIS OUTILS DU 3 NOVEMBRE
//        node /chemin/construire.mjs . && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/outils-stats.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Le jeu de stats-vitrine (ventes INVENTÉES, horloge fixée au jeudi 29 octobre
// 2026, 15 h), plus la marque lue sur les annonces vendues, des vues et favoris :
//   R. Statistiques → « Ce qui rapporte le plus » : classement par Modèle, Compte,
//      Site, Marque, Taille ; couverture ; une ligne touchée ⇒ ses articles ;
//      Semaine et Année ; jamais « paire » ;
//   D. Annonces → « Articles qui dorment » : 30 / 60 / 90 j, le plus ancien
//      d'abord, vues et favoris, « Agir » ⇒ les 4 choix (grisés sans extension),
//      Statistiques → « Voir la liste » y mène ;
//   V. La barre de recherche : micro (fausse SpeechRecognition) — « numéro 124 »,
//      « cent vingt-quatre », « B 125 », texte libre ; fr-FR ; sans API ou micro
//      refusé ⇒ pas de bouton.
// Jugé sur des data-* et des nombres. `BANC_CAPTURE=<dossier>` : captures 390
// tactile clair/sombre et 1512.
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4497;
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
const EN_LIGNE={ '111':[ {id:700001,title:'Nike Cortez taille 41',price:{amount:'80',currency_code:'EUR'},created_at_ts:sec(ilya(95)),view_count:120,favourite_count:3},
  {id:700002,title:'Puma Suede taille 42',price:{amount:'50',currency_code:'EUR'},created_at_ts:sec(ilya(40)),view_count:14,favourite_count:0},
  {id:700003,title:'Asics Gel taille 43',price:{amount:'60',currency_code:'EUR'},created_at_ts:sec(ilya(5))} ],
  '222':[ {id:700004,title:'Vans Old Skool taille 40',price:{amount:'40',currency_code:'EUR'},created_at_ts:sec(ilya(2))} ] };
// Les annonces VENDUES (fermées) restent dans le dressing lu, avec leur date de mise en ligne.
const vendues=(uid)=>VENTES.filter(v=>v[0]===uid&&v[6]).map(v=>({ id:Number(v[1])+500000, title:v[5], brand:v[5].split(' ')[0], price:{amount:String(v[2]),currency_code:'EUR'}, created_at_ts:sec(v[6]), is_closed:true, promoted:false }));
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
  if(opts.parole) await pg.addInitScript((refus)=>{
    // Une FAUSSE reconnaissance vocale : elle « entend » window.__parole, rien d'autre.
    class FausseReco { constructor(){ this.lang=''; window.__reco=this; }
      start(){ window.__recoLang=this.lang; window.__recoN=(window.__recoN||0)+1; setTimeout(()=>{ if(window.__refus){ this.onerror&&this.onerror({error:'not-allowed'}); this.onend&&this.onend(); return; }
        const t=window.__parole||''; this.onresult&&this.onresult({ results:[[{ transcript:t, confidence:0.9 }]] }); this.onend&&this.onend(); }, 120); }
      stop(){ this.onend&&this.onend(); } abort(){} }
    window.webkitSpeechRecognition=FausseReco; window.SpeechRecognition=FausseReco;
    if(refus) { try{ Object.defineProperty(navigator,'permissions',{value:{query:()=>Promise.resolve({state:'denied'})}}); }catch(_){} }
  }, opts.parole==='refus');
  if(opts.sansVoix) await pg.addInitScript(()=>{ try{ delete window.SpeechRecognition; delete window.webkitSpeechRecognition; }catch(_){} });
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


// ── À LA MAIN (mois d'octobre, jusqu'au 29, 15 h) ────────────────────────────
// Ventes FINALISÉES : 93001 Nike AM90 42 60 € achat 20 (mise en ligne 3 j avant),
// 93002 Nike AM90 43 50 € SANS achat (10 j), 93003 Adidas Samba 42 70 € achat 30 (1 j),
// 93004 Adidas Samba 41 40 € achat 10 (sans date). 93005 (en cours) et 93006
// (annulée) n'y sont pas.
//   Modèle : Adidas Samba 2 vendus, brut 40 + 30 = 70 €, moyen 35 €, marge 70/110 =
//     63,6 %, délai 1 j ⇒ « moins de 2 j » ; Nike Air Max 90 2 vendus, achat connu 1,
//     brut 40 €, moyen 40 €, marge 40/60 = 66,7 %, délais 3 et 10 ⇒ médiane 6,5 ⇒
//     « moins de 7 j ». Ordre : Samba (70) · Air Max 90 (40). Couverture 3/4.
//   Compte : atelier_sneak (93001, 93003) brut 80 · paris_kicks (93002, 93004) brut 30, 1/2.
//   Site : Vinted 4, brut 110.  Marque : Adidas 70 · Nike 40.  Taille : 42 → 93001 + 93003
//     = 80 · 41 → 30 · 43 → — (sans achat).
//   Semaine (lundi 26) : 93001 et 93002 ⇒ Nike Air Max 90 seule, 2 vendus, brut 40, 1/2.
//   Année : + 93007 Samba 42 80 € achat 50 (14 j), 93008 Puma Suede (pas au catalogue ⇒
//     Autres, sans achat), 93009 Nike Cortez 100 € achat 40 (9 j) ⇒ Cortez 60 · Samba 100 ·
//     Air Max 90 40 · Autres ⇒ ordre Samba · Cortez · Air Max 90 · Autres ; 5/7.
const ATT_R={
  mois:{ couv:'3/4', modele:[['adidas|samba',{n:'2',ncout:'2',brut:'7000',moyen:'3500',marge:'63.6',med:'1'}],['nike|air max 90',{n:'2',ncout:'1',brut:'4000',moyen:'4000',marge:'66.7',med:'6.5'}]],
    compte:[['Vinted|atelier_sneak',{n:'2',brut:'8000'}],['Vinted|paris_kicks',{n:'2',ncout:'1',brut:'3000'}]], site:[['Vinted',{n:'4',brut:'11000'}]],
    marque:[['adidas',{n:'2',brut:'7000'}],['nike',{n:'2',brut:'4000'}]], taille:[['42',{n:'2',brut:'8000'}],['41',{n:'1',brut:'3000'}],['43',{n:'1',brut:''}]] },
  semaine:{ couv:'1/2', modele:[['nike|air max 90',{n:'2',ncout:'1',brut:'4000'}]] },
  annee:{ couv:'5/7', modele:[['adidas|samba',{n:'3',brut:'10000'}],['nike|cortez',{n:'1',brut:'6000'}],['nike|air max 90',{n:'2',brut:'4000'}],['autres',{n:'1',brut:''}]] },
};
const lireR=(pg)=>pg.evaluate(()=>{ const c=document.querySelector('[data-stats-carte="sv-rapporte"]'); if(!c) return null;
  const note=c.querySelector('[data-cr-couv]');
  return { axe:c.getAttribute('data-cr-axe'), n:c.getAttribute('data-cr-n'), couv:note?note.getAttribute('data-cr-couv'):'',
    lignes:[...c.querySelectorAll('[data-cr-ligne]')].map(e=>[e.getAttribute('data-cr-ligne'),{ n:e.getAttribute('data-n'), ncout:e.getAttribute('data-ncout'), brut:e.getAttribute('data-brut'), moyen:e.getAttribute('data-moyen'), marge:e.getAttribute('data-marge'), med:e.getAttribute('data-mediane'), texte:e.innerText.replace(/\s+/g,' ') }]),
    texte:c.innerText, cibles:[...c.querySelectorAll('button')].map(b=>{ const r=b.getBoundingClientRect(); return r.height; }) }; });
const compare=(lu,att)=>{ const faux=[]; if(!lu) return ['carte absente'];
  if(lu.lignes.map(x=>x[0]).join(' · ')!==att.map(x=>x[0]).join(' · ')) faux.push('ordre '+lu.lignes.map(x=>x[0]).join(' · '));
  for(const [k,a] of att){ const l=(lu.lignes.find(x=>x[0]===k)||[])[1]; if(!l){ faux.push(k+' absente'); continue; } for(const [c,v] of Object.entries(a)) if(l[c]!==v) faux.push(`${k}.${c}=${l[c]} (attendu ${v})`); }
  return faux; };
const axe=async(pg,a)=>{ await pg.locator(`[data-cr-choix="${a}"]`).click(); await pg.waitForFunction((a)=>{ const c=document.querySelector('[data-stats-carte="sv-rapporte"]'); return c&&c.getAttribute('data-cr-axe')===a; },a,{timeout:5000}).catch(()=>{}); await pg.waitForTimeout(150); };
const captureEl=async(pg,sel,nom)=>{ if(!CAPT) return; fs.mkdirSync(CAPT,{recursive:true}); const el=pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(()=>{}); await pg.waitForTimeout(250); await el.screenshot({ path:path.join(CAPT,nom+'.png') }).catch(e=>console.log('   (capture '+nom+' : '+e.message.slice(0,80)+')')); };

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      for(const sombre of (CAPT && T.nom==='390') ? [false,true] : [false]){
      const suf=`${T.nom}${sombre?'-sombre':''}`;
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}${sombre?' · sombre':''}`);
      console.log('── R. Ce qui rapporte le plus');
      await essaie('R'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, vinted_annonce_numeros:FICHES, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        await publier(pg);
        await aller(pg,'dashboard','[data-cr-etat="lu"]',2500);
        await pg.waitForFunction(()=>{ const c=document.querySelector('[data-cr-ligne="nike|air max 90"]'); return c && c.getAttribute('data-mediane')!==''; },null,{timeout:15000}).catch(()=>{});
        let r=await lireR(pg);
        dit(r && r.axe==='modele' && r.couv===ATT_R.mois.couv,`mois : couverture « prix d’achat connus ${ATT_R.mois.couv} »`,r&&`${r.axe} ${r.couv}`);
        let f=compare(r,ATT_R.mois.modele); dit(!f.length,'mois · Modèle : Samba 70 € (moy. 35, 63,6 %, 1 j) puis Air Max 90 40 € (1/2, 66,7 %, 6,5 j)',f.join(' | '));
        const tSamba=(r.lignes.find(x=>x[0]==='adidas|samba')||[])[1]||{}, tAM=(r.lignes.find(x=>x[0]==='nike|air max 90')||[])[1]||{};
        dit(/moins de 2 j/.test(tSamba.texte||'') && /moins de 7 j/.test(tAM.texte||'') && /1\/2/.test(tAM.texte||''),'le temps pour vendre dit en mots (« moins de 2 j », « moins de 7 j ») et la couverture de la ligne (1/2)',`${tSamba.texte} || ${tAM.texte}`);
        dit(!/au moins/.test(r.texte) && !/\bpaires?\b/i.test(r.texte),'jamais « au moins » sur un brut, jamais « paire »',r.texte.replace(/\n/g,' | ').slice(0,200));
        dit(r.cibles.every(h=>h>=(T.hasTouch?44:32)),T.hasTouch?'chaque geste de la carte fait 44 px ou plus (tactile)':'les segments gardent la hauteur des segments de l’app (souris)',JSON.stringify(r.cibles.map(Math.round)));
        // Toucher une ligne ⇒ ses articles.
        await pg.locator('[data-cr-ligne="adidas|samba"] .vrm-cr-ligne').click(); await pg.waitForTimeout(250);
        const art=await pg.evaluate(()=>[...document.querySelectorAll('[data-cr-ligne="adidas|samba"] [data-cr-article]')].map(e=>[e.getAttribute('data-cr-article'),e.getAttribute('data-brut')]));
        dit(JSON.stringify(art)===JSON.stringify([['93003','4000'],['93004','3000']]),'toucher « Adidas Samba » ⇒ ses 2 articles (93003 40 €, 93004 30 €), du plus récent au plus ancien',JSON.stringify(art));
        if(!sombre) await captureEl(pg,'[data-stats-carte="sv-rapporte"]',`rapporte-modele-${suf}`);
        for(const a of ['compte','site','marque','taille']){ await axe(pg,a); r=await lireR(pg); f=compare(r,ATT_R.mois[a]); dit(!f.length,`mois · ${a} : ${ATT_R.mois[a].map(x=>x[0]+' '+(x[1].brut?Number(x[1].brut)/100+' €':'—')).join(' · ')}`,f.join(' | ')); }
        await axe(pg,'modele');
        for(const p of ['semaine','annee']){ await choisir(pg,p); await pg.waitForTimeout(300); r=await lireR(pg); f=compare(r,ATT_R[p].modele);
          dit(!f.length && r.couv===ATT_R[p].couv,`${p} · Modèle : ${ATT_R[p].modele.map(x=>x[0]).join(' · ')}, couverture ${ATT_R[p].couv}`,f.join(' | ')+' '+(r&&r.couv)); }
        await choisir(pg,'mois'); await pg.waitForTimeout(300);
        await captureEl(pg,'[data-stats-carte="sv-rapporte"]',`rapporte-${suf}`);
        const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
        // Statistiques → « Voir la liste » mène aux articles qui dorment.
        const voir=pg.locator('[data-stats-voir-dorment]');
        if(await voir.count()===0){ await pg.locator('[data-stats-repli="vente"] > summary').click().catch(()=>{}); await pg.waitForSelector('[data-stats-voir-dorment]',{timeout:8000}).catch(()=>{}); }
        if(await voir.count()){ await voir.first().click(); await pg.waitForSelector('[data-qui-dorment]',{timeout:15000}).catch(()=>{}); }
        dit(await pg.locator('[data-qui-dorment]').count()===1,'Statistiques → « Voir la liste » ouvre « Articles qui dorment » (Annonces)');
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });

      console.log('── D. Articles qui dorment');
      await essaie('D'+suf,async()=>{
        // (9 nov.) Le vendeur inventé AFFICHE ses quatre sites (« Mes plateformes », 8 nov.) : sans ce choix,
        // seul Vinted est affiché et « Préparer sur eBay / Leboncoin / Vestiaire » n'est pas proposé
        // (l'écran d'un site masqué ramène sur Vinted : le clic ne menait nulle part).
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, vinted_annonce_numeros:FICHES, vrm_plateformes_affichees:{ sites:['vinted','leboncoin','ebay','vestiaire'], at:iso(MAINTENANT) }, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        await aller(pg,'vinted_annonces','.vrm-stock-views',3000);
        await pg.locator('.vrm-stock-views button:has-text("À relancer")').first().click().catch(()=>{});
        await pg.waitForSelector('[data-qui-dorment]',{timeout:15000}).catch(()=>{});
        const lire=()=>pg.evaluate(()=>{ const s=document.querySelector('[data-qui-dorment]'); if(!s) return null; return { seuil:s.getAttribute('data-qd-seuil'), lignes:[...s.querySelectorAll('[data-qd-ligne]')].map(e=>({ id:e.getAttribute('data-qd-ligne'), age:e.getAttribute('data-qd-age'), vues:e.getAttribute('data-qd-vues'), fav:e.getAttribute('data-qd-favoris'), texte:e.innerText.replace(/\s+/g,' ') })), grille:document.querySelectorAll('.vrm-ann-grid').length, texte:s.innerText,
          agir:[...s.querySelectorAll('[data-qd-agir]')].map(x=>x.getBoundingClientRect().height) }; });
        let r=await lire();
        dit(r && r.seuil==='30' && r.lignes.map(x=>x.id+':'+x.age).join(',')==='700001:95,700002:40','30 j : 700001 (95 j) puis 700002 (40 j) — le plus ancien d’abord',r&&r.lignes.map(x=>x.id+':'+x.age).join(','));
        dit(r && r.grille===0,'la liste remplace la grille');
        const l1=r&&r.lignes[0]||{};
        dit(l1.vues==='120' && l1.fav==='3' && /120 vues/.test(l1.texte) && /3 favoris/.test(l1.texte),'vues et favoris lus, écrits sur la ligne',l1.texte);
        dit(r && !/\bpaires?\b/i.test(r.texte),'jamais « paire »',r&&r.texte.replace(/\n/g,' | ').slice(0,160));
        dit(r && r.agir.every(h=>h>=44),'« Agir » fait 44 px ou plus',JSON.stringify(r&&r.agir));
        await captureEl(pg,'[data-qui-dorment]',`dorment-${suf}`);
        await pg.locator('[data-qd-choix="60"]').click(); await pg.waitForTimeout(400); r=await lire();
        dit(r && r.seuil==='60' && r.lignes.map(x=>x.id).join(',')==='700001','60 j : 700001 seule',r&&r.lignes.map(x=>x.id).join(','));
        await pg.locator('[data-qd-choix="90"]').click(); await pg.waitForTimeout(400); r=await lire();
        dit(r && r.lignes.map(x=>x.id).join(',')==='700001','90 j : 700001 seule (95 j)',r&&r.lignes.map(x=>x.id).join(','));
        await pg.locator('[data-qd-choix="30"]').click(); await pg.waitForTimeout(300);
        await pg.locator('[data-qd-agir="700002"]').click(); await pg.waitForSelector('[data-qd-menu]',{timeout:5000}).catch(()=>{});
        const m=await pg.evaluate(()=>[...document.querySelectorAll('[data-qd-choix-geste]')].map(e=>({ k:e.getAttribute('data-qd-choix-geste'), off:e.getAttribute('aria-disabled')==='true', titre:e.title||'', h:e.getBoundingClientRect().height })));
        // (9 nov., « vendre plus ») + « Ouvrir sur Vinted », « Préparer sur Vestiaire » (src/vendrePlus.js, `gestesDormeuse`) ;
        // 700002 a 0 favori lu ⇒ pas d'« offre aux favoris ».
        dit(m.map(x=>x.k).join(',')==='republier,prix,vinted,lbc,ebay,vestiaire','« Agir » ⇒ Ajouter à Republier · Baisser le prix · Ouvrir sur Vinted · Leboncoin · eBay · Vestiaire',m.map(x=>x.k).join(','));
        dit(m.filter(x=>['prix','republier'].includes(x.k)).every(x=>x.off && /extension VRM/.test(x.titre)),'sans extension : Baisser le prix et Republier grisés, la raison dans le titre (rien ne part)',JSON.stringify(m.map(x=>[x.k,x.off])));
        dit(m.every(x=>x.h>=44),'chaque choix fait 44 px ou plus',JSON.stringify(m.map(x=>Math.round(x.h))));
        await captureEl(pg,'[data-qd-menu]',`dorment-agir-${suf}`);
        await pg.waitForFunction(()=>document.getAnimations().every(a=>a.playState!=='running'||a.effect&&a.effect.getTiming&&a.effect.getTiming().iterations===Infinity),null,{timeout:5000}).catch(()=>{}); await pg.locator('[data-qd-choix-geste="ebay"]').click(); await pg.waitForFunction(()=>!document.querySelector('[data-qui-dorment]')&&!document.querySelector('[data-qd-menu]'),null,{timeout:10000}).catch(()=>{}); const ouEbay=await pg.evaluate(()=>location.search+' '+(document.querySelector('[aria-current="page"]')||{}).textContent+' menu='+!!document.querySelector('[data-qd-menu]')+' liste='+!!document.querySelector('[data-qui-dorment]')+' toast='+([...document.querySelectorAll('[role="status"],.vrm-toast')].map(x=>x.innerText).join('/')).slice(0,120));
        // (9 nov.) Navigation par tâche (31 oct.) : l'écran visé est Annonces filtré sur eBay. Sans compte
        // eBay relié (le cas de ce banc), il dit ce qui manque et « Relier eBay » (`OngletManque`, 5 nov.) ;
        // avec un compte, la liste eBay (`.vrm-ebay-annonces`).
        await pg.waitForSelector('[data-tache="annonces"][data-tache-site="ebay"] :is(.vrm-ebay-annonces, [data-onglet-manque="ebay"])',{timeout:8000}).catch(()=>{});
        const ebayVu=await pg.evaluate(()=>{ const t=document.querySelector('[data-tache="annonces"][data-tache-site="ebay"]'); return t ? t.querySelectorAll('.vrm-ebay-annonces').length+t.querySelectorAll('[data-onglet-manque="ebay"]').length : 0; });
        dit(await pg.locator('[data-qui-dorment]').count()===0 && await pg.locator('[data-qd-menu]').count()===0 && ebayVu===1,'« Mettre sur eBay » ouvre l’écran des annonces eBay (rien d’envoyé)',ouEbay);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });

      console.log('── V. La recherche par la voix');
      await essaie('V'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ parole:'oui', sombre, main:sombre?{vinted_dark:true}:{} });
        await aller(pg,'dashboard','[data-sv-periode]',2500);
        const ouvrir=async()=>{ if(T.hasTouch){ if(await pg.locator('.vrm-hdr-recherche').count()===0){ await pg.locator('[aria-label*="echerch"]').first().click().catch(()=>{}); await pg.waitForTimeout(400); } } };
        await ouvrir();
        const mic=pg.locator('[data-recherche-zone] [data-mic-dictee]');
        dit(await mic.count()===1,'le micro est dans la barre de recherche',String(await mic.count()));
        const hMic=await mic.first().evaluate(e=>{ const r=e.getBoundingClientRect(); return [r.width,r.height]; }).catch(()=>[0,0]);
        dit(hMic[0]>=44 && hMic[1]>=44,'le micro fait 44 px',JSON.stringify(hMic));
        if(!sombre) await captureEl(pg,'[data-recherche-zone]',`micro-${suf}`);
        for(const [dite,att] of [['numéro 124','124'],['cent vingt-quatre','124'],['B 125','B125'],['nike dunk noire','nike dunk noire']]){
          await pg.evaluate((t)=>{ window.__parole=t; },dite);
          await ouvrir(); await mic.first().click(); await pg.waitForTimeout(450);
          const v=await pg.evaluate(()=>{ const e=document.querySelector('[data-recherche-champ]'); return e?e.value:null; });
          dit(v===att,`« ${dite} » ⇒ la barre cherche « ${att} »`,String(v));
        }
        dit(await pg.evaluate(()=>window.__recoLang)==='fr-FR','reconnaissance demandée en fr-FR');
        await captureEl(pg,'[data-recherche-zone]',`micro-resultat-${suf}`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      if(!sombre) await essaie('V0'+suf,async()=>{
        for(const cas of ['sans','refus']){
          const { ctx, pg }=await page(b,T,cas==='refus'?{ parole:'refus' }:{ sansVoix:true });
          await aller(pg,'dashboard','[data-sv-periode]',2000);
          if(T.hasTouch){ await pg.locator('[aria-label*="echerch"]').first().click().catch(()=>{}); await pg.waitForTimeout(400); }
          const n=await pg.locator('[data-recherche-zone] [data-mic-dictee]').count();
          dit(n===0,cas==='sans'?'navigateur sans reconnaissance vocale : pas de micro':'micro refusé par le navigateur : pas de micro',String(n));
          await ctx.close();
        }
      });
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ outils-stats : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ outils-stats : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
