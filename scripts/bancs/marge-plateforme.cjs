// ═══════════════════════════════════════════════════════════════════════════
// BANC : « MARGE PAR PLATEFORME » (10 nov., lot I) — Argent → Statistiques
//        npm run build && BANC_PORT=… node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/marge-plateforme.cjs
//        BANC_CAPTURE=<dossier> : captures 390 tactile / 1512, clair et sombre
// ═══════════════════════════════════════════════════════════════════════════
// Une base INVENTÉE (aucune donnée réelle), horloge fixée au 20 novembre 2026 :
//   · Vinted : 8 ventes finalisées en novembre (2 comptes), 6 à 60 € et 2 à 50 €,
//     prix d'achat SAISI sur 5 (25 € ×4, 20 €) ⇒ 460 € vendus, bénéfice par paire
//     35 € ×4 et 30 € : médiane 35 €, total 170 €, « prix d'achat manquant pour 3 » ;
//   · Leboncoin, eBay, Vestiaire : lus sans vente ⇒ « 0 vente », sinon « — » et la raison ;
//   · avant la publication de Ventes : bénéfice « — », « ouvre Ventes » ;
//   · la carte suit « D'où viennent mes achats » et « Vitesse d'envoi » ; jamais
//     « au moins » sur un bénéfice ; la porte « Saisir les prix d'achat » ≥ 44 px ;
//     aucun débordement, aucun rouge, aucune erreur.
const path=require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=process.env.BANC_DIST||path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4612;
const CAPT=process.env.BANC_CAPTURE||'';

const MAINTENANT=new Date(2026,10,20,15,0,0);
const D=(y,m,j,h=12)=>new Date(y,m-1,j,h,0,0);
const iso=(d)=>d.toISOString();
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(MAINTENANT), created_at:iso(D(2025,1,1)), owner:null },
];
const FIN='Commande finalisée';
const VENTES=[
  ['111','94001',60,D(2026,11,3,10),'Nike Dunk Low taille 42'],
  ['111','94002',60,D(2026,11,5,10),'Nike Dunk Low taille 42'],
  ['111','94003',60,D(2026,11,8,10),'Nike Dunk Low taille 42'],
  ['111','94004',60,D(2026,11,11,10),'Nike Dunk Low taille 42'],
  ['111','94005',60,D(2026,11,14,10),'Nike Dunk Low taille 42'],
  ['111','94006',60,D(2026,11,17,10),'Nike Dunk Low taille 42'],
  ['222','94007',50,D(2026,11,6,10),'Adidas Samba taille 41'],
  ['222','94008',50,D(2026,11,12,10),'Adidas Samba taille 40'],
];
const OV={ '94001':{buyPrice:'25'}, '94002':{buyPrice:'25'}, '94003':{buyPrice:'25'}, '94004':{buyPrice:'25'}, '94007':{buyPrice:'20'} };
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:v[4], price:{amount:String(v[2]),currency_code:'EUR'}, status:FIN, date:iso(v[3]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(MAINTENANT), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(MAINTENANT.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(MAINTENANT), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:FIN, status_updated_at:iso(v[3]) } } } });
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

