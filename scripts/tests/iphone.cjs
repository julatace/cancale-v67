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
    if(tab==='plat_vinted'){
     const prix=p.locator('[data-cout-vente-saisir]').first(),relier=p.locator('[data-cout-vente-relier]').first();
     const a=await prix.boundingBox(),b=await relier.boundingBox();check(Math.abs(a.y-b.y)<2,'actions du coût côte à côte '+width);
     check(await p.locator('.vrm-sale-row').first().evaluate(e=>e.getBoundingClientRect().height<270),'ligne de vente compacte '+width);
    }
    if(tab==='journee')check(await p.locator('.vrm-app-header button[aria-label="Tous les écrans"]').isHidden(),'menu Gestion sans doublon en haut '+width);
    if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-'+width+'.png')});}
   }
  }
  await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Rechercher une paire',exact:true}).click();const recherche=p.getByRole('searchbox',{name:'Rechercher un article dans VRM',exact:true});await recherche.waitFor();check(await recherche.evaluate(e=>getComputedStyle(e).fontSize==='16px'),'recherche globale à 16 px sur iPhone');await recherche.fill('New Balance');await p.locator('.vrm-global-search button').filter({hasText:'New Balance'}).first().waitFor();check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'recherche globale sans débordement');await p.getByRole('button',{name:'Fermer la recherche',exact:true}).click();check(await p.locator('.vrm-global-search').count()===0,'retour à la liste depuis la recherche');
  check(!errors.length,'aucune erreur JavaScript iPhone');console.log(n+' contrôles iPhone réussis');return;
`+marker);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
