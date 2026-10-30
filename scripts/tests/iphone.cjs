// Rendu réel de l’app, données synthétiques du banc revendeurs, aucune écriture distante.
const fs=require('fs'),path=require('path'),Module=require('module');const file=path.resolve('scripts/bancs/revendeurs.cjs');let s=fs.readFileSync(file,'utf8');const marker="  await p.setViewportSize({width:1512,height:900});";
if(!s.includes(marker))throw Error('Point de montage absent');
s=s.replace(marker,`
  for(const width of [320,390,430]){
   await p.setViewportSize({width,height:844});
   for(const [tab,section] of [['journee',null],['plat_vinted','Ventes'],['plat_leboncoin','Ventes'],['plat_ebay','Ventes'],['dashboard',null]]){
    // Une navigation interrompue (ERR_ABORTED) par le chargement précédent se refait : c'est l'outil qui l'abandonne, pas l'app.
    await p.waitForTimeout(450); // une feuille qui se ferme rend son entrée d'historique (history.back) : un goto dans la même milliseconde est défait (CLAUDE.md, retour-historique)
    for(let k=0;;k++){try{await p.goto(base+'/?tab='+tab);break;}catch(e){if(!/ERR_ABORTED/.test(String(e&&e.message))||k>=2)throw e;await p.waitForTimeout(800);}}
    await p.waitForFunction(t=>new URLSearchParams(location.search).get('tab')===t||document.querySelector('main'),tab);await p.locator('main').waitFor();await p.evaluate(()=>document.fonts.ready);
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
    if(tab==='plat_ebay')check(await p.locator('[data-ebay-vente]').first().evaluate(e=>e.getBoundingClientRect().height<=56),'commande eBay sur une ligne '+width);
    if(tab==='plat_leboncoin'||tab==='plat_ebay')check(await p.locator('.vrm-shared-sale').first().evaluate(e=>e.getBoundingClientRect().height<=52),'vente partagée sur une ligne '+tab+' '+width);
    if(tab==='plat_vinted'){
     const ligne=p.locator('.vrm-sale-row').first();check(await ligne.evaluate(e=>e.getBoundingClientRect().height<=52),'vente repliée en une ligne '+width);await ligne.locator('.vrm-ledger-sale-toggle').click();
     const prix=p.locator('[data-cout-vente-saisir]').first(),relier=p.locator('[data-cout-vente-relier]').first();
     const a=await prix.boundingBox(),b=await relier.boundingBox();check(Math.abs(a.y-b.y)<2,'actions du coût côte à côte '+width);
     check(await p.locator('.vrm-ledger-drawer-host:not([hidden]) .vrm-ledger-sale-content').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'actions dépliées sans débordement '+width);
     check(await p.getByRole('dialog').evaluate(e=>{const titre=e.querySelector('h2'),prix=e.querySelector('header p'),a=titre.getBoundingClientRect(),b=prix.getBoundingClientRect();return titre.scrollWidth<=titre.clientWidth+1&&b.top>=a.bottom&&b.right<=e.getBoundingClientRect().right;}),'titre complet et montant sans chevauchement '+width);
    }
    if(tab==='plat_vinted')await p.getByRole('button',{name:'Fermer les détails de la vente',exact:true}).click();
    if(tab==='journee')check(await p.locator('.vrm-day-bar .vrm-day-bar-n').first().evaluate(n=>{
      // Le fond VISIBLE : les couches translucides (la tuile, le bandeau transparent depuis le 27 oct.)
      // posées sur le premier fond opaque en remontant — jamais « transparent » lu comme noir.
      const rgba=c=>{const a=(c.match(/[0-9.]+/g)||[]).map(Number);return [a[0]||0,a[1]||0,a[2]||0,a.length>3?a[3]:1];};
      const couches=[];for(let e=n;e;e=e.parentElement){const c=rgba(getComputedStyle(e).backgroundColor);if(c[3]>0)couches.push(c);if(c[3]>=0.999)break;}
      let fond=[255,255,255];for(const c of couches.reverse())fond=fond.map((v,k)=>c[k]*c[3]+v*(1-c[3]));
      const lum=a=>a.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((s,v,k)=>s+v*[.2126,.7152,.0722][k],0);
      const a=lum(fond),b=lum(rgba(getComputedStyle(n).color).slice(0,3));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5;}),'bandeau des tâches contrasté '+width);
    if(tab==='journee')check(await p.locator('.vrm-app-header button[aria-label="Tous les écrans"]').isHidden(),'menu Gestion sans doublon en haut '+width);
    if(tab==='journee')check(await p.locator('.vrm-day-greeting').isVisible()&&await p.locator('.vrm-day-bar').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight),'(27 oct.) le bandeau du bonjour est là et les compteurs du jour restent visibles sans défiler '+width);
    if(tab==='journee')check(await p.locator('.vrm-day-money').evaluate(e=>{const clone=e.cloneNode(true);Object.assign(clone.style,{position:'fixed',left:'-10000px',width:e.getBoundingClientRect().width+'px',boxSizing:'border-box'});e.parentElement.appendChild(clone);const n=clone.querySelector('.vrm-day-hero-n');n.textContent='1 234 567 €';const a=n.getBoundingClientRect(),b=clone.querySelector('.vrm-day-recu').getBoundingClientRect(),ok=n.scrollWidth<=n.clientWidth+1&&(a.right<=b.left||a.bottom<=b.top);clone.remove();return ok;}),'grand montant sans chevauchement '+width);
    if(process.env.BANC_CAPTURES){await p.waitForTimeout(1300);fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-'+width+'.png')});}
   }
  }
  await p.setViewportSize({width:390,height:844});await p.getByRole('button',{name:'Rechercher une paire',exact:true}).click();const recherche=p.getByRole('searchbox',{name:'Rechercher un article dans VRM',exact:true});await recherche.waitFor();check(await recherche.evaluate(e=>getComputedStyle(e).fontSize==='16px'),'recherche globale à 16 px sur iPhone');await recherche.fill('New Balance');await p.locator('.vrm-global-search button').filter({hasText:'New Balance'}).first().waitFor();check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'recherche globale sans débordement');await p.getByRole('button',{name:'Fermer la recherche',exact:true}).click();check(await p.locator('.vrm-global-search').count()===0,'retour à la liste depuis la recherche');
  check(!errors.length,'aucune erreur JavaScript iPhone');console.log(n+' contrôles iPhone réussis');return;
`+marker);
s=s.replace('texte:document.body.innerText.slice(0,1800)', `main:[...document.querySelectorAll('main')].map(e=>({rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity,children:e.children.length})),texte:document.body.innerText.slice(0,1800)`);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
