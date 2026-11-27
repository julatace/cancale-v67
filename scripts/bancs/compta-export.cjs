// ═══════════════════════════════════════════════════════════════════════════
// BANC : « FAIT LA COMPTA » + « L'EXPORT COMPTABLE POUR L'URSSAF » — 27 novembre
//        npm run build && node scripts/bancs/compta-export.cjs   (BANC_CAPTURE=dossier pour les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Sur une base INVENTÉE (le dépôt est public), à 1512 et 390 px, clair ET sombre :
//   A. Comptabilité → « Pour mon comptable », le dernier mois bouclé : le CA déclaré de l'export = le
//      chiffre de la carte « Prochaine déclaration » (même période) ; les ventes = « Registres » ; la vente
//      reliée (N°12) porte prix 61,00, achat 20,00, port 3,00, bénéfice 38,00 et la référence de SON achat
//      (7100001, reçu) ; le compte exclu n'est nulle part ; la vente sans versement est « à dater », jamais
//      dans les ventes ; le fichier « pour un logiciel » a UNE ligne d'en-tête, une ligne par vente versée,
//      et sa somme = le total de l'écran ; jamais « encaissé ».
//   B. « Pour l'URSSAF » : rythme pas enregistré ⇒ « à choisir » (rien deviné) ; SON clic « Par mois » ;
//      le montant = la carte « Prochaine déclaration », la cotisation = 12,4 % ; les ventes derrière le
//      chiffre sans le compte exclu, sans la vente à dater, sans la vente DÉCLARÉE dans un autre mois (le
//      registre) — qui apparaît dans SON mois de déclaration, marqué ; PDF « à recopier » (ligne BIC, taux,
//      montant, seuils 2026, DAC7) et CSV ; statut pas choisi ⇒ « régime à choisir », aucune cotisation.
// Sur le code d'avant : ni carte URSSAF, ni colonnes de détail, ni fichier pour logiciel (rouge).
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4627;
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
  ['111','91001',48.5,ilYa(2,20),ilYa(1,5)],
  ['111','91002',61,  ilYa(1,3),ilYa(1,8)],     // reliée au N°12 (achat 20 €, port 3 €)
  ['222','91003',39.9,ilYa(1,4),ilYa(1,10)],
  ['222','91004',72.4,ilYa(1,6),null],          // à dater
  ['222','91009',33,  ilYa(2,25),ilYa(1,2)],    // versée le mois bouclé, DÉCLARÉE le mois d'avant (registre)
  ['222','91010',25,  ilYa(2,5),ilYa(2,9)],     // versée le mois d'avant
  ['333','91007',99.99,ilYa(1,9),ilYa(1,10)],   // compte EXCLU
];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), item_id:Number(v[1])+500000, title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:'Commande finalisée', date:iso(v[3]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:v[4]?450:400, status_title:v[4]?'Commande finalisée':'Commande en cours', status_updated_at:iso(v[4]||v[3]) } } } });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });
const FIN='Transaction finalisée - L’acheteur a validé la commande';
const ACHATS=[['111','7100001',20,FIN,ilYa(2,1),'Nike Dunk inventée A'],['333','7100200',18,FIN,ilYa(1,9),'Achat compte exclu']];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_purchased`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:ACHATS.filter(x=>x[0]===uid).map(x=>({ transaction_id:Number(x[1]), title:x[5], price:{amount:String(x[2]),currency_code:'EUR'}, status:x[3], date:iso(x[4]), conversation_id:null, transaction_user_status:'completed' })) } } });
}
rows.push({ id:'email_achat_banc1', data:{ subject:'Ton reçu pour la commande « Nike Dunk inventée A »', article:'Nike Dunk inventée A', prix:'20,00 €', transaction:'7100001', account:'atelier_sneak', receivedAt:iso(ilYa(2,2)),
  texte:'Merci pour ton achat\nMontant payé 20,00 €\nArticle 20,00 €\nMode de paiement Carte\nN° de transaction 7100001' } });
// La fiche de la vente 91002 (clé = SON item_id) : N°12, achat 20 €, port payé par lui 3 €, reliée à SON achat.
const FICHES={ '591002':{ numero:'12', title:'Baskets inventées 91002', buyPrice:'20', transportVendeur:'3', buyFromId:'7100001' } };
// Le registre « J'ai déclaré » : 91009 déclarée avec le mois d'AVANT (son clic, simulé ici).
const DECLARE={ [YM2]:{ ids:['vinted:91010','vinted:91009'], n:2, ca:58, montant:58, regle:'versement', at:iso(ilYa(1,3)) } };

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
// Ventes publie la ligne du CA déclaré et le relevé vente par vente (les sources des deux exports).
const publier=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ const r=JSON.parse(localStorage.getItem('vrm_stats_ventes')||'null'); return !!JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null')&&r&&Array.isArray(r.l)&&r.l.length>0; }catch(_){ return false; } },null,{timeout:30000}).catch(()=>{});
  await pg.waitForTimeout(800);
};
const lirePdf=async(octets)=>{
  const pdfjs=await import('file://'+path.join(NM,'pdfjs-dist','legacy','build','pdf.mjs'));
  const doc=await pdfjs.getDocument({data:new Uint8Array(octets),isEvalSupported:false,useSystemFonts:false,standardFontDataUrl:path.join(NM,'pdfjs-dist','standard_fonts')+'/'}).promise;
  let t=''; for(let i=1;i<=doc.numPages;i++){ const p=await doc.getPage(i); const tc=await p.getTextContent(); t+=tc.items.map(x=>x.str).join(' ')+'\n'; }
  return { pages:doc.numPages, texte:t.replace(/[\u00a0\u202f]/g,' ') };
};
const telecharge=async(pg,sel)=>{ const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}),pg.click(sel)]); const p=await dl.path(); return { nom:dl.suggestedFilename(), octets:fs.readFileSync(p) }; };
const attrs=(pg,sel,pref)=>pg.evaluate(([sel,pref])=>{ const e=document.querySelector(sel); if(!e) return null; const a={}; for(const n of e.getAttributeNames()) if(n.startsWith(pref)) a[n.slice(pref.length)]=e.getAttribute(n); a.texte=e.innerText.replace(/[\u00a0\u202f]/g,' '); return a; },[sel,pref]);
const MODES=[
  { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true },
  { nom:'1512 clair', vp:{width:1512,height:950}, sombre:false },
  { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false },
  { nom:'390 sombre', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:true },
];
const MAIN0={ vinted_regime:'micro', vinted_accounts_hidden:['333'], vinted_annonce_numeros:FICHES, vrm_urssaf_declare:DECLARE };
const virg=(c)=>(Number(c)/100).toFixed(2).replace('.',',');
const lignesCsv=(t)=>t.replace(/^\ufeff/,'').split(/\r?\n/).filter(Boolean).map(l=>l.split(';'));
// Le chiffre de la carte « Prochaine déclaration » (le montant de l'écran), en centimes.
const prevision=async(pg)=>{ await pg.waitForFunction(()=>{ const e=document.querySelector('[data-prevision-carte]'); return e&&e.getAttribute('data-prevision-carte')!=='rythme'&&e.getAttribute('data-prevision-ca')!==''; },null,{timeout:15000}).catch(()=>{});
  return pg.evaluate(()=>{ const e=document.querySelector('[data-prevision-carte]'); return e?{ etat:e.getAttribute('data-prevision-carte'), label:e.getAttribute('data-prevision-label'), ca:e.getAttribute('data-prevision-ca'), apayer:e.getAttribute('data-prevision-apayer') }:null; }); };
const cts=(x)=>x==null||x===''?'':String(Math.round(Number(x)*100));

(async()=>{
  let b;
  try{
    if(CAP) fs.mkdirSync(CAP,{recursive:true});
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    // BANC_MODES=0,2 : seulement ces tailles (les mutations se jouent sur la première) ; défaut : toutes.
    const seuls=String(process.env.BANC_MODES||'').split(',').filter(Boolean).map(Number);
    for(const [iT,T] of MODES.entries()){
      if(seuls.length&&!seuls.includes(iT)) continue;
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      const nomCap=T.nom.replace(' ','-');
      for(const regime of (iT===0?['micro',null]:['micro'])){
        const lab=regime?'':' (statut pas choisi)';
        try{
          const main={ ...MAIN0, vinted_dark:!!T.sombre }; if(regime==null) delete main.vinted_regime;
          const { ctx, pg, errs }=await page(b,T,{ main });
          await publier(pg);
          const ligne=await pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null'); }catch(_){ return null; } });
          const caLigne=(m)=>{ const x=((ligne&&ligne.mois)||[]).find(z=>z.ym===m); return x?Math.round(Number(x.ca)*100):0; };
          await aller(pg,'compta','[data-benef-etat]',1500);
          await ouvrirAvanceCompta(pg).catch(()=>{});
          // ── B. « Pour l'URSSAF » ───────────────────────────────────────────
          await pg.waitForSelector('[data-export-urssaf]',{timeout:15000}).catch(()=>{});
          const carteU=await pg.locator('[data-export-urssaf]').count();
          dit(carteU===1,`B${lab} · Comptabilité : une carte « Pour l’URSSAF »`);
          if(carteU){
            await pg.locator('[data-export-urssaf]').scrollIntoViewIfNeeded();
            await pg.click('[data-urssaf-export-preparer]');
            await pg.waitForSelector('[data-urssaf-export-etat]',{timeout:15000}).catch(()=>{});
            const e0=await pg.getAttribute('[data-urssaf-export-etat]','data-urssaf-export-etat').catch(()=>null);
            dit(e0==='rythme','B · rythme pas enregistré : « à choisir », rien deviné (ni mois ni trimestre)',e0);
            await pg.click('[data-urssaf-export-rythme="mensuel"]').catch(()=>{});
            await pg.waitForFunction(()=>{ const e=document.querySelector('[data-urssaf-export-periode]'); const s=e&&e.getAttribute('data-urssaf-export-etat'); return s&&s!=='encours'&&s!=='rythme'; },null,{timeout:25000}).catch(()=>{});
            const freq=await pg.evaluate(()=>localStorage.getItem('vinted_urssaf_freq'));
            dit(/mensuel/.test(String(freq)),'B · SON clic « Par mois » enregistre le rythme',String(freq));
            let U=await attrs(pg,'[data-urssaf-export-periode]','data-urssaf-export-');
            console.log('   URSSAF',JSON.stringify({ ...U, texte:undefined }));
            dit(!!U&&U.periode===YM1,'B · défaut : le dernier mois fini (celui qui se déclare)',U&&U.periode);
            dit(!!U&&U.montant===String(caLigne(YM1)),'B · montant = la ligne publiée par Ventes (datée au versement)',`${U&&U.montant} / ${caLigne(YM1)}`);
            if(regime==='micro'){
              const P=await prevision(pg);
              dit(!!P&&!!U&&P.ca!==''&&cts(P.ca)===U.montant,'B · montant de l’export = la carte « Prochaine déclaration » de l’écran',`${P&&P.label} ${P&&P.ca} / ${U&&U.montant}`);
              dit(!!P&&!!U&&cts(P.apayer)===U.cotisation&&U.cotisation===String(Math.round(Number(U.montant)*12.4/100)),'B · cotisation = l’écran = 12,4 % du montant',`${U&&U.cotisation} · ${P&&P.apayer}`);
              dit(/12,4/.test(U.texte)&&/Ventes de marchandises \(BIC\)/.test(U.texte),'B · l’écran dit la ligne (BIC) et le taux',U.texte.replace(/\n/g,' | ').slice(0,200));
            } else {
              dit(!!U&&U.cotisation===''&&/régime à choisir/.test(U.texte),'B · statut pas choisi : « régime à choisir », aucune cotisation',U&&U.texte.replace(/\n/g,' | ').slice(0,200));
            }
            const ids=String((U&&U.ids)||'').split(',').filter(Boolean);
            dit(ids.includes('vinted:91002')&&ids.includes('vinted:91001')&&ids.includes('vinted:91003'),'B · les ventes versées du mois sont derrière le chiffre',ids.join(','));
            dit(!ids.includes('vinted:91007'),'B · le compte exclu n’y est pas',ids.join(','));
            dit(!ids.includes('vinted:91004')&&Number(U.adater)>=1,'B · la vente sans versement : « à dater », jamais comptée',`adater ${U&&U.adater}`);
            dit(!ids.includes('vinted:91009'),'B · la vente DÉCLARÉE le mois d’avant ne compte pas dans celui-ci',ids.join(','));
            dit(!!U&&U['ventes-total']===U.montant,'B · somme des ventes listées = le montant à déclarer',`${U&&U['ventes-total']} / ${U&&U.montant}`);
            // Le PDF et le CSV de la période.
            const pdf=await telecharge(pg,'[data-urssaf-export-pdf]'); const csv=await telecharge(pg,'[data-urssaf-export-csv]');
            const PT=await lirePdf(pdf.octets); const t=csv.octets.toString('utf8');
            dit(pdf.nom===`URSSAF-${YM1}.pdf`&&csv.nom===`URSSAF-${YM1}.csv`,'B · fichiers nommés de la période',`${pdf.nom} · ${csv.nom}`);
            dit(/autoentrepreneur\.urssaf\.fr/.test(PT.texte)&&/Ventes de marchandises \(BIC\)/.test(PT.texte)&&PT.texte.includes(virg(U.montant)),'B · PDF « à recopier » : le site, la ligne BIC, le même montant',`${PT.pages} page(s)`);
            dit(/203 100,00/.test(PT.texte)&&/85 000,00/.test(PT.texte)&&/93 500,00/.test(PT.texte)&&/DAC7/.test(PT.texte)&&/30 ventes/.test(PT.texte),'B · PDF : seuils 2026 et note DAC7');
            dit(regime==='micro'?/12,4 %/.test(PT.texte):/régime à choisir/.test(PT.texte),'B · PDF : le taux, ou « régime à choisir »');
            const L=lignesCsv(t); const iV=L.findIndex(r=>/^LES VENTES DERRIÈRE/.test(r[0])), iA=L.findIndex(r=>/^À DATER/.test(r[0]));
            const blocV=L.slice(iV,iA).map(r=>r.join(';')).join('\n'), blocA=L.slice(iA).map(r=>r.join(';')).join('\n');
            dit(csv.octets[0]===0xef&&!/91007|compte_exclu/.test(t),'B · CSV : UTF-8 avec BOM, compte exclu absent');
            dit(/91004/.test(blocA)&&!/91004/.test(blocV)&&!/91009/.test(blocV),'B · CSV : 91004 seulement « à dater », 91009 hors du mois',`${iV} ${iA}`);
            dit(!/encaiss/i.test(t+PT.texte+U.texte),'B · jamais « encaissé »');
            if(CAP&&regime==='micro'&&iT===0){ fs.writeFileSync(path.join(CAP,`urssaf-${YM1}.pdf`),pdf.octets); fs.writeFileSync(path.join(CAP,`urssaf-${YM1}.csv`),csv.octets); }
            // Le mois d'avant : 91009 y est, marquée déclarée (le mois de SA déclaration).
            await pg.selectOption('[data-urssaf-export-choix]',YM2);
            await pg.waitForFunction((p)=>{ const e=document.querySelector('[data-urssaf-export-periode]'); return e&&e.getAttribute('data-urssaf-export-periode')===p&&e.getAttribute('data-urssaf-export-etat')!=='encours'; },YM2,{timeout:15000}).catch(()=>{});
            const U2=await attrs(pg,'[data-urssaf-export-periode]','data-urssaf-export-');
            const ids2=String((U2&&U2.ids)||'').split(',');
            dit(ids2.includes('vinted:91009')&&ids2.includes('vinted:91010')&&Number(U2.declares)===1,`B · ${YM2} : 91009 compte dans le mois de SA déclaration, mois noté déclaré`,`${ids2.join(',')} · ${U2&&U2.declares}`);
            dit(!!U2&&U2.montant===String(caLigne(YM2)),`B · ${YM2} : montant = la ligne publiée`,`${U2&&U2.montant} / ${caLigne(YM2)}`);
            await pg.selectOption('[data-urssaf-export-choix]',YM1);
            await pg.waitForTimeout(400);
            if(CAP){ await pg.locator('[data-export-urssaf]').scrollIntoViewIfNeeded(); await pg.locator('[data-export-urssaf]').screenshot({path:path.join(CAP,`urssaf-carte-${nomCap}${regime?'':'-sans-statut'}.png`)}).catch(()=>{}); }
            const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-export-urssaf] button,[data-export-urssaf] select')].map(e=>Math.round(e.getBoundingClientRect().height)));
            dit(cibles.length>0&&cibles.every(h=>h>=44),'B · cibles ≥ 44 px',cibles.join(','));
          }
          // ── A. « Pour mon comptable » ──────────────────────────────────────
          if(regime==='micro'){
            await pg.waitForSelector('[data-export-comptable]',{timeout:15000}).catch(()=>{});
            await pg.locator('[data-export-comptable]').scrollIntoViewIfNeeded().catch(()=>{});
            await pg.click('[data-export-preparer]').catch(()=>{});
            await pg.waitForFunction((p)=>{ const e=document.querySelector('[data-export-periode]'); return e&&e.getAttribute('data-export-etat')==='lu'&&e.getAttribute('data-export-periode')===p; },YM1,{timeout:25000}).catch(()=>{});
            const E=await attrs(pg,'[data-export-periode]','data-export-');
            console.log('   comptable',JSON.stringify({ ...E, texte:undefined }));
            const P=await prevision(pg);
            dit(!!E&&!!P&&E.ca===cts(P.ca)&&E.ca===String(caLigne(YM1)),'A · CA déclaré de l’export = la carte « Prochaine déclaration » = la ligne publiée',`${E&&E.ca} / ${P&&P.ca}`);
            dit(!!E&&!!P&&E.urssaf===cts(P.apayer),'A · URSSAF de l’export = l’écran',`${E&&E.urssaf} / ${P&&P.apayer}`);
            await pg.selectOption('[data-registres-periode]',YM1).catch(()=>{});
            await pg.waitForFunction(()=>{ const e=document.querySelector('[data-registre="recettes"]'); return e&&e.getAttribute('data-registre-etat')==='lu'; },null,{timeout:15000}).catch(()=>{});
            await pg.waitForTimeout(300);
            const R=await pg.evaluate(()=>{ const e=document.querySelector('[data-registre="recettes"]'); return e?{ n:e.getAttribute('data-registre-n'), total:e.getAttribute('data-registre-total') }:null; });
            dit(!!R&&!!E&&E['ventes-total']===R.total&&E['ventes-n']===R.n,'A · ventes de l’export = le livre des recettes de « Registres »',`${E&&E['ventes-n']}·${E&&E['ventes-total']} / ${R&&R.n}·${R&&R.total}`);
            dit(!!E&&E.benefice==='3800'&&/Bénéfice de ces ventes/.test(E.texte)&&/sur/.test(E.texte),'A · bénéfice des ventes listées : 38,00 € et sa couverture (« 1 sur N »)',`${E&&E.benefice} · n ${E&&E['benefice-n']}`);
            await pg.click('[data-export-a-part] summary');
            const csv=await telecharge(pg,'[data-export-csv]'); const imp=await telecharge(pg,'[data-export-import]');
            const t=csv.octets.toString('utf8'), ti=imp.octets.toString('utf8');
            const L=lignesCsv(t); const h=L.find(r=>r[0]==='Date de vente'&&r.includes('Bénéfice (€)'));
            const r12=L.find(r=>r[5]==='91002');
            const col=(n)=>h?h.indexOf(n):-1;
            dit(!!h&&!!r12&&r12[col('Prix de vente (€)')]==='61,00'&&r12[col('Prix d’achat (€)')]==='20,00'&&r12[col('dont port (€)')]==='3,00'&&r12[col('Bénéfice (€)')]==='38,00'&&r12[col('N°')]==='12','A · tableur : la vente N°12 — prix 61, achat 20, port 3, bénéfice 38',r12&&r12.join(';'));
            dit(!!r12&&/^7100001/.test(r12[col('Réf. achat')]||'')&&/reçu/.test(r12[col('Réf. achat')]||''),'A · tableur : la référence de SON achat (reçu relié par son n°)',r12&&r12[col('Réf. achat')]);
            const r3=L.find(r=>r[5]==='91003');
            dit(!!r3&&r3[col('Bénéfice (€)')]===''&&r3[col('Prix d’achat (€)')]==='','A · tableur : sans prix d’achat, bénéfice vide (jamais deviné, jamais 0)',r3&&r3.join(';'));
            dit(!/91007|7100200|compte_exclu/.test(t+ti),'A · le compte exclu n’est dans aucun fichier');
            const blocV=(t.split('VENTES VERSÉES')[1]||'').split('REÇU PAR PLATEFORME')[0];
            dit(/91004/.test(t.split('VENTES À DATER')[1]||'')&&!/91004/.test(blocV),'A · tableur : 91004 dans « à dater », jamais dans les ventes versées');
            const LI=lignesCsv(ti);
            dit(imp.nom===`Ventes-${YM1}-import.csv`&&LI.length>=2&&LI[0][0]==='Date'&&LI[0].includes('Montant reçu')&&LI.slice(1).every(r=>/^\d{2}\/\d{2}\/\d{4}$/.test(r[0])),'A · fichier pour logiciel : UNE ligne d’en-tête, une date par ligne',`${imp.nom} · ${LI.length} lignes`);
            const iM=LI[0].indexOf('Montant reçu'); const som=LI.slice(1).reduce((s,r)=>s+Math.round(Number(String(r[iM]).replace(',','.'))*100),0);
            dit(String(som)===E['ventes-total']&&LI.length-1===Number(E['ventes-n'])&&!/91004/.test(ti),'A · fichier pour logiciel : sa somme = le total de l’écran, sans la vente à dater',`${som} / ${E['ventes-total']}`);
            dit(!/encaiss/i.test(t+ti+E.texte),'A · jamais « encaissé »');
            if(CAP&&iT===0){ fs.writeFileSync(path.join(CAP,`comptable-${YM1}.csv`),csv.octets); fs.writeFileSync(path.join(CAP,`import-${YM1}.csv`),imp.octets); }
            if(CAP){ await pg.locator('[data-export-comptable]').scrollIntoViewIfNeeded(); await pg.locator('[data-export-comptable]').screenshot({path:path.join(CAP,`comptable-carte-${nomCap}.png`)}).catch(()=>{}); }
          }
          const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
          dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
          await ctx.close();
        }catch(e){ dit(false,`${T.nom}${lab}`,String(e.message||e).slice(0,200)); }
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ compta-export : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ compta-export : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
