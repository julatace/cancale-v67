// 29 oct. — variables du message ({username}, {a|b}) et offre « Diminuer / Fixer à »,
// inspirées de Vintex. La règle vit dans src/favorisMessage.js et est RECOPIÉE dans
// l'extension : les deux copies doivent être identiques, et l'extension doit l'utiliser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {erreurVariablesFavori,personnaliserMessageFavori,prixOffreFavori} from '../../src/favorisMessage.js';
import {validerReglagesFavoris,offreFavori,MESSAGE_PAR_DEFAUT} from '../../src/reglagesFavoris.js';
import {lancerFile,reserverFile,consommerFile,RefusFavoris} from '../../api/_lib/favoris-file.js';

const bloc=t=>{const a=t.indexOf('// <favoris-message-regle>'),b=t.indexOf('// </favoris-message-regle>');assert.ok(a>=0&&b>a,'balises présentes');return t.slice(a,b);};
const app=fs.readFileSync(new URL('../../src/favorisMessage.js',import.meta.url),'utf8');
const ext=fs.readFileSync(new URL('../../vinted-sync-extension/background.js',import.meta.url),'utf8');

test('la copie de l’extension est identique à celle de l’app',()=>{assert.equal(bloc(ext),bloc(app));});
test('l’extension personnalise avec le pseudo du fil vérifié et utilise l’offre',()=>{
  assert.match(ext,/personnaliserMessageFavori\(body\.message,String\(c\?\.opposite_user\?\.login\|\|''\)\)/);
  assert.match(ext,/prixOffreFavori\(prixAnnonce,offre\)/);
  assert.match(ext,/reply:\{body:texteFinal,/);
  const ctx={};vm.runInNewContext(bloc(ext),ctx);assert.equal(ctx.personnaliserMessageFavori('Salut {username}','bob'),'Salut bob');
});
test('variables : {username} et {a|b}, le reste refusé',()=>{
  assert.equal(erreurVariablesFavori('Bonjour {username}, {merci|top} !'),'');
  assert.match(erreurVariablesFavori('Bonjour {prenom}'),/Variable inconnue/);
  assert.match(erreurVariablesFavori('Bonjour {a}'),/Variable inconnue/);
  assert.match(erreurVariablesFavori('Bonjour {username'),/accolade/);
  assert.equal(personnaliserMessageFavori('Bonjour {username}, merci !','kees22'),'Bonjour kees22, merci !');
  assert.equal(personnaliserMessageFavori('Bonjour {username}, merci !',''),'Bonjour, merci !');
  assert.equal(personnaliserMessageFavori('{Bonjour|Salut} toi',null,()=>0),'Bonjour toi');
  assert.equal(personnaliserMessageFavori('{Bonjour|Salut} toi',null,()=>0.99),'Salut toi');
  assert.equal(personnaliserMessageFavori('Hey {username}','a{b}c'),'Hey a b c','un pseudo ne réinjecte jamais d’accolade');
});
test('offre : diminuer en %, en €, fixer à, arrondi',()=>{
  assert.equal(prixOffreFavori(50,{mode:'pct',valeur:10,arrondi:false}),'45.00');
  assert.equal(prixOffreFavori(49.9,{mode:'pct',valeur:2,arrondi:false}),'48.90');
  assert.equal(prixOffreFavori(49.9,{mode:'pct',valeur:2,arrondi:true}),'48.00');
  assert.equal(prixOffreFavori(50,{mode:'euros',valeur:4.5,arrondi:false}),'45.50');
  assert.equal(prixOffreFavori(50,{mode:'prix',valeur:45,arrondi:false}),'45.00');
  assert.equal(prixOffreFavori(40,{mode:'prix',valeur:45,arrondi:false}),null,'jamais au-dessus du prix');
  assert.equal(prixOffreFavori(50,{mode:'prix',valeur:50,arrondi:false}),null,'jamais égal au prix');
  assert.equal(prixOffreFavori(3,{mode:'euros',valeur:2.5,arrondi:false}),null,'jamais sous 1 €');
  assert.equal(prixOffreFavori(null,{mode:'pct',valeur:10,arrondi:false}),null,'prix illisible : pas d’offre');
});
test('réglages : formes d’avant lues telles quelles, nouvelles formes validées',()=>{
  const r=validerReglagesFavoris({message:'Merci',pourcentage:10,intervalleMinutes:0});
  assert.equal(r.offreMode,'pct');assert.equal(r.pourcentage,10);assert.equal(r.message,'Merci','plus de phrase ajoutée au texte');
  const e=validerReglagesFavoris({message:'Merci {username}',offreMode:'euros',offreValeur:'4,50',arrondi:true,intervalleMinutes:0});
  assert.deepEqual([e.offreMode,e.offreValeur,e.arrondi,e.pourcentage],['euros',4.5,true,null]);
  // (29 oct., « tout à l'heure ça marchait ») message vide + offre ⇒ le texte par défaut ; vide sans offre ⇒ refusé.
  const v=validerReglagesFavoris({message:'',pourcentage:10,intervalleMinutes:0});
  assert.equal(v.message,MESSAGE_PAR_DEFAUT);assert.equal(v.pourcentage,10);
  assert.equal(validerReglagesFavoris({message:'  ',offreMode:'prix',offreValeur:'45',intervalleMinutes:0}).message,MESSAGE_PAR_DEFAUT);
  assert.throws(()=>validerReglagesFavoris({message:'',intervalleMinutes:0}),/message/);
  assert.throws(()=>validerReglagesFavoris({message:'Salut {nom}',intervalleMinutes:0}),/Variable inconnue/);
  assert.throws(()=>offreFavori({offreMode:'prix',offreValeur:'0,50'}));
  assert.deepEqual(offreFavori({}),{pourcentage:null,offreMode:null,offreValeur:null,arrondi:false});
});
test('serveur : l’offre suit le favori, et une extension d’avant 5.281 est refusée sans rien envoyer',()=>{
  const T=1_800_000_000_000,cible={itemId:'11',recipientId:'22',notificationId:'n1',initiator:'favori'};
  const offre={mode:'euros',valeur:5,arrondi:false};
  let d=lancerFile(null,{owner:'o',targets:[cible],message:'Salut {username}',intervalleMinutes:0,maintenant:T,offre}).data;
  d=reserverFile(d,{owner:'o',maintenant:T,jeton:'j'}).data;
  assert.throws(()=>consommerFile(d,{owner:'o',jeton:'j',maintenant:T+1,version5281:false}),RefusFavoris);
  const c=consommerFile(d,{owner:'o',jeton:'j',maintenant:T+1,version5281:true}).valeur.travail;
  assert.deepEqual(c.offre,offre);assert.equal(c.message,'Salut {username}');
  assert.throws(()=>lancerFile(null,{owner:'o',targets:[cible],message:'x',intervalleMinutes:0,maintenant:T,offre:{mode:'pct',valeur:150,arrondi:false}}),RefusFavoris);
  // Forme d'avant (pourcentage seul, sans variable) : permise à une 5.280, refusée avant (l'offre ne partait pas).
  let v=lancerFile(null,{owner:'o',targets:[cible],message:'Merci',intervalleMinutes:0,maintenant:T,pourcentage:10,offre:{mode:'pct',valeur:10,arrondi:false}}).data;
  v=reserverFile(v,{owner:'o',maintenant:T,jeton:'k'}).data;
  assert.equal(consommerFile(v,{owner:'o',jeton:'k',maintenant:T+1,version5281:false}).valeur.travail.pourcentage,10);
  let w=lancerFile(null,{owner:'o',targets:[cible],message:'Merci',intervalleMinutes:0,maintenant:T,pourcentage:10,offre:{mode:'pct',valeur:10,arrondi:false}}).data;
  w=reserverFile(w,{owner:'o',maintenant:T,jeton:'l'}).data;
  assert.throws(()=>consommerFile(w,{owner:'o',jeton:'l',maintenant:T+1,version5281:false,version5280:false}),RefusFavoris,'une 5.279 ne fait pas l’offre : rien ne part');
  let x=lancerFile(null,{owner:'o',targets:[cible],message:'Merci',intervalleMinutes:0,maintenant:T}).data;
  x=reserverFile(x,{owner:'o',maintenant:T,jeton:'m'}).data;
  assert.ok(consommerFile(x,{owner:'o',jeton:'m',maintenant:T+1,version5281:false,version5280:false}).valeur.travail,'sans offre, une ancienne extension envoie toujours');
});
