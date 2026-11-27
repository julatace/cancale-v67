// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE VRAI BÉNÉFICE — par paire, par mois, par compte (27 novembre, lot vrai-benefice)
//        npm run build && node scripts/bancs/vrai-benefice.cjs   (BANC_CAPTURE=dossier pour les captures ;
//        BANC_DIST=dossier pour un autre build — l'arbre d'avant, une mutation ; BANC_MODES=0,2 pour certaines tailles)
// ═══════════════════════════════════════════════════════════════════════════
// Sur une base INVENTÉE (le dépôt est public), à 1512 et 390 px, clair ET sombre :
//   V1 L'ÉCRAN = L'EXPORT : Statistiques › Gains › « Par mois », le dernier mois bouclé et celui d'avant : le bénéfice,
//      le nombre de ventes et la couverture = ceux de « Pour mon comptable » (Argent › Déclarer) pour la même période.
//   V2 La règle : N°13 (91001) 48,50 − achat 30 − boost 2, frais confirmés, prix du reçu = 16,50 ; N°12 (91002)
//      61 − achat 20 − port payé par lui 3 = 38,00, frais PAS confirmés ⇒ « au plus » ; le mois = 54,50 sur 2 des 4.
//   V3 Un prix d'achat inconnu n'est JAMAIS 0 : 91003 (sans achat) n'entre pas dans la somme, il est NOMMÉ ; le mois
//      d'avant (91010 seule, sans achat) dit « — », jamais « 0 € ».
//   V4 La vente pas versée (91004) est « à dater », dans aucun mois.
//   V5 « Le compte qui vend le mieux » (Par compte) : atelier_sneak d'abord (+54,50 €, 2 ventes), paris_kicks « — »
//      (aucun achat connu) ; le compte EXCLU (compte_exclu, 91007 — fiche N°14 au prix connu) n'est nulle part.
//   V6 Par paire (la fiche de la vente, Ventes) : 91001 « port de l'achat compris (reçu) », 91002 sans.
// Sur le code d'avant : ni « Par mois », ni total par compte (rouge).
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const DIST=process.env.BANC_DIST?path.resolve(process.env.BANC_DIST):path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4631;
const CAP=process.env.BANC_CAPTURE||'';
const maintenant=new Date();
const ilYa=(m,j,h=12)=>new Date(maintenant.getFullYear(),maintenant.getMonth()-m,j,h);
const iso=(d)=>d.toISOString();
const ym=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const YM1=ym(ilYa(1,1)), YM2=ym(ilYa(2,1));
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
  { id:3, vinted_user_id:'333', login:'compte_exclu', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
];
// [compte, tx, prix, date de vente, date de versement]
const VENTES=[
  ['111','91001',48.5,ilYa(2,20),ilYa(1,5)],    // N°13 : achat 30 (reçu), boost 2, frais confirmés ⇒ 16,50
  ['111','91002',61,  ilYa(1,3),ilYa(1,8)],     // N°12 : achat 20, port payé par lui 3, frais pas confirmés ⇒ au plus 38,00
  ['222','91003',39.9,ilYa(1,4),ilYa(1,10)],    // sans prix d'achat
  ['222','91004',72.4,ilYa(1,6),null],          // pas versée : à dater
  ['222','91009',33,  ilYa(2,25),ilYa(1,2)],    // vendue le mois d'avant, versée le mois bouclé
  ['222','91010',25,  ilYa(2,5),ilYa(2,9)],     // seule du mois d'avant, sans prix d'achat
  ['333','91007',99.99,ilYa(1,9),ilYa(1,10)],   // compte EXCLU
];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), item_id:Number(v[1])+500000, title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:'Commande finalisée', date:iso(v[3]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
  rows.push({ id:`harvest_${uid}_orders_purchased`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:[] } } });
}
for(const v of VENTES) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:v[4]?450:400, status_title:v[4]?'Commande finalisée':'Commande en cours', status_updated_at:iso(v[4]||v[3]) } } } });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });
// Les fiches (clé = l'item_id de la vente).
const FICHES={
  '591001':{ numero:'13', title:'Baskets inventées 91001', buyPrice:'30', buyPriceSource:'recu', buyPriceRecuTx:'7100009', fees:'2', fraisComplets:true },
  '591002':{ numero:'12', title:'Baskets inventées 91002', buyPrice:'20', transportVendeur:'3' },
  '591007':{ numero:'14', title:'Baskets inventées 91007', buyPrice:'10', fraisComplets:true },
};

