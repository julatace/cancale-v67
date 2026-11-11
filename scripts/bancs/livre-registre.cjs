// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES REGISTRES CONFORMES À L'ÉCRAN (11 nov., lot livre-registre)
//        npm run build && node scripts/bancs/livre-registre.cjs   (BANC_CAPTURE=dossier : captures, PDF, CSV, XLSX)
// Argent → Déclarer → « Registres » → « Voir » : la feuille par mois, filtrable,
// les mentions (client par facture Pro / pseudo, fournisseur, règlement, pièce),
// les manques nommés, les sources « à vérifier », et les exports PDF · CSV ·
// Excel HORODATÉS relus (pdf.js, openpyxl) = l'écran. Données INVENTÉES.
// Sur le code d'avant : aucun bouton « Voir » (rouge).
// ── (ce qui suit : les fixtures du banc `registres.cjs` du 3 nov.)
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
const path=require('path'), fs=require('fs'), http=require('http'), os=require('os'); const { spawnSync }=require('child_process');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));

const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4498;
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
for(const v of VENTES) if(v[5]) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[5]), user_side:'seller', buyer:{ login:'acheteur_'+v[1] }, seller:{ login:'moi_'+v[0] } } } } });
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
const HORS=[{ id:'hb1', title:'Paire rattachée inventée', price:'120', date:`${GROS_DATE.getFullYear()}-${String(GROS_DATE.getMonth()+1).padStart(2,'0')}-${String(GROS_DATE.getDate()).padStart(2,'0')}`, source:'Fournisseur', numero:'30', paiement:'especes' }];
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

