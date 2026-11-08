import {etatOffreVinted} from '../../src/offresVinted.js';
import {lireEntiteVinted,extraitConversation} from '../../src/messagesLisibles.js';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import { createRequire as creerRequireSourceApp } from 'node:module';
creerRequireSourceApp(import.meta.url)('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const s=fs.readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8');
const code=s.slice(s.indexOf('const normalizeConversationMessages ='),s.indexOf("// L'offre d'un ACHETEUR"));
const normaliser=new Function('extractLinks','lireEntiteVinted','etatOffreVinted',code+';return normalizeConversationMessages;')(()=>[],lireEntiteVinted,etatOffreVinted);
const offre=(user,price,extra={})=>({entity_type:'offer_request_message',created_at:'2026-10-25T08:00:00Z',entity:{user_id:user,price,status:10,current:true,...extra}});
test('les offres reçues et envoyées sont des événements financiers distincts',()=>{
 const r=normaliser({opposite_user:{id:22},messages:[offre(22,{amount:'45,50',currency_code:'EUR'}),offre(11,{amount:'50.00',currency:'EUR'})]});
 assert.equal(r[0].kind,'offer');assert.deepEqual(r[0].offre,{montant:45.5,devise:'EUR',ancien:null,sens:'recue',statut:'En attente',oid:null,type:'offer_request_message'});assert.equal(r[1].offre.sens,'envoyee');
});
test('l’identité de l’offre (offer_request_id) est gardée telle quelle, jamais inventée',()=>{
 const [a,b]=normaliser({opposite_user:{id:22},messages:[offre(22,{amount:'45',currency_code:'EUR'},{offer_request_id:987}),offre(22,{amount:'46',currency_code:'EUR'})]});
 assert.equal(a.offre.oid,'987');assert.equal(b.offre.oid,null);
});
test('aucune direction ni devise n’est inventée si la source ne les donne pas',()=>{
 const [r]=normaliser({messages:[offre(null,{amount:'19'})]});assert.equal(r.offre.sens,'inconnu');assert.equal(r.offre.devise,null);
});
test('offre précédente et libellé natif conservent leur statut réel',()=>{
 const [r,a]=normaliser({messages:[offre(2,{amount:'30'},{current:false}),offre(2,{amount:'35'},{status:30,status_title:'Offre refusée'})]});assert.equal(r.offre.statut,'Offre précédente');assert.equal(a.offre.statut,'Offre refusée');
});
test('un montant illisible ne devient pas une offre chiffrée',()=>{
 for(const price of [{amount:'45 euros'},{amount:'NaN'},null,{amount:'-5'},{amount:'0'}])assert.equal(normaliser({messages:[offre(2,price)]})[0].kind,'event');
});
test('messages et événements de retrait restent présents et classés par date',()=>{
 const r=normaliser({opposite_user:{id:22},messages:[offre(22,{amount:'20'}),{entity_type:'message',created_at:'2026-10-25T07:00:00Z',entity:{user_id:11,body:'Bonjour'}},{entity_type:'status_message',created_at:'2026-10-25T09:00:00Z',entity:{body:'Code de retrait 123456'}}]});assert.deepEqual(r.map(m=>m.kind),['message','offer','event']);assert.equal(r[0].mine,true);assert.match(r[2].body,/123456/);
});
// (5 nov.) « on a le code et pas les vrais messages » — formes MESURÉES.
test('ses offres (offer_message) sont des offres, jamais « currency_code: EUR »',()=>{
 const [r]=normaliser({opposite_user:{id:22},messages:[{entity_type:'offer_message',created_at:'2026-10-25T08:00:00Z',entity:{user_id:11,currency:'EUR',current:true,price_fixed:false,price:{amount:'40.0',currency_code:'EUR'},original_price:{amount:'55.0',currency_code:'EUR'},price_label:'40,00 €',original_price_label:'55,00 €'}}]});
 assert.equal(r.kind,'offer');assert.equal(r.offre.montant,40);assert.equal(r.offre.ancien,55);assert.equal(r.offre.sens,'envoyee');assert.doesNotMatch(JSON.stringify(r),/currency_code:/);
});
test('le HTML de Vinted est retiré, le texte du lien gardé',()=>{
 const [r]=normaliser({messages:[{entity_type:'action_message',created_at:'2026-10-25T08:00:00Z',entity:{title:'Envoie ta commande',subtitle:'Dépose ton colis au <a href="/" class="msg-status__link">point relais</a> le plus proche.<br/><br/>Garde le rythme.',template:{style:'gray_box'},actions:[{action:'x',title:'Imprimer',primary:true}]}}]});
 assert.equal(r.kind,'event');assert.doesNotMatch(r.body,/<|msg-status|gray_box/);assert.match(r.body,/au point relais le plus proche/);assert.match(r.body,/^Envoie ta commande\n/);
});
test('un évènement sans texte n’affiche jamais son type technique',()=>{
 const [r]=normaliser({messages:[{entity_type:'status_message',created_at:'2026-10-25T08:00:00Z',entity:{template:{style:'clear_box'},interpolation_values:{}}}]});
 assert.equal(r.body,'');
});
test('un message de l’équipe Vinted (portal_message) est un message lisible',()=>{
 const [r]=normaliser({opposite_user:{id:22},messages:[{entity_type:'portal_message',created_at:'2026-10-25T08:00:00Z',entity:{user_id:null,body:'<p>Bonjour,</p><p>Ton litige est clos.</p>'}}]});
 assert.equal(r.kind,'message');assert.equal(r.vinted,true);assert.equal(r.mine,false);assert.match(r.body,/Bonjour,\nTon litige est clos\./);
});
// (5 nov., relecture) L'extrait de la LISTE suit la règle du fil.
const boite={updated_at:'2026-11-05T10:00:00Z',opposite_user:{id:5},_acc:{vinted_user_id:111},description:'Nike'};
const ts=(iso)=>Date.parse(iso)/1000;
test('fil capté plus récent que la boîte : SA réponse est dite de lui (de: toi)',()=>{
 const ex=extraitConversation(boite,{dt:'message',db:'Je la dépose demain',der:'111',opp:'5',derTs:ts('2026-11-05T10:05:00Z')},'Nike');
 assert.equal(ex.source,'fil');assert.equal(ex.de,'toi');
 const eux=extraitConversation(boite,{dt:'message',db:'Dispo ?',der:'5',opp:'5',derTs:ts('2026-11-05T10:00:00Z')},'Nike');
 assert.equal(eux.de,'eux');
});
test('l’état d’une offre en dernier se lit par etatOffreVinted (précédente ≠ en attente, annulée dite)',()=>{
 const r={dt:'offer_request_message',dp:'50.0',der:'5',opp:'5',derTs:ts('2026-11-05T10:00:00Z')};
 assert.equal(extraitConversation(boite,{...r,dst:'10',dcur:'false',dstt:'En attente'},'Nike').offre.etat,null);
 assert.equal(extraitConversation(boite,{...r,dst:'10',dcur:'true',dstt:'En attente'},'Nike').offre.etat,'attente');
 const an=extraitConversation(boite,{...r,dst:'40',dcur:'true',dstt:'Annulée'},'Nike').offre;
 assert.equal(an.etat,'terminee');assert.equal(an.etatLibelle,'Annulée');
 assert.equal(extraitConversation(boite,{...r,dst:'20',dcur:'true',dstt:'- Offre acceptée'},'Nike').offre.etat,'acceptee');
});
