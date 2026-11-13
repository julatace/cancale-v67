// ═══════════════════════════════════════════════════════════════════════════
// BANC : lot 36-27 (13 nov.) — « TES COMPTES VINTED » ET LA PRÉVISION LISSÉE
//        npm run build && BANC_PORT=… node -r ./scripts/bancs/_porte-banc.cjs scripts/bancs/comptes-vinted.cjs
//        BANC_CAPTURE=<dossier> : captures 390 tactile / 1512, clair et sombre
// ═══════════════════════════════════════════════════════════════════════════
// Base INVENTÉE (dépôt public), horloge au vendredi 13 novembre 2026, 15 h :
//   · atelier_sneak (111) : 5 ventes en novembre (60, 70, 50, 40, 80 €), mises en ligne
//     2, 4, 6, 8, 10 jours avant ⇒ 30 j : 5 ventes · 6 j (médiane) · 60,00 € ; une vente
//     d'août (90 €) ⇒ Année : 6 ventes · 65,00 € ; 30 j et 90 j : 5 ;
//     5 offres reçues lues à jour (3 acceptées) ⇒ 60 % ;
//   · paris_kicks (222) : 2 ventes (50, 30 €) sans date de mise en ligne ⇒ prix « — »
//     (moins de 3), jours « — » ; conversations lues jusqu'au 29 oct. ⇒ offres « — » ;
//   · compte_cache (333) : MASQUÉ par lui (`vinted_accounts_hidden`) — 3 ventes, jamais montré ;
//   · aucune couleur dans le tableau ; un compte = une ligne ; cibles ≥ 44 px.
// Second temps, horloge au mardi 3 novembre 2026, 12 h : 2 jours lus seulement ⇒ la
// prévision porte le rythme des 4 dernières semaines (`data-prev-mode="lisse"`), le plancher
// = le déjà-vendu ; sur origin/main la carte dit « pas encore su ».
// Jugé sur des `data-*` et des nombres, jamais sur un libellé (§6.4).
const path=require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=process.env.BANC_DIST||path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4641;
const CAPT=process.env.BANC_CAPTURE||'';

