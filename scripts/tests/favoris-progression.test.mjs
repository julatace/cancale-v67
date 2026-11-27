import test from 'node:test';import assert from 'node:assert/strict';
import {progressionFavoris,dureeFavoris,MOTS_REFUS,RAISONS_FAVORIS,refusLocal,bilanFavoris,phraseBilanFavoris} from '../../src/favorisProgression.js';
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
// 5.455.3 (Julien, 27 nov. 17:31 : « Interrompu : L’article ou le destinataire du fil n’a pas été confirmé », la file arrêtée au
//    PREMIER favori) : un refus d'identité de la relecture (rien d'écrit que la conversation vide, étape « vérification ») saute CE
//    favori et la file continue, la raison NOMMÉE ; une conversation pas relue est SAUTÉE (ignore), dite dans le bilan.
const unLot=()=>{const owner='owner-fixture',targets=[1,2,3].map(i=>({notificationId:'n'+i,itemId:String(100+i),recipientId:String(200+i),initiator:'native-fixture'}));
 let d=lancerFile(null,{owner,targets,message:'Bonjour',intervalleMinutes:6,maintenant:100000,lot:'lot1'}).data;
 d=reserverFile(d,{owner,maintenant:100000,jeton:'j1',suivi:'s1'}).data;d=consommerFile(d,{owner,maintenant:100000,jeton:'j1'}).data;return {d,owner};};
test('5.455.3 : contradiction lue à la vérification ⇒ CE favori sauté, raison nommée, la file continue',()=>{
 for(const raison of ['destinataire_different','article_different','variable_manquante']){
  const {d,owner}=unLot();const f=terminerFile(d,{owner,jeton:'j1',resultat:'refuse',raison,ecrits:1,etape:raison==='variable_manquante'?'historique':'verification',maintenant:102000,cause:raison==='variable_manquante'?'variable:marque':null});
  assert.equal(f.valeur.jobs[0].raison,raison);assert.equal(f.valeur.active,true,raison);assert.ok(MOTS_REFUS[raison]&&RAISONS_FAVORIS[raison],raison);
  assert.ok(f.valeur.raison.includes(MOTS_REFUS[raison]),f.valeur.raison);assert.ok(refusLocal({resultat:'refuse',raison,ecrits:1,etape:'verification'}));
 }
 const {d,owner}=unLot();const f=terminerFile(d,{owner,jeton:'j1',resultat:'refuse',raison:'variable_manquante',ecrits:1,etape:'historique',cause:'variable:marque',maintenant:102000});
 assert.equal(f.valeur.jobs[0].cause,'variable:marque');
});
// 5.455.4 (C4) : une conversation pas encore relue n'est plus perdue — le favori repart UNE fois après les autres ; au 2ᵉ échec,
//    sauté et nommé dans le bilan.
test('5.455.4 : conversation pas relue ⇒ réessayée une fois après les autres, puis sautée et nommée',()=>{
 let {d,owner}=unLot();let f=terminerFile(d,{owner,jeton:'j1',resultat:'ignore',raison:'fil_non_relu',ecrits:1,etape:'verification',maintenant:102000});d=f.data;
 assert.equal(f.valeur.active,true);const j1=f.valeur.jobs.find(x=>x.notificationId==='n1');assert.equal(j1.etat,'attente');assert.equal(f.valeur.jobs[f.valeur.jobs.length-1].notificationId,'n1','repart après les autres');
 // les deux autres passent (envoyés), puis n1 revient et échoue encore
 let t=Math.max(103000,f.valeur.prochain||0);
 for(const k of [2,3,4]){const r=reserverFile(d,{owner,maintenant:t,jeton:'k'+k,suivi:'s'});d=r.data;d=consommerFile(d,{owner,maintenant:t,jeton:'k'+k}).data;const id=r.valeur.travail.notificationId;
  f=terminerFile(d,{owner,jeton:'k'+k,resultat:id==='n1'?'ignore':'envoye',raison:id==='n1'?'fil_non_relu':'',ecrits:id==='n1'?1:3,etape:'verification',maintenant:t+1000});d=f.data;t=Math.max(t+2000,f.valeur.prochain||0);}
 const fin=f.valeur.jobs.find(x=>x.notificationId==='n1');assert.equal(fin.etat,'ignore');assert.equal(fin.raison,'fil_non_relu');
 const b=bilanFavoris(f.valeur.jobs);assert.equal(b.sautes,1);assert.equal(b.parSaut.fil_non_relu,1);assert.match(phraseBilanFavoris(b),/conversation pas relue chez Vinted/);
});
test('5.455.3 : le cas de Julien sur la 5.455.2 (identité refusée à l’étape « conversation ») arrêtait la file — la cause',()=>{
 const {d,owner}=unLot();const f=terminerFile(d,{owner,jeton:'j1',resultat:'refuse',raison:'identite_non_confirmee',ecrits:1,etape:'conversation',maintenant:102000});
 assert.equal(f.valeur.active,false);assert.ok(f.valeur.raison.startsWith(RAISONS_FAVORIS.identite_non_confirmee));
});
// 5.455.4 : trois conversations ouvertes de suite sans pouvoir être relues ⇒ la file s'arrête (avant : « ignore » ne comptait
//    pas, une messagerie illisible ouvrait une conversation vide avec CHAQUE acheteur) ; et un saut après écriture garde le rythme.
test('5.455.4 : trois « conversation pas relue » de suite arrêtent la file ; le rythme est gardé',()=>{
 const owner='owner-fixture',targets=[1,2,3,4].map(i=>({notificationId:'n'+i,itemId:String(100+i),recipientId:String(200+i),initiator:'native-fixture'}));
 let d=lancerFile(null,{owner,targets,message:'Bonjour',intervalleMinutes:0,maintenant:100000,lot:'lot1'}).data;let t=100000,v=null;
 for(let k=1;k<=7&&(!v||v.active!==false);k++){const r=reserverFile(d,{owner,maintenant:t,jeton:'j'+k,suivi:'s'});assert.ok(r.valeur.travail,'réservé '+k);d=r.data;d=consommerFile(d,{owner,maintenant:t,jeton:'j'+k}).data;
  const f=terminerFile(d,{owner,jeton:'j'+k,resultat:'ignore',raison:'fil_non_relu',ecrits:1,etape:'verification',maintenant:t+2000});d=f.data;v=f.valeur;
  if(k===1)assert.ok(v.prochain>t+2000,'rythme gardé après un saut qui a écrit');
  t=Math.max(t+3000,v.prochain||0);}
 assert.equal(v.active,false);assert.equal(v.raisonCode,'locaux_suite');assert.match(v.raison,/3 favoris de suite/);
 assert.ok(v.jobs.filter(x=>x.etat==='ignore').length===3,'chacun réessayé une fois avant de compter');
});
test('5.455.4 : « prix pas lu en euros » saute CE favori (refus local nommé)',()=>{
 const {d,owner}=unLot();const f=terminerFile(d,{owner,jeton:'j1',resultat:'refuse',raison:'offre_prix_inconnu',ecrits:1,etape:'historique',maintenant:102000});
 assert.equal(f.valeur.active,true);assert.ok(f.valeur.raison.includes(MOTS_REFUS.offre_prix_inconnu));
});
