// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES REGISTRES (livre des recettes, registre des achats) — 3 novembre
//        npm run build && node scripts/bancs/registres.cjs   (BANC_CAPTURE=dossier pour les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Comptabilité → Documents et réglages → « Registres ». Sur des ventes et des
// achats INVENTÉS (le dépôt est public), à 1512 px et 390 px tactile, clair et
// sombre, il exige :
//   · le livre des recettes du MOIS = les ventes VERSÉES ce mois (une vendue le
//     mois d'avant et versée ce mois y est ; une finalisée sans date de
//     versement n'y est pas), le total au centime ; l'ANNÉE pareil ;
//   · le registre des achats = les achats du mois hors remboursés, au prix lu
//     (« article seul » ⇒ « au moins ») ;
//   · le PDF et le tableur téléchargés disent le MÊME nombre de lignes et le
//     MÊME total que l'écran ; jamais « encaissé » ;
//   · aucun texte d'explication sur la carte, aucun débordement, aucune erreur.
//   · (5 nov.) les ACHATS EN GROS (Achats → Fournisseurs, `vrm_fournisseurs`) :
//     UNE ligne chacun (date, fournisseur, paires, total + frais saisis), jamais
//     les parts posées sur ses paires ; une paire reliée au lot ET à un achat
//     Vinted ne prête pas sa part à l'achat Vinted (« article seul » reste) ;
//     un achat hors plateforme rattaché au fournisseur : UNE ligne, à son nom ;
//     le tableur (« Paires », « Dont frais ») et le PDF suivent.
// Sur le code d'avant : aucune carte « Registres » (rouge) ; sur la base du
// 5 nov. : aucune ligne en gros (rouge).
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));

