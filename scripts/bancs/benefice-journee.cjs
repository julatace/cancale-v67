// ═══════════════════════════════════════════════════════════════════════════
// BANC : « TON BÉNÉFICE » DANS MA JOURNÉE (20 octobre)
//        npm run build && node scripts/bancs/benefice-journee.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « j'aimerais avoir la possibilité de mettre le bénéfice dans Ma
// journée ». (31 oct.) La carte est LÀ PAR DÉFAUT dès qu'un bénéfice est publié,
// et se range DANS Ma journée (« Modifier » → « Masquer le bénéfice », « + Ajouter »
// → « Ton bénéfice ») — plus d'interrupteur dans Réglages (sa décision). Le choix
// reste `vrm_journee_benefice` (synchronisé) et ses nombres viennent du SEUL propriétaire (§11) : la
// publication `vrm_benefice_jours` de l'écran Ventes, lue par le même crochet
// que la carte de Comptabilité. Ventes inventées (aucune donnée réelle : ce
// banc vit dans le dépôt, qui est public), à 1512 px et à 390 px tactile :
//   A. jamais choisi, ventes illisibles (aucune publication) ⇒ AUCUNE carte (pas
//      de case vide) ; Réglages n'a plus d'interrupteur ; remise exprès par
//      « + Ajouter » ⇒ « — » et « se calcule dans Ventes » (aucun montant) ;
//   B. après Ventes (tous les prix d'achat connus, une charge fixe), JAMAIS
//      choisi ⇒ la carte est là par défaut, et brut, net, couverture et raison sont
//      IDENTIQUES à la carte « Ton bénéfice » de Comptabilité (mois) ;
//   C. un prix d'achat manque ⇒ net « — » (raison « achats ») des deux côtés,
//      même couverture, et la porte « Compléter les prix d'achat » ;
//   D. « Masquer » n'est montré qu'en mode « Modifier » ; il retire la carte
//      (enregistré `false`) ; « + Ajouter » → « Ton bénéfice » la remet (`true`).
// Jugé sur les attributs `data-journee-benef-*` / `data-benef-*`, jamais sur un
// libellé (§6.5).
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4487;

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
const touche=async(pg,sel,T)=>{ const l=pg.locator(sel).first(); await l.scrollIntoViewIfNeeded(); if(T.hasTouch) await l.tap(); else await l.click(); };
// En mode « Modifier » les widgets tremblent (animation sans fin) : on vise sans
// attendre l'immobilité, comme `appuyer` du banc journee-widgets.
const toucheForce=async(pg,sel,T)=>{ const l=pg.locator(sel).first(); await l.evaluate((e)=>e.scrollIntoView({block:'center'})); if(T.hasTouch) await l.tap({force:true}); else await l.click({force:true}); };

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
    for(const T of TAILLES){
      console.log(`\n══ ${T.nom} px${T.hasTouch?' (tactile)':''}`);

      console.log('── A. Jamais choisi, aucune publication');
      await essaie('A'+T.nom,async()=>{
        // Ventes illisibles ⇒ l'app ne publie AUCUN bénéfice (Ma journée est
        // aussi un lecteur des ventes : avec des ventes lues, elle publierait).
        const { ctx, pg, errs }=await page(b,T,{ ventesKO:true });
        const j=await lireJournee(pg);
        dit(j===null,'par défaut et sans bénéfice publié : AUCUNE carte (jamais une case vide)',JSON.stringify(j));
        dit(await pg.locator('[data-journee-benef-activer]').count()===0,'aucun bouton « afficher » hors du mode « Modifier »');
        await aller(pg,'settings','[data-reglage-sombre]',1500);
        dit(await pg.locator('[data-reglage-sombre]').count()>0 && await pg.locator('[data-reglage-benef-journee]').count()===0,'Réglages n’a plus d’interrupteur « Bénéfice dans Ma journée »');
        await aller(pg,'journee','[data-barre-jour]',1500);
        await touche(pg,'[data-widgets-modifier]:visible',T); await pg.waitForTimeout(400);
        await touche(pg,'[data-widgets-ajouter]',T); await pg.waitForTimeout(400);
        const ent=await pg.locator('[data-widget-ajout="benefice"]').count();
        dit(ent===0,'jamais masqué : « Ton bénéfice » n’est pas proposé dans « Ajouter » (il n’est pas retiré)',`${ent}`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      });
      await essaie('A2'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ ventesKO:true, main:{ vrm_journee_benefice:true } });
        const j2=await lireJournee(pg);
        dit(!!j2,'remis exprès (choix venu du nuage) : la carte est là',JSON.stringify(j2));
        dit(!!j2 && j2.etat==='passu' && !j2.brut && !j2.net,'sans publication : « pas su », aucun montant (jamais 0 €)',JSON.stringify(j2));
        const txt=await pg.evaluate(()=>{ const e=document.querySelector('[data-journee-benef]'); return e?e.innerText:''; });
        dit(/écran Ventes/.test(txt) && !/\d+,\d\d\s*€/.test(txt),'elle dit où ça se calcule, sans chiffre',txt.replace(/\n/g,' | ').slice(0,160));
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      });

      console.log('── B. Après Ventes, tous les prix connus, jamais choisi (défaut)');
      await essaie('B'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV_COMPLET, vrm_compta:COMPTA } });
        await publierBenefice(pg);
        const c=await lireCompta(pg);
        const j=await lireJournee(pg);
        console.log(`   Compta ${JSON.stringify(c)}\n   Journée ${JSON.stringify(j)}`);
        dit(!!j,'jamais choisi, bénéfice publié ⇒ la carte est dans Ma journée PAR DÉFAUT');
        dit(await pg.locator('[data-journee-benef-masquer]').count()===0,'hors du mode « Modifier », aucun bouton « Masquer »');
        dit(await pg.locator('.vrm-day-money [data-journee-benef]').count()===1,'CA et bénéfice partagent la même carte');
        dit(await pg.locator('[data-style-courbe=monotone]').count()===1,'graphique hebdomadaire avec courbes monotones');
        dit(!!c && c.etat==='lu' && !!j && j.etat==='lu','les deux cartes lisent la publication',`${c&&c.etat} / ${j&&j.etat}`);
        dit(!!c && !!j && c.brut!=='' && j.brut===c.brut,'BRUT du mois identique à Comptabilité',`${j&&j.brut} · ${c&&c.brut}`);
        dit(!!c && !!j && c.net!=='' && j.net===c.net,'NET du mois identique à Comptabilité (charges et cotisations comprises)',`${j&&j.net} · ${c&&c.net}`);
        dit(!!c && !!j && j.n===c.n && j.ncout===c.ncout && j.couverture===c.couverture && j.raison===c.raison,'même couverture et même raison',`${j&&j.ncout}/${j&&j.n} ${j&&j.couverture} · ${c&&c.ncout}/${c&&c.n} ${c&&c.couverture}`);
        // Aujourd'hui = la même publication, lue directement.
        const att=await pg.evaluate(()=>{ const p=JSON.parse(localStorage.getItem('vrm_benefice_jours')||'null'); const d=new Date(); const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; const t=p&&p.jours&&p.jours[k]; return t?String(t[0]):'0'; });
        dit(!!j && j['jour-n']===att,'aujourd’hui : le nombre de ventes vient de la publication',`${j&&j['jour-n']} · ${att}`);
        const couleur=await pg.evaluate(()=>{ const e=document.querySelector('[data-journee-benef-ligne="net"] .vrm-display'); return e?getComputedStyle(e).color:''; });
        dit(!/rgb\((2[0-9]{2}), ?([0-9]{1,2}), ?([0-9]{1,2})\)/.test(couleur),'aucun rouge sur le bénéfice',couleur);
        dit(await pg.locator('[data-journee-benef-detail]').count()===1,'un lien vers Comptabilité pour le détail');
        if(process.env.BANC_CAPTURE) await pg.locator('.vrm-day-top').screenshot({path:path.join(process.env.BANC_CAPTURE,`journee-benef-${T.nom}.png`)});
        const deb=await pg.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
        dit(deb<=1,'aucun débordement horizontal',`${deb}px`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      });

      console.log('── C. Un prix d’achat manque');
      await essaie('C'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV_PARTIEL, vrm_compta:COMPTA, vrm_journee_benefice:true } });
        await publierBenefice(pg);
        const c=await lireCompta(pg);
        const j=await lireJournee(pg);
        console.log(`   Compta ${JSON.stringify(c)}\n   Journée ${JSON.stringify(j)}`);
        dit(!!c && !!j && j.brut===c.brut && j.n===c.n && j.ncout===c.ncout,'brut et couverture identiques à Comptabilité',`${j&&j.brut} ${j&&j.ncout}/${j&&j.n} · ${c&&c.brut} ${c&&c.ncout}/${c&&c.n}`);
        dit(!!j && j.net==='' && j.raison==='achats' && !!c && c.raison==='achats','net « — », raison « prix d’achat manquants » des deux côtés',`${j&&j.net} ${j&&j.raison} · ${c&&c.raison}`);
        dit(await pg.locator('[data-journee-benef-porte]').count()===1,'la porte « Compléter les prix d’achat » est là');
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      });

      console.log('── D. Masquer et remettre, DANS Ma journée');
      await essaie('D'+T.nom,async()=>{
        const { ctx, pg, errs }=await page(b,T,{ main:{ vinted_sale_overrides:OV_COMPLET, vrm_compta:COMPTA } });
        await publierBenefice(pg);
        await aller(pg,'journee','[data-journee-benef]',2000);
        await touche(pg,'[data-widgets-modifier]:visible',T); await pg.waitForTimeout(500);
        dit(await pg.locator('[data-journee-benef-masquer]').count()===1,'en mode « Modifier » : « Masquer le bénéfice » est là');
        await toucheForce(pg,'[data-journee-benef-masquer]',T); await pg.waitForTimeout(1200);
        const memo=await pg.evaluate(()=>localStorage.getItem('vrm_journee_benefice'));
        dit(await pg.locator('[data-journee-benef]').count()===0 && memo==='false','masqué ⇒ plus de carte, choix enregistré (false)',`${memo}`);
        await touche(pg,'[data-widgets-ajouter]',T); await pg.waitForTimeout(400);
        dit(await pg.locator('[data-widget-ajout="benefice"]').count()===1,'« + Ajouter » propose « Ton bénéfice »');
        await touche(pg,'[data-widget-ajout="benefice"]',T); await pg.waitForTimeout(1200);
        const memo2=await pg.evaluate(()=>localStorage.getItem('vrm_journee_benefice'));
        dit(await pg.locator('[data-journee-benef]').count()===1 && memo2==='true','remis ⇒ la carte revient, choix enregistré (true)',`${memo2}`);
        dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
        await ctx.close();
      });
    }
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ bénéfice-journée : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ bénéfice-journée : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
