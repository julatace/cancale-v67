// Favoris : le lien affiché par la cloche de Vinted n'est pas celui qui est
// enregistré dans la notification. Mesuré le 25 oct. sur la vraie page du vendeur
// (VRM Capture 1.0.0) : le lien cliqué porte receiver_id et item_id, alors que la
// notification enregistrée a la forme /items/{article}/want_it/new?offering_id=…
// (mesuré en lecture seule dans sa base, 21 notifications sur 21).
// Données inventées. Aucun compte réel, aucun message Vinted.
//   SOURCE_FAVORIS_BG=… : lancer sur une autre version du fond (preuve sur l'avant).
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');const {faireFond}=require('../_fond-vm.cjs');
const SRC=process.env.SOURCE_FAVORIS_BG||path.resolve('vinted-sync-extension/background.js');
let n=0,ko=0;const ok=(v,m)=>{if(v){n++;}else{ko++;console.error('❌ '+m);}};
const STOCKE='/items/101/want_it/new?offering_id=201';
const NATIF='/inbox/want_it?receiver_id=201&item_id=101';

async function dom(){
 const src=fs.readFileSync(SRC,'utf8');
 const fn=src.slice(src.indexOf('function suivreFavoriAffiche('),src.indexOf('// Semantic native controls only.'));
 const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 try{
  const p=await b.newPage();await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<main></main>'}));
  await p.goto('https://www.vinted.fr/');await p.addScriptTag({content:fn});
  const cas=async(html,stocke=STOCKE)=>{await p.evaluate(html=>{document.querySelector('main').innerHTML=html;window.clics=[];document.querySelector('main').onclick=e=>{e.preventDefault();window.clics.push(e.target.closest('a')?.getAttribute('href'));};},html);const r=await p.evaluate(u=>{try{return suivreFavoriAffiche(location.origin+u,true);}catch(e){return {erreur:String(e)};}},stocke);return {...r,clics:await p.evaluate(()=>clics)};};
  let r=await cas(`<a data-testid="n" href="${NATIF}">Camille a ajouté ton article en favori</a>`);
  ok(r.trouve===true&&r.clics.length===1,'le lien natif receiver_id/item_id du même article et du même destinataire est suivi');
  ok(r.natif&&r.natif.chemin==='/inbox/want_it'&&r.natif.itemId==='101'&&r.natif.receiverId==='201','le résultat nomme le chemin, l’article et le destinataire natifs');
  r=await cas('<a href="/inbox/want_it?item_id=101&receiver_id=201">ordre inversé</a>');ok(r.trouve===true,'l’ordre des paramètres ne change rien');
  r=await cas('<a href="/inbox/want_it?receiver_id=999&item_id=101">autre</a>');
  ok(r.trouve===false&&r.clics.length===0,'mauvais destinataire : aucun clic');
  ok(r.inspection?.natifsMemeArticle===1&&r.inspection?.natifs===0,'mauvais destinataire : les compteurs le distinguent');
  r=await cas('<a href="/inbox/want_it?receiver_id=201&item_id=102">autre article</a>');ok(r.trouve===false&&r.clics.length===0,'mauvais article : aucun clic');
  r=await cas('<a href="/inbox/want_it?receiver_id=201&receiver_id=201&item_id=101">x</a>');ok(r.trouve===false&&r.clics.length===0,'destinataire dupliqué : refusé');
  r=await cas('<a href="/inbox/want_it?receiver_id=201&item_id=101&item_id=102">x</a>');ok(r.trouve===false&&r.clics.length===0,'articles contradictoires : refusés');
  r=await cas('<a href="/inbox/want_it?receiver_id=201&item_id=101&source=x">x</a>');ok(r.trouve===false&&r.clics.length===0,'un autre paramètre : refusé (rien n’est retiré)');
  r=await cas('<a href="https://evil.invalid/inbox/want_it?receiver_id=201&item_id=101">x</a>');ok(r.trouve===false&&r.clics.length===0,'origine externe : refusée');
  r=await cas('<a href="/settings/delete?receiver_id=201&item_id=101">x</a>');ok(r.trouve===false&&r.clics.length===0,'destination sans rapport : refusée');
  r=await cas(`<a href="${NATIF}">Photo</a><a href="${NATIF}">Texte</a>`);ok(r.trouve===false&&r.clics.length===0&&r.inspection?.natifsVisibles===2,'deux candidats visibles : aucun choix');
  r=await cas(`<a href="${NATIF}" style="display:none">caché</a>`);ok(r.trouve===false&&r.clics.length===0,'lien masqué : refusé');
  r=await cas(`<div aria-hidden="true"><a href="${NATIF}">x</a></div>`);ok(r.trouve===false&&r.clics.length===0,'lien masqué ARIA : refusé');
  r=await cas(`<a href="${NATIF}">x</a>`,'/items/101/want_it/new?offering_id=201&autre=3');ok(r.trouve===false&&r.clics.length===0,'lien enregistré à deux paramètres : aucune équivalence supposée');
  r=await cas('<a href="/inbox/want_it?receiver_id=101&item_id=101">x</a>','/items/101/want_it/new?offering_id=101');ok(r.trouve===false,'destinataire égal à l’article : refusé');
  r=await cas(`<a href="${STOCKE}">exact</a><a href="${NATIF}">natif</a>`);ok(r.trouve===true&&r.clics[0]===STOCKE&&!r.natif,'le lien exact garde la priorité');
  r=await cas(`<a href="${STOCKE}" style="display:none">exact caché</a><a href="${NATIF}">natif</a>`);ok(r.trouve===false&&r.clics.length===0,'un lien exact présent mais masqué n’est pas remplacé par un autre');
 }finally{await b.close();}
}