// (11 nov.) Les transactions des ACHATS lues côté acheteur (pseudo du vendeur), une facture Pro
// pour la vente 91002, une photo de ticket jointe à l'achat hors plateforme hb1.
for(const a of ACHATS) rows.push({ id:`harvest_${a[0]}_txn_${a[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(a[1]), user_side:'buyer', seller:{ login:'vendeuse_'+a[1] }, buyer:{ login:'moi_'+a[0] } } } } });
rows.push({ id:'email_invoice_91002', data:{ number:'F2026-0009', status:'sent', transaction:'91002', emiseLe:iso(maintenant), contenu:{ acheteur:{ nom:'Société inventée' }, totaux:{ ttc:6100 } } } });
rows.push({ id:'achat_facture_hors_hb1', data:{ type:'image', nom:'ticket-invente.jpg', taille:1200, at:iso(maintenant) } });
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
  const ctx=await b.newContext({locale:'fr-FR',viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch, acceptDownloads:true, colorScheme:T.sombre?'dark':'light'});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>r.abort());
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
    const ins=/id=in\.\(([^)]*)\)/.exec(u); if(ins){ const ids=ins[1].split(','); if(ids.some(i=>/_txn_/.test(i))) opts.lusIn=(opts.lusIn||[]).concat([u]); return j(rows.filter(r=>ids.includes(r.id)).map(r=>projette(r,S))); }
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
const telecharge=async(pg,sel)=>{ const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:30000}),pg.click(sel)]); const p=await dl.path(); return { nom:dl.suggestedFilename(), octets:fs.readFileSync(p) }; };
const vue=async(pg)=>pg.evaluate(()=>{ const e=document.querySelector('[data-registres-vue-etat]'); const s=document.querySelector('[data-registres-vue]'); return e?{ type:s&&s.getAttribute('data-registres-vue'), etat:e.getAttribute('data-registres-vue-etat'), n:e.getAttribute('data-registres-vue-n'), filtrees:e.getAttribute('data-registres-vue-filtrees'), total:e.getAttribute('data-registres-vue-total'), hors:e.getAttribute('data-registres-vue-hors'), mois:e.getAttribute('data-registres-vue-mois'), manques:[...document.querySelectorAll('[data-registres-manque]')].map(m=>m.getAttribute('data-registres-manque')+':'+m.getAttribute('data-registres-manque-n')), texte:e.innerText }:null; });
const ligneTxt=async(pg,id)=>pg.evaluate((id)=>{ const e=document.querySelector(`[data-registre-ligne="${id}"]`); return e?e.innerText:null; },id);
const MODES=[ { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true }, { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false } ];
const yNow=String(maintenant.getFullYear()), ymNow=ym(maintenant);
const recettesDe=(p)=>VENTES.filter(v=>v[5]&&/finalis/i.test(v[3])&&(p.length===4?String(v[5].getFullYear())===p:ym(v[5])===p));
const somme=(l,i)=>String(l.reduce((s,x)=>s+Math.round(x[i]*100),0));
const CAP=process.env.BANC_CAPTURE||'';
(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of MODES){
      const nomT=T.nom.replace(' ','-');
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      try{
        const opts={ main:{ ...MAIN0, vinted_dark:!!T.sombre, vinted_sale_overrides:OV_COMPLET, vrm_fournisseurs:FOURNISSEURS, vinted_annonce_numeros:FICHES_GROS, vinted_offvinted_buys:HORS } };
        const { ctx, pg, errs }=await page(b,{...T},opts);
        await publierBenefice(pg);
        await aller(pg,'compta','[data-benef-etat]',2000);
        await ouvrirAvanceCompta(pg).catch(()=>{});
        await pg.waitForSelector('[data-registres]',{timeout:15000}).catch(()=>{});
        await pg.waitForFunction(()=>['recettes','achats'].every(t=>{ const e=document.querySelector(`[data-registre="${t}"]`); return e&&e.getAttribute('data-registre-etat')!=='encours'; }),null,{timeout:20000}).catch(()=>{});
        await pg.selectOption('[data-registres-periode]',ymNow).catch(()=>{}); await pg.waitForTimeout(400);
        const voir=await pg.locator('[data-registre-voir="recettes"]').count();
        dit(voir===1,'la carte « Registres » porte « Voir »');
        if(!voir){ await ctx.close(); continue; }
        await pg.click('[data-registre-voir="recettes"]');
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-registres-vue-etat]'); return e&&e.getAttribute('data-registres-vue-etat')==='lu'; },null,{timeout:20000}).catch(()=>{});
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-registre-ligne="vinted:91002"]'); return e&&/Société inventée/.test(e.innerText); },null,{timeout:15000}).catch(()=>{});
        const V=await vue(pg); const eR=recettesDe(ymNow);
        console.log('   recettes',JSON.stringify({...V,texte:undefined}));
        dit(V&&V.type==='recettes'&&V.n===String(eR.length)&&V.total===somme(eR,2),'recettes du mois = ventes VERSÉES ce mois (lignes, total au centime)',`${V&&V.n}/${eR.length} · ${V&&V.total}/${somme(eR,2)}`);
        dit(V&&V.mois===`${ymNow}:${eR.length}:${somme(eR,2)}`,'un groupe par mois, son nombre et son total',V&&V.mois);
        dit(V&&Number(V.hors)>=1&&V.manques.some(m=>/^a-dater:[1-9]/.test(m)),'la vente sans date de versement : à part, nommée « à dater »',V&&V.manques.join(' '));
        const l2=await ligneTxt(pg,'vinted:91002'), l3=await ligneTxt(pg,'vinted:91003');
        dit(l2&&/Société inventée/.test(l2)&&/Facture F2026-0009/.test(l2),'client et pièce : la facture Pro de CETTE vente',l2);
        dit(l3&&/acheteur_91003/.test(l3)&&/Paiement via Vinted/.test(l3)&&/Transaction Vinted 91003/.test(l3)&&!/Société/.test(l3),'sans facture : le pseudo lu dans SA transaction, le règlement, la référence',l3);
        dit((opts.lusIn||[]).some(u=>/select=id,tx:data->payload->transaction->>id,side:/.test(u))&&(opts.lusIn||[]).every(u=>!/select=([^&]*,)?data(,|&|$)/.test(u)),'pseudos lus en projection, jamais select=data',(opts.lusIn||[])[0]);
        await pg.fill('[data-registres-vue-q]','91003'); await pg.waitForTimeout(300);
        const F=await vue(pg);
        dit(F&&F.filtrees==='1'&&(await pg.locator('[data-registre-ligne]').count())===1,'la recherche filtre les lignes',F&&F.filtrees);
        await pg.fill('[data-registres-vue-q]',''); await pg.waitForTimeout(200);
        await pg.click('[data-registres-sources] > summary');
        const src=await pg.evaluate(()=>[...document.querySelectorAll('[data-registres-obligation]')].map(e=>e.getAttribute('data-registres-obligation')));
        const av=await pg.evaluate(()=>[...document.querySelectorAll('[data-registres-source-etat]')].map(e=>e.getAttribute('data-registres-source-etat')));
        dit(['date','client','nature','montant','reglement','piece','totaux'].every(k=>src.includes(k))&&av.length>=7&&av.every(x=>x==='a-verifier'),'chaque mention a sa source, dite « à vérifier »',src.join(',')+' · '+av.join(','));
        if(CAP){ await pg.screenshot({path:path.join(CAP,`livre-recettes-${nomT}.png`)}); }
        // Exports du livre des recettes (feuille)
        const pdf=await telecharge(pg,'[data-registres-vue-export="pdf"]');
        const csv=await telecharge(pg,'[data-registres-vue-export="csv"]');
        const xl=await telecharge(pg,'[data-registres-vue-export="xlsx"]');
        const re=new RegExp(`^Livre-des-recettes-${ymNow}-etabli-\\d{8}-\\d{4}\\.(pdf|csv|xlsx)$`);
        dit([pdf,csv,xl].every(f=>re.test(f.nom)),'PDF, CSV, Excel horodatés',[pdf.nom,csv.nom,xl.nom].join(' · '));
        const C=lireCsv(csv.octets.toString('utf8')); const iH=C.findIndex(r=>r[0]==='Date'); const iT=C.findIndex((r,i)=>i>iH&&r[0]==='Total'); const H=C[iH]||[];
        const iM=H.indexOf('Montant');
        dit(['Client','Nature','Règlement','Espèces','Pièce justificative'].every(h=>H.includes(h)),'CSV : les colonnes des mentions',H.join('|'));
        dit(iT-iH-1===Number(V.n)&&String(Math.round(Number((C[iT]||[])[iM].replace(',','.'))*100))===V.total,'CSV = l’écran (lignes, total)');
        dit(/^Établi le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}$/.test((C.find(r=>/^Établi le/.test(r[0]))||[''])[0])&&!/encaiss|conforme/i.test(csv.octets.toString('utf8')),'CSV horodaté, jamais « encaissé » ni « conforme »');
        const xp=path.join(os.tmpdir(),`livre-${process.pid}.xlsx`); fs.writeFileSync(xp,xl.octets);
        const py=spawnSync('python3',['-I','-c',"import openpyxl,json,sys\nwb=openpyxl.load_workbook(sys.argv[1]);ws=wb[wb.sheetnames[0]];r=[[c.value for c in x] for x in ws.iter_rows()];im=r[0].index('Montant');t=[x for x in r if x[0]=='Total'][0][im]\nprint(json.dumps({'f':wb.sheetnames,'t':t,'n':len(r)-2,'ty':sorted(set(type(x[im]).__name__ for x in r[1:]))}))",xp],{encoding:'utf8'});
        let xo=null; try{ xo=JSON.parse(py.stdout); }catch(_){}
        dit(xo&&String(Math.round(xo.t*100))===V.total&&xo.n===Number(V.n)&&xo.ty.every(x=>x==='float'||x==='int')&&xo.f.includes('Sources'),'Excel relu (openpyxl) : vrais nombres, total = l’écran, feuille Sources',xo||py.stderr);
        const L=await lirePdf(pdf.octets); const tp=L.map(l=>l.join(' ')).join('\n').replace(/[  ]/g,' ');
        dit(/Mentions obligatoires/.test(tp)&&/à vérifier/.test(tp)&&/Société inventée/.test(tp)&&/acheteur_91003/.test(tp)&&/établi le \d{2}\/\d{2}\/\d{4} à \d{2}:\d{2}/.test(tp),'PDF : mentions, sources « à vérifier », client, pseudo, horodatage');
        if(CAP){ fs.writeFileSync(path.join(CAP,`livre-recettes-${nomT}.pdf`),pdf.octets); fs.writeFileSync(path.join(CAP,`livre-recettes-${nomT}.xlsx`),xl.octets); }
        // Le registre des achats
        await pg.click('[data-registres-vue-type="achats"]');
        await pg.waitForFunction(()=>{ const s=document.querySelector('[data-registres-vue]'); return s&&s.getAttribute('data-registres-vue')==='achats'; },null,{timeout:10000}).catch(()=>{});
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-registre-ligne="vinted:71001"]'); return e&&/vendeuse_71001/.test(e.innerText); },null,{timeout:15000}).catch(()=>{});
        const A=await vue(pg);
        console.log('   achats',JSON.stringify({...A,texte:undefined}));
        const a1=await ligneTxt(pg,'vinted:71001'), hb=await ligneTxt(pg,'hors:hb1'), g1=await ligneTxt(pg,'gros:g1');
        dit(a1&&/vendeuse_71001/.test(a1)&&/Paiement via Vinted/.test(a1)&&/Transaction Vinted 71001/.test(a1),'achat Vinted : pseudo du vendeur (côté acheteur), règlement, référence',a1);
        dit(hb&&/Grossiste inventé/.test(hb)&&/Photo du ticket \(ticket-invente\.jpg\)/.test(hb)&&/Espèces/.test(hb)&&!/mode de règlement/.test(hb),'achat hors plateforme : fournisseur, la photo du ticket jointe PAR SON IDENTITÉ, « Payé en Espèces » (plus de manque)',hb);
        dit(g1&&/mode de règlement/.test(g1),'achat en gros sans « Payé en » : le mode de règlement est nommé à compléter (jamais deviné)',g1);
        dit(g1&&/À compléter/.test(g1)&&/pièce justificative/.test(g1),'achat en gros sans pièce : « à compléter » nommé sur sa ligne',g1);
        dit(A&&A.manques.some(m=>/^reglement:[1-9]/.test(m))&&A.manques.some(m=>/^piece:[1-9]/.test(m)),'manques nommés et comptés',A&&A.manques.join(' '));
        const nA=Number(A.n);
        if(await pg.locator('[data-registres-vue-acompleter]').count()){ await pg.click('[data-registres-vue-acompleter]'); await pg.waitForTimeout(300); }
        const A2=await vue(pg);
        dit(A2&&Number(A2.filtrees)>0&&Number(A2.filtrees)<nA,'« À compléter » ne garde que les lignes incomplètes',`${A2&&A2.filtrees}/${nA}`);
        if(CAP){ await pg.screenshot({path:path.join(CAP,`registre-achats-${nomT}.png`)}); }
        const pdfA=await telecharge(pg,'[data-registres-vue-export="pdf"]');
        if(CAP) fs.writeFileSync(path.join(CAP,`registre-achats-${nomT}.pdf`),pdfA.octets);
        const LA=(await lirePdf(pdfA.octets)).map(l=>l.join(' ')).join('\n').replace(/[  ]/g,' ');
        dit(/Registre des achats/.test(LA)&&/vendeuse_71001/.test(LA)&&/Photo du ticket/.test(LA)&&/À compléter/.test(LA),'PDF des achats : pseudo, ticket, à compléter');
        // (11 nov.) « Payé en » dans la fiche de l'achat hors plateforme : lu, changé par SON toucher, rangé avec l'achat.
        await pg.keyboard.press('Escape').catch(()=>{}); await pg.waitForTimeout(400);
        await aller(pg,'achats','[data-achats-hors]',1500);
        if(!(await pg.locator('[data-achat-hors-id="hb1"]').count())) await pg.click('[data-achats-hors-entete]').catch(()=>{});
        await pg.click('[data-achat-hors-id="hb1"]',{timeout:15000}).catch(()=>{});
        await pg.waitForSelector('[data-achat-paiement]',{timeout:10000}).catch(()=>{});
        const p0=await pg.getAttribute('[data-achat-paiement]','data-achat-paiement').catch(()=>null);
        dit(p0==='especes','« Payé en » relu sur la fiche de l’achat (Espèces)',p0);
        await pg.click('[data-achat-paiement-choix="carte"]').catch(()=>{});
        const p1=await pg.getAttribute('[data-achat-paiement]','data-achat-paiement').catch(()=>null);
        const hP=await pg.evaluate(()=>[...document.querySelectorAll('[data-achat-paiement-choix]')].map(e=>Math.round(e.getBoundingClientRect().height)));
        dit(p1==='carte'&&hP.length===5&&hP.every(h=>h>=44),'cinq choix de 44 px, « Carte » choisi',`${p1} · ${hP.join(',')}`);
        if(CAP){ await pg.locator('[data-achat-hors-form]').scrollIntoViewIfNeeded().catch(()=>{}); await pg.locator('[data-achat-paiement]').scrollIntoViewIfNeeded().catch(()=>{}); await pg.locator('[data-achat-hors-form]').screenshot({path:path.join(CAP,`paye-en-${nomT}.png`)}).catch(()=>{}); }
        await pg.click('[data-achat-hors-enregistrer]').catch(()=>{});
        await pg.waitForFunction(()=>{ try{ const l=JSON.parse(localStorage.getItem('vinted_offvinted_buys')||'[]'); const b=l.find(x=>x&&x.id==='hb1'); return b&&b.paiement==='carte'; }catch(_){ return false; } },null,{timeout:10000}).catch(()=>{});
        const rangé=await pg.evaluate(()=>{ try{ const l=JSON.parse(localStorage.getItem('vinted_offvinted_buys')||'[]'); const b=l.find(x=>x&&x.id==='hb1'); return b?b.paiement:null; }catch(_){ return null; } });
        dit(rangé==='carte','« Carte » rangé avec l’achat (vinted_offvinted_buys, synchronisé)',rangé);
        const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-registres-vue] button, [data-registres-vue] select, [data-registres-vue] input')].filter(e=>e.offsetParent&&!e.classList.contains('vrm-seg-btn')).map(e=>Math.round(e.getBoundingClientRect().height)));
        dit(cibles.length&&cibles.every(h=>h>=44),'cibles au doigt ≥ 44 px',cibles.join(','));
        const deb=await pg.evaluate(()=>{ const s=document.querySelector('[data-registres-vue]'); return s?s.scrollWidth-s.clientWidth:0; });
        dit(deb<=1,'aucun débordement horizontal dans la feuille',`${deb}px`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      }catch(e){ dit(false,T.nom,String(e.message||e).slice(0,200)); }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ livre-registre : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ livre-registre : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
