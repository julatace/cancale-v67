import test from 'node:test';import assert from 'node:assert/strict';import {etapesTransfert} from '../../src/receptionEmail.js';
const a={adresse:'a@example.test',comptes:[{id:'1',nom:'Boutique'}],declaree:true,derniereReception:'2026-10-27T12:00:00Z'};
const now=Date.parse('2026-10-28T12:00:00Z');
test('sans preuve serveur, confirmation inconnue ; le transfert reste externe',()=>{const e=etapesTransfert(a,null,now);assert.equal(e[2].etat,'inconnu');assert.equal(e[3].etat,'externe');assert.equal(e[4].etat,'fait');});
test('deux comptes pour une adresse ne valident aucune association',()=>{const e=etapesTransfert({...a,comptes:[{},{}]},null,now);assert.equal(e[0].etat,'a-faire');assert.equal(e[1].etat,'a-faire');assert.equal(e[4].etat,'attente');});
test('la déclaration seule ne confirme pas une adresse',()=>{const e=etapesTransfert(a,{cloisonnee:true,adresses:{'a@example.test':{etat:'envoyee'}}},now);assert.equal(e[1].etat,'fait');assert.equal(e[2].etat,'attente');});
test('un lien en préparation n’est pas annoncé envoyé',()=>assert.equal(etapesTransfert(a,{cloisonnee:true,adresses:{'a@example.test':{etat:'envoi'}}},now)[2].etat,'preparation'));
test('date future ou invalide ne prouve aucune réception',()=>{for(const date of ['invalide','2027-01-01T12:00:00Z'])assert.equal(etapesTransfert({...a,derniereReception:date},null,now)[4].etat,'attente');});
test('une confirmation du serveur est reconnue sans prétendre connaître Gmail',()=>{const e=etapesTransfert(a,{cloisonnee:true,adresses:{'a@example.test':{etat:'prouvee'}}},now);assert.equal(e[2].etat,'fait');assert.equal(e[3].etat,'externe');});
