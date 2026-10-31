// ═══════════════════════════════════════════════════════════════════════════
// BANC : STATISTIQUES DÉTAILLÉES ET TENDANCES DE MA JOURNÉE (31 octobre)
//        npm run build && node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/stats-detail.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « beaucoup plus de statistiques dans Ma journée et dans Statistiques,
// de la vraie data ». Ventes et annonces INVENTÉES (le dépôt est public), de la
// forme réelle (prix Vinted `{amount}`, `harvest_*_orders_sold`, transactions
// `harvest_*_txn_*` → `item_id`, dressing `created_at_ts` en secondes), et les
// chiffres attendus CALCULÉS À LA MAIN ci-dessous, à 1512 px et 390 px tactile :
//   A. après Ventes et Annonces : rythme (aujourd'hui, moyenne « depuis la
//      première vente », 7 j contre 7 j, panier), marges par marque, plateforme
//      et compte — 3 ventes sur 4 au prix d'achat connu (cas PARTIEL « sur N »),
//      Nike n'a qu'une vente sur deux au prix connu —, stock qui dort 30/60/90,
//      rotation, taux de vente du mois, annulations ;
//   B. Ma journée : la carte « Tendances » (écarts et paires qui dorment) ouvre
//      Statistiques ; elle ne redit pas le vendu du jour (§7) ;
//   C. ventes illisibles : « pas su » — aucun montant, la raison dite.
// Jugé sur des `data-*` et des nombres, jamais sur un libellé (§6.4).
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4491;
const CAPT=process.env.BANC_CAPTURE||'';

const maintenant=new Date();
// Le jour J-k, à une heure de la journée (jamais dans le futur).
const jour=(k,h)=>{ const d=new Date(maintenant.getFullYear(),maintenant.getMonth(),maintenant.getDate()-k,h); return d>maintenant?new Date(maintenant.getTime()-60000):d; };
const iso=(d)=>d.toISOString();
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(jour(150,9)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(jour(150,9)), owner:null },
];
// [compte, tx, prix, statut, date de vente, titre]
const VENTES=[
  ['111','92001',60,'Commande finalisée',jour(0,Math.min(10,Math.max(0,maintenant.getHours()))),'Nike Air Max 90 taille 42'],
  ['222','92002',50,'Commande finalisée',jour(2,11),'Nike Air Max 90 taille 43'],
  ['111','92003',70,'Commande finalisée',jour(3,15),'Adidas Samba taille 42'],
  ['222','92004',40,'Commande finalisée',jour(10,18),'Adidas Samba taille 41'],
  ['111','92005',30,'Le paiement a été validé',jour(1,9),'Nike Dunk taille 40'],
  ['222','92006',25,'Commande annulée',jour(12,9),'Nike Dunk taille 39'],
];
// Prix d'achat saisis (sur la vente) : 92002 n'en a PAS.
const OV={ '92001':{ buyPrice:'20', fees:'2' }, '92003':{ buyPrice:'30' }, '92004':{ buyPrice:'10' } };
// Annonces en ligne : compte 111, âges 95, 40 et 5 jours ; compte 222, 2 jours
// (un dressing VIDE compte comme une lecture ratée : rien ne serait publié).
const sec=(j)=>Math.floor((maintenant.getTime()-j*86400000)/1000);
const ANNONCES=[ { id:700001, title:'Nike Cortez taille 41', price:{amount:'80',currency_code:'EUR'}, created_at_ts:sec(95) },
  { id:700002, title:'Puma Suede taille 42', price:{amount:'50',currency_code:'EUR'}, created_at_ts:sec(40) },
  { id:700003, title:'Asics Gel taille 43', price:{amount:'60',currency_code:'EUR'}, created_at_ts:sec(5) } ];
const ANNONCES_222=[ { id:700004, title:'Vans Old Skool taille 40', price:{amount:'40',currency_code:'EUR'}, created_at_ts:sec(2) } ];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:v[5], price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items: uid==='111'?ANNONCES:ANNONCES_222 } } });
}
for(const v of VENTES) if(v[3]==='Commande finalisée') rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[4]), buyer:{ country_code:'FR' } } } } });
rows.push({ id:'vinted_listing_dates', data:{} });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });

