import test from 'node:test';import assert from 'node:assert/strict';
import handler from '../../api/compte.js';
import {effacerFavorisDe} from '../../api/_lib/favoris-confidentialite.js';
import {PROPRIETAIRE_NEUTRE} from '../../api/_lib/proprietaire-email.js';
const U='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',V='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const json=(j,status=200)=>new Response(JSON.stringify(j),{status});
test('route réelle : session, RLS, CAS sous concurrence, autorisation unique et refus inter-propriétaire',async()=>{
 const ancien=global.fetch,cle=process.env.SUPABASE_SERVICE_KEY;process.env.SUPABASE_SERVICE_KEY='sb_secret_fixture';
 let user=U,panne=false,autreCompte=false,base=new Map(),appels=[];
 const ids=['harvest_123_notifications','harvest_123_wreq_api_v2_conversations','vrm_favoris_reglages_123'];
 const captures=[{uid:'123',type:'notifications',domain:'www.vinted.fr',payload:{notifications:[{id:'n1',user_id:201,body:'Camille a ajouté ton article à ses favoris.',link:'/items/101/conversation/new?from_notification=true'},{id:'n2',user_id:202,body:'Camille a ajouté ton article à ses favoris.',link:'/items/102/conversation/new?from_notification=true'}]}},{uid:'123',method:'POST',path:'/api/v2/conversations',body:JSON.stringify({initiator:'native-fixture',item_id:'101',opposite_user_id:'201'})},{version:1,envoisActifs:false,message:'Merci !',pourcentage:10,intervalleMinutes:1}];
 global.fetch=async(url,o={})=>{
  const u=new URL(url);appels.push({u,o});assert.ok(u.hostname.endsWith('supabase.co'),'aucun appel Vinted ou autre réseau');
  if(u.pathname.endsWith('/auth/v1/user'))return json({id:user});
  if(u.pathname.endsWith('/vinted_accounts'))return json(autreCompte?[]:[{owner:user,vinted_user_id:'123'}]);
  assert.ok(u.pathname.endsWith('/app_data'));
  if(o.headers?.apikey==='sb_secret_fixture'){
   if(panne)return json({},503);
   if(u.searchParams.get('select')==='id'&&(!o.method||o.method==='GET')){assert.equal(u.searchParams.get('id'),'like.favoris_file_*');const [o]=JSON.parse(u.searchParams.get('data->proprietaires').slice(3));return json([...base].filter(([id,d])=>d.proprietaires?.includes(o)).map(([id])=>({id})));}
   const id=u.searchParams.get('id')?.slice(3);
   if(!o.method||o.method==='GET'){await new Promise(r=>setTimeout(r,1));return json(base.has(id)?[{data:structuredClone(base.get(id))}]:[]);}
   if(o.method==='POST'){const [row]=JSON.parse(o.body);assert.equal(row.owner,PROPRIETAIRE_NEUTRE);if(base.has(row.id))return json({},409);base.set(row.id,row.data);return new Response(null,{status:201});}
   assert.equal(o.method,'PATCH');assert.equal(u.searchParams.get('owner'),'eq.'+PROPRIETAIRE_NEUTRE);
   if(u.searchParams.get('data->>rev')!=='eq.'+base.get(id)?.rev)return json([]);
   base.set(id,JSON.parse(o.body).data);return json([{id}]);
  }
  assert.equal(u.searchParams.get('owner'),'eq.'+user);
  return json(ids.map((id,i)=>({id,owner:user,data:captures[i]})));
 };
 const call=async(action,extra={},token='fixture.session.jwt')=>{
  let code,body;const res={setHeader(){},status(v){code=v;return this;},json(v){body=v;return this;}};
  await handler({method:action?'POST':'GET',query:{uid:'123',mode:'favoris'},headers:{authorization:token?'Bearer '+token:''},body:action?{action,...(action==='consommer'?{version:'5.217.0'}:{}),...(action==='lancer'?{reglages:captures[2]}:{}),...extra}:undefined},res);return {code,body};
 };
 try{
  assert.equal((await call(null,{},'')).code,401);
  autreCompte=true;assert.equal((await call('lancer',{selection:['n1']})).code,403);assert.equal(base.size,0);autreCompte=false;
  assert.equal((await call('lancer',{selection:['n1'],reglages:{...captures[2],message:'Autre message'}})).code,409,'réglages changés : aperçu périmé refusé');
  assert.equal(base.size,0);
  assert.equal((await call('lancer',{selection:['n1','n2']})).code,200);
  const rs=await Promise.all(Array.from({length:30},()=>call('suivant'))),travaux=rs.filter(r=>r.body.travail);
  assert.equal(travaux.length,1,'trente fenêtres : un seul travail délivré');
  const t=travaux[0].body.travail;
  user=V;const etranger=await call('consommer',{jeton:t.jeton});assert.equal(etranger.code,409);
  const vueAutre=await call();assert.deepEqual(vueAutre.body.vue.jobs,[]);assert.equal(JSON.stringify(vueAutre.body).includes('Merci'),false);
  user=U;
  assert.equal((await call('consommer',{jeton:t.jeton,version:'5.216.0'})).code,409,'ancien moteur sans contrôle historique refusé');
  const grants=await Promise.all(Array.from({length:20},()=>call('consommer',{jeton:t.jeton})));
  const uniques=grants.filter(r=>r.code===200);assert.equal(uniques.length,1,'vingt extensions : une seule autorisation consommée');
  assert.equal(uniques[0].body.travail.message,'Merci !\n\nJe te propose une réduction de 10 % sur cet article.');
  assert.equal((await call('verifier',{jeton:t.jeton})).body.autorise,true);
  assert.equal((await call('terminer',{jeton:t.jeton,resultat:'envoye'})).code,200);
  assert.equal((await call('verifier',{jeton:t.jeton})).code,409,'autorisation terminée non réutilisable');
  assert.equal((await call('suivant')).body.travail,undefined,'cadence serveur même après succès');
  assert.equal((await call('arreter')).body.vue.active,false);
  const reprises=await call('lancer',{selection:['n1']});assert.equal(reprises.code,409,'pas de renvoi à la même personne/article');
  user=V;assert.equal((await call('lancer',{selection:['n2']})).code,200);
  const avant=[...base.values()][0].tentatives.length;
  assert.equal(await effacerFavorisDe(U),1);const reste=[...base.values()][0];assert.equal(reste.groupes[U],undefined);assert.ok(reste.groupes[V]);assert.deepEqual(reste.proprietaires,[V]);assert.equal(reste.tentatives.length,avant,'effacement conserve le quota partagé');
  panne=true;assert.equal((await call()).code,503,'base indisponible : aucun succès supposé');assert.equal(await effacerFavorisDe(V),null,'effacement non confirmé quand la base échoue');
  assert.equal(appels.some(x=>x.u.hostname.includes('vinted')),false);
 }finally{global.fetch=ancien;if(cle===undefined)delete process.env.SUPABASE_SERVICE_KEY;else process.env.SUPABASE_SERVICE_KEY=cle;}
});
