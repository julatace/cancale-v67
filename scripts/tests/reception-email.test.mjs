import test from 'node:test';
import assert from 'node:assert/strict';
import {lireReceptionEmail} from '../../api/_lib/reception-email.js';
import {etatCollecteur,conflitAdresseCompte} from '../../src/receptionEmail.js';
const NEUTRE='00000000-0000-0000-0000-000000000000';
const rows=[{owner:'A',id:'email_reception_a',data:{subject:'Mail de A',etat:'integre',at:'2026-10-21T12:00:00Z',html:'secret A',pieces:['secret']}},{owner:'B',id:'email_reception_b',data:{subject:'Mail de B',etat:'erreur',at:'2026-10-21T12:02:00Z'}},{owner:NEUTRE,id:'vrm_email_collecteur_succes',data:{at:'2026-10-21T12:01:00Z',secret:'jamais exposé'}},{owner:NEUTRE,id:'vrm_email_collecteur_passage',data:{at:'2026-10-21T12:01:00Z',etat:'succes'}}];
function base(donnees=rows,panne='') {return async(url)=>{
 const u=new URL(url),p=u.searchParams,owner=p.get('owner')?.replace(/^eq\./,''),id=p.get('id')||'';assert.ok(owner,'chaque lecture a un propriétaire explicite');
 if(panne&&(id.includes(panne)||u.pathname.includes(panne)))return new Response('{}',{status:503});
 let r=donnees.filter(x=>x.owner===owner&&(u.pathname.endsWith('/vinted_accounts')?x.vinted_user_id!==undefined:x.id&&(id.startsWith('eq.')?x.id===id.slice(3):id.startsWith('like.')?x.id.startsWith('email_reception_'):id.includes(x.id))));
 if(p.get('select')?.includes('emails:data'))r=r.map(x=>({emails:x.data?.vinted_account_emails,labels:x.data?.vinted_account_labels}));
 return Response.json(r.slice(0,Number(p.get('limit'))||1000));
};}

const lire=(owner,fetcher=base())=>lireReceptionEmail({owner,url:'https://test.invalid',headers:{},fetcher});
test('chaque propriétaire ne voit que son historique ; la télémétrie collective est minimale',async()=>{const [a,b]=await Promise.all([lire('A'),lire('B')]);assert.equal(a.emails.length,1);assert.equal(a.emails[0].subject,'Mail de A');assert.equal(b.emails[0].subject,'Mail de B');assert.equal(a.collecteur.dernierSucces,'2026-10-21T12:01:00.000Z');assert.equal(JSON.stringify(a).includes('secret'),false);assert.equal(a.emails[0].suppressionAutorisee,false);});
test('identité vide ou neutre refusée avant toute lecture',async()=>{for(const owner of ['',NEUTRE])await assert.rejects(lire(owner,()=>{throw Error('lecture interdite');}),/connexion-requise/);});
test('une panne sur n’importe quelle lecture ne devient pas un écran vide ni un collecteur sain',async()=>{for(const p of ['email_reception','email_journal','vrm_email_collecteur'])await assert.rejects(lire('A',base(rows,p)),/reception-indisponible/);});
test('les résultats sont bornés et le dépassement est explicite',async()=>{const d=Array.from({length:110},(_,i)=>({owner:'A',id:'email_reception_'+i,data:{etat:'integre',at:'2026-10-21T12:00:00Z'}}));const r=await lire('A',base(d));assert.equal(r.emails.length,100);assert.equal(r.plus,true);assert.equal(r.attenteMesurable,false);});
test('aucun historique n’invente une réussite ; les anciennes entrées restent une référence de date',async()=>{const r=await lire('A',base([]));assert.equal(r.dernierEmail,null);assert.equal(etatCollecteur(r.collecteur).etat,'inconnu');});
test('arrêt, erreur, passage en cours et horodatage futur sont distingués',()=>{const now=Date.parse('2026-10-21T12:30:00Z');assert.equal(etatCollecteur({dernierSucces:'2026-10-21T12:00:00Z'},now).etat,'alerte');assert.match(etatCollecteur({dernierPassage:'2026-10-21T12:29:00Z',etat:'debut'},now).titre,/cours/);assert.equal(etatCollecteur({dernierPassage:'2026-10-21T12:29:00Z',etat:'erreur'},now).etat,'alerte');assert.equal(etatCollecteur({dernierSucces:'2026-10-21T12:29:00Z'},now).etat,'actif');assert.equal(etatCollecteur({dernierSucces:'2026-10-22T12:00:00Z'},now).etat,'inconnu');});
test('la route refuse les visiteurs et filtre avec l’identité validée, pas un paramètre owner',async()=>{
 const initial=global.fetch;const lectures=[];
 global.fetch=async(url,opts={})=>{
  if(String(url).includes('/auth/v1/user'))return opts.headers.Authorization==='Bearer session-A'?Response.json({id:'A'}):new Response('{}',{status:401});
  if(String(url).includes('select=owner&limit=1'))return Response.json([{owner:'A'}]);
  lectures.push(String(url));return base()(url,opts);
 };
 try{
  const {default:route}=await import('../../api/email-rattacher.js');
  const appeler=async(headers)=>{const r={setHeader(){},status(n){this.code=n;return this;},json(b){this.body=b;}};await route({method:'GET',query:{mode:'reception',owner:'B'},headers},r);return r;};
  assert.equal((await appeler({})).code,401);assert.equal(lectures.length,0);
  const r=await appeler({authorization:'Bearer session-A'});assert.equal(r.code,200);assert.equal(r.body.emails[0].subject,'Mail de A');assert.ok(lectures.every(u=>!u.includes('owner=eq.B')));
 }finally{global.fetch=initial;}
});

