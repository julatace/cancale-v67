// Régression : une vente sans annonce ne propose pas une paire encore en ligne.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
(async()=>{
 const {candidatsVenteSansAnnonce}=await import('../../src/candidatsVente.js');
 const app=require('../_source-app.cjs')(path.resolve(__dirname,'../../src/App.jsx'));
 const normaliser=app.match(/const cleNum = \(v\) => \{[\s\S]*?\n\};/);
 assert.ok(normaliser,'normalisation réelle des numéros disponible');
 const cle=vm.runInNewContext(normaliser[0]+'\ncleNum');
 const numeros={active:{numero:'041',title:'Paire en ligne'},ancienne:{numero:'41',title:'Ancienne annonce du même numéro'},prefixee:{numero:'B-12',title:'En ligne avec préfixe'},alias:{numero:'b12',title:'Historique du préfixe'},vendue:{numero:'52',title:'Paire vendue'},sansNumero:{title:'Sans numéro'},vide:{numero:'  '},supprimee:null};
 const avant=JSON.stringify(numeros);
 const result=candidatsVenteSansAnnonce(numeros,new Set(['active','prefixee']),cle);
 assert.deepEqual(result.map(e=>e.num),['52'],'actives et alias historiques exclus, vendue conservée');
 assert.equal(result[0].title,'Paire vendue','identité et informations historiques conservées');
 assert.equal(JSON.stringify(numeros),avant,'aucune modification des liens ou des numéros');
 assert.deepEqual(candidatsVenteSansAnnonce(numeros,new Set(Object.keys(numeros)),cle),[],'aucune fausse suggestion quand tout est en ligne');
 assert.deepEqual(candidatsVenteSansAnnonce({},new Set(),cle),[],'historique vide sans suggestion inventée');
 assert.deepEqual(candidatsVenteSansAnnonce({123:{numero:'007',title:'Disparue'},124:{numero:'8'}},new Set([124]),cle).map(e=>e.num),['007'],'ids numériques reconnus et numéro affiché sans perte de zéro');
 console.log('6 contrôles de candidats de vente réussis.');
})().catch(e=>{console.error(e);process.exitCode=1});
