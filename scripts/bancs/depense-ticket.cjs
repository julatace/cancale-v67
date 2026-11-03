// ═══════════════════════════════════════════════════════════════════════════
// BANC : LA BOÎTE À DÉPENSES — LE TICKET EN PHOTO (3 novembre)
//        npm run build && node scripts/bancs/depense-ticket.cjs
// ═══════════════════════════════════════════════════════════════════════════
// (3 nov., Julien) Compta → « Ajouter une dépense » avec la PHOTO du ticket ;
// montant, date, catégorie à lui ; le montant lu SEULEMENT si c'est gratuit et
// local. Données INVENTÉES (le dépôt est public), 1512 px sombre et 390 px
// tactile clair. Le banc :
//   A. le détecteur de texte du navigateur (simulé) lit « TOTAL TTC 12,50 » ⇒
//      le champ est PRÉ-REMPLI, rien n'est écrit avant « Ajouter » ;
//   B. « Ajouter » : la photo part dans SA ligne (`depense_ticket_{id}`, jamais
//      `main`), la dépense porte `ticket:true` et sa catégorie (« Envois ») ;
//   C. le bénéfice du mois de Comptabilité baisse d'exactement 12,50 € (la règle
//      existante : dépenses dans leur mois) ;
//   D. la ligne a son bouton « ticket » qui rouvre la photo ;
//   E. sans détecteur et sans réseau (Tesseract injoignable) : champ vide, aucun
//      message d'erreur, la dépense s'ajoute à la main ;
//   F. les catégories sont celles de Julien.
// (Base servie reprise du banc `benefice-unique`.)
const path=require('path'), fs=require('fs'), http=require('http');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const NM=fs.realpathSync(path.join(__dirname,'..','..','node_modules'));

const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4495;
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
const COMPTA={ depenses:[], packs:[], abonnements:[], fixes:[{ id:'f1', label:'Local inventé', montant:20 }] };

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
      (opts.corps=opts.corps||[]).push({ url:u, corps:route.request().postData()||'' });
      try{ const corps=JSON.parse(route.request().postData()||'null'); for(const x of [].concat(corps||[])){ if(x&&x.id==='main'&&x.data&&typeof x.data==='object') opts.main=x.data; else if(x&&x.id){ (opts.ecrits=opts.ecrits||{})[x.id]=x; } } }catch(_){}
      return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'}); }
    if(opts.ventesKO && /orders_sold|orders_\*|_orders_/.test(u)) return route.fulfill({status:522,contentType:'text/html',body:'<html>522</html>'});
    // Base CLOISONNÉE, comme en production : sinon l'app ne pousse jamais `main`
    // au nuage, et « éteint » revenait « allumé » au rechargement (§6.3).
    if(/select=owner/.test(u)) return j([{ owner: process.env.BANC_SESSION_UID || '0b0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0b0b' }]);
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq=/id=eq\.([^&]*)/.exec(u);
    if(eq&&eq[1]==='main') return j([projette({id:'main',data:opts.main||{}},S)]);
    if(eq&&opts.ecrits&&opts.ecrits[eq[1]]) return j([projette(opts.ecrits[eq[1]],S)]);
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

