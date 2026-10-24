import test from 'node:test';
import assert from 'node:assert/strict';
import {lancerFile,reserverFile,consommerFile,terminerFile,arreterFile,cloreIncertains,vueFile} from '../../api/_lib/favoris-file.js';
import {resoudreCiblesFavoris} from '../../api/_lib/favoris-cibles.js';
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',autre='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',T=1700000000000;
const cible=i=>({notificationId:'favori-'+i,itemId:String(100+i),recipientId:String(200+i),initiator:'native-fixture'});
const lancer=(d=null,targets=[cible(1)],o=owner,t=T)=>lancerFile(d,{owner:o,targets,message:'Message identique avec remise de 10 %.',intervalleMinutes:1,maintenant:t});
const claim=(d,t=T,o=owner,jeton='jeton-unique')=>reserverFile(d,{owner:o,maintenant:t,jeton});
function regler(d,t=T,o=owner,token='jeton-unique',resultat='envoye'){
  d=consommerFile(d,{owner:o,jeton:token,maintenant:t}).data;
  return terminerFile(d,{owner:o,jeton:token,resultat}).data;
}
test('message figé et aucun effet réseau au lancement ; pas de lancement concurrent',()=>{
  const targets=[cible(1),cible(2)],r=lancer(null,targets);targets[0].recipientId='999';
  assert.equal(r.data.groupes[owner].jobs[0].recipientId,'201');assert.equal(r.valeur.active,true);
  assert.ok(r.data.groupes[owner].jobs.every(x=>x.message==='Message identique avec remise de 10 %.'));
  assert.throws(()=>lancer(r.data));assert.equal(r.data.groupes[owner].jobs[0].etat,'attente');
});
test('une autorisation est consommable une seule fois et seulement par le bon propriétaire',()=>{
  const d=claim(lancer().data).data;
  assert.throws(()=>consommerFile(d,{owner:autre,jeton:'jeton-unique',maintenant:T}));
  assert.throws(()=>consommerFile(d,{owner,jeton:'faux',maintenant:T}));
  const c=consommerFile(d,{owner,jeton:'jeton-unique',maintenant:T});
  assert.equal(c.valeur.travail.recipientId,'201');assert.throws(()=>consommerFile(c.data,{owner,jeton:'jeton-unique',maintenant:T}));
  assert.throws(()=>terminerFile(d,{owner,jeton:'jeton-unique',resultat:'envoye'}));
});
test('une réservation en cours ne repart jamais sur un autre appel, même après réponse perdue',()=>{
  let d=claim(lancer().data).data;
  for(let i=0;i<30;i++)assert.equal(claim(d,T+i*1000).valeur.travail,undefined);
  const r=claim(d,T+121000);assert.equal(r.valeur.travail,undefined);assert.equal(r.data.groupes[owner].jobs[0].etat,'incertain');assert.equal(r.data.groupes[owner].active,false);
  assert.throws(()=>lancer(r.data,[cible(2)]));
});
test('arrêt avant consommation interdit l’envoi ; arrêt après départ n’invente pas une annulation',()=>{
  const d=claim(lancer(null,[cible(1),cible(2)]).data).data;
  const stop=arreterFile(d,owner).data;assert.throws(()=>consommerFile(stop,{owner,jeton:'jeton-unique',maintenant:T}));
  let parti=consommerFile(d,{owner,jeton:'jeton-unique',maintenant:T}).data;parti=arreterFile(parti,owner).data;
  parti=terminerFile(parti,{owner,jeton:'jeton-unique',resultat:'envoye'}).data;
  assert.deepEqual(parti.groupes[owner].jobs.map(x=>x.etat),['envoye','annule']);assert.equal(parti.groupes[owner].active,false);
});
test('dix réservations maximum sur une fenêtre glissante, même avec deux propriétaires et des refus',()=>{
  let d=lancer(null,Array.from({length:10},(_,i)=>cible(i))).data;
  d=lancer(d,[cible(20),cible(21)],autre).data;
  for(let i=0;i<10;i++){const r=claim(d,T+i*60000,owner,'t'+i);assert.ok(r.valeur.travail);d=regler(r.data,T+i*60000,owner,'t'+i);}
  assert.equal(claim(d,T+10*60000,autre).valeur.travail,undefined);
  assert.equal(claim(d,T+3599999,autre).valeur.travail,undefined);
  const r=claim(d,T+3600000,autre);assert.ok(r.valeur.travail);
  d=terminerFile(r.data,{owner:autre,jeton:'jeton-unique',resultat:'refuse'}).data;
  assert.equal(d.tentatives.length,10);assert.equal(d.groupes[autre].active,false);
});
test('cadence fixe prioritaire, et pas de rattrapage en rafale après une fermeture',()=>{
  let d=lancerFile(null,{owner,targets:[cible(1),cible(2),cible(3)],message:'Bonjour',intervalleMinutes:7,maintenant:T}).data;
  d=regler(claim(d).data);
  assert.equal(claim(d,T+419999).valeur.travail,undefined);
  const r=claim(d,T+7200000);assert.ok(r.valeur.travail);d=regler(r.data,T+7200000);
  assert.equal(claim(d,T+7200001).valeur.travail,undefined);
});
test('le quota et la cadence repartent de l’accusé reçu, pas d’une réservation ancienne',()=>{
  let d=claim(lancer(null,[cible(1),cible(2)]).data).data;
  d=consommerFile(d,{owner,jeton:'jeton-unique',maintenant:T}).data;
  d=terminerFile(d,{owner,jeton:'jeton-unique',resultat:'envoye',maintenant:T+50000}).data;
  assert.deepEqual(d.tentatives,[T+50000]);assert.equal(claim(d,T+60000).valeur.travail,undefined);assert.ok(claim(d,T+110000).valeur.travail);
});
test('pas de destinataire repris après envoi, refus ou incertitude ; doublons de notification dédupliqués par personne/article',()=>{
  let d=lancer(null,[cible(1),{...cible(1),notificationId:'autre-notif'}]).data;assert.equal(d.groupes[owner].jobs.length,1);
  d=regler(claim(d).data);assert.throws(()=>lancer(d));assert.throws(()=>lancer(d,[cible(1)],autre),'dédoublonnage partagé entre les propriétaires du même UID');
  let e=claim(lancer().data).data;e=terminerFile(e,{owner,jeton:'jeton-unique',resultat:'refuse'}).data;assert.throws(()=>lancer(e));
});
test('une nouvelle sélection ne reprend pas le reste interrompu ; les jamais partis annulés peuvent être sélectionnés à nouveau',()=>{
  let d=claim(lancer(null,[cible(1),cible(2)]).data).data;d=terminerFile(d,{owner,jeton:'jeton-unique',resultat:'refuse'}).data;
  d=lancer(d,[cible(3)]).data;assert.equal(d.groupes[owner].jobs.find(x=>x.id==='102:202').etat,'annule');
  d=arreterFile(d,owner).data;d=lancer(d,[cible(2)]).data;
  assert.deepEqual(d.groupes[owner].jobs.filter(x=>x.etat==='attente').map(x=>x.notificationId),['favori-2']);
});
test('une clôture manuelle ne renvoie rien et conserve le dédoublonnage ; accusé tardif ne touche pas une autre tentative',()=>{
  let d=claim(lancer().data).data;d=arreterFile(d,owner).data;
  assert.throws(()=>cloreIncertains(d,{owner,maintenant:T+60000}));
  d=cloreIncertains(d,{owner,maintenant:T+121000}).data;
  assert.equal(d.groupes[owner].jobs[0].etat,'verifie');assert.throws(()=>lancer(d));
  assert.equal(terminerFile(d,{owner,jeton:'jeton-unique',resultat:'envoye'}).data,undefined);
  assert.deepEqual(vueFile(d,autre).jobs,[]);assert.equal(JSON.stringify(vueFile(d,owner)).includes('recipientId'),false);
});
test('une réponse incertaine bloque aussi les autres appareils/propriétaires du même compte',()=>{
  let d=lancer(null,[cible(1)]).data;d=lancer(d,[cible(2)],autre).data;
  d=claim(d).data;d=terminerFile(d,{owner,jeton:'jeton-unique',resultat:'incertain',maintenant:T+10000}).data;
  assert.equal(claim(d,T+3600000,autre).valeur.travail,undefined);
  d=cloreIncertains(d,{owner,maintenant:T+3600000}).data;
  assert.equal(claim(d,T+3600000,autre).valeur.travail,undefined);
  assert.ok(claim(d,T+3660000,autre).valeur.travail);
});
const capture=()=>({uid:'123',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[1,2].map(i=>({id:'n'+i,user_id:200+i,body:'Camille a ajouté ton article à ses favoris.',link:`/items/${100+i}/conversation/new?from_notification=true`}))}});
const trace=()=>({uid:'123',method:'POST',path:'/api/v2/conversations',body:JSON.stringify({initiator:'native-fixture',item_id:'101',opposite_user_id:'201'})});
test('raccordement : user_id ne devient destinataire qu’après une correspondance exacte article/personne avec la requête native',()=>{
  const r=resoudreCiblesFavoris({uid:'123',capture:capture(),trace:trace(),selection:['n2']});
  assert.deepEqual(r,[{notificationId:'n2',itemId:'102',recipientId:'202',initiator:'native-fixture'}]);
  const faux=trace();faux.body=JSON.stringify({initiator:'native-fixture',item_id:'999',opposite_user_id:'201'});
  assert.throws(()=>resoudreCiblesFavoris({uid:'123',capture:capture(),trace:faux,selection:['n2']}));
});
test('capture, compte, format, phrase, lien, doublons ou sélection incompatibles : aucun destinataire inventé',()=>{
  for(const changer of [x=>x.uid='999',x=>x.type='inbox',x=>x.payload.notifications[0].user_id=123,x=>x.payload.notifications[0].link='/items/999/conversation/new',x=>x.payload.notifications[0].body='Nouvelle offre',x=>x.payload.notifications[1].link='/member/102/conversation/new',x=>x.payload.notifications.push({...x.payload.notifications[1]})]){
    const c=capture();changer(c);assert.throws(()=>resoudreCiblesFavoris({uid:'123',capture:c,trace:trace(),selection:['n2']}));
  }
  for(const selection of [[],['n2','n2'],['introuvable']])assert.throws(()=>resoudreCiblesFavoris({uid:'123',capture:capture(),trace:trace(),selection}));
  for(const body of ['{',JSON.stringify({item_id:'101',opposite_user_id:'201'}),JSON.stringify({initiator:'native-fixture',item_id:'101',opposite_user_id:'201',reply:'non'})])assert.throws(()=>resoudreCiblesFavoris({uid:'123',capture:capture(),trace:{...trace(),body},selection:['n2']}));
});
