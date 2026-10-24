import test from 'node:test';
import assert from 'node:assert/strict';
import {favorisDepuisNotifications,lienFavoriVinted,lireFavorisVinted,formesLiensNotifications} from '../../src/favorisVinted.js';
const favori=(x={})=>({id:'notif-1',body:'<b>Camille</b> a ajout&eacute; ton article à ses favoris.',link:'/inbox/987',user_id:123,updated_at:'2026-10-24T10:00:00Z',illustration:{url:'https://images1.vinted.net/photo.jpeg'},...x});
test('une ligne conserve la notification, sa photo et son vrai lien sans déduire un destinataire',()=>{
 const r=favorisDepuisNotifications({notifications:[favori()],pagination:{total_pages:3}});
 assert.equal(r.lignes.length,1);const x=r.lignes[0];
 assert.equal(x.body,'Camille a ajouté ton article à ses favoris.');assert.equal(x.photo,'https://images1.vinted.net/photo.jpeg');assert.equal(x.lien,'https://www.vinted.fr/inbox/987');assert.equal(x.nom,'');assert.equal(x.user_id,undefined);assert.equal(r.totalPages,3);
});
test('un nom est affiché seulement quand un acteur est explicitement donné, pas via user_id ou user',()=>{
 const r=favorisDepuisNotifications({notifications:[favori({actor:{login:'Camille'}}),favori({id:'notif-2',user:{login:'Mon propre compte'}})]});
 assert.equal(r.lignes[0].nom,'Camille');assert.equal(r.lignes[1].nom,'');
});
test('une offre et un titre qui contient favoris ne deviennent pas des favoris reçus',()=>{
 const r=favorisDepuisNotifications({notifications:[favori(),favori({id:'offre',body:'Une offre sur tes articles favoris'}),favori({id:'achat',body:'Ton article « Les favoris » est vendu'})]});
 assert.equal(r.lignes.length,1);assert.equal(r.autres,2);
});
test('les mêmes identités sont dédupliquées, deux favoris similaires restent deux lignes',()=>{
 const r=favorisDepuisNotifications({notifications:[favori(),favori({updated_at:'2026-10-24T11:00:00Z',is_read:true}),favori({id:'notif-2'})]});
 assert.equal(r.lignes.length,2);assert.equal(r.lignes[0].date,'2026-10-24T11:00:00Z');
});
test('les liens non Vinted et les images non fournies par le CDN sont écartés',()=>{
 for(const u of ['javascript:alert(1)','https://autre.invalid/inbox/1','https://www.vinted.fr.autre.invalid/inbox/1','https://www.vinted.fr/api/v2/conversations/1','http://www.vinted.fr/inbox','https://user:secret@www.vinted.fr/inbox'])assert.equal(lienFavoriVinted(u),null,u);
 const x=favorisDepuisNotifications({notifications:[favori({illustration:{url:'https://autre.invalid/track.png'}})]}).lignes[0];assert.equal(x.photo,null);
});
test('les liens relatifs gardent le pays du compte et un domaine inconnu ne fabrique pas de destination',()=>{
 assert.equal(lienFavoriVinted('/inbox/987','www.vinted.de'),'https://www.vinted.de/inbox/987');
 assert.equal(lienFavoriVinted('/inbox/987',null),null);
});
test('le diagnostic des liens ne révèle ni identifiant, ni pseudo, ni valeur de paramètre',()=>{
 const r=formesLiensNotifications({notifications:[favori({link:'/inbox/987?receiver_id=123456&item_id=654321&pseudo-prive=secret'}),favori({id:'n2',link:'/member/nom-prive'})]});
 const t=JSON.stringify(r);
 for(const secret of ['987','123456','654321','pseudo-prive','secret','nom-prive'])assert.equal(t.includes(secret),false,secret);
 assert.ok(r.formes.some(x=>x.chemin==='/inbox/{identifiant}'&&x.parametres.includes('receiver_id')));
});
test('forme absente et liste vide sont distinctes et le parcours est borné',()=>{
 assert.throws(()=>favorisDepuisNotifications({code:0}));assert.equal(favorisDepuisNotifications({notifications:[]}).lignes.length,0);
 const r=favorisDepuisNotifications({notifications:Array.from({length:2200},(_,i)=>favori({id:String(i)}))});assert.equal(r.lignes.length,2000);assert.equal(r.limite,true);
});
test('la lecture est exacte, propriétaire inclus, et ne fait aucune écriture',async()=>{
 let appel;const owner='owner-test';
 const r=await lireFavorisVinted({uid:'123',owner,ownerActuel:()=>owner,base:'https://base.invalid',headers:{Authorization:'Bearer test'},fetcher:async(url,opts)=>{appel={url,opts};return {ok:true,json:async()=>[{owner,data:{uid:'123',type:'notifications',payload:{notifications:[favori()]}}}]};}});
 assert.equal(r.reception,'recue');const u=new URL(appel.url);assert.equal(u.searchParams.get('id'),'eq.harvest_123_notifications');assert.equal(u.searchParams.get('owner'),'eq.owner-test');assert.equal(appel.opts.method,undefined);
});
test('autre propriétaire, autre compte, erreur et changement de session ne deviennent pas une liste vide',async()=>{
 const owner='owner-test',args={uid:'123',owner,ownerActuel:()=>owner,base:'https://base.invalid',headers:{}};
 for(const row of [{owner:'autre',data:{uid:'123',type:'notifications'}},{owner,data:{uid:'456',type:'notifications'}},{owner,data:{uid:'123',type:'conversation'}}])await assert.rejects(lireFavorisVinted({...args,fetcher:async()=>({ok:true,json:async()=>[row]})}));
 await assert.rejects(lireFavorisVinted({...args,fetcher:async()=>({ok:false})}));
 let actif=owner;await assert.rejects(lireFavorisVinted({...args,ownerActuel:()=>actif,fetcher:async()=>{actif='autre';return {ok:true,json:async()=>[]};}}));
 const vide=await lireFavorisVinted({...args,fetcher:async()=>({ok:true,json:async()=>[]})});assert.equal(vide.reception,'absente');
});
