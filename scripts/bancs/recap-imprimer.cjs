// ═══════════════════════════════════════════════════════════════════════════
// BANC : « RÉCAP DE <MOIS> » EN UNE PAGE IMPRIMABLE — 13 novembre (point 16)
//        npm run build && BANC_PORT=… node scripts/bancs/recap-imprimer.cjs   (BANC_CAPTURE=dossier pour les captures)
// ═══════════════════════════════════════════════════════════════════════════
// La base INVENTÉE de rapport-mois.cjs (le dépôt est public ; aucune donnée réelle),
// à 1512 px sombre et 390 px tactile :
//   · Argent → Déclarer → « Récap de <mois> » : le bouton « Imprimer (1 page) » ;
//     le mois choisi = le mois dernier ;
//   · son toucher ouvre UNE fenêtre (ouverte au clic : jamais bloquée), qui appelle
//     la fenêtre d'impression du navigateur (`print`, compté) ;
//   · la page : « Récap de <mois> », le vendu = Σ des ventes inventées du mois
//     (hors compte EXCLU, jamais nommé), le reçu = Σ des versements du mois, les
//     comptes, les achats, les dépenses, le bénéfice, la section URSSAF (micro) ;
//     jamais « encaissé » ; aucun script ;
//   · imprimée par Chromium (PDF, médias « print ») : UNE page A4 ;
//   · le statut pas choisi ⇒ aucune section URSSAF ;
//   · cibles ≥ 44 px au doigt, aucun débordement, aucune erreur d'app.
// Sur le code d'avant : aucun bouton « Imprimer » (rouge).
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4519;
const CAP=process.env.BANC_CAPTURE||'';
const maintenant=new Date();
const ceMois=(j,h=12)=>{ const d=new Date(maintenant.getFullYear(),maintenant.getMonth(),Math.min(j,Math.max(1,maintenant.getDate())),h); return d>maintenant?new Date(maintenant.getTime()-3600e3):d; };
const moisPasse=(j)=>new Date(maintenant.getFullYear(),maintenant.getMonth()-1,j,12);
const ilYa=(m,j)=>new Date(maintenant.getFullYear(),maintenant.getMonth()-m,j,12);
const iso=(d)=>d.toISOString();
const ym=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
  { id:3, vinted_user_id:'333', login:'compte_exclu', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
];
// [compte, tx, prix, statut, date de vente, date de versement]
const VENTES=[
  ['111','91001',48.5,'Commande finalisée',moisPasse(27),ceMois(1,9)],
  ['111','91002',61,  'Commande finalisée',ceMois(1,10),ceMois(2,15)],
  ['222','91003',39.9,'Commande finalisée',ceMois(1,11),ceMois(2,16)],
  ['222','91004',72.4,'Commande finalisée',ceMois(1,12),null],             // à dater
  ['111','91005',55,  'Le paiement a été validé',ceMois(2,13),null],       // pas finalisée
  ['222','91006',44,  'Commande finalisée',ilYa(2,3),ilYa(2,9)],
  ['333','91007',99.99,'Commande finalisée',ceMois(1,9),ceMois(1,10)],     // compte EXCLU
  // Le mois dernier (le rapport par défaut) : six ventes de plus, deux comptes.
  ['111','91010',120,'Commande finalisée',moisPasse(3),moisPasse(6)],
  ['222','91011',85,'Commande finalisée',moisPasse(8),moisPasse(11)],
  ['111','91012',64.5,'Commande finalisée',moisPasse(14),moisPasse(17)],
  ['222','91013',150,'Commande finalisée',moisPasse(19),moisPasse(22)],
  ['111','91014',42,'Commande finalisée',moisPasse(23),moisPasse(26)],
  ['333','91015',300,'Commande finalisée',moisPasse(9),moisPasse(12)],     // compte EXCLU
];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), item_id:Number(v[1])+500000, title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) if(v[5]) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[5]) } } } });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });
// Les achats INVENTÉS : [compte, tx, prix, statut, date, titre]
const T10='Nike Dunk Low blanche taille 42 identique';
const FIN='Transaction finalisée - L’acheteur a validé la commande';
const ACHATS=[
  ['111','7100001',80,FIN,ceMois(1,9),'Nike Dunk inventée A'],
  ['111','7100002',25.5,FIN,ceMois(1,10),'Nike Dunk inventée B'],
  ['222','7100003',60,'Remboursement validé',ceMois(1,11),'Achat remboursé'],
  ['222','7100004',33,FIN,moisPasse(12),'Achat du mois passé'],
  ...Array.from({length:10},(_,i)=>['222',String(7100100+i),40,FIN,ceMois(1,8),T10]),
  ['333','7100200',18,FIN,ceMois(1,9),'Achat compte exclu'],
];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_purchased`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:ACHATS.filter(x=>x[0]===uid).map(x=>({ transaction_id:Number(x[1]), title:x[5], price:{amount:String(x[2]),currency_code:'EUR'}, status:x[3], date:iso(x[4]), conversation_id:null, transaction_user_status:'completed' })) } } });
}
// Le reçu Vinted de l'achat 7100001 (par SON n° de transaction) : 80 + 3,40 + 2,00 = 85,40.
rows.push({ id:'email_achat_banc1', data:{ subject:'Ton reçu pour la commande « Nike Dunk inventée A »', article:'Nike Dunk inventée A', prix:'85,40 €', transaction:'7100001', account:'atelier_sneak', receivedAt:iso(ceMois(1,10)),
  texte:'Merci pour ton achat\nMontant payé 85,40 €\nArticle 80,00 €\nFrais de port 3,40 €\nFrais Vinted 2,00 €\nMode de paiement Carte\nN° de transaction 7100001' } });
// Les fiches : deux reliées par SON clic (prix vidé), dix au MÊME titre sans lien, une avec son prix.
const snap=(tx)=>{ const a=ACHATS.find(x=>x[1]===tx); return { title:a[5], date:iso(a[4]), photo:'', price:a[2], devise:'EUR', seller:'', status:a[3], account:'atelier_sneak' }; };
const FICHES={
  '601001':{ numero:'12', title:'Nike Dunk inventée A', buyFromId:'7100001', buyFrom:snap('7100001'), buyPrice:'' },
  '601002':{ numero:'13', title:'Nike Dunk inventée B', buyFromId:'7100002', buyFrom:snap('7100002'), buyPrice:'' },
  ...Object.fromEntries(Array.from({length:10},(_,i)=>[String(602000+i),{ numero:String(20+i), title:T10, buyPrice:'' }])),
};
// Le mois en cours : achats lus, hors remboursé et compte exclu ; aucun ne porte encore de coût saisi.
const achatsDuMois=ACHATS.filter(a=>a[0]!=='333'&&!/rembours/i.test(a[3])&&ym(a[4])===ym(maintenant));

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
  const ctx=await b.newContext({viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch, acceptDownloads:true, colorScheme:T.sombre?'dark':'light'});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
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
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(800);
};

const MODES=[ { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true }, { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false } ];
const MAIN0={ vinted_regime:'micro', vinted_urssaf_freq:'mensuel', vrm_journee_benefice:true, vinted_accounts_hidden:['333'], vinted_annonce_numeros:FICHES };
const ymPasse=ym(moisPasse(1));
const duMois=VENTES.filter(v=>v[0]!=='333'&&ym(v[4])===ymPasse);
const venduC=duMois.reduce((s,v)=>s+Math.round(v[2]*100),0);
const recuC=VENTES.filter(v=>v[0]!=='333'&&v[5]&&ym(v[5])===ymPasse).reduce((s,v)=>s+Math.round(v[2]*100),0);
const eur=(c)=>{ const n=Math.abs(c); return String(Math.floor(n/100)).replace(/\B(?=(\d{3})+(?!\d))/g,' ')+','+String(n%100).padStart(2,'0')+' €'; };
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const libMois=(k)=>{ const [y,m]=k.split('-').map(Number); return `${MOIS[m-1]} ${y}`; };
(async()=>{
  let b;
  try{
    if(CAP) fs.mkdirSync(CAP,{recursive:true});
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of MODES){
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      for(const regime of ['micro',null]){
        try{
          const main={ ...MAIN0, vinted_dark:!!T.sombre }; if(regime==null) delete main.vinted_regime;
          const { ctx, pg, errs }=await page(b,T,{ main });
          // La fenêtre d'impression du navigateur : comptée (le banc ne l'ouvre pas pour de vrai).
          await ctx.addInitScript(()=>{ window.print=function(){ window.__vrmImprime=(window.__vrmImprime||0)+1; }; });
          await publier(pg);
          await pg.goto(`http://localhost:${PORT}/?tab=compta&section=declarer`,{waitUntil:'domcontentloaded'});
          await pg.waitForSelector('[data-recap-imprimer]',{timeout:20000}).catch(()=>{});
          const n=await pg.locator('[data-recap-imprimer]').count();
          dit(n===1,`${regime?'micro':'statut pas choisi'} · Argent → Déclarer : « Récap de <mois> » a « Imprimer »`);
          if(!n){ await ctx.close(); continue; }
          await pg.selectOption('[data-recap-mois-choix]',ymPasse).catch(()=>{});
          await pg.waitForFunction(()=>{ const x=document.querySelector('[data-recap-imprimer]'); return x&&!x.disabled; },null,{timeout:20000}).catch(()=>{});
          await pg.waitForTimeout(1200);
          await pg.locator('[data-recap-imprimer]').scrollIntoViewIfNeeded().catch(()=>{});
          if(CAP&&regime) await pg.locator('[data-recap-mois]').screenshot({path:path.join(CAP,`carte-${T.nom.replace(' ','-')}.png`)}).catch(()=>{});
          const [pop]=await Promise.all([ctx.waitForEvent('page',{timeout:30000}), pg.click('[data-recap-imprimer]')]);
          await pop.waitForSelector('[data-recap-imprimable]',{timeout:30000}).catch(()=>{});
          await pop.waitForFunction(()=>window.__vrmImprime>0,null,{timeout:5000}).catch(()=>{});
          const imprime=await pop.evaluate(()=>window.__vrmImprime||0).catch(()=>0);
          dit(imprime===1,'une fenêtre, et la fenêtre d’impression du navigateur appelée une fois',String(imprime));
          const ymPage=await pop.getAttribute('[data-recap-imprimable]','data-recap-imprimable').catch(()=>null);
          dit(ymPage===ymPasse,'le mois choisi',`${ymPage} / ${ymPasse}`);
          const t=(await pop.evaluate(()=>document.body.innerText)).replace(/[  ]/g,' ');
          const L=async(k)=>((await pop.locator(`[data-recap-l="${k}"]`).innerText().catch(()=>''))||'').replace(/[  ]/g,' ').replace(/\s+/g,' ');
          dit(t.includes(`Récap de ${libMois(ymPasse)}`),'titre « Récap de <mois> »');
          dit((await L('vendu')).includes(eur(venduC)),'vendu = Σ des ventes inventées du mois (hors compte exclu)',`${await L('vendu')} / ${eur(venduC)}`);
          dit(new RegExp(`\\b${duMois.length}\\b`).test(await L('ventes')),'ventes du mois = leur nombre',`${await L('ventes')} / ${duMois.length}`);
          dit((await L('recu')).includes(eur(recuC)),'reçu = Σ des versements du mois',`${await L('recu')} / ${eur(recuC)}`);
          dit(['achats','depenses','benefice'].every((k)=>t.includes(k==='achats'?'Achats':k==='depenses'?'Dépenses':'Bénéfice')),'achats, dépenses, bénéfice : une ligne chacun');
          dit(/atelier_sneak/.test(t)&&/paris_kicks/.test(t)&&!/compte_exclu/.test(t)&&!t.includes(eur(30000)),'par compte : les comptes vendeurs, le compte exclu jamais nommé ni compté');
          dit(regime ? /URSSAF/.test(t)&&/À déclarer/.test(t)&&/Cotisations estim/.test(t) : (await pop.locator('[data-recap-urssaf]').count())===0,regime?'micro : la section URSSAF (à déclarer, cotisations)':'statut pas choisi : aucune section URSSAF');
          dit(!/encaiss/i.test(t)&&(await pop.locator('script').count())===0,'jamais « encaissé », aucun script dans la page');
          await pop.emulateMedia({media:'print'});
          const octets=await pop.pdf({preferCSSPageSize:true});
          const pages=(octets.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
          dit(pages===1,'imprimée : UNE page A4',`${pages} page(s)`);
          if(CAP&&regime){ const fp=path.join(CAP,`recap-${T.nom.replace(' ','-')}.pdf`); fs.writeFileSync(fp,octets); try{ require('child_process').execFileSync('pdftoppm',['-png','-r','70',fp,fp.replace(/\.pdf$/,'')]); }catch(_){} }
          await pop.close().catch(()=>{});
          const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-recap-mois] button,[data-recap-mois] select')].map(e=>Math.round(e.getBoundingClientRect().height)));
          dit(cibles.length>0&&cibles.every(h=>h>=(T.hasTouch?44:32)),`cibles ≥ ${T.hasTouch?'44 px au doigt':'32 px à la souris'}`,cibles.join(','));
          const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
          dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
          await ctx.close();
        }catch(e){ dit(false,T.nom,String(e.message||e).slice(0,200)); }
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ recap-imprimer : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ recap-imprimer : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
