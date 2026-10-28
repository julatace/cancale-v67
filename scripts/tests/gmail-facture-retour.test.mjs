import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../gmail-forwarder.gs',import.meta.url),'utf8');
function envoyer({illisible=false,panne=false}={}) {
  const messages=[],accuses=[],logs=[];
  const ctx=vm.createContext({SECRET:'fictif',Logger:{log:v=>logs.push(v)},
    appVRM:mode=>{
      if(mode==='factures')return {ok:!panne,code:panne?503:200,data:{actif:true,factures:[{id:'fictive',number:'TEST',buyerEmail:'client@example.test',html:'facture',retourB64:'JVBERi0=',retourNom:'retour.pdf'}]}};
      accuses.push(mode);return {ok:true};
    },
    Utilities:{base64Decode:()=>{if(illisible)throw Error('décodage');return [37,80,68,70];},newBlob:(bytes,mime,nom)=>({bytes,mime,nom})},
    GmailApp:{sendEmail:(...args)=>messages.push(args)},
  });
  const debut=source.indexOf('function sendQueuedInvoices()');
  const fin=source.indexOf('function envoyerPreuvesAdresse()',debut);
  vm.runInContext(source.slice(debut,fin),ctx);
  ctx.sendQueuedInvoices();
  return {messages,accuses,logs};
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
