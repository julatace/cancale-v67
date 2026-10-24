// Real background/exec/HTTP functions; only transport, cookies and session are
// fixtures. Absolutely no real marketplace traffic.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const scripts=path.resolve(__dirname,'..');
let prefix=fs.readFileSync(path.join(scripts,'audit-exec.cjs'),'utf8').split('const REPONSE =')[0];
prefix=prefix.split('\n').filter(l=>!l.includes('ctx.vintedSend =')&&!l.includes('ctx.vintedGet =')).join('\n');
const bac={require,__dirname:scripts,console,setTimeout,clearTimeout,clearInterval,URL,TextDecoder,TextEncoder,Buffer};
vm.runInNewContext(prefix+'\nglobalThis.creer=faireCtx;',bac);
const UID='3175765377',jeton='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
let controles=0;const check=(v,m)=>{assert.ok(v,m);controles++;};
function contexte(options={}){
 const f=bac.creer(),appels=[];let connecte=UID;
 Object.assign(f.ctx,{AbortSignal,authToken:async()=>({access_token:'session-fictive'}),compteConnecte:async()=>connecte,pauseVinted:async()=>null});
 f.ctx.fetch=async(url,o={})=>{
  appels.push({url,o});let j,status=200;
  if(url.startsWith('https://vrm.center/')){
   const c=JSON.parse(o.body);assert.ok(['consommer','verifier'].includes(c.action));assert.equal(c.jeton,jeton);
   if(options.grantPerdu)throw Error('transport interrompu');
   if(options.grantRefuse||(options.arreteAvantReponse&&c.action==='verifier'))status=409;
   j={ok:true,autorise:true,uid:UID,travail:{itemId:'101',recipientId:'201',initiator:'native-fixture',message:'Bonjour identique !'}};
  }else{
   assert.ok(url.startsWith('https://www.vinted.fr/'));
   if(url.endsWith('/conversations')){status=options.creationStatus||200;j={conversation:{id:301},code:0};}
   else if(url.endsWith('/conversations/301')){j={conversation:{id:301,opposite_user:{id:options.autreDestinataire?999:201},transaction:{item_id:options.autreArticle?999:101},allow_reply:!options.interdit}};if(options.bascule)connecte='999';}
   else if(url.endsWith('/replies')){if(options.reponsePerdue)throw Error('réponse perdue après départ');status=options.replyStatus||200;j=options.sansAccuse?{}:{code:0};}
   else throw Error('URL inattendue '+url);
  }
  return {ok:status>=200&&status<300,status,json:async()=>j,headers:{get:()=>null}};
 };
 return {...f,appels,envoyer:()=>f.envoyer({uid:UID,method:'POST',endpoint:'/vrm/favoris',body:{jeton}})};
}
(async()=>{
 let c=contexte(),r=await c.envoyer();
 check(r.ok&&r.data.resultat==='envoye','chemin positif : message confirmé après création et lecture du bon fil');
 check(c.appels.length===5,'une consommation, une création, une lecture, une vérification, une réponse');
 const creation=JSON.parse(c.appels[1].o.body),reponse=JSON.parse(c.appels[4].o.body);
 check(JSON.stringify(creation)===JSON.stringify({initiator:'native-fixture',item_id:'101',opposite_user_id:'201'}),'format natif observé, sans champ inventé');
 check(reponse.reply.body==='Bonjour identique !','texte exact de l’autorisation serveur');
 for(const options of [{autreDestinataire:true},{autreArticle:true},{interdit:true},{bascule:true},{grantRefuse:true},{arreteAvantReponse:true},{creationStatus:429},{creationStatus:401}]){
  c=contexte(options);r=await c.envoyer();check(!r.ok,'blocage '+JSON.stringify(options));check(!c.appels.some(x=>x.url.endsWith('/replies')),'aucun message '+JSON.stringify(options));
 }
 for(const options of [{reponsePerdue:true},{sansAccuse:true},{replyStatus:503},{grantPerdu:true}]){
  c=contexte(options);r=await c.envoyer();check(r.data.resultat==='incertain','incertitude explicite '+JSON.stringify(options));check(c.appels.filter(x=>x.url.endsWith('/replies')).length<=1,'aucun rejeu '+JSON.stringify(options));
 }
 c=contexte();r=await c.ctx.executerPourApp({uid:UID,method:'POST',endpoint:'/vrm/favoris',body:{jeton}},{origin:'https://vrm.center.imposteur.invalid'});
 check(!r.ok&&c.appels.length===0,'origine étrangère : aucun grant, aucun Vinted');
 c=contexte();r=await c.ctx.executerPourApp({uid:UID,method:'POST',endpoint:'/api/v2/conversations',body:{item_id:'101',opposite_user_id:'201'}},{origin:'https://vrm.center'});
 check(!r.ok&&c.appels.length===0,'la création native générique reste hors de la liste blanche');
 console.log(controles+' contrôles du vrai moteur extension réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
