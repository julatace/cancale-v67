'use strict';
// 2 favoris lancés depuis le panneau, puis l'onglet vinted.fr disparaît (fermé) pendant quelques minutes.
const path=require('path');const RACINE=path.join(__dirname,'..','..');
const { monde } = require('../_favoris-monde-reel.cjs');
(async()=>{
  const mode=process.env.M||'sansonglet';
  let n403=0;const m = await monde(RACINE,{ n:2, vinted:(e)=>{ if(mode==='403'&&e.methode==='POST'&&/offers$/.test(e.chemin)&&n403++===0) return {status:403,body:{}}; if(mode==='msg400'&&e.methode==='POST'&&/replies$/.test(e.chemin)) return {status:400,body:{message:'Message refusé'}}; return null; } });
  const ap=await m.f.envoyer({ from:'vrm-badge', action:'favorisCarte', quoi:'apercu', uid:'123', relire:true }, m.sender).catch(e=>({e:String(e)}));
  const a=ap&&ap.apercu||{};
  const sel=(a.tous||[]).filter(x=>x.cochable).map(x=>x.id);
  const la=await m.f.envoyer({ from:'vrm-badge', action:'favorisCarte', quoi:'lancer', uid:'123', selection:sel, reglages:a.reglages, confirme:true }, m.sender);
  console.log('lancer', la&&la.ok, sel, la&&la.raison);
  if(mode==='sansonglet'){ // plus aucun onglet
    const t=m.f.ctx.chrome.tabs; t.query=async()=>[]; t.get=async()=>{throw new Error('no tab')};
  }
  const vus=await m.tours(25);
  for(const v of vus) console.log(JSON.stringify({actif:v.actif,quoi:v.quoi,jobs:v.jobs,prochain:v.prochain}));
  const fs0=m.fileServeur(); const g=Object.values(fs0.groupes)[0];
  console.log('serveur', g.active, JSON.stringify(g.jobs.map(j=>({id:j.id,etat:j.etat,raison:j.raison,ecrits:j.ecrits,re:j.reessais}))), g.raison);
  console.log('vinted ecritures', m.f.j.vinted.filter(v=>v.methode!=='GET').length, 'temps écoulé min', Math.round((m.h.t-m.T0)/60000));
  m.fin(); process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
