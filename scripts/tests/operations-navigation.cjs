const fs=require('fs'),path=require('path'),Module=require('module');const file=path.resolve('scripts/bancs/revendeurs.cjs');let s=fs.readFileSync(file,'utf8');const marker="check(!errors.length,'aucune erreur JavaScript');";if(!s.includes(marker))throw Error('bank marker absent');s=s.replace(marker,`
  const {VIDE,appliquer}=await import(path.resolve('src/operations/metier.js'));
  let operations=VIDE();
  await p.route('**/api/compte?mode=operations',async r=>{let donnees=operations;if(r.request().method()==='POST'){const c=r.request().postDataJSON();donnees=appliquer(operations,c,{acteur:'test',maintenant:new Date().toISOString(),empreinte:'banc'});operations=donnees;}return r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,donnees,equipe:[],serveur:new Date().toISOString(),confirmees:[]})});});
  for(const largeur of [390,1512]){
   await p.setViewportSize({width:largeur,height:900});await p.goto(base+'/?tab=journee');await p.locator('[data-barre-jour]').waitFor();
   // (29 oct.) Organisation n'est plus dans le menu : on y entre par Réglages → Stock et rangement.
   if(largeur<1024){await p.locator('.vrm-tabbar').getByRole('button',{name:'Gestion',exact:true}).click();await p.getByRole('menuitem',{name:'Comptabilité',exact:true}).waitFor();check(await p.getByRole('menuitem',{name:'Organisation',exact:true}).count()===0,'organisation hors du menu Gestion '+largeur);await p.keyboard.press('Escape');}
   else check(await p.locator('.vrm-sidebar').getByRole('button',{name:'Organisation',exact:true}).count()===0,'organisation hors du rail '+largeur);
   await p.goto(base+'/?tab=settings');await p.locator('[data-reglage-organisation]').click();
   await p.getByRole('region',{name:'Organisation',exact:true}).waitFor(); // sur téléphone le titre doublon de la barre se tait (26 oct.) : on attend la section
   check(await p.getByRole('button',{name:'Réservations',exact:true}).isVisible(),'organisation accessible via Réglages '+largeur);
   await p.getByRole('button',{name:'Lots',exact:true}).click();await p.getByRole('button',{name:'+ Ajouter',exact:true}).click();
   check(await p.getByLabel('Prix d’achat global (€)').isVisible(),'formulaire lots intégré '+largeur);
   check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'organisation intégrée sans débordement '+largeur);
  }
`+marker);const m=new Module(file,module);m.filename=file;m.paths=Module._nodeModulePaths(path.dirname(file));m._compile(s,file);
