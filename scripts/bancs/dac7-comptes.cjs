// ═══════════════════════════════════════════════════════════════════════════
// BANC : DAC7 COMPTE PAR COMPTE — 5 novembre
//        npm run build && BANC_PORT=7974 node scripts/bancs/dac7-comptes.cjs   (BANC_CAPTURE=dossier pour les captures)
// ═══════════════════════════════════════════════════════════════════════════
// Comptabilité → Le détail → « DAC7 ». Sur des ventes INVENTÉES (le dépôt est
// public), à 1512 px et 390 px tactile, clair et sombre, il exige :
//   · une carte par compte et par plateforme, aux nombres servis : le compte à
//     31 ventes VERSÉES cette année est au-dessus (par le nombre) ; le compte à
//     5 ventes + 1 pas encore datée est « au moins », le manque NOMMÉ, jamais
//     « sous » ; le compte Leboncoin a ses 2 ventes ;
//   · le compte masqué (40 ventes) n'a pas de carte, n'est compté nulle part,
//     et il est DIT ;
//   · le rapport : reçu pour Leboncoin (e-mail de leboncoin.fr), « pas encore
//     reçu » pour Vinted avec le lien vers ses informations fiscales, et son
//     e-mail fiscal listé ; un e-mail qui CITE Vinted d'une autre adresse ne
//     compte pas ; le blocage fiscal Vinted (`taxpayer_restricted`) dit ;
//   · le tableur et le PDF d'un compte disent le MÊME nombre de ventes et le
//     MÊME total que la carte ; jamais « encaissé » ;
//   · aucun débordement, cibles ≥ 44 px, aucune erreur.
// Sur le code d'avant : aucune section « DAC7 » par compte (rouge).
const path=require('path'), fs=require('fs'), http=require('http'), zlib=require('zlib');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const { metaVersData } = require('./_meta.cjs');

const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||7974;
const maintenant=new Date();
const AN=maintenant.getFullYear();
const iso=(d)=>d.toISOString();
// Une date de CETTE année, jamais dans le futur : le mois m (0-11) borné au mois courant.
const cetteAnnee=(m,j)=>{ const mm=Math.min(m,maintenant.getMonth()); const d=new Date(AN,mm,Math.min(j,28),12); return d>maintenant?new Date(maintenant.getTime()-3600e3):d; };
const accounts=[
  { id:1, vinted_user_id:'111', login:'atelier_sneak', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(new Date(AN,0,2)), owner:null },
  { id:2, vinted_user_id:'222', login:'paris_kicks', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(new Date(AN,0,2)), owner:null },
  { id:3, vinted_user_id:'333', login:'vieux_compte', domain:'www.vinted.fr', updated_at:iso(maintenant), created_at:iso(new Date(AN,0,2)), owner:null },
];
// [compte, tx, prix, date de vente, date de versement | null]
const VENTES=[];
for(let i=0;i<31;i++) VENTES.push(['111',String(81000+i),12,cetteAnnee(i%9,2+(i%20)),cetteAnnee(i%9,4+(i%20))]);
for(let i=0;i<5;i++) VENTES.push(['222',String(82000+i),60,cetteAnnee(3,3+i),cetteAnnee(3,6+i)]);
VENTES.push(['222','82100',45,cetteAnnee(11,1),null]);                    // finalisée, PAS encore datée
for(let i=0;i<40;i++) VENTES.push(['333',String(83000+i),100,cetteAnnee(5,1+(i%25)),cetteAnnee(5,3+(i%25))]);   // compte MASQUÉ
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:'Commande finalisée', date:iso(v[3]) });
const rows=[];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) if(v[4]) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[4]) } } } });
// Le porte-monnaie de 222 : Vinted le bloque pour ses informations fiscales.
rows.push({ id:'harvest_222_billing', data:{ capturedAt:iso(maintenant), payload:{ balance:{amount:'10.0',currency_code:'EUR'}, taxpayer_restricted:true } } });
rows.push({ id:'harvest_111_billing', data:{ capturedAt:iso(maintenant), payload:{ balance:{amount:'5.0',currency_code:'EUR'}, taxpayer_restricted:false } } });
// Leboncoin : un compte, deux ventes finalisées cette année.
const LBC={ T1:{ txId:'T1', isSeller:true, price:4500, dateVente:iso(cetteAnnee(6,10)), stepStatus:'done', title:'LBC inventé 1', account:'lbc-account:AAA111' },
  T2:{ txId:'T2', isSeller:true, price:3550, dateVente:iso(cetteAnnee(7,11)), stepStatus:'done', title:'LBC inventé 2', account:'AAA111' } };