// ── LES CHIFFRES ATTENDUS, À LA MAIN ────────────────────────────────────────
// Vendu (non annulées) : J0 60 · J1 30 (en cours) · J2 50 · J3 70 · J10 40.
//   aujourd'hui 60 € ; avant aujourd'hui 30+50+70+40 = 190 € sur 10 jours
//   (première vente il y a 10 j) = 19 €/j ; 7 j = 60+30+50+70 = 210 € (4) ;
//   7 j d'avant = 40 € (1) ⇒ +425 % ; panier 30 j = 250 ÷ 5 = 50 €.
// Relevé (finalisées) : 4 ventes, 3 au prix connu.
//   Nike : 2 ventes, 1 connue — brut 60−20 = 40 €, marge 40/60 = 66,7 %.
//   Adidas : (70−30)+(40−10) = 70 € sur 110 € ⇒ 63,6 %.
//   Vinted : brut 110 € ; atelier_sneak 40+40 = 80 € ; paris_kicks 30 € (1/2).
// Stock : ≥30 j 2 paires 130 € ; ≥60 j 1 paire 80 € ; ≥90 j 1 paire 80 €.
// Rotation : 4 annonces au rythme de 5 ventes Vinted / 30 j = 24 j.
// Annulations : 1 sur 6 commandes lues = 16,7 %.
const ATT={ jour:6000, moyenne:1900, j7:21000, j7av:4000, panier:5000, ecartJour:Math.round((60-19)/19*100), ecart7:425 };
const vMois=VENTES.filter(v=>!/annul/i.test(v[3]) && v[4]>=new Date(maintenant.getFullYear(),maintenant.getMonth(),1)).length;
const ATT_TAUX=Math.round(vMois/(vMois+4)*100);