function fond(mode){
 const f=faireFond({src:SRC,retirer:['scripting']});
 let visible=false,url='https://www.vinted.fr/notifications';const appels=[],lectures=[],creations=[];
 Object.assign(f.ctx,{authToken:async()=>({user_id:'owner-test',access_token:'fixture'}),loadSession:async()=>({user_id:'owner-test'}),compteConnecte:async()=>mode==='compte_change'&&appels.includes('ouvrir')?'222':'111',activeAccountId:async()=>'111',sbGet:async()=>[],supabaseUpsert:async()=>true});
 f.ctx.archiveNotifications=async(uid,o)=>{if(o.lecture)return {owner:'owner-test',data:{archiveVersion:1,uid:'111',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[{id:'n1',body:'Camille a ajouté ton article en favori',link:STOCKE}]}}};if(o.lectureLiee){lectures.push(o.lectureLiee);return {owner:'owner-test',data:{}};}if(o.creation){creations.push(o.creation);return {owner:'owner-test',data:{}};}return null;};
 f.ctx.chrome.tabs.query=async()=>[{id:7,active:true,url}];
 f.ctx.chrome.tabs.get=async()=>({id:7,url});
 f.ctx.chrome.tabs.update=async()=>{};
 const natifPage={chemin:'/inbox/want_it',itemId:'101',receiverId:mode==='natif_faux'?'999':'201'};
 f.ctx.chrome.tabs.sendMessage=(tab,m,cb)=>{
  appels.push(m.action);const rep=resultat=>cb({id:m.id,origine:'https://www.vinted.fr',resultat});
  if(m.action==='sonder')return rep(visible?{trouve:true,natif:natifPage,inspection:{natifs:1,natifsVisibles:1}}:{trouve:false});
  if(m.action==='cloche_sonder')return rep({etat:'disponible'});
  if(m.action==='cloche_ouvrir'){visible=true;return rep({etat:'activee'});}
  if(m.action==='ouvrir'){
   const n=mode==='clic_change'?{...natifPage,receiverId:'202'}:natifPage;
   if(mode==='url_autre')url='https://www.vinted.fr/inbox/want_it?receiver_id=999&item_id=101';
   else if(mode!=='url_fixe')url='https://www.vinted.fr'+NATIF;
   if(mode==='conversation_autre')return f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:999}),null,7).then(()=>rep({trouve:true,natif:n}));
   return rep({trouve:true,natif:n});
  }
  throw Error('action inconnue');
 };
 return {f,appels,lectures,creations};
}

