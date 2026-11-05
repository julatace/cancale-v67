// ═══════════════════════════════════════════════════════════════════════════
// BANC : « RÉCAP DE [MOIS] » — LE PDF ET LE TABLEUR DISENT LES CHIFFRES DE L'ÉCRAN
//        npm run build && node scripts/bancs/recap-mois.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (3 nov., Julien) Compta → Documents et réglages → « Récap de [mois] » ⇒ PDF et
// tableur. Ce banc rend l'app sur des ventes INVENTÉES (le dépôt est public),
// publie le bénéfice par l'écran Ventes, ouvre Comptabilité, lit les NOMBRES de
// l'écran (« Combien j'ai gagné ? », la colonne du récap mensuel, les dépenses du
// mois), télécharge le PDF et le tableur, lit le PDF avec pdf.js, et exige les
// mêmes nombres : bénéfice, CA déclaré, URSSAF, dépenses, nombre de ventes,
// couverture des prix d'achat ; « — » des deux côtés quand un prix manque ;
// jamais « encaissé » ; une ligne par vente avec son N° ; 1512 px et 390 px.
// (En-tête du banc `benefice-unique`, dont il reprend la base servie.)
// Constat d'une critique, sur les mêmes données : « — » dans Ma journée, 103 €
// dans Statistiques, 80,93 € dans Comptabilité. Trois notions portaient le nom
// « Bénéfice » (src/beneficeNoms.js). Ce banc rend Ma journée, Statistiques
// (Mois), Comptabilité et son récap mensuel sur les MÊMES ventes INVENTÉES
// (aucune donnée réelle : le dépôt est public), à 1512 px et 390 px tactile, et
// compare les NOMBRES (`data-benef-notion` / `data-benef-valeur`, §6.4) :
//   A. tous les prix d'achat connus, une charge fixe, micro-entrepreneur : la
//      même valeur partout où le libellé est « Bénéfice » ; Statistiques ne
//      montre plus le brut sous ce nom ;
//   B. un prix d'achat manque : le même « — » partout, la porte dessous ; aucun
//      brut partiel « au moins » ;
//   C. Ventes : ses cartes s'appellent « Bénéfice brut » / « Après frais de
//      vente », aucune carte « Bénéfice » ni « Bénéfice net » ; Statistiques en
//      semaine : « Bénéfice brut ».
// Sur le code d'avant : Statistiques montre le brut (« au moins » en B), le
// récap écrit « — » en dur, Ma journée glisse au brut partiel.
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));

