require('./_porte-banc.cjs');
// ════════════════════════════════════════════════════════════════════════════
//  STATISTIQUES : « PILOTAGE · FINANCES · TRANSPORTEURS » EN TÊTE (intégration du 21 nov.)
//  Le lot journee-stats pose sa tête (`[data-stats-pilotage]`, src/ecrans/Stats.jsx) juste sous la barre d'Argent. Au
//  téléphone, src/styles-captures.css range les enfants de `.vrm-statistiques-premium` par `order` et donnait 7 à tout
//  ce qu'il ne nommait pas : la tête tombait sous TOUTES les anciennes cartes (mesuré : 4 940 px plus bas, 390 px). Le banc
//  du lot rendait l'écran seul (outil esbuild) et ne pouvait pas le voir ; celui-ci rend L'APP, design par défaut.
//    P1  à 390 (tactile) et 1512 : la tête de Pilotage est AU-DESSUS de la vitrine des anciennes cartes ;
//    P2  elle commence dans le premier écran (haut < 700 px) ;
//    P3  ses titres de cartes gardent leur taille natif (≤ 15 px) : posée dans la tête, la règle du titre d'écran les grossissait (32 px).
//  Échoue sur le build d'avant la correction (`BANC_DIST=`). Base INVENTÉE (design-passe), garde réseau.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';   // le design de l'app (pas le DOM d'avant le 17 nov.)
const path = require('path');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d !== undefined ? ' — ' + JSON.stringify(d).slice(0, 400) : '')); } };
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  for (const W of [390, 1512]) {
    const { ctx, pg } = await ouvrir(nav, { W, sombre: false, b, url: '/?tab=dashboard' });
    await pg.waitForSelector('[data-stats-pilotage]', { timeout: 40000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    const r = await pg.evaluate(() => {
      const p = document.querySelector('[data-stats-pilotage]'), v = document.querySelector('.vrm-stats-vitrine');
      const top = (e) => (e ? Math.round(e.getBoundingClientRect().top) : null);
      const tailles = p ? [...p.querySelectorAll('h2.n-carte-titre')].filter((h) => h.getClientRects().length).map((h) => parseFloat(getComputedStyle(h).fontSize)) : [];
      return { pilotage: top(p), vitrine: top(v), tailles };
    });
    dit(r.pilotage != null && (r.vitrine == null || r.pilotage < r.vitrine), `P1 ${W} : Pilotage au-dessus des anciennes cartes`, r);
    dit(r.pilotage != null && r.pilotage < 700, `P2 ${W} : Pilotage dans le premier écran (haut ${r.pilotage} px)`, r);
    dit(r.tailles.length > 0 && Math.max(...r.tailles) <= 15, `P3 ${W} : titres des cartes de Pilotage ≤ 15 px (${r.tailles.join('/')})`, r.tailles);
    await ctx.close();
  }
  await nav.close(); srv.close();
  console.log(ko ? `❌ stats-pilotage-place : ${ok} verts, ${ko} rouges` : `✅ stats-pilotage-place : ${ok} verts, 0 rouge`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
