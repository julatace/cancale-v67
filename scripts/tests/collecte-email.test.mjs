import crypto from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {accuseEmail,empreinteEmail} from '../../api/_lib/accuse-email.js';
import {resoudreProprietaire,estAdresseCollectrice,adressesDeLivraison} from '../../api/_lib/proprietaire-email.js';
const source=fs.readFileSync(new URL('../gmail-forwarder.gs',import.meta.url),'utf8');
function simulation(messages,{reponses={},verrou=true,mauvaisCompte=false,pageReprise='',corbeille=false}={}){
 const lettres=messages.map(x=>({labels:['INBOX'],...x})),proprietes=new Map([['EMAIL_INBOUND_SECRET','cle-fictive']]),envois=[],passages=[],modifications=[],logs=[];let relache=0,factures=0;
 if(pageReprise)proprietes.set('VRM_REPRISE_PAGE',pageReprise);
 const res=(code,j)=>({getResponseCode:()=>code,getContentText:()=>typeof j==='string'?j:JSON.stringify(j)});
 const s={console,Date,JSON,Math,encodeURIComponent,Logger:{log:v=>logs.push(v)},LockService:{getScriptLock:()=>({tryLock:()=>verrou,hasLock:()=>verrou,releaseLock:()=>relache++})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>proprietes.get(k),setProperty:(k,v)=>proprietes.set(k,v),deleteProperty:k=>proprietes.delete(k)})},ScriptApp:{getOAuthToken:()=> 'jeton-google-fictif'},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(alg,value)=>[...crypto.createHash('sha256').update(value).digest()],base64Encode:b=>Buffer.from(b).toString('base64'),newBlob:v=>({getBytes:()=>Buffer.from(v)})},GmailApp:{getUserLabelByName:n=>({getId:()=>n}),createLabel:n=>({getId:()=>n}),getMessageById:id=>{const m=lettres.find(x=>x.id===id);return {getId:()=>id,getHeader:n=>({'Message-ID':m.messageId||'<'+id+'>','Delivered-To':'vrm.vinted35@gmail.com','X-Original-To':'acheteur@example.test'})[n]||'',getFrom:()=>m.from||'Vinted <noreply@vinted.fr>',getTo:()=> 'acheteur@example.test',getCc:()=>'',getSubject:()=>m.sujet||'Ton reçu pour la commande',getPlainBody:()=> 'Reçu original',getBody:()=>'<p>Reçu original</p>',getDate:()=>new Date('2026-10-21T10:00:00Z'),getAttachments:()=>[{getName:()=> 'recu.pdf',getContentType:()=> 'application/pdf',getBytes:()=>Buffer.from('PDF de test')}]};}}};
 s.UrlFetchApp={fetch:(url,opt={})=>{
  const u=new URL(url);
  if(u.hostname==='gmail.googleapis.com'){
   assert.equal(opt.headers.Authorization,'Bearer jeton-google-fictif');const p=u.pathname.replace('/gmail/v1/users/me/','');
   if(p==='profile')return res(200,{emailAddress:mauvaisCompte?'autre@example.test':'vrm.vinted35@gmail.com'});
   if(p==='messages'){
    const q=u.searchParams.get('q')||'';let xs=lettres;
    if(q.includes('from:forwarding-noreply'))xs=xs.filter(x=>x.configuration&&!x.labels.includes('vrm-configuration'));
    else if(q.includes('before:'))xs=xs.filter(x=>x.ancien&&x.labels.includes('vrm-confirme-v2')&&x.labels.includes('INBOX')&&!x.labels.includes('vrm-a-verifier')&&!x.labels.includes('vrm-a-reessayer'));
    else xs=xs.filter(x=>!x.configuration&&!x.labels.includes('vrm-traite')&&(q.includes('-label:vrm-a-reessayer')?!x.labels.includes('vrm-a-reessayer'):x.labels.includes('vrm-a-reessayer')));
    const debut=Number(u.searchParams.get('pageToken')||0),max=Number(u.searchParams.get('maxResults'))||50;
    return res(200,{messages:xs.slice(debut,debut+max).map(x=>({id:x.id})),...(xs.length>debut+max?{nextPageToken:String(debut+max)}:{})});
   }
   const m=/^messages\/([^/]+)\/(modify|trash)$/.exec(p);assert.ok(m,'destination Gmail attendue : '+p);const x=lettres.find(x=>x.id===decodeURIComponent(m[1]));assert.ok(x);const corps=JSON.parse(opt.payload);modifications.push({id:x.id,...corps});if(m[2]==='trash')x.labels.push('TRASH');else{x.labels=x.labels.filter(l=>!(corps.removeLabelIds||[]).includes(l));for(const l of corps.addLabelIds||[])if(!x.labels.includes(l))x.labels.push(l);}return res(200,{id:x.id});
  }
  assert.equal(u.hostname,'vrm.center');assert.equal(u.searchParams.has('key'),false);assert.equal(opt.headers['x-vrm-email-key'],'cle-fictive');const payload=JSON.parse(opt.payload);if(u.searchParams.get('mode')==='reception-passage'){passages.push(payload);return res(200,{ok:true});}envois.push(payload);let r=reponses[payload.sourceMessageId];if(r?.dynamique)r={code:200,body:{ok:true,quarantaine:true,reception:{messageId:payload.messageId,stocke:true,empreinte:empreinteEmail(payload),classement:'a-verifier'}}};r=r||{code:200,body:{ok:true,type:'achat',reception:{messageId:payload.messageId,stocke:true,empreinte:empreinteEmail(payload),classement:'achat'}}};return res(r.code,r.body);
 }};
 vm.createContext(s);vm.runInContext(corbeille?source.replace("const CLEANUP_MODE = 'archive'","const CLEANUP_MODE = 'corbeille'"):source,s);vm.runInContext('sendQueuedInvoices=()=>{__factures();};',Object.assign(s,{__factures:()=>factures++}));vm.runInContext('forwardVintedEmails();',s);
 return {lettres,envois,passages,modifications,proprietes,logs,relache,factures};
}
test('la boîte collective ne désigne aucun vendeur, même si enregistrée par un propriétaire',()=>{
 const reg={'vrm.vinted35@gmail.com':{owner:'A'},'client@example.test':{owner:'B'}};
 assert.equal(resoudreProprietaire(['vrm.vinted35@gmail.com'],reg,'A').owner,'');assert.equal(resoudreProprietaire(['vrmvinted35+client@googlemail.com'],reg,'A').owner,'');
 assert.equal(resoudreProprietaire(['client@example.test','vrm.vinted35@gmail.com'],reg,'A').owner,'B');assert.equal(resoudreProprietaire(['inconnu@example.test','vrm.vinted35@gmail.com'],{'ancien@example.test':{owner:'A'}},'A').owner,'');assert.equal(estAdresseCollectrice('VRM.VINTED35+test@gmail.com'),true);
 assert.ok(adressesDeLivraison({headers:{'x-original-to':'client@example.test'}},{}).includes('client@example.test'));
});
test('accusé nominatif : stockage déclaré, identité exacte et classement à vérifier',()=>{
 assert.equal(accuseEmail('x',{ok:false}),null);assert.equal(accuseEmail('',{ok:true}),null);assert.equal(accuseEmail('x',{ok:true,type:'achat'},empreinteEmail({})).messageId,'x');assert.equal(accuseEmail('x',{ok:true,quarantaine:true},empreinteEmail({})).classement,'a-verifier');assert.equal(accuseEmail('x',{ok:false,garde:true},empreinteEmail({})).stocke,true);
});
test('un nouveau message du même fil est transmis seul, avec ses pièces jointes et destinataires',()=>{
 const r=simulation([{id:'ancien',fil:'meme',labels:['INBOX','vrm-traite'],ancien:true},{id:'nouveau',fil:'meme',ancien:true}]);assert.equal(r.envois.length,1);const p=r.envois[0];assert.equal(p.sourceMessageId,'nouveau');assert.equal(p.to,'acheteur@example.test');assert.equal(p.deliveredTo,'vrm.vinted35@gmail.com');assert.equal(Buffer.from(p.attachments[0].content,'base64').toString(),'PDF de test');assert.ok(r.lettres[1].labels.includes('vrm-confirme-v2'));assert.ok(!r.lettres[1].labels.includes('INBOX'));assert.ok(r.lettres[0].labels.includes('INBOX'),'un ancien label seul ne suffit pas au nouveau ménage');assert.equal(r.factures,1,'le flux Pro préexistant est conservé sans ajout de destinataire');assert.equal(r.relache,1);
});
test('200 sans accusé, faux identifiant, JSON illisible et 503 : aucun archivage ni preuve',()=>{
 const reponses={a:{code:200,body:{ok:true}},b:{code:200,body:{reception:{stocke:true,messageId:'autre'}}},c:{code:200,body:'<html>erreur</html>'},d:{code:503,body:{ok:false}},e:{code:200,body:{ok:true,reception:{stocke:true,messageId:'<e>',empreinte:'0'.repeat(64)}}}};const r=simulation(['a','b','c','d','e'].map(id=>({id,ancien:true})),{reponses});assert.equal(r.envois.length,5);for(const m of r.lettres){assert.ok(m.labels.includes('INBOX'));assert.ok(m.labels.includes('vrm-a-reessayer'));assert.ok(!m.labels.includes('vrm-traite'));}assert.equal(r.relache,1);
});
test('quarantaine confirmée rangée sous à vérifier, confirmation Google jamais validée automatiquement',()=>{
 const r=simulation([{id:'q'},{id:'confirmation',configuration:true}],{reponses:{q:{dynamique:true}}});assert.ok(r.lettres[0].labels.includes('vrm-a-verifier'));assert.ok(r.lettres[1].labels.includes('vrm-configuration'));assert.ok(r.lettres[1].labels.includes('INBOX'));assert.equal(r.envois.length,1);
});
test('verrou ou mauvais compte Google : aucun transfert',()=>{assert.equal(simulation([{id:'a'}],{verrou:false}).envois.length,0);const r=simulation([{id:'a'}],{mauvaisCompte:true});assert.equal(r.envois.length,0);assert.match(r.logs.join(' '),/compte|installé/);});
test('volume borné : 80 nouveaux messages au maximum, les suivants restent à traiter',()=>{
 const r=simulation(Array.from({length:125},(_,i)=>({id:'m'+i})));assert.equal(r.envois.length,80);assert.equal(r.lettres.filter(x=>!x.labels.includes('vrm-traite')).length,45);
});

