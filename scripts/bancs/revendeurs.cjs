// Mise en page mobile, données synthétiques, aucune requête distante.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const dist = path.resolve(__dirname, '../../dist');
const maintenant = new Date().toISOString();
const compte = { id:1, vinted_user_id:'111', login:'compte_de_banc', updated_at:maintenant };
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
(async()=>{
 let b;
 try{
  rows.find(x=>x.id==='lbc_ventes').data.ventes={
   pending:{txId:10,isSeller:true,title:'Colis à préparer',stepLabel:'À expédier',label:{voucherUrl:'https://example.test/label.pdf'}},
   shipped:{txId:11,isSeller:true,title:'Colis en route',parcelStatus:'in_transit',label:{voucherUrl:'https://example.test/old.pdf'}},
   finished:{txId:12,isSeller:true,title:'Colis finalisé',stepStatus:'done',stepLabel:'Terminé',label:{voucherUrl:'https://example.test/final.pdf'}}};
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
  b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();await brancher(p);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));let writes=[];
  await p.route('**/api/ebay',r=>{const body=r.request().method()==='POST'?r.request().postDataJSON():{};const a=body.action;let j={ok:true,connected:true};
   if(a==='messages')j={ok:true,messages:[{id:'m1',itemId:'12',sender:'Acheteur test',subject:'Question sur la paire',body:'Bonjour, disponible ?',responses:['Oui, disponible.']},{id:'m2',itemId:'13',sender:'Autre acheteur',subject:'Autre échange',body:'Quelle taille ?',responses:[]}],totalPages:1};
   if(a==='offresrecues')j={ok:true,offres:[{id:'o1',itemId:'12',titre:'Paire de test',buyer:'Acheteur test',price:85,currency:'EUR',quantity:1,status:'Pending'}],totalPages:1};
   if(['repondre','repondreoffre'].includes(a)){writes.push(body);j={ok:false,error:'Refus simulé eBay'};}
   return r.fulfill({contentType:'application/json',body:JSON.stringify(j)});
  });
  for(const [tab,nom] of [['plat_vinted','Vinted'],['plat_leboncoin','Leboncoin'],['plat_ebay','eBay']]){
   await p.goto(base+'/?tab='+tab);await p.getByRole('heading',{name:nom,exact:true}).waitFor();
   check(await p.locator('.vrm-market-heading img').evaluate(e=>e.complete && e.naturalWidth>0),'logo local chargé '+nom);
   const summary=p.locator('.vrm-platform-summary');check(!await summary.evaluate(e=>e.open),'chiffres secondaires repliés '+nom);
   await summary.locator('summary').click();check(await summary.evaluate(e=>e.open),'chiffres accessibles '+nom);await summary.locator('summary').click();
   for(const width of [320,390,1512]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'espace plateforme sans débordement '+nom+' '+width);}
   if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-desktop.png')});await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-390.png')});}
   await p.setViewportSize({width:390,height:844});
  }
  rows.push({id:'harvest_111_inbox',data:{capturedAt:maintenant,payload:{conversations:[{id:71,opposite_user:{id:22,login:'Client Vinted'},description:'Paire de test',last_message:'Merci',last_message_at:maintenant}]}}},{id:'harvest_111_conv_71',data:{payload:{conversation:{id:71,opposite_user:{id:22},allow_reply:false,messages:[{entity_type:'message',created_at_ts:1700000000,entity:{user_id:22,body:'Bonjour depuis Vinted'}},{entity_type:'status_message',created_at_ts:1700000001,entity:{title:'Colis disponible',pickup:{pickup_code:456789}}},{entity_type:'message',created_at_ts:1700000002,entity:{user_id:111,body:'Merci pour votre achat'}}]}}}});
  await p.goto(base+'/?tab=plat_vinted');
  const nav=p.getByRole('navigation',{name:'Navigation principale'});
  await nav.getByRole('button',{name:'Accueil',exact:true}).waitFor();
  check(JSON.stringify(await nav.getByRole('button').allTextContents()).includes('Accueil'), 'accueil présent dans la navigation mobile');
  check(await nav.getByRole('button').count()===5, 'cinq accès mobiles stables');
  await nav.getByRole('button',{name:'Messages',exact:true}).click();
  await p.locator('[data-conv="71"]').waitFor();
  await p.locator('.vrm-inbox-filters').getByRole('button',{name:/Non lues/}).click();
  check(await p.locator('[data-conv]').count()===0, 'filtre non lu masque la conversation déjà lue');
  check(await p.getByText('Aucune conversation non lue dans cette sélection.',{exact:true}).isVisible(), 'filtre vide expliqué');
  await p.locator('.vrm-inbox-filters').getByRole('button',{name:/Toutes/}).click();
  check(await p.locator('[data-conv="71"]').count()===1, 'toutes les conversations retrouvées');
  await nav.getByRole('button',{name:'Plus',exact:true}).click();
  await p.getByRole('menuitem',{name:'Leboncoin',exact:true}).click();
  await p.getByRole('heading',{name:'Leboncoin',exact:true}).waitFor();
  await nav.getByRole('button',{name:'Plus',exact:true}).click();
  await p.getByRole('menuitem',{name:'Vinted',exact:true}).click();
  check(await p.locator('.vrm-platform-tabs button[aria-current="page"]').innerText()==='Messages', 'section messages retrouvée en revenant sur Vinted');
  await p.goto(base+'/?tab=plat_vinted');await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Messages',exact:true}).click();await p.getByText('Client Vinted',{exact:true}).click();await p.getByText('Bonjour depuis Vinted',{exact:true}).waitFor();
  check(await p.getByText('Merci pour votre achat',{exact:true}).isVisible(),'historique Vinted complet capté');check((await p.locator('.vrm-chat-panel').innerText()).includes('456789'),'code de retrait numérique conservé');
  const send=p.getByRole('button',{name:'Envoyer',exact:true});check(await send.isDisabled(),'conversation sans réponse autorisée bloquée');
  if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'messages-vinted-390.png')});}
  await p.goto(base+'/?tab=dashboard');await p.locator('.vrm-finance-overview').waitFor();check(await p.locator('.vrm-finance-overview').isVisible(),'indicateurs financiers prioritaires');
  await p.locator('.vrm-finance-goal').getByRole('button',{name:'Fixer',exact:true}).click();await p.getByLabel('Objectif de chiffre d’affaires du mois').fill('2000');await p.locator('.vrm-finance-goal').getByRole('button',{name:'OK',exact:true}).click();
  check(await p.getByRole('progressbar',{name:'Progression vers l’objectif du mois'}).getAttribute('aria-valuemax')==='2000','objectif réel saisi avec progression accessible');
  check(await p.locator('.vrm-finance-goal').evaluate(e=>e.getBoundingClientRect().top<document.querySelector('.vrm-finance-stock').getBoundingClientRect().top),'objectif placé avant les détails du stock');

  if(process.env.BANC_CAPTURES)await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'statistiques-390.png')});
  await p.locator('main').evaluate(e=>{e.scrollTop=250;});await p.waitForTimeout(150);
  const avant=await p.locator('main').evaluate(e=>e.scrollTop);
  await nav.getByRole('button',{name:'Stock',exact:true}).click();
  await nav.getByRole('button',{name:'Plus',exact:true}).click();await p.getByRole('menuitem',{name:'Statistiques',exact:true}).click();
  await p.waitForTimeout(800);
  check(avant>100 && Math.abs(await p.locator('main').evaluate(e=>e.scrollTop)-avant)<3, 'position retrouvée après passage dans le stock');

  await p.goto(base+'/?tab=plat_ebay');await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Messages',exact:true}).click();await p.getByText('Acheteur test',{exact:true}).waitFor();
  await nav.getByRole('button',{name:'Stock',exact:true}).click();
  await nav.getByRole('button',{name:'Messages',exact:true}).click();
  await p.getByRole('heading',{name:'eBay',exact:true}).waitFor();
  await p.getByText('Acheteur test',{exact:true}).waitFor();
  check(await p.locator('.vrm-platform-tabs button[aria-current="page"]').innerText()==='Messages', 'messages revient à eBay après un passage dans le stock');
  check(writes.length===0,'ouvrir les messages ne transmet rien');
  await p.getByRole('button',{name:/Acheteur test Question/}).click();check(await p.getByText('Oui, disponible.',{exact:true}).isVisible(),'historique de réponses visible');
  await p.getByLabel('Réponse au message eBay').fill('Merci pour votre message');await p.getByRole('button',{name:'Envoyer la réponse',exact:true}).click();await p.getByRole('button',{name:'Annuler',exact:true}).click();check(writes.length===0,'annuler la réponse ne transmet rien');
  await p.getByRole('button',{name:'Envoyer la réponse',exact:true}).click();await p.getByRole('button',{name:'Annuler',exact:true}).waitFor();await p.getByRole('button',{name:'Annuler',exact:true}).locator('..').getByRole('button',{name:'Envoyer la réponse',exact:true}).click();await p.waitForFunction(()=>document.body.textContent.includes('Refus simulé eBay'));check(writes.length===1 && writes[0].messageId==='m1','réponse associée au message exact');check(await p.getByLabel('Réponse au message eBay').inputValue()==='Merci pour votre message','refus conserve le brouillon');
  await p.getByLabel('Fermer la conversation eBay').click();await p.getByRole('button',{name:'Offres',exact:true}).click();await p.getByText('Paire de test',{exact:true}).waitFor();check(writes.length===1,'lire les offres ne les accepte pas');
  await p.getByRole('button',{name:'Accepter',exact:true}).click();await p.getByRole('button',{name:'Annuler',exact:true}).click();check(writes.length===1,'offre annulée sans écriture');
  await p.goto(base+'/?tab=plat_leboncoin');await p.getByRole('button',{name:'Colis',exact:true}).click();await p.getByText('Colis à préparer',{exact:true}).waitFor();
  check(await p.getByText('Colis en route',{exact:true}).isVisible(),'colis expédié conservé au suivi');check(await p.getByText('Colis finalisé',{exact:true}).count()===0,'colis finalisé retiré des colis actifs');check(await p.locator('.vrm-lbc-package').count()===1,'seul le colis non expédié propose le bordereau');
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement colis '+width);}
  if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'colis-desktop.png')});}check(!errors.length,'aucune erreur JavaScript');console.log(n+' contrôles revendeurs réussis.');
 }finally{if(b)await b.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
