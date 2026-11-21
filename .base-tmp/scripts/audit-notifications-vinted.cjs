// Vrai inject.js, fetch/XHR simulés. Aucun compte et aucune requête réseau.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(process.env.SOURCE_INJECT||path.join(__dirname,'../vinted-sync-extension/inject.js'),'utf8');
const posts=[],minuteries=[];let appels=0,fixture={status:200,body:JSON.stringify({notifications:[{id:123,user:{id:918273645}}]})};
class XHR{
 constructor(){this.events={};}
 open(method,url){this.method=method;this.url=url;}
 setRequestHeader(){}
 getResponseHeader(){return'application/json';}
 addEventListener(n,f){this.events[n]=f;}
 send(){appels++;this.status=fixture.status;this.responseText=fixture.body;this.events.load?.call(this);}
}
const ctx={URL,Headers,Request,Response,Promise,Uint8Array,ArrayBuffer,Date,console,XMLHttpRequest:XHR,
 location:{origin:'https://www.vinted.fr',href:'https://www.vinted.fr/member/general'},
 document:{hidden:false,addEventListener(){},querySelectorAll(){return[];}},
 setTimeout(f,ms){minuteries.push({f,ms});return minuteries.length;},clearTimeout(){},setInterval(){},clearInterval(){},
 addEventListener(){},postMessage(m){posts.push(m);},
 fetch:async()=>{appels++;return new Response(fixture.body,{status:fixture.status,headers:{'Content-Type':'application/json'}});}
};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);
let verts=0,rouges=0;const check=(c,t)=>{console.log((c?'✅ ':'❌ ')+t);c?verts++:rouges++;};
const pause=()=>new Promise(r=>setImmediate(r));
const vide=()=>{posts.length=0;minuteries.splice(0,minuteries.length);};
const lire=async(url,{method='GET',status=200,xhr=false}={})=>{
 vide();fixture={status,body:JSON.stringify({notifications:[{id:123,user:{id:918273645}}]})};
 const avant=appels;
 if(xhr){const r=new ctx.XMLHttpRequest();r.open(method,url);r.send();assert.equal(r.responseText,fixture.body);}
 else{const r=await ctx.fetch(url,{method});assert.equal(await r.text(),fixture.body);}
 await pause();await pause();
 for(const t of minuteries.splice(0,minuteries.length))if(t.ms===0)t.f();
 check(appels===avant+1,'aucune requête ajoutée par l’observation');
 return posts.filter(x=>x.kind==='harvest'&&x.type==='notifications');
};
(async()=>{
 check(appels===0,'installer le capteur ne lit aucune notification');
 for(const url of ['/api/v2/notifications','/api/v3/user_notifications/?page=1','https://api.vinted.fr/inbox-notifications/v1/notifications?page=1','https://www.vinted.de/inbox-notifications/v2/notifications/']){
  const h=await lire(url);check(h.length===1&&h[0].body===fixture.body,'liste observée et réponse originale préservée : '+url);
 }
 check((await lire('https://api.vinted.fr/inbox-notifications/v1/notifications',{xhr:true})).length===1,'la même liste est captée via XHR');
 for(const [url,options] of [
  ['/inbox-notifications/v1/notifications/unread_count',{}],
  ['/inbox-notifications/v1/notifications',{method:'POST'}],
  ['/inbox-notifications/v1/notifications',{status:403}],
  ['/inbox-notifications/v1/notifications',{status:429,xhr:true}],
  ['https://autre.invalid/inbox-notifications/v1/notifications',{}],
  ['https://vinted.fr.autre.invalid/api/v2/notifications',{}],
  ['http://www.vinted.fr/api/v2/notifications',{}],
  ['/api/v2/notifications/123',{}]
 ])check((await lire(url,options)).length===0,'ne remplace pas une liste par compteur, écriture, refus ou autre site : '+url+' '+JSON.stringify(options));
 await lire('https://api.vinted.fr/inbox-notifications/v1/notifications?token=secret',{status:403});
 const trace=posts.find(x=>x.kind==='seen_urls');
 check(!!trace?.reponses?.['GET /inbox-notifications/v1/notifications']&&trace.reponses['GET /inbox-notifications/v1/notifications'].st===403,'le refus du service hors /api est traçable immédiatement');
 check(!!trace&&!JSON.stringify(trace).includes('secret')&&!JSON.stringify(trace).includes('918273645'),'la trace ne contient ni paramètres ni contenu');
 const {faireFond}=require('./_fond-vm.cjs');
 const fond=faireFond();
 const corps=JSON.stringify({notifications:[{id:'900001',conversation_id:'900002',item:{id:'900003'}}]});
 await fond.ctx.storeHarvest('www.vinted.fr','notifications',null,corps);
 check(JSON.stringify(fond.lignes.harvest_111_notifications?.payload)===corps,'le vrai fond conserve le corps observé sous le compte capté');
 check(fond.lignes.harvest_111_notifications?.type==='notifications'&&fond.lignes.harvest_111_notifications?.uid==='111','le type et le compte restent attachés à la capture');
 const sansSession=faireFond({store:{__sansSession:true}});
 await sansSession.ctx.storeHarvest('www.vinted.fr','notifications',null,corps);
 check(!sansSession.lignes.harvest_111_notifications,'aucune capture persistée sans propriétaire VRM authentifié');
 console.log(`${verts} verts, ${rouges} rouges`);if(rouges)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
