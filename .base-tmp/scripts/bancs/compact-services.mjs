import assert from 'node:assert/strict';
import {photoArticle,photoCommande} from '../../src/photosArticles.js';
import {lirePhoto,urlPhotoAdmise} from '../../api/_lib/photos.js';
import compte from '../../api/compte.js';
let n=0;const check=(x,m)=>{assert.ok(x,m);n++;};
const url='https://images1.vinted.net/paire.jpg';
check(photoArticle({photo:url})===url,'photo chaîne');
check(photoArticle({item:{photos:[{url}]}})===url,'photo imbriquée');
check(photoCommande({lineItems:[{legacyItemId:'12'}]},[{itemId:'12',imageUrl:url}])===url,'eBay par identité exacte');
check(!photoCommande({title:'Même paire'},[{title:'Même paire',photo:url}]),'aucun lien par titre');
check(!photoCommande({item_id:12,_acc:{vinted_user_id:'1'}},[{id:12,photo:url,_acc:{vinted_user_id:'2'}}]),'pas de photo autre compte');
check(!photoCommande({item_id:12},[{id:12,photo:url},{id:12,photo:url}]),'ambiguïté refusée');
for(const u of ['http://images1.vinted.net/a','https://vinted.net.evil.test/a','https://127.0.0.1/a','https://user:pass@i.ebayimg.com/a','https://i.ebayimg.com:444/a'])check(!urlPhotoAdmise(u),'adresse refusée');
let calls=[];
let r=await lirePhoto(url,async(u,opts)=>{calls.push([u,opts]);return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});});
check(r.status===200 && r.octets.length===3,'octets reçus');check(!calls[0][1].headers.Authorization,'aucun jeton au CDN');
r=await lirePhoto(url,async()=>new Response('html',{headers:{'content-type':'text/html'}}));check(r.status===415,'html refusé');
calls=[];r=await lirePhoto(url,async u=>{calls.push(u);return new Response('',{status:302,headers:{location:'https://127.0.0.1/private'}});});check(r.status===502 && calls.length===1,'redirection privée refusée');
r=await lirePhoto(url,async()=>new Response(new Uint8Array(6*1024*1024+1),{headers:{'content-type':'image/png'}}));check(r.status===413,'flux trop grand refusé');
const originalFetch=globalThis.fetch;
const res=()=>({code:null,headers:{},status(c){this.code=c;return this;},json(b){this.body=b;},send(b){this.body=b;},setHeader(k,v){this.headers[k]=v;}});
try{
 globalThis.fetch=async()=>{throw new Error('aucun réseau sans session');};
 let out=res();await compte({method:'POST',query:{mode:'photo'},headers:{},body:{url}},out);check(out.code===401,'route exige session');
 globalThis.fetch=async(u,opts)=>u.includes('/auth/v1/user')?new Response(JSON.stringify({id:'11111111-1111-1111-1111-111111111111'}),{headers:{'content-type':'application/json'}}):new Response(new Uint8Array([1,2]),{headers:{'content-type':'image/jpeg'}});
 out=res();await compte({method:'POST',query:{mode:'photo'},headers:{authorization:'Bearer a.b.c'},body:{url}},out);check(out.code===200 && Buffer.isBuffer(out.body),'route photo authentifiée');check(out.headers.Vary==='Authorization','cache privé par session');
}finally{globalThis.fetch=originalFetch;}
// (2 nov.) L'ancien envoi « mise en file » des factures Pro (setProInvoiceStatus) est retiré :
// la facture Pro s'émet et part par api/_lib/facture-pro.js — prouvé par scripts/audit-facture-pro.cjs.
console.log(n+' contrôles photos et factures réussis.');