test('les adresses déclarées sans email ne sont jamais déclarées en panne',async()=>{const donnees=[...rows,{owner:'A',id:'vrm_email_owners',data:{adresses:{'perso@example.test':{owner:'A'}}}}];const r=await lire('A',base(donnees));assert.deepEqual(r.adresses,[{adresse:'perso@example.test',declaree:true,comptes:[],derniereReception:null}]);});

test('plusieurs comptes et emails restent distincts ; seul le compte explicitement banni reçoit le badge',async()=>{
 const data=[{owner:'A',id:'main',data:{vinted_account_emails:{'11':'un@example.test','22':'deux@example.test','33':'pasdeclare@example.test'}}},{owner:'A',id:'vrm_email_owners',data:{adresses:{'un@example.test':{},'deux@example.test':{}}}},{owner:'A',id:'panel_comptes_etat',data:{comptes:{'11':{etat:'actif'},'22':{etat:'banni',at:'2026-10-21T10:00:00Z'},'33':{etat:'passu'}}}},{owner:'A',vinted_user_id:'11',login:'vendeur-un'},{owner:'A',vinted_user_id:'22',login:'vendeur-deux'},...['un','deux'].map((x,i)=>({owner:'A',id:'email_reception_'+i,data:{adresses:[x+'@example.test'],etat:'integre',at:'2026-10-21T12:00:00Z'}}))];
 const r=await lire('A',base(data));assert.equal(r.emails[0].compte.nom,'vendeur-un');assert.equal(r.emails[0].compte.bloque,false);assert.equal(r.emails[1].compte.nom,'vendeur-deux');assert.equal(r.emails[1].compte.bloque,true);assert.equal(r.adresses.find(a=>a.adresse==='pasdeclare@example.test').declaree,false);
 data[0].data.vinted_account_emails['44']='un@example.test';const amb=await lire('A',base(data));assert.equal(amb.emails[0].compte,null);assert.equal(amb.emails[0].compteAmbigu,true);
});
test('étiquette plus : l’adresse exacte déclarée garde la priorité sur l’adresse de base',async()=>{
 const data=[{owner:'A',id:'vrm_email_owners',data:{adresses:{'perso@example.test':{},'perso+deux@example.test':{}}}},{owner:'A',id:'main',data:{vinted_account_emails:{'1':'perso@example.test','2':'perso+deux@example.test'}}},{owner:'A',id:'email_reception_x',data:{adresses:['perso+deux@example.test'],etat:'integre'}}];
 const r=await lire('A',base(data));assert.equal(r.emails[0].compte.id,'2');assert.deepEqual(r.emails[0].adresses,['perso+deux@example.test']);
});

test('une adresse ne peut pas être saisie sur deux comptes, sans empêcher la correction du compte actuel',()=>{const m={'1':'Perso@Example.test','2':'autre@example.test'};assert.equal(conflitAdresseCompte(m,'2',' perso@example.test '),'1');assert.equal(conflitAdresseCompte(m,'1','perso@example.test'),null);assert.equal(conflitAdresseCompte(m,'2',''),null);assert.equal(conflitAdresseCompte(m,'2','nouvelle@example.test'),null);});
