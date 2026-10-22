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

test('les traces distinguent une réponse HTTP refusée et les dates anciennes, sans URL ni identifiant sensible',()=>{
 const r=resumeReceptionLbc({annonces:[],comptes:[{accounts:{secret:{sessionAt:'2026-10-22T10:00:00Z'}}}],traces:[{updatedAt:'2026-10-22T10:00:00Z',paths:['GET api.leboncoin.fr/api/adfinder/v2/myads?token=SECRET → 403 [application/json]','GET api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/987654 → 200 [application/json]','POST autre.test/SECRET → 200','GET www.leboncoin.fr/_next/data/BUILD_SECRET/compte/part/mes-annonces.json → 200'],schemas:{'api.leboncoin.fr/api/consumergoods/proxy/v2/pages/transactions/987654':{at:'2026-10-07T06:28:09Z',cles:['pageProps.data.is_seller:boolean']}}}]});
 assert.match(r,/myads → HTTP 403/);assert.match(r,/compte\/part\/mes-annonces.json → HTTP 200/);assert.match(r,/transactions\/\{id\} → HTTP 200/);assert.match(r,/2026-10-07T06:28:09.000Z/);assert.match(r,/2026-10-22T10:00:00.000Z/);
 for(const secret of ['SECRET','BUILD_SECRET','987654','autre.test'])assert.equal(r.includes(secret),false,secret);
});