test('les reprises sont paginées et ne bloquent pas les nouveaux messages',()=>{
 const anciens=Array.from({length:25},(_,i)=>({id:'r'+i,labels:['INBOX','vrm-a-reessayer']}));
 const reponses=Object.fromEntries(anciens.map(x=>[x.id,{code:503,body:{ok:false}}]));
 const premier=simulation([{id:'nouveau'},...anciens],{reponses});assert.equal(premier.envois.length,21);assert.ok(premier.lettres[0].labels.includes('vrm-traite'));assert.equal(premier.proprietes.get('VRM_REPRISE_PAGE'),'20');
 const suivant=simulation(anciens,{reponses,pageReprise:'20'});assert.equal(suivant.envois.length,5);assert.equal(suivant.envois[0].sourceMessageId,'r20');assert.equal(suivant.proprietes.has('VRM_REPRISE_PAGE'),false);
});
test('la copie publique du script ne diverge pas de la source',()=>{assert.equal(fs.readFileSync(new URL('../../public/VRM-gmail-forwarder.gs',import.meta.url),'utf8'),source);});

test('le collecteur signale un passage même sans email, sans donnée personnelle',()=>{const r=simulation([]);assert.deepEqual(r.passages.map(p=>p.etat),['debut','succes']);assert.deepEqual(Object.keys(r.passages[0]),['etat']);});
test('un échec de réception signale une difficulté sans confirmer les emails',()=>{const r=simulation([{id:'ko'}],{reponses:{ko:{code:503,body:{ok:false}}}});assert.equal(r.passages.at(-1).etat,'erreur');assert.ok(!r.lettres[0].labels.includes('vrm-confirme-v2'));});
test('les messages à vérifier sont exclus de l’archivage même anciens et confirmés',()=>{const r=simulation([{id:'q',ancien:true,labels:['INBOX','vrm-traite','vrm-confirme-v2','vrm-a-verifier']}]);assert.ok(r.lettres[0].labels.includes('INBOX'));assert.equal(r.modifications.length,0);});

