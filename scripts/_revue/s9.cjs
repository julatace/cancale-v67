'use strict';
// aucunEnvoi : l'offre est PARTIE chez Vinted mais la réponse a l'air d'un échec. Relancer ⇒ 2e offre ?
//  F=timeout : la réponse de l'offre perdue (status 0) ; F=400vu : 400 mais l'offre apparaît dans la conversation (forme connue)
//  F=400forme : 400, l'offre apparaît sous une forme où le montant est rangé ailleurs (entity.offer.price)
const path=require('path');const RACINE=path.join(__dirname,'..','..');
const { monde } = require('../_favoris-monde-reel.cjs');
const UU='00a1fdff-71a1-4c2b-9d3e-0123456789ab';
(async()=>{
  const F=process.env.F||'timeout';
  let offreFaite=false;
  const m = await monde(RACINE,{ n:1, vinted:(e)=>{
    if(e.methode==='POST'&&/\/offers$/.test(e.chemin)){ offreFaite=true; return F==='timeout'?{status:0,body:null}:{status:400,body:{code:1,message:'Erreur'}}; }
    if(e.methode==='GET'&&e.chemin.split('?')[0]==='/messaging/main/conversations/'+UU){
      const msgs=offreFaite?(F==='400forme'?[{entity_type:'offer_message',entity:{user_id:123,offer:{price:{amount:'49.5'}}}}]:[{entity_type:'offer_message',entity:{user_id:123,price:{amount:'49.5'}}}]):[];
      return {status:200,body:{conversation:{id:UU,allow_reply:true,opposite_users:[{id:3000000001}],data:{},messages:msgs}}}; }
    return null; } });
  const ACC={ vinted_user_id:m.UID, domain:'www.vinted.fr', access_token:'jeton' };
  const un=async()=>{ m.h.t+=15*60000; const ap=await m.call('apercu'); const a=ap.body&&ap.body.apercu; const row=(a&&a.tous||[]).find(x=>x.id==='jn0');
    const la=await m.call('lancer',{selection:['jn0'],reglages:a&&a.reglages}); const s=await m.call('suivant'); const t=s.body&&s.body.travail;
    if(!t) return {cochable:row&&row.cochable, lancer:la.code, msg:la.body&&la.body.message};
    const r=await m.f.ctx.executerMessageFavori(m.UID,ACC,t,{manuel:true}); await m.call('terminer',{jeton:t.jeton,brut:{ok:!!r.ok,data:r.json}}); return {cochable:row&&row.cochable, r:r.json}; };
  console.log('1', JSON.stringify(await un()));
  console.log('2', JSON.stringify(await un()));
  console.log('offres postées', m.f.j.vinted.filter(v=>v.methode==='POST'&&/offers$/.test(v.chemin)).length, 'messages', m.f.j.vinted.filter(v=>v.methode==='POST'&&/replies$/.test(v.chemin)).length);
  m.fin(); process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
