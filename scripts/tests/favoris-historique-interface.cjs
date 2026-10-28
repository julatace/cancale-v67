// Actual React UI; synthetic pages and receipts, no real Vinted actions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),{chromium}=require('playwright');
(async()=>{
 const racine=path.resolve(__dirname,'../..');const bundle=await build({stdin:{resolveDir:racine,loader:'jsx',contents:`
 import React from'react';import{createRoot}from'react-dom/client';import Favoris from'./src/FavorisVinted.jsx';
 const root=createRoot(document.getElementById('root'));window.pages=0;window.envois=0;window.ouvertures=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>window.controleCopie=t},configurable:true});
 const note=i=>({id:'n'+i,body:'Camille '+i+' a ajouté ton article à ses favoris.',actor:{login:'Camille '+i},link:'/items/'+(100+i)+'/conversation/new',user_id:200+i,created_at:new Date(Date.now()-7*3600000).toISOString(),is_read:true});
 window.fetch=async(url,opts={})=>{const ok=x=>({ok:true,json:async()=>x});
 if(url.startsWith('/api/compte')&&opts.method==='POST'){if(window.retarderLancement)await new Promise(r=>window.finLancement=r);return{ok:false,json:async()=>({message:'Le destinataire n’est pas confirmé.',code:'favoris_preuve_absente',diagnostic:{notifications:4,liensExacts:0,selection:1,owner:'secret-prive',pairesNatives:987654321}})};}
 if(opts.method==='POST'&&url.includes('on_conflict=owner,id'))return ok([JSON.parse(opts.body)]);
 if(url.startsWith('/api/compte'))return ok({ok:true,serveur:Date.now(),vue:{active:false,jobs:[{notificationId:'n1',etat:'envoye',envoyeLe:Date.now()-10000},{notificationId:'n4',etat:'verifie'},{notificationId:'n2',etat:'refuse',raison:'identite_non_confirmee'},{notificationId:'n3',etat:'annule'}]}});
 if(url.includes('_favoris_archive'))return ok(window.pages?[{owner:'owner-test',data:{archiveVersion:1,uid:'123',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[note(1),...Array.from({length:window.pages+1},(_,i)=>note(i+2))]},sync:{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',pagesLues:window.pages,totalPages:2,complete:window.pages===2},limite:false}}]:[]);
 if(url.includes('vrm_favoris_reglages_'))return ok([]);
 return ok([{owner:'owner-test',data:{uid:'123',domain:'www.vinted.fr',type:'notifications',payload:{notifications:[note(1)]}}}]);};
 window.afficherFavoris=()=>root.render(<Favoris articlesVendus={new Set(window.idsVendus||[])} uid="123" owner="owner-test" ownerActuel={()=>'owner-test'} base="https://base.invalid" headers={()=>({})} ouvrirFavori={async x=>{window.ouvertures.push(x.id);return await new Promise(r=>window.accuserOuverture=r);}} executerFavori={async()=>{window.envois++;throw Error('No real sending');}} verifierExtension={async()=>({disponible:true,canal:'Chrome direct'})} recupererPage={async()=>{window.pages++;return{ok:true,data:{pagesLues:window.pages,totalPages:2,complete:window.pages===2}};}}/>);window.afficherFavoris();`},bundle:true,write:false,format:'iife',logLevel:'silent'});
 const b=await chromium.launch({executablePath:(require('fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':'/opt/pw-browsers/chromium'),args:['--no-sandbox']});let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
 try{for(const width of [320,390,1512]){const p=await b.newPage({viewport:{width,height:950}});await p.setContent('<div id="root"></div>');await p.addStyleTag({content:'body{margin:12px;font-family:Arial}'+fs.readFileSync(path.join(racine,'src/styles-captures.css'),'utf8')});await p.addScriptTag({content:bundle.outputFiles[0].text});
 await p.getByRole('button',{name:'Afficher les favoris'}).click();await p.getByRole('button',{name:'Envoyer un message aux favoris',exact:true}).click();await p.locator('.vrm-favoris-rows article').waitFor();await p.getByText('Message déjà envoyé',{exact:true}).waitFor();
 check(await p.getByRole('button',{name:'Dans la file (0)',exact:true}).count()===1,'queue filter with count');
 check(await p.getByRole('button',{name:'Envoi à vérifier (0)',exact:true}).count()===1,'uncertain filter with count');
 check(await p.getByRole('checkbox',{name:'Sélectionner Camille 1',exact:true}).isDisabled(),'confirmed sent favorite cannot be selected');
 check((await p.locator('time').innerText()).includes('7 h'),'native age displayed');
 await p.getByRole('button',{name:'Récupérer toutes les pages',exact:true}).click();await p.getByRole('status').filter({hasText:'Toutes les pages disponibles ont été récupérées.'}).waitFor();
 check(await p.locator('.vrm-favoris-rows article').count()===4,'all available pages merged without losing first page');

 const boutonHaut=p.getByRole('button',{name:'Vérifier un favori',exact:true});
 check(await boutonHaut.isVisible(),'la vérification porte un libellé visible même sur téléphone');
 await boutonHaut.click();await p.waitForFunction(()=>typeof window.accuserOuverture==='function');
 check(await p.evaluate(()=>window.ouvertures.length===1&&window.ouvertures[0]==='n2'&&window.envois===0),'le bouton vérifie uniquement le premier favori disponible sans message ni sélection nécessaire');
 check(await p.getByRole('button',{name:'Vérification…',exact:true}).isDisabled(),'le bouton principal ne peut pas relancer une ouverture en cours');
 await p.evaluate(()=>window.accuserOuverture({ok:false,error:'Ouvre les notifications sur Vinted dans ce profil Chrome, puis réessaie.',controleOuverture:{version:'5.221.0',etape:'commande'}}));
 const alerte=p.getByRole('alert').filter({hasText:'Vérification interrompue'});await alerte.waitFor();
 check(await alerte.evaluate(e=>e.compareDocumentPosition(document.querySelector('.vrm-favoris-rows'))&Node.DOCUMENT_POSITION_FOLLOWING),'le refus apparaît avant la liste, sans devoir descendre jusqu’aux envois');
 await p.evaluate(()=>{window.ouvertures=[];});
 const ouvrir=p.getByRole('button',{name:'Ouvrir ce favori pour vérifier sur Vinted · Camille 2',exact:true});await ouvrir.click();
 check(await ouvrir.isDisabled()&&await p.evaluate(()=>window.ouvertures.length===1),'une ouverture en cours ne peut pas partir deux fois');
 await p.evaluate(()=>window.accuserOuverture({ok:true,data:{ouvert:true,preuve:'confirmee'}}));await p.getByText('Lien enregistré',{exact:true}).waitFor();
 check(await p.evaluate(()=>window.envois===0),'le reçu de vérification ne lance aucun message');
 await ouvrir.click();await p.evaluate(()=>window.accuserOuverture({ok:true,data:{ouvert:true,preuve:'non_confirmee'}}));await p.getByText('Capture non confirmée',{exact:true}).waitFor();
 check(await p.getByText('Lien enregistré',{exact:true}).count()===0,'ouvrir un onglet sans preuve ne donne pas de faux statut positif');
 await p.getByRole('button',{name:'Copier le contrôle',exact:true}).click();
 const diagnostic=await p.evaluate(()=>window.controleCopie);check(diagnostic.includes('VRM-favoris-controle-v1')&&!['owner-test','Camille','https:','notificationId'].some(s=>diagnostic.includes(s)),'contrôle copiable sans données privées');


 await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.locator('.vrm-favoris-rows article').first().waitFor();

 check(await p.getByText('Message déjà envoyé',{exact:true}).count()===1,'is_read never counts as sent');
 await p.getByRole('button',{name:'Interrompus (2)',exact:true}).click();
 check(await p.locator('.vrm-favoris-rows article').count()===2,'interrupted and cancelled favorites can be found together');
 check(await p.getByText('Envoi interrompu',{exact:true}).count()===1,'interrupted row is explicitly labelled');
 check(await p.getByText('Annulé dans la file · non envoyé',{exact:true}).count()===1,'cancelled row does not claim a sent message');
 check((await p.locator('.vrm-favoris-raison').innerText()).includes('destinataire du fil n’a pas été confirmé'),'known interruption reason is readable on mobile without hover');
 await p.getByRole('button',{name:'Clôturés (1)',exact:true}).click();check(await p.locator('.vrm-favoris-rows article').count()===1,'closed filter');check(await p.getByText('Clôturé manuellement · envoi non confirmé',{exact:true}).count()===1,'manual closure does not claim a confirmed send');
 await p.getByRole('button',{name:'Déjà envoyés (1)',exact:true}).click();check(await p.locator('.vrm-favoris-rows article').count()===1,'sent filter');
 await p.getByRole('button',{name:'À contacter (2)',exact:true}).click();check(await p.locator('.vrm-favoris-rows article').count()===2,'contact filter excludes confirmed sent and manually closed');
 await p.getByRole('searchbox',{name:'Rechercher un favori'}).fill('Camille 3');check(await p.locator('.vrm-favoris-rows article').count()===1,'search works across recovered history');
 await p.getByRole('button',{name:'Les 10 premiers'}).click();check(await p.getByRole('checkbox',{checked:true}).count()===1,'selection respects filtered list');
 const recherche=p.getByRole('searchbox',{name:'Rechercher un favori'});
 await recherche.fill('Camille 2');
 check((await p.locator('.vrm-favoris-hors-vue').innerText()).includes('1 favori sélectionné hors de cette vue.'),'hidden selection is explicitly counted');
 const resume=p.locator('[aria-label="Destinataires sélectionnés"]');
 check((await resume.innerText()).includes('Camille 3'),'selected recipient remains named when filtered out');
 await p.getByRole('checkbox',{name:'Sélectionner Camille 2',exact:true}).check();
 check(await resume.locator('li').count()===2,'all selected recipients are listed before preparation');
 await p.getByRole('button',{name:'Retirer Camille 2 de la sélection',exact:true}).click();
 check(await resume.locator('li').count()===1,'a recipient can be removed directly from preview');
 await p.getByRole('button',{name:'Voir toute ma sélection',exact:true}).click();
 check(await recherche.inputValue()===''&&await p.locator('.vrm-favoris-rows article').count()===1,'selection view clears search and exposes every selected favorite');
 check(await p.getByRole('checkbox',{name:'Sélectionner Camille 3',exact:true}).isChecked(),'selection view retains exact chosen notification');
 check(await p.evaluate(()=>window.envois===0),'review and removal never send a message');
 await p.getByRole('button',{name:/^Continuer/}).click();
 await p.getByRole('textbox',{name:'Ton message',exact:true}).fill('Bonjour de démonstration');await p.getByRole('button',{name:'Continuer',exact:true}).click();
 await p.evaluate(()=>window.retarderLancement=true);await p.getByRole('button',{name:'Lancer les envois sélectionnés',exact:true}).click();
 await p.waitForFunction(()=>typeof window.finLancement==='function');
 check(await p.getByRole('button',{name:'← Retour',exact:true}).isDisabled(),'retour vers le message verrouillé pendant le lancement');
 check(await p.getByRole('button',{name:'Fermer',exact:true}).isDisabled(),'la fenêtre ne se ferme pas pendant un lancement');
 check(await p.getByRole('button',{name:'Aléatoire',exact:true}).isDisabled(),'le rythme est verrouillé pendant le lancement');
 await p.evaluate(()=>window.finLancement());
 await p.getByRole('alert').filter({hasText:'Le destinataire n’est pas confirmé.'}).waitFor();
 await p.getByRole('button',{name:'Copier le contrôle',exact:true}).click();const controle=await p.evaluate(()=>JSON.parse(window.controleCopie));
 check(controle.lancement.code==='favoris_preuve_absente'&&controle.lancement.diagnostic.selection===1,'le contrôle contient la cause réelle du lancement refusé');
 check(!JSON.stringify(controle).includes('secret-prive')&&!JSON.stringify(controle).includes('987654321'),'les champs inconnus et valeurs hors limites ne sont pas copiés');

 await p.getByRole('button',{name:'← Retour',exact:true}).click();await p.getByRole('button',{name:'← Retour',exact:true}).click();
 await p.getByRole('searchbox',{name:'Rechercher un favori'}).fill('');
 await p.getByRole('button',{name:'Vérifier le premier sélectionné',exact:true}).click();
 await p.getByRole('alert').filter({hasText:'Le destinataire n’est pas confirmé.'}).waitFor({state:'hidden'});
 check(await p.getByRole('alert').filter({hasText:'Le destinataire n’est pas confirmé.'}).count()===0,'une nouvelle vérification retire uniquement l’ancien refus de raccordement');
 await p.evaluate(()=>window.accuserOuverture({ok:false,error:'Ouvre les notifications sur Vinted dans ce profil Chrome, puis réessaie.',controleOuverture:{version:'5.221.0',etape:'commande'}}));
 await p.getByRole('alert').filter({hasText:'Vérification interrompue'}).waitFor();
 check(await p.getByRole('alert').filter({hasText:'Ouvre les notifications sur Vinted'}).count()===1,'un refus réel d’ouverture est affiché comme une erreur, pas un état discret');
 check(await p.getByText('Capture en attente',{exact:true}).count()===0,'une ouverture refusée ne reste pas affichée en attente');
 await p.getByRole('button',{name:'Copier le contrôle',exact:true}).click();const refus=await p.evaluate(()=>JSON.parse(window.controleCopie));
 check(refus.extension==='5.221.0'&&refus.code==='notifications_non_affichees'&&refus.etape==='commande'&&!refus.lancement,'la version mesurée et le refus sont copiés, sans recycler le lancement précédent');

 await p.getByRole('button',{name:'Fermer',exact:true}).click();
 await p.getByText('Assistance technique · favoris',{exact:true}).click();
 await p.getByRole('button',{name:'Vérifier la capture des notifications',exact:true}).click();
 await p.getByRole('button',{name:'Copier le diagnostic',exact:true}).click();
 const assistance=await p.evaluate(()=>JSON.parse(window.controleCopie));
 check(assistance.verification.extension==='5.221.0'&&assistance.verification.code==='notifications_non_affichees','le diagnostic détaillé reprend le contrôle de la vraie ouverture du composant parent');
 check(!assistance.lancement,'le rapport ne recycle pas un refus de lancement effacé');
 check(await p.evaluate(()=>window.envois===0&&window.pages===2),'loading history never dispatches a message');
 await p.evaluate(()=>{window.idsVendus=['103'];window.afficherFavoris();});
 await p.getByRole('button',{name:'Envoyer un message aux favoris',exact:true}).click();
 await p.getByRole('button',{name:'Articles vendus (1)',exact:true}).click();
 check(await p.getByRole('checkbox',{name:'Sélectionner Camille 3',exact:true}).isDisabled(),'a sold article cannot be selected');
 check(await p.getByText('Article vendu',{exact:true}).count()===1,'sold article is labelled on its row');
 check(await p.getByRole('button',{name:'Ouvrir ce favori pour vérifier sur Vinted · Camille 3',exact:true}).count()===0,'sold article has no conversation opening action');
 check(await p.getByRole('button',{name:'Les 10 premiers',exact:true}).isDisabled(),'bulk selection cannot pick sold favorites');
 check(await p.locator('[aria-label="Destinataires sélectionnés"]').count()===0,'an article newly marked sold is removed from the current selection');
 await p.getByRole('button',{name:'À contacter (1)',exact:true}).click();
 check(await p.locator('.vrm-favoris-rows article').count()===1,'contact filter excludes sold favorites and retains other items');
 check(await p.evaluate(()=>window.envois===0),'marking a favorite sold does not send a message');
 check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 if(process.env.SHOTS){fs.mkdirSync(process.env.SHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.SHOTS,'historique-'+width+'.png'),fullPage:true});}await p.close();}}
 finally{await b.close();}console.log(n+' contrôles historique React réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
