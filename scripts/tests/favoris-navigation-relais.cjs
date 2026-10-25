// Real worker, no scripting API; synthetic extension/tab/storage only.
const assert=require('node:assert/strict'),path=require('node:path');const {faireFond}=require('../_fond-vm.cjs');
let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;};
function creer(mode='normal'){
 const f=faireFond({src:process.env.SOURCE_FAVORIS_BG||path.resolve('vinted-sync-extension/background.js'),retirer:mode==='sans_canal'?['scripting','tabs.sendMessage']:['world_refuse','action_scripting_incertaine'].includes(mode)?[]:['scripting']});
 let visible=false,focus=false;const appels=[],creations=[],injections=[];
 Object.assign(f.ctx,{authToken:async()=>({user_id:'owner-test',access_token:'fixture'}),loadSession:async()=>({user_id:'owner-test'}),compteConnecte:async()=> '111',activeAccountId:async()=> '111',sbGet:async()=>[],supabaseUpsert:async()=>true});
 f.ctx.archiveNotifications=async(uid,o)=>{if(o.lecture)return {owner:'owner-test',data:{archiveVersion:1,uid:'111',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[{id:'n1',body:'Camille a ajouté ton article comme favori',link:'/items/101/conversation/new?native_target=201'}]}}};if(o.creation){creations.push(o.creation);return {owner:'owner-test',data:{}};}return null;};
 f.ctx.chrome.tabs.query=async()=>[{id:7,active:false,url:'https://www.vinted.fr/'}];
 f.ctx.chrome.tabs.get=async()=>({id:7,url:mode==='onglet_parti'?'https://evil.invalid/':'https://www.vinted.fr/'});
 f.ctx.chrome.tabs.update=async(id,o)=>{assert.equal(id,7);assert.equal(o.active,true);focus=true;};
 if(['world_refuse','action_scripting_incertaine'].includes(mode))f.ctx.chrome.scripting.executeScript=async o=>{
  injections.push(o);
  if(mode==='world_refuse'||o.func.name==='clocheFavorisNative'&&o.args[0])throw Error('Unsupported world MAIN');
  return [{result:o.func.name==='clocheFavorisNative'?{etat:'disponible'}:{trouve:false}}];
 };
 if(mode!=='sans_canal')f.ctx.chrome.tabs.sendMessage=(tab,m,cb)=>{
  assert.equal(tab,7);assert.equal(m.vrm,'favoriPage');appels.push(m.action);
  const rep=resultat=>cb({id:m.id,origine:mode==='origine_fausse'?'https://evil.invalid':'https://www.vinted.fr',resultat});
  if(m.action==='sonder')return rep({trouve:visible});
  if(m.action==='cloche_sonder')return rep({etat:'disponible'});
  if(m.action==='cloche_ouvrir'){assert.ok(focus);visible=true;if(mode==='sans_accuse')return cb(null);return rep({etat:'activee'});}
  if(m.action==='ouvrir')return f.ctx.storeWriteReq('www.vinted.fr','POST','/api/v2/conversations',JSON.stringify({initiator:'native',item_id:101,opposite_user_id:201}),null,7).then(()=>rep({trouve:true}));
  throw Error('Unknown action');
 };
 return {...f,appels,creations,injections};
}
(async()=>{
 const acc={vinted_user_id:'111',domain:'www.vinted.fr'};
 let f=creer();let r=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-test',notificationId:'n1'});
 ok(f.appels.length>0,'sans scripting, le worker utilise le relais de son onglet');
 ok(r.ok&&r.json.preuve==='confirmee'&&f.creations.length===1,'le parcours ferme/cloche/lien termine avec un vrai reçu d’archivage');
 ok(f.appels.filter(x=>x==='cloche_ouvrir').length===1&&f.appels.filter(x=>x==='ouvrir').length===1,'aucune activation ni ouverture répétée');
 ok(!f.j.injections&&!f.j.vinted.length,'aucune injection scripting ni requête API ajoutée par le worker');
 f=creer('world_refuse');r=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-test',notificationId:'n1'});
 ok(r.ok&&r.json.preuve==='confirmee'&&f.injections.length===1,'un refus MAIN lors de la sonde choisit le relais une seule fois');
 f=creer('action_scripting_incertaine');r=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-test',notificationId:'n1'});
 ok(!r.ok&&!f.appels.length&&f.injections.filter(o=>o.func.name==='clocheFavorisNative'&&o.args[0]).length===1,'un échec pendant le clic ne bascule pas vers un autre canal');
 for(const mode of ['sans_canal','origine_fausse','onglet_parti','sans_accuse']){
  f=creer(mode);r=await f.ctx.ouvrirFavoriNatif('111',acc,{owner:'owner-test',notificationId:'n1'});
  ok(!r.ok&&f.creations.length===0,mode+' : aucune preuve de destinataire fabriquée');
  ok(f.appels.filter(x=>x==='cloche_ouvrir').length<=1&&f.appels.filter(x=>x==='ouvrir').length===0,mode+' : aucune commande rejouée après refus');
 }
 console.log(n+' contrôles du parcours favoris sans scripting réussis');
})().catch(e=>{console.error(e);process.exitCode=1;});
