// Mise en page mobile, données synthétiques, aucune requête distante.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { metaVersData } = require('./_meta.cjs');
const dist = process.env.BANC_DIST || path.resolve(__dirname, '../../dist');
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
{id:'ebay_orders',data:{capturedAt:Date.now(),complet:true,orders:[{orderId:'1',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_FULFILLED',lineItems:[{title:'Paire eBay',legacyItemId:'12'}],pricingSummary:{total:{value:'95',currency:'EUR'}}}]}},
{id:'ebay_listings',data:{capturedAt:Date.now(),complet:true,items:[{itemId:'12',imageUrl:'data:image/png;base64,'+pixel}]}});
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
  await p.route('**/api/ebay',r=>{const body=r.request().method()==='POST'?r.request().postDataJSON():{};const a=body.action;let j={ok:true,connected:true,ready:true,canConsent:true};
   if(a==='status')j={ok:true,connected:true,comptes:[{cle:'',ref:'principal',principal:true,pseudo:'Compte de banc',relie:true}]};
   if(a==='commande')j={ok:true,order:{orderId:body.orderId,orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED',buyer:{username:'Acheteur test'},pricingSummary:{total:{value:'115',currency:'EUR'}},lineItems:[{lineItemId:'111',legacyItemId:'12',title:'Paire eBay',quantity:1,lineItemCost:{value:'100',currency:'EUR'},total:{value:'115',currency:'EUR'}}],totalMarketplaceFee:{value:'12.50',currency:'EUR'}},fulfillments:[]};
   if(a==='sync')j={ok:true,lu:{annonces:true,commandes:false},complet:{annonces:true,commandes:false}};
   if(a==='offredetail')j={ok:true,offre:{id:body.offerId,itemId:body.itemId,titre:'Offre hors de la première page',buyer:'Ancien acheteur',price:'83',currency:'EUR',quantity:1,status:'Pending'}};
   if(a==='message')j={ok:true,message:{id:body.messageId,itemId:body.itemId,sender:'Ancien acheteur',subject:'Ancien échange',body:'Message hors de la première page',responses:[]}};
   if(a==='messages')j={ok:true,messages:[{id:'m1',itemId:'12',sender:'Acheteur test',subject:'Question sur la paire',body:'Bonjour, disponible ?',responses:['Oui, disponible.','Code de retrait : 001234']},{id:'m2',itemId:'13',sender:'Autre acheteur',subject:'Autre échange',body:'Quelle taille ?',responses:[]}],totalPages:1};
   if(a==='agent')j={ok:true,tasks:[{id:'offer:333',section:'offres',label:'Étudier l’offre',ref:'13',title:'Ancienne offre à retrouver'},{id:'message:m1',section:'messages',label:'Répondre au message',ref:'12',title:'Message de la paire'},{id:'message:999',section:'messages',label:'Répondre au message',ref:'12',title:'Ancien échange à retrouver'},{id:'order:old-1',section:'ventes',label:'Préparer l’expédition',ref:'old-1',title:'Ancienne commande à retrouver'},{id:'order:1',section:'ventes',label:'Préparer l’expédition',ref:'1',title:'Paire à expédier'},{id:'offer:o1',section:'offres',label:'Étudier l’offre',ref:'12',title:'Paire à négocier',price:'85.00',currency:'EUR',deadline:new Date(Date.now()+3600000).toISOString(),urgent:true}],sources:[{nom:'Messages',ok:false},{nom:'Offres',ok:true,partiel:true}],journal:[{id:'j1',action:'expedier',ref:'1',at:Date.now(),etat:'incertain'},...Array.from({length:6},(_,i)=>({id:'j'+(i+2),action:'expedier',ref:String(i+2),at:Date.now(),etat:'reussi'}))],journalLisible:true};
   if(a==='offresrecues')j={ok:true,offres:[{id:'o1',itemId:'12',titre:'Paire de test',buyer:'Acheteur test',price:85,currency:'EUR',quantity:1,status:'Pending'},{id:'o2',itemId:'13',titre:'Autre offre eBay',buyer:'Autre acheteur',price:90,currency:'EUR',quantity:1,status:'Pending'}],totalPages:1};
   if(['repondre','repondreoffre'].includes(a)){writes.push(body);j={ok:false,error:'Refus simulé eBay'};}
   return r.fulfill({contentType:'application/json',body:JSON.stringify(j)});
  });
  for(const [tab,nom] of [['plat_vinted','Vinted'],['plat_leboncoin','Leboncoin'],['plat_ebay','eBay']]){
   await p.goto(base+'/?tab='+tab);await p.getByRole('heading',{name:nom,exact:true}).waitFor();
   const sansNom=await p.locator('.vrm-app-shell button').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&!e.getAttribute('aria-label')&&!e.getAttribute('title')&&!e.textContent.trim()&&!e.querySelector('img[alt]');}).length);
   check(sansNom===0,'boutons visibles nommés '+nom);
   check(await p.locator('.vrm-market-heading img').evaluate(e=>e.complete && e.naturalWidth>0),'logo local chargé '+nom);
   const summary=p.locator('.vrm-platform-summary');check(!await summary.evaluate(e=>e.open),'chiffres secondaires repliés '+nom);
   await summary.locator('summary').click();check(await summary.evaluate(e=>e.open),'chiffres accessibles '+nom);await summary.locator('summary').click();
   for(const width of [320,390,1512]){
    await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'espace plateforme sans débordement '+nom+' '+width);
    if(width===1512){
      const header=await p.locator('.vrm-app-header').boundingBox(), titre=await p.locator('.vrm-market-heading').boundingBox();
      check(header.y+header.height<=titre.y, 'en-tête séparé du contenu, sans recouvrir les chiffres '+nom);
    }
    if(nom==='Vinted'){
      await p.locator('.vrm-sale-row').first().waitFor();
      const outil=await p.locator('.vrm-sales-workbar').boundingBox();
      const liste=await p.locator('.vrm-sale-row').first().boundingBox();
      const fin=await p.locator('.vrm-sale-row').last().boundingBox();
      const analyse=await p.locator('.vrm-sales-analysis').boundingBox();
      check(outil.y+outil.height<=liste.y && outil.height<150, 'outils regroupés et compacts avant les ventes '+width);
      check(analyse.y>=fin.y+fin.height, 'analyse placée après la liste '+width);
    }
   }
   if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-desktop.png')});await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-390.png')});}
   await p.setViewportSize({width:390,height:844});
  }
  await p.goto(base+'/?tab=plat_vinted');
  await p.getByLabel('Rechercher dans les ventes Vinted').fill('Nike');
  await p.waitForFunction(()=>document.querySelectorAll('.vrm-sale-row').length===1);
  await p.getByLabel('Rechercher dans les ventes Vinted').evaluate(e=>e.blur());
  const vente=p.locator('.vrm-sale-row').first();
  await vente.locator('.vrm-sale-details > summary').click();
  await vente.getByPlaceholder("prix d'achat",{exact:true}).fill('40');await vente.getByPlaceholder("prix d'achat",{exact:true}).press('Tab');
  await vente.getByText('Détail des frais et du bénéfice',{exact:true}).click();
  await vente.getByLabel('Commission plateforme',{exact:true}).fill('10,50');await vente.getByLabel('Commission plateforme',{exact:true}).press('Tab');
  await p.waitForFunction(()=>document.querySelector('.vrm-sale-price')?.textContent.includes('69,50'));
  check((await vente.locator('.vrm-sale-price').innerText()).includes('estimé'),'frais déduits et bénéfice indiqué estimé');
  await vente.getByRole('checkbox',{name:/Tous les frais sont renseignés/}).check();
  check(!(await vente.locator('.vrm-sale-price').innerText()).includes('estimé'),'confirmation des frais rend le bénéfice complet');
  await vente.getByLabel('Port payé par moi',{exact:true}).fill('3');await vente.getByLabel('Port payé par moi',{exact:true}).press('Tab');
  await p.waitForFunction(()=>document.querySelector('.vrm-sale-price')?.textContent.includes('66,50'));
  check((await vente.locator('.vrm-sale-price').innerText()).includes('estimé'),'nouveau frais déduit et confirmation invalidée');
  await vente.getByLabel('Port payé par moi',{exact:true}).fill('3abc');await vente.getByLabel('Port payé par moi',{exact:true}).evaluate(e=>e.blur());
  check(!(await vente.getByLabel('Port payé par moi',{exact:true}).evaluate(e=>e.validity.valid)),'montant invalide refusé sans modifier le bénéfice');
  check((await vente.locator('.vrm-sale-price').innerText()).includes('66,50'),'montant invalide conserve le dernier calcul enregistré');
  await vente.getByRole('checkbox',{name:/Tous les frais sont renseignés/}).click();check(!(await vente.getByRole('checkbox',{name:/Tous les frais sont renseignés/}).isChecked()),'frais invalides empêchent la confirmation du bénéfice');
  await vente.getByLabel('Port payé par moi',{exact:true}).fill('3');await vente.getByLabel('Port payé par moi',{exact:true}).press('Tab');
  for(const width of [320,390,1512]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'frais de vente sans débordement '+width);}
  await p.setViewportSize({width:390,height:844});

  const navigation=p.getByRole('navigation',{name:'Navigation principale'});
  await navigation.getByRole('button',{name:'Gestion',exact:true}).click();await p.getByRole('menuitem',{name:'Stock',exact:true}).click();
  await navigation.getByRole('button',{name:'Vinted',exact:true}).click();await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Ventes',exact:true}).click();
  check(await p.getByLabel('Rechercher dans les ventes Vinted').inputValue()==='Nike', 'recherche de ventes conservée après passage dans le stock');
  await p.getByRole('button',{name:'Réinitialiser les ventes',exact:true}).click();
  await p.waitForFunction(()=>document.querySelectorAll('.vrm-sale-row').length===2);
  check(await p.getByLabel('Rechercher dans les ventes Vinted').inputValue()==='', 'réinitialiser retrouve toutes les ventes');
  await p.goto(base+'/?tab=plat_ebay');
  const photo=p.getByRole('button',{name:'Agrandir la photo de Paire eBay',exact:true});
  await photo.click();
  check(await p.getByRole('dialog',{name:'Photo de Paire eBay',exact:true}).isVisible(), 'photo de vente agrandie dans une fenêtre dédiée');
  await p.waitForFunction(()=>{const i=document.querySelector('.vrm-photo-panel img');return i&&i.complete&&i.naturalWidth>0;});
  check(await p.getByRole('dialog',{name:'Photo de Paire eBay',exact:true}).locator('img').getAttribute('alt')==='Paire eBay', 'image agrandie chargée avec le nom exact de la paire');
  await p.keyboard.press('Escape');
  check(await p.getByRole('dialog',{name:'Photo de Paire eBay',exact:true}).count()===0, 'Échap ferme la photo');
  check(await photo.evaluate(e=>e===document.activeElement), 'fermeture de photo rend le focus à la miniature');
  rows.push({id:'harvest_111_inbox',data:{capturedAt:maintenant,payload:{conversations:[{id:71,opposite_user:{id:22,login:'Client Vinted'},description:'Paire de test',last_message:'Merci',last_message_at:maintenant}]}}},{id:'harvest_111_conv_71',data:{payload:{conversation:{id:71,opposite_user:{id:22},allow_reply:false,messages:[{entity_type:'message',created_at_ts:1700000000,entity:{user_id:22,body:'Bonjour depuis Vinted'}},{entity_type:'status_message',created_at_ts:1700000001,entity:{title:'Colis disponible',pickup:{pickup_code:456789}}},{entity_type:'message',created_at_ts:1700000002,entity:{user_id:111,body:'Merci pour votre achat'}}]}}}});
  await p.goto(base+'/?tab=plat_vinted');
  const nav=p.getByRole('navigation',{name:'Navigation principale'});
  await nav.getByRole('button',{name:'Accueil',exact:true}).waitFor();
  check(JSON.stringify(await nav.getByRole('button').allTextContents()).includes('Accueil'), 'accueil présent dans la navigation mobile');
  check(await nav.getByRole('button').count()===5, 'cinq accès mobiles stables');
  check(JSON.stringify((await nav.getByRole('button').allTextContents()).map(t=>t.trim()))===JSON.stringify(['Accueil','Vinted','Leboncoin','eBay','Gestion']), 'navigation organisée par plateforme');
  await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Messages',exact:true}).click();
  await p.locator('[data-conv="71"]').waitFor();
  await p.locator('.vrm-inbox-filters').getByRole('button',{name:/Non lues/}).click();
  check(await p.locator('[data-conv]').count()===0, 'filtre non lu masque la conversation déjà lue');
  check(await p.getByText('Aucune conversation non lue dans cette sélection.',{exact:true}).isVisible(), 'filtre vide expliqué');
  await p.locator('.vrm-inbox-filters').getByRole('button',{name:/Toutes/}).click();
  check(await p.locator('[data-conv="71"]').count()===1, 'toutes les conversations retrouvées');
  await nav.getByRole('button',{name:'Leboncoin',exact:true}).click();
  await p.getByRole('heading',{name:'Leboncoin',exact:true}).waitFor();
  await nav.getByRole('button',{name:'Vinted',exact:true}).click();
  check(await p.locator('.vrm-platform-tabs button[aria-current="page"]').innerText()==='Messages', 'section messages retrouvée en revenant sur Vinted');
  await p.goto(base+'/?tab=plat_vinted');await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Messages',exact:true}).click();await p.getByText('Client Vinted',{exact:true}).click();await p.getByText('Bonjour depuis Vinted',{exact:true}).waitFor();
  check(await p.getByText('Merci pour votre achat',{exact:true}).isVisible(),'historique Vinted complet capté');check((await p.locator('.vrm-chat-panel').innerText()).includes('456789'),'code de retrait numérique conservé');
  rows.find(x=>x.id==='harvest_111_conv_71').data.payload.conversation.messages=[{id:901,entity_type:'message',created_at_ts:1700000003,entity:{user_id:22,body:'Nouveau message capturé'}}];
  await p.evaluate(()=>window.dispatchEvent(new CustomEvent('vrm:ext',{detail:{type:'maj',quoi:'messages',uid:'111',conv:'71'}})));
  await p.getByText('Nouveau message capturé',{exact:true}).waitFor();
  check(await p.getByText('Merci pour votre achat',{exact:true}).isVisible(),'capture partielle conserve l’historique déjà ouvert');
  check((await p.locator('.vrm-chat-panel').innerText()).includes('456789'),'capture partielle conserve le code de retrait');
  await p.setViewportSize({width:1512,height:900});await p.waitForTimeout(200);
  const gauche=await p.locator('.vrm-inbox-column').boundingBox(), droite=await p.locator('.vrm-chat-column').boundingBox();
  check(droite.x>=gauche.x+gauche.width-1, 'messagerie ordinateur : liste à gauche, fil à droite');
  check(await p.locator('.vrm-chat-column .vrm-chat-panel').count()===1, 'fil intégré dans le panneau de droite');
  await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);
  const send=p.getByRole('button',{name:'Envoyer',exact:true});check(await send.isDisabled(),'conversation sans réponse autorisée bloquée');
  if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'messages-vinted-390.png')});}
  await p.goto(base+'/?tab=dashboard');await p.locator('.vrm-finance-overview').waitFor();check(await p.locator('.vrm-finance-overview').isVisible(),'indicateurs financiers prioritaires');
  await p.locator('.vrm-finance-goal').getByRole('button',{name:'Fixer',exact:true}).click();await p.getByLabel('Objectif de chiffre d’affaires du mois').fill('2000');await p.locator('.vrm-finance-goal').getByRole('button',{name:'OK',exact:true}).click();
  check(await p.getByRole('progressbar',{name:'Progression vers l’objectif du mois'}).getAttribute('aria-valuemax')==='2000','objectif réel saisi avec progression accessible');
  check(await p.locator('.vrm-finance-goal').evaluate(e=>e.getBoundingClientRect().top<document.querySelector('.vrm-finance-stock').getBoundingClientRect().top),'objectif placé avant les détails du stock');

  if(process.env.BANC_CAPTURES)await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'statistiques-390.png')});
  await p.locator('main').evaluate(e=>{e.scrollTop=250;});await p.waitForTimeout(150);
  const avant=await p.locator('main').evaluate(e=>e.scrollTop);
  await nav.getByRole('button',{name:'Gestion',exact:true}).click();await p.getByRole('menuitem',{name:'Stock',exact:true}).click();
  await nav.getByRole('button',{name:'Gestion',exact:true}).click();await p.getByRole('menuitem',{name:'Statistiques',exact:true}).click();
  await p.waitForTimeout(800);
  check(avant>100 && Math.abs(await p.locator('main').evaluate(e=>e.scrollTop)-avant)<3, 'position retrouvée après passage dans le stock');

  await p.goto(base+'/?tab=plat_ebay');await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Messages',exact:true}).click();await p.getByText('Acheteur test',{exact:true}).waitFor();
  await nav.getByRole('button',{name:'Gestion',exact:true}).click();await p.getByRole('menuitem',{name:'Stock',exact:true}).click();
  await nav.getByRole('button',{name:'eBay',exact:true}).click();
  await p.getByRole('heading',{name:'eBay',exact:true}).waitFor();
  await p.getByText('Acheteur test',{exact:true}).waitFor();
  check(await p.locator('.vrm-platform-tabs button[aria-current="page"]').innerText()==='Messages', 'messages revient à eBay après un passage dans le stock');
  check(writes.length===0,'ouvrir les messages ne transmet rien');
  await p.getByRole('button',{name:/Acheteur test Question/}).click();check(await p.getByText('Oui, disponible.',{exact:true}).isVisible(),'historique de réponses visible');
  await p.getByLabel('Réponse au message eBay').fill('Merci pour votre message');await p.getByRole('button',{name:'Envoyer la réponse',exact:true}).click();await p.getByRole('button',{name:'Annuler',exact:true}).click();check(writes.length===0,'annuler la réponse ne transmet rien');
  await p.getByRole('button',{name:'Envoyer la réponse',exact:true}).click();await p.getByRole('button',{name:'Annuler',exact:true}).waitFor();await p.getByRole('button',{name:'Annuler',exact:true}).locator('..').getByRole('button',{name:'Envoyer la réponse',exact:true}).click();await p.waitForFunction(()=>document.body.textContent.includes('Refus simulé eBay'));check(writes.length===1 && writes[0].messageId==='m1','réponse associée au message exact');check(await p.getByLabel('Réponse au message eBay').inputValue()==='Merci pour votre message','refus conserve le brouillon');
  await p.getByLabel('Fermer la conversation eBay').click();await p.getByRole('button',{name:'Offres',exact:true}).click();await p.getByText('Paire de test',{exact:true}).waitFor();check(writes.length===1,'lire les offres ne les accepte pas');
  await p.locator('article').filter({hasText:'Paire de test'}).getByRole('button',{name:'Accepter',exact:true}).click();await p.getByRole('button',{name:'Annuler',exact:true}).click();check(writes.length===1,'offre annulée sans écriture');
  await p.getByRole('button',{name:'À traiter',exact:true}).click();
  await p.getByRole('heading',{name:'À traiter sur eBay',exact:true}).waitFor();
  check(await p.getByText('Paire à négocier',{exact:true}).isVisible(),'agent montre le titre de la paire');
  await p.getByLabel('Rechercher une tâche eBay').fill('absent');check(await p.getByText('Aucune tâche ne correspond à cette recherche.',{exact:true}).isVisible(),'recherche des tâches sans résultat expliquée');
  await p.getByLabel('Rechercher une tâche eBay').fill('négocier');check(await p.getByText('Paire à négocier',{exact:true}).isVisible(),'recherche des tâches retrouve la paire');
  const filtres=p.getByRole('navigation',{name:'Filtrer les tâches eBay'});
  await filtres.getByRole('button',{name:/Messages/}).click();check(await p.getByText('Paire à négocier',{exact:true}).count()===0,'filtre messages masque les offres');check(await p.getByText('Aucune tâche ne correspond à cette recherche.',{exact:true}).isVisible(),'filtre et recherche se combinent');
  await filtres.getByRole('button',{name:/Offres/}).click();check(await p.getByText('Paire à négocier',{exact:true}).isVisible(),'filtre offres retrouve la tâche');check(await filtres.getByRole('button',{name:/Offres/}).getAttribute('aria-pressed')==='true','filtre actif accessible');
  await filtres.getByRole('button',{name:/Tout/}).click();
  await p.getByText('Sources et dernière lecture',{exact:true}).click();
  check(await p.getByText('Messages : lecture indisponible',{exact:true}).isVisible(),'agent distingue la lecture indisponible des tâches vides');
  check(await p.getByRole('button',{name:'Relire avant de reprendre',exact:true}).isVisible(),'action incertaine propose une relecture');
  check(writes.length===1,'préparation et historique eBay sans action commerciale');
  for(const width of [320,390,1512]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'tâches eBay sans débordement '+width);}
  await p.setViewportSize({width:390,height:844});
  check(await p.getByText(/· Confirmé par eBay$/).count()===5,'historique compact avec cinq résultats confirmés');await p.getByRole('button',{name:'Voir les 7 actions',exact:true}).click();check(await p.getByText(/· Confirmé par eBay$/).count()===6,'historique complet accessible au clic');check(await p.getByRole('button',{name:'Relire avant de reprendre',exact:true}).isVisible(),'résultat incertain conservé dans l’historique complet');

  await p.getByRole('button',{name:/Étudier l’offre/}).click();await p.getByRole('heading',{name:'Offres eBay',exact:true}).waitFor();
  check(await p.getByText('Autre offre eBay',{exact:true}).count()===0,'raccourci ouvre uniquement l’offre visée');
  await p.getByRole('button',{name:'Voir toutes les offres',exact:true}).click();check(await p.getByText('Autre offre eBay',{exact:true}).isVisible(),'retour à toutes les offres');
  await p.locator('.vrm-platform-tabs').getByRole('button',{name:'À traiter',exact:true}).click();
  await p.getByRole('button',{name:/Message de la paire/}).click();await p.getByRole('dialog',{name:'Conversation eBay',exact:true}).waitFor();
  check(await p.getByLabel('Réponse au message eBay').inputValue()==='Merci pour votre message','raccourci ouvre le bon message et retrouve le brouillon refusé');
  await p.getByLabel('Réponse au message eBay').fill('Brouillon de la première paire');
  await p.getByLabel('Rechercher dans la conversation eBay').fill('001234');
  check(await p.getByText('Code de retrait : 001234',{exact:true}).isVisible(),'recherche dans le contenu de la conversation');
  check(await p.getByText('Bonjour, disponible ?',{exact:true}).count()===0,'recherche masque les messages sans correspondance');
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async v=>{window.__codeEbay=v;}}});});
  await p.getByRole('button',{name:'Copier le code eBay 001234',exact:true}).click();check(await p.evaluate(()=>window.__codeEbay)==='001234','code eBay copié avec ses zéros initiaux');
  await p.getByLabel('Fermer la conversation eBay').click();
  await p.getByRole('button',{name:/Autre acheteur Autre échange/}).click();check(await p.getByLabel('Réponse au message eBay').inputValue()==='','brouillons séparés par échange');
  await p.getByLabel('Réponse au message eBay').fill('Brouillon de la seconde paire');await p.getByLabel('Fermer la conversation eBay').click();
  await p.getByRole('button',{name:/Acheteur test Question/}).click();check(await p.getByLabel('Réponse au message eBay').inputValue()==='Brouillon de la première paire','changer d’échange conserve le brouillon');
  await p.getByLabel('Fermer la conversation eBay').click();await p.reload();await p.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:'eBay',exact:true}).click();await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Messages',exact:true}).click();await p.getByRole('button',{name:/Acheteur test Question/}).click();check(await p.getByLabel('Réponse au message eBay').inputValue()==='Brouillon de la première paire','rechargement conserve le brouillon dans cet onglet');
  await p.getByLabel('Fermer la conversation eBay').click();await p.locator('.vrm-platform-tabs').getByRole('button',{name:'À traiter',exact:true}).click();
  await p.getByRole('button',{name:/Paire à expédier/}).click();await p.getByText('Commande 1',{exact:true}).first().waitFor();await p.getByText('Prix d’achat à renseigner.',{exact:true}).count();
  await p.getByText('Bénéfice de l’article : à compléter',{exact:true}).click();await p.getByLabel('Prix d’achat eBay').fill('40');await p.getByLabel('Prix d’achat eBay').press('Tab');
  check((await p.getByText(/Bénéfice de l’article :/).innerText()).includes('47,50'),'bénéfice eBay exclut le port acheteur et déduit la commission lue');
  await p.getByText('Détail des frais et du bénéfice',{exact:true}).click();check(await p.getByLabel('Commission plateforme',{exact:true}).getAttribute('readonly')!==null,'commission eBay lue protégée contre la saisie');
  await p.getByRole('checkbox',{name:/Tous les frais sont renseignés/}).check();check(!(await p.getByText(/Bénéfice de l’article :/).innerText()).includes('estimé'),'frais confirmés sur la commande eBay');
  for(const width of [320,390,1512]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'commande ciblée sans débordement '+width);}await p.setViewportSize({width:390,height:844});
  await p.locator('.vrm-platform-tabs').getByRole('button',{name:'Compte',exact:true}).click();await p.getByText('Synchronisation par compte',{exact:true}).click();
  await p.getByRole('button',{name:'Actualiser ce compte',exact:true}).click();await p.getByRole('button',{name:'Reprendre ce compte',exact:true}).waitFor();check((await p.locator('[data-ebay-sync-compte]').innerText()).includes('Non relu : commandes'),'synchronisation précise la source non relue');
  await p.locator('.vrm-platform-tabs').getByRole('button',{name:'À traiter',exact:true}).click();await p.getByRole('button',{name:/Ancien échange à retrouver/}).click();await p.getByText('Message hors de la première page',{exact:true}).waitFor();check(await p.getByRole('dialog',{name:'Conversation eBay',exact:true}).isVisible(),'message absent de la première page lu directement');
  await p.getByLabel('Fermer la conversation eBay').click();await p.locator('.vrm-platform-tabs').getByRole('button',{name:'À traiter',exact:true}).click();await p.getByRole('button',{name:/Ancienne commande à retrouver/}).click();await p.getByText('Commande old-1',{exact:true}).first().waitFor();check(await p.getByText('Actualiser la commande',{exact:true}).isVisible(),'commande absente du cache lue directement sur eBay');
  await p.locator('.vrm-platform-tabs').getByRole('button',{name:'À traiter',exact:true}).click();await p.getByRole('button',{name:/Ancienne offre à retrouver/}).click();await p.getByText('Offre hors de la première page',{exact:true}).waitFor();check(writes.length===1,'offre hors première page lue sans envoi aux observateurs');
  check(writes.length===1,'accès directs, brouillons, bénéfices et synchronisation sans action commerciale');

  check(writes.length===1,'une tâche ouvre la section sans accepter l’offre');
  await p.goto(base+'/?tab=plat_leboncoin');await p.getByRole('button',{name:'Colis',exact:true}).click();await p.getByText('Colis à préparer',{exact:true}).waitFor();
  check(await p.getByText('Colis en route',{exact:true}).isVisible(),'colis expédié conservé au suivi');check(await p.getByText('Colis finalisé',{exact:true}).count()===0,'colis finalisé retiré des colis actifs');check(await p.locator('.vrm-lbc-package').count()===1,'seul le colis non expédié propose le bordereau');
  for(const width of [320,390,1440]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement colis '+width);}
  rows.push({id:'email_track_pickup1',data:{id:'pickup1',carrier:'mondial',status:'available',lieu:'Relais Centre',artTitle:'Paire crème taille 42',code:'001234',suivi:'TRACK-01',receivedAt:maintenant,limite:new Date(Date.now()+3*86400000).toISOString().slice(0,10)}},
   {id:'email_track_pickup2',data:{id:'pickup2',carrier:'chronopost',status:'available',lieu:'Consigne Centre',artTitle:'Paire argent taille 43',code:'004567',code2:'009876',consigne:true,suivi:'TRACK-02',receivedAt:maintenant,limite:new Date(Date.now()-86400000).toISOString().slice(0,10)}},
   {id:'email_track_pickup3',data:{id:'pickup3',carrier:'chronopost',status:'available',lieu:'Consigne Centre',artTitle:'Paire à codes longs',code:'AA0012345678',code2:'AB0098765432',consigne:true,suivi:'TRACK-03',receivedAt:maintenant}},
   {id:'email_track_pickup4',data:{id:'pickup4',carrier:'mondial',status:'available',lieu:'Relais Nord',artTitle:'Colis sans code',suivi:'TRACK-MISSING',receivedAt:maintenant}});
  await p.goto(base+'/?tab=cat_achats');await p.getByRole('button',{name:'Copier code de retrait 001234',exact:true}).waitFor();
  for(const width of [320,390,1512]){await p.setViewportSize({width,height:900});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'retraits sans débordement '+width);}
  check(await p.locator('.vrm-pickup-card').count()===4, 'quatre colis à retirer, sans mélange des codes');
  check(await p.getByRole('button',{name:'Copier identifiant 009876',exact:true}).isVisible(),'identifiant de consigne visible séparément');
  check(await p.getByRole('button',{name:'Copier code d’ouverture 004567',exact:true}).isVisible(),'code d’ouverture visible séparément');
  check((await p.locator('main').innerText()).includes('délai dépassé'),'échéance dépassée reste visible');
  check(!(await p.locator('main').innerText()).includes('TRACK-MISSING'),'numéro de suivi absent des codes affichés');
  check(await p.getByText('n° TRACK-MISSING',{exact:true}).count()===1,'numéro de suivi conservé dans les détails');
  check(await p.locator('.vrm-pickup-method').evaluateAll(es=>es.every(e=>!e.open)),'explications repliées par défaut');
  check(await p.locator('.vrm-pickup-details').evaluateAll(es=>es.every(e=>!e.open)),'suivi et dates secondaires dans les détails');
  await p.locator('.vrm-pickup-method summary').first().click();check(await p.locator('.vrm-pickup-method').first().evaluate(e=>e.open), 'informations de retrait accessibles au clic');await p.locator('.vrm-pickup-method summary').first().click();
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async v=>{window.__codeCopie=v;}}});});
  await p.getByRole('button',{name:'Copier code de retrait 001234',exact:true}).click();
  check(await p.evaluate(()=>window.__codeCopie)==='001234','copie conserve les zéros initiaux');
  check((await p.getByRole('button',{name:'Copier code de retrait 001234',exact:true}).innerText()).includes('Copié'),'confirmation après copie réussie');
  await p.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('Refus simulé');}}});});
  await p.getByRole('button',{name:'Copier identifiant 009876',exact:true}).click();
  check((await p.getByRole('button',{name:'Copier identifiant 009876',exact:true}).innerText()).includes('Copie indisponible'),'copie refusée annoncée honnêtement');
  if(process.env.BANC_CAPTURES){await p.setViewportSize({width:390,height:844});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'retraits-390.png')});await p.setViewportSize({width:1512,height:900});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'retraits-desktop.png')});}
  if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'colis-desktop.png')});}check(!errors.length,'aucune erreur JavaScript');console.log(n+' contrôles revendeurs réussis.');
 }catch(e){if(b){const page=b.contexts()[0]?.pages()[0];if(page){await page.screenshot({path:'/tmp/vrm-revendeurs-echec.png'}).catch(()=>{});console.error('État du navigateur :',await page.evaluate(()=>({url:location.href,width:innerWidth,nav:[...document.querySelectorAll('nav')].map(n=>n.innerText),texte:document.body.innerText.slice(0,1800)})).catch(()=>null));}}throw e;}finally{if(b)await b.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