const lireCarte=(pg)=>pg.evaluate(()=>{ const c=document.querySelector('[data-stats-carte="marge-plateforme"]'); if(!c) return null;
  const v=document.querySelector('[data-stats-carte="vitesse-envoi"]'), s=document.querySelector('[data-stats-carte="sources-achats"]');
  const sb=c.querySelector('[data-mp-saisir]');
  const rouge=[...c.querySelectorAll('*')].some(e=>{ const m=/rgb\((\d+), (\d+), (\d+)\)/.exec(getComputedStyle(e).color)||[]; return +m[1]>180 && +m[2]<80 && +m[3]<80; });
  return { etat:c.getAttribute('data-mp-etat'), releve:c.getAttribute('data-mp-releve'),
    lignes:[...c.querySelectorAll('[data-mp-plat]')].map(e=>({ plat:e.getAttribute('data-mp-plat'), etat:e.getAttribute('data-mp-etat'), n:e.getAttribute('data-mp-n'), vendu:e.getAttribute('data-mp-vendu'), med:e.getAttribute('data-mp-mediane'), total:e.getAttribute('data-mp-total'), connu:e.getAttribute('data-mp-connu'), sans:e.getAttribute('data-mp-sans-achat'), texte:e.innerText.replace(/\s+/g,' ') })),
    voisins: !!(v && s && (s.compareDocumentPosition(c) & 4) && (v.compareDocumentPosition(c) & 4)),
    saisir: sb ? sb.getBoundingClientRect().height : null, rouge,
    texte:c.innerText, deb:document.documentElement.scrollWidth-document.documentElement.clientWidth }; });

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      for(const sombre of CAPT ? [false,true] : [false]){
      const suf=`${T.nom}${sombre?'-sombre':''}`;
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}${sombre?' · sombre':''}`);
      await essaie('M'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        // Avant la publication de Ventes : le bénéfice dit « — », le vendu est lu.
        await aller(pg,'dashboard','[data-stats-carte="marge-plateforme"]',2500);
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-stats-carte="marge-plateforme"]'); return e && e.getAttribute('data-mp-etat')==='lu'; },null,{timeout:20000}).catch(()=>{});
        let r=await lireCarte(pg);
        const vi0=r&&r.lignes.find(x=>x.plat==='Vinted');
        dit(r && r.releve==='0' && vi0 && vi0.med==='' && /ouvre Ventes/.test(vi0.texte) && vi0.vendu==='46000','relevé pas encore publié : bénéfice « — » (« ouvre Ventes »), vendu lu 460 €',r&&JSON.stringify(vi0)+' releve='+r.releve);
        await publier(pg);
        await aller(pg,'dashboard','[data-stats-carte="marge-plateforme"]',2500);
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-stats-carte="marge-plateforme"]'); return e && e.getAttribute('data-mp-releve')==='1' && e.getAttribute('data-mp-etat')==='lu'; },null,{timeout:20000}).catch(()=>{});
        r=await lireCarte(pg);
        dit(r && r.lignes.map(x=>x.plat).join(',')==='Vinted,Leboncoin,eBay,Vestiaire','une ligne par site : Vinted, Leboncoin, eBay, Vestiaire',r&&r.lignes.map(x=>x.plat+':'+x.etat).join(','));
        const vi=r&&r.lignes.find(x=>x.plat==='Vinted');
        dit(vi && vi.n==='8' && vi.vendu==='46000','Vinted : 8 ventes, 460 € vendus (la règle de « Vendu »)',vi&&JSON.stringify(vi));
        dit(vi && vi.med==='3500' && vi.total==='17000' && vi.connu==='5' && vi.sans==='3','Vinted : médiane 35 €, total 170 € sur 5, prix d’achat manquant pour 3',vi&&JSON.stringify(vi));
        dit(vi && /prix d’achat manquant pour 3/.test(vi.texte) && /sur 5 ventes finalisées/.test(vi.texte),'la couverture est DITE sur la ligne',vi&&vi.texte);
        for(const x of (r?r.lignes:[]).filter(x=>x.plat!=='Vinted')){
          if(x.etat==='lu') dit(x.n==='0' && x.med==='' && /Aucune vente sur la période/.test(x.texte),' '+x.plat+' lu sans vente : 0 vente, bénéfice « — »',x.texte);
          else dit(x.med==='' && /—/.test(x.texte) && /pas lu|lecture/.test(x.texte),' '+x.plat+' pas lu : « — » et la raison',x.texte);
        }
        dit(r && !/au moins[^·\n]*médiane|au moins[^·\n]*en tout/.test(r.texte),'jamais « au moins » sur un bénéfice',r&&r.texte.replace(/\s+/g,' ').slice(0,300));
        dit(r && r.voisins,'la carte suit « D’où viennent mes achats » et « Vitesse d’envoi »');
        dit(r && r.saisir!=null && r.saisir>=44,'« Saisir les prix d’achat » : la porte du chiffre, ≥ 44 px',r&&r.saisir);
        dit(r && !r.rouge,'aucun rouge');
        dit(r && r.deb<=0,'aucun défilement horizontal',r&&r.deb);
        await captureEl(pg,'[data-stats-carte="marge-plateforme"]',`marge-plateforme-${suf}`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ marge-plateforme : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ marge-plateforme : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