const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4497;
const maintenant=new Date();
const ceMois=(j,h=12)=>{ const d=new Date(maintenant.getFullYear(),maintenant.getMonth(),Math.min(j,Math.max(1,maintenant.getDate())),h); return d>maintenant?new Date(maintenant.getTime()-3600e3):d; };
const moisPasse=(j)=>new Date(maintenant.getFullYear(),maintenant.getMonth()-1,j,12);
const ilYa=(m,j)=>new Date(maintenant.getFullYear(),maintenant.getMonth()-m,j,12);
const iso=(d)=>d.toISOString();
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(ilYa(5,1)), owner:null },
];
// [compte, tx, prix, statut, date de vente, date de versement]
const VENTES=[
  ['111','91001',48.5,'Commande finalisée',moisPasse(27),ceMois(1,9)],
  ['111','91002',61,  'Commande finalisée',ceMois(1,10),ceMois(2,15)],
  ['222','91003',39.9,'Commande finalisée',ceMois(1,11),ceMois(2,16)],
  ['222','91004',72.4,'Commande finalisée',ceMois(1,12),null],
  ['111','91005',55,  'Le paiement a été validé',ceMois(2,13),null],
  ['222','91006',44,  'Commande finalisée',moisPasse(3),moisPasse(9)],
];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) if(v[5]) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[5]) } } } });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
// Les achats INVENTÉS : [compte, tx, prix, statut, date]
const ACHATS=[
  ['111','71001',40,'Transaction finalisée - L’acheteur a validé la commande',ceMois(1,9)],
  ['111','71002',25.5,'Transaction finalisée - L’acheteur a validé la commande',ceMois(1,10)],
  ['222','71003',60,'Remboursement validé',ceMois(1,11)],
  ['222','71004',33,'Transaction finalisée - L’acheteur a validé la commande',moisPasse(12)],
];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_purchased`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:ACHATS.filter(x=>x[0]===uid).map(x=>({ transaction_id:Number(x[1]), title:'Achat inventé '+x[1], price:{amount:String(x[2]),currency_code:'EUR'}, status:x[3], date:iso(x[4]), conversation_id:null, transaction_user_status:'completed' })) } } });
}
rows.push({ id:'ebay_orders', data:{ orders:[] } });
const OV_PARTIEL={ '91002':{ buyPrice:'20', fees:'2' }, '91003':{ buyPrice:'15' } };
const OV_COMPLET={ ...OV_PARTIEL, '91004':{ buyPrice:'30' } };
const jourIso=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// (5 nov.) Les achats EN GROS, inventés : un grossiste, deux achats (ce mois :
// 300 € + 25 € de frais, 10 paires ; le mois d'avant : 50 €, 2 paires), deux
// paires reliées par SON clic (part posée 32,50 €), dont une reliée AUSSI à
// l'achat Vinted 71002 (25,50 €), et un achat hors plateforme rattaché (120 €).
const GROS_DATE=ceMois(1), GROS0_DATE=ilYa(1,15);
const FOURNISSEURS={
  personnes:{ p1:{ nom:'Grossiste inventé', tel:'', email:'', note:'' } },
  achats:{
    g1:{ fournisseur:'p1', date:`${GROS_DATE.getFullYear()}-${String(GROS_DATE.getMonth()+1).padStart(2,'0')}-${String(GROS_DATE.getDate()).padStart(2,'0')}`, paires:10, total:30000, frais:2500, repartition:{ mode:'egal', base:'frais' }, parts:{}, gardes:{}, creeLe:'' },
    g0:{ fournisseur:'p1', date:`${GROS0_DATE.getFullYear()}-${String(GROS0_DATE.getMonth()+1).padStart(2,'0')}-${String(GROS0_DATE.getDate()).padStart(2,'0')}`, paires:2, total:5000, frais:0, repartition:{ mode:'egal', base:'' }, parts:{}, gardes:{}, creeLe:'' },
  },
  hors:{ hb1:{ fournisseur:'p1', at:'' } },
};
const FICHES_GROS={
  f20:{ numero:'20', title:'Paire en gros inventée', buyGros:{ id:'g1', at:'1', part:3250 }, buyPrice:'32,50' },
  f21:{ numero:'21', title:'Paire en gros inventée bis', buyGros:{ id:'g1', at:'2', part:3250 }, buyPrice:'32,50', buyFromId:'71002' },
};
const HORS=[{ id:'hb1', title:'Paire rattachée inventée', price:'120', date:`${GROS_DATE.getFullYear()}-${String(GROS_DATE.getMonth()+1).padStart(2,'0')}-${String(GROS_DATE.getDate()).padStart(2,'0')}`, source:'Fournisseur', numero:'30' }];
// [montant, date] des lignes en gros et hors plateforme attendues.
const AUTRES_ACHATS=[[325,GROS_DATE,'gros'],[50,GROS0_DATE,'gros'],[120,GROS_DATE,'hors']];
const COMPTA={ depenses:[{ id:'d1', date:jourIso(ceMois(1)), libelle:'Cartons inventés', cat:'Emballage', montant:12.5 }], packs:[], abonnements:[], fixes:[{ id:'f1', label:'Local inventé', montant:20 }] };

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
const essaie=async(nom,f)=>{ try{ await f(); }catch(e){ dit(false,nom,String(e.message||e).slice(0,160)); } };

const TAILLES=[ { nom:'1512', vp:{width:1512,height:950}, sombre:true }, { nom:'390', vp:{width:390,height:844}, isMobile:true, hasTouch:true } ];
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
      // La ligne `main` écrite par l'app est GARDÉE (sinon un choix éteint
      // reviendrait du « nuage » au rechargement — un banc qui jette les
      // écritures mesure une fiction, §6.3).
      try{ const corps=JSON.parse(route.request().postData()||'null'); for(const x of [].concat(corps||[])) if(x&&x.id==='main'&&x.data&&typeof x.data==='object') opts.main=x.data; }catch(_){}
      return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}); }
    if(opts.ventesKO && /orders_sold|orders_\*|_orders_/.test(u)) return route.fulfill({status:522,contentType:'text/html',body:'<html>522</html>'});
    // Base CLOISONNÉE, comme en production : sinon l'app ne pousse jamais `main`
    // au nuage, et « éteint » revenait « allumé » au rechargement (§6.3).
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
  if(repere) await pg.waitForFunction((r)=>document.querySelector(r)||/pas pu s'afficher/.test(document.body.innerText),repere,{timeout:20000}).catch(()=>{});
  await pg.waitForTimeout(ms);
};
const publierBenefice=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_benefice_jours')||'null') && !!JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null'); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(800);
};

const cents=(s)=>{ if(s==null) return null; const t=String(s).replace(/[\s  ]/g,'').replace('€',''); if(t===''||t==='—'||t==='-') return ''; const n=Number(t.replace(/−/g,'-').replace(',','.').replace(/[^0-9.\-]/g,'')); return isFinite(n)?String(Math.round(n*100)):null; };
const MAIN0={ vinted_regime:'micro', vrm_journee_benefice:true, vrm_compta:COMPTA };
const ym=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
const lirePdf=async(octets)=>{
  const pdfjs=await import('file://'+path.join(NM,'pdfjs-dist','legacy','build','pdf.mjs'));
  const doc=await pdfjs.getDocument({data:new Uint8Array(octets),isEvalSupported:false,useSystemFonts:false,standardFontDataUrl:path.join(NM,'pdfjs-dist','standard_fonts')+'/'}).promise;
  const lignes=[];
  for(let i=1;i<=doc.numPages;i++){ const p=await doc.getPage(i); const tc=await p.getTextContent(); const parY=new Map();
    for(const it of tc.items){ if(!it.str||!it.str.trim()) continue; const y=Math.round(it.transform[5]); const l=parY.get(y)||[]; l.push({x:it.transform[4],s:it.str}); parY.set(y,l); }
    for(const [y,l] of [...parY].sort((a,b)=>b[0]-a[0])) lignes.push(l.sort((a,b)=>a.x-b.x).map(x=>x.s)); }
  return lignes;
};
// La valeur d'une ligne du résumé : le dernier morceau de la ligne qui commence par le libellé.
const valeurDe=(lignes,re)=>{ const l=lignes.find(x=>re.test(x[0])); return l?l[l.length-1]:null; };
const lireCsv=(t)=>t.replace(/^﻿/,'').split(/\r?\n/).map(l=>l.split(';').map(c=>c.replace(/^"|"$/g,'')));
const telecharge=async(pg,sel)=>{ const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}),pg.click(sel)]); const p=await dl.path(); return { nom:dl.suggestedFilename(), octets:fs.readFileSync(p) }; };


const csvTot=(t)=>{ const C=lireCsv(t); const i0=C.findIndex(r=>r[0]==='Date'); const iT=C.findIndex((r,i)=>i>i0&&r[0]==='Total'); const iM=i0>=0?C[i0].indexOf('Montant'):-1;
  if(i0<0||iT<0||iM<0) return null; const rows=C.slice(i0+1,iT); return { n:rows.length, total:String(Math.round(Number(C[iT][iM].replace(',','.'))*100)), somme:String(rows.reduce((s,r)=>s+(r[iM]?Math.round(Number(r[iM].replace(',','.'))*100):0),0)), titre:C[0][0] }; };
const lit=async(pg,type)=>pg.evaluate((t)=>{ const e=document.querySelector(`[data-registre="${t}"]`); return e?{ etat:e.getAttribute('data-registre-etat'), n:e.getAttribute('data-registre-n'), total:e.getAttribute('data-registre-total'), partiel:e.getAttribute('data-registre-partiel'), hors:e.getAttribute('data-registre-hors'), gros:e.getAttribute('data-registre-gros'), texte:e.innerText }:null; },type);
const attendLu=async(pg)=>pg.waitForFunction(()=>['recettes','achats'].every(t=>{ const e=document.querySelector(`[data-registre="${t}"]`); return e&&e.getAttribute('data-registre-etat')!=='encours'; }),null,{timeout:20000}).catch(()=>{});
const MODES=[ { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true }, { nom:'1512 clair', vp:{width:1512,height:950}, sombre:false },
  { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false }, { nom:'390 sombre', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:true } ];
// ATTENDU, calculé ici depuis les ventes servies : les ventes finalisées VERSÉES dans la période.
const yNow=String(maintenant.getFullYear()), ymNow=ym(maintenant);
const recettesDe=(p)=>VENTES.filter(v=>v[5]&&/finalis/i.test(v[3])&&(p.length===4?String(v[5].getFullYear())===p:ym(v[5])===p));
const dansP=(d,p)=>(p.length===4?String(d.getFullYear())===p:ym(d)===p);
const achatsDe=(p)=>[...ACHATS.filter(a=>!/rembours|annul|refus/i.test(a[3])&&dansP(a[4],p)).map(a=>[a[2],a[4]]), ...AUTRES_ACHATS.filter(a=>dansP(a[1],p))];
const grosDe=(p)=>AUTRES_ACHATS.filter(a=>a[2]==='gros'&&dansP(a[1],p)).length;
const somme=(l,i)=>String(l.reduce((s,x)=>s+Math.round(x[i]*100),0));

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of MODES){
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      try{
        const { ctx, pg, errs }=await page(b,{...T},{ main:{ ...MAIN0, vinted_dark:!!T.sombre, vinted_sale_overrides:OV_COMPLET, vrm_fournisseurs:FOURNISSEURS, vinted_annonce_numeros:FICHES_GROS, vinted_offvinted_buys:HORS } });
        await publierBenefice(pg);
        await aller(pg,'compta','[data-benef-etat]',2000);
        await ouvrirAvanceCompta(pg).catch(()=>{});
        await pg.waitForSelector('[data-registres]',{timeout:15000}).catch(()=>{});
        dit(await pg.locator('[data-registres]').count()===1,'Comptabilité → Documents et réglages : une carte « Registres »');
        if(!(await pg.locator('[data-registres]').count())){ await ctx.close(); continue; }
        await attendLu(pg);
        for(const p of [yNow, ymNow]){
          await pg.selectOption('[data-registres-periode]',p); await pg.waitForTimeout(500); await attendLu(pg);
          const R=await lit(pg,'recettes'), A=await lit(pg,'achats');
          const eR=recettesDe(p), eA=achatsDe(p);
          console.log(`   ${p} recettes`,JSON.stringify(R),'\n   achats',JSON.stringify(A));
          dit(R&&R.etat==='lu'&&R.n===String(eR.length)&&R.total===somme(eR,2),`${p} · recettes = les ventes VERSÉES dans la période`,`${R&&R.n}/${eR.length} · ${R&&R.total}/${somme(eR,2)}`);
          dit(R&&Number(R.hors)>=1,`${p} · la vente sans date de versement est à part, jamais dedans`,R&&R.hors);
          dit(A&&A.etat==='lu'&&A.n===String(eA.length)&&A.total===somme(eA,0),`${p} · achats = hors remboursés, au prix lu, + les achats en gros par leur total + le hors plateforme rattaché (rien deux fois)`,`${A&&A.n}/${eA.length} · ${A&&A.total}/${somme(eA,0)}`);
          dit(A&&A.gros===String(grosDe(p))&&(grosDe(p)?new RegExp(`dont ${grosDe(p)} achats? en gros`).test(A.texte):true),`${p} · achats en gros : ${grosDe(p)} ligne(s), dites sur la carte`,`${A&&A.gros} · ${A&&A.texte.replace(/\n/g,' | ')}`);
          dit(A&&A.partiel==='1'&&/au moins/.test(A.texte),`${p} · achats « article seul » : « au moins »`,A&&A.texte.replace(/\n/g,' | '));
          if(p===ymNow){
            for(const type of ['recettes','achats']){
              const E=type==='recettes'?R:A;
              const csv=await telecharge(pg,`[data-registre-csv="${type}"]`);
              const pdf=await telecharge(pg,`[data-registre-pdf="${type}"]`);
              // (11 nov., lot livre-registre) Les fichiers sont HORODATÉS : « …-AAAA-MM-etabli-AAAAMMJJ-HHMM ».
              dit(new RegExp(`^(Livre-des-recettes|Registre-des-achats)-${p}-etabli-\\d{8}-\\d{4}\\.csv$`).test(csv.nom)&&new RegExp(`-${p}-etabli-\\d{8}-\\d{4}\\.pdf$`).test(pdf.nom),`${type} : fichiers nommés de la période, horodatés`,`${csv.nom} · ${pdf.nom}`);
              const c=csvTot(csv.octets.toString('utf8'));
              dit(c&&c.n===Number(E.n)&&c.total===E.total&&c.somme===E.total,`${type} : le tableur = l’écran (lignes et total)`,JSON.stringify(c));
              const L=await lirePdf(pdf.octets); const t=L.map(l=>l.join(' ')).join('\n');
              const tot=valeurDe(L,/^Total$/);
              dit(cents(String(tot||'').replace(/^au moins /,''))===E.total,`${type} : le PDF dit le même total`,String(tot));
              dit(!/encaiss/i.test(t+csv.octets.toString('utf8')),`${type} : jamais « encaissé »`);
              if(type==='achats'){
                const C=lireCsv(csv.octets.toString('utf8')); const iH=C.findIndex(r=>r[0]==='Date'); const iT=C.findIndex((r,i)=>i>iH&&r[0]==='Total');
                const H=C[iH]||[]; const iP=H.indexOf('Paires'), iF=H.indexOf('Dont frais'), iMo=H.indexOf('Montant'), iFo=H.indexOf('Fournisseur'), iS=H.indexOf('Montant lu');
                const corps=C.slice(iH+1,iT);
                const lg=corps.find(r=>r[iFo]==='Grossiste inventé'&&r[iP]==='10');
                dit(iP>0&&iF>0&&!!lg&&lg[iMo]==='325,00'&&lg[iF]==='25,00',`achats : tableur — l’achat en gros sur UNE ligne : Grossiste inventé · 10 paires · 325,00 dont 25,00 de frais`,JSON.stringify(lg));
                dit(!corps.some(r=>r[iMo]==='32,50'),`achats : tableur — aucune ligne faite des parts posées sur ses paires (32,50)`);
                const l71002=corps.find(r=>/71002/.test(r.join(' ')));
                dit(!!l71002&&l71002[iMo]==='25,50'&&l71002[iS]==='Article seul',`achats : tableur — l’achat Vinted 71002 (paire reliée AUSSI au lot) garde son prix lu, jamais la part du lot`,JSON.stringify(l71002));
                const rat=corps.filter(r=>/Paire rattachée inventée/.test(r.join(' ')));
                dit(rat.length===1&&rat[0][iFo]==='Grossiste inventé'&&rat[0][iMo]==='120,00',`achats : tableur — l’achat hors plateforme rattaché : UNE ligne, au nom du grossiste`,JSON.stringify(rat));
                dit(/Grossiste invent/.test(t)&&/Dont frais/.test(t)&&/325,00/.test(t.replace(/[\u00a0\u202f]/g,' ')),`achats : le PDF dit le grossiste, « Dont frais » et 325,00`);
                if(process.env.BANC_CAPTURE){ fs.writeFileSync(path.join(process.env.BANC_CAPTURE,`registre-achats-${T.nom.replace(' ','-')}.pdf`),pdf.octets); fs.writeFileSync(path.join(process.env.BANC_CAPTURE,`registre-achats-${T.nom.replace(' ','-')}.csv`),csv.octets); }
              }
            }
          }
        }
        const txt=await pg.evaluate(()=>document.querySelector('[data-registres]').innerText);
        dit(!/[.!?]\s|parce que|permet|ici tu/i.test(txt.replace(/\d[.,]\d/g,'')),'aucune phrase d’explication sur la carte',JSON.stringify(txt).slice(0,160));
        const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-registres] button, [data-registres] select')].map(e=>Math.round(e.getBoundingClientRect().height)));
        dit(cibles.every(h=>h>=44),'cibles au doigt ≥ 44 px',cibles.join(','));
        if(process.env.BANC_CAPTURE){ await pg.locator('[data-registres]').scrollIntoViewIfNeeded(); await pg.locator('[data-registres]').screenshot({path:path.join(process.env.BANC_CAPTURE,`registres-${T.nom.replace(' ','-')}.png`)}).catch(()=>{}); }
        const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      }catch(e){ dit(false,T.nom,String(e.message||e).slice(0,200)); }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ registres : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ registres : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
