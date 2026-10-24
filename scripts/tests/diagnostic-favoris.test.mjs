import test from 'node:test';
import assert from 'node:assert/strict';
import {structureNotifications,lireDiagnosticFavoris,tracesNotifications} from '../../src/diagnosticFavoris.js';

const owner='11111111-1111-4111-8111-111111111111';
const autre='22222222-2222-4222-8222-222222222222';
const donnees={type:'notifications',uid:'123',payload:{notifications:[{id:987654321,user:{id:555,login:'pseudo-prive'},item:{id:456,title:'article-confidentiel'},body:'message-confidentiel',url:'https://vinted.fr/conversations/123?token=secret'}]}};
const options=()=>({uid:'123',owner,ownerActuel:()=>owner,base:'https://base.invalid',headers:{Authorization:'Bearer session-fictive'}});
const response=rows=>({ok:true,json:async()=>rows});

test('le diagnostic ne contient aucune valeur privée ni nom de clé dynamique',()=>{
 const r=structureNotifications({...donnees.payload,'adresse@prive.fr':'secret'});
 const texte=JSON.stringify(r);
 for(const secret of ['987654321','555','456','pseudo-prive','article-confidentiel','message-confidentiel','https://','token=secret','adresse@prive.fr']) assert.equal(texte.includes(secret),false,secret);
 assert.ok(r.champs.some(x=>x.chemin==='reponse.notifications[].user.id'&&x.types.includes('number')));
 assert.ok(r.champs.some(x=>x.chemin.endsWith('champ_non_standard')));
});
test('la structure est bornée et ne promet pas de liste complète',()=>{
 const r=structureNotifications({notifications:Array.from({length:10000},()=>({id:1}))});
 assert.equal(r.echantillonLimite,true);assert.ok(r.champs.length<20);
 let profond={};let curseur=profond;for(let i=0;i<100;i++)curseur=curseur.data={};
 assert.equal(structureNotifications(profond).echantillonLimite,true);
 const cycle={};cycle.data=cycle;assert.doesNotThrow(()=>structureNotifications(cycle));
});
test('la lecture cible exactement une ligne et son propriétaire, sans écriture',async()=>{
 let appel;
 const r=await lireDiagnosticFavoris({...options(),fetcher:async(url,opts)=>{appel={url,opts};return response([{owner,data:donnees}]);}});
 const u=new URL(appel.url);
 assert.equal(u.searchParams.get('id'),'eq.harvest_123_notifications');
 assert.equal(u.searchParams.get('owner'),'eq.'+owner);
 assert.equal(appel.opts.cache,'no-store');assert.equal(appel.opts.method,undefined);
 assert.equal(r.reception,'capture_disponible');assert.equal(r.envoisAutomatiques,'statut_dans_la_file');assert.equal(r.listeComplete,'non_verifiee');
 assert.equal(JSON.stringify(r).includes(owner),false);
});
test('un compte invalide ou une session différente ne déclenche aucune requête',async()=>{
 let appels=0;const fetcher=async()=>{appels++;return response([]);};
 for(const uid of ['', '*', '123&owner=eq.autre','-1'])await assert.rejects(lireDiagnosticFavoris({...options(),uid,fetcher}));
 await assert.rejects(lireDiagnosticFavoris({...options(),ownerActuel:()=>autre,fetcher}));
 assert.equal(appels,0);
});
test('une réponse d’un autre propriétaire ou un changement de session est rejeté',async()=>{
 await assert.rejects(lireDiagnosticFavoris({...options(),fetcher:async()=>response([{owner:autre,data:donnees}])}));
 let actif=owner;
 await assert.rejects(lireDiagnosticFavoris({...options(),ownerActuel:()=>actif,fetcher:async()=>{actif=autre;return response([{owner,data:donnees}]);}}));
});
test('les captures d’un autre compte ou d’un autre type sont rejetées',async()=>{
 for(const data of [{...donnees,uid:'456'},{...donnees,type:'conversation'},{...donnees,payload:null}]) await assert.rejects(lireDiagnosticFavoris({...options(),fetcher:async()=>response([{owner,data}])}));
});
test('une capture absente est distincte d’une lecture en erreur ou ambiguë',async()=>{
 const r=await lireDiagnosticFavoris({...options(),fetcher:async()=>response([])});
 assert.equal(r.reception,'aucune_capture');assert.equal(r.champs,undefined);
 for(const fetcher of [async()=>({ok:false}),async()=>response(null),async()=>response([{owner,data:donnees},{owner,data:donnees}])]) await assert.rejects(lireDiagnosticFavoris({...options(),fetcher}));
});
test('les traces distinguent liste, compteur et refus sans exporter les chemins ou paramètres',()=>{
 const r=tracesNotifications({ver:'5.214.0',paths:['/inbox-notifications/v1/notifications/unread_count?token=secret','/users/123456'],reponses:{'GET /inbox-notifications/v1/notifications?token=secret':{st:403},'POST /api/v2/notifications':{st:200},'GET /api/v2/notifications':{st:200},'GET https://autre.invalid/api/v2/notifications':{st:200}}});
 assert.equal(r.versionExtension,'5.214.0');
 assert.ok(r.observations.some(x=>x.flux==='compteur_seulement'));
 assert.ok(r.observations.some(x=>x.flux==='liste_inbox'&&x.statut===403));
 assert.ok(r.observations.some(x=>x.flux==='liste_api'&&x.statut===200));
 assert.equal(JSON.stringify(r).includes('secret'),false);assert.equal(JSON.stringify(r).includes('123456'),false);
 assert.equal(JSON.stringify(r).includes('https://'),false);
});
test('après absence de capture, seules les traces du même compte et propriétaire sont lues',async()=>{
 const appels=[];
 const r=await lireDiagnosticFavoris({...options(),fetcher:async(url,opts)=>{appels.push({url,opts});return response(appels.length===1?[]:[{owner,data:{uid:'123',ver:'5.214.0',paths:[]}}]);}});
 assert.equal(appels.length,2);assert.equal(r.traces.versionExtension,'5.214.0');
 const u=new URL(appels[1].url);assert.equal(u.searchParams.get('id'),'eq.harvest_123_seen_urls');assert.equal(u.searchParams.get('owner'),'eq.'+owner);
 for(const row of [{owner:autre,data:{uid:'123'}},{owner,data:{uid:'456'}}]){
  let n=0;await assert.rejects(lireDiagnosticFavoris({...options(),fetcher:async()=>response(++n===1?[]:[row])}));
 }
});
test('une panne de lecture des traces reste une panne, pas une absence de requêtes',async()=>{
 let n=0;
 const r=await lireDiagnosticFavoris({...options(),fetcher:async()=>++n===1?response([]):{ok:false}});
 assert.equal(r.traces.etat,'lecture_indisponible');
 let acteur=owner,appels=0;
 await assert.rejects(lireDiagnosticFavoris({...options(),ownerActuel:()=>acteur,fetcher:async()=>{if(++appels===1)return response([]);acteur=autre;return response([]);}}));
});
test('les liens de création et les formes des requêtes observées sont lisibles sans valeurs privées',async()=>{
 const appels=[];
 const data={...donnees,payload:{notifications:[{id:'notif-privee',user_id:123,body:'Camille a ajouté ton article à ses favoris.',link:'/items/654321/conversation/new?receiver=987654'}]}};
 const trace={uid:'123',method:'POST',path:'/api/v2/conversations',body:JSON.stringify({conversation:{item_id:654321,opposite_user_id:987654},reply:{body:'Bonjour secret'}})};
 const r=await lireDiagnosticFavoris({...options(),fetcher:async(url,o)=>{
  appels.push({url,o});return response(url.includes('wreq_api_v2')?[{owner,data:trace}]:url.includes('wreq_api_v3')?[]:[{owner,data}]);
 }});
 assert.equal(r.diagnostic,'VRM-favoris-structure-v4');assert.equal(r.envoisAutomatiques,'statut_dans_la_file');
 assert.equal(r.liens.formes[0].chemin,'/items/{identifiant}/conversation/new');assert.deepEqual(r.liens.formes[0].parametres,['receiver']);
 assert.equal(r.liens.formes[0].userIdCorrespondAuCompte,true);
 const t=r.creation.traces.find(x=>x.api==='v2');assert.equal(t.etat,'forme_observee');assert.ok(t.champs.some(x=>x.chemin==='reponse.conversation.opposite_user_id'));
 for(const secret of ['654321','987654','Bonjour secret','Camille','notif-privee'])assert.equal(JSON.stringify(r).includes(secret),false,secret);
 assert.equal(appels.length,3);assert.ok(appels.every(x=>new URL(x.url).searchParams.get('owner')==='eq.'+owner&&!x.o.method));
});
test('la relation entre user_id et un paramètre est un booléen, jamais un identifiant exporté',async()=>{
 const data={...donnees,payload:{notifications:[{id:'n',user_id:987654,body:'Camille a ajouté ton article à ses favoris.',link:'/items/654321/conversation/new?receiver=987654'}]}};
 const r=await lireDiagnosticFavoris({...options(),fetcher:async(url)=>response(url.includes('wreq_')?[]:[{owner,data}])});
 assert.equal(r.liens.formes[0].userIdCorrespondAuCompte,false);assert.deepEqual(r.liens.formes[0].parametresUserId,['receiver']);assert.equal(JSON.stringify(r).includes('987654'),false);
});
test('les écritures observées d’un autre propriétaire ou compte ne rejoignent jamais le rapport',async()=>{
 const data={...donnees,payload:{notifications:[{id:'n',body:'Camille a ajouté ton article à ses favoris.',link:'/items/654321/conversation/new?receiver=987654'}]}};
 for(const row of [{owner:autre,data:{uid:'123'}},{owner,data:{uid:'456'}}])await assert.rejects(lireDiagnosticFavoris({...options(),fetcher:async(url)=>response(url.includes('wreq_')?[row]:[{owner,data}])}));
});
