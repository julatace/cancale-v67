// ═══════════════════════════════════════════════════════════════════════════
// BANC : agent2-argent-parrainage (11 nov.) — PRÉVISION DU MOIS ET COÛT PAR SITE
//        npm run build && BANC_PORT=… node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/argent-parrainage.cjs
//        BANC_CAPTURE=<dossier> : captures 390 tactile / 1512, clair et sombre
// ═══════════════════════════════════════════════════════════════════════════
// La base INVENTÉE du banc marge-plateforme (aucune donnée réelle), horloge au 20 novembre 2026, 15 h :
//   · 8 ventes Vinted finalisées en novembre, 460 € ; 19 jours pleins lus ⇒ « vers 700 € » (rythme réel
//     460 € ÷ 19,6 jours, prolongé à 30 jours), fourchette dite, « sur 19 jours lus » ;
//   · prix d'achat saisis sur 5 ventes sur 8 ⇒ bénéfice brut PAS prévu, « 5/8 » dit ; sur 8/8 ⇒ prévu ;
//   · la vente 94001 note un boost de 3 € et un port payé de 2,50 € ⇒ « Mois par mois » : Vinted ce mois
//     5,50 €, détail boost / étiquettes « noté sur tes fiches » ; « Sur la période » rend la carte d'avant ;
//   · Ma journée : UNE ligne « À ce rythme, novembre finira vers 700 € », le même centre ;
//   · aucun débordement, aucun rouge, aucune erreur ; cibles ≥ 44 px.
const path=require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=process.env.BANC_DIST||path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4637;
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
const OV={ '94001':{buyPrice:'25',fees:'3',transportVendeur:'2,50'}, '94002':{buyPrice:'25'}, '94003':{buyPrice:'25'}, '94004':{buyPrice:'25'}, '94007':{buyPrice:'20'} };
const OV_TOUS={ ...OV, '94005':{buyPrice:'25'}, '94006':{buyPrice:'25'}, '94008':{buyPrice:'20'} };
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
// (11 nov., C11) Vestiaire : des annonces LUES, aucune vente ⇒ montré ; Leboncoin et eBay : rien lu de
// non vide et aucune vente ⇒ cachés (« pas su » ⇒ montrés : la lecture des lignes en panne, plus bas).
rows.push({ id:'vc_listings', data:{ items:[{ id:'vc1', title:'Annonce inventée' }] } });

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
    const ou=/[?&]or=\(([^)]*)\)/.exec(u);
    if(ou){ if(opts.sitesKO) return route.fulfill({status:500,body:'{}'});
      const conds=ou[1].split(',').map(c=>{ const m=/^id\.(eq|like)\.(.+)$/.exec(c); return m?(m[1]==='eq'?(id)=>id===m[2]:(id)=>new RegExp('^'+m[2].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$').test(id)):()=>false; });
      return j(rows.filter(r=>conds.some(f=>f(r.id))).map(r=>projette(r,S))); }
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


const lirePrev=(pg,sel)=>pg.evaluate((sel)=>{ const c=document.querySelector(sel); if(!c) return null;
  const rouge=[...c.querySelectorAll('*')].some(e=>{ const m=/rgb\((\d+), (\d+), (\d+)\)/.exec(getComputedStyle(e).color)||[]; return +m[1]>180 && +m[2]<80 && +m[3]<80; });
  const b=c.querySelector('[data-prev-benef]');
  return { etat:c.getAttribute('data-prev-etat'), jours:c.getAttribute('data-prev-jours'), centre:c.getAttribute('data-prev-centre'), bas:c.getAttribute('data-prev-bas'), haut:c.getAttribute('data-prev-haut'),
    benef:b&&b.getAttribute('data-prev-benef'), benefC:b&&b.getAttribute('data-prev-benef-centre'), couv:b&&b.getAttribute('data-prev-benef-couv'), h:c.getBoundingClientRect().height,
    texte:c.innerText.replace(/\s+/g,' '), rouge, deb:document.documentElement.scrollWidth-document.documentElement.clientWidth }; },sel);
const attendre=(pg,sel)=>pg.waitForFunction((s)=>{ const e=document.querySelector(s); return e && e.getAttribute('data-prev-etat')==='ok'; },sel,{timeout:20000}).catch(()=>{});

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      for(const sombre of CAPT ? [false,true] : [false]){
      const suf=`${T.nom}${sombre?'-sombre':''}`;
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}${sombre?' · sombre':''}`);
      await essaie('A'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV, ...(sombre?{vinted_dark:true}:{}) }, sombre });
        await publier(pg);
        await aller(pg,'dashboard','[data-argent-plus="prevision"]',2500);
        await attendre(pg,'[data-argent-plus="prevision"]');
        let r=await lirePrev(pg,'[data-argent-plus="prevision"]');
        dit(r && r.etat==='ok' && r.jours==='19','Statistiques : la prévision est sue, « sur 19 jours lus »',r&&JSON.stringify({e:r.etat,j:r.jours}));
        dit(r && r.centre==='70000' && /vers 700\s€/.test(r.texte) && /sur 19 jours lus/.test(r.texte),'au rythme réel : « vers 700 € » (460 € en 19,6 jours, sur 30)',r&&(r.centre+' · '+r.texte.slice(0,160)));
        dit(r && +r.bas>=46000 && +r.bas<+r.centre && +r.haut>+r.centre && /entre .* et .*€/.test(r.texte),'une fourchette honnête, jamais sous ce qui est déjà vendu',r&&(r.bas+'–'+r.haut));
        dit(r && r.benef==='couverture' && r.benefC==='' && r.couv==='5/8' && /5\/8 ventes/.test(r.texte) && !/au moins/.test(r.texte),'bénéfice brut PAS prévu : prix d’achat connus sur 5/8, dit — jamais « au moins »',r&&(r.benef+' '+r.couv));
        dit(r && /pas une promesse/.test(r.texte) && !/objectif/i.test(r.texte),'une estimation, pas une promesse ni un objectif');
        const saisir=await pg.$('[data-prev-saisir]'); const hs=saisir?(await saisir.boundingBox()).height:0;
        dit(hs>=44,'« Saisir › » : la porte du chiffre, ≥ 44 px',String(hs));
        dit(r && !r.rouge && r.deb<=0,'aucun rouge, aucun défilement horizontal',r&&('deb='+r.deb));
        await captureEl(pg,'[data-argent-plus="prevision"]',`prevision-${suf}`);
        // ── Coût par site : d'abord la carte d'avant (période), puis « Mois par mois ».
        dit(!!(await pg.$('[data-cout-vue="periode"] [data-frais-sites]')),'« Sur la période » : la carte « Frais par site » d’avant, inchangée');
        await pg.locator('[data-cout-vue-choix="mois"]').first().click(); await pg.waitForTimeout(500);
        const cm=await pg.evaluate(()=>{ const c=document.querySelector('[data-argent-plus="cout-mois"]'); if(!c) return null;
          const cel=[...c.querySelectorAll('[data-cout-cellule]')].map(e=>[e.getAttribute('data-cout-cellule'),e.getAttribute('data-cout-total'),e.getBoundingClientRect().height,e.getAttribute('data-cout-partiel')]);
          return { cel, sites:[...c.querySelectorAll('[data-cout-site]')].map(e=>e.getAttribute('data-cout-site')), frais:!!document.querySelector('[data-frais-sites]'), deb:document.documentElement.scrollWidth-document.documentElement.clientWidth }; });
        const vNov=cm&&cm.cel.find(x=>x[0]==='2026-11|Vinted');
        dit(cm && vNov && vNov[1]==='550' && !vNov[3] && !cm.frais,'« Mois par mois » : Vinted ce mois 5,50 € (boost + port notés) ; la carte « période » n’est plus écrite (une vue à la fois)',cm&&JSON.stringify(cm.cel.slice(0,8)));
        dit(cm && cm.cel.every(x=>x[2]>=44) && cm.deb<=0,'chaque montant se touche (≥ 44 px), rien ne déborde',cm&&JSON.stringify(cm.cel.map(x=>Math.round(x[2]))));
        await pg.locator('[data-cout-cellule="2026-11|Vinted"]').click(); await pg.waitForTimeout(300);
        const det=await pg.evaluate(()=>[...document.querySelectorAll('[data-cout-detail] [data-cout-cat]')].map(e=>[e.getAttribute('data-cout-cat'),e.getAttribute('data-cout-eur'),e.getAttribute('data-cout-src')]));
        dit(JSON.stringify(det)==='[["boost","300","fiche"],["etiquettes","250","fiche"]]','le détail : boost 3 € et étiquette 2,50 €, « noté sur tes fiches »',JSON.stringify(det));
        await captureEl(pg,'[data-argent-plus="cout-mois"]',`cout-mois-${suf}`);
        await pg.locator('[data-cout-vue-choix="periode"]').first().click(); await pg.waitForTimeout(300);
        // ── Ma journée : une ligne, le même centre.
        await aller(pg,'journee','[data-argent-plus="prevision-ligne"]',2500);
        await attendre(pg,'[data-argent-plus="prevision-ligne"]');
        const l=await lirePrev(pg,'[data-argent-plus="prevision-ligne"]');
        dit(l && l.centre==='70000' && /^À ce rythme, novembre finira vers 700\s€/.test(l.texte) && l.h>=44,'Ma journée : « À ce rythme, novembre finira vers 700 € » — le même centre, ≥ 44 px',l&&(l.texte+' h='+l.h));
        dit(l && l.deb<=0,'Ma journée : rien ne déborde',l&&l.deb);
        await captureEl(pg,'[data-argent-plus="prevision-ligne"]',`journee-ligne-${suf}`);
        if(CAPT){ fs.mkdirSync(CAPT,{recursive:true}); await pg.screenshot({path:path.join(CAPT,`journee-${suf}.png`)}).catch(()=>{}); }
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      if(sombre) continue;
      await essaie('B'+suf,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV_TOUS } });
        await publier(pg);
        await aller(pg,'dashboard','[data-argent-plus="prevision"]',2500);
        await attendre(pg,'[data-argent-plus="prevision"]');
        const r=await lirePrev(pg,'[data-argent-plus="prevision"]');
        dit(r && r.benef==='ok' && +r.benefC>0 && r.couv==='8/8' && /si ta marge reste la même/.test(r.texte),'prix d’achat sur 8/8 : bénéfice brut prévu, « si ta marge reste la même »',r&&(r.benef+' '+r.benefC+' '+r.couv));
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ argent-parrainage : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ argent-parrainage : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
