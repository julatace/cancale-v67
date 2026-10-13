const assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const {verifierEvenementEbay}=await import('../api/_lib/agent-evenements.js');
 const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const pem=publicKey.export({type:'spki',format:'pem'});
 const p={metadata:{topic:'MARKETPLACE_ACCOUNT_DELETION'},notification:{data:{username:'client',eiasToken:'identite-factice'}}};
 const brut=Buffer.from(JSON.stringify(p,null,2));
 const entete=b=>Buffer.from(JSON.stringify({alg:'ecdsa',kid:'cle-test',signature:crypto.sign('sha1',b,privateKey).toString('base64'),digest:'SHA1'})).toString('base64');
 const lire=async()=>({status:200,pem});
 assert((await verifierEvenementEbay(brut,entete(brut),lire)).ok);
 assert((await verifierEvenementEbay(brut,entete(Buffer.from(JSON.stringify(p))),lire)).ok);
 assert.equal((await verifierEvenementEbay(Buffer.from(brut.toString().replace('client','pirate')),entete(brut),lire)).status,412);
 let appels=0;
 assert.equal((await verifierEvenementEbay(brut,'pas-base64',async()=>{appels++;})).status,412);assert.equal(appels,0);
 assert.equal((await verifierEvenementEbay(brut,entete(brut),async()=>({status:500}))).status,500);
 assert.equal((await verifierEvenementEbay(brut,entete(brut),async()=>({status:412}))).status,412);
 // Vecteur signé du SDK officiel : évite d'inventer un contrat dans nos mocks.
 const v=require('./_ebay-signature-sdk.json');
 assert((await verifierEvenementEbay(Buffer.from(JSON.stringify(v.message)),v.signature,async()=>({status:200,pem:v.response.key}))).ok);
 process.env.EBAY_APP_ID='FAUX_APP';process.env.EBAY_CERT_ID='FAUX_CERT';delete process.env.SUPABASE_SERVICE_KEY;
 let lectures=0;
 global.fetch=async url=>{
   if(String(url).includes('/oauth2/token')) return {ok:true,json:async()=>({access_token:'FAUX_JETON',expires_in:7200})};
   if(String(url).includes('/public_key/')) {lectures++;return {ok:true,status:200,json:async()=>({key:pem})};}
   throw Error('URL inattendue dans le banc');
 };
 assert((await verifierEvenementEbay(brut,entete(brut))).ok);
 for(let i=0;i<50;i++) {
   const sig={alg:'ecdsa',digest:'SHA1',kid:'forge-'+i,signature:crypto.sign('sha1',Buffer.from('autre corps'),privateKey).toString('base64')};
   assert.equal((await verifierEvenementEbay(brut,Buffer.from(JSON.stringify(sig)).toString('base64'))).status,412);
 }
 assert(lectures<=10);assert((await verifierEvenementEbay(brut,entete(brut))).ok);
 console.log('✅ Signatures eBay : corps brut et SDK, falsification refusée, pas de lecture sur en-tête illisible.');
})().catch(e=>{console.error(e);process.exitCode=1;});