function projette(row,select){
  if(!select||select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){ const reste=src.replace(/^data(->>|->)/,''); let v=row.data;
      for(const seg of reste.split(/->>|->/)) v=(v==null?null:v[seg]); out[alias]=(v==null)?null:v; continue; }
    if(/^meta->>/.test(src)){ const k=src.replace(/^meta->>/,''); out[alias]= k==='id' && /_txn_/.test(row.id) ? row.id.split('_txn_')[1] : (k==='item' && row.data && row.data.payload && row.data.payload.transaction ? String(row.data.payload.transaction.item_id) : null); continue; }
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
    if(/select=owner/.test(u)) return j([{ owner: process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:opts.main||{}},S)]);
    if(eq) return j(rows.filter(r=>r.id===eq[1]).map(r=>projette(r,S)));
    const lk=/id=like\.([^&]*)/.exec(u); if(lk){ const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$'); return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S))); }
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
const attr=(pg,sel,a)=>pg.evaluate(([s,x])=>{ const e=document.querySelector(s); return e?e.getAttribute(x):null; },[sel,a]);
const publier=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_ventes')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await aller(pg,'vinted_annonces',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_stock')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(600);
};

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}`);
      console.log('── A. Statistiques, après Ventes et Annonces');
      await essaie('A'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV } });
        await publier(pg);
        await aller(pg,'dashboard','[data-stats-carte="marges"]',3000);
        const r={}; for(const k of ['jour','moyenne','j7','j7av','panier']) r[k]=await attr(pg,`[data-stat-${k}]`,`data-stat-${k}`);
        dit(r.jour===String(ATT.jour) && r.moyenne===String(ATT.moyenne),"aujourd'hui 60 €, moyenne 19 €/j (depuis la première vente, il y a 10 j)",JSON.stringify(r));
        dit(r.j7===String(ATT.j7) && r.j7av===String(ATT.j7av) && r.panier===String(ATT.panier),'7 j 210 € contre 40 €, panier moyen 50 €',JSON.stringify(r));
        const cov=await attr(pg,'[data-stats-marges-couverture]','data-stats-marges-couverture');
        dit(cov==='3/4','marges : sur 3 ventes avec prix d’achat (sur 4) — cas partiel dit',String(cov));
        const ligne=async(k)=>pg.evaluate((k)=>{ const e=document.querySelector(`[data-stats-marge-ligne="${k}"]`); return e?{n:e.getAttribute('data-n'),ncout:e.getAttribute('data-ncout'),brut:e.getAttribute('data-brut'),marge:e.getAttribute('data-marge')}:null; },k);
        const nike=await ligne('Nike'), adidas=await ligne('Adidas');
        dit(nike && nike.n==='2' && nike.ncout==='1' && nike.brut==='4000' && nike.marge==='66.7','Nike : 1/2 au prix connu, brut 40 €, marge 66,7 %',JSON.stringify(nike));
        dit(adidas && adidas.brut==='7000' && adidas.marge==='63.6','Adidas : brut 70 €, marge 63,6 %',JSON.stringify(adidas));
        await pg.locator('[data-stats-marge-axe="compte"]').first().click();
        await pg.waitForTimeout(300);
        const at=await ligne('atelier_sneak'), pk=await ligne('paris_kicks');
        dit(at && at.brut==='8000' && pk && pk.brut==='3000' && pk.ncout==='1','par compte : atelier_sneak 80 €, paris_kicks 30 € (1/2)',JSON.stringify({at,pk}));
        const seuil=async(s)=>pg.evaluate((s)=>{ const e=document.querySelector(`[data-stats-dort-seuil="${s}"]`); return e?{n:e.getAttribute('data-n'),v:e.getAttribute('data-valeur')}:null; },s);
        const s30=await seuil(30), s60=await seuil(60), s90=await seuil(90);
        dit(s30 && s30.n==='2' && s30.v==='13000' && s60 && s60.n==='1' && s60.v==='8000' && s90 && s90.n==='1','qui dorment : ≥30 j 2 paires 130 €, ≥60 j 1 paire 80 €, ≥90 j 1',JSON.stringify({s30,s60,s90}));
        const rot=await attr(pg,'[data-stat-rotation]','data-stat-rotation'), tv=await attr(pg,'[data-stat-taux-vente]','data-stat-taux-vente'), an=await attr(pg,'[data-stat-annulation]','data-stat-annulation');
        dit(rot==='24' && tv===String(ATT_TAUX) && an==='16.7',`rotation 24 j, taux de vente du mois ${ATT_TAUX} %, annulations 16,7 %`,`${rot} · ${tv} · ${an}`);
        const delai=await attr(pg,'[data-stats-carte="delais"]','data-stats-delais');
        dit(delai==='lu' || delai==='passu','temps de vente : un état (lu ou pas su), jamais un chiffre inventé',String(delai));
        const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        if(CAPT){ for(const c of ['rythme','marges','dort']) { const l=pg.locator(`[data-stats-carte="${c}"]`).first(); if(await l.count()) await l.screenshot({path:path.join(CAPT,`stats-${c}-${T.nom}.png`)}); } }
        await ctx.close();
      });
      if(CAPT) await essaie('A-sombre'+T.nom,async()=>{
        const { ctx, pg }=await page(b,T,{ main:{ vinted_sale_overrides:OV, vinted_dark:true }, sombre:true });
        await publier(pg);
        await aller(pg,'dashboard','[data-stats-carte="marges"]',3000);
        for(const c of ['rythme','marges','dort']) { const l=pg.locator(`[data-stats-carte="${c}"]`).first(); if(await l.count()) await l.screenshot({path:path.join(CAPT,`stats-${c}-${T.nom}-sombre.png`)}); }
        await aller(pg,'journee','[data-widget-tendances]',2500);
        const t=pg.locator('[data-widget-tendances]').first(); if(await t.count()) await t.screenshot({path:path.join(CAPT,`tendances-${T.nom}-sombre.png`)});
        await ctx.close();
      });

      console.log('── B. Ma journée : Tendances');
      await essaie('B'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV } });
        await publier(pg);
        await aller(pg,'journee','[data-widget-tendances]',2500);
        const v=await pg.evaluate(()=>Object.fromEntries([...document.querySelectorAll('[data-tendance]')].map(e=>[e.getAttribute('data-tendance'),e.getAttribute('data-v')])));
        dit(v.jour===String(ATT.ecartJour) && v.semaine===String(ATT.ecart7),`aujourd'hui +${ATT.ecartJour} % sur la moyenne, 7 j +425 %`,JSON.stringify(v));
        dit(v.dort==='2','2 paires en ligne depuis 30 j et plus',JSON.stringify(v));
        dit(Object.keys(v).length===4 && ('panier' in v) !== ('attente' in v),'4 cases ; « En attente » seulement si sa carte n’est pas là (sinon panier moyen)',JSON.stringify(Object.keys(v)));
        const dispo=await attr(pg,'[data-widgets]','data-widgets');
        dit((dispo||'').split(',').includes('tendances'),'la carte arrive d’elle-même (disposition par défaut)',String(dispo));
        if(CAPT){ const t=pg.locator('[data-widget-tendances]').first(); if(await t.count()) await t.screenshot({path:path.join(CAPT,`tendances-${T.nom}.png`)}); }
        await pg.locator('[data-tendance="semaine"]').first().click({force:true});
        await pg.waitForTimeout(1500);
        dit(await pg.locator('[data-stats-carte="rythme"]').count()===1,'toucher une tendance ouvre Statistiques');
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
      await essaie('B2'+T.nom,async()=>{
        // Une disposition RANGÉE avant le 31 oct. (sans `connus`) : Tendances arrive ;
        // rangée après l'avoir retirée (avec `connus`) : elle ne revient pas.
        const { ctx, pg }=await page(b,T,{ main:{ vinted_sale_overrides:OV, vrm_journee_widgets:{ v:1, w:[{id:'barre',t:'pleine'},{id:'afaire',t:'pleine'},{id:'vendu',t:'moyen'}] } } });
        await aller(pg,'journee','[data-widgets]',2500);
        const d1=await attr(pg,'[data-widgets]','data-widgets');
        dit(d1==='barre,afaire,vendu,tendances','disposition ancienne : Tendances ajoutée à la fin',String(d1));
        await ctx.close();
        const s2=await page(b,T,{ main:{ vinted_sale_overrides:OV, vrm_journee_widgets:{ v:1, w:[{id:'barre',t:'pleine'},{id:'afaire',t:'pleine'},{id:'vendu',t:'moyen'}], connus:['barre','afaire','vendu','semaine','attente','recentes','stock','jours14','performance','urssaf','envoyer','retirer','messages','prix','tendances'] } } });
        await aller(s2.pg,'journee','[data-widgets]',2500);
        const d2=await attr(s2.pg,'[data-widgets]','data-widgets');
        dit(d2==='barre,afaire,vendu','retirée par lui (connue) : elle ne revient pas',String(d2));
        await s2.ctx.close();
      });

      console.log('── C. Ventes illisibles : pas su');
      await essaie('C'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ ventesKO:true });
        await aller(pg,'dashboard','[data-stats-carte="rythme"]',3000);
        const etat=await attr(pg,'[data-stats-carte="rythme"]','data-stats-rythme');
        const marges=await attr(pg,'[data-stats-carte="marges"]','data-stats-marges');
        const txt=await pg.evaluate(()=>{ const e=document.querySelector('[data-stats-carte="rythme"]'); return e?e.innerText:''; });
        dit(etat==='passu' && !/\d+,\d\d\s*€/.test(txt),'rythme « pas su » : aucun montant, la raison dite',`${etat} · ${txt.replace(/\n/g,' | ').slice(0,120)}`);
        dit(marges==='passu' && await pg.locator('[data-stats-marge-ligne]').count()===0,'marges : aucun relevé ⇒ aucune ligne, le geste dit',String(marges));
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,200));
        await ctx.close();
      });
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,200)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ stats-detail : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ stats-detail : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
