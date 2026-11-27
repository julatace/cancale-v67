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
   // (27 nov., tests-unitaires-verts) PORTÉ sur la navigation et le dessin d'aujourd'hui. Ce banc (20 oct.) ouvrait les écrans
   //  par l'ESPACE de site (plat_vinted puis l'onglet de section .vrm-platform-tabs) et mesurait le dessin du 20 oct.
   //  (en-tête de tableau, recherche + tri d'Annonces, panneaux « stock » et « publication », colis compact, inspecteur de
   //  vente en tiroir). Tout cela a été remplacé EXPRÈS : navigation par tâche (31 oct. : « plus d'espace de site à part »),
   //  « VRM natif », le SEUL design (19 nov., docs/design/NATIF.md), le toucher d'une vente ouvre LA fiche (14 nov.,
   //  proposition 62 — jugé par scripts/tests/fiche-vente-interface.cjs), une tâche montre tous ses sites (20 nov. soir).
   //  Ces contrôles de dessin d'hier sont RETIRÉS avec leur objet ; restent, sur chaque écran d'aujourd'hui (ses vrais
   //  identifiants de lien) : aucun débordement, chaque bouton nommé, le thème sombre posé, le code de retrait entier.
   for(const [nom,tab] of [['ventes','ventes'],['annonces','annonces'],['achats','achats'],['messages','messages'],['annonces-ebay','ebay_annonces'],['messages-ebay','ebay_messages'],['colis','colis'],['retraits','cat_achats'],['parametres','settings'],['statistiques','dashboard'],['comptabilite','compta'],['stock','garage'],['organisation','organisation']]){
    if(process.env.STUDIO_SCREENS&&!process.env.STUDIO_SCREENS.split(',').includes(nom))continue;
    await p.goto(base+'/?tab='+tab);await p.locator('main').waitFor();await p.evaluate(()=>document.fonts.ready);
    await p.waitForTimeout(600);await p.locator('main').evaluate(e=>e.scrollTop=0);
    check(await p.locator('main').evaluate(e=>e.innerText.trim().length>0),'écran rendu '+nom+' '+width);
    if(process.env.STUDIO_DARK)check(await p.locator('html').getAttribute('data-theme')==='dark','thème sombre actif '+nom+' '+width);
    check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'aucun débordement '+nom+' '+width);
    check(await p.locator('main button').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height;}).every(e=>e.textContent.trim()||e.getAttribute('aria-label')||e.getAttribute('title')||e.getAttribute('aria-labelledby')||e.querySelector('img[alt]'))),'boutons nommés '+nom+' '+width);
    if(nom==='retraits')await p.waitForFunction(()=>[...document.querySelectorAll('main [data-stream-type="code"]')].some(e=>e.textContent.replace(/\\s+/g,'')==='001234'),null,{timeout:10000}).catch(()=>{});
    if(nom==='retraits')check(await p.locator('main [data-stream-type="code"]').evaluateAll(es=>es.some(e=>e.textContent.replace(/\\s+/g,'')==='001234')),'code de retrait entier, zéros initiaux conservés '+width);
    if(process.env.BANC_CAPTURES){fs.mkdirSync(process.env.BANC_CAPTURES,{recursive:true});await p.screenshot({path:path.join(process.env.BANC_CAPTURES,nom+'-'+width+'.png')});}
   }
  }
  check(!errors.length,'aucune erreur JavaScript écrans secondaires');console.log(n+' contrôles Studio écrans réussis');return;
`+marker);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
