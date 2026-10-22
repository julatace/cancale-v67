import test from 'node:test';import assert from 'node:assert/strict';
import {suivreReceptionLeboncoin,lireReceptionLeboncoin} from '../../src/rafraichissementLeboncoin.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function setup(relire){const fenetre=new EventTarget(),document=new EventTarget();document.hidden=false;return{fenetre,document,s:suivreReceptionLeboncoin({fenetre,document,relire,delai:2})};}
test('revenir dans VRM recharge les données, les signaux rapprochés sont regroupés',async()=>{
 let n=0;const e=setup(async()=>n++);e.fenetre.dispatchEvent(new Event('focus'));e.document.dispatchEvent(new Event('visibilitychange'));await pause(20);assert.equal(n,1);
 e.document.hidden=true;e.document.dispatchEvent(new Event('visibilitychange'));await pause(10);assert.equal(n,1);e.s.arreter();
});
test('un signal pendant une lecture impose une reprise sans requêtes simultanées',async()=>{
 let n=0,liberer;const e=setup(async()=>{if(++n===1)await new Promise(r=>liberer=r);});e.s.actualiser();await pause(10);e.s.actualiser();e.s.actualiser();assert.equal(n,1);liberer();await pause(10);assert.equal(n,2);e.s.arreter();
});
test('sortir de cet écran empêche une ancienne lecture de remplacer le nouvel écran',async()=>{
 let actif,fin;const e=setup(async estActif=>{actif=estActif;await new Promise(r=>fin=r);});e.s.actualiser();await pause(10);e.s.arreter();assert.equal(actif(),false);fin();e.fenetre.dispatchEvent(new Event('focus'));await pause(10);
});

test('une requête bloquée expire ; une erreur ne devient jamais une liste vide',async()=>{
 const transport=(_url,opts)=>new Promise((_r,rejet)=>opts.signal.addEventListener('abort',()=>rejet(new Error('timeout'))));
 assert.equal(await lireReceptionLeboncoin('https://base.test',{}, {transport,delai:3}),null);
 let cache;const vide=await lireReceptionLeboncoin('https://base.test',{}, {transport:async(_u,o)=>{cache=o.cache;return{ok:true,json:async()=>[]};}});
 assert.deepEqual(vide,[]);assert.equal(cache,'no-store');
});
