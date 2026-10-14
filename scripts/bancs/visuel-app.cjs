// Mise en page mobile, données synthétiques, aucune requête distante.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const dist = path.resolve(__dirname, '../../dist');
const maintenant = new Date().toISOString();
const compte = { id:1, vinted_user_id:'111', login:'Bordeaux', updated_at:maintenant };
const ventes = [
  { transaction_id:9001, title:'New Balance 550 crème et forêt taille 42', price:{amount:'95',currency_code:'EUR'}, status:'Paiement validé', date:maintenant },
  { transaction_id:9002, title:'Nike P-6000 argent avec un titre volontairement long taille 43', price:{amount:'120',currency_code:'EUR'}, status:'Commande finalisée', date:maintenant },
];
const rows = [{id:'harvest_111_orders_sold',data:{capturedAt:maintenant,payload:{my_orders:ventes}}}];
const pixel='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=';
ventes[0].photo={url:'https://images1.vinted.net/test.png'};
rows.push({id:'email_invoice_test',data:{type:'facture_pro',status:'draft',account:compte.login,number:'FA1',designation:ventes[0].title,prix:95,buyerEmail:'acheteur@example.test'}},
{id:'lbc_ventes',data:{ventes:{one:{txId:1,isSeller:true,title:'Paire Leboncoin',price:9500,photo:'data:image/png;base64,'+pixel,stepStatus:'done',stepLabel:'Terminé'}}}},
{id:'ebay_orders',data:{orders:[{orderId:'1',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_FULFILLED',lineItems:[{title:'Paire eBay',legacyItemId:'12'}],pricingSummary:{total:{value:'95',currency:'EUR'}}}]}},
{id:'ebay_listings',data:{items:[{itemId:'12',imageUrl:'data:image/png;base64,'+pixel}]}});
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server = http.createServer((q,r)=>{
  let fichier = new URL(q.url,'http://localhost').pathname;
  if (!path.extname(fichier)) fichier='/index.html';
  const p=path.join(dist,fichier);
  if (!p.startsWith(dist+path.sep)||!fs.existsSync(p)||!fs.statSync(p).isFile()) {r.writeHead(404);return r.end();}
  r.writeHead(200,{'content-type':mime[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(r);
});
let n=0;
const check=(v,label)=>{assert.ok(v,label);console.log('OK '+label);n++;};
async function brancher(p){
  await p.addInitScript(()=>{localStorage.setItem('vrm_acces_direct','1');localStorage.setItem('vrm_zoom','0.65');});
  await p.route('**/*',async r=>{
    const url = new URL(r.request().url());
    if(url.pathname.includes('/rest/v1/')){
      const u=new URL(metaVersData(url.href));
      const json=d=>r.fulfill({contentType:'application/json',body:JSON.stringify(d)});
      if(u.searchParams.get('select')==='owner')return r.fulfill({status:400,contentType:'application/json',body:'{}'});
      if(u.pathname.endsWith('/vinted_accounts'))return json([compte]);
      if(r.request().method()!=='GET')return json([]);
      const filtre=u.searchParams.get('id')||'';
      const re=filtre.startsWith('like.')?new RegExp('^'+filtre.slice(5).replace(/[.]/g,'\\.').replace(/[*%]/g,'.*')+'$'):null;
      let selection=rows.filter(x=>re?re.test(x.id):filtre==='eq.'+x.id || (filtre.startsWith('in.(') && filtre.slice(4,-1).split(',').includes(x.id)));
      const select=u.searchParams.get('select')||'';
      selection=selection.map(x=>{
        const out={...x,cap:maintenant,updated_at:maintenant};
        for(const champ of select.split(',')){
          const m=/^([^:]+):data->>?(.+)$/.exec(champ);if(!m)continue;
          let v=x.data;for(const cle of m[2].split(/->>?/))v=v==null?undefined:v[cle];
          out[m[1]]=v;
        }return out;
      });return json(selection);
    }
    if(url.pathname==='/api/compte' && url.searchParams.get('mode')==='photo')return r.fulfill({contentType:'image/png',body:Buffer.from(pixel,'base64')});
    if(url.pathname.startsWith('/api/'))return r.fulfill({contentType:'application/json',body:'{}'});
    if(url.hostname==='127.0.0.1')return r.continue();
    return r.abort();
  });
}

// Captures et contrôles de la véritable application, sans vendeur réel.
rows.push({id:'main',data:{vinted_annonce_numeros:{9101:{numero:'41',buyPrice:'25'},9102:{numero:'42',buyPrice:'32'}}}},
{id:'harvest_111_listings',data:{capturedAt:maintenant,payload:{items:[
{id:9101,title:'Nike Air Max 90 · taille 43',size_title:'43',status:'Très bon état',price:{amount:'85',currency_code:'EUR'},view_count:126,favourite_count:8,is_closed:false,is_draft:false},
{id:9102,title:'New Balance 2002R · taille 42',size_title:'42',status:'Très bon état',price:{amount:'110',currency_code:'EUR'},view_count:84,favourite_count:5,is_closed:false,is_draft:false}
]}}});
(async()=>{let b;try{
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+server.address().port;
 b=await chromium.launch({executablePath:process.env.BANC_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
 const captures=process.env.BANC_CAPTURES;
 if(captures)fs.mkdirSync(captures,{recursive:true});
 for(const width of [320,390,1440]){
  const ctx=await b.newContext({viewport:{width,height:900},...(width<700?{isMobile:true,hasTouch:true}:{})});
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await brancher(p);
  // Le zoom du bureau est aussi neutre, pour des captures à l'échelle réelle.
  await p.addInitScript(()=>localStorage.setItem('vrm_zoom','1'));
  for(const screen of ['journee','cat_annonces','cat_ventes','cat_achats','inventory','stockvinted','garage','dashboard','compta','settings','plat_vinted','plat_leboncoin','plat_ebay']){
   await p.goto(base+'/?tab='+screen);await p.locator('main').waitFor();
   await p.waitForTimeout(600);
   if(screen==='cat_annonces')await p.locator('[data-carte-annonce]').first().waitFor();
   if(screen==='dashboard')await p.locator('.vrm-finance-overview').waitFor();
   if(screen==='settings')await p.locator('.vrm-settings-page').waitFor();
   const geometry=await p.evaluate(()=>{
    const main=document.querySelector('main');
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,mainOverflow:main.scrollWidth-main.clientWidth,
     rendered:!main.innerText.includes("Cet écran n'a pas pu s'afficher"),
     tabs:[...main.querySelectorAll('.vrm-platform-tabs button')].map(e=>({direction:getComputedStyle(e).flexDirection,height:e.getBoundingClientRect().height})),
     commands:[...main.querySelectorAll('.vrm-sale-commands')].filter(e=>e.children.length).map(e=>{const r=e.getBoundingClientRect(),i=e.closest('.vrm-sale-overview').querySelector('.vrm-sale-info').getBoundingClientRect();return {left:r.left,right:i.right,top:r.top,bottom:r.bottom,infoTop:i.top}}),
     finance:[...main.querySelectorAll('.vrm-finance-overview>.vrm-finance-metric')].map(e=>parseFloat(getComputedStyle(e).paddingLeft))};
   });
   check(geometry.rendered,width+' '+screen+' rendu');
   if(geometry.scroll>geometry.width+1||geometry.mainOverflow>1){console.log('GÉOMÉTRIE',geometry,await p.evaluate(()=>[...document.querySelector('main').querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1}).slice(0,12).map(e=>({tag:e.tagName,classe:e.className,texte:e.textContent.slice(0,65),rect:e.getBoundingClientRect().toJSON()}))));if(captures)await p.screenshot({path:path.join(captures,'debordement-'+screen+'-'+width+'.png')});}
   check(geometry.scroll<=geometry.width+1&&geometry.mainOverflow<=1,width+' '+screen+' sans débordement');
   check(geometry.tabs.every(t=>t.direction==='row'),width+' '+screen+' onglets horizontaux');
   if(screen==='cat_ventes')check(geometry.commands.length>0&&geometry.commands.every(c=>c.left>=c.right-1),width+' actions de vente à droite des informations');
   if(screen==='cat_annonces'&&width<700){const cards=await p.locator('[data-carte-annonce]').evaluateAll(es=>es.map(e=>({height:e.getBoundingClientRect().height,photo:e.querySelector('.vrm-ann-overview>a').getBoundingClientRect().width})));check(cards.every(x=>x.height<=160&&x.photo===44),width+' annonces compactes avec photo portrait');}
   if(screen==='dashboard')check(geometry.finance.length===3&&geometry.finance.every(x=>x>=9),width+' chiffres séparés avec marges lisibles');
   if(captures)await p.screenshot({path:path.join(captures,screen+'-'+width+'.png')});
  }
  check(!errors.length,width+' aucune erreur JavaScript');await ctx.close();
 }
 // Vérifier le thème via son véritable bouton, puis naviguer dans la même session.
 const darkContext=await b.newContext({viewport:{width:390,height:900}});const dp=await darkContext.newPage();await brancher(dp);await dp.addInitScript(()=>localStorage.setItem('vrm_zoom','1'));
 await dp.goto(base+'/?tab=settings');await dp.getByRole('button',{name:'Passer en mode sombre',exact:true}).click();
 for(const [screen,label] of [['cat_annonces','Annonces'],['cat_ventes','Ventes'],['dashboard','Statistiques'],['settings','Réglages'],['plat_ebay','eBay']]){
  await dp.getByRole('button',{name:'Tous les écrans',exact:true}).click();await dp.getByRole('menuitem',{name:label,exact:true}).click();
  if(screen==='cat_annonces')await dp.locator('[data-carte-annonce]').first().waitFor();await dp.waitForTimeout(400);
  check(await dp.locator('html').getAttribute('data-theme')==='dark','mode sombre '+screen+' respecté');check(await dp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mode sombre '+screen+' sans débordement');if(captures)await dp.screenshot({path:path.join(captures,screen+'-dark-390.png')});
 }
 await darkContext.close();
 console.log(n+' contrôles de refonte réussis.');
}finally{await b?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
