// Temps aléatoire entre deux messages aux favoris (28 oct.) : tiré par le
// SERVEUR entre le minimum et le maximum choisis, le plafond 10/60 min passe
// avant. Données inventées, aucune requête.
import assert from 'node:assert/strict';
import {lancerFile,reserverFile,terminerFile,delaiFavori,RefusFavoris} from '../../api/_lib/favoris-file.js';
import {validerReglagesFavoris} from '../../src/reglagesFavoris.js';
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
const cibles=k=>Array.from({length:k},(_,i)=>({itemId:String(100+i),recipientId:String(200+i),notificationId:'n'+i,initiator:'x'}));
const t0=1_800_000_000_000;
// réglages
ok(validerReglagesFavoris({message:'Bonjour',intervalleMinutes:'7',intervalleMaxMinutes:'15'}).intervalleMaxMinutes===15,'max gardé');
ok(validerReglagesFavoris({message:'Bonjour',intervalleMinutes:'7',intervalleMaxMinutes:'7'}).intervalleMaxMinutes===null,'max = min : fixe');
ok(validerReglagesFavoris({message:'Bonjour',intervalleMinutes:'7'}).intervalleMaxMinutes===null,'sans max : fixe (réglages d’avant)');
assert.throws(()=>validerReglagesFavoris({message:'Bonjour',intervalleMinutes:'7',intervalleMaxMinutes:'3'}),/au moins égal/);n++;
assert.throws(()=>validerReglagesFavoris({message:'Bonjour',intervalleMinutes:'7',intervalleMaxMinutes:'2000'}),/1 440/);n++;
// tirage
const tirages=new Set();
for(let i=0;i<200;i++){const d=delaiFavori(7,15,'jeton-'+i);ok(d>=7*60000&&d<=15*60000,'tirage dans les bornes');tirages.add(d);}
ok(tirages.size>50,'des temps différents d’un message à l’autre ('+tirages.size+')');
ok(delaiFavori(7,15,'abc')===delaiFavori(7,15,'abc'),'même jeton, même temps (décision rejouable)');
ok(delaiFavori(6,null,'abc')===6*60000,'fixe : exactement le minimum');
// file
let d=lancerFile(null,{owner:'o',targets:cibles(3),message:'Bonjour',intervalleMinutes:7,intervalleMax:15,maintenant:t0}).data;
ok(d.groupes.o.intervalleMax===15,'le lot garde le maximum');
let r=reserverFile(d,{owner:'o',maintenant:t0,jeton:'j1',suivi:'s'});d=r.data;
const attendu=delaiFavori(7,15,'j1');ok(d.groupes.o.prochain===t0+attendu,'prochain message au temps tiré');
d.enCours.autorise=true;d=terminerFile(d,{owner:'o',jeton:'j1',resultat:'envoye',maintenant:t0+1000}).data;
ok(d.groupes.o.prochain===t0+1000+attendu,'après l’accusé, le même temps tiré (pas le minimum)');
ok(reserverFile(d,{owner:'o',maintenant:t0+1000+attendu-1,jeton:'j2'}).valeur.travail===undefined,'rien avant l’échéance tirée');
ok(reserverFile(d,{owner:'o',maintenant:t0+1000+attendu,jeton:'j2'}).valeur.travail,'le suivant part à l’échéance');
assert.throws(()=>lancerFile(null,{owner:'o',targets:cibles(1),message:'B',intervalleMinutes:7,intervalleMax:3,maintenant:t0}),RefusFavoris);n++;
// plafond 10/60 min prioritaire même avec un tirage court
d=lancerFile(null,{owner:'o',targets:cibles(10),message:'B',intervalleMinutes:1,intervalleMax:2,maintenant:t0}).data;
d.tentatives=Array.from({length:10},(_,i)=>t0-10*60000+i);
ok(reserverFile(d,{owner:'o',maintenant:t0,jeton:'z'}).valeur.travail===undefined,'10 messages dans l’heure : on attend, quel que soit le tirage');
console.log(n+' contrôles du temps aléatoire réussis');