async function worker(){
 const acc={vinted_user_id:'111',domain:'www.vinted.fr'},body={owner:'owner-test',notificationId:'n1'};
 let t=fond('ok'),r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(r.ok&&r.json.preuve==='confirmee','ouverture native confirmée quand l’onglet montre la route de ce destinataire');
 ok(t.lectures.length===1&&t.lectures[0].method==='NAV'&&t.lectures[0].recipientId==='201'&&t.lectures[0].itemId==='101'&&t.lectures[0].contexteFavori.endsWith(STOCKE),'la preuve rangée relie le favori enregistré au destinataire natif');
 ok(t.appels.filter(x=>x==='ouvrir').length===1&&!t.f.j.vinted.length,'un seul clic, aucune requête Vinted ajoutée');
 t=fond('natif_faux');r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(!r.ok&&r.json.code==='favori_destinataire_different'&&!t.appels.includes('ouvrir')&&!t.lectures.length,'un lien natif d’un autre destinataire n’est jamais cliqué');
 t=fond('clic_change');r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(r.json?.preuve!=='confirmee'&&!t.lectures.length,'si la ligne cliquée n’est plus celle sondée, rien n’est rangé');
 t=fond('url_autre');r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(r.json?.preuve==='non_confirmee'&&r.json?.raison==='destinataire_different'&&!t.lectures.length,'l’onglet arrive sur un autre destinataire : refusé');
 t=fond('url_fixe');r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(r.json?.preuve==='non_confirmee'&&r.json?.raison==='navigation_non_confirmee'&&!t.lectures.length,'sans preuve de navigation, rien n’est rangé');
 ok(t.appels.filter(x=>x==='ouvrir').length===1,'sans preuve, aucun clic rejoué');
 t=fond('compte_change');r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(r.json?.preuve!=='confirmee'&&!t.lectures.length,'compte changé pendant l’ouverture : rien n’est rangé');
 t=fond('conversation_autre');r=await t.f.ctx.ouvrirFavoriNatif('111',acc,body);
 ok(r.json?.preuve!=='confirmee'&&!t.creations.length&&!t.lectures.length,'une requête native vers un autre destinataire bloque la confirmation');

 // Le clic du vendeur lui-même dans la cloche (5.229) : même règle d'identité.
 const manuel=async(url,notifs,urlOnglet)=>{
  const t=fond('ok');t.f.ctx.archiveNotifications=async(uid,o)=>{if(o.lecture)return {owner:'owner-test',data:{archiveVersion:1,uid:'111',type:'notifications',domain:'www.vinted.fr',payload:{notifications:notifs}}};if(o.lectureLiee){t.lectures.push(o.lectureLiee);return {owner:'owner-test',data:{}};}return null;};
  t.f.ctx.chrome.tabs.get=async()=>({id:7,url:urlOnglet});
  await t.f.ctx.noterClicFavoriNatif('www.vinted.fr',url,7);return t;
 };
 const N1={id:'n1',body:'Camille a ajouté ton article en favori',link:STOCKE};
 t=await manuel('https://www.vinted.fr'+NATIF,[N1],'https://www.vinted.fr'+NATIF);
 ok(t.lectures.length===1&&t.lectures[0].method==='NAV'&&t.lectures[0].recipientId==='201','clic manuel dans la cloche : la preuve est rangée');
 t=await manuel('https://www.vinted.fr/inbox/want_it?receiver_id=999&item_id=101',[N1],'https://www.vinted.fr/inbox/want_it?receiver_id=999&item_id=101');
 ok(!t.lectures.length,'clic manuel vers un autre destinataire : rien n’est rangé');
 t=await manuel('https://www.vinted.fr'+NATIF,[N1,{...N1,id:'n9',link:STOCKE+'&x=1'}],'https://www.vinted.fr'+NATIF);
 ok(t.lectures.length===1,'une notification à deux paramètres n’entre pas en concurrence');
 t=await manuel('https://www.vinted.fr'+NATIF,[N1,{...N1,id:'n2'}],'https://www.vinted.fr'+NATIF);
 ok(!t.lectures.length,'deux notifications concordantes : aucun choix');
 t=await manuel('https://www.vinted.fr'+NATIF,[N1],'https://www.vinted.fr/notifications');
 ok(!t.lectures.length,'clic manuel sans arrivée sur la page : rien n’est rangé');
 t=await manuel('https://evil.invalid'+NATIF,[N1],'https://www.vinted.fr'+NATIF);
 ok(!t.lectures.length,'clic manuel hors Vinted : ignoré');
}

async function serveur(){
 const {resoudreCiblesFavoris}=await import(path.resolve('api/_lib/favoris-cibles.js'));
 const notif=(id,item,off)=>({id,body:'Camille a ajouté ton article en favori',link:`/items/${item}/want_it/new?offering_id=${off}`});
 const capture={type:'notifications',uid:'111',domain:'www.vinted.fr',payload:{notifications:[notif('n1',101,201),notif('n2',102,202),notif('n3',103,203)]}};
 const trace={uid:'111',method:'POST',path:'/api/v2/conversations',body:JSON.stringify({initiator:'native',item_id:900,opposite_user_id:901})};
 const nav=(item,off,rec=off,p='/inbox/want_it')=>({uid:'111',method:'NAV',path:p,itemId:String(item),recipientId:String(rec),contexteFavori:`https://www.vinted.fr/items/${item}/want_it/new?offering_id=${off}`});
 const essai=(selection,lectures)=>{try{return resoudreCiblesFavoris({uid:'111',capture,trace,selection,lectures});}catch(e){return {refus:e.message,code:e.code};}};
 let r=essai(['n1'],[nav(101,201)]);ok(Array.isArray(r)&&r[0].recipientId==='201','serveur : la preuve de navigation confirme ce favori');
 r=essai(['n1'],[nav(101,201,999)]);ok(!Array.isArray(r),'serveur : un destinataire différent du lien enregistré est refusé');
 r=essai(['n1'],[nav(101,201,201,'/settings/x')]);ok(!Array.isArray(r),'serveur : une destination sans rapport est refusée');
 r=essai(['n2'],[nav(101,201)]);ok(!Array.isArray(r),'serveur : une seule preuve ne vaut pas pour un autre favori');
 r=essai(['n3'],[nav(101,201),nav(102,202)]);ok(Array.isArray(r)&&r[0].recipientId==='203','serveur : deux destinataires natifs distincts établissent le paramètre');
 r=essai(['n1'],[nav(101,201),{uid:'111',method:'GET',path:'/api/v2/conversations/55',conversationId:'55',itemId:'101',recipientId:'999',contexteFavori:'https://www.vinted.fr'+STOCKE}]);
 ok(!Array.isArray(r),'serveur : deux preuves contradictoires bloquent le favori');
}

(async()=>{
 for(const [nom,f] of [['page',dom],['fond',worker],['serveur',serveur]]){try{await f();}catch(e){ko++;console.error('❌ '+nom+' : '+(e?.message||e));}}
 console.log(`${n} contrôles du lien natif des favoris réussis, ${ko} en échec`);
 if(ko)process.exitCode=1;
})();