const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4493;
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
rows.push({ id:'ebay_orders', data:{ orders:[] } });
const OV_PARTIEL={ '91002':{ buyPrice:'20', fees:'2' }, '91003':{ buyPrice:'15' } };
const OV_COMPLET={ ...OV_PARTIEL, '91004':{ buyPrice:'30' } };
const jourIso=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
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

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}${T.sombre?' sombre':''}`);
      for(const [lettre,nom,ov] of [['A','tous les prix d’achat connus',OV_COMPLET],['B','un prix d’achat manque',OV_PARTIEL]]){
        console.log(`── ${lettre}. ${nom}`);
        try{
          const { ctx, pg, errs }=await page(b,T,{ main:{ ...MAIN0, vinted_dark:!!T.sombre, vinted_sale_overrides:ov } });
          await publierBenefice(pg);
          await aller(pg,'compta','[data-benef-etat]',2500);
          await pg.evaluate(()=>{ const x=document.querySelector('[data-benef-choix="mois"]'); if(x) x.click(); }); await pg.waitForTimeout(400);
          const ecran=await pg.evaluate(()=>{ const g=document.querySelector('[data-compta-chiffre="gagne"]'); const s=document.querySelector('[data-benef-etat]'); const k=document.querySelector('[data-compta-kpi="mois"]');
            return { benef:g?g.getAttribute('data-benef-valeur'):null, texte:g?g.innerText:'', n:s&&s.getAttribute('data-benef-n'), ncout:s&&s.getAttribute('data-benef-ncout'), depenses:k?k.getAttribute('data-eur'):null }; });
          await ouvrirAvanceCompta(pg).catch(()=>{});
          await pg.evaluate(()=>{ const d=document.querySelector('[data-recap-repli]'); if(d) d.open=true; }); await pg.waitForTimeout(400);
          const table=await pg.evaluate((m)=>{ const d=document.querySelector('[data-recap-repli]'); if(!d) return null; const ths=[...d.querySelectorAll('th')].map(t=>t.innerText.trim());
            const td=d.querySelector(`[data-benef-mois="${m}"]`); const tr=td&&td.closest('tr'); if(!tr) return { ths };
            const cel=[...tr.children].map(c=>c.innerText.trim()); const i=(re)=>ths.findIndex(t=>re.test(t));
            return { ths, n:cel[i(/^ventes$/i)], ca:cel[i(/^ca/i)], benef:td.getAttribute('data-benef-valeur'), urssaf:cel[i(/cotis/i)] }; },ym(maintenant));
          console.log('   écran',JSON.stringify(ecran),'\n   tableau',JSON.stringify(table));
          dit(await pg.locator('[data-recap-pdf]').count()===1 && await pg.locator('[data-recap-csv]').count()===1,'« Récap de … » : PDF et Tableur dans Documents et réglages');
          const titre=await pg.evaluate(()=>{ const c=document.querySelector('[data-recap-mois]'); return c?c.innerText:''; });
          dit(/R[ée]cap de \S+\s\d{4}/i.test(titre),'le titre nomme le mois',JSON.stringify(titre.split('\n')[0]));
          const pdf=await telecharge(pg,'[data-recap-pdf]');
          const csv=await telecharge(pg,'[data-recap-csv]');
          dit(/^Recap-\d{4}-\d{2}\.pdf$/.test(pdf.nom) && /^Recap-\d{4}-\d{2}\.csv$/.test(csv.nom),'deux fichiers nommés du mois',`${pdf.nom} · ${csv.nom}`);
          const L=await lirePdf(pdf.octets); const C=lireCsv(csv.octets.toString('utf8'));
          const cv=(re)=>{ const r=C.find(x=>re.test(x[0])); return r?r[1]:null; };
          const P={ benef:cents(valeurDe(L,/^Bénéfice$/)), ca:cents(valeurDe(L,/^CA déclaré/)), urssaf:cents(valeurDe(L,/^URSSAF/)), dep:cents(valeurDe(L,/^Dépenses$/)), n:valeurDe(L,/^Ventes du mois/), couv:valeurDe(L,/^Prix d'achat connus/) };
          const V={ benef:cents(cv(/^Bénéfice$/)), ca:cents(cv(/^CA déclaré/)), urssaf:cents(cv(/^URSSAF/)), dep:cents(cv(/^Dépenses$/)), n:cv(/^Ventes du mois/), couv:cv(/^Prix d'achat connus/) };
          console.log('   PDF',JSON.stringify(P),'\n   CSV',JSON.stringify(V));
          for(const [k,F] of [['PDF',P],['tableur',V]]){
            dit(ecran.benef!=null && F.benef===ecran.benef && F.benef===(table&&table.benef),`${k} : Bénéfice = Comptabilité = récap mensuel`,`${F.benef} · ${ecran.benef} · ${table&&table.benef}`);
            if(lettre==='B') dit(F.benef==='','${k} : « — » quand un prix d’achat manque'.replace('${k}',k));
            dit(table&&F.ca===cents(table.ca),`${k} : CA déclaré = le tableau`,`${F.ca} · ${table&&table.ca}`);
            dit(table&&F.urssaf===cents(table.urssaf),`${k} : URSSAF = le tableau`,`${F.urssaf} · ${table&&table.urssaf}`);
            dit(ecran.depenses!=null && F.dep===String(-Math.round(Number(ecran.depenses)*100)),`${k} : dépenses du mois = Comptabilité`,`${F.dep} · ${ecran.depenses}`);
            dit(ecran.n!=null && F.n===ecran.n,`${k} : nombre de ventes = celui du bénéfice`,`${F.n} · ${ecran.n}`);
            dit(ecran.ncout!=null && F.couv===`${ecran.ncout}/${ecran.n}`,`${k} : prix d'achat connus x/y`,`${F.couv} · ${ecran.ncout}/${ecran.n}`);
          }
          const tout=L.map(l=>l.join(' ')).join('\n')+'\n'+csv.octets.toString('utf8');
          dit(!/encaiss/i.test(tout),'jamais « encaissé »');
          const i0=C.findIndex(r=>r[0]==='Date'&&r[1]==='Site'), i1=C.findIndex(r=>/^DÉPENSES$/.test(r[0]));
          const lignesVentes=C.slice(i0+1,i1>i0?i1:undefined).filter(r=>/^\d\d\/\d\d\/\d{4}$/.test(r[0]));
          dit(String(lignesVentes.length)===ecran.n,'une ligne de tableur par vente du mois',`${lignesVentes.length}`);
          dit(lignesVentes.every(r=>r[1]==='Vinted'&&/^Baskets inventées/.test(r[3])),'chaque ligne : site et titre');
          dit(/Cartons inventés/.test(tout)&&/Local inventé/.test(tout),'les dépenses sont listées');
          if(process.env.BANC_CAPTURE) await pg.locator('[data-recap-mois]').screenshot({path:path.join(process.env.BANC_CAPTURE,`recap-mois-${lettre}-${T.nom}.png`)}).catch(()=>{});
          const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
          dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
          await ctx.close();
        }catch(e){ dit(false,lettre+T.nom,String(e.message||e).slice(0,200)); }
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ recap-mois : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ recap-mois : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
