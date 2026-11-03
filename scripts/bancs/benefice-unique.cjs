// ═══════════════════════════════════════════════════════════════════════════
// BANC : « BÉNÉFICE » — LE MÊME CHIFFRE SUR TOUS LES ÉCRANS (3 novembre)
//        npm run build && node scripts/bancs/benefice-unique.cjs
// ═══════════════════════════════════════════════════════════════════════════
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
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4491;
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

const TAILLES=[ { nom:'1512', vp:{width:1512,height:950} }, { nom:'390', vp:{width:390,height:844}, isMobile:true, hasTouch:true } ];
async function page(b, T, opts={}){
  const ctx=await b.newContext({viewport:T.vp, isMobile:!!T.isMobile, hasTouch:!!T.hasTouch});
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
const attrs=(pg,sel,pref)=>pg.evaluate(([s,p])=>{ const e=document.querySelector(s); if(!e) return null; const o={}; for(const a of e.getAttributeNames()) if(a.startsWith(p)) o[a.slice(p.length)]=e.getAttribute(a); return o; },[sel,pref]);
const lireCompta=async(pg)=>{
  await aller(pg,'compta','[data-benef-etat]',2500);
  await pg.evaluate(()=>{ const b=document.querySelector('[data-benef-choix="mois"]'); if(b) b.click(); });
  await pg.waitForTimeout(400);
  return attrs(pg,'[data-benef-etat]','data-benef-');
};
const lireJournee=async(pg)=>{
  await aller(pg,'journee','[data-barre-jour]',2500);
  return attrs(pg,'[data-journee-benef]','data-journee-benef-');
};

const MAIN0={ vinted_regime:'micro', vrm_journee_benefice:true, vrm_compta:COMPTA };
const ym=(d)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
// Tous les chiffres d'une notion rendus sur la page : { libellé visible, valeur }.
const notions=(pg,notion)=>pg.evaluate((n)=>[...document.querySelectorAll(`[data-benef-notion="${n}"]`)].filter(e=>!e.closest('details:not([open])')||e.closest('[data-recap-repli]')).map(e=>({ valeur:e.getAttribute('data-benef-valeur'), mois:e.getAttribute('data-benef-mois')||'' })),notion);
const lireJ=async(pg)=>{ await aller(pg,'journee','[data-barre-jour]',2500); const e=await pg.evaluate(()=>{ const x=document.querySelector('[data-journee-benef]'); return x?{ notion:x.getAttribute('data-benef-notion'), valeur:x.getAttribute('data-benef-valeur'), net:x.getAttribute('data-journee-benef-net'), texte:x.innerText }:null; }); return e; };
const lireS=async(pg,periode='mois')=>{ await aller(pg,'dashboard','[data-sv-tuile="benefice"]',2500);
  if(periode!=='mois'){ await pg.evaluate((p)=>{ const b=document.querySelector(`[data-sv-choix="${p}"]`); if(b) b.click(); },periode); await pg.waitForTimeout(600); }
  return pg.evaluate(()=>{ const x=document.querySelector('[data-sv-tuile="benefice"]'); return x?{ notion:x.getAttribute('data-benef-notion'), valeur:x.getAttribute('data-benef-valeur'), brut:x.getAttribute('data-sv-brut'), lib:(x.querySelector('.vrm-sv-tuile-lib')||{}).innerText, val:(x.querySelector('.vrm-sv-tuile-val')||{}).innerText, texte:x.innerText }:null; }); };
const lireC=async(pg)=>{ await aller(pg,'compta','[data-benef-etat]',2500); await pg.evaluate(()=>{ const b=document.querySelector('[data-benef-choix="mois"]'); if(b) b.click(); }); await pg.waitForTimeout(400);
  const c=await pg.evaluate(()=>{ const x=document.querySelector('[data-compta-chiffre="gagne"]'); const s=document.querySelector('[data-benef-etat]'); return x?{ notion:x.getAttribute('data-benef-notion'), valeur:x.getAttribute('data-benef-valeur'), eur:x.getAttribute('data-eur'), net:s&&s.getAttribute('data-benef-net'), texte:x.innerText }:null; });
  await ouvrirAvanceCompta(pg).catch(()=>{});
  await pg.evaluate(()=>{ const d=document.querySelector('[data-recap-repli]'); if(d) d.open=true; }); await pg.waitForTimeout(400);
  const recap=await pg.evaluate((m)=>{ const d=document.querySelector('[data-recap-repli]'); if(!d) return null; const td=d.querySelector(`[data-benef-mois="${m}"]`); const ths=[...d.querySelectorAll('th')].map(t=>t.innerText.trim());
    const iB=ths.findIndex(t=>/^bénéfice$/i.test(t)); const ligne=[...d.querySelectorAll('tbody tr')][0]; const cell=ligne&&iB>=0?ligne.children[iB].innerText.trim():null;
    return { valeur: td?td.getAttribute('data-benef-valeur'):null, cellule:cell, entetes:ths }; },ym(maintenant));
  return { ...c, recap };
};
const cents=(s)=>{ if(s==null) return null; const t=String(s).replace(/\s| | /g,'').replace('€',''); if(t===''||t==='—') return ''; const n=Number(t.replace(',','.').replace(/[^0-9.\-−]/g,'').replace('−','-')); return isFinite(n)?String(Math.round(n*100)):null; };

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}`);
      for(const [lettre,nom,ov] of [['A','tous les prix d’achat connus',OV_COMPLET],['B','un prix d’achat manque',OV_PARTIEL]]){
        console.log(`── ${lettre}. ${nom}`);
        await (async()=>{ try{
          const { ctx, pg, errs }=await page(b,T,{ main:{ ...MAIN0, vinted_sale_overrides:ov } });
          await publierBenefice(pg);
          const j=await lireJ(pg), s=await lireS(pg), c=await lireC(pg);
          const rCell=c&&c.recap?cents(c.recap.cellule):null;
          console.log(`   Ma journée ${JSON.stringify(j&&{v:j.valeur,t:j.texte.replace(/\n/g,' | ')})}\n   Statistiques ${JSON.stringify(s&&{v:s.valeur,brut:s.brut,t:s.texte.replace(/\n/g,' | ')})}\n   Comptabilité ${JSON.stringify(c&&{v:c.valeur,eur:c.eur,t:c.texte})}\n   Récap ${JSON.stringify(c&&c.recap)}`);
          // Les valeurs, lues sur le NOMBRE rendu (pas seulement l'attribut).
          const vJ=j?cents((j.texte.split('\n').find(l=>/€|—/.test(l))||'')):null;
          const vS=s?cents(s.val):null, vC=c?cents(c.texte):null;
          const ref=c&&c.net!=null?(c.net===''?'':String(Math.round(Number(c.net)*100))):null;
          dit(ref!==null,'Comptabilité dit son bénéfice (la règle)',`${c&&c.net}`);
          dit(!!s && /^Bénéfice$/.test((s.lib||'').trim()) && vS!==null && (ref===''?vS==='':Math.abs(Number(vS)-Number(ref))<=0),'Statistiques (Mois) « Bénéfice » = Comptabilité',`${s&&s.val} · ${c&&c.texte}`);
          // Ma journée arrondit à l'euro dans sa case : on compare l'attribut, puis l'arrondi.
          dit(!!j && j.valeur===(ref===''?'':ref) && (ref===''?vJ==='':Math.abs(Number(vJ)-Number(ref))<=50),'Ma journée « Bénéfice » = Comptabilité',`${j&&j.texte.replace(/\n/g,' | ')} · ${c&&c.texte}`);
          dit(!!c && !!c.recap && c.recap.valeur===(ref===''?'':ref) && rCell===(ref===''?'':ref),'récap mensuel, colonne « Bénéfice » du mois = Comptabilité',`${c&&c.recap&&c.recap.cellule} · ${c&&c.texte}`);
          dit(!!c&&!!c.recap&&!c.recap.entetes.some(t=>/net estimé/i.test(t)),'le récap n’appelle plus « Net estimé » le CA après URSSAF',c&&c.recap&&c.recap.entetes.join('|'));
          dit(!!s && !/au moins/.test(s.texte),'jamais « au moins » sur la tuile du bénéfice',s&&s.texte.replace(/\n/g,' | '));
          if(lettre==='B') dit(await pg.locator('[data-benef-porte]').count()>0,'la porte « Compléter les prix d’achat » est là');
          if(process.env.BANC_CAPTURE){ await aller(pg,'dashboard','[data-sv-tuile="benefice"]',1500); await pg.locator('.vrm-sv-tuiles').screenshot({path:path.join(process.env.BANC_CAPTURE,`benefice-unique-stats-${lettre}-${T.nom}.png`)}).catch(()=>{});
            await aller(pg,'journee','[data-journee-benef]',1500); await pg.locator('[data-journee-benef]').first().screenshot({path:path.join(process.env.BANC_CAPTURE,`benefice-unique-journee-${lettre}-${T.nom}.png`)}).catch(()=>{}); }
          if(lettre==='A'){
            console.log('── C. Les autres notions ont d’autres noms');
            const sw=await lireS(pg,'semaine');
            dit(!!sw && /^Bénéfice brut$/.test((sw.lib||'').trim()) && sw.notion==='brut','Statistiques (Semaine) : « Bénéfice brut », une autre notion',sw&&sw.lib);
            // Les cartes vivent sous « Analyse de tes ventes » (un toucher, comme Julien).
            await aller(pg,'cat_ventes',null,1500);
            const bouton=pg.getByRole('button',{ name:/Analyse de tes ventes/ }).first();
            await bouton.waitFor({timeout:15000}).catch(()=>{});
            if(await bouton.count()) await bouton.click();
            await pg.waitForSelector('[data-ventes-benef-n]',{timeout:10000}).catch(()=>{});
            const libs=await pg.evaluate(()=>{ const x=document.querySelector('[data-ventes-benef-n]'); return x?x.innerText:''; });
            dit(/Bénéfice brut/i.test(libs) && !/(^|\n)\s*Bénéfice\s*(\n|$)/i.test(libs) && !/Bénéfice net/i.test(libs),'Ventes : « Bénéfice brut » / « Après frais de vente », jamais « Bénéfice » ni « Bénéfice net »',libs.replace(/\n/g,' | ').slice(0,200));
          }
          const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
          dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
          dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
          await ctx.close();
        }catch(e){ dit(false,lettre+T.nom,String(e.message||e).slice(0,160)); } })();
      }
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ benefice-unique : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ benefice-unique : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
