// Revue visuelle des écrans secondaires, données synthétiques et réseau simulé.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.resolve('scripts/bancs/revendeurs.cjs');let s=fs.readFileSync(file,'utf8');
const marker="  await p.setViewportSize({width:1512,height:900});";
const debutMessages=s.indexOf("  rows.push({id:'harvest_111_inbox'");
const finMessages=s.indexOf("  await p.goto",debutMessages);
const debutRetraits=s.indexOf("  rows.push({id:'email_track_pickup1'");
const finRetraits=s.indexOf("  await p.goto",debutRetraits);
if(!s.includes(marker)||debutMessages<0||debutRetraits<0)throw Error('Fixtures de revue introuvables');
const fixtures=s.slice(debutMessages,finMessages)+s.slice(debutRetraits,finRetraits);
s=s.replace(marker,fixtures+`
  const {VIDE}=await import(path.resolve('src/operations/metier.js'));
  await p.route('**/api/compte?mode=operations',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,donnees:VIDE(),equipe:[],serveur:new Date().toISOString(),confirmees:[]})}));
  if(process.env.STUDIO_DARK)await p.addInitScript(()=>localStorage.setItem('vinted_dark','true'));
  for(const width of (process.env.STUDIO_WIDTHS||'320,390,1512').split(',').map(Number)){
   await p.setViewportSize({width,height:900});
   for(const [nom,tab,section] of [['ventes','plat_vinted','Ventes'],['annonces','plat_vinted','Annonces'],['achats','plat_vinted','Achats'],['messages','plat_vinted','Messages'],['annonces-ebay','plat_ebay','Annonces'],['messages-ebay','plat_ebay','Messages'],['colis','plat_leboncoin','Colis'],['retraits','cat_achats',null],['parametres','settings',null],['statistiques','dashboard',null],['comptabilite','compta',null],['stock','garage',null],['organisation','organisation',null]]){
    await p.goto(base+'/?tab='+tab);await p.locator('main').waitFor();await p.evaluate(()=>document.fonts.ready);
    if(section)await p.locator('.vrm-platform-tabs').getByRole('button',{name:section,exact:true}).click();
    if(nom==='retraits')await p.getByRole('button',{name:'Copier code de retrait 001234',exact:true}).waitFor();
    if(nom==='messages')await p.locator('[data-conv="71"]').waitFor();
    await p.waitForTimeout(400);await p.locator('main').evaluate(e=>e.scrollTop=0);
    if(process.env.STUDIO_DARK)check(await p.locator('html').getAttribute('data-theme')==='dark','thème sombre actif '+nom+' '+width);
    check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement '+nom+' '+width);
    check(await p.locator('main button').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;}).every(e=>e.textContent.trim()||e.getAttribute('aria-label')||e.getAttribute('title')||e.querySelector('img[alt]'))),'boutons nommés '+nom+' '+width);
    if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,nom+'-'+width+'.png')});}
    if(section && width<768)check(await p.locator('.vrm-platform-tabs').evaluate(e=>{const lum=c=>{const a=c.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};const a=lum(getComputedStyle(e.closest('.vrm-seg-cadre')).backgroundColor);return [...e.querySelectorAll('button')].every(b=>{const v=lum(getComputedStyle(b).color);return (Math.max(a,v)+.05)/(Math.min(a,v)+.05)>=4.5;});}),'onglets contrastés '+nom+' '+width);
    if((nom==='ventes'||nom==='annonces') && width<768){
     check(await p.locator('.vrm-ledger-heading').evaluate(e=>{const lum=c=>{const a=c.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};const st=getComputedStyle(e),a=lum(st.color),b=lum(st.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;}),'en-tête du tableau lisible '+nom+' '+width);
    }
    if(nom==='annonces' && width<768){
     const search=await p.locator('.vrm-ann-search').boundingBox(),tri=await p.locator('.vrm-ann-tri').boundingBox();
     check(tri.x-search.x-search.width>=0&&tri.x-search.x-search.width<9,'recherche et tri sans colonne vide '+width);
     const stock=p.locator('.vrm-ann-stock-tools'),pub=p.locator('[data-places-wrap]');const a=await stock.boundingBox(),b=await pub.boundingBox();
     check(Math.abs(a.y-b.y)<2,'stock et publication sur une rangée '+width);
     for(const panneau of [stock,pub]){await panneau.locator(':scope > summary').click();check(await panneau.evaluate(e=>e.open&&e.getBoundingClientRect().width>innerWidth*.75),'panneau gestion déplié pleine largeur '+width);await panneau.locator(':scope > summary').click();}
    }
    if(nom==='colis' && width<768){
     check(await p.locator('.vrm-lbc-package').first().evaluate(e=>e.getBoundingClientRect().height<115),'colis à préparer compact '+width);
     check(await p.locator('.vrm-lbc-package-primary').first().getAttribute('href')==='https://example.test/label.pdf','lien du bordereau conservé '+width);
    }
    if(nom==='retraits'){
     check(await p.locator('.vrm-pickup-code').evaluateAll(es=>es.every(e=>{const n=e.querySelector('strong');return n.scrollWidth<=n.clientWidth+1&&e.scrollWidth<=e.clientWidth+1;})),'codes complets sans débordement '+width);
     check(await p.getByRole('button',{name:'Copier code de retrait 001234',exact:true}).count()===1,'zéros initiaux conservés '+width);
     if(width<768)check(await p.locator('.vrm-pickup-code:not([data-code-long]) strong').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height<30)),'code court sur une ligne '+width);
    }
    if(nom==='ventes'){
     const ligne=p.locator('.vrm-ventes-liste .vrm-sale-row').first();
     check(await ligne.evaluate(e=>e.getBoundingClientRect().height<=56),'vente sur une seule ligne '+width);
     const ouvrir=ligne.locator('.vrm-ledger-sale-toggle');
     check(await ouvrir.getAttribute('aria-expanded')==='false','actions repliées au départ '+width);
     await ouvrir.click();
     check(await ouvrir.getAttribute('aria-expanded')==='true','actions ouvrables au clic '+width);
    }
    if(nom==='ventes'){
     const bouton=p.getByRole('button',{name:"Envoyer une facture à l'acheteur",exact:true}).first();await bouton.click();const choix=p.getByRole('combobox',{name:'Facture de cette vente',exact:true});await choix.waitFor();
     check(await choix.evaluate(e=>{const a=e.getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();return a.left>=m.left&&a.right<=m.right;}),'panneau facture dans la largeur '+width);
     check(await choix.inputValue()==='','aucune facture sélectionnée automatiquement '+width);
     await bouton.click();check(await choix.count()===0,'facture repliable sans envoi '+width);
     {const ligne=p.locator('.vrm-ventes-liste .vrm-sale-row').first();await ligne.locator('.vrm-ledger-sale-toggle').click();check(await ligne.evaluate(e=>e.getBoundingClientRect().height<=56),'retour à une seule ligne '+width);}
    }
    if(nom==='messages'){
     await p.getByText('Client Vinted',{exact:true}).click();await p.getByText('Bonjour depuis Vinted',{exact:true}).waitFor();
     if(process.env.STUDIO_DARK)check(await p.locator('html').getAttribute('data-theme')==='dark','thème sombre actif '+nom+' '+width);
    check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'conversation sans débordement '+width);
     if(process.env.BANC_CAPTURES)await p.screenshot({path:path.join(process.env.BANC_CAPTURES,'conversation-'+width+'.png')});
    }
   }
  }
  check(!errors.length,'aucune erreur JavaScript écrans secondaires');console.log(n+' contrôles Studio écrans réussis');return;
`+marker);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
