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
      let selection=rows.filter(x=>re?re.test(x.id):filtre==='eq.'+x.id);
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
    if(url.pathname.startsWith('/api/'))return r.fulfill({contentType:'application/json',body:'{}'});
    if(url.hostname==='127.0.0.1')return r.continue();
    return r.abort();
  });
}
(async()=>{
 let b;
 try{
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const base='http://127.0.0.1:'+server.address().port;
  b=await chromium.launch({executablePath:process.env.BANC_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox']});
  for(const largeur of [320,360,390,430]){
    const ctx=await b.newContext({viewport:{width:largeur,height:844},isMobile:true,hasTouch:true});const p=await ctx.newPage();const erreurs=[];p.on('pageerror',e=>erreurs.push(e.message));await brancher(p);
    for(const tab of ['journee','cat_ventes','cat_annonces','plat_vinted','plat_leboncoin','plat_ebay','compta','settings']){
      await p.goto(base+'/?tab='+tab);await p.locator('main').waitFor();
      check(!(await p.locator('main').innerText()).includes("Cet écran n'a pas pu s'afficher"),largeur+' '+tab+' écran rendu');
      const geometrie=await p.evaluate(()=>{
        const h=document.querySelector('header'),nav=document.querySelector('.vrm-mobile-nav') || [...document.querySelectorAll('nav')].at(-1),main=document.querySelector('main');
        const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
        return {zoom:getComputedStyle(document.documentElement).zoom,viewport:innerWidth,
          header:[...h.querySelectorAll('button')].filter(visible).map(e=>e.getBoundingClientRect().toJSON()),
          nav:nav.getBoundingClientRect().toJSON(),main:main.getBoundingClientRect().toJSON(),
          labels:[...nav.querySelectorAll('button span:last-child')].map(e=>parseFloat(getComputedStyle(e).fontSize))};
      });
      check(Number(geometrie.zoom)===1,largeur+' '+tab+' ancien zoom 65 % neutralisé');
      check(geometrie.header.every(r=>r.height>=44&&r.width>=44&&r.left>=0&&r.right<=largeur+1),largeur+' '+tab+' en-tête tactile sans débordement');
      check(geometrie.labels.every(f=>f>=11),largeur+' '+tab+' navigation lisible');
      check(geometrie.nav.bottom<=844.5&&geometrie.main.bottom<=geometrie.nav.top+.5,largeur+' '+tab+' navigation hors du contenu');
      if(tab==='cat_ventes'){
        await p.locator('.vrm-sale-row').first().waitFor();
        check((await p.locator('.vrm-sale-photo').first().boundingBox()).width===64,largeur+' photo de vente compacte');
        const filtre=p.getByRole('button',{name:'Toutes',exact:true}).first();await filtre.scrollIntoViewIfNeeded();await filtre.tap();
        check((await p.locator('main').innerText()).includes('Nike P-6000'),largeur+' filtre accessible au doigt');
        check(!(await p.getByRole('button',{name:'7 jours',exact:true}).isVisible()),largeur+' périodes secondaires repliées');
        await p.getByRole('button',{name:'Toute la période',exact:true}).tap();
        await p.getByRole('button',{name:'7 jours',exact:true}).tap();
        check(await p.getByRole('button',{name:'7 derniers jours',exact:true}).isVisible(),largeur+' période secondaire sélectionnable');
      }
    }
    await p.getByRole('button',{name:'Tous les écrans',exact:true}).tap();
    await p.getByRole('menuitem',{name:'Colis',exact:true}).waitFor();
    check(await p.getByText('Gestion',{exact:true}).isVisible(),largeur+' menu: gestion regroupée');
    await p.keyboard.press('Escape');
    check(await p.getByRole('button',{name:'Tous les écrans',exact:true}).evaluate(e=>e===document.activeElement),largeur+' menu: retour du focus');
    await p.getByRole('button',{name:'Tous les écrans',exact:true}).tap();await p.getByRole('menuitem',{name:'Réglages',exact:true}).tap();check(await p.getByText("Taille de l'affichage",{exact:true}).isVisible(),largeur+' réglages accessibles depuis le menu');
    const champs=p.locator('main input:not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"])');
    check((await champs.evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0).every(e=>parseFloat(getComputedStyle(e).fontSize)>=16))),largeur+' champs lisibles sans zoom automatique');
    await p.getByRole('button',{name:'Voir la synchronisation'}).tap();
    check(await p.getByText('Paramètres',{exact:true}).isVisible(),largeur+' synchronisation accessible au toucher');
    await p.getByRole('button',{name:'Grand',exact:true}).tap();
    await p.waitForTimeout(120);
    check(await p.evaluate(()=>document.querySelector('.vrm-mobile-nav').getBoundingClientRect().bottom<=844.5),largeur+' grand affichage: navigation toujours dans l’écran');
    await p.getByRole('button',{name:'Normal',exact:true}).tap();
    await p.evaluate(()=>localStorage.setItem('vrm_zoom','0.65'));
    await p.getByRole('button',{name:'Rechercher une paire'}).tap();const recherche=p.getByPlaceholder(/N°|numéro|titre|marque/i).first();
    await recherche.fill('New Balance');check(!(await p.locator('.vrm-mobile-nav').isVisible()),largeur+' clavier: navigation masquée');
    await p.keyboard.press('Escape');await p.evaluate(()=>document.activeElement.blur());
    await p.waitForTimeout(120);
    await p.setViewportSize({width:844,height:390});await p.waitForTimeout(120);
    check(await p.evaluate(()=>Number(getComputedStyle(document.documentElement).zoom)===.65),largeur+' rotation: préférence grand écran conservée');
    await p.setViewportSize({width:largeur,height:844});await p.waitForTimeout(120);
    check(await p.evaluate(()=>Number(getComputedStyle(document.documentElement).zoom)===1),largeur+' retour portrait sans réduction');
    check(erreurs.length===0,largeur+' aucune erreur JavaScript');
    if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'ventes-'+largeur+'.png')});}
    await ctx.close();
  }
  const ctx=await b.newContext({viewport:{width:1512,height:950}});const p=await ctx.newPage();await brancher(p);await p.addInitScript(()=>localStorage.setItem('vrm_zoom','1'));await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();
  check((await p.getByRole('navigation',{name:'Navigation principale'}).count())===1,'ordinateur: une seule navigation');check(await p.getByRole('button',{name:'Ouvrir les paramètres'}).isVisible(),'ordinateur: paramètres dans l’île');check((await p.locator('.vrm-sale-photo').first().boundingBox()).width===72,'ordinateur: disposition conservée');
  await p.getByText('Autres outils',{exact:true}).click();
  check(await p.getByRole('button',{name:'Factures',exact:true}).isVisible(),'ordinateur: outils repliés accessibles');
  await p.getByText('Détails Vinted',{exact:true}).click();
  check(!(await p.getByRole('button',{name:'Annonces',exact:true}).isVisible()),'ordinateur: détails secondaires repliables');
  await p.getByText('Détails Vinted',{exact:true}).click();
  await p.getByRole('button',{name:'Annonces',exact:true}).click();
  await p.getByRole('heading',{name:'Annonces en ligne'}).waitFor();
  check(await p.getByRole('heading',{name:'Annonces en ligne'}).isVisible(),'ordinateur: annonces accessibles depuis le rail');
  if(process.env.BANC_CAPTURES){await p.goto(base+'/?tab=cat_ventes');await p.locator('.vrm-sale-row').first().waitFor();await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'ventes-desktop.png')});}
  console.log(n+' contrôles mobiles/ordinateur réussis.');
 }finally{if(b)await b.close();await new Promise(ok=>server.close(ok));}
})().catch(e=>{console.error(e);process.exitCode=1;});
