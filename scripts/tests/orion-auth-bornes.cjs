// Vrai moteur, services simulés : ni mot de passe conservé, ni onglet VRM requis.
const assert=require('assert/strict'),{faireFond}=require('../_fond-vm.cjs');
(async()=>{
 for(const mode of ['reseau-muet','corps-muet','refus-reseau']){
  const f=faireFond({store:{__sansSession:true}});
  f.ctx.fetch=mode==='reseau-muet'?()=>new Promise(()=>{}):mode==='corps-muet'?async()=>({ok:true,json:()=>new Promise(()=>{})}):async()=>{throw Error('Réseau');};
  const r=await f.ctx.authLogin('vendeur@example.test','secret-fictif');assert.equal(r.ok,false);assert.equal(f.store.vrmSession,undefined);assert.match(r.error,/réessaie|Réessaie/);
 }
 const f=faireFond({store:{__sansSession:true},onglets:[{id:1,url:'https://www.vinted.fr/'}]});let ouvertures=0;f.ctx.ouvrirVRMDepuis=()=>ouvertures++;
 f.ctx.fetch=async()=>({ok:true,json:async()=>({access_token:'jeton-fictif',refresh_token:'renouvellement-fictif',expires_in:3600,user:{id:'vendeur-fictif',email:'vendeur@example.test'}})});
 const r=await f.envoyer({from:'cancale-popup',action:'authLogin',email:'vendeur@example.test',password:'secret-fictif',ouvrir:false},{tab:{id:1,url:'https://www.vinted.fr/'}});
 assert.equal(r.ok,true);assert.equal(f.store.vrmSession.user_id,'vendeur-fictif');assert.equal(ouvertures,0);assert.equal(JSON.stringify(f.store).includes('secret-fictif'),false);
 console.log('OK : délais réseau/corps bornés, connexion autonome rangée, aucun mot de passe conservé et aucun onglet VRM ouvert.');
})().catch(e=>{console.error(e);process.exitCode=1;});
