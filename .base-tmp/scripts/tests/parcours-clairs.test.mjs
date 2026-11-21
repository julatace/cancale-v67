import test from 'node:test';import assert from 'node:assert/strict';
import {prixAnnoncePourOffre} from '../../src/actionsClaires.js';
import {etatGuide} from '../../src/guideDemarrage.js';
test('Prix affiché : article ET compte, jamais le titre ou une vente',()=>{
 const lignes=Array.from({length:50},(_,i)=>({id:i+1,title:'Même article',price:{amount:String(i+10),currency_code:'EUR'},_acc:{vinted_user_id:'123'}}));
 lignes.push({id:8,price:999,_acc:{vinted_user_id:'456'}});
 assert.equal(prixAnnoncePourOffre(lignes,8,'123'),17);assert.equal(prixAnnoncePourOffre(lignes,8,'456'),999);assert.equal(prixAnnoncePourOffre(lignes,8,''),null);assert.equal(prixAnnoncePourOffre(lignes,999,'123'),null);
 assert.equal(prixAnnoncePourOffre([...lignes,lignes[7]],8,'123'),null);
});
test('Prix inconnu, incohérent ou autre devise : aucun montant inventé',()=>{
 for(const price of [null,'',true,'abc',Infinity,0,-4])assert.equal(prixAnnoncePourOffre([{id:1,price,_acc:{vinted_user_id:'1'}}],1,'1'),null);
 assert.equal(prixAnnoncePourOffre([{id:1,price:{amount:'25',currency_code:'GBP'},_acc:{vinted_user_id:'1'}}],1,'1'),null);
});
test('Le guide ne saute pas une lecture en cours ou en échec',()=>{
 for(const etat of ['encours','passu','afaire']){
  const g=etatGuide({compte:'fait',extension:'fait',vinted:etat,emails:'afaire',vente:'afaire'});
  assert.equal(g.courante,'vinted');assert.equal(g.faites,2);assert.equal(g.fini,false);
 }
 assert.equal(etatGuide({compte:'fait',extension:'fait',vinted:'fait',emails:'fait',vente:'fait'}).courante,null);
});

test('Repère de négociation : centimes exacts, minimum jamais inventé',async()=>{
 const {comparaisonMinimum}=await import('../../src/actionsClaires.js');
 assert.deepEqual(comparaisonMinimum(19.99,20.01),{etat:'sous-minimum',ecart:.02});
 assert.deepEqual(comparaisonMinimum(45,40),{etat:'minimum-atteint',ecart:5});
 assert.deepEqual(comparaisonMinimum(40,40),{etat:'minimum-atteint',ecart:0});
 for(const v of [null,undefined,'40',0,.001,-1,NaN,Infinity])assert.equal(comparaisonMinimum(45,v).etat,'minimum-inconnu');
 assert.equal(comparaisonMinimum(null,40).etat,'offre-inconnue');
});
