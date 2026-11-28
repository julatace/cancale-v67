'use strict';
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
const ecr=(m)=>m.f.j.vinted.filter(v=>v.methode!=='GET').map(v=>v.chemin.replace(/[0-9a-f-]{36}/,'U')+' '+(v.corps||'').slice(0,140));
(async()=>{
  const MSG=process.env.MSG||'Bonjour, je te propose {prix} pour {article} !';
  const scen=process.env.S||'route';
  const store = ['route','refus','plancher'].includes(scen)?{ vrmFavorisRoutes:{ offre:{ route:'apres_message', at:1 } } }:{};
  const m = await monde(RACINE,{ n:1, store,
    avant: async ({b})=>{ b.poser('vrm_favoris_reglages_123',{ version:1, envoisActifs:false, message:MSG, pourcentage:scen==='plancher'?40:10, offreMode:'pct', offreValeur:null, arrondi:false, intervalleMinutes:0, intervalleMaxMinutes:null }); },
    vinted:(e)=>{ if(scen==='refus'&&e.methode==='POST'&&/\/offers$/.test(e.chemin)) return {status:400,body:{code:106,message:'Offre refusée'}};
      if(scen==='404'&&e.methode==='POST'&&/\/offers$/.test(e.chemin)) return {status:404,body:{}}; return null; } });
  const r = await envoyer(m,'jn0');
  console.log(scen, JSON.stringify(r)); console.log(ecr(m).join('\n'));
  console.log('faits', JSON.stringify((await m.f.ctx.faitsFavoris(m.UID)).jn0||{}));
  const fs0=m.fileServeur(); console.log('serveur', JSON.stringify(Object.values(fs0.groupes)[0].jobs.map(j=>({etat:j.etat,raison:j.raison,ecrits:j.ecrits}))));
  m.fin(); process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
