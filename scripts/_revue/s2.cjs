'use strict';
// Reprise d'un envoi à moitié fait : l'acheteur a répondu entre-temps / message avec {prix}.
const path=require('path');const RACINE=path.join(__dirname,'..','..');
const { monde } = require('../_favoris-monde-reel.cjs');
const envoyer = async (m, id) => {
  m.h.t += 15*60000;
  const ap = await m.call('apercu'); const reg = ap.body && ap.body.apercu && ap.body.apercu.reglages;
  const la = await m.call('lancer', { selection: [id], reglages: reg });
  const s = await m.call('suivant'); const t = s.body && s.body.travail;
  if (!t) return { erreur:'pas de travail', la: la.body };
  const ACC = { vinted_user_id: m.UID, domain: 'www.vinted.fr', access_token: 'jeton' };
  const r = await m.f.ctx.executerMessageFavori(m.UID, ACC, t, { manuel: true }).catch((x)=>({erreur:String(x&&x.stack||x)}));
  await m.call('terminer', { jeton: t.jeton, brut: r ? { ok: !!r.ok, data: r.json || null } : {} });
  return r && r.json ? r.json : r;
};
(async()=>{
  const UU='00a1fdff-71a1-4c2b-9d3e-0123456789ab';
  const forme=process.env.F||'acheteur';
  const msgs=()=>{
    const base=[{ entity_type:'offer_request_message', user_id:123, entity:{ user_id:123, price:{amount:'49.5'} } }];
    if(forme==='acheteur') base.push({ entity_type:'message', entity:{ user_id:3000000001, body:'Non merci, trop cher' } });
    if(forme==='moi_sender') base.push({ entity_type:'message', sender_id:123, content:'Bonjour, il te plaît toujours ?' });
    if(forme==='moi_autheur') base.push({ entity_type:'message', entity:{ author_id:123, body:'Bonjour, il te plaît toujours ?' } });
    return base; };
  const m = await monde(RACINE,{ n:1, store:{ vrmFavorisFaits:{ 123:{ '7000000180:3000000001':{ o: Date.now()-60000 } } } },
    avant: async ({b})=>{ b.poser('vrm_favoris_reglages_123',{ version:1, envoisActifs:false, message:'Bonjour, je te propose {prix} !', pourcentage:10, offreMode:'pct', offreValeur:null, arrondi:false, intervalleMinutes:0, intervalleMaxMinutes:null }); },
    vinted:(e)=>{ if(e.methode==='GET'&&e.chemin.split('?')[0]==='/messaging/main/conversations/'+UU) return {status:200,body:{conversation:{id:UU,allow_reply:true,opposite_users:[{id:3000000001}],data:{},messages:msgs()}}}; return null; } });
  const r=await envoyer(m,'jn0');
  console.log(forme, JSON.stringify(r));
  console.log(m.f.j.vinted.filter(v=>v.methode!=='GET').map(v=>v.chemin.replace(/[0-9a-f-]{36}/,'U')+' '+(v.corps||'').slice(0,100)).join('\n'));
  m.fin(); process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
