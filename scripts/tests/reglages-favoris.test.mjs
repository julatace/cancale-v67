import test from 'node:test';import assert from 'node:assert/strict';
import {preparerMessageFavori} from '../../src/favorisVinted.js';
import {validerReglagesFavoris,lireReglagesFavoris,sauverReglagesFavoris} from '../../src/reglagesFavoris.js';
const reg={message:'Bonjour, merci pour ton favori !',pourcentage:10,intervalleMinutes:7};
const owner='owner-test',id='vrm_favoris_reglages_123';
const opts=()=>({uid:'123',owner,ownerActuel:()=>owner,base:'https://base.invalid',headers:{Authorization:'Bearer test'}});
const rep=rows=>({ok:true,json:async()=>rows});
test('le pourcentage produit un texte, sans inventer de prix ou modifier le message de base',()=>{
 const r=preparerMessageFavori('Bonjour !','15');assert.equal(r.pourcentage,15);assert.equal(r.message,'Bonjour !\n\nJe te propose une réduction de 15 % sur cet article.');
 assert.equal(preparerMessageFavori('Bonjour !','').message,'Bonjour !');
 assert.equal(preparerMessageFavori('','05').pourcentage,5);
 assert.ok(preparerMessageFavori('','10').message.startsWith('Bonjour !'));
 for(const p of ['0','100','-5','1.5','10 %','abc','Infinity'])assert.ok(preparerMessageFavori('Bonjour',p).erreur,p);
 assert.ok(preparerMessageFavori('a'.repeat(2000),'10').erreur);assert.equal(preparerMessageFavori('a'.repeat(2000),'').message.length,2000);
});
test('cadence entière bornée et aucune activation cachée',()=>{
 for(const intervalleMinutes of [1,6,1440])assert.equal(validerReglagesFavoris({...reg,intervalleMinutes,envoisActifs:true}).envoisActifs,false);
 for(const intervalleMinutes of [0,-1,1441,'7.5','NaN',''])assert.throws(()=>validerReglagesFavoris({...reg,intervalleMinutes}));
 assert.throws(()=>validerReglagesFavoris({...reg,message:null}));
 assert.throws(()=>validerReglagesFavoris({...reg,message:'',pourcentage:null}));
 const d=validerReglagesFavoris(reg);assert.equal(d.message,reg.message);assert.equal(d.pourcentage,10);
});
test('absence des réglages : défaut explicite non enregistré ; lecture exacte par propriétaire',async()=>{
 let appel;const r=await lireReglagesFavoris({...opts(),fetcher:async(url,o)=>{appel={url,o};return rep([]);}});
 assert.equal(r.enregistres,false);assert.equal(r.intervalleMinutes,6);
 const u=new URL(appel.url);assert.equal(u.searchParams.get('id'),'eq.'+id);assert.equal(u.searchParams.get('owner'),'eq.'+owner);assert.equal(appel.o.method,undefined);
});
test('sauvegarde et relecture conservent le message, le taux et la cadence sans doubler la remise',async()=>{
 let row,posts=0;const fetcher=async(url,o)=>{if(o.method==='POST'){posts++;row=JSON.parse(o.body);assert.ok(url.endsWith('on_conflict=owner,id'));assert.equal(row.owner,owner);assert.equal(row.id,id);assert.equal(row.data.envoisActifs,false);return rep([row]);}return rep(row?[row]:[]);};
 await sauverReglagesFavoris({...opts(),fetcher},reg);await sauverReglagesFavoris({...opts(),fetcher},reg);
 const lu=await lireReglagesFavoris({...opts(),fetcher});assert.equal(lu.message,reg.message);assert.equal(lu.pourcentage,10);assert.equal(lu.intervalleMinutes,7);assert.equal(lu.enregistres,true);assert.equal(posts,2);
 assert.equal((preparerMessageFavori(lu.message,lu.pourcentage).message.match(/10 %/g)||[]).length,1);
});
test('autre propriétaire, autre identifiant ou format inconnu : refus, pas de défaut prêt à écraser',async()=>{
 const data=validerReglagesFavoris(reg);
 for(const row of [{id,owner:'autre',data},{id:'autre',owner,data},{id,owner,data:{...data,version:2}},{id,owner,data:{...data,envoisActifs:true}},{id,owner,data:{...data,intervalleMinutes:0}}])await assert.rejects(lireReglagesFavoris({...opts(),fetcher:async()=>rep([row])}));
 await assert.rejects(lireReglagesFavoris({...opts(),fetcher:async()=>({ok:false})}));
});
test('absence de reçu exact ou changement de session : aucune confirmation de sauvegarde',async()=>{
 const data=validerReglagesFavoris(reg);
 for(const rows of [[],[{id,owner:'autre',data}],[{id,owner,data:{...data,pourcentage:15}}]])await assert.rejects(sauverReglagesFavoris({...opts(),fetcher:async()=>rep(rows)},reg));
 let actif=owner;await assert.rejects(sauverReglagesFavoris({...opts(),ownerActuel:()=>actif,fetcher:async()=>{actif='autre';return rep([{id,owner,data}]);}},reg));
 let appels=0;await assert.rejects(sauverReglagesFavoris({...opts(),ownerActuel:()=>'',fetcher:async()=>{appels++;return rep([]);}},reg));assert.equal(appels,0);
});
