// Banc : ANNONCES ET VENTES « TROP BROUILLON » (26 octobre).
// Julien, après l'avis d'un ami : les écrans Annonces et Ventes sont trop brouillons.
// Mesuré sur ce banc (données INVENTÉES, deux comptes) avant la passe : une vente ne
// disait ni sa date ni son compte, « À expédier » avait la teinte de « Vendue », la
// première vente était à 870 px sur ordinateur (deux lignes de réglages, un second
// titre « Ventes », une carte « Retirer mon argent » vide) ; une annonce faisait
// 160 px pour un titre, un prix et trois chiffres, avec un titre « Annonces en
// ligne » et une ligne « Annonces de 2 comptes » sous le sélecteur « Compte ».
// Il juge, dans l'espace Vinted (le vrai chemin), à 390 px tactile et 1512 px :
//   · chaque vente porte sa date et son compte (deux comptes) sous le titre ;
//   · « À expédier » porte data-ton="action", « Vendue » non ;
//   · « Bordereaux auto » et « Mes vues » ne sont plus dans la barre ;
//   · pas de « Retirer mon argent » sans argent disponible ;
//   · pas de second titre ni de ligne des comptes dans l'espace Vinted ;
//   · la première vente et la première annonce arrivent plus haut, une annonce est
//     plus basse (plafonds), et rien ne déborde.
// BANC_CAPTURES=dossier : captures d'écran (ECRANS=n écrans défilés, SOMBRE=1).
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require('/home/user/cancale-v67/node_modules/playwright');
const {metaVersData}=require('./_meta.cjs');
const DIST=process.env.BANC_DIST||path.join(__dirname,'..','..','dist');
const OUT=process.env.BANC_CAPTURES||'';
let ko=0;const dit=(c,m,d)=>{if(!c)ko++;console.log((c?'OK  ':'KO  ')+m+(d?' — '+d:''));};
const PORT=Number(process.env.BANC_PORT)||4871;
const now=Date.now(),iso=(j)=>new Date(now-j*86400000).toISOString(),ts=(j)=>Math.floor((now-j*86400000)/1000);
const marques=['Nike','Adidas','Salomon','New Balance','Asics'];
const modeles=['Air Max 1 noir','Samba OG blanc','XT-6 gris','550 crème','Gel-Kayano 14 argent','Spezial bleu','Dunk low panda','Gazelle rouge'];
const ann=(i,u)=>({id:9100+i,title:`${marques[i%5]} ${modeles[i%8]} taille ${38+i%7}`,price:{amount:String(39+i*7)+'.0',currency_code:'EUR'},is_closed:false,is_draft:false,photo:null,brand_title:marques[i%5],size_title:String(38+i%7),status:i%3?'Très bon état':'Bon état',view_count:20+i*9,favourite_count:i%4,nPhotos:6,created_at_ts:ts(2+i*4),promoted:i===2});
const A1=Array.from({length:10},(_,i)=>ann(i)),A2=Array.from({length:6},(_,i)=>ann(10+i));
const num={};[...A1,...A2].forEach((a,i)=>{if(i<13)num[a.id]={numero:String(20+i),...(i%3===0?{buyPrice:String(15+i)}:{})};});
const st=['Le paiement a été validé','Commande finalisée','Colis en cours d\'acheminement','Commande finalisée','Remboursement effectué','Bordereau envoyé au vendeur','Commande finalisée'];
const vente=(i)=>({transaction_id:7700+i,title:`${marques[(i+2)%5]} ${modeles[(i+3)%8]} taille ${39+i%6}`,price:{amount:String(45+i*6),currency_code:'EUR'},status:st[i%7],transaction_user_status:i%7===0||i%7===5?'needs_action':(i%7===4?'failed':'completed'),date:iso(i*2),photo:null});
const V1=Array.from({length:14},(_,i)=>vente(i)),V2=Array.from({length:6},(_,i)=>vente(20+i));
const rows=[{id:'main',data:{vinted_annonce_numeros:num}},
{id:'harvest_111_listings',data:{capturedAt:iso(0),payload:{items:A1}}},{id:'harvest_222_listings',data:{capturedAt:iso(0),payload:{items:A2}}},
{id:'harvest_111_orders_sold',data:{capturedAt:iso(0),payload:{my_orders:V1}}},{id:'harvest_222_orders_sold',data:{capturedAt:iso(0),payload:{my_orders:V2}}},
{id:'harvest_111_billing',data:{capturedAt:iso(0),payload:{user_balance:{available_amount:{amount:'42.5'},escrow_amount:{amount:'310.0'}}}}}];
const ACCS=[{id:1,vinted_user_id:'111',login:'julatace35260',domain:'www.vinted.fr',updated_at:iso(0),created_at:iso(90)},{id:2,vinted_user_id:'222',login:'tomj606',domain:'www.vinted.fr',updated_at:iso(0),created_at:iso(60)}];
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/json','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0];if(f==='/'||!path.extname(f))f='/index.html';const p=path.join(DIST,f);if(!fs.existsSync(p)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(PORT);
const projette=(row,sel)=>{const out={};for(const part of sel.split(',')){const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim());if(!m)continue;const src=m[2],al=m[1]||src.split(/->>|->/).pop();if(src==='id'){out[al]=row.id;continue;}if(src==='data'){out[al]=row.data;continue;}let v=row.data;for(const s of src.replace(/^data(->>|->)/,'').split(/->>|->/))v=v==null?null:v[s];out[al]=v==null?null:(src.includes('->>')&&typeof v==='object'?JSON.stringify(v):v);}return out;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
const plan=(process.env.VUES||'plat_vinted:ventes,plat_vinted:annonces').split(',');
for(const vp of [{width:390,height:844},{width:1512,height:950}]){for(const sombre of (process.env.SOMBRE?[false,true]:[false])){
const ctx=await b.newContext({viewport:vp,colorScheme:sombre?'dark':'light',...(vp.width<600?{isMobile:true,hasTouch:true}:{})});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript((s)=>{try{localStorage.setItem('vrm_acces_direct','1');if(s)localStorage.setItem('vinted_dark','true');}catch(_){}},sombre);
await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,r=>r.abort());
await pg.route('**/rest/v1/**',route=>{const u=decodeURIComponent(metaVersData(route.request().url()));const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
if(/select=owner/.test(u))return route.fulfill({status:400,contentType:'application/json',body:'{}'});if(/\/rest\/v1\/vinted_accounts/.test(u))return j(ACCS);if(route.request().method()!=='GET')return j([]);
const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;const forme=r=>(sel&&!/^id,data|^data$|^data,/.test(sel))?projette(r,sel):({...r,updated_at:iso(0),cap:r.data.capturedAt});
const eq=/[?&]id=eq\.([^&]*)/.exec(u);if(eq)return j(rows.filter(r=>r.id===eq[1]).map(forme));const lk=/[?&]id=like\.([^&]*)/.exec(u);if(lk){const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$');return j(rows.filter(r=>re.test(r.id)).map(forme));}return j([]);});
await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"pret":true}'}));
for(const vue of plan){const [v,sub]=vue.split(':');await pg.goto(`http://localhost:${PORT}/?tab=${v}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);
if(sub){await pg.locator('.vrm-market-space button').filter({hasText:new RegExp('^'+sub+'$','i')}).first().click().catch(e=>console.log('clic',sub,e.message.slice(0,60)));await pg.waitForTimeout(3000);}
const nom=`${v}${sub?'-'+sub:''}-${vp.width}${sombre?'-sombre':''}`;
const W=vp.width;
const m=await pg.evaluate(()=>{const top=(e)=>e?Math.round(e.getBoundingClientRect().top):null;const vis=(e)=>!!e&&e.getBoundingClientRect().height>0;
  const ventes=[...document.querySelectorAll('.vrm-sale-row:not(.vrm-ledger-drawer .vrm-sale-row)')];
  const cartes=[...document.querySelectorAll('[data-carte-annonce]')];
  const etat=(t)=>{const r=ventes.find(x=>(x.querySelector('.vrm-ledger-sale-state')||{}).textContent===t);return r?r.querySelector('.vrm-ledger-sale-state').getAttribute('data-ton'):'absent';};
  const barre=document.querySelector('.vrm-sales-workbar');
  return {nVentes:ventes.length,sous:ventes.slice(0,4).map(x=>(x.querySelector('[data-vente-sous]')||{}).textContent||''),
    tonExp:etat('À expédier'),tonVendue:etat('Vendue'),
    reglagesBarre:barre?!!(barre.querySelector(':scope > div > button[role=switch]')||barre.querySelector(':scope > .vrm-vues')):null,
    retirer:vis(document.querySelector('[data-retirer-argent]')),
    titreAnn:[...document.querySelectorAll('h1,h2,h3')].some(h=>/Annonces en ligne/.test(h.textContent)&&vis(h)),
    titreVentes:[...document.querySelectorAll('.vrm-main h1,.vrm-main h2')].some(h=>/^(Ventes|Vos ventes)$/.test(h.textContent.trim())&&vis(h)),
    lignesComptes:vis(document.querySelector('[data-comptes-annonces]')),
    v0:top(ventes[0]),a0:top(cartes[0]),hA:cartes.length?Math.round(cartes[0].getBoundingClientRect().height):null,nA:cartes.length,
    deborde:document.documentElement.scrollWidth>document.documentElement.clientWidth+1};});
if(sub==='ventes'){
  dit(m.nVentes>=10,`[${W}] les ventes sont rendues`,String(m.nVentes));
  dit(m.sous.length>0&&m.sous.every(t=>/\d{1,2} \S+/.test(t)&&/(julatace35260|tomj606)/.test(t)),`[${W}] chaque vente dit sa date et son compte sous le titre`,JSON.stringify(m.sous));
  dit(m.tonExp==='action'&&m.tonVendue!=='action',`[${W}] « À expédier » se distingue de « Vendue »`,`${m.tonExp} / ${m.tonVendue}`);
  dit(m.reglagesBarre===false,`[${W}] « Bordereaux auto » et « Mes vues » ne sont plus dans la barre (⋯ Outils)`,String(m.reglagesBarre));
  dit(!m.retirer,`[${W}] pas de « Retirer mon argent » sans argent disponible`);
  dit(!m.titreVentes,`[${W}] pas de second titre « Ventes » sous l'onglet Ventes`);
  dit(m.v0!=null&&m.v0<=(W<600?560:660),`[${W}] la première vente arrive plus haut`,String(m.v0));
} else {
  dit(m.nA>=10,`[${W}] les annonces sont rendues`,String(m.nA));
  dit(!m.titreAnn,`[${W}] pas de second titre « Annonces en ligne » sous l'onglet Annonces`);
  dit(!m.lignesComptes,`[${W}] pas de ligne « Annonces de 2 comptes » sous le sélecteur « Compte »`);
  dit(m.hA!=null&&m.hA<=(W<600?150:115),`[${W}] une annonce est compacte`,`${m.hA} px`);
  dit(m.a0!=null&&m.a0<=(W<600?640:660),`[${W}] la première annonce arrive plus haut`,String(m.a0));
}
dit(!m.deborde,`[${W}] aucun débordement horizontal (${nom})`);
dit(!errs.length,`[${W}] aucune erreur (${nom})`,errs[0]);
if(OUT){fs.mkdirSync(OUT,{recursive:true});const n=Number(process.env.ECRANS||2);
for(let k=0;k<n;k++){await pg.evaluate((k)=>{const m=document.querySelector('.vrm-main')||document.scrollingElement;m.scrollTop=k*(m.clientHeight-80);},k);await pg.waitForTimeout(500);await pg.screenshot({path:path.join(OUT,`${nom}-${k}.png`)});}}}
await ctx.close();}}await b.close();srv.close();console.log(ko?`\n${ko} KO`:'\nTout est vert');process.exit(ko?1:0);})();
