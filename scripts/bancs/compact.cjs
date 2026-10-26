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
{id:'ebay_orders',data:{orders:[{orderId:'1',orderPaymentStatus:'PAID',orderFulfillmentStatus:'NOT_STARTED',lineItems:[{title:'Paire eBay',legacyItemId:'12'}],pricingSummary:{total:{value:'95',currency:'EUR'}}}]}},
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
// La vente est repliée (5cdffcb, 20 octobre) : sa facture et sa photo vivent dans le détail, qu'on ouvre comme la personne.
const ouvrirVente=async(p)=>{const t=p.locator('.vrm-sale-row .vrm-ledger-sale-toggle').first();if(await t.isVisible().catch(()=>false)){await t.click();await p.locator('.vrm-sale-row[data-ligne-ouverte=true]').first().waitFor({timeout:5000});}};
(async()=>{
 let b;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const base='http://127.0.0.1:'+server.address().port;
  b=await chromium.launch({executablePath:process.env.BANC_CHROMIUM||'/opt/pw-browsers/chromium',args:['--use-angle=swiftshader','--no-sandbox','--no-proxy-server']});
  const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();await brancher(p);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/?tab=journee');await p.locator('main').waitFor();
  const home=await p.locator('main').innerText();check(!/sans prix d’achat|ventes masquées|ventes repérées/i.test(home),'accueil sans rappels inutiles');
  if(await p.locator('.vrm-day-greeting').count())check(await p.locator('.vrm-day-greeting').evaluate(e=>e.getBoundingClientRect().height)<=56,'accueil compact après rétablissement des chiffres');
  for(const tab of ['cat_ventes','plat_leboncoin','plat_ebay']){
    await p.goto(base+'/?tab='+tab);await p.locator('.vrm-sale-row').first().waitFor();
    // ⚠️ (20 octobre) Depuis fc4c73e/5cdffcb (design de Julien, « les ventes mobiles sur une seule ligne »),
    //    chaque vente est REPLIÉE : la ligne compacte est le bouton `.vrm-ledger-sale-toggle` (vignette,
    //    titre, statut, montant) et le détail s'ouvre au toucher. On juge la ligne repliée, puis on OUVRE
    //    la vente (le geste de la personne) pour juger sa photo, à gauche des informations.
    const plie=await p.locator('.vrm-sale-row .vrm-ledger-sale-toggle').first().evaluate(e=>{const r=e.getBoundingClientRect();return {h:r.height,visible:r.width>0&&r.height>0};}).catch(()=>null);
    if(plie){check(plie.visible && plie.h<=64,'ligne repliée compacte '+tab+' ('+Math.round(plie.h)+' px)');
      await p.locator('.vrm-sale-row .vrm-ledger-sale-toggle').first().click();await p.locator('.vrm-sale-row[data-ligne-ouverte=true]').first().waitFor({timeout:5000});}
    // (21 oct.) La vente ouverte se détaille dans un TIROIR (portail, `aria-controls` du bouton de la ligne) : on y mesure.
    const idT=await p.locator('.vrm-sale-row .vrm-ledger-sale-toggle').first().getAttribute('aria-controls').catch(()=>null);
    const cibleVente=idT&&await p.locator(`[id="${idT}"] .vrm-sale-row`).count()?p.locator(`[id="${idT}"] .vrm-sale-row`).first():p.locator('.vrm-sale-row').first();
    const pos=await cibleVente.evaluate(e=>{const a=e.querySelector('.vrm-sale-photo').getBoundingClientRect(),b=e.querySelector('.vrm-sale-info').getBoundingClientRect(),r=e.getBoundingClientRect(),ov=e.querySelector('.vrm-sale-overview');return {w:a.width,h:a.height,left:a.left,right:b.left,row:r.height,ligne:ov?ov.getBoundingClientRect().height:null};});
    // ⚠️ L'écran Ventes de Vinted a sa propre liste depuis le 16 octobre (b8d11f2, « Ventes premium », `.vrm-ventes-liste` : vignette CARRÉE 56 × 56 sur téléphone) ; Leboncoin et eBay gardent la ligne partagée 64 × 84. Chaque liste est jugée sur SA taille exacte, photo à gauche des informations.
    //    Et depuis #545 (« plateformes premium », 16 octobre) Leboncoin et eBay ont, AU TÉLÉPHONE, leur ligne d'app native
    //    (`styles-mineral.css` : vignette portrait 52 × 68). Ce banc est à 390 px : c'est cette taille-là qu'il exige.
    //    (20 octobre) Et depuis fc4c73e (« ventes mobiles sur une seule ligne », styles-mobile-studio.css), les DEUX listes
    //    ont au téléphone la même vignette portrait 36 × 48, ouverte comme repliée. Une taille exacte, jugée vente ouverte.
    const attendu={w:36,h:48,nom:'photo portrait à gauche '};
    check(pos.w===attendu.w && pos.h===attendu.h && pos.right>pos.left,attendu.nom+tab+' ('+pos.w+'×'+pos.h+')');
    // ⚠️ Ventes Vinted (b8d11f2, 16 octobre) : la LIGNE (`.vrm-sale-overview` : vignette, titre, statut, montant,
    //    bouton du bordereau sous le titre) reste sous 200 px ; les gestes du coût d'achat et « Modifier › »
    //    sont une rangée À PART, de cibles de 44 px (jugée par ventes-colis-premium.cjs). Leboncoin et eBay
    //    gardent la ligne partagée : toute la rangée sous 200 px, comme avant.
    const haut=tab==='cat_ventes'?pos.ligne:pos.row;
    if(!(haut<200)){console.log(pos);await p.screenshot({path:'/tmp/compact-height.png'});}check(haut!=null&&haut<200,'ligne compacte '+tab+' ('+Math.round(haut)+' px)');
    // Depuis le 17 octobre, Leboncoin/eBay → Ventes ont leurs trois cases (`KpiVentes`) et plus de repli « Chiffres » : on ne juge le repli que là où il existe.
    if(tab!=='cat_ventes' && await p.locator('.vrm-platform-summary').count())check(!(await p.locator('.vrm-platform-summary').first().evaluate(e=>e.open)),'chiffres repliés sur téléphone '+tab);
    // La vignette est en `loading="lazy"` : on attend qu'elle soit chargée (état observé, borné), jamais un délai fixe.
    if(tab!=='cat_ventes'){await p.locator('.vrm-sale-row img').first().evaluate(e=>e.complete&&e.naturalWidth>0?1:new Promise(ok=>{e.addEventListener('load',ok,{once:true});e.addEventListener('error',ok,{once:true});setTimeout(ok,5000);})).catch(()=>{});
    check(await p.locator('.vrm-sale-row img').first().evaluate(e=>e.complete && e.naturalWidth>0),'photo affichée '+tab);}
    if(tab==='plat_ebay'){
      // ⚠️ Depuis le 14 octobre (b2102c2) la règle eBay ne lit que les VRAIS états d'eBay (Sell Fulfillment :
      //    NOT_STARTED · IN_PROGRESS · FULFILLED) ; « NOT_FULFILLED » n'en est pas un et vaut « Expédition à
      //    confirmer ». La commande du banc porte donc NOT_STARTED (la forme réelle, comme revendeurs.cjs), et le
      //    second filtre d'eBay s'appelle « Expédiées » (doneLabel).
      await p.getByRole('button',{name:'À expédier',exact:true}).click();await p.getByText('Paire eBay',{exact:true}).first().waitFor({timeout:5000}).catch(()=>{});check(await p.getByText('Paire eBay',{exact:true}).first().isVisible(),'NOT_STARTED reste à expédier');
      await p.getByRole('button',{name:'Expédiées',exact:true}).click();await p.locator('.vrm-sale-row').first().waitFor({state:'detached',timeout:5000}).catch(()=>{});check((await p.locator('.vrm-sale-row').count())===0,'NOT_STARTED non expédiée');
    }
    if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'compact-'+tab+'.png')});}
  }
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();await ouvrirVente(p);
  await p.locator('.vrm-sale-invoice').first().waitFor();
  check((await p.locator('.vrm-sale-invoice').count())>0,'facture proposée au compte avec reçu Pro');
  await p.getByRole('button',{name:"Envoyer une facture à l'acheteur"}).first().click();
  check(await p.getByLabel('Facture de cette vente').isVisible(),'choix explicite facture, aucun envoi à ouverture');
  await p.getByRole('button',{name:'Toute la période',exact:true}).click();await p.getByRole('button',{name:'Deux dates',exact:true}).click();
  await p.getByLabel('Début de la période').fill('2026-10-20');await p.getByLabel('Fin de la période').fill('2026-10-10');await p.getByRole('button',{name:'Appliquer',exact:true}).click();
  check(await p.getByRole('alert').isVisible(),'intervalle inversé refusé');
  await p.getByLabel('Début de la période').fill('2020-01-01');await p.getByLabel('Fin de la période').fill('2020-01-31');await p.getByRole('button',{name:'Appliquer',exact:true}).click();
  check((await p.locator('.vrm-sale-row').count())===0,'dates filtrent réellement les ventes');
  // ⚠️ Sur téléphone, la croix « Effacer la période » est masquée depuis le 14 octobre (156c95c, la période tient
  //    dans une case de 140 px) : le geste visible est « Réinitialiser les ventes » (période, recherche et filtre).
  //    On clique ce que la personne VOIT ; la croix cachée n'est pas un geste.
  await p.getByRole('button',{name:'Réinitialiser les ventes',exact:true}).click();await p.locator('.vrm-sale-row').first().waitFor({timeout:5000}).catch(()=>{});check((await p.locator('.vrm-sale-row').count())>0,'effacement restaure les ventes');
  rows.splice(rows.findIndex(x=>x.id==='email_invoice_test'),1);
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();await ouvrirVente(p);
  check((await p.locator('.vrm-sale-invoice').count())===0,'pas de bouton sur compte sans preuve Pro');
  await p.addInitScript(()=>{localStorage.setItem('vrm_session',JSON.stringify({access_token:'test.test.test',refresh_token:'fake',expires_at:Date.now()+3600000,user:{id:'11111111-1111-1111-1111-111111111111',email:'test@example.test'}}));});
  await p.route('**/auth/v1/user',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({id:'11111111-1111-1111-1111-111111111111',email:'test@example.test'})}));
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();await ouvrirVente(p);
  await p.waitForFunction(()=>{const i=document.querySelector('.vrm-sale-row img');return i && i.complete && i.naturalWidth>0;},{},{timeout:30000});
  check(await p.locator('.vrm-sale-row img').first().evaluate(e=>e.complete && e.naturalWidth>0),'photo Vinted récupérée sans extension sur téléphone');
  if(process.env.BANC_CAPTURES)await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'compact-photo-telephone.png')});
  rows.push({id:'email_invoice_test',data:{type:'facture_pro',status:'draft',account:compte.login,number:'FA1',designation:ventes[0].title,prix:95,buyerEmail:'acheteur@example.test'}});
  let patch=0;await p.route('**/rest/v1/app_data?**',async r=>{if(r.request().method()==='PATCH' && r.request().url().includes('email_invoice_test')){patch++;return r.fulfill({status:403,contentType:'application/json',body:'{}'});}return r.fallback();});
  await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();await ouvrirVente(p);await p.locator('.vrm-sale-invoice').first().waitFor();
  await p.getByRole('button',{name:"Envoyer une facture à l'acheteur"}).first().click();await p.getByLabel('Facture de cette vente').selectOption('email_invoice_test');
  check(patch===0,'choisir un brouillon ne déclenche pas envoi');
  await p.getByRole('button',{name:'Confirmer le destinataire'}).click();await p.getByRole('button',{name:'Annuler',exact:true}).click();check(patch===0,'annuler confirmation ne déclenche pas envoi');
  await p.getByRole('button',{name:'Confirmer le destinataire'}).click();await p.getByRole('button',{name:'Confirmer',exact:true}).click();
  await p.getByText('La facture n’a pas été mise en file. Relis son état dans Factures.',{exact:true}).waitFor();check(patch===1,'refus serveur annoncé sans faux succès');
  await p.route('**/api/ebay',async r=>{const action=r.request().method()==='POST'?r.request().postDataJSON().action:null;return r.fulfill({status:action==='sync'?503:200,contentType:'application/json',body:JSON.stringify(action==='status'?{ok:true,connected:true,comptes:[{cle:'',ref:'principal',principal:true,pseudo:'Compte de banc',relie:true}]}:action==='finances'?{reason:'scope'}:action==='sync'?{ok:false}:{ready:true,canConsent:true})});});
  await p.goto(base+'/?tab=plat_ebay');await p.getByRole('button',{name:'Compte',exact:true}).click();await p.getByText('Compte eBay relié',{exact:true}).waitFor();
  check(!(await p.getByRole('button',{name:'Autoriser les paiements'}).isVisible()),'paiements repliés, connexion claire');
  await p.getByText('Solde et paramètres du compte',{exact:true}).click();await p.getByRole('button',{name:'Autoriser les paiements'}).waitFor();check(await p.getByText('Compte eBay relié',{exact:true}).isVisible(),'scope paiements distinct de connexion');
  // ⚠️ Depuis le 14 octobre (84c83d3) la synchro eBay va compte par compte : la route « status » rend la liste
  //    des comptes reliés (la forme réelle, comme revendeurs.cjs — sans elle, aucun compte n'est à relire et rien
  //    ne part), et l'échec se dit par « Certaines lectures ont échoué… reprendre uniquement le compte concerné ».
  await p.getByRole('button',{name:'Actualiser',exact:true}).click();await p.getByText('Certaines lectures ont échoué. Tu peux reprendre uniquement le compte concerné.',{exact:true}).waitFor({timeout:10000});check(true,'échec actualisation expliqué');
  await p.setViewportSize({width:1512,height:950});await p.waitForFunction(()=>document.querySelector('.vrm-platform-summary')?.open);check(true,'chiffres visibles sur ordinateur après rotation');
  check(!errors.length,'aucune erreur JavaScript');console.log(n+' contrôles compacts réussis.');
 }finally{if(b)await b.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