rows.push({ id:'lbc_ventes', data:{ ventes:LBC } });
rows.push({ id:'lbc_accounts', data:{ accounts:{ 'lbc-account:AAA111':{ id:'AAA111', name:'Boutique inventée', type:'particulier', seenAt:iso(maintenant) } } } });
rows.push({ id:'lbc_listings', data:{ lectures:{ AAA111:{ at:iso(maintenant) } } } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });
// Les e-mails fiscaux INVENTÉS (le sujet, l'expéditeur, l'adresse de réception).
const EMAILS=[
  // f1 : la forme RÉELLE de 683 e-mails Vinted conservés (mesuré le 5 nov.) — le relais iCloud « Masquer mon adresse ».
  { id:'email_inconnu_f1', data:{ subject:'Complète tes informations fiscales', from:'"l\'équipe Vinted" <no-reply_at_vinted_fr_ab12cd34ef_gh56ij78@icloud.com> (no-reply@vinted.fr.ab12cd34ef.gh56ij78)', to:'boite@exemple.fr', receivedAt:iso(cetteAnnee(2,4)), brut:'x'.repeat(2000) } },
  { id:'email_inconnu_f2', data:{ subject:`Votre rapport DAC7 ${AN} est disponible`, from:'leboncoin <noreply@leboncoin.fr>', to:'boite@exemple.fr', receivedAt:iso(cetteAnnee(9,2)), brut:'x' } },
  { id:'email_inconnu_f3', data:{ subject:'Rapport DAC7 Vinted (transféré)', from:'Un ami <ami@exemple.com>', to:'boite@exemple.fr', receivedAt:iso(cetteAnnee(9,3)), brut:'x' } },
  { id:'email_inconnu_v1', data:{ subject:'Ton article a été vendu', from:'Vinted <no-reply@vinted.fr>', to:'boite@exemple.fr', receivedAt:iso(cetteAnnee(9,4)), brut:'x' } },
];
rows.push(...EMAILS);

function projette(row,select){
  if(!select||select==='*') return row;
  const out={};
  for(const part of select.split(',')){
    const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim()); if(!m) continue;
    const alias=m[1]||m[2].split('->').pop().replace(/^>/,''); const src=m[2];
    if(src==='id'||src==='updated_at'){ out[alias]=row[src]; continue; }
    if(src==='data'){ out[alias]=row.data; continue; }
    if(/^data(->|->>)/.test(src)){ const reste=src.replace(/^data(->>|->)/,''); let v=row.data; const texte=/->>[^>]*$/.test(src);
      for(const seg of reste.split(/->>|->/)) v=(v==null?null:v[seg]); out[alias]=(v==null)?null:(texte&&typeof v!=='string'?(typeof v==='object'?JSON.stringify(v):String(v)):v); continue; }
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

let ko=0, ok=0; const dit=(c,m,d)=>{ if(c) ok++; else ko++; console.log((c?'  ✅ ':'  ❌ ')+m+(d!==undefined&&!c?' — '+d:'')); };
async function page(b, T, opts={}){
  const ctx=await b.newContext({viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch, acceptDownloads:true, colorScheme:T.sombre?'dark':'light'});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  const lourdes=[];
  await pg.addInitScript((sb)=>{try{localStorage.setItem('vrm_acces_direct','1');if(sb)localStorage.setItem('vinted_dark','true');}catch(_){}},!!T.sombre);
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  await pg.route('**/rest/v1/**',route=>{
    const brute=decodeURIComponent(route.request().url());
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET'){
      try{ const corps=JSON.parse(route.request().postData()||'null'); for(const x of [].concat(corps||[])) if(x&&x.id==='main'&&x.data&&typeof x.data==='object') opts.main=x.data; }catch(_){}
      return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}); }
    if(/select=owner/.test(u)) return j([{ owner:'0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    if(/data->>subject\.ilike/.test(u)) lourdes.push(brute);
    if(opts.emailsKO && /data->>subject\.ilike/.test(u)) return route.fulfill({status:522,contentType:'text/html',body:'<html>522</html>'});
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:opts.main||{}},S)]);
    if(eq) return j(rows.filter(r=>r.id===eq[1]).map(r=>projette(r,S)));
    const lk=/id=like\.([^&]*)/.exec(u);
    if(lk){
      const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$');
      let l=rows.filter(r=>re.test(r.id));
      // Le filtre de la base sur le SUJET (`or=(data->>subject.ilike.*mot*,…)`), servi tel quel.
      const ou=/[?&]or=\(([^&]*)\)/.exec(u);
      if(ou){ const mots=[...ou[1].matchAll(/data->>subject\.ilike\.\*([^*]+)\*/g)].map(m=>m[1].toLowerCase());
        if(mots.length) l=l.filter(r=>{ const s=String((r.data&&r.data.subject)||'').toLowerCase(); return mots.some(m=>s.includes(m)); }); }
      return j(l.map(r=>projette(r,S)));
    }
    return j([]);
  });
  await pg.route('**/api/**',r2=>r2.fulfill({status:200,contentType:'application/json',body:'{"pret":true,"devices":1}'}));
  return { ctx, pg, errs, lourdes };
}
const aller=async(pg,tab,repere,ms=1500)=>{
  await pg.goto(`http://localhost:${PORT}/?tab=${tab}`,{waitUntil:'domcontentloaded'});
  if(repere) await pg.waitForFunction((r)=>document.querySelector(r)||/pas pu s'afficher/.test(document.body.innerText),repere,{timeout:25000}).catch(()=>{});
  await pg.waitForTimeout(ms);
};
const telecharge=async(pg,sel)=>{ const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:20000}),pg.click(sel)]); const p=await dl.path(); return { nom:dl.suggestedFilename(), octets:fs.readFileSync(p) }; };
// Le texte d'un PDF de pdf-lib : flux décompressés, chaînes `<hex> Tj` (WinAnsi).
const texteDuPdf=(octets)=>{ const b=Buffer.from(octets), bin=b.toString('latin1'), out=[]; const re=/stream\r?\n/g; let m;
  while((m=re.exec(bin))){ const d=m.index+m[0].length, f=bin.indexOf('endstream',d); if(f<0) break; let t; try{ t=zlib.inflateSync(b.subarray(d,f)).toString('latin1'); }catch(_){ t=b.subarray(d,f).toString('latin1'); }
    for(const x of t.matchAll(/<([0-9A-Fa-f]*)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj/g)) out.push(x[1]!=null?Buffer.from(x[1],'hex').toString('latin1'):x[2]); re.lastIndex=f; }
  return out.join(' '); };
