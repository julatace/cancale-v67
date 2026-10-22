import test from 'node:test';import assert from 'node:assert/strict';
import {resumeReceptionLbc} from '../../src/diagnosticLeboncoin.js';
test('le diagnostic distingue lecture ratée, aucune trace et annonces sans photo',()=>{
 assert.match(resumeReceptionLbc({annonces:null,comptes:[],traces:[]}),/impossible/);
 assert.match(resumeReceptionLbc({annonces:[],comptes:[],traces:[]}),/aucune trace disponible/);
 const r=resumeReceptionLbc({annonces:[{items:{a:{account:'x',images:[]},b:{account:'x',images:['https://img.leboncoin.fr/photo']},c:{account:'autre',images:[]}}}],comptes:[{accounts:{x:{sessionAt:'date'}}}],traces:[]});
 assert.match(r,/enregistrées : 3 ; attribuées à une session connue : 2 ; avec photo : 1/);
});
test('seules les structures des listes privées sortent, jamais les valeurs ou identifiants',()=>{
 const r=resumeReceptionLbc({annonces:[{items:{secret:{account:'identifiant-secret',subject:'TITRE_SECRET',images:['https://img.leboncoin.fr/PHOTO_SECRETE']}}}],comptes:[{accounts:{'identifiant-secret':{sessionAt:'date',name:'PSEUDO_SECRET'}}}],traces:[{schemas:{'api.leboncoin.fr/api/adfinder/v2/myads':{at:'2026-10-22T10:00:00Z',cles:['ads[].images.urls[]:string','ads[].subject:string','ads[].MOT_SECRET:string']},'tiers/messages':{cles:['MESSAGE_SECRET']}}}]});
 assert.match(r,/Liste privée observée : oui/);assert.match(r,/ads\[\].images.urls\[\]:string/);
 for(const mot of ['TITRE_SECRET','PHOTO_SECRETE','identifiant-secret','PSEUDO_SECRET','MOT_SECRET','MESSAGE_SECRET'])assert.equal(r.includes(mot),false,mot);
});

test('les ventes ont leur propre date de capture, indépendante du dernier échange du panneau',()=>{
 const r=resumeReceptionLbc({annonces:[],comptes:[],traces:[],transactions:[{ventes:{a:{isSeller:true,at:'2026-10-20T08:00:00Z',price:12345},b:{isSeller:false,at:'2026-10-21T08:00:00Z'}}}]});
 assert.match(r,/Transactions enregistrées : 2 ; ventes confirmées : 1 ; achats confirmés : 1/);assert.match(r,/2026-10-21T08:00:00.000Z/);assert.equal(r.includes('12345'),false);
 assert.match(resumeReceptionLbc({annonces:[],comptes:[],traces:[],transactions:null}),/impossible/);
});
