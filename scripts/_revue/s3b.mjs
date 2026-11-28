// Fonctions pures du serveur : bail expiré, lancement concurrent.
import * as F from '../../api/_lib/favoris-file.js';
import * as A from '../../api/_lib/favoris-auto.js';
const o='own', T=Date.parse('2026-11-28T11:00:00Z');
const tgt=(i)=>({itemId:String(700+i),recipientId:String(300+i),notificationId:'n'+i,initiator:'x'});
const app=(d,r)=>r.data||d;
// 1. Manuel : 2 favoris, le 1er réservé, worker tué (bail expiré), puis ?
{
  let d=F.initialiserFile(null);
  d=app(d,F.lancerFile(d,{owner:o,targets:[tgt(1),tgt(2)],message:'m',intervalleMinutes:0,maintenant:T}));
  let r=F.reserverFile(d,{owner:o,maintenant:T,jeton:'00000000-0000-4000-8000-000000000001'});d=app(d,r);
  console.log('1 reserve', r.valeur.travail&&r.valeur.travail.id);
  r=F.reserverFile(d,{owner:o,maintenant:T+200000,jeton:'00000000-0000-4000-8000-000000000002'});d=app(d,r);
  console.log('1 expiry jobs', JSON.stringify(d.groupes[o].jobs.map(j=>j.etat)), 'active',d.groupes[o].active,'enCours.abandonne',!!d.enCours?.abandonne);
  r=F.reserverFile(d,{owner:o,maintenant:T+400000,jeton:'00000000-0000-4000-8000-000000000003'});d=app(d,r);
  console.log('1 next', r.valeur.travail&&r.valeur.travail.id, JSON.stringify(d.groupes[o].jobs.map(j=>j.etat)));
}
// 2. Mode auto : le DERNIER (seul) favori réservé, worker tué ; l'agent demande "auto" ensuite.
{
  let d=F.initialiserFile(null);
  d=app(d,F.lancerFile(d,{owner:o,targets:[tgt(1)],message:'m',intervalleMinutes:0,maintenant:T}));
  let r=F.reserverFile(d,{owner:o,maintenant:T,jeton:'00000000-0000-4000-8000-000000000001'});d=app(d,r);
  // bail expiré : la prochaine "suivant" le constate
  r=F.reserverFile(d,{owner:o,maintenant:T+200000,jeton:'00000000-0000-4000-8000-000000000002'});d=app(d,r);
  d.groupes[o].auto={reglages:{actif:true,parHeure:15,parJour:100,jours:[1,2,3,4,5,6,7],heureDebut:0,heureFin:24,attenteMin:10,attenteMax:60},allumeLe:T-1};
  for(const dt of [600000, 3600000, 86400000]){
    const e=A.etatAuto(d,o,T+dt); console.log('2 etatAuto +'+dt/60000+'min', JSON.stringify(e), 'active',d.groupes[o].active,'enCours',!!d.enCours);
  }
}
// 3. Deux Chrome : A mène une file (2 en attente), B lance un autre favori sans "ajouter".
{
  let d=F.initialiserFile(null);
  d=app(d,F.lancerFile(d,{owner:o,targets:[tgt(1),tgt(2),tgt(3)],message:'m',intervalleMinutes:0,maintenant:T}));
  let r=F.reserverFile(d,{owner:o,maintenant:T,jeton:'00000000-0000-4000-8000-000000000001'});d=app(d,r);
  d=app(d,F.lancerFile(d,{owner:o,targets:[tgt(4)],message:'m',intervalleMinutes:0,maintenant:T+1000}));
  console.log('3 jobs', JSON.stringify(d.groupes[o].jobs.map(j=>j.id+':'+j.etat)));
}
// 4. ajouter=true quand la même sélection est renvoyée (double toucher)
{
  let d=F.initialiserFile(null);
  d=app(d,F.lancerFile(d,{owner:o,targets:[tgt(1),tgt(2)],message:'m',intervalleMinutes:0,maintenant:T}));
  try{d=app(d,F.lancerFile(d,{owner:o,targets:[tgt(1),tgt(2)],message:'m',intervalleMinutes:0,maintenant:T+10,ajouter:true}));console.log('4 ok',JSON.stringify(d.groupes[o].jobs.map(j=>j.id+':'+j.etat)));}catch(e){console.log('4 refus:',e.message);}
}
