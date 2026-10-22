import test from 'node:test';import assert from 'node:assert/strict';
import {etatColisDepuisTexte,conserverRetrait,normaliserSuivi} from '../../api/_lib/etat-colis-email.js';
import {achatDuColis} from '../../src/liensColis.js';
const retires=['Votre colis a été retiré par l’acheteur','Vous avez bien récupéré votre colis','Merci d’avoir retiré votre colis','Colis remis au destinataire','Retrait de votre colis confirmé','Votre colis a été livré','Vous avez réceptionné votre colis'];
for(const sujet of retires)test('retrait confirmé : '+sujet,()=>assert.equal(etatColisDepuisTexte(sujet),'delivered'));
for(const sujet of ['Votre colis est prêt à être retiré','Votre colis a été livré en point relais','Votre colis est disponible','Colis livré dans la consigne','Vous n’avez pas encore récupéré votre colis','Votre colis n’a pas été retiré'])test('reste à retirer : '+sujet,()=>assert.equal(etatColisDepuisTexte(sujet),'available'));
test('corps et HTML déjà décodé : sujet neutre, sujet prioritaire et instruction ne sont pas une preuve de retrait',()=>{assert.equal(etatColisDepuisTexte('Mise à jour','Vous avez bien récupéré votre colis.'),'delivered');assert.equal(etatColisDepuisTexte('Colis disponible','Merci d’avoir retiré votre colis précédent.'),'available');assert.notEqual(etatColisDepuisTexte('Informations','Vous pouvez récupérer votre colis avec votre code.'),'delivered');});
test('un rappel tardif ne réactive pas un colis retiré ; un email non compris n’efface pas une disponibilité',()=>{assert.equal(conserverRetrait({status:'delivered'},{status:'available'}).status,'delivered');assert.equal(conserverRetrait({status:'available'},{status:'info'}).status,'available');});
test('photos par suivi ou transaction, jamais par titre ; ambiguïté et suivi absent ne choisissent aucune paire',()=>{const a={transaction_id:'1',_acc:'A',title:'Même article',photo:'un.jpg'},b={transaction_id:'2',_acc:'A',title:'Même article',photo:'deux.jpg'};const idx={'1':{suivi:'AB 123-456789 FR'},'2':{suivi:'ZZ987654321FR'}};assert.equal(achatDuColis({suivi:'AB123456789FR'},[a,b],idx),a);assert.equal(achatDuColis({transaction:'2'},[a,b],idx),b);assert.equal(achatDuColis({artTitle:'Même article'},[a,b],idx),null);assert.equal(achatDuColis({suivi:'AB123456789FR'},[a,b],{'1':idx['1'],'2':idx['1']}),null);assert.equal(normaliserSuivi('AB 123-456789 FR'),'AB123456789FR');});
test('la vraie réception conserve la confirmation et refuse d’écraser un suivi illisible',async()=>{
 process.env.EMAIL_INBOUND_SECRET='test-retrait-secret';process.env.VRM_OWNER_UID='11111111-1111-4111-8111-111111111111';
 const original=global.fetch;let precedent={status:'delivered',subject:'Votre colis a été retiré',receivedAt:'2026-10-20T10:00:00Z',code:'123456'},panne=false;let ecrites=[];
 global.fetch=async(url,opt={})=>{
  const u=new URL(url),id=u.searchParams.get('id')||'';
  if(opt.method==='POST'){const rows=JSON.parse(opt.body);ecrites.push(...rows);return new Response('',{status:201});}
  if(u.searchParams.get('select')==='owner')return Response.json([]);
  if(id==='eq.vrm_email_owners')return Response.json([{owner:process.env.VRM_OWNER_UID,data:{adresses:{'perso@example.test':{}}}}]);
  if(id.startsWith('eq.email_track_'))return panne?new Response('{}',{status:503}):Response.json(precedent?[{data:precedent}]:[]);
  return Response.json([]);
 };
 try{const {default:route}=await import('../../api/email-inbound.js');const appel=async(subject)=>{ecrites=[];const res={setHeader(){},status(n){this.code=n;return this;},json(j){this.body=j;return this;}};await route({method:'POST',headers:{'x-vrm-email-key':process.env.EMAIL_INBOUND_SECRET},body:{messageId:'<test-colis>',from:'noreply@mondialrelay.fr',to:'perso@example.test',subject,text:'Numéro de suivi : 12345678. Code de retrait : 123456',html:'',attachments:[]},query:{}},res);return res;};
  const r=await appel('Votre colis est disponible');assert.equal(r.code,200);const tr=ecrites.find(x=>x.id==='email_track_mondialrelay_12345678');assert.equal(tr.data.status,'delivered');assert.equal(tr.data.subject,precedent.subject);
  precedent={status:'available',code:'123456'};const c=await appel('Votre colis a été retiré par l’acheteur');assert.equal(c.code,200);assert.equal(ecrites.find(x=>x.id==='email_track_mondialrelay_12345678').data.status,'delivered');
  panne=true;const ko=await appel('Votre colis est disponible');assert.equal(ko.code,503);assert.equal(ko.body.reception,undefined);assert.ok(!ecrites.some(x=>x.id.startsWith('email_track_')));
 }finally{global.fetch=original;delete process.env.EMAIL_INBOUND_SECRET;delete process.env.VRM_OWNER_UID;}
});
test('prise en charge et livraison future ne confirment pas le retrait',()=>{
 for(const sujet of ['Votre colis sera livré demain','Nous avons bien reçu votre colis','Colis réceptionné par le transporteur'])assert.equal(etatColisDepuisTexte(sujet),'transit');
});
