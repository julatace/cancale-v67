// Rendu réel de l’app, données synthétiques du banc revendeurs, aucune écriture distante.
const fs=require('fs'),path=require('path'),Module=require('module');const file=path.resolve('scripts/bancs/revendeurs.cjs');let s=fs.readFileSync(file,'utf8');const marker="  await p.setViewportSize({width:1512,height:900});";
if(!s.includes(marker))throw Error('Point de montage absent');
s=s.replace(marker,`
  // (27 nov., tests-unitaires-verts) PORTÉ sur l'app d'aujourd'hui. Ce test (oct.) mesurait l'iPhone sur le dessin d'avant :
  //  bandeau du bonjour et compteurs de Ma journée (.vrm-day-*), espace de site et son onglet de section (.vrm-platform-tabs),
  //  vente dépliée en tiroir, barre .vrm-tabbar, « Tous les écrans ». Tout cela a été remplacé EXPRÈS : « VRM natif », le SEUL
  //  design (19 nov., docs/design/NATIF.md : 5 onglets égaux en bas, grands titres, feuilles), navigation par tâche (31 oct.),
  //  le toucher d'une vente ouvre LA fiche (14 nov.). Ces mesures d'hier sont retirées avec leur objet ; restent celles qui
  //  font un iPhone confortable, sur chaque écran des 5 onglets : aucun débordement, le contenu à la largeur réelle, aucune
  //  réduction globale (zoom), les 5 onglets du bas touchables (44 px), une saisie à 16 px (pas de zoom Safari), et la
  //  recherche globale à 16 px.
  for(const width of [320,390,430]){
   await p.setViewportSize({width,height:844});
   for(const tab of ['journee','annonces','ventes','achats','dashboard']){
    await p.waitForTimeout(450);
    for(let k=0;;k++){try{await p.goto(base+'/?tab='+tab);break;}catch(e){if(!/ERR_ABORTED/.test(String(e&&e.message))||k>=2)throw e;await p.waitForTimeout(800);}}
    await p.locator('main').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(500);
    await p.locator('main').evaluate(e=>e.scrollTop=0);
    check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'écran sans débordement '+tab+' '+width);
    check(await p.locator('main').evaluate(e=>Math.abs(e.getBoundingClientRect().width-innerWidth)<2),'largeur réelle du contenu '+tab+' '+width);
    check(await p.locator('nav[data-n-onglets] [data-n-onglet]').evaluateAll(es=>{const v=es.filter(e=>e.getClientRects().length);return v.length===5&&v.every(e=>e.getBoundingClientRect().height>=44);}),'cinq onglets tactiles '+tab+' '+width);
    if(!process.env.IPHONE_BASELINE)check(await p.locator('main').evaluate(e=>getComputedStyle(e).zoom==='1'),'aucune réduction globale '+tab+' '+width);
    check(await p.locator('main input[type="search"], main input[type="text"], main textarea').evaluateAll(es=>es.filter(e=>e.getClientRects().length).every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)),'saisie sans zoom Safari '+tab+' '+width);
    if(process.env.BANC_CAPTURES){await p.waitForTimeout(1300);fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,tab+'-'+width+'.png')});}
   }
  }
  await p.setViewportSize({width:390,height:844});await p.goto(base+'/?tab=journee');await p.locator('main').waitFor();
  await p.locator('main').click({position:{x:5,y:5}}).catch(()=>{});await p.keyboard.press('/');   /* « / » ouvre LA recherche de la coque (src/aujourdhui/TeteDroite.jsx) */
  const recherche=p.locator('[data-recherche-champ=""]');await recherche.waitFor();
  check(await recherche.evaluate(e=>parseFloat(getComputedStyle(e).fontSize)>=16),'recherche globale à 16 px au moins sur iPhone (pas de zoom de Safari)');
  check(!errors.length,'aucune erreur JavaScript iPhone');console.log(n+' contrôles iPhone réussis');return;
`+marker);
s=s.replace('texte:document.body.innerText.slice(0,1800)', `main:[...document.querySelectorAll('main')].map(e=>({rect:e.getBoundingClientRect().toJSON(),display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,opacity:getComputedStyle(e).opacity,children:e.children.length})),texte:document.body.innerText.slice(0,1800)`);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
