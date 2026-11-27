import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import { createRequire as creerRequireSourceApp } from 'node:module';
import { creerMemoCourt } from '../../src/memoCourt.js';
creerRequireSourceApp(import.meta.url)('../_source-app.cjs').brancher(); // (8 nov.) App.jsx découpé : sa lecture texte rend aussi src/ecrans/*.jsx
const src=fs.readFileSync(new URL('../../src/App.jsx',import.meta.url),'utf8');
// (24 nov., vitesse-lectures-toucher) le cache `_repartCache` est devenu `_memoExtras` (src/memoCourt.js, le VRAI, importé) :
// une lecture à la fois, gardée 10 min au MÊME vendeur. On exécute le vrai code : du memo à la fin de `lireExtrasRepartitionNeuve`.
const a=src.indexOf('const _memoExtras = creerMemoCourt('),d=src.indexOf('const lireExtrasRepartitionNeuve = async'),b=src.indexOf('\n};\n',d);
assert.ok(a>=0&&d>a&&b>d,'lireExtrasRepartition introuvable');
const code=src.slice(a,b+4)+'\nglobalThis.lire=lireExtrasRepartition;';
function contexte(gate){let lectures=0;const c={AUTH:{user:{id:'vendeur-A'}},Date,Promise,String,Number,Array,isFinite,creerMemoCourt,TXN_META_SELECT:'transactions',SUPABASE_URL:'https://exemple.test',sbAuth:()=>({}),mapWardrobeItem:x=>x};c.lireTxnMeta=()=>c.lireTout('transactions');c.lireTout=async q=>{lectures++;const qui=c.AUTH.user.id;if(gate)await gate;if(q.includes('country_code'))return[{tx:'1',cc:qui==='vendeur-A'?'FR':'DE'}];if(q.includes('listings'))return[{items:[{id:'annonce-1',brand:'Marque'}]}];return[{tx:'1',item:'annonce-1'}];};c.fetch=async()=>{if(gate)await gate;return{ok:true,json:async()=>[{data:{}}]};};vm.createContext(c);vm.runInContext(code,c);return{c,n:()=>lectures};}
const tour=()=>new Promise(r=>setImmediate(r));
test('le cache des répartitions est réutilisé uniquement pour le même vendeur',async()=>{const{c,n}=contexte();assert.equal((await c.lire()).txn['1'].cc,'FR');await c.lire();assert.equal(n(),3);c.AUTH.user.id='vendeur-B';assert.equal((await c.lire()).txn['1'].cc,'DE');assert.equal(n(),6);});
test('une lecture terminée après changement de vendeur n’expose pas les anciens résultats',async()=>{let reprendre;const gate=new Promise(r=>reprendre=r);const{c}=contexte(gate);const ancien=c.lire();await tour();c.AUTH.user.id='vendeur-B';reprendre();const r=await ancien;assert.equal(r.txn,null);assert.equal(r.items,null);assert.equal((await c.lire()).txn['1'].cc,'DE');});
test('une lecture EN COURS d’un vendeur n’est jamais rejointe par un autre',async()=>{let reprendre;const gate=new Promise(r=>reprendre=r);const{c,n}=contexte(gate);const ancien=c.lire();await tour();c.AUTH.user.id='vendeur-B';const nouveau=c.lire();reprendre();const[ra,rb]=await Promise.all([ancien,nouveau]);assert.equal(ra.txn,null);assert.equal(rb.txn['1'].cc,'DE');assert.equal(rb.owner,'vendeur-B');assert.equal(n(),6);});
