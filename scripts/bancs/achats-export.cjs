// ═══════════════════════════════════════════════════════════════════════════
// BANC : ACHATS PRÊTS À CONFIRMER + « EXPORTER POUR MON COMPTABLE » — 9 novembre
//        npm run build && node scripts/bancs/achats-export.cjs   (BANC_CAPTURE=dossier pour les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Sur une base INVENTÉE (le dépôt est public), à 1512 px sombre et 390 px tactile :
//   A. (27 nov., porté à la règle du 19 nov. « 2 oui », src/prixAchatRecu.js) Le prix d'achat
//      du REÇU : la fiche reliée par SON n° de transaction à un achat dont le reçu tombe juste
//      reçoit 85,40 € SEULE (le lien gardé, source « reçu ») ; sans reçu, rien (l'article seul
//      n'est jamais « payé ») ; les 10 fiches au MÊME titre (aucun lien) : rien ; reçus
//      illisibles : rien nulle part. (« Garder / Corriger / Tout garder » sont retirés avec
//      la proposition, même décision ; l'atelier « Compléter » a son banc, completer.cjs.)
//   B. Comptabilité → « Exporter pour mon comptable » : pour le mois, le trimestre
//      et l'année, le CA déclaré = la ligne publiée par Ventes, l'URSSAF = 12,4 % de
//      ce CA (micro), les ventes = le livre des recettes de « Registres » (même
//      total), la vente sans date de versement à part, les achats sans coût
//      comptés ; le tableur (BOM, « ; », virgule) et le PDF (une page) disent les
//      mêmes chiffres ; le compte exclu n'y est pas ; jamais « encaissé » ;
//      statut pas choisi ⇒ « URSSAF non calculée ».
// Sur le code d'avant : ni « Payé sur Vinted », ni carte d'export (rouge).
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4513;
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
    // (27 nov.) Les reçus d'achat illisibles (`opts.recusKO`) : la lecture répond 503.
    if(opts.recusKO&&/email_achat/.test(u)) return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"message":"indisponible"}'});
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
const fiche=(pg,k)=>pg.evaluate((k)=>{ try{ const n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}'); return n[k]||null; }catch(_){ return null; } },k);
const lirePdf=async(octets)=>{
  const pdfjs=await import('file://'+path.join(NM,'pdfjs-dist','legacy','build','pdf.mjs'));
  const doc=await pdfjs.getDocument({data:new Uint8Array(octets),isEvalSupported:false,useSystemFonts:false,standardFontDataUrl:path.join(NM,'pdfjs-dist','standard_fonts')+'/'}).promise;
  let t=''; for(let i=1;i<=doc.numPages;i++){ const p=await doc.getPage(i); const tc=await p.getTextContent(); t+=tc.items.map(x=>x.str).join(' ')+'\n'; }
  return { pages:doc.numPages, texte:t.replace(/[\u00a0\u202f]/g,' ') };
};
const telecharge=async(pg,sel)=>{ const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}),pg.click(sel)]); const p=await dl.path(); return { nom:dl.suggestedFilename(), octets:fs.readFileSync(p) }; };
const lireExport=(pg)=>pg.evaluate(()=>{ const e=document.querySelector('[data-export-periode]'); if(!e) return null; const a={}; for(const n of e.getAttributeNames()) if(n.startsWith('data-export-')) a[n.slice(12)]=e.getAttribute(n); a.texte=e.innerText; return a; });
const attendExport=async(pg,periode)=>pg.waitForFunction((p)=>{ const e=document.querySelector('[data-export-periode]'); return e&&e.getAttribute('data-export-etat')==='lu'&&(!p||e.getAttribute('data-export-periode')===p); },periode,{timeout:25000}).catch(()=>{});
const MODES=[ { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true }, { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false } ];
const MAIN0={ vinted_regime:'micro', vrm_journee_benefice:true, vinted_accounts_hidden:['333'], vinted_annonce_numeros:FICHES };
const cts=(x)=>String(Math.round(x*100));
const r2=(x)=>Math.round(x*100)/100;
const trimestre=(d)=>`${d.getFullYear()}-T${Math.floor(d.getMonth()/3)+1}`;
const moisDuTrim=(d)=>{ const t=Math.floor(d.getMonth()/3); return [0,1,2].map(i=>`${d.getFullYear()}-${String(t*3+i+1).padStart(2,'0')}`); };

