import test from 'node:test';import assert from 'node:assert/strict';
import {pngProfilValide,urlPhotoPublique,verifierUrlPhoto,routeProfilAvatar,lierPhotoAuProfil,routeAvatarPublic} from '../../api/_lib/profil-avatar.js';
import {prendreQuota,empreintePrivee} from '../../api/_lib/stockage-prive.js';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',PID='33333333-3333-4333-8333-333333333333';
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a54cAAAAASUVORK5CYII=';
function basePrivee(){
 const db=new Map();process.env.SUPABASE_SERVICE_KEY='sb_secret_banc_avatar';
 return{db,fetch:async(url,o={})=>{await new Promise(r=>setImmediate(r));const u=new URL(url),q=u.searchParams;if(u.pathname.endsWith('/auth/v1/user'))return Response.json({id:String(o.headers.Authorization).split('.')[1],email:'test@example.test',email_confirmed_at:'2026-10-22'});
  assert.equal(q.get('owner'),'eq.00000000-0000-0000-0000-000000000000');assert.equal(o.headers.apikey,process.env.SUPABASE_SERVICE_KEY);
  const id=q.get('id')?.replace(/^eq\./,'');if(o.method==='POST'){const r=JSON.parse(o.body)[0];assert.equal(r.owner,'00000000-0000-0000-0000-000000000000');if(db.has(r.id))return Response.json([]);db.set(r.id,r.data);return Response.json([{data:r.data}]);}
  if(o.method==='PATCH'){const d=db.get(id),rev=q.get('data->>rev')?.slice(3);if(!d||d.rev!==rev)return Response.json([]);const next=JSON.parse(o.body).data;db.set(id,next);return Response.json([{data:next}]);}
  const rows=[...db.entries()].filter(([k,d])=>id?.startsWith('like.')?k.startsWith('profil_avatar_')&&(!q.get('data->>pid')||d.pid===q.get('data->>pid').slice(3))&&(!q.get('data->>hash')||d.hash===q.get('data->>hash').slice(3))&&(!q.get('data->>partageCarte')||d.partageCarte===true):k===id).map(([,data])=>({data}));return Response.json(rows);
 }};
}
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(j){this.body=j;return this;},end(b){this.body=b;return this;}});
test('photo : format raster borné, dimensions et longueur des blocs vérifiés',()=>{assert.ok(pngProfilValide(PNG));for(const s of ['data:image/svg+xml;base64,PHN2Zz4=','https://evil.test/a.png','data:image/png;base64,PHNjcmlwdD4='])assert.equal(pngProfilValide(s),null);const b=Buffer.from(PNG.slice(22),'base64');b.writeUInt32BE(100000,16);assert.equal(pngProfilValide('data:image/png;base64,'+b.toString('base64')),null);assert.notEqual(empreintePrivee(Buffer.from([255])),empreintePrivee(Buffer.from([254])));});
test('quota partagé : 64 appels entrelacés ne dépassent jamais cinq autorisations',async()=>{const avant=global.fetch,{fetch}=basePrivee();global.fetch=fetch;try{const rs=await Promise.all(Array.from({length:64},()=>prendreQuota('banc-concurrence',{max:5,maintenant:1000})));assert.equal(rs.filter(r=>r.ok).length,5);assert.ok(rs.filter(r=>!r.ok).every(r=>r.reessayer>0));}finally{global.fetch=avant;}});
test('photo facultative : propriétaire imposé par la session, partage explicite et image publique signée',async()=>{const avant=global.fetch,{fetch,db}=basePrivee();global.fetch=fetch;try{
 const appeler=async(owner,method,body)=>{const r=res();await routeProfilAvatar({method,headers:{authorization:`Bearer h.${owner}.sig`},body},r);return r;};
 let r=await appeler(A,'POST',{image:PNG,owner:B,pid:PID});assert.equal(r.code,200);assert.equal(r.body.partageCarte,false);assert.equal(db.get('profil_avatar_'+empreintePrivee(A)).pid,'');assert.equal(db.has('profil_avatar_'+empreintePrivee(B)),false);
 r=await appeler(B,'GET');assert.equal(r.body.image,'');
 await lierPhotoAuProfil(A,PID);assert.equal(db.get('profil_avatar_'+empreintePrivee(A)).pid,'');
 await appeler(A,'POST',{image:PNG,partageCarte:true});await lierPhotoAuProfil(A,PID);
 const hash=empreintePrivee(pngProfilValide(PNG)),url=urlPhotoPublique(PID,hash),q=Object.fromEntries(new URL(url,'https://vrm.center').searchParams);assert.equal(verifierUrlPhoto(q),true);assert.equal(verifierUrlPhoto({...q,pid:B}),false);assert.equal(verifierUrlPhoto({...q,exp:'1000000000000'}),false);
 r=res();await routeAvatarPublic({method:'GET',query:q},r);assert.equal(r.code,200);assert.ok(Buffer.isBuffer(r.body));assert.equal(r.headers['Content-Type'],'image/png');
 await appeler(A,'POST',{image:PNG,partageCarte:false});r=res();await routeAvatarPublic({method:'GET',query:q},r);assert.equal(r.code,404);
 await appeler(A,'POST',{retirer:true});r=await appeler(A,'GET');assert.equal(r.body.image,'');
 }finally{global.fetch=avant;}});