const D=(y,m,j,h=12)=>new Date(y,m-1,j,h,0,0);
const iso=(d)=>d.toISOString();
const sec=(d)=>Math.floor(d.getTime()/1000);
const FIN='Commande finalisée';
const accounts=(t)=>[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(t), created_at:iso(D(2025,1,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(t), created_at:iso(D(2025,1,1)), owner:null },
  { id:3, vinted_user_id:'333', login:'compte_cache', domain:'www.vinted.fr', updated_at:iso(t), created_at:iso(D(2025,1,1)), owner:null },
];
// [compte, tx, prix, date de vente, titre, jours en ligne avant la vente (ou null)]
const VENTES_13=[
  ['111','95001',60,D(2026,11,2,10),'Nike Air Max 90 taille 42',2],
  ['111','95002',70,D(2026,11,4,10),'Nike Air Max 90 taille 42',4],
  ['111','95003',50,D(2026,11,6,10),'Nike Air Max 90 taille 42',6],
  ['111','95004',40,D(2026,11,9,10),'Nike Air Max 90 taille 42',8],
  ['111','95005',80,D(2026,11,12,10),'Nike Air Max 90 taille 42',10],
  ['111','95006',90,D(2026,8,1,10),'Adidas Samba taille 41',null],
  ['222','95007',50,D(2026,10,20,10),'Nike Air Max 90 taille 42',null],
  ['222','95008',30,D(2026,11,5,10),'Nike Air Max 90 taille 42',null],
  ['333','95009',100,D(2026,11,3,10),'Nike Air Max 90 taille 42',3],
  ['333','95010',100,D(2026,11,7,10),'Nike Air Max 90 taille 42',3],
  ['333','95011',100,D(2026,11,8,10),'Nike Air Max 90 taille 42',3],
];
// Le 3 novembre : 100 € par jour du 1er au 31 octobre (compte 111), puis 2 ventes en novembre.
const VENTES_3=[];
for(let j=1;j<=31;j++) VENTES_3.push(['111',String(96000+j),100,D(2026,10,j,10),'Nike Dunk Low taille 42',null]);
VENTES_3.push(['111','96101',100,D(2026,11,1,10),'Nike Dunk Low taille 42',null],['111','96102',100,D(2026,11,2,10),'Nike Dunk Low taille 42',null]);

const offre=(i,st,ts)=>({ id:i, entity_type:'offer_request_message', created_at_ts:iso(ts), entity:{ offer_request_id:i, user_id:9001, status:st, price:{amount:'40'}, original_price:{amount:'50'} } });
function base(MAINTENANT, VENTES){
  const rows=[];
  for(const a of accounts(MAINTENANT)){
    const uid=a.vinted_user_id; const vs=VENTES.filter(v=>v[0]===uid);
    rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(MAINTENANT), payload:{ my_orders:vs.map(v=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:v[4], price:{amount:String(v[2]),currency_code:'EUR'}, status:FIN, date:iso(v[3]) })) } } });
    rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(MAINTENANT.getTime()-60000)), payload:{ items:vs.filter(v=>v[5]!=null).map(v=>({ id:Number(v[1])+500000, title:v[4], price:{amount:String(v[2]),currency_code:'EUR'}, created_at_ts:sec(new Date(v[3].getTime()-v[5]*86400000)), is_closed:true, promoted:false })) } } });
  }
  for(const v of VENTES) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(MAINTENANT), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:FIN, status_updated_at:iso(v[3]), buyer:{ country_code:'FR' } } } } });
  // Offres : 111 lu à jour (3 acceptées, 1 refusée, 1 en attente) ; 222 lu jusqu'au 29 oct.
  rows.push({ id:'harvest_111_conv_1', data:{ capturedAt:iso(MAINTENANT), payload:{ conversation:{ id:1, opposite_user:{ id:9001 }, transaction:{ current_user_side:'seller' },
    messages:[offre(1,20,D(2026,11,2)),offre(2,20,D(2026,11,4)),offre(3,20,D(2026,11,6)),offre(4,30,D(2026,11,8)),offre(5,10,D(2026,11,10))] } } } });
  rows.push({ id:'harvest_222_conv_2', data:{ capturedAt:iso(D(2026,10,29)), payload:{ conversation:{ id:2, opposite_user:{ id:9001 }, transaction:{ current_user_side:'seller' },
    messages:[offre(6,20,D(2026,10,22)),offre(7,20,D(2026,10,24)),offre(8,30,D(2026,10,26))] } } } });
  rows.push({ id:'vinted_listing_dates', data:{} });
  rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
  rows.push({ id:'ebay_orders', data:{ orders:[] } });
  return rows;
}

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
async function page(b, T, opts){
  const ctx=await b.newContext({viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch, colorScheme: opts.sombre ? 'dark' : 'light'});
  const pg=await ctx.newPage();
  await pg.clock.setFixedTime(opts.maintenant);
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript((sombre)=>{try{localStorage.setItem('vrm_acces_direct','1'); localStorage.setItem('vinted_accounts_hidden','["333"]'); if(sombre) localStorage.setItem('vinted_dark','true');}catch(_){}}, !!opts.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  const rows=opts.rows, acc=accounts(opts.maintenant);
  await pg.route('**/rest/v1/**',route=>{
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
    if(/select=owner/.test(u)) return j([{ owner: '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(acc);
    const ou=/[?&]or=\(([^)]*)\)/.exec(u);
    if(ou){ const conds=ou[1].split(',').map(c=>{ const m=/^id\.(eq|like)\.(.+)$/.exec(c); return m?(m[1]==='eq'?(id)=>id===m[2]:(id)=>new RegExp('^'+m[2].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$').test(id)):()=>false; });
      return j(rows.filter(r=>conds.some(f=>f(r.id))).map(r=>projette(r,S))); }
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:{}},S)]);
    if(eq) return j(rows.filter(r=>r.id===eq[1]).map(r=>projette(r,S)));
    const lk=/id=like\.([^&]*)/.exec(u); if(lk){ const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$');
      return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S))); }
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
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_stats_ventes')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(600);
};
const captureEl=async(pg,sel,nom)=>{ if(!CAPT) return; fs.mkdirSync(CAPT,{recursive:true}); const el=pg.locator(sel).first(); await el.scrollIntoViewIfNeeded().catch(()=>{}); await pg.waitForTimeout(400); await el.screenshot({ path:path.join(CAPT,nom+'.png') }).catch(e=>console.log('   (capture '+nom+' : '+e.message.slice(0,80)+')')); };
const CARTE='[data-sv-carte="comptes-vinted"]';
const lireTableau=(pg)=>pg.evaluate((sel)=>{ const c=document.querySelector(sel); if(!c) return null;
  const lignes=[...c.querySelectorAll('[data-cv-compte]')].map((r)=>({ uid:r.getAttribute('data-cv-compte'), n:r.getAttribute('data-cv-n'), prix:r.getAttribute('data-cv-prix'), delai:r.getAttribute('data-cv-delai'), dr:r.getAttribute('data-cv-delai-raison'), offres:r.getAttribute('data-cv-offres'), or:r.getAttribute('data-cv-offres-raison'), h:r.getBoundingClientRect().height }));
  const couleurs=[...c.querySelectorAll('th,td')].map((e)=>getComputedStyle(e).color);
  const deb=c.scrollWidth>c.clientWidth+1 || document.documentElement.scrollWidth>window.innerWidth+1;
  const choix=[...c.querySelectorAll('[data-cv-choix]')].map((b)=>b.getBoundingClientRect().height);
  return { periode:c.getAttribute('data-cv-periode'), etat:(c.querySelector('[data-cv-etat]')||{}).getAttribute?.('data-cv-etat'), lignes, couleurs:[...new Set(couleurs)], deb, choix, notes:[...c.querySelectorAll('[data-cv-note]')].map((n)=>n.getAttribute('data-cv-note')) };
},CARTE);
const attendreLu=(pg)=>pg.waitForFunction((sel)=>{ const c=document.querySelector(sel); return c && c.querySelector('[data-cv-etat="lu"]') && c.querySelector('[data-cv-compte="111"][data-cv-offres-raison]')===null; },CARTE,{timeout:20000}).catch(()=>{});

(async()=>{
  const b=await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server'] });
  try{
    for(const T of TAILLES) for(const sombre of [false,true]){
      const suf=`${T.nom}-${sombre?'sombre':'clair'}`;
      console.log(`\n── A. Tes comptes Vinted · ${suf}`);
      const M13=D(2026,11,13,15);
      const { ctx, pg, errs }=await page(b,T,{ sombre, maintenant:M13, rows:base(M13,VENTES_13) });
      await essaie('A '+suf, async()=>{
        await publier(pg);
        await aller(pg,'dashboard',CARTE,2500);
        await pg.locator(CARTE).first().scrollIntoViewIfNeeded().catch(()=>{});
        await attendreLu(pg);
        let r=await lireTableau(pg);
        dit(!!r, 'A1 la carte « Tes comptes Vinted » est rendue', r?'':'absente');
        if(!r) return;
        if(r.periode!=='j30'){ await pg.click(`${CARTE} [data-cv-choix="j30"]`).catch(()=>{}); await pg.waitForTimeout(400); r=await lireTableau(pg); }
        const L=(u)=>r.lignes.find((l)=>l.uid===u)||{};
        dit(r.periode==='j30' && r.lignes.map((l)=>l.uid).join(',')==='111,222', 'A2 30 j : un compte = une ligne, le compte masqué absent', r.lignes.map((l)=>l.uid).join(','));
        dit(L('111').n==='5' && L('111').prix==='6000' && L('111').delai==='6', 'A3 atelier_sneak : 5 ventes · 6 j (médiane) · 60,00 €', JSON.stringify(L('111')));
        dit(L('111').offres==='60', 'A4 atelier_sneak : 3 offres acceptées sur 5 ⇒ 60 %', L('111').offres+' '+(L('111').or||''));
        dit(L('222').n==='2' && L('222').prix==='' && L('222').delai==='' && L('222').dr==='sansdate', 'A5 paris_kicks : 2 ventes, prix « — » (moins de 3), jours « — » (pas de date)', JSON.stringify(L('222')));
        dit(L('222').offres==='' && L('222').or==='partiel' && r.notes.includes('offres'), 'A6 paris_kicks : offres « — », lues jusqu’au 29 oct. (dit)', L('222').or);
        // « Aucune couleur » : chaque texte du tableau est NEUTRE (gris ou encre, r ≈ g ≈ b), jamais teinté.
        const neutre=(c)=>{ const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c); if(!m) return false; const v=[+m[1],+m[2],+m[3]]; return Math.max(...v)-Math.min(...v)<=10; };
        dit(r.couleurs.length>0 && r.couleurs.every(neutre), 'A7 aucune couleur dans le tableau (encre ou gris seulement)', r.couleurs.join(' | '));
        dit(!r.deb, 'A8 aucun débordement horizontal');
        dit(r.choix.length===3 && r.choix.every((h)=>h>=(T.hasTouch?43.5:32)), `A9 trois choix de période, cibles ≥ ${T.hasTouch?44:32} px`, r.choix.join(','));
        dit(errs.length===0, 'A10 aucune erreur de page', errs.slice(0,2).join(' | '));
        await captureEl(pg,CARTE,`comptes-vinted-30j-${suf}`);
        await pg.click(`${CARTE} [data-cv-choix="annee"]`); await pg.waitForTimeout(500);
        const ra=await lireTableau(pg); const La=ra.lignes.find((l)=>l.uid==='111')||{};
        dit(ra.periode==='annee' && La.n==='6' && La.prix==='6500', 'A11 Année : la vente d’août entre (6 ventes · 65,00 €)', JSON.stringify(La));
        await pg.click(`${CARTE} [data-cv-choix="j90"]`); await pg.waitForTimeout(500);
        const r9=await lireTableau(pg); const L9=r9.lignes.find((l)=>l.uid==='111')||{};
        dit(r9.periode==='j90' && L9.n==='5', 'A12 90 j : la vente d’août reste dehors', JSON.stringify(L9));
        if(!sombre && T.nom==='390') await captureEl(pg,CARTE,`comptes-vinted-90j-${suf}`);
        // Le choix de période est une commodité de l'appareil : rechargé, il reste.
        await aller(pg,'dashboard',CARTE,2000);
        const rr=await lireTableau(pg);
        dit(rr && rr.periode==='j90', 'A13 le choix de période reste sur cet appareil', rr&&rr.periode);
        await pg.click(`${CARTE} [data-cv-choix="j30"]`).catch(()=>{});
      });
      await ctx.close();

      console.log(`\n── B. Prévision en début de mois · ${suf}`);
      const M3=D(2026,11,3,12);
      const P=await page(b,T,{ sombre, maintenant:M3, rows:base(M3,VENTES_3) });
      await essaie('B '+suf, async()=>{
        await aller(P.pg,'dashboard','[data-argent-plus="prevision"]',2500);
        await P.pg.waitForFunction(()=>{ const e=document.querySelector('[data-argent-plus="prevision"]'); return e && /^(ok|tot)$/.test(e.getAttribute('data-prev-etat')||''); },null,{timeout:20000}).catch(()=>{});
        const p=await P.pg.evaluate(()=>{ const c=document.querySelector('[data-argent-plus="prevision"]'); return c && { etat:c.getAttribute('data-prev-etat'), mode:c.getAttribute('data-prev-mode'), centre:Number(c.getAttribute('data-prev-centre')), bas:Number(c.getAttribute('data-prev-bas')), cumul:Number(c.getAttribute('data-prev-cumul')), note:!!c.querySelector('.vrm-ap-note') }; });
        dit(p && p.etat==='ok' && p.mode==='lisse', 'B1 le 3 novembre : une prévision au rythme des 4 dernières semaines', JSON.stringify(p));
        dit(p && p.centre>=280000 && p.centre<=300000 && p.bas>=p.cumul && p.cumul===20000, 'B2 vers 2 800–3 000 € ; le bas jamais sous les 200 € déjà vendus', p&&`${p.centre} ${p.bas} ${p.cumul}`);
        dit(p && p.note, 'B3 la carte est marquée « estimation »');
        dit(P.errs.length===0, 'B4 aucune erreur de page', P.errs.slice(0,2).join(' | '));
        await captureEl(P.pg,'[data-argent-plus="prevision"]',`prevision-lisse-${suf}`);
        await aller(P.pg,'journee','[data-argent-plus="prevision-ligne"]',2500);
        const l=await P.pg.evaluate(()=>{ const c=document.querySelector('[data-argent-plus="prevision-ligne"]'); return c && { mode:c.getAttribute('data-prev-mode'), est:!!c.querySelector('[data-prev-estimation]') }; });
        dit(l && l.mode==='lisse' && l.est, 'B5 Ma journée : la ligne paraît dès le 3 et dit « estimation »', JSON.stringify(l));
        await captureEl(P.pg,'[data-argent-plus="prevision-ligne"]',`journee-ligne-lisse-${suf}`);
      });
      await P.ctx.close();
    }
  } finally { await b.close(); srv.close(); }
  console.log(`\n${ko?'❌':'✅'} banc comptes-vinted : ${ok} verts, ${ko} rouge(s)`);
  process.exit(ko?1:0);
})();
