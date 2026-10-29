// ═══════════════════════════════════════════════════════════════════════════
// BANC : LES MÊMES CHIFFRES SUR TOUS LES ÉCRANS (revue du 17 octobre)
//        npm run build && node scripts/bancs/chiffres-croises.cjs
// ═══════════════════════════════════════════════════════════════════════════
// Plusieurs écrans ont été restylés le 16 octobre (Statistiques, Comptabilité,
// Ma journée, carte URSSAF). Ce banc les rend sur les MÊMES ventes inventées
// (aucune donnée réelle : il vit dans le dépôt, qui est public), au même
// instant, et compare les NOMBRES rendus pour une même notion — jamais un
// libellé (§6.5) :
//   A. appareil neuf, aucune ligne publiée : la prochaine échéance URSSAF ne
//      dit pas « CA finalisé 0,00 € » sous une carte du mois qui dit « — »
//      (elle retombait sur l'archive vide) ;
//   B. après l'écran Ventes (le propriétaire, §11) : le CA de l'échéance est la
//      somme des mois publiés de sa période, « à payer » en découle ; le récap
//      mensuel dit la règle de la ligne qu'il lit (versement, pas « date de
//      vente ») ; VENDU du mois identique sur Ma journée, Statistiques et
//      Comptabilité ; REÇU du mois identique sur Ma journée et Comptabilité ;
//      le CA déclaré de l'année (Comptabilité) = la somme des mois publiés ;
//   C. eBay illisible : la ligne publiée le dit ; le CA déclaré de Comptabilité
//      ne se présente pas comme complet (il nomme eBay) ;
//   D. (17 octobre) Comptabilité ouverte EN PREMIER sur un appareil qui n'a
//      jamais ouvert Ventes : la carte « Résultat » disait « ton CA déclaré
//      arrive sur cet appareil » sous un « Reçu » chiffré — rien ne l'y
//      amenait. Ligne publiée ailleurs (dans le nuage) ⇒ la carte la lit ;
//      jamais publiée ⇒ « pas su » (aucun montant), puis elle se relit dès
//      qu'une publication arrive. Jugé sur `data-compta-ca-etat` /
//      `data-compta-ca`, jamais sur la phrase.
//   E. (19 octobre) le bénéfice BRUT et NET de Comptabilité (« Ton bénéfice »,
//      mois) = celui de l'écran Ventes (« Ce mois »), sur les mêmes prix
//      d'achat inventés ; prix manquant ⇒ net « — » et la porte ; tout connu ⇒
//      net = net des ventes − charges − cotisations. Jugé sur `data-benef-*`
//      et `data-ventes-benef-*`.
//      (19 oct., suite) E3-E5 : une vente LEBONCOIN (référence VRM-7 sur son
//      annonce) et une commande eBay (SKU VRM-12) reliées à leur fiche PAR
//      IDENTITÉ entrent dans le même bénéfice, Ventes = Comptabilité, et la
//      couverture se dit par plateforme ; une commande eBay SANS SKU (même titre
//      qu'une fiche) n'a aucun prix d'achat ; eBay illisible ⇒ rien n'est publié.
const path=require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'))); }
catch (_) { ({ chromium } = require('/home/user/cancale-v67/node_modules/playwright')); }
const { metaVersData } = require('./_meta.cjs');
const { ouvrirAvanceCompta } = require('./_compta.cjs');
const fs=require('fs'), http=require('http');
const DIST=path.join(__dirname,'..','..','dist');
const PORT=Number(process.env.BANC_PORT)||4486;

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
  ['111','91007',33.3,'Commande finalisée',ilYa(2,10),ilYa(2,14)],
  ['222','91008',27,  'Commande finalisée',ilYa(3,10),ilYa(3,12)],
];
const vente=(v)=>({ transaction_id:Number(v[1]), id:Number(v[1]), title:'Baskets inventées '+v[1], price:{amount:String(v[2]),currency_code:'EUR'}, status:v[3], date:iso(v[4]) });
const rows=[{ id:'main', data:{ vinted_regime:'micro', vinted_urssaf_taux:13.5 } }];
for(const a of accounts){
  const uid=a.vinted_user_id;
  rows.push({ id:`harvest_${uid}_orders_sold`, data:{ capturedAt:iso(maintenant), payload:{ my_orders:VENTES.filter(v=>v[0]===uid).map(vente) } } });
  rows.push({ id:`harvest_${uid}_listings`, data:{ capturedAt:iso(new Date(maintenant.getTime()-60000)), payload:{ items:[] } } });
}
for(const v of VENTES) if(v[5]) rows.push({ id:`harvest_${v[0]}_txn_${v[1]}`, data:{ capturedAt:iso(maintenant), payload:{ transaction:{ id:Number(v[1]), item_id:Number(v[1])+500000, status:450, status_title:'Commande finalisée', status_updated_at:iso(v[5]) } } } });
rows.push({ id:'lbc_ventes', data:{ ventes:{} } });
rows.push({ id:'ebay_orders', data:{ orders:[] } });
// Attendus calculés ICI, jamais lus dans l'app.
const memeMois=(d)=>d.getFullYear()===maintenant.getFullYear()&&d.getMonth()===maintenant.getMonth();
const cents=(x)=>Math.round(x*100);
const venduMois=cents(VENTES.filter(v=>!/annul/i.test(v[3])&&memeMois(v[4])).reduce((s,v)=>s+v[2],0));
const recuMois=cents(VENTES.filter(v=>v[5]&&memeMois(v[5])).reduce((s,v)=>s+v[2],0));

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
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0]; if(f==='/'||!path.extname(f))f='/index.html';
  const p=path.join(DIST,f); if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':MIME[path.extname(p)]||'application/octet-stream'}); r.end(fs.readFileSync(p));});
