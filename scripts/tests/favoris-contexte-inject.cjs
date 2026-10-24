// Actual MAIN-world hook. Synthetic native requests; never contacts Vinted.
const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const posts=[],events={};let requetes=0;
class XHR{open(){}send(){}setRequestHeader(){}addEventListener(){}getResponseHeader(){return'application/json';}}
const ctx={URL,URLSearchParams,Headers,Request,Response,Promise,Uint8Array,ArrayBuffer,Date,console,XMLHttpRequest:XHR,
 location:{origin:'https://www.vinted.fr',href:'https://www.vinted.fr/items/101/conversation/new?native_target=201#fragment'},
 document:{hidden:false,addEventListener(){},querySelectorAll(){return[];}},setTimeout(){return 1;},clearTimeout(){},setInterval(){},clearInterval(){},
 addEventListener(n,f){(events[n]||=([])).push(f);},postMessage(m){posts.push(m);},fetch:async()=>{requetes++;return new Response('{"code":0}',{status:200,headers:{'content-type':'application/json'}});}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('vinted-sync-extension/inject.js','utf8'),ctx);
const pause=()=>new Promise(r=>setImmediate(r));
const creer=async()=>{posts.length=0;await ctx.fetch('/api/v2/conversations',{method:'POST',body:JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201})});await pause();await pause();return posts.find(p=>p.kind==='writereq');};
const click=(href,trusted=true)=>{for(const f of events.click||[])f({isTrusted:trusted,target:{closest:()=>href?{href}:null}});};
(async()=>{let n=0;const check=(v,m)=>{assert.ok(v,m);n++;};
 let r=await creer();check(r.contexteFavori==='https://www.vinted.fr/items/101/conversation/new?native_target=201','la page native ouverte est liée à la requête sans fragment');
 ctx.location.href='https://www.vinted.fr/member/general';r=await creer();check(!r.contexteFavori,'un autre écran ne fournit pas de contexte inventé');
 const lien='https://www.vinted.fr/items/101/conversation/new?native_target=201';click(lien);r=await creer();check(r.contexteFavori===lien,'le clic natif sur la notification est conservé même avant changement de page');
 r=await creer();check(!r.contexteFavori,'le clic est consommé par la première création seulement');
 click(lien,false);r=await creer();check(!r.contexteFavori,'un clic non fiable ne prouve pas le contexte');
 click(lien);click(null);r=await creer();check(!r.contexteFavori,'une autre interaction invalide le clic précédent');
 ctx.location.href='https://evil.invalid/items/101/conversation/new?native_target=201';r=await creer();check(!r.contexteFavori,'aucun contexte hors Vinted');
 check(requetes===7,'aucune requête ajoutée par la capture passive');console.log(n+' contrôles de capture native réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
