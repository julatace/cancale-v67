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
 console.log(controles+' contrôles archive et pagination réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
