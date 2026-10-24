import test from 'node:test';import assert from 'node:assert/strict';
import {ageFavori,dateNotificationFavori,contactFavori,lireFavorisVinted} from '../../src/favorisVinted.js';
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
