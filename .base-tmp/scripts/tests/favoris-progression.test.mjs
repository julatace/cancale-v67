import test from 'node:test';import assert from 'node:assert/strict';
import {progressionFavoris,dureeFavoris} from '../../src/favorisProgression.js';
import {lancerFile,reserverFile,consommerFile,terminerFile} from '../../api/_lib/favoris-file.js';
test('la progression distingue envoyés, ignorés et incertains et ne compte que la sélection en cours',()=>{
 const p=progressionFavoris({lot:'actuel',active:true,prochain:160000,jobs:[{lot:'avant',etat:'envoye'},{lot:'actuel',etat:'envoye'},{lot:'actuel',etat:'ignore'},{lot:'actuel',etat:'incertain'},{lot:'actuel',etat:'attente'}]},100000);
 assert.equal(p.total,4);assert.equal(p.termines,3);assert.equal(p.envoyes,1);assert.equal(p.ignores,1);assert.equal(p.incertains,1);assert.equal(p.secondes,60);
 assert.equal(dureeFavoris(p.secondes),'1:00');assert.equal(dureeFavoris(125),'2:05');assert.equal(dureeFavoris(-2),'0:00');
 assert.equal(progressionFavoris({active:false,prochain:200000,jobs:[]},0).secondes,0);
});
test('une conversation déjà contactée est ignorée sans message, sans attendre la cadence et sans consommer le quota d’envoi',()=>{
 const owner='owner-fixture',targets=[1,2].map(i=>({notificationId:'n'+i,itemId:String(100+i),recipientId:String(200+i),initiator:'native-fixture'}));
 let d=lancerFile(null,{owner,targets,message:'Bonjour',intervalleMinutes:6,maintenant:100000,lot:'lot1'}).data;
 d=reserverFile(d,{owner,maintenant:100000,jeton:'j1',suivi:'s1'}).data;
 const grant=consommerFile(d,{owner,maintenant:100000,jeton:'j1'});assert.equal(grant.valeur.suivi,'s1');d=grant.data;
 const fini=terminerFile(d,{owner,jeton:'j1',resultat:'ignore',raison:'conversation_deja_contactee',maintenant:102000});d=fini.data;
 assert.equal(fini.valeur.jobs[0].etat,'ignore');assert.equal(fini.valeur.jobs[0].raison,'conversation_deja_contactee');assert.equal(d.tentatives.length,0);assert.equal(fini.valeur.active,true);
 assert.equal(reserverFile(d,{owner,maintenant:102000,jeton:'j2'}).valeur.travail.recipientId,'202');
});
