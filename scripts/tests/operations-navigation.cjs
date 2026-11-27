// ORGANISATION : HORS DE LA NAVIGATION, JOIGNABLE PAR RÉGLAGES (29 oct., CLAUDE.md §3 « Organisation »).
// (27 nov., tests-unitaires-verts) Ce test se greffait à la FIN du banc revendeurs.cjs : il ne tournait que si tout ce banc
// (navigation et dessin du 31 oct., remplacés depuis par « VRM natif », 19 nov.) passait d'abord — rouge sans rapport avec
// Organisation. Il se greffe maintenant juste après la mise en place du banc (son serveur dist/, sa fausse base), comme
// studio-ecrans.cjs, et s'arrête là. La navigation d'aujourd'hui : 5 onglets égaux en bas (téléphone), le rail à
// l'ordinateur ; plus de menu « Gestion ». Données synthétiques, réseau simulé.
const fs=require('fs'),path=require('path'),Module=require('module');
const file=path.resolve(__dirname,'../bancs/revendeurs.cjs');let s=fs.readFileSync(file,'utf8');
const marker="  await p.setViewportSize({width:1512,height:900});";
if(!s.includes(marker))throw Error('bank marker absent');
s=s.replace(marker,`
  const {VIDE,appliquer}=await import(path.resolve(__dirname,'../../src/operations/metier.js'));
  let operations=VIDE();
  await p.route('**/api/compte?mode=operations',async r=>{let donnees=operations;if(r.request().method()==='POST'){const c=r.request().postDataJSON();donnees=appliquer(operations,c,{acteur:'test',maintenant:new Date().toISOString(),empreinte:'banc'});operations=donnees;}return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,donnees,equipe:[],serveur:new Date().toISOString(),confirmees:[]})});});
  for(const largeur of [390,1512]){
   await p.setViewportSize({width:largeur,height:900});await p.goto(base+'/?tab=journee');await p.locator('nav').first().waitFor();
   const navs=await p.evaluate(()=>[...document.querySelectorAll('nav,[role="navigation"],[role="tablist"]')].filter(n=>n.getClientRects().length).map(n=>n.innerText));
   check(navs.length>0&&navs.every(t=>!/Organisation/.test(t)),'organisation hors de la navigation '+largeur);
   await p.goto(base+'/?tab=settings');await p.getByText('Stock et numéros',{exact:true}).first().click();await p.locator('[data-reglage-organisation]').click();   /* Réglages → Stock et numéros → Organisation (groupe replié) */
   await p.getByRole('region',{name:'Organisation',exact:true}).waitFor();
   check(await p.getByRole('button',{name:'Réservations',exact:true}).isVisible(),'organisation accessible via Réglages '+largeur);
   await p.getByRole('button',{name:'Lots',exact:true}).click();await p.getByRole('button',{name:'+ Ajouter',exact:true}).click();
   check(await p.getByLabel('Prix d’achat global (€)').isVisible(),'formulaire lots intégré '+largeur);
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'organisation intégrée sans débordement '+largeur);
  }
  check(!errors.length,'aucune erreur JavaScript (organisation)');console.log(n+' contrôles navigation Organisation réussis');return;
`+marker);
const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
