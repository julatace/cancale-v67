// Real worker functions, synthetic owned PostgREST and Vinted pages only.
const assert=require('node:assert/strict');const {faireFond}=require('../_fond-vm.cjs');
let controles=0;const check=(v,m)=>{assert.ok(v,m);controles++;};
function creer(){
 const f=faireFond(),rows=new Map(),reseau=[];let owner='owner-A',refus=false,paginationFausse=false;
 Object.assign(f.ctx,{AbortSignal,TextEncoder,authToken:async()=>({user_id:owner,access_token:'fixture-token'}),loadSession:async()=>({user_id:owner}),compteConnecte:async()=> '111'});
 f.ctx.fetch=async(url,o={})=>{
  const u=new URL(url);reseau.push({u,o});const j=(x,s=200)=>({ok:s>=200&&s<300,status:s,json:async()=>x});
  if(u.hostname.endsWith('vinted.fr')){
   assert.equal(u.hostname,'api.vinted.fr');assert.equal(o.method,'GET');if(refus)return j({},429);
   const page=Number(u.searchParams.get('page'));return j({code:0,notifications:[{id:'n'+page,user_id:201,body:'Camille a ajouté ton article à ses favoris.',link:'/items/101/conversation/new',updated_at:'2026-10-24T11:00:00Z'}],pagination:{current_page:paginationFausse?1:page,total_pages:3}});
  }
  assert.ok(u.pathname.endsWith('/app_data'));assert.equal(o.headers.Authorization,'Bearer fixture-token');
  const id=u.searchParams.get('id')?.slice(3);
  if(!o.method||o.method==='GET'){const row=rows.get(id);await new Promise(r=>setImmediate(r));return j(row?[structuredClone(row)]:[]);}
  if(o.method==='POST'){const row=JSON.parse(o.body);if(rows.has(row.id))return j({},409);rows.set(row.id,row);return j(null,201);}
  assert.equal(o.method,'PATCH');const row=rows.get(id);assert.equal(u.searchParams.get('owner'),'eq.owner-A');
  const cond=u.searchParams.get('data->>archiveRev');if(cond!=='eq.'+row.data.archiveRev)return j([]);
  row.data=JSON.parse(o.body).data;return j([{id}]);
 };
 return {...f,rows,reseau,setOwner:x=>owner=x,setRefus:x=>refus=x,setPaginationFausse:x=>paginationFausse=x};
}
const notif=i=>({id:'n'+i,body:'Camille a ajouté ton article à ses favoris.',user_id:201,link:'/items/101/conversation/new',updated_at:'2026-10-24T11:00:00Z'});
(async()=>{
 let f=creer();
 const s=await f.ctx.archiveNotifications('111',{payload:{notifications:[notif(0)]},domain:'www.vinted.fr',url:'https://api.vinted.fr/inbox-notifications/v1/notifications?page=1'});check(!!s,'archive initiale confirmée');
 const rs=await Promise.all([1,2,3,4].map(i=>f.ctx.archiveNotifications('111',{payload:{notifications:[notif(i)]},domain:'www.vinted.fr',url:null})));
 check(rs.every(Boolean),'captures concurrentes toutes confirmées');check(f.rows.get('harvest_111_favoris_archive').data.payload.notifications.length===5,'aucune page concurrente ne remplace les autres');
 const cycle='a'.repeat(8)+'-aaaa-4aaa-8aaa-'+ 'a'.repeat(12),acc={vinted_user_id:'111',domain:'www.vinted.fr',access_token:'vinted-fixture'};
 for(let page=1;page<=3;page++){const r=await f.ctx.lirePageFavoris('111',acc,{cycle,nouveau:page===1});check(r.ok&&r.json.pagesLues===page,'page '+page+' persistée');if(page===3)check(r.json.complete,'toutes les pages confirmées');}
 check(f.reseau.filter(x=>x.u.hostname.endsWith('vinted.fr')).every(x=>x.o.method==='GET'),'aucune écriture Vinted pendant le chargement');
 f.setRefus(true);const avant=f.rows.get('harvest_111_favoris_archive').data.payload.notifications.length;
 const ko=await f.ctx.lirePageFavoris('111',acc,{cycle:'b'+cycle.slice(1),nouveau:true});check(!ko.ok,'429 interrompt la lecture');check(f.rows.get('harvest_111_favoris_archive').data.payload.notifications.length===avant,'429 ne vide pas l’archive');
 f=creer();await f.ctx.archiveNotifications('111',{payload:{notifications:[notif(0)]},domain:'www.vinted.fr',url:'https://api.vinted.fr/inbox-notifications/v1/notifications?page=1'});f.setPaginationFausse(true);
 await f.ctx.lirePageFavoris('111',acc,{cycle,nouveau:true});const faux=await f.ctx.lirePageFavoris('111',acc,{cycle,nouveau:false});check(!faux.ok,'une API qui ignore le numéro de page n’est pas déclarée complète');
 check(f.ctx.sourceNotificationsFavoris('https://evil.invalid/inbox-notifications/v1/notifications','www.vinted.fr')===null,'source étrangère refusée');
 f.setOwner('owner-B');check(await f.ctx.archiveNotifications('111',{payload:{notifications:[]},ownerAttendu:'owner-A'})===null,'changement de propriétaire : aucune archive transférée');
 f=creer();const contexte='https://www.vinted.fr/items/101/conversation/new?native_target=201';
 await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201}),contexte);
 let archive=f.rows.get('harvest_111_favoris_archive').data;check(archive.creations.length===1&&archive.creations[0].contexteFavori===contexte,'lien natif et création exacte conservés');
 await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:999,opposite_user_id:888}));
 await f.ctx.archiveNotifications('111',{payload:{notifications:[notif(0)]},domain:'www.vinted.fr'});
 archive=f.rows.get('harvest_111_favoris_archive').data;check(archive.creations.length===1,'une autre création ou une page de notifications ne perd pas la preuve');
 for(const [item,url] of [[555,contexte],[101,'https://evil.invalid/items/101/conversation/new?native_target=201']])await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:item,opposite_user_id:201}),url);
 check(f.rows.get('harvest_111_favoris_archive').data.creations.length===1,'autre article et origine étrangère ne deviennent pas des preuves');
 check(f.reseau.every(x=>!x.u.hostname.endsWith('vinted.fr')),'capturer la preuve ne déclenche aucune requête Vinted');
 f=creer();await f.ctx.archiveNotifications('111',{payload:{notifications:[{...notif(0),link:'/items/101/conversation/new?native_target=201'}]},domain:'www.vinted.fr'});
 const onglets=[];let navigation=async()=>{};f.ctx.chrome.tabs.query=async()=>[{id:99,url:'https://www.vinted.fr/notifications'}];f.ctx.chrome.scripting.executeScript=async o=>{check(o.world==='MAIN'&&o.args[0]==='https://www.vinted.fr/items/101/conversation/new?native_target=201','seul le lien natif exact est recherché dans la page');if(o.args[1])await navigation();return [{result:{trouve:true}}];};f.ctx.sbGet=async q=>{check(q.includes('owner=eq.owner-A')&&q.includes('harvest_111_notifications'),'l’ouverture relit uniquement la capture privée demandée');return [];};
 f.ctx.chrome.tabs.create=async o=>{onglets.push(o);return{id:99};};f.ctx.chrome.tabs.remove=async()=>{};
 f.ctx.chrome.tabs.update=async(id,o)=>{check(id===99&&o.active===true&&!o.url,'activation de l’onglet existant sans navigation document');};navigation=async()=>{await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201}),null,99);};
 let ouvert=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'n0',url:'https://evil.invalid/'});
 check(ouvert.ok&&ouvert.json.preuve==='confirmee','l’ouverture attend le reçu réel d’archivage du contexte');
 check(onglets.length===0,'aucun nouvel onglet ne charge la route interne en document');
 check(f.rows.get('harvest_111_favoris_archive').data.creations[0].contexteFavori==='https://www.vinted.fr/items/101/conversation/new?native_target=201','une redirection qui retire le contexte de la page ne le perd plus');
 check(f.reseau.every(x=>!x.u.hostname.endsWith('vinted.fr')),'le bouton ne déclenche aucune requête API Vinted de notre code');
 f.ctx.getStoredAccounts=async()=>[{vinted_user_id:'111',domain:'www.vinted.fr'}];
 const parcours=await f.ctx.executerPourApp({uid:'111',method:'POST',endpoint:'/vrm/favoris/ouvrir',body:{owner:'owner-A',notificationId:'n0'}},{origin:'https://vrm.center'});
 check(parcours.ok&&parcours.data.preuve==='confirmee','la vraie opération interne retourne le reçu dans le format utilisé par VRM');
 await (f.ctx.chrome.storage.session||f.ctx.chrome.storage.local).set({vrmFavoriOnglet_100:{owner:'owner-A',uid:'111',etat:'attente',at:Date.now(),contexteFavori:'https://www.vinted.fr/items/101/conversation/new?native_target=201'}});
 await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201}),null,101);
 check((await (f.ctx.chrome.storage.session||f.ctx.chrome.storage.local).get('vrmFavoriOnglet_100')).vrmFavoriOnglet_100.etat==='attente','un autre onglet ne consomme pas le contexte');
 await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201}),null,99);
 check(!f.lignes.harvest_111_wreq_api_v2_conversations?.contexteFavori,'le contexte confirmé ne sert pas à une seconde création');
 const nombre=onglets.length;
 check(!(await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-B',notificationId:'n0'})).ok&&onglets.length===nombre,'autre propriétaire : aucun onglet');
 check(!(await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'inconnue'})).ok&&onglets.length===nombre,'notification inconnue : aucun onglet');
 const refuse=await f.ctx.executerPourApp({uid:'111',method:'POST',endpoint:'/vrm/favoris/ouvrir',body:{owner:'owner-A',notificationId:'n0'}},{origin:'https://evil.invalid'});check(!refuse.ok&&onglets.length===nombre,'l’opération interne reste fermée aux autres sites');
 navigation=async()=>{await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:999,opposite_user_id:201}),null,99);};
 ouvert=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'n0'});check(ouvert.ok&&ouvert.json.preuve==='en_attente'&&ouvert.json.raison==='capture_pas_recue','un autre article ne consomme pas le contexte et ne produit pas un faux reçu positif');
 f.ctx.compteNonCapte=async()=>false;f.ctx.conversationFusionnee=async(id,p)=>p;f.ctx.sbGet=async()=>[];
 f.ctx.chrome.tabs.get=async()=>({id:99,url:'https://www.vinted.fr/inbox/900'});
 const fil={conversation:{id:900,transaction:{item_id:101},opposite_user:{id:201},messages:[{entity_type:'message',entity:{body:'message de démonstration'}}]}};
 navigation=async()=>{const ack=await f.envoyer({from:'cancale-content',domain:'www.vinted.fr',kind:'harvest',type:'conversation',id:'900',body:JSON.stringify(fil),url:'https://www.vinted.fr/api/v2/conversations/900',method:'GET',httpStatus:200},{origin:'https://www.vinted.fr',url:'https://www.vinted.fr/inbox/900',frameId:0,tab:{id:99,url:'https://www.vinted.fr/inbox/900'}});check(ack?.recu===true,'le vrai relais garde le canal ouvert jusqu’à la conservation de la capture');};
 ouvert=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'n0'});check(ouvert.ok&&ouvert.json.preuve==='confirmee','une conversation déjà existante peut confirmer le lien sans nouvelle création');
 const lectures=f.rows.get('harvest_111_favoris_archive').data.lecturesLiees;check(lectures.length===1&&lectures[0].method==='GET'&&lectures[0].recipientId==='201','la lecture garde sa provenance GET, sans fabriquer un POST');
 const zone=f.ctx.chrome.storage.session||f.ctx.chrome.storage.local;
 await zone.set({vrmFavoriOnglet_99:{owner:'owner-A',uid:'111',etat:'attente',at:Date.now(),contexteFavori:'https://www.vinted.fr/items/101/conversation/new?native_target=201'}});
 f.ctx.chrome.tabs.get=async()=>({id:99,url:'https://www.vinted.fr/inbox/999'});
 await f.ctx.capterLectureFavori('111','www.vinted.fr','900',fil,'/api/v2/conversations/900',99,'owner-A','GET',200);
 check((await zone.get('vrmFavoriOnglet_99')).vrmFavoriOnglet_99.etat==='attente','un fil préchargé qui n’est pas affiché ne prend pas le contexte');
 f.ctx.chrome.tabs.get=async()=>({id:99,url:'https://www.vinted.fr/inbox/900'});
 for(const [m,st] of [['POST',200],['GET',403]])await f.ctx.capterLectureFavori('111','www.vinted.fr','900',fil,'/api/v2/conversations/900',99,'owner-A',m,st);
 check((await zone.get('vrmFavoriOnglet_99')).vrmFavoriOnglet_99.etat==='attente','une écriture ou un refus HTTP ne devient pas une preuve de lecture');
 let focus=false,cloche=false,sondes=0,cliques=0;
 f.ctx.chrome.tabs.update=async(id,o)=>{check(id===99&&o.active===true&&!o.url,'l’onglet Vinted est activé avant la cloche');focus=true;};
 f.ctx.chrome.scripting.executeScript=async o=>{
  if(o.func.name==='clocheFavorisNative'){
   check(o.args[1]==='https://www.vinted.fr','la cloche est bornée à l’origine du lien natif');
   if(o.args[0]){check(focus,'la cloche est rouverte seulement après activation de Vinted');cloche=true;cliques++;}
   return [{result:{etat:o.args[0]?'activee':'disponible'}}];
  }
  if(!o.args[1])return [{result:{trouve:cloche&&++sondes>=2}}];
  check(cloche,'le lien exact n’est activé qu’après apparition dans la cloche');
  await f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201}),null,99);
  return [{result:{trouve:true}}];
 };
 const ferme=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'n0'});
 check(ferme.ok&&ferme.json.preuve==='confirmee'&&cliques===1,'une cloche fermée au retour dans VRM est rouverte une seule fois et produit un reçu réel');
 const avantManquant=f.rows.get('harvest_111_favoris_archive').data.creations.length;
 f.ctx.chrome.scripting.executeScript=async o=>o.func.name==='clocheFavorisNative'?[{result:{etat:o.args[0]?'activee':'disponible'}}]:[{result:{trouve:false}}];
 const manquant=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'n0'});
 check(!manquant.ok&&manquant.json.code==='favori_non_trouve'&&manquant.json.version===JSON.parse(require('node:fs').readFileSync('vinted-sync-extension/manifest.json','utf8')).version,'cloche activée sans lien exact : refus spécifique et version conservée');
 check(f.rows.get('harvest_111_favoris_archive').data.creations.length===avantManquant,'un autre favori n’est jamais substitué à celui demandé');
 f.ctx.chrome.tabs.query=async()=>[];const absent=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-A',notificationId:'n0'});check(!absent.ok&&absent.json.code==='cloche_introuvable'&&onglets.length===0,'lien absent : refus explicite sans route directe de secours');
 console.log(controles+' contrôles archive et pagination réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
