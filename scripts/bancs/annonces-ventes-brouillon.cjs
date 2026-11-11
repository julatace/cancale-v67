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
const {chromium}=require(require('path').join(__dirname, '..', '..', 'node_modules', 'playwright'));
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
const stA=['Colis en cours d\'acheminement','Colis déposé au point relais','Commande finalisée','Le paiement a été validé','Commande finalisée','Colis déposé en point relais'];
const achat=(i)=>({transaction_id:8800+i,title:`${marques[(i+1)%5]} ${modeles[(i+5)%8]} taille ${40+i%5}`,price:{amount:String(30+i*5),currency_code:'EUR'},status:stA[i%6],transaction_user_status:/relais/.test(stA[i%6])?'needs_action':(/finalis/.test(stA[i%6])?'completed':'waiting'),date:iso(1+i*3),photo:null,conversation_id:9900+i});
const B1=Array.from({length:9},(_,i)=>achat(i)),B2=Array.from({length:4},(_,i)=>achat(20+i));
const conv=(id,login,desc,unread,h)=>({id,unread,updated_at:iso(h/24),description:desc,opposite_user:{id:5000+id,login}});
const C1=[conv(301,'acheteuse_1','Vous feriez 45 € ?',true,2),conv(302,'marc_b','Merci, bien reçu !',false,20),conv(303,'sneaker_fan','Toujours dispo en 42 ?',true,30),conv(304,'lea.v','Je peux venir la chercher ?',false,50)];
const C2=[conv(402,'acheteur_2','Est-ce que la boîte est fournie ?',true,5),conv(403,'paul75','Ok je prends',false,80)];
const rows=[{id:'main',data:{vinted_annonce_numeros:num}},
{id:'harvest_111_orders_purchased',data:{capturedAt:iso(0),payload:{my_orders:B1}}},{id:'harvest_222_orders_purchased',data:{capturedAt:iso(0),payload:{my_orders:B2}}},
{id:'harvest_111_inbox',data:{capturedAt:iso(0),payload:{conversations:C1}}},{id:'harvest_222_inbox',data:{capturedAt:iso(0),payload:{conversations:C2}}},
{id:'harvest_111_listings',data:{capturedAt:iso(0),payload:{items:A1}}},{id:'harvest_222_listings',data:{capturedAt:iso(0),payload:{items:A2}}},
{id:'harvest_111_orders_sold',data:{capturedAt:iso(0),payload:{my_orders:V1}}},{id:'harvest_222_orders_sold',data:{capturedAt:iso(0),payload:{my_orders:V2}}},
...[0,5,7].map(i=>({id:'email_bord_'+(7700+i),data:{transaction:String(7700+i),filename:'bordereau-'+(7700+i)+'.pdf',pdfB64:'JVBERi0x',modele:V1[i].title,account:'julatace35260',receivedAt:iso(i/10),dateLimite:new Date(now+(i+1)*86400000).toLocaleDateString('fr-FR')+' 10 h 00',type:'vinted'}})),
{id:'email_track_mondialrelay_12345678',data:{carrier:'mondialrelay',status:'disponible',suivi:'12345678',code:'482913',lieu:'TABA\'VAP\n12 rue des Lilas\n35000 Rennes',subject:'Votre colis est disponible',receivedAt:iso(1),arriveLe:iso(1),dateLimite:new Date(now+4*86400000).toISOString()}},
{id:'harvest_111_billing',data:{capturedAt:iso(0),payload:{user_balance:{available_amount:{amount:'42.5'},escrow_amount:{amount:'310.0'}}}}}];
const ACCS=[{id:1,vinted_user_id:'111',login:'julatace35260',domain:'www.vinted.fr',updated_at:iso(0),created_at:iso(90)},{id:2,vinted_user_id:'222',login:'tomj606',domain:'www.vinted.fr',updated_at:iso(0),created_at:iso(60)}];
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/json','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{let f=q.url.split('?')[0];if(f==='/'||!path.extname(f))f='/index.html';const p=path.join(DIST,f);if(!fs.existsSync(p)){r.writeHead(404);return r.end();}r.writeHead(200,{'content-type':types[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);}).listen(PORT);
const projette=(row,sel)=>{const out={};for(const part of sel.split(',')){const m=/^(?:([^:]+):)?(.+)$/.exec(part.trim());if(!m)continue;const src=m[2],al=m[1]||src.split(/->>|->/).pop();if(src==='id'){out[al]=row.id;continue;}if(src==='data'){out[al]=row.data;continue;}let v=row.data;for(const s of src.replace(/^data(->>|->)/,'').split(/->>|->/))v=v==null?null:v[s];out[al]=v==null?null:(src.includes('->>')&&typeof v==='object'?JSON.stringify(v):v);}return out;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
// (11 nov., restes) Ventes, Annonces, Achats, Messages sont des onglets de la barre (plus de boutons
// dans un « espace Vinted ») : le vrai chemin est `?tab=ventes` etc. ; `plat_x:sous` clique encore.
const plan=(process.env.VUES||'ventes:ventes,annonces:annonces,achats:achats,messages:messages,cat_bord,journee').split(',');
for(const vp of [{width:390,height:844},{width:1512,height:950}]){for(const sombre of (process.env.SOMBRE?[false,true]:[false])){
const ctx=await b.newContext({viewport:vp,colorScheme:sombre?'dark':'light',...(vp.width<600?{isMobile:true,hasTouch:true}:{})});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.addInitScript((s)=>{try{localStorage.setItem('vrm_acces_direct','1');if(s)localStorage.setItem('vinted_dark','true');}catch(_){}},sombre);
if(process.env.AVB_MUTATION==='ellipse')await pg.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const st=document.createElement('style');st.textContent='[data-colis-limite-texte]{display:inline-block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important}';document.head.appendChild(st);});});
await pg.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/i,r=>r.abort());
await pg.route('**/rest/v1/**',route=>{const u=decodeURIComponent(metaVersData(route.request().url()));const j=d=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(d)});
if(/select=owner/.test(u))return route.fulfill({status:400,contentType:'application/json',body:'{}'});if(/\/rest\/v1\/vinted_accounts/.test(u))return j(ACCS);if(route.request().method()!=='GET')return j([]);
const sel=(/[?&]select=([^&]*)/.exec(u)||[])[1]||null;const forme=r=>(sel&&!/^id,data|^data$|^data,/.test(sel))?projette(r,sel):({...r,updated_at:iso(0),cap:r.data.capturedAt});
const eq=/[?&]id=eq\.([^&]*)/.exec(u);if(eq)return j(rows.filter(r=>r.id===eq[1]).map(forme));const lk=/[?&]id=like\.([^&]*)/.exec(u);if(lk){const re=new RegExp('^'+lk[1].replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$');return j(rows.filter(r=>re.test(r.id)).map(forme));}return j([]);});
await pg.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"pret":true}'}));
for(const vue of plan){const [v,sub]=vue.split(':');await pg.goto(`http://localhost:${PORT}/?tab=${v}`,{waitUntil:'domcontentloaded'});await pg.waitForTimeout(4500);
if(sub&&/^plat_/.test(v)){await pg.locator('.vrm-market-space button').filter({hasText:new RegExp('^'+sub+'$','i')}).first().click().catch(e=>console.log('clic',sub,e.message.slice(0,60)));await pg.waitForTimeout(3000);}
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
    titreAch:[...document.querySelectorAll('.vrm-main h1,.vrm-main h2')].some(h=>/^Achats$/.test(h.textContent.trim())&&vis(h)),
    titreMsg:[...document.querySelectorAll('.vrm-main h1,.vrm-main h2')].some(h=>/^Messages$/.test(h.textContent.trim())&&vis(h)),
    recusTop:top(document.querySelector('[data-recus-email]')),sourcesTop:top(document.querySelector('[data-achats-sources]')),ongletsTop:top(document.querySelector('[data-achats-onglet]')),
    colis0:top(document.querySelector('[data-achats-onglet]')),convTop:top(document.querySelector('.vrm-msg-search')),convEcart:(()=>{const a=document.querySelector('.vrm-messages-sections'),b=document.querySelector('.vrm-msg-search');return a&&b?Math.round(b.getBoundingClientRect().top-a.getBoundingClientRect().bottom):null;})(),
    chev:(()=>{const a=document.querySelector('.vrm-day-money [data-recu-mois]'),c=document.querySelector('.vrm-day-money [data-ca-annee]');if(!a||!c)return null;const r1=a.getBoundingClientRect(),r2=c.getBoundingClientRect();return !(r1.bottom<=r2.top+1||r2.bottom<=r1.top+1||r1.right<=r2.left+1||r2.right<=r1.left+1);})(),
    dateCap:(()=>{const d=document.querySelector('.vrm-day-greeting .vrm-day-date');return d&&d.getBoundingClientRect().height>0?getComputedStyle(d).textTransform:null;})(),
    tete:(()=>{const h=document.querySelector('.vrm-day-greeting .vrm-day-hello'),t=document.querySelector('.vrm-day-greeting .vrm-day-todo');if(!h||!t)return null;const a=h.getBoundingClientRect(),b=t.getBoundingClientRect();const mil=(b.top+b.bottom)/2;return mil>=a.top&&mil<=a.bottom?0:Math.round(Math.min(Math.abs(mil-a.top),Math.abs(mil-a.bottom)));})(),
    limites:[...document.querySelectorAll('[data-bord-card]')].map(c=>{const s=c.querySelector('[data-colis-limite-texte]');if(!s)return null;const rc=c.getBoundingClientRect(),rs=s.getBoundingClientRect();const m=/rgba?\((\d+), ?(\d+), ?(\d+)/.exec(getComputedStyle(s).color)||[];const coupe=(e)=>{for(let x=s;x&&x!==c;x=x.parentElement){const cs=getComputedStyle(x);if(x.scrollWidth>x.clientWidth+1&&(cs.textOverflow==='ellipsis'||cs.overflow==='hidden'||cs.overflowX==='hidden'))return true;}const rg=document.createRange();rg.selectNodeContents(s);const rt=[...rg.getClientRects()];for(let x=s;x&&x!==c.parentElement;x=x.parentElement){const cs=getComputedStyle(x);if(cs.textOverflow==='ellipsis'&&cs.whiteSpace.startsWith('nowrap')&&cs.overflowX!=='visible')return true;if(cs.overflowX!=='visible'||cs.overflowY!=='visible'){const bx=x.getBoundingClientRect();if(rt.some(r=>r.width>0&&(r.left<bx.left-1||r.right>bx.right+1||r.top<bx.top-1||r.bottom>bx.bottom+1)))return true;}if(+cs.webkitLineClamp>0)return true;}return false;};return {coupe:coupe(),deborde:rs.right>rc.right+1,rouge:+m[1]>170&&+m[2]<80&&+m[3]<80,t:s.textContent.trim().slice(0,40)};}).filter(Boolean),
    fraiche:vis(document.querySelector('[data-fraicheur-ventes]')),
    titreEcran:(()=>{const b=document.querySelector('.vrm-mobile-titre,[data-titre-barre]');const t=[...document.querySelectorAll('.vrm-main h1,.vrm-main h2')].filter(h=>vis(h)&&/^(Statistiques|Comptabilité|Argent|Colis|Paramètres|Organisation)$/.test(h.textContent.trim()));return t.map(h=>h.textContent.trim());})(),
    courbeDoublons:(()=>{const c=document.querySelector('[data-stats-courbe]');return c?c.querySelectorAll('[data-chart-caption],[data-chart-compare]').length:null;})(),
    lignesZero:[...document.querySelectorAll('[data-ca-ligne]')].filter(tr=>[...tr.querySelectorAll('td')].slice(1).every(td=>/^0,00/.test(td.textContent.trim()))).length,
    nLignesCa:document.querySelectorAll('[data-ca-ligne]').length,
    pictoSeuls:[...document.querySelectorAll('[data-compta-section] .vrm-pourquoi > summary')].filter(x=>x.textContent.trim().length<3).length,
    v0:top(ventes[0]),a0:top(cartes[0]),a0Barre:(()=>{const w=document.querySelector('.vrm-ann-workbar');return w&&cartes[0]?Math.round(cartes[0].getBoundingClientRect().top-w.getBoundingClientRect().bottom):null;})(),hA:cartes.length?Math.round(cartes[0].getBoundingClientRect().height):null,pA:(()=>{const a=cartes[0]&&cartes[0].querySelector('.vrm-ann-overview > a');return a?Math.round(a.getBoundingClientRect().height):null;})(),nA:cartes.length,
    deborde:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,
    // (11 nov., restes) LA FORME D'AUJOURD'HUI : Ventes « Tous les sites » (`[data-toutes-vente]`), un seul
    // titre d'écran (h1 du ScreenHead), la carte d'annonce en grille « comme Vinted » (décision n° 15).
    titres:[...document.querySelectorAll('.vrm-main h1,.vrm-main h2')].filter(vis).map(h=>h.textContent.trim()),
    tv:(()=>{const rows=[...document.querySelectorAll('[data-toutes-vente]')];const v=(e)=>!!e&&e.getClientRects().length>0&&e.getBoundingClientRect().height>0;
      return {n:rows.length,top:rows[0]?Math.round(rows[0].getBoundingClientRect().top):null,
        meta:rows.slice(0,6).map(r=>[...r.querySelectorAll('.vrm-toutes-meta,.vrm-toutes-bureau')].filter(v).map(x=>x.innerText.replace(/\s+/g,' ')).join(' ')),
        etats:rows.map(r=>{const e=[...r.querySelectorAll('.vrm-toutes-etat,.vrm-toutes-bureau > span:nth-child(3)')].filter(v)[0];return e?[e.textContent.trim(),e.getAttribute('data-ton')]:null;}).filter(Boolean)};})(),
    photoCarte:(()=>{const c=cartes[0],a=c&&c.querySelector('.vrm-ann-overview > a');if(!a)return null;return {pw:Math.round(a.getBoundingClientRect().width),ph:Math.round(a.getBoundingClientRect().height),cw:Math.round(c.getBoundingClientRect().width)};})(),
    conv0:(()=>{const w=document.createTreeWalker(document.querySelector('.vrm-main')||document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))if(n.textContent.trim()==='acheteuse_1'){const e=n.parentElement;if(e.getClientRects().length)return Math.round(e.getBoundingClientRect().top);}return null;})(),
    tetes:(()=>{const g=document.querySelector('.vrm-day-greeting');if(!g)return null;const L=[...g.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.trim()&&e.getClientRects().length&&!e.closest('.vrm-sr-seul,[aria-hidden="true"] .vrm-sr-seul')).map(e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect();return b.width>0?b:e.getBoundingClientRect();});let n=0;for(let i=0;i<L.length;i++)for(let j=i+1;j<L.length;j++){const a=L[i],b=L[j];if(!(a.bottom<=b.top+1||b.bottom<=a.top+1||a.right<=b.left+1||b.right<=a.left+1))n++;}return n;})(),
    dateTexte:(()=>{const re=/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche) \d{1,2} \S+/i;const w=document.createTreeWalker(document.querySelector('.vrm-main')||document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){const m=re.exec(n.textContent);if(m&&n.parentElement.getClientRects().length)return m[0];}return null;})()};});