(async()=>{
  let b;
  try{
    if(CAP) fs.mkdirSync(CAP,{recursive:true});
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of MODES){
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      const nomCap=T.nom.replace(' ','-');
      // ── A. Le prix d'achat du REÇU ────────────────────────────────────────
      // (27 nov., bancs-compta) Porté à la règle du 19 nov. (décision de Julien « 2 oui »,
      // src/prixAchatRecu.js, CLAUDE.md §2.5) : le montant du REÇU d'un achat relié par identité
      // n'est plus une PROPOSITION à garder (« Garder / Corriger / Tout garder », retirés avec elle) :
      // il se POSE SEUL, une fois achats, reçus et lots lus. Ce qui reste exigé, rendu dans l'app :
      //   · N°12 (reçu juste au centime) : 85,40 €, le lien 7100001, source « reçu » ;
      //   · N°13 (pas de reçu) : rien — le prix de l'article seul n'est jamais posé comme payé ;
      //   · les 10 fiches au même titre, sans lien : rien (jamais par ressemblance) ;
      //   · reçus illisibles (lecture ratée) : rien du tout, sur aucune fiche.
      // L'atelier « Compléter » (la saisie en série d'aujourd'hui) a son banc : scripts/bancs/completer.cjs.
      for(const recusKO of [false,true]){
        const nomA=recusKO?' (reçus illisibles)':'';
        try{
          const opts={ main:{ ...MAIN0, vinted_dark:!!T.sombre }, recusKO };
          const { ctx, pg, errs }=await page(b,T,opts);
          await publier(pg);
          // Les achats et leurs reçus se lisent sur l'écran Achats (comme Julien l'ouvre).
          await aller(pg,'achats',null,500);
          if(!recusKO) await pg.waitForFunction(()=>{ try{ const n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}'); return !!(n['601001']&&String(n['601001'].buyPrice||'').trim()); }catch(_){ return false; } },null,{timeout:30000}).catch(()=>{});
          else await pg.waitForTimeout(12000);
          await pg.waitForTimeout(1500);
          const f12=await fiche(pg,'601001'), f13=await fiche(pg,'601002');
          const autres=await pg.evaluate(()=>{ try{ const n=JSON.parse(localStorage.getItem('vinted_annonce_numeros')||'{}'); return Object.entries(n).filter(([k,e])=>k.startsWith('602')&&(String(e.buyPrice||'').trim()||e.buyFromId)).length; }catch(_){ return -1; } });
          if(!recusKO){
            dit(!!f12&&f12.buyPrice==='85,40'&&f12.buyFromId==='7100001'&&f12.buyPriceSource==='recu'&&String(f12.buyPriceRecuTx)==='7100001','A · N°12 (reçu juste, relié par SON n°) : 85,40 € posé seul, le lien gardé, source « reçu »',JSON.stringify(f12&&{ p:f12.buyPrice, l:f12.buyFromId, s:f12.buyPriceSource, tx:f12.buyPriceRecuTx }));
          } else {
            dit(!!f12&&!String(f12.buyPrice||'').trim()&&f12.buyFromId==='7100001','A'+nomA+' · lecture ratée : N°12 n’a rien reçu (« pas su » n’écrit rien)',JSON.stringify(f12&&f12.buyPrice));
          }
          dit(!!f13&&!String(f13.buyPrice||'').trim()&&f13.buyFromId==='7100002','A'+nomA+' · N°13 (sans reçu) : rien posé — l’article seul (25,50 €) n’est jamais présenté comme payé',JSON.stringify(f13&&f13.buyPrice));
          dit(autres===0,'A'+nomA+' · les 10 fiches au même titre, sans lien : aucun coût ni lien (jamais par ressemblance)',String(autres));
          const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          dit(deb<=1,'A'+nomA+' · aucun débordement horizontal',`${deb}px`);
          dit(errs.length===0,'A'+nomA+' · aucune erreur d’app',errs.join(' | ').slice(0,160));
          await ctx.close();
        }catch(e){ dit(false,'A'+nomA+' · '+T.nom,String(e.message||e).slice(0,200)); }
      }

      // ── B. L'export pour le comptable ───────────────────────────────────────
      for(const regime of ['micro',null]){
        try{
          const main={ ...MAIN0, vinted_dark:!!T.sombre }; if(regime==null) delete main.vinted_regime;
          const { ctx, pg, errs }=await page(b,T,{ main });
          await publier(pg);
          const ligne=await pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null'); }catch(_){ return null; } });
          await aller(pg,'compta','[data-benef-etat]',1500);
          await ouvrirAvanceCompta(pg).catch(()=>{});
          await pg.waitForSelector('[data-export-comptable]',{timeout:15000}).catch(()=>{});
          dit(await pg.locator('[data-export-comptable]').count()===1,`B${regime?'':' (statut pas choisi)'} · Comptabilité : une carte « Exporter pour mon comptable »`);
          if(!(await pg.locator('[data-export-comptable]').count())){ await ctx.close(); continue; }
          await pg.click('[data-export-preparer]');
          await attendExport(pg,null);
          // (11 nov.) Défaut : le dernier mois BOUCLÉ — aucun geste de plus pour le cas courant.
          const E0=await lireExport(pg); const mb=new Date(maintenant.getFullYear(),maintenant.getMonth()-1,1);
          dit(!!E0&&E0.periode===ym(mb),'B · défaut : le dernier mois bouclé, sans rien choisir',E0&&E0.periode);
          const voie=await pg.getAttribute('[data-export-zip]','data-export-zip-voie').catch(()=>null);
          const libZip=await pg.locator('[data-export-zip]').innerText().catch(()=>'');
          dit((voie==='telechargement'&&/Télécharger le zip/.test(libZip))||(voie==='partage'&&/Partager le zip/.test(libZip)),'B · le bouton dit ce qui va se passer (partage ou téléchargement)',`${voie} · ${libZip}`);
          const caLigne=(yms)=>r2(((ligne&&ligne.mois)||[]).filter(m=>yms.includes(m.ym)).reduce((t,m)=>t+(Number(m.ca)||0),0));
          const yNow=String(maintenant.getFullYear()), ymNow=ym(maintenant);
          const cas=[['mois',ymNow,[ymNow]],['trimestre',trimestre(maintenant),moisDuTrim(maintenant)],['annee',yNow,Array.from({length:12},(_,i)=>`${yNow}-${String(i+1).padStart(2,'0')}`)]];
          for(const [type,periode,yms] of cas){
            await pg.click(`[data-export-type="${type}"]`); await pg.waitForTimeout(200);
            await pg.selectOption('[data-export-choix]',periode); await attendExport(pg,periode);
            const E=await lireExport(pg);
            console.log(`   ${periode}`,JSON.stringify({ ...E, texte:undefined }));
            const ca=caLigne(yms);
            dit(!!E&&E.ca===cts(ca),`B · ${periode} : CA déclaré = la ligne publiée par Ventes`,`${E&&E.ca} / ${cts(ca)}`);
            if(regime==='micro') dit(!!E&&E.urssaf===cts(Math.round(Math.round(ca*100)*12.4/100)/100),`B · ${periode} : URSSAF = 12,4 % de ce CA`,`${E&&E.urssaf}`);
            else dit(!!E&&E.urssaf===''&&/URSSAF\s*non calculée/.test(E.texte)&&/Statut pas encore choisi/.test(E.texte),`B · ${periode} : statut pas choisi ⇒ « URSSAF non calculée », et dit`,E&&E.texte.replace(/\n/g,' | ').slice(0,200));
            // Les mêmes ventes que la carte « Registres » (livre des recettes) de la même période (mois et année).
            if(type!=='trimestre'){
              await pg.selectOption('[data-registres-periode]',periode).catch(()=>{});
              await pg.waitForFunction(()=>{ const e=document.querySelector('[data-registre="recettes"]'); return e&&e.getAttribute('data-registre-etat')==='lu'; },null,{timeout:15000}).catch(()=>{});
              await pg.waitForTimeout(300);
              const R=await pg.evaluate(()=>{ const e=document.querySelector('[data-registre="recettes"]'); return e?{ n:e.getAttribute('data-registre-n'), total:e.getAttribute('data-registre-total') }:null; });
              dit(!!R&&!!E&&E['ventes-total']===R.total&&E['ventes-n']===R.n,`B · ${periode} : ventes de l’export = le livre des recettes de « Registres »`,`${E&&E['ventes-n']}·${E&&E['ventes-total']} / ${R&&R.n}·${R&&R.total}`);
            }
            if(type==='mois'){
              dit(!!E&&E['achats-n']===String(achatsDuMois.length)&&E['sans-cout']===String(achatsDuMois.length),`B · ${periode} : ${achatsDuMois.length} achats, tous « sans coût saisi » (rien deviné)`,`${E&&E['achats-n']} · ${E&&E['sans-cout']}`);
              dit(!!E&&Number(E.adater)>=1&&/à dater/.test(E.texte),`B · ${periode} : la vente sans date de versement est à part (« à dater »)`,E&&E.adater);
              // (11 nov.) LE ZIP, un clic : récap, xlsx, csv, dans UN dossier ; relu ici.
              const zip=await telecharge(pg,'[data-export-zip]');
              const { lireZipStocke }=await import('file://'+path.join(__dirname,'..','..','src','exportDonnees.js'));
              const fz=lireZipStocke(new Uint8Array(zip.octets)); const noms=fz.map(x=>x.nom);
              const dos=`VRM-comptable-${periode}/`;
              dit(zip.nom===`VRM-comptable-${periode}.zip`&&noms.length>=3&&noms.every(n=>n.startsWith(dos))&&fz.every(x=>x.crcOk),'B · zip : nommé de la période, UN dossier, CRC justes',noms.join(' , '));
              dit(noms.some(n=>/1-Recapitulatif-.*\.pdf$/.test(n))&&noms.some(n=>/2-Tableur-.*\.xlsx$/.test(n))&&noms.some(n=>/2-Tableur-.*\.csv$/.test(n)),'B · zip : récap PDF, tableur .xlsx et .csv');
              const xl=fz.find(x=>/\.xlsx$/.test(x.nom)); const parts=xl?lireZipStocke(xl.octets):[];
              const feuilles=parts.filter(x=>/^xl\/worksheets\/sheet\d+\.xml$/.test(x.nom)).map(x=>x.texte).join('\n');
              const wb=(parts.find(x=>x.nom==='xl/workbook.xml')||{}).texte||'';
              dit(/name="Recettes"/.test(wb)&&/name="À dater"/.test(wb)&&/name="Achats"/.test(wb)&&/91004/.test(feuilles)&&!/91007|compte_exclu/.test(feuilles),'B · xlsx : Recettes, À dater, Achats ; 91004 présente, compte exclu absent');
              const fin=await pg.getAttribute('[data-export-zip-fin]','data-export-zip-fin').catch(()=>null);
              dit(fin==='telecharge'||fin==='partage','B · après le clic, l’écran dit où est parti le zip',fin);
              if(CAP&&regime==='micro') fs.writeFileSync(path.join(CAP,`export-${nomCap}.zip`),zip.octets);
              await pg.click('[data-export-a-part] summary');
              const csv=await telecharge(pg,'[data-export-csv]'); const pdf=await telecharge(pg,'[data-export-pdf]');
              const t=csv.octets.toString('utf8');
              dit(csv.octets[0]===0xef&&csv.octets[1]===0xbb&&csv.octets[2]===0xbf&&csv.nom===`Export-comptable-${periode}.csv`,'B · tableur : UTF-8 avec BOM, nommé de la période',csv.nom);
              const L=t.replace(/^\ufeff/,'').split(/\r?\n/).map(l=>l.split(';'));
              const iCa=L.findIndex(r=>/^CA DÉCLARÉ PAR MOIS/.test(r[0])); const tot=L.slice(iCa).find(r=>r[0]==='Total');
              dit(!!tot&&tot[2]===(Number(E.ca)/100).toFixed(2).replace('.',','),'B · tableur : le total du CA déclaré (virgule décimale) = l’écran',tot&&tot[2]);
              dit(!/91007|7100200|compte_exclu/.test(t),'B · tableur : le compte exclu n’y est pas');
              dit(/VENTES À DATER/.test(t)&&/91004/.test(t.split('VENTES À DATER')[1]||'')&&!/91004/.test((t.split('VENTES VERSÉES')[1]||'').split('VENTES À DATER')[0]),'B · tableur : la vente 91004 dans « à dater », pas dans les ventes versées');
              const P=await lirePdf(pdf.octets);
              dit(P.texte.split('\n')[0].includes((Number(E.ca)/100).toFixed(2).replace('.',',')),'B · PDF : la 1re page porte le même CA déclaré',`${P.pages} page(s)`);
              dit(!/encaiss/i.test(t+P.texte+E.texte),'B · jamais « encaissé »');
              if(CAP&&regime==='micro'){ fs.writeFileSync(path.join(CAP,`export-${nomCap}.csv`),csv.octets); fs.writeFileSync(path.join(CAP,`export-${nomCap}.pdf`),pdf.octets); }
            }
          }
          if(CAP){ await pg.locator('[data-export-comptable]').scrollIntoViewIfNeeded(); await pg.locator('[data-export-comptable]').screenshot({path:path.join(CAP,`export-carte-${nomCap}${regime?'':'-sans-statut'}.png`)}).catch(()=>{}); }
          const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-export-comptable] button,[data-export-comptable] select')].map(e=>Math.round(e.getBoundingClientRect().height)));
          // Au doigt (tactile) : 44 px ; à la souris, le contrôle segmenté de l'app garde sa hauteur de bureau.
          dit(cibles.every(h=>h>=(T.hasTouch?44:32)),`B · cibles ≥ ${T.hasTouch?'44 px au doigt':'32 px à la souris'}`,cibles.join(','));
          const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          dit(deb<=1,'B · aucun débordement horizontal',`${deb}px`);
          dit(errs.length===0,'B · aucune erreur d’app',errs.join(' | ').slice(0,160));
          await ctx.close();
        }catch(e){ dit(false,'B · '+T.nom,String(e.message||e).slice(0,200)); }
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ achats-export : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ achats-export : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
