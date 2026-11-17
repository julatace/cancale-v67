// ════════════════════════════════════════════════════════════════════════════
//  OUTIL DE MAQUETTE (17 nov., proposition C « Studio ») — captures de l'app RENDUE
//  sur la base INVENTÉE de design-passe (3 comptes, ventes, achats, annonces ;
//  vignettes SVG inventées ; garde réseau : rien ne sort).
//  MAQUETTE=c pose le réglage de banc `vrm_maquette` (invisible pour un vendeur :
//  seul un banc l'écrit) ; sans lui, l'app telle qu'elle est (l'« avant »).
//  SHOTS=<dossier> ECRANS=journee,ventes,achats,annonces,argent
//  LARGEURS=390,1512 THEMES=clair,sombre BANC_DIST=<dist> — un outil ne meurt pas.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'maquette-c');
const ECR = { journee: '/?tab=journee', ventes: '/?tab=ventes', achats: '/?tab=achats', annonces: '/?tab=annonces', argent: '/?tab=compta' };
const voulus = String(process.env.ECRANS || Object.keys(ECR).join(',')).split(',');
const LARG = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
const MAQ = process.env.MAQUETTE || '';
const PLEIN = process.env.PLEIN === '1';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const e of voulus) for (const W of LARG) for (const t of THEMES) {
      const o = await P.ouvrir(nav, { W, sombre: t === 'sombre', b: P.base(), url: ECR[e], dsf: W < 600 ? 2 : 1, avantChargement: MAQ ? `localStorage.setItem('vrm_maquette', ${JSON.stringify(MAQ)})` : '' });
      await P.pret(o.pg);
      await o.pg.waitForTimeout(900);
      // Les messages passagers (« 36 nouvelles paires numérotées… ») se ferment comme Julien le ferait : un toucher.
      for (let k = 0; k < 10; k++) { const t = o.pg.locator('.vrm-toasts :is([data-acc-fermer], .vrm-acc-x, .vrm-toast), .vrm-toasts button[aria-label*="ermer"]').first(); if (!(await t.count())) break; await t.click({ timeout: 1500 }).catch(() => {}); await o.pg.waitForTimeout(350); }
      await o.pg.waitForTimeout(1200);
      for (let k = 0; k < 6; k++) { const t = o.pg.locator('.vrm-toasts [data-acc-fermer]').first(); if (!(await t.count())) break; await t.click({ timeout: 1500, force: true }).catch(() => {}); await o.pg.waitForTimeout(300); }
      const mesure = await o.pg.evaluate(() => {
        const r = document.querySelector('.vrm-main');
        const l = document.querySelector('.sb-rangee, [data-ligne-vente], [data-annonce-ligne], [data-achat-ligne], .vrm-liste-ligne');
        return { premiere: l ? Math.round(l.getBoundingClientRect().top) : null, haut: innerHeight, maquette: document.documentElement.getAttribute('data-maquette') || '', main: !!r };
      }).catch(() => ({}));
      const f = path.join(OUT, `${e}-${W}-${t}.png`);
      await o.pg.screenshot({ path: f, fullPage: PLEIN });
      console.log(f, JSON.stringify(mesure), o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
})();