srv.on('error',(e)=>{ console.log('❌ le port '+PORT+' est pris ('+e.code+') — relance avec BANC_PORT=…'); process.exit(1); });
srv.listen(PORT);

let ko=0, ok=0; const dit=(c,m,d)=>{ if(c) ok++; else ko++; console.log((c?'  ✅ ':'  ❌ ')+m+(d?' — '+d:'')); };
const essaie=async(nom,f)=>{ try{ await f(); }catch(e){ dit(false,nom,String(e.message||e).slice(0,160)); } };
const eur=(s)=>{ if(s==null) return null; const n=Number(String(s).replace(/\s| | /g,'').replace(/€/g,'').replace(',','.')); return isFinite(n)?n:null; };
// La règle d'arrondi de l'app (aPayerUrssaf), recopiée pour juger : CA en
// centimes × taux, arrondi une fois.
const aPayer=(ca,taux)=>Math.round(Number((Math.round(ca*100)*taux/100).toFixed(6)))/100;

async function page(b, opts={}){
  const ctx=await b.newContext({viewport:{width:1512,height:950}});
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
  await pg.addInitScript(()=>{try{localStorage.setItem('vrm_acces_direct','1');}catch(_){}});
  await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,(r)=>(['image','media','font'].includes(r.request().resourceType())?r.abort():r.continue()));
  await pg.route('**/rest/v1/**',route=>{
    const u=decodeURIComponent(metaVersData(route.request().url()));
    const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*','content-range':`0-${Math.max(0,d.length-1)}/${d.length}`},body:JSON.stringify(d)});
    if(route.request().method()!=='GET') return route.fulfill({status:201,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});
    if(/select=owner/.test(u)) return route.fulfill({status:400,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{"m":1}'});
    if(opts.ebayKO && /ebay_orders/.test(u)) return route.fulfill({status:522,contentType:'text/html',body:'<html>522</html>'});
    if(opts.lignes){ const eq0=/id=eq\.([^&]*)/.exec(u); if(eq0 && opts.lignes[eq0[1]]) return j([projette({ id:eq0[1], data:opts.lignes[eq0[1]] },(/[?&]select=([^&]*)/.exec(u)||[])[1]||null)]); }
    const S=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;
    if(/\/rest\/v1\/vinted_accounts/.test(u)) return j(accounts);
    const eq=/id=eq\.([^&]*)/.exec(u); if(eq&&eq[1]==='main'&&opts.main) return j([projette({id:'main',data:{ vinted_regime:'micro', vinted_urssaf_taux:13.5, ...opts.main }},S)]);
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
  // (29 oct.) le récap mensuel et le résultat vivent dans « Avancé », replié : il l'ouvre comme Julien.
  if(tab==='compta') await ouvrirAvanceCompta(pg).catch(()=>{});
  await pg.waitForTimeout(ms);
};
const publier=async(pg)=>{
  await aller(pg,'cat_ventes',null,500);
  await pg.waitForFunction(()=>{ try{ const v=JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null'); return !!(v&&Array.isArray(v.mois)); }catch(_){ return false; } },null,{timeout:25000}).catch(()=>{});
  return pg.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('vinted_urssaf_mois')||'null'); }catch(_){ return null; } });
};
// L'échéance : l'attribut si l'écran le porte, sinon le texte rendu (le build
// d'avant n'a pas l'attribut — on juge le NOMBRE affiché).
const lireEcheance=(pg)=>pg.evaluate(()=>{
  const e=document.querySelector('[data-echeance-ca]');
  if(e) return { attr:true, ca:e.getAttribute('data-echeance-ca'), apayer:(document.querySelector('[data-echeance-apayer]')||{getAttribute:()=>null}).getAttribute('data-echeance-apayer'), de:e.getAttribute('data-echeance-de'), a:e.getAttribute('data-echeance-a') };
  const t=document.body.innerText||'';
  const i=t.indexOf('Prochaine déclaration'); const bloc=i>=0?t.slice(i,i+600):'';
  const m=/CA finalisé\s*\n?\s*([^\n]+)/.exec(bloc); const p=/À payer ≈\s*\n?\s*([^\n]+)/.exec(bloc);
  return { attr:false, txt:m?m[1].trim():null, ptxt:p?p[1].trim():null, bloc:bloc.slice(0,200) };
});

(async()=>{
  let b;
  try{
    b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});

    console.log('\n── A. Appareil neuf : aucune ligne publiée');
    await essaie('A',async()=>{
      const { ctx, pg, errs }=await page(b);
      await aller(pg,'compta','[data-stats-carte="mois"]',3000);
      const e=await lireEcheance(pg);
      const carteTiret=await pg.evaluate(()=>{ const c=document.querySelector('[data-stats-carte="mois"]'); return c?!c.querySelector('[data-urssaf-declare]'):null; });
      dit(carteTiret===true,'la carte du mois n’a pas de source (elle dit où ça se calcule)',`${carteTiret}`);
      const affiche=e.attr?e.ca:e.txt;
      const nombre=e.attr?(e.ca!==''):(eur(e.txt)!=null);
      dit(!nombre,'la prochaine échéance n’affiche AUCUN montant « CA finalisé » — jamais 0,00 € pour « pas su »',`rendu « ${affiche} »${e.attr?'':' · '+(e.bloc||'').replace(/\n/g,' | ')}`);
      const pAff=e.attr?e.apayer:e.ptxt; const pNombre=e.attr?(e.apayer!==''):(eur(e.ptxt)!=null);
      dit(!pNombre,'ni aucun « à payer »',`rendu « ${pAff} »`);
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });

    console.log('\n── B. Après l’écran Ventes (le propriétaire)');
    await essaie('B',async()=>{
      const { ctx, pg, errs }=await page(b);
      const pub=await publier(pg);
      dit(!!(pub&&Array.isArray(pub.mois)),'l’écran Ventes publie sa ligne');
      await aller(pg,'compta','[data-stats-carte="mois"]',3000);
      const e=await lireEcheance(pg);
      // Sans attribut (build d'avant) : la période se lit dans le libellé rendu.
      let de=e.de?new Date(e.de):null, a=e.a?new Date(e.a):null;
      if(!de && e.bloc){ const q=/T([1-4]) (\d{4})/.exec(e.bloc); if(q){ const y=Number(q[2]), t=Number(q[1]); de=new Date(y,(t-1)*3,1); a=new Date(y,t*3,0); } }
      let attendu=null;
      if(pub&&de&&a) attendu=Math.round(pub.mois.reduce((s,m)=>{ const [y,mo]=m.ym.split('-'); const d=new Date(Number(y),Number(mo)-1,1); return (d>=de&&d<=a)?s+(Number(m.ca)||0):s; },0)*100)/100;
      const rendu=e.attr?eur(e.ca):eur(e.txt);
      dit(attendu!=null&&rendu!=null&&Math.abs(rendu-attendu)<0.005,'le CA de l’échéance = la somme des mois publiés de SA période',`rendu ${rendu} · attendu ${attendu} (${e.de||'?'} → ${e.a||'?'})`);
      const taux=await pg.evaluate(()=>{ const m=/À payer \(([\d,.]+) ?%\)/i.exec(document.body.innerText||''); return m?Number(m[1].replace(',','.')):null; });
      const ap=e.attr?eur(e.apayer):eur(e.ptxt);
      dit(rendu!=null&&taux!=null&&ap!=null&&Math.abs(aPayer(rendu,taux)-ap)<0.005,'et « à payer » en découle, au centime',`${rendu} × ${taux} % → ${ap}`);
      const regle=await pg.evaluate(()=>{ const e=document.querySelector('[data-recap-regle]'); const t=document.body.innerText||''; const i=t.indexOf('Récap comptable mensuel'); return { attr:e?e.getAttribute('data-recap-regle'):null, ditVente:i>=0 && /à leur date de vente/.test(t.slice(i,i+4000)), recap:i>=0 }; });
      dit(regle.recap,'le récap mensuel est rendu (il lit la ligne publiée)');
      dit(regle.attr==='versement'&&!regle.ditVente,'la phrase du récap dit la règle de la ligne qu’il lit (versement), pas « à leur date de vente »',JSON.stringify(regle));
      // Les finalisées du mois sont comptées au VERSEMENT : une vente faite le
      // mois dernier en fait partie. Les écrire « sur N vendues ce mois-ci »
      // les présente comme une partie des vendues — faux sur ces ventes (3
      // finalisées dont 1 vendue le mois dernier, 4 vendues ce mois-ci).
      const carte=await pg.evaluate(()=>{ const c=document.querySelector('[data-stats-carte="mois"]'); const t=c?(c.innerText||''):''; const m=/Ventes finalisées\s*\n\s*(\d+)\s*\n([^\n]*)/i.exec(t); return m?{ n:Number(m[1]), sous:m[2] }:null; });
      dit(!!carte && !/\bsur \d+ vendue/.test(carte.sous),'les finalisées (au versement) ne sont pas écrites « sur N vendues ce mois-ci »',JSON.stringify(carte));
      await aller(pg,'dashboard','[data-dash-stat="caMois"]',3000);
      const dashMois=await pg.evaluate(()=>{ const e=document.querySelector('[data-dash-stat="caMois"]'); return e?Number(e.getAttribute('data-dash-cents')):null; });
      await aller(pg,'journee','[data-vendu-mois]',2500);
      const j=await pg.evaluate(()=>({ v:(document.querySelector('[data-vendu-mois]')||{getAttribute:()=>null}).getAttribute('data-vendu-mois'), r:(document.querySelector('[data-recu-mois]')||{getAttribute:()=>null}).getAttribute('data-recu-mois'), an:(document.querySelector('[data-ca-annee]')||{getAttribute:()=>null}).getAttribute('data-ca-annee') }));
      await aller(pg,'compta','[data-ca-cur]',3000);
      const c=await pg.evaluate(()=>{ const o={}; for(const e of document.querySelectorAll('[data-ca-cur]')) o[e.getAttribute('data-ca-cur')]=e.getAttribute('data-ca-eur'); const r=document.querySelector('[data-compta-resultat]'); o.decl=r?r.getAttribute('data-compta-ca'):null; o.periode=(document.querySelector('[data-ca-periode]')||{getAttribute:()=>null}).getAttribute('data-ca-periode'); return o; });
      console.log(`   rendu : Ma journée vendu ${j.v} reçu ${j.r} · Statistiques vendu ${dashMois} · Compta (${c.periode}) vendu ${c.vendu} reçu ${c.recu} · CA déclaré ${c.decl}`);
      dit(Number(j.v)===venduMois && dashMois===venduMois && c.periode==='mois' && cents(Number(c.vendu))===venduMois,'VENDU du mois : Ma journée = Statistiques = Comptabilité = attendu',`${j.v} · ${dashMois} · ${cents(Number(c.vendu))} · attendu ${venduMois}`);
      dit(Number(j.r)===recuMois && cents(Number(c.recu))===recuMois,'REÇU du mois : Ma journée = Comptabilité = attendu',`${j.r} · ${cents(Number(c.recu))} · attendu ${recuMois}`);
      const an=String(maintenant.getFullYear());
      const declAttendu=pub?Math.round(pub.mois.filter(m=>String(m.ym).slice(0,4)===an).reduce((s,m)=>s+(Number(m.ca)||0),0)*100)/100:null;
      dit(declAttendu!=null && Math.abs(Number(c.decl)-declAttendu)<0.005,'CA déclaré de l’année (Comptabilité) = somme des mois publiés',`${c.decl} · attendu ${declAttendu}`);
      dit(j.an!=null && j.an!=='' && Math.abs(Number(j.an)-Math.round(Number(c.decl)*100))<=1,'(26 oct.) Ma journée « Chiffre d’affaires de l’année » = CA déclaré de Comptabilité',`${j.an} · ${c.decl}`);
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });

    console.log('\n── C. eBay illisible');
    await essaie('C',async()=>{
      const { ctx, pg, errs }=await page(b,{ ebayKO:true });
      const pub=await publier(pg);
      dit(!!(pub&&pub.sources&&pub.sources.eBay==='pasSu'),'la ligne publiée dit « eBay : pas su »',JSON.stringify(pub&&pub.sources));
      await aller(pg,'compta','[data-compta-resultat]',3000);
      const r=await pg.evaluate(()=>{ const e=document.querySelector('[data-compta-resultat]'); const cv=document.querySelector('[data-compta-couverture]'); return { ca:e?e.getAttribute('data-compta-ca'):null, couv:cv?cv.getAttribute('data-compta-couverture'):null, txt:e?(e.innerText||''):'' }; });
      dit(r.ca!=null && r.ca!=='','le CA déclaré de l’année est affiché (ce qu’on sait)',`${r.ca}`);
      dit((r.couv||'').split(',').includes('eBay'),'et il n’est pas présenté comme complet : il nomme eBay, non lu',`couverture=${r.couv} · ${r.txt.replace(/\n/g,' | ').slice(0,160)}`);
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });

    console.log('\n── D. Comptabilité ouverte en premier (appareil qui n’a jamais ouvert Ventes)');
    // Une ligne publiée par un AUTRE appareil (forme de la publication de
    // l'écran Ventes), rangée dans le nuage : montants inventés.
    const an=maintenant.getFullYear();
    const LIGNE={ mois:[{ ym:`${an}-01`, n:2, ca:80.5, par:{} },{ ym:`${an}-02`, n:1, ca:19.5, par:{} },{ ym:`${an-1}-12`, n:4, ca:500, par:{} }], aDater:{ n:0, ca:0, par:{} }, ecartees:0, sources:{ Vinted:'lu', Leboncoin:'lu', eBay:'lu', Vestiaire:'nonRelie' }, declare:'lu', at:Date.now()-3600e3 };
    const lireRes=(pg)=>pg.evaluate(()=>{ const e=document.querySelector('[data-compta-resultat]'); return e?{ etat:e.getAttribute('data-compta-ca-etat'), ca:e.getAttribute('data-compta-ca') }:null; });
    await essaie('D1',async()=>{
      const { ctx, pg, errs }=await page(b,{ main:{ vinted_urssaf_mois:LIGNE } });
      await aller(pg,'compta','[data-compta-resultat]',4000);
      const r=await lireRes(pg);
      dit(!!r && r.etat==='lu' && Number(r.ca)===100,'ligne publiée sur un autre appareil : la carte Résultat la lit (CA de l’année = 100)',JSON.stringify(r));
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });
    await essaie('D2',async()=>{
      const { ctx, pg, errs }=await page(b,{ main:{ vrm_prenom:'' } });
      await aller(pg,'compta','[data-compta-resultat]',4000);
      const r=await lireRes(pg);
      dit(!!r && r.etat==='passu' && r.ca==='','jamais publiée : « pas su », aucun montant',JSON.stringify(r));
      // Une publication arrive (l'écran Ventes d'un autre onglet, ou le
      // nuage) : la carte se relit sans qu'on change d'écran.
      await pg.evaluate((l)=>{ localStorage.setItem('vinted_urssaf_mois',JSON.stringify(l)); window.dispatchEvent(new CustomEvent('vrm:save',{ detail:{ k:'vinted_urssaf_mois' } })); },LIGNE);
      await pg.waitForTimeout(600);
      const r2=await lireRes(pg);
      dit(!!r2 && r2.etat==='lu' && Number(r2.ca)===100,'dès qu’une publication arrive, la carte la lit sans changer d’écran',JSON.stringify(r2));
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });

    console.log('\n── E. Le bénéfice brut et net : Comptabilité = Ventes (19 octobre)');
    // Prix d'achat et frais saisis sur la vente (forme de `vinted_sale_overrides`),
    // inventés. 91004 sans prix d'achat ⇒ couverture partielle, net « — ».
    const lireVentesBenef=async(pg,attendre=25000)=>{
      await aller(pg,'cat_ventes',null,600);
      await pg.waitForFunction(()=>{ try{ return !!JSON.parse(localStorage.getItem('vrm_benefice_jours')||'null'); }catch(_){ return false; } },null,{timeout:attendre}).catch(()=>{});
      const bouton=pg.getByRole('button',{ name:/Analyse de tes ventes/ }).first();
      await bouton.waitFor({timeout:15000}).catch(()=>{});
      if(await bouton.count()) await bouton.click();
      const per=pg.locator('.vrm-period button').first();
      if(await per.count()){ await per.click(); await pg.getByRole('button',{ name:/^Ce mois$/ }).first().click(); }
      await pg.waitForTimeout(700);
      return pg.evaluate(()=>{ const e=document.querySelector('[data-ventes-benef-n]'); return e?{ n:e.getAttribute('data-ventes-benef-n'), ncout:e.getAttribute('data-ventes-benef-ncout'), brut:e.getAttribute('data-ventes-benef-brut'), net:e.getAttribute('data-ventes-benef-net'), couverture:e.getAttribute('data-ventes-benef-couverture'), autres:e.getAttribute('data-ventes-benef-autres') }:null; });
    };
    const lireComptaBenef=async(pg)=>{
      await aller(pg,'compta','[data-benef-etat]',2500);
      await pg.evaluate(()=>{ const b=document.querySelector('[data-benef-choix="mois"]'); if(b) b.click(); });
      await pg.waitForTimeout(400);
      return pg.evaluate(()=>{ const e=document.querySelector('[data-benef-etat]'); const o={ phrase:/pas encore ton bénéfice net/.test(document.body.innerText||'') }; if(!e) return o; for(const a of e.getAttributeNames()) if(a.startsWith('data-benef-')) o[a.slice(11)]=e.getAttribute(a); return o; });
    };
    const OV1={ '91002':{ buyPrice:'20', fees:'2' }, '91003':{ buyPrice:'15' } };
    await essaie('E1',async()=>{
      const { ctx, pg, errs }=await page(b,{ main:{ vinted_sale_overrides:OV1 } });
      const v=await lireVentesBenef(pg);
      const c=await lireComptaBenef(pg);
      console.log(`   rendu : Ventes ${JSON.stringify(v)} · Compta ${JSON.stringify(c)}`);
      const fin=VENTES.filter(x=>/finalis/i.test(x[3])&&memeMois(x[4]));
      const conn=fin.filter(x=>OV1[x[1]]);
      const brutAtt=conn.reduce((s,x)=>s+cents(x[2])-cents(OV1[x[1]].buyPrice),0)/100;
      const netAtt=conn.reduce((s,x)=>s+cents(x[2])-cents(OV1[x[1]].buyPrice)-cents(OV1[x[1]].fees||0),0)/100;
      dit(!!v && Number(v.ncout)===conn.length && Number(v.n)===fin.length && Math.abs(Number(v.brut)-brutAtt)<0.005,'Ventes (ce mois) : brut sur les ventes au prix connu = attendu',`${v&&v.brut} (${v&&v.ncout}/${v&&v.n}) · attendu ${brutAtt} (${conn.length}/${fin.length})`);
      dit(c.etat==='lu' && c.periode==='mois','Comptabilité lit le bénéfice publié par Ventes (mois)',JSON.stringify({etat:c.etat,periode:c.periode}));
      dit(!!v && c.brut!=null && c.brut===v.brut && c['ventes-net']===v.net,'le BRUT et le NET des ventes de Comptabilité = ceux de Ventes',`Compta ${c.brut} / ${c['ventes-net']} · Ventes ${v&&v.brut} / ${v&&v.net}`);
      dit(!!v && c.n===v.n && c.ncout===v.ncout,'et la même couverture (prix d’achat connus pour X ventes sur Y)',`${c.ncout}/${c.n}`);
      dit(c['ventes-net']!=null && Math.abs(Number(c['ventes-net'])-netAtt)<0.005,'NET des ventes = attendu (brut − frais des mêmes ventes)',`${c['ventes-net']} · attendu ${netAtt}`);
      dit(c.net==='' && c.raison==='achats','un prix d’achat manque ⇒ net final « — », raison « achats »',`${c.net} · ${c.raison}`);
      dit(await pg.locator('[data-benef-porte]').count()>0,'et la porte « Compléter les prix d’achat » est là');
      dit(!c.phrase,'la phrase « pas encore ton bénéfice net » a disparu');
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });
    await essaie('E2',async()=>{
      const OV2={ ...OV1, '91004':{ buyPrice:'30' } };
      const { ctx, pg, errs }=await page(b,{ main:{ vinted_sale_overrides:OV2 } });
      await publier(pg);
      const v=await lireVentesBenef(pg);
      const c=await lireComptaBenef(pg);
      console.log(`   rendu : Ventes ${JSON.stringify(v)} · Compta ${JSON.stringify(c)}`);
      dit(!!v && c.brut!=null && c.brut===v.brut && c['ventes-net']===v.net && c.n===v.n && c.ncout===c.n,'tout est connu : Comptabilité = Ventes, couverture complète',`Compta ${c.brut} / ${c['ventes-net']} · Ventes ${v&&v.brut} / ${v&&v.net}`);
      if(process.env.BANC_CAPTURE){ for(const w of [1512,390]){ await pg.setViewportSize({width:w,height:950}); await pg.waitForTimeout(300); await pg.locator('[data-benef-etat]').screenshot({path:path.join(process.env.BANC_CAPTURE,`benefice-${w}.png`)}); } }
      const netCalc=Math.round((Number(c['ventes-net'])-Number(c.charges)-Number(c.cotis))*100)/100;
      dit(!!c.net && !!c.cotis && Math.abs(Number(c.net)-netCalc)<0.005,'NET final = net des ventes − charges − cotisations (au centime)',`${c.net} · ${netCalc}`);
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });
    // ── E3-E5 : Leboncoin et eBay reliés PAR IDENTITÉ (19 oct., suite) ──
    const OV3={ ...OV1, '91004':{ buyPrice:'30' } };
    const FICHES={ ann7:{ numero:'7', buyPrice:'25', title:'Samba inventée' }, ann12:{ numero:'12', buyPrice:'30', title:'Air Max inventée' }, ann9:{ numero:'9', buyPrice:'18', title:'XT-6 inventée' } };
    const venteLbc={ txId:'L1', itemId:'501', isSeller:true, price:6000, stepStatus:'done', dateVente:iso(ceMois(1,14)), title:'Samba inventée' };
    const cmdEbay=(orderId,sku,titre,frais)=>({ orderId, orderPaymentStatus:'PAID', creationDate:iso(ceMois(1,15)), pricingSummary:{ total:{ value:'86.50', currency:'EUR' } }, paymentSummary:{ totalDueSeller:{ value:'80.00', currency:'EUR' } }, lineItems:[{ sku, legacyItemId:'9'+orderId.replace(/\D/g,''), title:titre }], ...(frais!=null?{ totalMarketplaceFee:{ value:String(frais), currency:'EUR' } }:{}) });
    const lignesE=(cmds)=>({ lbc_ventes:{ ventes:{ L1:venteLbc } }, lbc_listings:{ items:{ '501':{ id:'501', subject:'Samba inventée', customRef:'VRM-7' } } }, ebay_orders:{ orders:cmds } });
    const vintedBrut=VENTES.filter(x=>/finalis/i.test(x[3])&&memeMois(x[4])).reduce((t,x)=>t+cents(x[2])-cents(OV3[x[1]].buyPrice),0);
    const vintedFrais=VENTES.filter(x=>/finalis/i.test(x[3])&&memeMois(x[4])).reduce((t,x)=>t+cents(OV3[x[1]].fees||0),0);
    await essaie('E3',async()=>{
      const { ctx, pg, errs }=await page(b,{ main:{ vinted_sale_overrides:OV3, vinted_annonce_numeros:FICHES }, lignes:lignesE([cmdEbay('E1','VRM-12','Air Max inventée',9.6)]) });
      await publier(pg);
      const v=await lireVentesBenef(pg);
      const c=await lireComptaBenef(pg);
      console.log(`   rendu : Ventes ${JSON.stringify(v)} · Compta ${JSON.stringify(c)}`);
      // (20 oct.) eBay compte l'argent REÇU : 80 dû − 9,60 de frais (le port de l'acheteur, 6,50, n'est pas compté).
      const brutAtt=(vintedBrut+cents(60)-cents(25)+cents(80)-cents(9.6)-cents(30))/100;
      const netAtt=(vintedBrut-vintedFrais+cents(60)-cents(25)+cents(80)-cents(9.6)-cents(30))/100;
      dit(!!v && Math.abs(Number(v.brut)-brutAtt)<0.005 && Number(v.n)===5 && Number(v.ncout)===5,'Ventes : la vente Leboncoin (réf VRM-7) et la commande eBay (SKU VRM-12) entrent dans le bénéfice, au prix d’achat de LEUR fiche',`${v&&v.brut} (${v&&v.ncout}/${v&&v.n}) · attendu ${brutAtt} (5/5)`);
      dit(!!v && Math.abs(Number(v.net)-netAtt)<0.005,'Ventes : le net ne retire pas une seconde fois les frais eBay (déjà retirés de l’argent reçu)',`${v&&v.net} · attendu ${netAtt}`);
      dit(!!v && c.brut===v.brut && c['ventes-net']===v.net && c.n===v.n && c.ncout===v.ncout,'Comptabilité = Ventes (brut, net, couverture)',`Compta ${c.brut} / ${c['ventes-net']} (${c.ncout}/${c.n})`);
      dit(/Leboncoin 1\/1/.test(c.couverture||'') && /eBay 1\/1/.test(c.couverture||'') && c.plateformes==='toutes','la couverture se dit par plateforme dans Comptabilité',`${c.couverture} · ${c.plateformes}`);
      const txt=await pg.evaluate(()=>{ const e=document.querySelector('[data-benef-etat]'); return e?e.innerText:''; });
      dit(!/Leboncoin et eBay n.ont pas de prix d.achat reliés/.test(txt),'la phrase « Leboncoin et eBay n’ont pas de prix d’achat reliés » a disparu');
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });
    await essaie('E4',async()=>{
      // Commande eBay SANS SKU, au titre identique à la fiche 9 : aucun prix d'achat.
      const { ctx, pg, errs }=await page(b,{ main:{ vinted_sale_overrides:OV3, vinted_annonce_numeros:FICHES }, lignes:lignesE([cmdEbay('E2','','XT-6 inventée',7)]) });
      await publier(pg);
      const v=await lireVentesBenef(pg);
      const c=await lireComptaBenef(pg);
      console.log(`   rendu : Ventes ${JSON.stringify(v)} · Compta ${JSON.stringify(c)}`);
      dit(!!v && Number(v.n)===5 && Number(v.ncout)===4 && /eBay 0\/1/.test(v.couverture||''),'eBay sans SKU : comptée dans la couverture, sans prix d’achat (jamais par le titre)',`${v&&v.ncout}/${v&&v.n} · ${v&&v.couverture}`);
      dit(c.ncout===v.ncout && c.n===v.n && c.net==='' && c.raison==='achats','Comptabilité : même couverture, net final « — » (raison achats)',`${c.ncout}/${c.n} · ${c.net} · ${c.raison}`);
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });
    await essaie('E5',async()=>{
      const { ctx, pg, errs }=await page(b,{ main:{ vinted_sale_overrides:OV3, vinted_annonce_numeros:FICHES }, lignes:lignesE([]), ebayKO:true });
      const v=await lireVentesBenef(pg,6000);
      const pub=await pg.evaluate(()=>localStorage.getItem('vrm_benefice_jours'));
      dit(!!v && v.autres==='passu','eBay illisible : l’écran Ventes le dit (ce bénéfice ne porte que sur Vinted)',JSON.stringify(v));
      dit(pub==null,'et ne publie AUCUN bénéfice partiel pour Comptabilité',String(pub).slice(0,80));
      dit(errs.length===0,'aucune erreur d’app',errs.join(' | ').slice(0,160));
      await ctx.close();
    });
  }catch(e){ dit(false,'le banc s’exécute',String(e.message||e).slice(0,160)); }
  finally{
    if(b) await b.close(); srv.close();
    console.log(ko?`\n❌ chiffres-croisés : ${ko} rouge(s), ${ok} vert(s)`:`\n✅ chiffres-croisés : ${ok} verts, 0 rouge`);
    process.exit(ko?1:0);
  }
})();
