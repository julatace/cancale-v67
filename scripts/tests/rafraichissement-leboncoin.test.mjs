import test from 'node:test';import assert from 'node:assert/strict';
import {suivreReceptionLeboncoin,lireReceptionLeboncoin} from '../../src/rafraichissementLeboncoin.js';
import {creerLecturesPartagees} from '../../src/lecturesPartagees.js';
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
 assert.equal(await lireReceptionLeboncoin('https://base.test',{}, {transport:()=>new Promise(()=>{}),delai:3}),null);
 assert.equal(await lireReceptionLeboncoin('https://base.test',{}, {transport:async()=>{throw new Error('réseau');}}),null);
 assert.equal(await lireReceptionLeboncoin('https://base.test',{}, {transport:async()=>({ok:false,json:async()=>[]})}),null);
 const vide=await lireReceptionLeboncoin('https://base.test',{}, {transport:async()=>({ok:true,json:async()=>[]})});
 assert.deepEqual(vide,[]);
});
// (22 oct.) La coque, Ma journée et le centre de notifications lisent la MÊME
// ligne `lbc_ventes` au démarrage : passée avec un `signal` ou un mode de cache,
// chaque lecture sortait du partage (src/lecturesPartagees.js) et partait sur le
// réseau — banc `vitesse.cjs`, Ma journée 390 px : 3 lectures au lieu d'une.
test('deux lectures identiques en même temps ne partent qu\'une fois',async()=>{
 let parties=0;const vrai=async()=>{parties++;await pause(5);return new Response('[{"data":{"ventes":{}}}]',{status:200,headers:{'content-type':'application/json'}});};
 const lp=creerLecturesPartagees(vrai,'https://base.test',{origine:''});
 const url='https://base.test/rest/v1/app_data?id=eq.lbc_ventes&select=data';
 const [a,b]=await Promise.all([lireReceptionLeboncoin(url,{authorization:'Bearer x'},{transport:lp.fetch}),lireReceptionLeboncoin(url,{authorization:'Bearer x'},{transport:lp.fetch})]);
 assert.equal(parties,1);assert.deepEqual(a,[{data:{ventes:{}}}]);assert.deepEqual(b,a);
});
