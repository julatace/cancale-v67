// L'agent : un favori auto AJOUTÉ (attente) mais la réservation n'a pas eu lieu (rejouerTerminers raté, réseau, exclus pas lus).
import * as F from '../../api/_lib/favoris-file.js';
import * as A from '../../api/_lib/favoris-auto.js';
const o='own', T=Date.parse('2026-11-28T11:00:00Z');
const reg={actif:true,parHeure:15,parJour:100,jours:[1,2,3,4,5,6,7],heureDebut:0,heureFin:24,attenteMin:10,attenteMax:60};
let d=F.initialiserFile(null);
d.groupes[o]={jobs:[],active:false,prochain:0,auto:{reglages:reg,allumeLe:T-86400000,journal:[]}};
const choisi={l:{id:'n1',date:new Date(T-3600000).toISOString()},cible:{itemId:'701',recipientId:'301',notificationId:'n1',initiator:'x'}};
let r=A.ajouterAuto(d,{owner:o,maintenant:T,choisi,message:'m',offre:null});d=r.data||d;
console.log('ajoute', r.valeur.ajoute, 'active', d.groupes[o].active, JSON.stringify(d.groupes[o].jobs.map(j=>j.etat)));
// 1) réservation ratée (exclus pas lus = null) ⇒ rien n'est réservé
r=F.reserverFile(d,{owner:o,maintenant:T+1000,jeton:'00000000-0000-4000-8000-000000000001',exclus:null});d=r.data||d;
console.log('reserve(exclus=null) travail', !!(r.valeur&&r.valeur.travail));
for(const dt of [600000,3600000,86400000]) console.log('etatAuto +'+dt/60000+'min', JSON.stringify(A.etatAuto(d,o,T+dt)), JSON.stringify(d.groupes[o].jobs.map(j=>j.etat)));
// 2) Pause de l'agent pendant qu'un favori auto attend : la réservation la respecte-t-elle ?
let d2=F.initialiserFile(null);d2.groupes[o]={jobs:[],active:false,prochain:0,auto:{reglages:reg,allumeLe:T-86400000,journal:[]}};
r=A.ajouterAuto(d2,{owner:o,maintenant:T,choisi,message:'m',offre:null});d2=r.data||d2;
r=A.pauseAgentAuto(d2,{owner:o,pause:true,maintenant:T+10});d2=r.data||d2;
r=F.reserverFile(d2,{owner:o,maintenant:T+20,jeton:'00000000-0000-4000-8000-000000000002'});d2=r.data||d2;
console.log('pause puis reserve : travail', !!(r.valeur&&r.valeur.travail));
try{const c=F.consommerFile(d2,{owner:o,jeton:'00000000-0000-4000-8000-000000000002',maintenant:T+30});console.log('consommer apres pause : autorise', !!c.data?.enCours?.autorise);}catch(e){console.log('consommer refuse:',e.message);}
// 3) Grâce : bail renouvelé jusqu'à BAIL_MAX (15 min), worker vivant ; une 2e réservation sort-elle pendant qu'il écrit ?
let d3=F.initialiserFile(null);
d3=(F.lancerFile(d3,{owner:o,targets:[{itemId:'701',recipientId:'301',notificationId:'a',initiator:'x'},{itemId:'702',recipientId:'302',notificationId:'b',initiator:'x'}],message:'m',intervalleMinutes:0,maintenant:T})).data;
const J1='00000000-0000-4000-8000-000000000003';r=F.reserverFile(d3,{owner:o,maintenant:T,jeton:J1});d3=r.data||d3;
let t=T, ko='';for(t=T+30000;t<=T+16*60000;t+=30000){try{d3=F.prolongerFile(d3,{owner:o,jeton:J1,maintenant:t}).data;}catch(e){ko='prolonger refusé à +'+Math.round((t-T)/60000*10)/10+' min';break;}}
console.log(ko);
for(const dt of [0,120000,240000,250000]){r=F.reserverFile(d3,{owner:o,maintenant:t+dt,jeton:'00000000-0000-4000-8000-00000000000'+(4+dt/10000|0)%10});d3=r.data||d3;console.log('reserve à +'+Math.round((t+dt-T)/60000*10)/10+' min : travail', r.valeur.travail?r.valeur.travail.id:null, JSON.stringify(d3.groupes[o].jobs.map(j=>j.etat)));}
