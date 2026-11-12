// Actual React UI; synthetic pages and receipts, no real Vinted actions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 // (12 nov.) JaugeActions (lot G) lit la jauge par `lireTout` d'App.jsx : servi ici par une lecture muette (« pas su »),
 // sans embarquer toute l'app (ses CSS, ses migrations) dans ce banc de l'écran Favoris.
 const sansApp={name:'sans-app',setup(b){b.onResolve({filter:/(^|\/)App\.jsx$/},()=>({path:'App.jsx',namespace:'sans-app'}));b.onLoad({filter:/.*/,namespace:'sans-app'},()=>({contents:'export const lireTout=async()=>null;',loader:'js'}));b.onResolve({filter:/\.css$/},a=>({path:a.path,namespace:'css-vide'}));b.onLoad({filter:/.*/,namespace:'css-vide'},()=>({contents:'',loader:'js'}));}};
 const racine=path.resolve(__dirname,'../..');const bundle=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import{ajouterSourceApp}from'./src/i18n/index.js';import frApp from'./src/i18n/langues/fr.js';ajouterSourceApp(frApp);import Favoris from'./src/FavorisVinted.jsx';
 const root=createRoot(document.getElementById('root'));window.pages=0;window.envois=0;window.ouvertures=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.controleCopie=t},configurable:true});
 const dateNotification=new Date(Date.now()-7*3600000).toISOString();const note=i=>({id:'n'+i,body:'Camille '+i+' a ajouté ton article à ses favoris.',actor:{login:'Camille '+i},link:'/items/'+(100+i)+'/conversation/new',user_id:200+i,created_at:dateNotification,is_read:true});
 window.fetch=async(url,opts={})=>{const ok=x=>({ok:true,json:async()=>x});
 if(url.startsWith('/api/compte')&&opts.method==='POST'){if(window.retarderLancement)await new Promise(r=>window.finLancement=r);return{ok:false,json:async()=>({message:'Le destinataire n’est pas confirmé.',code:'favoris_preuve_absente',diagnostic:{notifications:4,liensExacts:0,selection:1,owner:'secret-prive',pairesNatives:987654321}})};}
 if(opts.method==='POST'&&url.includes('on_conflict=owner,id'))return ok([JSON.parse(opts.body)]);
 if(url.startsWith('/api/compte'))return ok({ok:true,serveur:Date.now(),vue:{active:false,jobs:[{notificationId:'n1',etat:'envoye',envoyeLe:Date.now()-8*3600000},{notificationId:'n4',etat:'verifie'},{notificationId:'n2',etat:'refuse',raison:'identite_non_confirmee'}]}});
 if(url.includes('_favoris_archive'))return ok(window.pages?[{owner:'owner-test',data:{archiveVersion:1,uid:'123',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[note(1),...Array.from({length:window.pages+2},(_,i)=>note(i+2))]},sync:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pagesLues:window.pages,totalPages:2,complete:window.pages===2},limite:false}}]:[]);
 if(url.includes('vrm_favoris_reglages_'))return ok([]);
 return ok([{owner:'owner-test',data:{uid:'123',domain:'www.vinted.fr',type:'notifications',payload:{notifications:[note(1)]}}}]);};
 window.afficherFavoris=()=>root.render(<Favoris articlesVendus={new Set(window.idsVendus||[])} uid="123" owner="owner-test" chargementAutomatique ownerActuel={()=>'owner-test'} base="https://base.invalid" headers={()=>({})} ouvrirFavori={async x=>{window.ouvertures.push(x.id);return await new Promise(r=>window.accuserOuverture=r);}} executerFavori={async()=>{window.envois++;throw Error('No real sending');}} verifierExtension={async()=>({disponible:true,canal:'Chrome direct'})} recupererPage={async()=>{window.pages++;return{ok:true,data:{pagesLues:window.pages,totalPages:2,complete:window.pages===2}};}}/>);window.afficherFavoris();`},bundle:true,write:false,format:'iife',logLevel:'silent',plugins:[sansApp]});
 const b=await chromium.launch({executablePath:process.env.VRM_CHROMIUM_PATH||(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of [320,390,1512]){const p=await b.newPage({viewport:{width,height:950}});await p.setContent('<div id="root"></div>');await p.addStyleTag({content:'body{margin:12px;font-family:Arial}'+fs.readFileSync(path.join(racine,'src/styles-captures.css'),'utf8')});await p.addScriptTag({content:bundle.outputFiles[0].text});
 // (12 nov.) L'écran Favoris est la page en trois temps (lot favoris-clair, 11 nov.) : plus de liste PAR PERSONNE
 // (« VRM ne montre jamais qui ») ; les annonces portent le NOMBRE de personnes (data-fc-personnes) et ce qui reste
 // à écrire (data-fc-aecrire). Ce test juge les mêmes règles de l'historique sur cette forme : pages fusionnées sans
 // perdre la première, « lu » ≠ « envoyé », vérification sans envoi ni double ouverture, refus visible, contrôle
 // copiable sans donnée privée, lancement refusé expliqué, article vendu jamais choisi. Les noms (« Camille ») ne sont
 // plus à l'écran : ils ne servent qu'à prouver qu'ils ne fuient pas dans les contrôles copiés.
 const annonces=()=>p.evaluate(()=>[...document.querySelectorAll('[data-fc-annonce]')].map(e=>({id:e.dataset.fcAnnonce,personnes:Number(e.querySelector('[data-fc-personnes]').dataset.fcPersonnes),aEcrire:Number(e.dataset.fcAecrire),choisissable:e.getAttribute('role')==='checkbox',choisie:e.dataset.fcChoisie==='1',texte:e.textContent})));
 const somme=l=>l.reduce((n,a)=>n+a.personnes,0);
 await p.locator('[data-fc-annonce]').first().waitFor({state:'attached'});
 let l=await annonces();
 check(l.length===1&&l[0].id==='101'&&somme(l)===1&&l[0].aEcrire===0&&!l[0].choisissable,'confirmed sent favorite cannot be selected');
 check(l[0].texte.includes('Déjà écrit'),'the confirmed send is shown as written');
 const outils=p.getByRole('button',{name:'Plus d’outils',exact:true});await outils.click();
 const feuille=p.locator('.vrm-favoris-voile:not([hidden]) [data-favoris-feuille]');await feuille.waitFor();
 check(await feuille.locator('.vrm-favoris-diagnostic').evaluate(e=>!e.open),'technical assistance is collapsed initially');
 await p.getByRole('button',{name:'Récupérer toutes les pages',exact:true}).click();await p.getByRole('status').filter({hasText:'Toutes les pages disponibles ont été récupérées.'}).waitFor();
 l=await annonces();
 check(l.length===5&&somme(l)===5&&l.some(a=>a.id==='101'),'all available pages merged without losing first page');
 check(l.filter(a=>a.texte.includes('Déjà écrit')).length===1,'is_read never counts as sent');
 // n3 et n5 : lus (is_read) et sans envoi ⇒ à écrire. n2 interrompu et n4 clôturé : jamais reproposés d'eux-mêmes (favoris-clair).
 check(l.filter(a=>a.aEcrire>0).map(a=>a.id).sort().join()==='103,105','only read-but-never-sent favorites are to write; interrupted and closed ones are not re-proposed : '+JSON.stringify(l.map(a=>[a.id,a.aEcrire])));
 check(await p.evaluate(()=>window.envois===0&&window.pages===2),'loading history never dispatches a message');

 const boutonHaut=p.getByRole('button',{name:'Vérifier un favori',exact:true});
 check(await boutonHaut.isVisible(),'la vérification porte un libellé visible même sur téléphone');
 await boutonHaut.click();await p.waitForFunction(()=>typeof window.accuserOuverture==='function');
 check(await p.evaluate(()=>window.ouvertures.length===1&&window.ouvertures[0]==='n2'&&window.envois===0),'le bouton vérifie uniquement le premier favori disponible sans message ni sélection nécessaire');
 const enCours=p.getByRole('button',{name:'Vérification…',exact:true});
 check(await enCours.isDisabled(),'le bouton principal ne peut pas relancer une ouverture en cours');
 await enCours.click({force:true,timeout:2000}).catch(()=>{});check(await p.evaluate(()=>window.ouvertures.length===1),'une ouverture en cours ne peut pas partir deux fois');
 await p.evaluate(()=>window.accuserOuverture({ok:false,error:'Ouvre les notifications sur Vinted dans ce profil Chrome, puis réessaie.',controleOuverture:{version:'5.221.0',etape:'commande'}}));
 const alerte=feuille.getByRole('alert').filter({hasText:'Vérification interrompue'});await alerte.waitFor();
 check(await alerte.evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('[data-favoris-feuille] .vrm-favoris-outils'))&Node.DOCUMENT_POSITION_FOLLOWING)),'le refus apparaît en haut de la feuille, avant les outils');
 await p.evaluate(()=>{window.ouvertures=[];window.accuserOuverture=null;});
 await boutonHaut.click();await p.waitForFunction(()=>typeof window.accuserOuverture==='function');
 await p.evaluate(()=>window.accuserOuverture({ok:true,data:{ouvert:true,preuve:'confirmee'}}));await p.getByRole('status').filter({hasText:'Le lien natif a été enregistré'}).waitFor();
 check(await p.evaluate(()=>window.envois===0),'le reçu de vérification ne lance aucun message');
 await p.evaluate(()=>{window.ouvertures=[];window.accuserOuverture=null;});await boutonHaut.click();await p.waitForFunction(()=>typeof window.accuserOuverture==='function');
 await p.evaluate(()=>window.accuserOuverture({ok:true,data:{ouvert:true,preuve:'non_confirmee'}}));await feuille.getByRole('alert').filter({hasText:'n’a pas été confirmée'}).waitFor();
 check(await p.getByText(/lien natif a été enregistré/).count()===0,'ouvrir un onglet sans preuve ne donne pas de faux statut positif');
 await feuille.getByText('Assistance technique · favoris',{exact:true}).click();
 await feuille.getByRole('button',{name:'Copier le contrôle',exact:true}).click();
 const diagnostic=await p.evaluate(()=>window.controleCopie);check(diagnostic.includes('VRM-favoris-controle-v1')&&!['owner-test','Camille','https:','notificationId'].some(s=>diagnostic.includes(s)),'contrôle copiable sans données privées');
 await feuille.getByRole('button',{name:'Fermer',exact:true}).click();await p.locator('[data-favoris-feuille]').waitFor({state:'hidden'});

 // Un lancement refusé par le serveur : dit sur la page, copié avec sa vraie cause, sans champ inconnu.
 await p.locator('[data-fc-tout]').click();
 check(Number(await p.locator('[data-fc-choisis]').getAttribute('data-fc-choisis'))===2,'choosing every annonce picks only the favorites still to write');
 await p.locator('[data-fc-page] [data-favoris-message]').fill('Bonjour de démonstration');
 await p.locator('[data-fc-verifier]').click();
 await p.evaluate(()=>window.retarderLancement=true);await p.locator('[data-fc-envoyer]').click();
 await p.waitForFunction(()=>typeof window.finLancement==='function');
 check(await p.locator('[data-fc-envoyer]').isDisabled(),'on ne relance pas pendant un lancement');
 check(await p.locator('[data-fc-page] [data-favoris-message]').isDisabled(),'le message est verrouillé pendant le lancement');
 await p.evaluate(()=>window.finLancement());
 await p.locator('[data-fc-erreur]').filter({hasText:'Le destinataire n’est pas confirmé.'}).waitFor();
 check(await p.evaluate(()=>window.envois===0),'a refused launch sends nothing');
 await p.locator('[data-fc-recap] .vrm-fa-fermer').click();await p.locator('[data-fc-recap]').waitFor({state:'detached'});
 await outils.click();await feuille.waitFor();
 if(!(await feuille.locator('.vrm-favoris-diagnostic').evaluate(e=>e.open)))await feuille.getByText('Assistance technique · favoris',{exact:true}).click();
 await feuille.getByRole('button',{name:'Copier le contrôle',exact:true}).click();const controle=await p.evaluate(()=>JSON.parse(window.controleCopie));
 check(controle.lancement&&controle.lancement.code==='favoris_preuve_absente'&&controle.lancement.diagnostic.selection===1,'le contrôle contient la cause réelle du lancement refusé');
 check(!JSON.stringify(controle).includes('secret-prive')&&!JSON.stringify(controle).includes('987654321'),'les champs inconnus et valeurs hors limites ne sont pas copiés');

 await p.evaluate(()=>{window.accuserOuverture=null;});await feuille.getByRole('button',{name:'Vérifier le premier sélectionné',exact:true}).click();await p.waitForFunction(()=>typeof window.accuserOuverture==='function');
 await p.evaluate(()=>window.accuserOuverture({ok:false,error:'Ouvre les notifications sur Vinted dans ce profil Chrome, puis réessaie.',controleOuverture:{version:'5.221.0',etape:'commande'}}));
 await feuille.getByRole('alert').filter({hasText:'Vérification interrompue'}).waitFor();
 check(await feuille.getByRole('alert').filter({hasText:'Ouvre les notifications sur Vinted'}).count()===1,'un refus réel d’ouverture est affiché comme une erreur, pas un état discret');
 await feuille.getByRole('button',{name:'Copier le contrôle',exact:true}).click();const refus=await p.evaluate(()=>JSON.parse(window.controleCopie));
 check(refus.extension==='5.221.0'&&refus.code==='notifications_non_affichees'&&refus.etape==='commande'&&!refus.lancement,'la version mesurée et le refus sont copiés, sans recycler le lancement précédent');
 if(!(await feuille.locator('.vrm-favoris-diagnostic').evaluate(e=>e.open)))await feuille.getByText('Assistance technique · favoris',{exact:true}).click();
 await feuille.getByRole('button',{name:'Vérifier que l’extension lit tes notifications',exact:true}).click();
 await feuille.getByRole('button',{name:'Copier le diagnostic',exact:true}).click();
 const assistance=await p.evaluate(()=>JSON.parse(window.controleCopie));
 check(assistance.verification.extension==='5.221.0'&&assistance.verification.code==='notifications_non_affichees','le diagnostic détaillé reprend le contrôle de la vraie ouverture du composant parent');
 check(!assistance.lancement,'le rapport ne recycle pas un refus de lancement effacé');
 await feuille.getByRole('button',{name:'Fermer',exact:true}).click();await p.locator('[data-favoris-feuille]').waitFor({state:'hidden'});
 await p.locator('[data-fc-verifier]').click();await p.locator('[data-fc-recap]').waitFor();
 check(await p.locator('[data-fc-erreur]').count()===0,'une nouvelle vérification retire uniquement l’ancien refus de raccordement');
 await p.locator('[data-fc-recap] .vrm-fa-fermer').click();await p.locator('[data-fc-recap]').waitFor({state:'detached'});

 // Un article vendu (103) : jamais choisi, dit « Vendu », et retiré du choix en cours.
 check((await annonces()).find(a=>a.id==='103').choisie,'the annonce is chosen before it sells');
 await p.evaluate(()=>{window.idsVendus=['103'];window.afficherFavoris();});await p.waitForFunction(()=>{const e=document.querySelector('[data-fc-annonce="103"]');return e&&e.getAttribute('role')!=='checkbox';});
 l=await annonces();const vendu=l.find(a=>a.id==='103');
 check(vendu&&!vendu.choisissable&&vendu.aEcrire===0,'a sold article cannot be selected');
 check(vendu.texte.includes('Vendu'),'sold article is labelled on its row');
 check(l.filter(a=>a.choisissable).map(a=>a.id).join()==='105','contact list excludes sold favorites and retains other items');
 check(!vendu.choisie&&Number(await p.locator('[data-fc-choisis]').getAttribute('data-fc-choisis'))===1,'an article newly marked sold is removed from the current selection');
 check(await p.evaluate(()=>window.envois===0),'marking a favorite sold does not send a message');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'historique-'+width+'.png'),fullPage:true});}await p.close();}}
 finally{await b.close();}console.log(n+' contrôles historique React réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
