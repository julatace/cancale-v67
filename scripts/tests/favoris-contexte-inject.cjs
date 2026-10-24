// Actual MAIN-world hook. Synthetic native requests; never contacts Vinted.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const posts=[],events={};let requetes=0,reponseNative='{"code":0}';
class XHR{open(){}send(){}setRequestHeader(){}addEventListener(){}getResponseHeader(){return'application/json';}}
const ctx={URL,URLSearchParams,Headers,Request,Response,TextDecoder,Promise,Uint8Array,ArrayBuffer,Date,console,XMLHttpRequest:XHR,
 location:{origin:'https://www.vinted.fr',href:'https://www.vinted.fr/items/101/conversation/new?native_target=201#fragment'},
 document:{hidden:false,addEventListener(){},querySelectorAll(){return[];}},setTimeout(){return 1;},clearTimeout(){},setInterval(){},clearInterval(){},
 addEventListener(n,f){(events[n]||=([])).push(f);},postMessage(m){posts.push(m);},fetch:async()=>{requetes++;return new Response(reponseNative,{status:200,headers:{'content-type':'application/json'}});}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(process.env.SOURCE_INJECT||'vinted-sync-extension/inject.js','utf8'),ctx);
const pause=()=>new Promise(r=>setImmediate(r));
const creer=async()=>{posts.length=0;await ctx.fetch('/api/v2/conversations',{method:'POST',body:JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201})});await pause();await pause();return posts.find(p=>p.kind==='writereq');};
const click=(href,trusted=true)=>{for(const f of events.click||[])f({isTrusted:trusted,target:{closest:()=>href?{href}:null}});};
(async()=>{let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
 check(posts.some(p=>p.kind==='injectReady'),'le hook annonce sa disponibilité au relais de pause');
 let r=await creer();check(r.contexteFavori==='https://www.vinted.fr/items/101/conversation/new?native_target=201','la page native ouverte est liée à la requête sans fragment');
 ctx.location.href='https://www.vinted.fr/member/general';r=await creer();check(!r.contexteFavori,'un autre écran ne fournit pas de contexte inventé');
 const lien='https://www.vinted.fr/items/101/conversation/new?native_target=201';click(lien);r=await creer();check(r.contexteFavori===lien,'le clic natif sur la notification est conservé même avant changement de page');
 r=await creer();check(!r.contexteFavori,'le clic est consommé par la première création seulement');
 click(lien,false);r=await creer();check(!r.contexteFavori,'un clic non fiable ne prouve pas le contexte');
 click(lien);click(null);r=await creer();check(!r.contexteFavori,'une autre interaction invalide le clic précédent');
 ctx.location.href='https://evil.invalid/items/101/conversation/new?native_target=201';r=await creer();check(!r.contexteFavori,'aucun contexte hors Vinted');
 ctx.location.href=lien;posts.length=0;const corps=JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201});
 const request=new Request('https://www.vinted.fr/api/v2/conversations',{method:'POST',body:corps});
 const reponse=ctx.fetch(request);ctx.location.href='https://www.vinted.fr/inbox/900';await reponse;await pause();await pause();
 r=posts.find(p=>p.kind==='writereq');check(r?.body===corps&&r.contexteFavori===lien,'un objet Request conserve son corps et le contexte avant redirection');
 check(await request.text()===corps,'la lecture de la copie ne consomme pas le corps original');
 ctx.location.href=lien;posts.length=0;await ctx.fetch(new URL('https://www.vinted.fr/api/v2/conversations'),{method:'POST',body:corps});await pause();await pause();
 r=posts.find(p=>p.kind==='writereq');check(r?.body===corps&&r.contexteFavori===lien,'un objet URL est également observé comme par fetch natif');
 posts.length=0;await ctx.fetch(new Request('https://www.vinted.fr/api/v2/conversations',{method:'POST',body:'x'.repeat(100001)}));await pause();await pause();
 check(!posts.some(p=>p.kind==='writereq'),'un corps Request trop gros ne remplace pas les bonnes preuves');
 ctx.location.href=lien;posts.length=0;const xhr=new ctx.XMLHttpRequest();xhr.open('POST',new URL('https://www.vinted.fr/api/v2/conversations'));xhr.send(corps);r=posts.find(p=>p.kind==='writereq');
 check(r?.body===corps&&typeof r.url==='string'&&r.contexteFavori===lien,'XHR conserve aussi son contexte avec un objet URL');
 posts.length=0;reponseNative=JSON.stringify({conversation:{id:900,item:{id:101},opposite_user:{id:201}}});await ctx.fetch('https://www.vinted.fr/api/v2/conversations/900');await pause();await pause();
 const lu=posts.find(p=>p.kind==='harvest'&&p.type==='conversation');check(lu?.method==='GET'&&lu.httpStatus===200&&lu.id==='900'&&lu.body===reponseNative,'le retour du fil transporte méthode, statut et corps jusqu’au relais');
 check(requetes===11,'aucune requête ajoutée par la capture passive');console.log(n+' contrôles de capture native réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
