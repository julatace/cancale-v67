'use strict';
// Réglages changés ailleurs entre l'aperçu et « Lancer » : 409 ⇒ nouveau récapitulatif ; le 2e « Lancer » part avec les NOUVEAUX.
const path=require('path');const RACINE=path.join(__dirname,'..','..');
const { monde } = require('../_favoris-monde-reel.cjs');
(async()=>{
  const m = await monde(RACINE,{ n:2 });
  const E=(x)=>m.f.envoyer(Object.assign({ from:'vrm-badge', action:'favorisCarte', uid:'123' },x), m.sender);
  const ap=await E({quoi:'apercu'}); const a=ap.apercu;
  const sel=a.tous.filter(x=>x.cochable).map(x=>x.id);
  m.b.poser('vrm_favoris_reglages_123',{ version:1, envoisActifs:false, message:'Salut, toujours intéressé ?', pourcentage:20, offreMode:'pct', offreValeur:null, arrondi:false, intervalleMinutes:0, intervalleMaxMinutes:null });
  const l1=await E({quoi:'lancer', selection:sel, reglages:a.reglages, confirme:true});
  console.log('1er lancer', l1.ok, l1.code, !!l1.apercu, l1.apercu&&JSON.stringify(l1.apercu.reglages&&{m:l1.apercu.reglages.message,p:l1.apercu.reglages.pourcentage}));
  const l2=await E({quoi:'lancer', selection:sel, reglages:l1.apercu&&l1.apercu.reglages, confirme:true});
  console.log('2e lancer', l2.ok, l2.code||'', l2.raison||'');
  await m.tours(10);
  console.log(m.f.j.vinted.filter(v=>v.methode==='POST').map(v=>v.chemin.replace(/[0-9a-f-]{36}/,'U')+' '+(v.corps||'').slice(0,80)).join('\n'));
  m.fin(); process.exit(0);
})().catch(e=>{console.log(e);process.exit(1)});
