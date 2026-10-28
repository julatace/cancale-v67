import test from 'node:test';import assert from 'node:assert/strict';
import {ageFavori,dateNotificationFavori,contactFavori,indexerContactsFavoris,articleFavoriVendu,executerFavoriDisponible,lireFavorisVinted} from '../../src/favorisVinted.js';
import {appelerFavorisDirect} from '../../src/favorisTransport.js';
const T=Date.parse('2026-10-24T18:00:00Z'),owner='owner-fixture';
const n=(id,date='2026-10-24T11:00:00Z')=>({id,user_id:201,body:'Camille a ajouté ton article à ses favoris.',link:'/items/101/conversation/new',updated_at:date});
test('date relative native : création prioritaire, unités secondes/ms, date inconnue et future honnêtes',()=>{
 const d=dateNotificationFavori({created_at:'2026-10-24T11:00:00Z',updated_at:'2026-10-24T17:00:00Z'});assert.equal(ageFavori(d,T),'il y a 7 h');
 assert.equal(dateNotificationFavori({created_at_ts:T/1000}),new Date(T).toISOString());assert.equal(ageFavori(null,T),'Date indisponible');assert.equal(ageFavori(new Date(T+3600000).toISOString(),T),'Heure à vérifier');assert.equal(ageFavori(new Date(T-120000).toISOString(),T),'il y a 2 min');
});
test('archive et capture récente sont réunies ; lire une notification ne remet pas la date du favori à zéro',async()=>{
 const raw={uid:'123',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[n('1','2026-10-24T17:00:00Z')]}},archive={archiveVersion:1,uid:'123',domain:'www.vinted.fr',payload:{notifications:[{...n('1'),dateAjoutObservee:'2026-10-24T11:00:00Z'},n('2')]},sync:{complete:true,pagesLues:2,totalPages:2}};
 const opts={uid:'123',owner,ownerActuel:()=>owner,base:'https://base.invalid',headers:{}};
 const fetcher=async url=>({ok:true,json:async()=>[{owner,data:url.includes('_favoris_archive')?archive:raw}]});
 const r=await lireFavorisVinted({...opts,fetcher});assert.equal(r.lignes.length,2);assert.equal(ageFavori(r.lignes.find(x=>x.id==='1').date,T),'il y a 7 h');assert.equal(r.archive.sync.complete,true);
 const seul=await lireFavorisVinted({...opts,fetcher:async url=>({ok:true,json:async()=>url.includes('_favoris_archive')?[{owner,data:archive}]:[]})});assert.equal(seul.lignes.length,2);
 for(const valeur of [{owner:'autre',data:archive},{owner,data:{...archive,uid:'456'}},{owner,data:{...archive,archiveVersion:2}}])await assert.rejects(lireFavorisVinted({...opts,fetcher:async url=>({ok:true,json:async()=>[url.includes('_favoris_archive')?valeur:{owner,data:raw}]})}));
 await assert.rejects(lireFavorisVinted({...opts,fetcher:async url=>url.includes('_favoris_archive')?{ok:false}:{ok:true,json:async()=>[{owner,data:raw}]}}));
});
test('déjà envoyé repose sur un accusé VRM, jamais sur is_read ni sur une conversation existante',()=>{
 const l={id:'n1',identiteNotification:'101:201',is_read:true};assert.equal(contactFavori(l,[]),null);assert.equal(contactFavori(l,undefined),null);
 const jobs=[{id:'101:201',notificationId:'ancien-id',etat:'envoye',envoyeLe:T},{id:'autre',notificationId:'n1',etat:'ignore'}];
 assert.equal(contactFavori(l,jobs).etat,'envoye');assert.equal(contactFavori({id:'n1'},[jobs[1]]).etat,'ignore');assert.equal(contactFavori({id:'inconnu'},jobs),null);
});
test('Chrome direct : requête adressée, accusé unique et aucun rejeu sur erreur ou délai',async()=>{
 const id='a'.repeat(32),appels=[];const rt={sendMessage(c,m,cb){appels.push({c,m});cb({ok:true,ext:id});}};
 assert.equal((await appelerFavorisDirect(rt,id,{type:'favorisEtat'})).ext,id);assert.equal(appels.length,1);
 const erreur={lastError:{message:'port closed'},sendMessage(c,m,cb){appels.push({c,m});cb(null);}};
 assert.equal(await appelerFavorisDirect(erreur,id,{type:'favorisExec'},20),null);assert.equal(appels.length,2);
 let n=0;assert.equal(await appelerFavorisDirect({sendMessage(){n++;}},id,{type:'favorisExec'},10),null);assert.equal(n,1);
 assert.equal(await appelerFavorisDirect(rt,'invalide',{type:'favorisExec'}),null);assert.equal(appels.length,2);
});

test('l’index conserve la preuve la plus protectrice et l’ordre source à priorité égale',()=>{
 const source=[{id:'preuve-a',notificationId:'n1',etat:'envoye'},{id:'preuve-b',notificationId:'n1',etat:'refuse'},{id:'identite',etat:'incertain'},{id:'premier',notificationId:'n2',etat:'ignore'},{id:'autre',etat:'ignore'}];
 const ordre=source.slice(),lire=indexerContactsFavoris(source);
 assert.equal(lire({id:'n1',identiteNotification:'identite'}),source[0]);
 assert.equal(lire({id:'n2',identiteNotification:'autre'}),source[3]);
 assert.equal(lire({id:'absent',identiteNotification:'identite'}),source[2]);
 assert.equal(lire({id:'inconnu'}),null);assert.deepEqual(source,ordre);
 assert.equal(indexerContactsFavoris(null)({id:'n1'}),null);
});
test('un long historique n’est indexé qu’une fois, sans rescanner les envois à chaque ligne',()=>{
 let lectures=0;const source=Array.from({length:2000},(_,i)=>({notificationId:'n'+i,etat:'envoye'}));
 const jobs=new Proxy(source,{get(t,p,r){if(/^\d+$/.test(String(p)))lectures++;return Reflect.get(t,p,r);}});
 const lire=indexerContactsFavoris(jobs),avant=lectures;
 for(let i=0;i<2000;i++)assert.equal(lire({id:'n'+i}),source[i]);
 assert.equal(lectures,avant);assert.equal(indexerContactsFavoris([{notificationId:'n0',etat:'incertain'}])({id:'n0'}).etat,'incertain');
});

test('article vendu : correspondance exacte dans le lien, jamais par texte ou identifiant de notification',()=>{
 const vendus=new Set(['101']);assert.equal(articleFavoriVendu({lien:'https://www.vinted.fr/items/101/conversation/new?receiver_id=9'},vendus),true);
 for(const ligne of [{id:'101',lien:'https://www.vinted.fr/items/102/conversation/new',body:'Même titre vendu'},{lien:'https://www.vinted.fr/member/101'},{lien:'https://site.invalid/items/101/conversation/new'},{lien:null}])assert.equal(articleFavoriVendu(ligne,vendus),false);
});
test('un article devenu vendu avant le dispatch ne sollicite pas l’extension',async()=>{
 const vendus=new Set();let envois=0;const executer=()=>{envois++;return{ok:true};};
 vendus.add('101');const r=await executerFavoriDisponible({itemId:'101'},vendus,executer);assert.equal(r.data.raison,'article_vendu');assert.equal(r.data.resultat,'refuse');assert.equal(envois,0);
 await executerFavoriDisponible({itemId:'102'},vendus,executer);assert.equal(envois,1);
});