function projette(row,select){
  if(!select||select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){ const reste=src.replace(/^data(->>|->)/,''); let v=row.data;
      for(const seg of reste.split(/->>|->/)) v=(v==null?null:v[seg]); out[alias]=(v==null)?null:(/->>[^>]*$/.test(src)&&typeof v==='object'?JSON.stringify(v):v); continue; }
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

let ko=0, ok=0; const dit=(c,m,d)=>{ if(c) ok++; else ko++; console.log((c?'  ✅ ':'  ❌ ')+m+(d?' — '+d:'')); };
async function page(b, T, opts={}){
  const ctx=await b.newContext({viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch, colorScheme:T.sombre?'dark':'light'});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{ localStorage.setItem('vrm_acces_direct','1'); localStorage.setItem('vrm_design_v2','1'); localStorage.setItem('vrm_stats_seg','gains'); localStorage.setItem('vrm_stats_fenetre','90'); if(!localStorage.getItem('vrm_stats_gains_vue')) localStorage.setItem('vrm_stats_gains_vue','mois'); }catch(_){}});
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  await pg.route('**/rest/v1/**',route=>{
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET'){
      try{ const corps=JSON.parse(route.request().postData()||'null'); for(const x of [].concat(corps||[])) if(x&&x.id==='main'&&x.data&&typeof x.data==='object') opts.main=x.data; }catch(_){}
      return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}); }
    if(/select=owner/.test(u)) return j([{ owner: process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:opts.main||{}},S)]);
    if(eq) return j(rows.filter(r=>r.id===eq[1]).map(r=>projette(r,S)));
    const inn=/id=in\.\(([^)]*)\)/.exec(u); if(inn){ const ids=inn[1].split(','); return j(rows.filter(r=>ids.includes(r.id)).map(r=>projette(r,S))); }
    const lk=/id=like\.([^&]*)/.exec(u); if(lk){ const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$'); return j(rows.filter(r=>re.test(r.id)).map(r=>projette(r,S))); }
    return j([]);
  });
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  return { ctx, pg, errs };
}
const aller=async(pg,tab,repere,ms=1500)=>{
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`,{waitUntil:'domcontentloaded'});
  if(repere) await pg.waitForFunction((r)=>document.querySelector(r)||/pas pu s'afficher/.test(document.body.innerText),repere,{timeout:20000}).catch(()=>{});
  await pg.waitForTimeout(ms);
};
const publier=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ const r=JSON.parse(localStorage.getItem('vrm_stats_ventes')||'null'); return !!JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null')&&r&&Array.isArray(r.l)&&r.l.length>0; }catch(_){ return false; } },null,{timeout:30000}).catch(()=>{});
  await pg.waitForTimeout(800);
};
const MODES=[
  { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true },
  { nom:'1512 clair', vp:{width:1512,height:950}, sombre:false },
  { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false },
  { nom:'390 sombre', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:true },
];
const MAIN0={ vinted_regime:'micro', vinted_accounts_hidden:['333'], vinted_annonce_numeros:FICHES };
// L'export de la période (Argent › Déclarer › « Pour mon comptable ») : bénéfice (centimes), sa couverture, ses ventes.
const exportDe=async(pg,periode)=>{
  const deja=await pg.locator('[data-export-choix]').count();
  if(!deja){
    await pg.waitForSelector('[data-export-comptable]',{timeout:15000}).catch(()=>{});
    await pg.locator('[data-export-comptable]').scrollIntoViewIfNeeded().catch(()=>{});
    await pg.click('[data-export-preparer]').catch(()=>{});
    await pg.waitForSelector('[data-export-choix]',{timeout:15000}).catch(()=>{});
  }
  await pg.selectOption('[data-export-choix]',periode).catch(()=>{});
  await pg.waitForFunction((p)=>{ const e=document.querySelector('[data-export-periode]'); return e&&e.getAttribute('data-export-etat')==='lu'&&e.getAttribute('data-export-periode')===p; },periode,{timeout:25000}).catch(()=>{});
  return pg.evaluate(()=>{ const e=document.querySelector('[data-export-periode]'); return e?{ periode:e.getAttribute('data-export-periode'), benefice:e.getAttribute('data-export-benefice'), nBenef:e.getAttribute('data-export-benefice-n'), n:e.getAttribute('data-export-ventes-n'), adater:e.getAttribute('data-export-adater') }:null; });
};
const ecran=(pg)=>pg.evaluate(()=>{
  const m={}; for(const e of document.querySelectorAll('[data-vb-mois]')) m[e.getAttribute('data-vb-mois')]={ net:e.getAttribute('data-vb-net'), n:e.getAttribute('data-vb-n'), nNet:e.getAttribute('data-vb-nnet'), sansAchat:e.getAttribute('data-vb-sansachat'), auPlus:e.getAttribute('data-vb-auplus'), texte:e.innerText.replace(/[\u00a0\u202f]/g,' ').replace(/\n/g,' | ') };
  const c={}; for(const e of document.querySelectorAll('[data-vb-compte]')) c[e.getAttribute('data-vb-compte')]={ net:e.getAttribute('data-vb-net'), n:e.getAttribute('data-vb-n'), nNet:e.getAttribute('data-vb-nnet'), texte:e.innerText.replace(/[\u00a0\u202f]/g,' ').replace(/\n/g,' | ') };
  const ad=document.querySelector('[data-vb-adater]');
  const ordre=(document.querySelector('[data-vb-comptes]')||{getAttribute:()=>null}).getAttribute('data-vb-comptes');
  return { mois:m, comptes:c, ordre, adater:ad?ad.getAttribute('data-vb-adater'):null, carte:(document.querySelector('[data-ps-bloc="gains"]')||{innerText:''}).innerText.replace(/[\u00a0\u202f]/g,' ') };
});
const vue=async(pg,cle)=>{
  const r=pg.locator('[data-ps-bloc="gains"] [role="radio"]',{ hasText:{ mois:'Par mois', compte:'Par compte' }[cle] }).first();
  if(await r.count()){ await r.click(); await pg.waitForTimeout(500); return true; }
  return false;
};

(async()=>{
  let b;
  try{
    if(CAP) fs.mkdirSync(CAP,{recursive:true});
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    const seuls=String(process.env.BANC_MODES||'').split(',').filter(Boolean).map(Number);
    for(const [iT,T] of MODES.entries()){
      if(seuls.length&&!seuls.includes(iT)) continue;
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      const nomCap=T.nom.replace(' ','-');
      try{
        const { ctx, pg, errs }=await page(b,T,{ main:{ ...MAIN0, vinted_dark:!!T.sombre } });
        await publier(pg);
        // ── L'EXPORT (Argent › Déclarer › « Pour mon comptable »), les deux mois ──
        await aller(pg,'compta','[data-benef-etat]',1500);
        await ouvrirAvanceCompta(pg).catch(()=>{});
        // Le design natif : Argent › « Déclarer » (le segment, comme Julien).
        const decl=pg.locator('button[data-section="declarer"]').first();
        if(await decl.count()){ await decl.click().catch(()=>{}); await pg.waitForTimeout(800); }
        const E1=await exportDe(pg,YM1), E2=await exportDe(pg,YM2);
        console.log('   export',JSON.stringify({ E1, E2 }));
        // ── L'ÉCRAN (Statistiques › Gains › Par mois) ──
        await aller(pg,'dashboard','[data-ps-bloc="gains"]',1200);
        await vue(pg,'mois');
        await pg.waitForSelector('[data-vb-mois]',{timeout:15000}).catch(()=>{});
        const S=await ecran(pg);
        const M1=S.mois[YM1]||null, M2=S.mois[YM2]||null;
        console.log('   écran',JSON.stringify({ M1, M2, adater:S.adater }));
        dit(!!M1&&!!E1&&M1.net===E1.benefice&&M1.net!=='','V1 · '+YM1+' : le bénéfice de l’écran = celui de l’export',`${M1&&M1.net} / ${E1&&E1.benefice}`);
        dit(!!M1&&!!E1&&M1.n===E1.n&&M1.nNet===E1.nBenef,'V1 · '+YM1+' : mêmes ventes, même couverture que l’export',`${M1&&M1.nNet}/${M1&&M1.n} · ${E1&&E1.nBenef}/${E1&&E1.n}`);
        dit(!!M2&&!!E2&&M2.net===E2.benefice&&M2.n===E2.n,'V1 · '+YM2+' : l’écran = l’export (« — » des deux côtés)',`${M2&&M2.net}·${M2&&M2.n} / ${E2&&E2.benefice}·${E2&&E2.n}`);
        dit(!!M1&&M1.net==='5450'&&M1.nNet==='2'&&M1.n==='4','V2 · '+YM1+' : 16,50 (91001) + 38,00 (91002) = 54,50 € sur 2 des 4 ventes',M1&&`${M1.net} ${M1.nNet}/${M1.n}`);
        dit(!!M1&&M1.auPlus==='1'&&/au plus/.test(M1.texte),'V2 · frais pas confirmés (91002) ⇒ « au plus », nommé',M1&&M1.texte);
        dit(!!M1&&M1.sansAchat==='2'&&/2 sans prix d’achat/.test(M1.texte),'V3 · les ventes sans prix d’achat ne sont pas comptées à 0, elles sont nommées',M1&&M1.texte);
        dit(!!M2&&M2.net===''&&/—/.test(M2.texte)&&!/0,00|\+0 €|0 €/.test(M2.texte),'V3 · '+YM2+' : seule vente sans achat ⇒ « — », jamais 0',M2&&M2.texte);
        dit(S.adater==='1','V4 · 91004 pas versée : « à dater », dans aucun mois',S.adater);
        dit(!/compte_exclu|91007/.test(S.carte),'V5 · le compte exclu n’est pas dans « Par mois »');
        const Tg=await pg.evaluate(()=>{ const t=document.querySelector('[data-gr-tuiles] [data-gr-net]'); return t?{ net:t.getAttribute('data-gr-net'), auPlus:t.getAttribute('data-gr-auplus'), texte:t.innerText.replace(/[\u00a0\u202f]/g,' ').replace(/\n/g,' | ') }:null; });
        dit(!!Tg&&Tg.auPlus==='1'&&/au plus/.test(Tg.texte),'V2 · la tuile « Gagné » dit aussi « au plus » (91002 aux frais pas confirmés)',Tg&&Tg.texte);
        const coupes=await pg.evaluate(()=>[...document.querySelectorAll('[data-ps-bloc="gains"] [role="radio"] .n-segmente-libelle')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent));
        // Le nom LU de chaque vue (le texte hors aria-hidden) : « Par … », même quand le téléphone montre le mot court.
        const noms=await pg.evaluate(()=>[...document.querySelectorAll('[data-ps-bloc="gains"] [role="radio"]')].map(e=>{ const c=e.cloneNode(true); c.querySelectorAll('[aria-hidden="true"]').forEach(x=>x.remove()); return c.textContent.trim(); }));
        dit(coupes.length===0&&noms.length===5&&noms.every(n=>/^Par /.test(n)),'les cinq vues se lisent en entier (« Par … » reste le nom lu)',`${noms.join(' · ')}${coupes.length?' — coupées : '+coupes.join(', '):''}`);
        if(CAP){ await pg.locator('[data-ps-bloc="gains"]').screenshot({path:path.join(CAP,`vb-mois-${nomCap}.png`)}).catch(()=>{}); }
        // ── PAR COMPTE ──
        await vue(pg,'compte');
        await pg.waitForSelector('[data-vb-compte]',{timeout:10000}).catch(()=>{});
        const C=await ecran(pg);
        const A=C.comptes['Vinted|atelier_sneak'], P=C.comptes['Vinted|paris_kicks'];
        console.log('   comptes',JSON.stringify({ ordre:C.ordre, A, P }));
        dit(!!A&&A.net==='5450'&&A.n==='2'&&/2 ventes/.test(A.texte)&&/au total/.test(A.texte),'V5 · atelier_sneak : +54,50 € au total, 2 ventes',A&&A.texte);
        dit(!!P&&P.net===''&&P.nNet==='0'&&Number(P.n)>=3&&/—/.test(P.texte),'V5 · paris_kicks : aucun achat connu ⇒ « — », jamais 0',P&&P.texte);
        dit(C.ordre&&C.ordre.split(',')[0]==='Vinted|atelier_sneak','V5 · le compte qui vend le mieux d’abord',C.ordre);
        dit(!C.comptes['Vinted|compte_exclu']&&!/compte_exclu/.test(C.carte),'V5 · le compte exclu n’apparaît pas',C.ordre);
        if(CAP){ await pg.locator('[data-ps-bloc="gains"]').screenshot({path:path.join(CAP,`vb-comptes-${nomCap}.png`)}).catch(()=>{}); }
        const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-ps-bloc="gains"] [role="radio"]')].map(e=>Math.round(e.getBoundingClientRect().height)));
        dit(cibles.length>0&&cibles.every(h=>h>=44),'cibles ≥ 44 px (segments)',cibles.join(','));
        // ── PAR PAIRE : la fiche de la vente (Ventes › Toutes › la vente) ──
        await aller(pg,'cat_ventes',null,1500);
        await pg.locator('[role="radio"]',{hasText:'Toutes'}).first().click().catch(()=>{});
        await pg.waitForTimeout(1200);
        const portDe=async(tx)=>{
          const t=pg.getByText('Baskets inventées '+tx,{exact:true}).first();
          if(!(await t.count())) return null;
          await t.scrollIntoViewIfNeeded().catch(()=>{});
          // Un toucher qui tombe pendant un rendu peut ne rien ouvrir : un second essai, jamais plus.
          for(let essai=0; essai<2; essai++){
            await t.click().catch(()=>{});
            const vu=await pg.locator('[data-ba-ligne="achat"]').first().waitFor({state:'visible',timeout:8000}).then(()=>true,()=>false);
            if(vu) break;
          }
          const r=await pg.evaluate(()=>{ const e=[...document.querySelectorAll('[data-ba-ligne="achat"]')].pop(); return e?{ port:e.getAttribute('data-vb-port-achat'), achat:e.getAttribute('data-ba-valeur'), texte:e.innerText.replace(/[\u00a0\u202f]/g,' ').replace(/\n/g,' | '),
            total:(()=>{ const t=[...document.querySelectorAll('.vrm-ba')].pop(); return t?t.getAttribute('data-benef-article-valeur'):null; })() }:null; });
          return r;
        };
        const fermer=async()=>{ await pg.keyboard.press('Escape').catch(()=>{}); await pg.waitForTimeout(500); };
        const p1=await portDe('91001');
        dit(!!p1&&p1.port==='recu'&&/port de l’achat compris \(reçu\)/.test(p1.texte)&&p1.total==='1650','V6 · 91001 : la fiche dit « port de l’achat compris (reçu) », bénéfice 16,50 (= Par mois)',p1&&JSON.stringify(p1));
                if(CAP&&p1){ await pg.waitForTimeout(900); await pg.screenshot({path:path.join(CAP,`vb-fiche-${nomCap}.png`)}).catch(()=>{}); await pg.locator('.vrm-ba').last().screenshot({path:path.join(CAP,`vb-fiche-detail-${nomCap}.png`)}).catch(()=>{}); }
        await fermer();
        const p2=await portDe('91002');
        dit(!!p2&&p2.port==='saisi'&&!/compris \(reçu\)/.test(p2.texte)&&p2.total==='3800','V6 · 91002 (prix saisi) : rien n’est affirmé sur le port ; bénéfice au plus 38,00',p2&&JSON.stringify(p2));
        await fermer();
        const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      }catch(e){ dit(false,T.nom,String(e.message||e).slice(0,200)); }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ vrai-benefice : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ vrai-benefice : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