const MAIN0={ vinted_regime:'micro', vrm_journee_benefice:true, vrm_compta:COMPTA };
// Un « ticket » inventé : une image PNG 8×8 (le contenu ne compte pas, le détecteur est simulé).
const TICKET=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGP8//8/A27AhEduBEsDAKXjAxF9kqZqAAAAAElFTkSuQmCC','base64');
const lireBenef=async(pg)=>pg.evaluate(()=>{ const g=document.querySelector('[data-compta-chiffre="gagne"]'); return g?g.getAttribute('data-benef-valeur'):null; });
const ouvrirForm=async(pg)=>{
  await pg.evaluate(()=>{ for(const d of document.querySelectorAll('details[data-compta-repli]')) d.open=true; }); await pg.waitForTimeout(300);
  await pg.click('[data-dep-ouvrir]'); await pg.waitForSelector('[data-dep-form]',{timeout:8000});
};
(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}${T.sombre?' sombre':''}`);
      for(const [lettre,detecteur] of [['A–D',true],['E',false]]){
        console.log(`── ${lettre}. ${detecteur?'le détecteur lit le ticket':'aucune lecture possible'}`);
        try{
          const opts={ main:{ ...MAIN0, vinted_dark:!!T.sombre, vinted_sale_overrides:OV_COMPLET } };
          const { ctx, pg, errs }=await page(b,T,opts);
          // Aucun réseau extérieur (jsdelivr compris) : la lecture distante est impossible.
          await pg.route(/cdn\.jsdelivr\.net/,(r)=>r.abort());
          if(detecteur) await pg.addInitScript(()=>{ window.TextDetector=class{ async detect(){ return [{rawValue:'BOUTIQUE INVENTEE'},{rawValue:'SOUS-TOTAL 10,42'},{rawValue:'TVA 2,08'},{rawValue:'TOTAL TTC 12,50 EUR'},{rawValue:'CB 12,50'}]; } }; });
          await publierBenefice(pg);
          await aller(pg,'compta','[data-benef-etat]',2500);
          const v0=await lireBenef(pg);
          await ouvrirForm(pg);
          const cats=await pg.evaluate(()=>[...document.querySelectorAll('[data-dep-cat]')].map(e=>e.getAttribute('data-dep-cat')));
          dit(JSON.stringify(cats)===JSON.stringify(['Emballage','Achats de stock','Envois','Abonnements','Autre']),'F. les catégories de Julien',cats.join(', '));
          dit(await pg.locator('[data-dep-ticket]').count()===1,'« Photo du ticket » dans le formulaire');
          const avantEcrits=(opts.corps||[]).length; const compta0=await pg.evaluate(()=>localStorage.getItem('vrm_compta'));
          await pg.setInputFiles('[data-dep-ticket-fichier]',{ name:'ticket.png', mimeType:'image/png', buffer:TICKET });
          await pg.waitForSelector('[data-dep-ticket-apercu]',{timeout:8000});
          await pg.waitForFunction(()=>{ const m=document.querySelector('[data-dep-montant]'); return m && m.getAttribute('data-dep-montant-lu')!=='lecture'; },null,{timeout:20000}).catch(()=>{});
          const montant=await pg.inputValue('[data-dep-montant]');
          const lu=await pg.getAttribute('[data-dep-montant]','data-dep-montant-lu');
          if(detecteur) dit(montant==='12,50' && lu==='lu','A. le montant TOTAL TTC est pré-rempli (pas le sous-total ni la TVA)',`${montant} · ${lu}`);
          else dit(montant==='' && lu==='','E. rien de lu : le champ reste vide',`« ${montant} »`);
          const msg=await pg.evaluate(()=>{ const e=document.querySelector('[data-dep-erreur]'); return e?e.innerText:''; });
          dit(msg==='','aucun message après la photo',msg);
          dit((opts.corps||[]).slice(avantEcrits).every(c=>!c.corps.includes('data:image/')) && await pg.evaluate(()=>localStorage.getItem('vrm_compta'))===compta0,'rien n’est écrit avant « Ajouter »');
          if(!detecteur) await pg.fill('[data-dep-montant]','12,50');
          await pg.click('[data-dep-cat="Envois"]');
          await pg.click('[data-dep-ajouter]');
          await pg.waitForFunction(()=>!document.querySelector('[data-dep-form]'),null,{timeout:10000}).catch(()=>{});
          await pg.waitForTimeout(1500);
          const compta1=await pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('vrm_compta')||'null'); }catch(_){ return null; } });
          const dep=((compta1||{}).depenses||[])[0]||null;
          const ligne=dep&&opts.ecrits&&opts.ecrits['depense_ticket_'+dep.id];
          dit(!!dep && dep.ticket===true && dep.cat==='Envois' && Math.round(dep.montant*100)===1250,'B. la dépense : 12,50 €, « Envois », ticket joint',JSON.stringify(dep));
          dit(!!ligne && /^data:image\//.test((ligne.data||{}).b64||''),'B. la photo est dans SA ligne depense_ticket_{id}');
          const images=(opts.corps||[]).filter(c=>c.corps.includes('data:image/'));
          dit(images.length>=1 && images.every(c=>/"id":"depense_ticket_/.test(c.corps) && !/"id":"main"/.test(c.corps)) && !JSON.stringify(compta1||{}).includes('data:image/'),'B. aucune image ailleurs que dans la ligne du ticket (ni main, ni vrm_compta)',`${images.length} envoi(s) d’image`);
          await aller(pg,'compta','[data-benef-etat]',2500);
          const v1=await lireBenef(pg);
          dit(v0!=null && v0!=='' && v1!=null && v1!=='' && Number(v0)-Number(v1)===1250,'C. le bénéfice du mois baisse de 12,50 €',`${v0} → ${v1}`);
          await pg.evaluate(()=>{ for(const d of document.querySelectorAll('details[data-compta-repli]')) d.open=true; }); await pg.waitForTimeout(300);
          const btn=pg.locator('[data-depense-ticket="1"] [data-depense-voir-ticket]');
          dit(await btn.count()===1,'D. la ligne porte le bouton du ticket');
          if(await btn.count()){ await btn.click(); await pg.waitForSelector('[data-ticket-vu] img',{timeout:8000}).catch(()=>{});
            const src=await pg.evaluate(()=>{ const i=document.querySelector('[data-ticket-vu] img'); return i?i.getAttribute('src').slice(0,11):''; });
            dit(src==='data:image/','D. le ticket se rouvre',src);
            if(process.env.BANC_CAPTURE) await pg.screenshot({path:path.join(process.env.BANC_CAPTURE,`depense-ticket-vu-${T.nom}.png`)}).catch(()=>{});
            await pg.keyboard.press('Escape'); }
          if(process.env.BANC_CAPTURE){ await ouvrirForm(pg).catch(()=>{}); await pg.setInputFiles('[data-dep-ticket-fichier]',{ name:'ticket.png', mimeType:'image/png', buffer:TICKET }).catch(()=>{}); await pg.waitForTimeout(800); await pg.locator('[data-dep-form]').screenshot({path:path.join(process.env.BANC_CAPTURE,`depense-ticket-form-${lettre}-${T.nom}.png`)}).catch(()=>{}); }
          const cibles=await pg.evaluate(()=>[...document.querySelectorAll('[data-dep-ticket],[data-depense-voir-ticket]')].filter(e=>e.offsetParent).map(e=>Math.round(e.getBoundingClientRect().height)));
          dit(cibles.every(h=>h>=44),'cibles ≥ 44 px',cibles.join(','));
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
    console.log(ko?`\n❌ depense-ticket : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ depense-ticket : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
