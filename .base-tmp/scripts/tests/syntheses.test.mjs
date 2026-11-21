import test from 'node:test';import assert from 'node:assert/strict';
import {passationMissions,reapprovisionnement,csvReappro} from '../../src/operations/syntheses.js';
import {cheminMonotone} from '../../src/courbeMonotone.js';
test('passation : statuts distincts, dates serveur et ordre des échéances',()=>{
 const now='2026-10-21T12:00:00Z',missions=[{id:'futur',etat:'attribuee',echeance:'2026-10-22'},{id:'retard',etat:'en_cours',echeance:'2026-10-20'},{id:'blocage',etat:'bloquee'},{id:'done',etat:'terminee'},{id:'valide',etat:'validee',modifie:'2026-10-21T09:00:00Z'},{id:'ancien',etat:'validee',modifie:'2026-10-19'},{id:'datefuture',etat:'validee',modifie:'2026-10-22'},{id:'annule',etat:'annulee'}];
 const avant=JSON.stringify(missions),r=passationMissions(missions,now);assert.deepEqual(r.prochaines.map(x=>x.id),['retard','futur']);assert.deepEqual(r.bloquees.map(x=>x.id),['blocage']);assert.deepEqual(r.avalider.map(x=>x.id),['done']);assert.deepEqual(r.validees.map(x=>x.id),['valide']);assert.equal(JSON.stringify(missions),avant);
});
test('réapprovisionnement : égalité au seuil, stock inconnu et quantités exactes',()=>{
 const s=[{id:'a',titre:'Cartons',stock:2,seuil:5,unite:'piece'},{id:'b',titre:'Adhésif',stock:5,seuil:5,unite:'rouleau'},{id:'c',titre:'Inconnu',stock:null,seuil:5},{id:'d',titre:'Plein',stock:9,seuil:5}];const avant=JSON.stringify(s),r=reapprovisionnement(s);assert.deepEqual(r.lignes.map(x=>[x.id,x.minimum]),[['b',1],['a',4]]);assert.equal(r.inconnus.length,1);assert.equal(JSON.stringify(s),avant);const csv=csvReappro(r.lignes);assert.match(csv,/"Cartons";"piece";"2";"5";"4"/);assert.match(csvReappro([{titre:'=HYPERLINK("piège")',unite:'piece',stock:0,seuil:0,minimum:1}]),/"'=HYPERLINK/);
});
test('courbes : les segments cubiques ne dépassent pas les mesures',()=>{
 for(const ys of [[0,0,80,0,20,0,0],[100,90,60,30,15,8,0],[0,100,100,100,0,0,70]]){
  const points=ys.map((y,i)=>[i*20,y]),d=cheminMonotone(points),segments=[...d.matchAll(/C([\d.\-]+),([\d.\-]+) ([\d.\-]+),([\d.\-]+) ([\d.\-]+),([\d.\-]+)/g)];assert.equal(segments.length,6);
  segments.forEach((m,i)=>{for(let k=0;k<=100;k++){const t=k/100,a=1-t,y=a*a*a*ys[i]+3*a*a*t*Number(m[2])+3*a*t*t*Number(m[4])+t*t*t*Number(m[6]);assert.ok(y>=Math.min(ys[i],ys[i+1])-.02&&y<=Math.max(ys[i],ys[i+1])+.02);}});
 }assert.equal(cheminMonotone([]),'');assert.equal(cheminMonotone([[1,2]]),'M1,2');
});