test('le mode corbeille ne supprime rien sans certification documentaire',()=>{const r=simulation([{id:'ancien-confirme',ancien:true,labels:['INBOX','vrm-traite','vrm-confirme-v2']}],{corbeille:true});assert.ok(r.lettres[0].labels.includes('INBOX'));assert.ok(!r.lettres[0].labels.includes('TRASH'));assert.equal(r.modifications.length,0);assert.match(r.logs.join(' '),/suppression désactivée/);});

function installation({refusCreation=false,refusDiagnostic=false}={}){
 const anciens=[{id:'ancien',getHandlerFunction:()=> 'forwardVintedEmails'},{id:'autre',getHandlerFunction:()=> 'autreFonction'}],evenements=[];
 const chaine={timeBased(){return this;},everyMinutes(n){evenements.push(['minutes',n]);return this;},create(){evenements.push(['creation']);if(refusCreation)throw Error('quota');return {};}};
 const ctx=vm.createContext({Logger:{log(){}},verifierInstallationVRM:()=>{evenements.push(['diagnostic']);if(refusDiagnostic)throw Error('diagnostic');},ScriptApp:{getProjectTriggers:()=>anciens,newTrigger:nom=>{assert.equal(nom,'forwardVintedEmails');return chaine;},deleteTrigger:t=>evenements.push(['suppression',t.id])}});
 vm.runInContext(source.slice(source.indexOf('function installerVRM('),source.indexOf('function preparerCleReceptionVRM(')),ctx);
 let erreur;try{ctx.installerVRM();}catch(e){erreur=e.message;}return {evenements,erreur};
}
test('installation une minute : création avant retrait des anciens, autre fonction préservée',()=>{
 const r=installation();assert.equal(r.erreur,undefined);assert.deepEqual(r.evenements,[['diagnostic'],['minutes',1],['creation'],['suppression','ancien']]);
});
test('installation refusée : le déclencheur existant ne disparaît pas',()=>{
 for(const options of [{refusCreation:true},{refusDiagnostic:true}]){const r=installation(options);assert.ok(r.erreur);assert.equal(r.evenements.some(e=>e[0]==='suppression'),false);}
});
