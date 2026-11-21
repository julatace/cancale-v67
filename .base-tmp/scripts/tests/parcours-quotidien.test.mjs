import test from 'node:test';import assert from 'node:assert/strict';
import {lireParcours,garderParcours,viderParcours,changementsImportants,noterChangements,resumeSelection,periodeReutilisable,motifRecherche,restaurerVue} from '../../src/parcoursQuotidien.js';
const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k),key:i=>[...m.keys()][i],get length(){return m.size}}};
test('contexte : propriétaire exact, expiration, stockage fermé et démarrage',()=>{
 const s=storage(),now=100000;garderParcours(s,'A','vue:ventes','transit',now);garderParcours(s,'B','vue:ventes','all',now);
 assert.equal(lireParcours(s,'A','vue:ventes',null,now+1),'transit');assert.equal(lireParcours(s,'C','vue:ventes',null,now+1),null);
 assert.equal(lireParcours(s,'A','vue:ventes',null,now+8*86400000),null);assert.equal(lireParcours(s,'A','vue:ventes',null,now-1),null);
 viderParcours(s,'A');assert.equal(lireParcours(s,'B','vue:ventes',null,now+1),null);assert.equal(lireParcours(s,'A','vue:ventes',null,now+1),'transit');
 viderParcours(s);assert.equal(s.length,0);assert.equal(garderParcours({setItem(){throw Error()}},'A','x',1),false);assert.equal(lireParcours(null,'A','x'),null);
});
test('sélection : aucune ligne eBay non cochable, pas de doublons, chiffres du lot choisi seulement',()=>{
 const L=[{cle:'1',site:'vinted',pdf:true,compte:'a'},{cle:'2',site:'vestiaire',pdf:false,compte:'b',imprime:'hier'},{cle:'3',site:'ebay',cochable:false}, {cle:'4',pdf:true}, {cle:'1',pdf:true}];
 const r=resumeSelection(L,new Set(['1','2','3']));assert.deepEqual([r.total,r.prets,r.sansPdf,r.dejaImprimes,r.comptes],[2,1,1,1,2]);assert.deepEqual(r.sites,['vinted','vestiaire']);
});
test('historique : seulement champs autorisés, ancienne valeur conservée, aucune donnée secrète',()=>{
 const a={x:{numero:'7',buyPrice:12,access_token:'secret'}},b={x:{numero:'7',buyPrice:15,access_token:'autre'}};
 const r=changementsImportants('vinted_annonce_numeros',a,b);assert.equal(r.length,1);assert.deepEqual([r[0].avant,r[0].apres,r[0].numero],[12,15,'7']);assert.ok(!JSON.stringify(r).includes('secret'));
 assert.deepEqual(changementsImportants('vinted_accounts',a,b),[]);assert.deepEqual(changementsImportants('vinted_annonce_numeros',null,b),[]);
 const s=storage();for(let i=0;i<120;i++)noterChangements(s,'A','vinted_buyprice_by_num',{'7':i},{'7':i+1});
 assert.equal(lireParcours(s,'A','modifications').length,100);assert.equal(lireParcours(s,'B','modifications'),null);
});
test('périodes : bornes réutilisables, aucune plage inversée ou illisible',()=>{
 assert.equal(periodeReutilisable({from:'2026-11-05',to:'2026-11-04'}),null);assert.equal(periodeReutilisable({from:'x',to:'2026-11-04'}),null);
 const p=periodeReutilisable({from:new Date('2026-11-01'),to:new Date('2026-11-04')});assert.ok(p.from.startsWith('2026-11-01'));assert.equal(periodeReutilisable(null),null);
 assert.equal(motifRecherche('suivi'),'Numéro de suivi correspondant');assert.equal(motifRecherche('titre'),'Titre correspondant');
});

test('les préférences corrompues ne deviennent pas des dates ou des limites invalides',()=>{const s=storage();garderParcours(s,'A','vue:ventes-limite',-1);assert.equal(restaurerVue(s,'A','ventes-limite',60),60);garderParcours(s,'A','vue:commandes-periode',{from:'x',to:'y'});assert.equal(restaurerVue(s,'A','commandes-periode',null),null);garderParcours(s,'A','vue:q',{token:'interdit'});assert.equal(restaurerVue(s,'A','q',''),'');});
