// La file des messages aux favoris prévient quand elle FINIT (28 oct., « que ça
// me prévienne ») : un bilan, une seule fois, à la transition active → inactive.
// Données inventées, aucune requête.
import assert from 'node:assert/strict';
import {lancerFile,reserverFile,terminerFile} from '../../api/_lib/favoris-file.js';
import {texteFinFavoris} from '../../api/_lib/favoris.js';
import {PUSH_DEFAUT} from '../../api/_lib/push.js';
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
const cibles=k=>Array.from({length:k},(_,i)=>({itemId:String(100+i),recipientId:String(200+i),notificationId:'n'+i,initiator:'x'}));
const t0=1_800_000_000_000;
const un=(d,t,jeton,resultat,raison)=>{let r=reserverFile(d,{owner:'o',maintenant:t,jeton,suivi:'s'});d=r.data;d.enCours.autorise=true;return terminerFile(d,{owner:'o',jeton,resultat,raison,maintenant:t+1000});};
// deux messages : la fin n'arrive qu'au second
let d=lancerFile(null,{owner:'o',targets:cibles(2),message:'B',intervalleMinutes:1,maintenant:t0,lot:'L1'}).data;
let r=un(d,t0,'00000000-0000-4000-8000-000000000001','envoye');d=r.data;
ok(!r.valeur.fin,'pas de bilan tant qu’il reste un favori');
r=un(d,t0+120000,'00000000-0000-4000-8000-000000000002','envoye');d=r.data;
ok(r.valeur.fin&&r.valeur.fin.total===2&&r.valeur.fin.envoyes===2&&!r.valeur.fin.interrompue,'file finie : bilan 2 sur 2');
r=terminerFile(d,{owner:'o',jeton:'00000000-0000-4000-8000-000000000002',resultat:'envoye',maintenant:t0+130000});
ok(!r.valeur.fin,'rejouer l’accusé ne redonne pas de bilan (une seule notification)');
// interrompue
d=lancerFile(null,{owner:'o',targets:cibles(3),message:'B',intervalleMinutes:1,maintenant:t0,lot:'L2'}).data;
r=un(d,t0,'00000000-0000-4000-8000-000000000003','incertain');
ok(r.valeur.fin&&r.valeur.fin.interrompue&&r.valeur.fin.incertains===1&&r.valeur.fin.total===3,'file interrompue : bilan dit « à vérifier »');
const tx=texteFinFavoris(r.valeur.fin);
ok(/interrompue/.test(tx.title)&&/0 message envoyé sur 3/.test(tx.body)&&/1 à vérifier/.test(tx.body),'texte : '+tx.title+' — '+tx.body);
ok(PUSH_DEFAUT.favoris===true,'catégorie « favoris » activée par défaut');
console.log(n+' contrôles de la fin de file réussis');
