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
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
  b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();await brancher(p);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/?tab=journee');await p.locator('main').waitFor();
  const home=await p.locator('main').innerText();check(!/Bonsoir|Bonjour|sans prix d’achat|ventes masquées|ventes repérées/i.test(home),'accueil sans blocs inutiles');
  for(const tab of ['cat_ventes','plat_leboncoin','plat_ebay']){
    await p.goto(base+'/?tab='+tab);await p.locator('.vrm-sale-row').first().waitFor();
    const pos=await p.locator('.vrm-sale-row').first().evaluate(e=>{const a=e.querySelector('.vrm-sale-photo').getBoundingClientRect(),b=e.querySelector('.vrm-sale-info').getBoundingClientRect(),r=e.getBoundingClientRect();return {w:a.width,h:a.height,left:a.left,right:b.left,row:r.height};});
    check(pos.w===64 && pos.h===84 && pos.right>pos.left,'photo portrait à gauche '+tab);if(pos.row>=200){console.log(pos);await p.screenshot({path:'/tmp/compact-height.png'});}check(pos.row<200,'ligne compacte '+tab);
    if(tab!=='cat_ventes')check(await p.locator('.vrm-sale-row img').first().evaluate(e=>e.complete && e.naturalWidth>0),'photo affichée '+tab);
    if(tab==='plat_ebay'){
      await p.getByRole('button',{name:'À expédier',exact:true}).click();check(await p.getByText('Paire eBay',{exact:true}).isVisible(),'NOT_FULFILLED reste à expédier');
      await p.getByRole('button',{name:'Finalisées',exact:true}).click();check((await p.locator('.vrm-sale-row').count())===0,'NOT_FULFILLED non finalisée');
    }
    if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'compact-'+tab+'.png')});}
  }
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();
  await p.locator('.vrm-sale-invoice').first().waitFor();
  check((await p.locator('.vrm-sale-invoice').count())>0,'facture proposée au compte avec reçu Pro');
  await p.getByRole('button',{name:"Envoyer une facture à l'acheteur"}).first().click();
  check(await p.getByLabel('Facture de cette vente').isVisible(),'choix explicite facture, aucun envoi à ouverture');
  await p.getByRole('button',{name:'Toute la période',exact:true}).click();await p.getByRole('button',{name:'Deux dates',exact:true}).click();
  await p.getByLabel('Début de la période').fill('2026-10-20');await p.getByLabel('Fin de la période').fill('2026-10-10');await p.getByRole('button',{name:'Appliquer',exact:true}).click();
  check(await p.getByRole('alert').isVisible(),'intervalle inversé refusé');
  await p.getByLabel('Début de la période').fill('2020-01-01');await p.getByLabel('Fin de la période').fill('2020-01-31');await p.getByRole('button',{name:'Appliquer',exact:true}).click();
  check((await p.locator('.vrm-sale-row').count())===0,'dates filtrent réellement les ventes');
  await p.getByRole('button',{name:'Effacer la période'}).click();check((await p.locator('.vrm-sale-row').count())>0,'effacement restaure les ventes');
  rows.splice(rows.findIndex(x=>x.id==='email_invoice_test'),1);
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();
  check((await p.locator('.vrm-sale-invoice').count())===0,'pas de bouton sur compte sans preuve Pro');
  await p.addInitScript(()=>{localStorage.setItem('vrm_session',JSON.stringify({access_token:'test.test.test',refresh_token:'fake',expires_at:Date.now()+3600000,user:{id:'11111111-1111-1111-1111-111111111111',email:'test@example.test'}}));});
  await p.route('**/auth/v1/user',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({id:'11111111-1111-1111-1111-111111111111',email:'test@example.test'})}));
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();
  await p.waitForFunction(()=>{const i=document.querySelector('.vrm-sale-row img');return i && i.complete && i.naturalWidth>0;},{},{timeout:30000});
  check(await p.locator('.vrm-sale-row img').first().evaluate(e=>e.complete && e.naturalWidth>0),'photo Vinted récupérée sans extension sur téléphone');
  if(process.env.BANC_CAPTURES)await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'compact-photo-telephone.png')});
  rows.push({id:'email_invoice_test',data:{type:'facture_pro',status:'draft',account:compte.login,number:'FA1',designation:ventes[0].title,prix:95,buyerEmail:'acheteur@example.test'}});
  let patch=0;await p.route('**/rest/v1/app_data?**',async r=>{if(r.request().method()==='PATCH' && r.request().url().includes('email_invoice_test')){patch++;return r.fulfill({status:403,contentType:'application/json',body:'{}'});}return r.fallback();});
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-invoice').first().waitFor();
  await p.getByRole('button',{name:"Envoyer une facture à l'acheteur"}).first().click();await p.getByLabel('Facture de cette vente').selectOption('email_invoice_test');
  check(patch===0,'choisir un brouillon ne déclenche pas envoi');
  await p.getByRole('button',{name:'Confirmer le destinataire'}).click();await p.getByRole('button',{name:'Annuler',exact:true}).click();check(patch===0,'annuler confirmation ne déclenche pas envoi');
  await p.getByRole('button',{name:'Confirmer le destinataire'}).click();await p.getByRole('button',{name:'Confirmer',exact:true}).click();
  await p.getByText('La facture n’a pas été mise en file. Relis son état dans Factures.',{exact:true}).waitFor();check(patch===1,'refus serveur annoncé sans faux succès');
  await p.route('**/api/ebay',async r=>{const action=r.request().method()==='POST'?r.request().postDataJSON().action:null;return r.fulfill({status:action==='sync'?503:200,contentType:'application/json',body:JSON.stringify(action==='status'?{ok:true,connected:true}:action==='finances'?{reason:'scope'}:action==='sync'?{ok:false}:{ready:true,canConsent:true})});});
  await p.goto(base+'/?tab=plat_ebay');await p.getByRole('button',{name:'Compte eBay',exact:true}).click();await p.getByText('Compte eBay relié',{exact:true}).waitFor();
  check(!(await p.getByRole('button',{name:'Autoriser les paiements'}).isVisible()),'paiements repliés, connexion claire');
  await p.getByText('Solde et paramètres du compte',{exact:true}).click();await p.getByRole('button',{name:'Autoriser les paiements'}).waitFor();check(await p.getByText('Compte eBay relié',{exact:true}).isVisible(),'scope paiements distinct de connexion');
  await p.getByRole('button',{name:'Actualiser',exact:true}).click();await p.getByText('Actualisation indisponible. Les dernières données restent affichées.',{exact:true}).waitFor();check(true,'échec actualisation expliqué');
  check(!errors.length,'aucune erreur JavaScript');console.log(n+' contrôles compacts réussis.');
 }finally{if(b)await b.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
