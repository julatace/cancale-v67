import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source=fs.readFileSync(process.env.VRM_GMAIL_SOURCE||new URL('../gmail-forwarder.gs',import.meta.url),'utf8');
function envoyer({illisible=false,panne=false,ack=false,erreurEnvoi=false,erreurJournal=false,erreurApresEnvoi=false,occupe=false,recus=0,confirmesAnciens=false}={}) {
  const messages=[],accuses=[],logs=[],proprietes=new Map([['EMAIL_INBOUND_SECRET','fictive']]);let tenu=false;
  for(let i=0;i<recus;i++)proprietes.set('VRM_FACTURE_ENVOI_test'+i,JSON.stringify({etat:confirmesAnciens?'confirme':'prepare',at:Date.now()-91*86400000}));
  const document={id:'fictive',number:'TEST',buyerEmail:'client@example.test',html:'facture',retourB64:'JVBERi0=',retourNom:'retour.pdf'};
  const service=mode=>{
    if(mode==='factures')return {ok:!panne,code:panne?503:200,data:{actif:true,factures:[document]}};
    accuses.push(mode);return {ok:!ack,code:ack?503:200};
  };
  const ctx=vm.createContext({Logger:{log:v=>logs.push(v)},
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>proprietes.get(k),getProperties:()=>Object.fromEntries(proprietes),setProperty:(k,v)=>{if(erreurJournal||(erreurApresEnvoi&&JSON.parse(v).etat==='envoye'))throw Error('quota propriétés');proprietes.set(k,v);},deleteProperty:k=>proprietes.delete(k)})},
    LockService:{getScriptLock:()=>({hasLock:()=>tenu,tryLock:()=>{if(occupe)return false;tenu=true;return true;},releaseLock:()=>{tenu=false;}})},
    Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,v)=>[...crypto.createHash('sha256').update(v).digest()],base64Decode:()=>{if(illisible)throw Error('décodage');return [37,80,68,70];},newBlob:(bytes,mime,nom)=>({bytes,mime,nom})},
    GmailApp:{sendEmail:(...args)=>{messages.push(args);if(erreurEnvoi)throw Error('résultat inconnu');}},
  });
  vm.runInContext(source,ctx);ctx.appVRM=service;
  const bilan=ctx.sendQueuedInvoices();
  return {messages,accuses,logs,proprietes,document,bilan,relancer:()=>ctx.sendQueuedInvoices()};
}
test('la facture contient le formulaire exact avant son accusé d’envoi',()=>{
  const r=envoyer();assert.equal(r.messages.length,1);assert.deepEqual(r.accuses,['facture-envoyee']);
  assert.equal(r.messages[0][3].attachments[0].nom,'retour.pdf');
  assert.match(r.messages[0][2],/formulaire de retour/);
});
test('un formulaire illisible ou une file indisponible ne produit ni email incomplet ni accusé',()=>{
  for(const options of [{illisible:true},{panne:true}]){
    const r=envoyer(options);assert.equal(r.messages.length,0);assert.equal(r.accuses.length,0);assert.ok(r.logs.length);
  }
});

test('clé des propriétés, accusé perdu : un seul email et reprise du seul accusé',()=>{
 const r=envoyer({ack:true});assert.equal(r.messages.length,1);assert.equal(r.bilan.aVerifier,1);
 r.relancer();assert.equal(r.messages.length,1);assert.equal(r.accuses.length,2);
 const recus=[...r.proprietes].filter(([k])=>k.startsWith('VRM_FACTURE_ENVOI_'));
 assert.equal(recus.length,1);assert.equal(JSON.parse(recus[0][1]).etat,'envoye');
 assert.doesNotMatch(recus[0][1],/client@example|facture|JVBER/);
});
test('envoi au résultat inconnu ou journal indisponible : aucun renvoi aveugle',()=>{
 const r=envoyer({erreurEnvoi:true});assert.equal(r.messages.length,1);r.relancer();assert.equal(r.messages.length,1);assert.equal(r.accuses.length,0);
 assert.match(r.logs.join(' '),/renvoi automatique suspendu/);
 const p=envoyer({erreurJournal:true});assert.equal(p.messages.length,0);assert.equal(p.accuses.length,0);
});
test('autre exécution et document modifié ne provoquent pas un nouvel envoi',()=>{
 assert.equal(envoyer({occupe:true}).messages.length,0);
 const r=envoyer({ack:true});r.document.html='autre contenu';r.relancer();assert.equal(r.messages.length,1);assert.equal(r.accuses.length,1);
});

test('interruption après Gmail : le reçu préparé bloque le renvoi, sans faux accusé',()=>{
 const r=envoyer({erreurApresEnvoi:true});assert.equal(r.messages.length,1);assert.equal(r.accuses.length,0);r.relancer();assert.equal(r.messages.length,1);assert.equal(r.accuses.length,0);
});
test('journal borné : les incertains restent, seuls les confirmés anciens sont purgés',()=>{
 const plein=envoyer({recus:1000});assert.equal(plein.messages.length,0);assert.match(plein.logs.join(' '),/journal.*plein/i);
 assert.equal([...plein.proprietes.keys()].filter(k=>k.startsWith('VRM_FACTURE_ENVOI_')).length,1000);
 const ancien=envoyer({recus:1000,confirmesAnciens:true});assert.equal(ancien.messages.length,1);
 assert.equal([...ancien.proprietes.keys()].filter(k=>k.startsWith('VRM_FACTURE_ENVOI_')).length,1);
});