const lireCsv=(t)=>t.replace(/^\ufeff/,'').split(/\r?\n/).map(l=>l.split(';').map(c=>c.replace(/^"|"$/g,'')));
const carte=(pg,id)=>pg.evaluate((id)=>{ const e=document.querySelector(`[data-dac7-compte="${id}"]`); if(!e) return null; const a=(k)=>e.getAttribute(k); return { etat:a('data-etat'), n:a('data-n'), cts:a('data-cts'), verdict:a('data-verdict'), ad:a('data-a-dater'), partiel:a('data-partiel'), texte:e.innerText, bloque:(e.querySelector('[data-dac7-bloque]')||{getAttribute:()=>null}).getAttribute('data-dac7-bloque') }; },id);
const MODES=[ { nom:'1512 clair', vp:{width:1512,height:950}, sombre:false }, { nom:'1512 sombre', vp:{width:1512,height:950}, sombre:true },
  { nom:'390 clair', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:false }, { nom:'390 sombre', vp:{width:390,height:844}, isMobile:true, hasTouch:true, sombre:true } ];
const ATT111={ n:31, cts:31*1200 }, ATT222={ n:5, cts:5*6000 }, ATTLBC={ n:2, cts:8050 };
const MAIN0={ vinted_regime:'micro', vinted_accounts_hidden:['333'] };

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of MODES){
      console.log(`\n══ ${T.nom}${T.hasTouch?' (tactile)':''}`);
      try{
        const { ctx, pg, errs, lourdes }=await page(b,{...T},{ main:{ ...MAIN0, vinted_dark:!!T.sombre } });
        await aller(pg,'compta','[data-compta-repli]',1500);
        await pg.waitForSelector('#compta-dac7',{state:'attached',timeout:15000}).catch(()=>{});
        if(await pg.locator('#compta-dac7').count()){ await pg.click('#compta-dac7 > summary',{timeout:15000}).catch(()=>{}); }
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-dac7-comptes]'); return e&&e.getAttribute('data-dac7-etat')==='lu'&&!document.querySelector('[data-dac7-rapport="encours"]'); },null,{timeout:30000}).catch(()=>{});
        // Les ventes Vinted se lisent en arrière-plan : on attend qu'elles soient comptées.
        await pg.waitForFunction(()=>{ const e=document.querySelector('[data-dac7-compte="Vinted|111"]'); return e&&e.getAttribute('data-etat')==='lu'&&e.getAttribute('data-n')!=='0'; },null,{timeout:30000}).catch(()=>{});
        const n=await pg.locator('[data-dac7-comptes]').count();
        dit(n===1,'Comptabilité → Le détail → « DAC7 » : une section compte par compte');
        if(!n){ await ctx.close(); continue; }
        const c1=await carte(pg,'Vinted|111'), c2=await carte(pg,'Vinted|222'), c3=await carte(pg,'Vinted|333'), cl=await carte(pg,'Leboncoin|AAA111');
        console.log('   ',JSON.stringify({c1:c1&&{...c1,texte:undefined},c2:c2&&{...c2,texte:undefined},cl:cl&&{...cl,texte:undefined}}));
        dit(c1&&c1.etat==='lu'&&c1.n===String(ATT111.n)&&c1.cts===String(ATT111.cts)&&c1.verdict==='atteint','Vinted · 31 ventes versées ⇒ au-dessus du seuil, au centime',c1&&[c1.n,c1.cts,c1.verdict].join(' '));
        dit(c1&&/Au-dessus du seuil/.test(c1.texte)&&/31 \/ 30/.test(c1.texte),'Vinted · la carte dit « Au-dessus du seuil » et « 31 / 30 »',c1&&c1.texte.replace(/\n/g,' | '));
        dit(c2&&c2.n===String(ATT222.n)&&c2.cts===String(ATT222.cts)&&c2.ad==='1'&&c2.partiel==='1'&&c2.verdict==='','Vinted · 5 ventes + 1 pas encore datée ⇒ « au moins », jamais « sous »',c2&&[c2.n,c2.cts,c2.ad,c2.partiel,c2.verdict].join(' '));
        dit(c2&&/au moins 5 \/ 30/.test(c2.texte)&&/pas encore datée/.test(c2.texte)&&!/Sous le seuil/.test(c2.texte),'Vinted · le manque est NOMMÉ sur la carte',c2&&c2.texte.replace(/\n/g,' | '));
        dit(c2&&c2.bloque==='1'&&c1&&c1.bloque==='0','Vinted · le blocage fiscal du porte-monnaie est dit (et son absence aussi)',`${c2&&c2.bloque} / ${c1&&c1.bloque}`);
        const exclus=await pg.evaluate(()=>{ const e=document.querySelector('[data-dac7-exclus]'); return e?{ attr:e.getAttribute('data-dac7-exclus'), texte:e.innerText }:null; });
        dit(!c3&&exclus&&/Vinted\|333/.test(exclus.attr)&&/vieux_compte/.test(exclus.texte),'compte masqué : aucune carte, et il est DIT',JSON.stringify(exclus));
        dit(cl&&cl.n===String(ATTLBC.n)&&cl.cts===String(ATTLBC.cts)&&/Boutique inventée/.test(cl.texte),'Leboncoin · le compte et ses 2 ventes (même compte avec ou sans « lbc-account: »)',cl&&[cl.n,cl.cts].join(' '));
        const rap=await pg.evaluate(()=>[...document.querySelectorAll('[data-dac7-rapport-p]')].map(e=>({ p:e.getAttribute('data-dac7-rapport-p'), etat:e.getAttribute('data-dac7-rapport'), fiscaux:e.getAttribute('data-dac7-fiscaux'), lien:(e.querySelector('a[data-dac7-ou]')||{}).href||'', texte:e.innerText })));
        const rV=rap.find(x=>x.p==='Vinted'), rL=rap.find(x=>x.p==='Leboncoin');
        dit(rL&&rL.etat==='recu'&&/Rapport reçu/.test(rL.texte),'Leboncoin · le rapport reçu par e-mail est dit',JSON.stringify(rL));
        dit(rV&&rV.etat==='aucun'&&/taxpayer_center/.test(rV.lien),'Vinted · pas de rapport ⇒ où le trouver (ses informations fiscales sur Vinted)',JSON.stringify(rV));
        dit(rV&&rV.fiscaux==='1'&&/informations fiscales/.test(rV.texte)&&!/transféré/.test(rV.texte),'Vinted · l’e-mail fiscal de Vinted listé ; celui d’une autre adresse, jamais',JSON.stringify(rV&&rV.texte));
        dit(lourdes.length>0&&lourdes.every(x=>/or=\(meta->>subject\.ilike/.test(x)&&/select=id,s:meta->>subject,/.test(x)&&!/data->/.test(x)),'les e-mails fiscaux sont lus filtrés par la base sur `meta` et PROJETÉS (jamais `data`, qui décompresse les PDF)',lourdes.join(' | '));
        // Exports du compte 111
        const csv=await telecharge(pg,'[data-dac7-csv="Vinted|111"]');
        const C=lireCsv(csv.octets.toString('utf8')); const i0=C.findIndex(r=>r[0]==='Date'), iT=C.findIndex((r,i)=>i>i0&&r[0]==='Total');
        const nCsv=iT-i0-1, totCsv=iT>0?String(Math.round(Number(C[iT][1].replace(',','.'))*100)):'';
        dit(/^DAC7-\d{4}-Vinted-atelier-sneak\.csv$/.test(csv.nom)&&nCsv===ATT111.n&&totCsv===String(ATT111.cts),'tableur : le compte, ses 31 ventes, le même total',`${csv.nom} · ${nCsv} · ${totCsv}`);
        const pdf=await telecharge(pg,'[data-dac7-pdf="Vinted|111"]');
        const t=texteDuPdf(pdf.octets).replace(/\s+/g,' ');
        const totPdf=(ATT111.cts/100).toFixed(2).replace('.',',');
        dit(/\.pdf$/.test(pdf.nom)&&new RegExp('Total '+totPdf).test(t)&&/31 \/ 30/.test(t)&&/atelier_sneak/.test(t),'PDF : le compte, « 31 / 30 », le même total',t.slice(0,200));
        dit(!/encaiss/i.test(t+csv.octets.toString('utf8')),'jamais « encaissé »');
        const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-dac7-comptes] button, [data-dac7-comptes] select, [data-dac7-comptes] a')].map(e=>Math.round(e.getBoundingClientRect().height)));
        dit(cibles.length&&cibles.every(h=>h>=44),'cibles au doigt ≥ 44 px',cibles.join(','));
        const sombreVu=await pg.evaluate(()=>{ const c=getComputedStyle(document.querySelector('.vrm-d7-carte')).backgroundColor; const m=/(\d+), (\d+), (\d+)/.exec(c); return m?(+m[1]+ +m[2]+ +m[3])/3:null; });
        dit(T.sombre?sombreVu<90:sombreVu>200,`thème ${T.sombre?'sombre':'clair'} appliqué aux cartes`,sombreVu);
        if(process.env.BANC_CAPTURE){ const f=path.join(process.env.BANC_CAPTURE,`dac7-${T.nom.replace(' ','-')}.png`);
          if(T.isMobile){ await pg.evaluate(()=>{ const e=document.getElementById('compta-dac7'); window.scrollTo(0,e.getBoundingClientRect().top+window.scrollY-60); }); await pg.waitForTimeout(300); await pg.screenshot({path:f,fullPage:true}).catch((e)=>console.log('capture',e.message)); }
          else { await pg.locator('#compta-dac7').scrollIntoViewIfNeeded(); await pg.locator('#compta-dac7').screenshot({path:f}).catch((e)=>console.log('capture',e.message)); } }
        const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      }catch(e){ dit(false,T.nom,String(e.message||e).slice(0,200)); }
    }
    // Les e-mails illisibles : « pas lus », jamais « pas reçu ».
    console.log('\n══ e-mails illisibles (390 clair)');
    try{
      const { ctx, pg, errs }=await page(b,MODES[2],{ main:{ ...MAIN0 }, emailsKO:true });
      await aller(pg,'compta','[data-compta-repli]',1500);
      await pg.click('#compta-dac7 > summary',{timeout:15000}).catch(()=>{});
      await pg.waitForFunction(()=>{ const e=document.querySelector('[data-dac7-rapport-p="Vinted"]'); return e&&e.getAttribute('data-dac7-rapport')!=='encours'; },null,{timeout:30000}).catch(()=>{});
      const r=await pg.evaluate(()=>[...document.querySelectorAll('[data-dac7-rapport-p]')].map(e=>[e.getAttribute('data-dac7-rapport-p'),e.getAttribute('data-dac7-rapport'),e.innerText]));
      dit(r.length&&r.every(x=>x[1]==='passu'&&/pas lus/.test(x[2])),'e-mails pas lus ⇒ « e-mails pas lus », jamais « pas encore reçu »',JSON.stringify(r));
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    }catch(e){ dit(false,'e-mails illisibles',String(e.message||e).slice(0,200)); }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ dac7-comptes : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ dac7-comptes : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
