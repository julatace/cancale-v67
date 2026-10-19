// Rendu réel de l’app, données synthétiques du banc revendeurs, aucune écriture distante.
const fs=require('fs'),path=require('path'),Module=require('module');const file=path.resolve('scripts/bancs/revendeurs.cjs');let s=fs.readFileSync(file,'utf8');const marker="  await p.setViewportSize({width:1512,height:900});";
if(!s.includes(marker))throw Error('Point de montage absent');
s=s.replace(marker,`
  for(const width of [320,390,430]){
   await p.setViewportSize({width,height:844});
   for(const [tab,section] of [['journee',null],['plat_vinted','Ventes'],['plat_leboncoin','Ventes'],['plat_ebay','Ventes'],['dashboard',null]]){
    await p.goto(base+'/?tab='+tab);await p.locator('main').waitFor();await p.evaluate(()=>document.fonts.ready);
    if(tab==='journee')await p.locator('[data-stock-en-ligne="1"]').waitFor();
    else if(tab==='dashboard')await p.locator('[data-courbe-vendu]').waitFor();
    else await p.locator('.vrm-platform-tabs').getByRole('button',{name:section,exact:true}).click();
    await p.locator('main').evaluate(e=>e.scrollTop=0);
    check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'écran sans débordement '+tab+' '+width);
    check(await p.locator('main').evaluate(e=>Math.abs(e.getBoundingClientRect().width-innerWidth)<2),'largeur réelle du contenu '+tab+' '+width);
    check(await p.locator('.vrm-tabbar>button').evaluateAll(es=>es.length===5&&es.every(e=>e.getBoundingClientRect().height>=44)),'cinq onglets tactiles '+tab+' '+width);
    if(!process.env.IPHONE_BASELINE)check(await p.locator('main').evaluate(e=>getComputedStyle(e).zoom==='1'),'aucune réduction globale '+tab+' '+width);
    if(section){const nav=p.locator('.vrm-platform-tabs');check(await nav.getByRole('button',{name:'Ventes',exact:true}).evaluate(e=>{const a=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;}),'section active visible '+tab+' '+width);
     const input=p.getByRole('searchbox').first();if(await input.count())check(await input.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'saisie sans zoom Safari '+tab+' '+width);
    }
    if(tab==='plat_ebay')check(await p.locator('[data-ebay-vente]').first().evaluate(e=>e.getBoundingClientRect().height<120),'commande eBay et actions compactes '+width);
    if(tab==='plat_leboncoin'||tab==='plat_ebay')check(await p.locator('.vrm-shared-sale').first().evaluate(e=>e.getBoundingClientRect().height<150),'vente partagée compacte '+tab+' '+width);
    if(tab==='plat_vinted'){
     const prix=p.locator('[data-cout-vente-saisir]').first(),relier=p.locator('[data-cout-vente-relier]').first();
     const a=await prix.boundingBox(),b=await relier.boundingBox();check(Math.abs(a.y-b.y)<2,'actions du coût côte à côte '+width);
     check(await p.locator('.vrm-sale-row').first().evaluate(e=>e.getBoundingClientRect().height<155),'ligne de vente compacte '+width);
     check(await p.locator('.vrm-sale-row').first().evaluate(e=>{const titre=e.querySelector('.vrm-sale-title').getBoundingClientRect(),prix=e.querySelector('[data-prix-vente]').getBoundingClientRect();return (prix.left>=titre.right-1||prix.top>=titre.bottom-1)&&prix.right<=e.getBoundingClientRect().right;}),'titre et montant sans chevauchement '+width);
    }
    if(tab==='journee')check(await p.locator('.vrm-day-bar').evaluate(e=>(()=>{const lum=c=>{const a=c.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722;};const a=lum(getComputedStyle(e).backgroundColor),b=lum(getComputedStyle(e.querySelector('.vrm-day-bar-n')).color);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;})()),'bandeau des tâches contrasté '+width);
    if(tab==='journee')check(await p.locator('.vrm-app-header button[aria-label="Tous les écrans"]').isHidden(),'menu Gestion sans doublon en haut '+width);
    if(tab==='journee')check(await p.locator('.vrm-day-greeting').isHidden(),'bonjour retiré pour remonter les actions '+width);
    if(tab==='journee')check(await p.locator('.vrm-day-money').evaluate(e=>{const clone=e.cloneNode(true);Object.assign(clone.style,{position:'fixed',left:'-10000px',width:e.getBoundingClientRect().width+'px',boxSizing:'border-box'});e.parentElement.appendChild(clone);const n=clone.querySelector('.vrm-day-hero-n');n.textContent='1 234 567 €';const a=n.getBoundingClientRect(),b=clone.querySelector('.vrm-day-recu').getBoundingClientRect(),ok=n.scrollWidth<=n.clientWidth+1&&a.right<=b.left;clone.remove();return ok;}),'grand montant sans chevauchement '+width);
    if(process.env.BANC_CAPTURES){await p.waitForTimeout(1300);fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-'+width+'.png')});}
   }
  }
  await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Rechercher une paire',exact:true}).click();const recherche=p.getByRole('searchbox',{name:'Rechercher un article dans VRM',exact:true});await recherche.waitFor();check(await recherche.evaluate(e=>getComputedStyle(e).fontSize==='16px'),'recherche globale à 16 px sur iPhone');await recherche.fill('New Balance');await p.locator('.vrm-global-search button').filter({hasText:'New Balance'}).first().waitFor();check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'recherche globale sans débordement');await p.getByRole('button',{name:'Fermer la recherche',exact:true}).click();check(await p.locator('.vrm-global-search').count()===0,'retour à la liste depuis la recherche');
  check(!errors.length,'aucune erreur JavaScript iPhone');console.log(n+' contrôles iPhone réussis');return;
`+marker);
s=s.replace('texte:document.body.innerText.slice(0,1800)', `main:[...document.querySelectorAll('main')].map(e=>({rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity,children:e.children.length})),texte:document.body.innerText.slice(0,1800)`);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