if(sub==='ventes'){
  // (11 nov., restes) Porté sur l'écran Ventes d'aujourd'hui (tous les sites, `[data-toutes-vente]`) :
  // l'ancien « espace Vinted » à boutons n'existe plus. Mêmes exigences du 26 oct.
  const T=m.tv;
  dit(T.n>=10,`[${W}] les ventes sont rendues`,String(T.n));
  dit(T.meta.length>0&&T.meta.every(t=>/(\d{1,2} \S+|aujourd|hier)/.test(t)&&/(julatace35260|tomj606)/.test(t)),`[${W}] chaque vente dit sa date et son compte`,JSON.stringify(T.meta.slice(0,3)));
  const exp=T.etats.filter(([t])=>/^À (envoyer|expédier)$/.test(t)),vend=T.etats.filter(([t])=>t==='Vendue');
  dit(exp.length>0&&vend.length>0&&exp.every(([,d])=>d==='action')&&vend.every(([,d])=>d!=='action'),`[${W}] « À envoyer » se distingue de « Vendue »`,JSON.stringify([exp[0],vend[0]]));
  dit(m.reglagesBarre!==true,`[${W}] « Bordereaux auto » et « Mes vues » ne sont pas dans une barre`,String(m.reglagesBarre));
  dit(!m.retirer,`[${W}] pas de « Retirer mon argent » sans argent disponible`);
  dit(m.titres.filter(t=>/^(Ventes|Vos ventes)$/.test(t)).length<=1,`[${W}] un seul titre « Ventes »`,JSON.stringify(m.titres));
  // Sous la carte du mois (maquette du 2 nov., voulue) : sur ordinateur, la 1re vente tient dans le
  // premier écran ; au téléphone, la hauteur est rapportée (pas jugée : c'est la maquette).
  dit(m.dateTexte!=null&&!/ [A-ZÉ]\S+$/.test(m.dateTexte),`[${W}] la date s'écrit « … 11 novembre », pas « … 11 Novembre »`,String(m.dateTexte));
  if(W>=600) dit(T.top!=null&&T.top+56<=950,`[${W}] la première vente est dans le premier écran`,String(T.top));
  else console.log(`    [${W}] mesuré : 1re vente à ${T.top} px (écran ${vp.height})`);
} else if(sub==='achats'){
  dit(m.titres.filter(t=>/^Achats$/.test(t)).length<=1,`[${W}] un seul titre « Achats »`,JSON.stringify(m.titres));
  // (11 nov., intégration colis — demande g) « Tes meilleures sources » vient APRÈS la liste d'Achats (jamais au-dessus des étapes et de leurs colis).
  dit(m.sourcesTop==null||(m.ongletsTop!=null&&m.sourcesTop>m.ongletsTop&&(m.recusTop==null||m.sourcesTop<=m.recusTop)),`[${W}] « Tes meilleures sources » après la liste d'Achats`,`${m.sourcesTop} / ${m.ongletsTop} / ${m.recusTop}`);
  dit(m.recusTop!=null&&m.ongletsTop!=null&&m.recusTop>m.ongletsTop,`[${W}] les reçus par email passent sous la liste, plus en tête`,`${m.recusTop} / ${m.ongletsTop}`);
  // (11 nov., restes) Sous la carte « Dépensé » (maquette du 2 nov.) : sur ordinateur dans le premier écran ; téléphone rapporté.
  if(W>=600) dit(m.colis0!=null&&m.colis0+44<=950,`[${W}] les étapes des achats sont dans le premier écran`,String(m.colis0));
  else console.log(`    [${W}] mesuré : étapes des achats à ${m.colis0} px (écran ${vp.height})`);
} else if(sub==='messages'){
  dit(m.titres.filter(t=>/^Messages$/.test(t)).length<=1,`[${W}] un seul titre « Messages »`,JSON.stringify(m.titres));
  // Mesuré depuis le choix Conversations / Favoris (et plus depuis le haut de
  // page) : au-dessus vivent les blocs de suivi posés par Julien le 29 oct.
  // (bilan des données lues, synchronisation par compte). Rien ne doit se
  // glisser entre ce choix et la recherche (second titre, reçus…). Mesuré : 28 px.
  // (11 nov., restes) La recherche des conversations n'est plus en tête (Messages refait) : ce qui compte,
  // la 1re conversation arrive dans le premier écran, aux deux tailles.
  dit(m.conv0!=null&&m.conv0+56<=vp.height-64,`[${W}] la première conversation est dans le premier écran`,String(m.conv0));
} else if(v==='journee'){
  // (11 nov., restes) Ma journée v2 (9 nov.) : plus de carte « Vendu » à deux chiffres ni de « N choses à
  // faire » à côté du bonjour. La règle reste : rien ne se chevauche dans la tête de l'écran, et la
  // date (jugée sur Ventes, où elle s'écrit) ne capitalise pas le mois.
  dit(m.tetes===0,`[${W}] rien ne se chevauche dans la tête de Ma journée`,String(m.tetes));
} else if(v==='dashboard'){
  dit(W<600?m.titreEcran.length===0:m.titreEcran.includes('Argent'),`[${W}] « Argent » (Statistiques, lot AO) : une fois sur téléphone (la barre du haut), présent sur ordinateur`,JSON.stringify(m.titreEcran));
  dit(m.courbeDoublons===0,`[${W}] « Vendu · 12 mois » ne réécrit pas ses mois arrondis autrement`,String(m.courbeDoublons));
} else if(v==='compta'){
  dit(W<600?m.titreEcran.length===0:m.titreEcran.includes('Argent'),`[${W}] « Argent » (Compta, lot AO) : une fois sur téléphone, présent sur ordinateur`,JSON.stringify(m.titreEcran));
  dit(m.nLignesCa>=1&&m.lignesZero===0,`[${W}] le tableau par période ne s'allonge pas de mois sans aucune vente`,`${m.lignesZero} / ${m.nLignesCa}`);
  dit(m.pictoSeuls===0,`[${W}] pas de ⓘ seul sous les cartes de Compta`,String(m.pictoSeuls));
} else if(v==='settings'||v==='organisation'){
  const t=v==='settings'?'Paramètres':'Organisation';
  dit(W<600?m.titreEcran.length===0:m.titreEcran.includes(t),`[${W}] « ${t} » : une fois sur téléphone, présent sur ordinateur`,JSON.stringify(m.titreEcran));
} else if(v==='cat_bord'){
  // (11 nov., restes) Chaque écran porte son h1 au téléphone aussi (ScreenHead, 2 nov.) : une fois, jamais deux.
  dit(W<600?m.titreEcran.length<=1:m.titreEcran.includes('Colis'),`[${W}] « Colis » : une fois sur téléphone, présent sur ordinateur`,JSON.stringify(m.titreEcran));
  dit(m.limites.length>=3,`[${W}] les cartes de Colis portent leur date limite`,String(m.limites.length));
  dit(m.limites.every(x=>!x.deborde),`[${W}] la date limite ne déborde pas de sa carte`,JSON.stringify(m.limites.filter(x=>x.deborde)));
  // (11 nov., intégration colis — défaut f, session restes) La date limite se lit EN ENTIER : ni coupée par l'ellipse, ni masquée par son conteneur.
  dit(m.limites.every(x=>!x.coupe),`[${W}] la date limite se lit en entier (aucune ellipse)`,JSON.stringify(m.limites.filter(x=>x.coupe)));
  dit(m.limites.every(x=>!x.rouge),`[${W}] un retard est ambre, pas rouge (§7)`,JSON.stringify(m.limites.filter(x=>x.rouge)));
  dit(!m.fraiche,`[${W}] pas de « Ventes Vinted à jour » quand tout est à jour`);
} else {
  dit(m.nA>=10,`[${W}] les annonces sont rendues`,String(m.nA));
  dit(!m.titreAnn,`[${W}] pas de second titre « Annonces en ligne » sous l'onglet Annonces`);
  dit(!m.lignesComptes,`[${W}] pas de ligne « Annonces de 2 comptes » sous le sélecteur « Compte »`);
  // (27 oct.) Julien a renversé la décision « compacte » du 26 : « les annonces sont
  // beaucoup trop petites, on ne voit même pas la première photo ». La fiche montre
  // la première photo EN GRAND ; elle arrive quand même plus haut qu'avant (685/707 px).
  // (11 nov., restes) Grille « comme Vinted » (décision n° 15) : en grand = la photo prend TOUTE la largeur
  // de la carte et au moins sa hauteur carrée (au téléphone, deux cartes par ligne : ~176 px).
  const P=m.photoCarte;
  dit(P!=null&&P.pw>=P.cw-2&&P.ph>=Math.round(P.pw*0.9)&&P.ph>=150,`[${W}] la première photo d'une annonce est en grand`,JSON.stringify(P));
  // Mesuré depuis la barre d'outils (recherche, tri, Actions) : au-dessus vivent
  // les blocs posés par Julien (bilan, vendus ailleurs, à compléter, offres auto,
  // 27-29 oct.). Entre la barre et la première fiche, rien que « Stock et
  // ajustements · Publier aussi ailleurs ». Mesuré : 65 px (390), 76 px (1512).
  // (11 nov., restes) Plus, entre les deux, ce que Julien a voulu : « Prix d'achat N/M connus · Compléter »
  // et l'en-tête de compte de la grille (décision n° 15) — mesuré 132 px (390), 140 px (1512).
  dit(m.a0Barre!=null&&m.a0Barre>=0&&m.a0Barre<=160,`[${W}] la première annonce arrive plus haut`,`${m.a0Barre} px sous la barre d'outils (haut ${m.a0})`);
}
dit(!m.deborde,`[${W}] aucun débordement horizontal (${nom})`);
dit(!errs.length,`[${W}] aucune erreur (${nom})`,errs[0]);
if(OUT){fs.mkdirSync(OUT,{recursive:true});const n=Number(process.env.ECRANS||2);
for(let k=0;k<n;k++){await pg.evaluate((k)=>{const m=document.querySelector('.vrm-main')||document.scrollingElement;m.scrollTop=k*(m.clientHeight-80);},k);await pg.waitForTimeout(500);await pg.screenshot({path:path.join(OUT,`${nom}-${k}.png`)});}}}
await ctx.close();}}await b.close();srv.close();console.log(ko?`\n${ko} KO`:'\nTout est vert');process.exit(ko?1:0);})();
