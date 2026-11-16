// ════════════════════════════════════════════════════════════════════════════
//  OUTIL (16 nov., stabilite-iphone — Julien : « lent quand les données s'affichent, c'est pas fluide »)
//  CE QUI SE PASSE À L'ARRIVÉE DES DONNÉES, écran par écran : base INVENTÉE (_base-messages-stock.cjs), 390 tactile.
//  Dans la page, dès le premier octet : chaque VAGUE de changements du DOM sous .vrm-main (un rappel du
//  MutationObserver = un rendu React validé, à peu près), son heure et sa taille (nœuds ajoutés/retirés), les
//  longues tâches (longtask) et les sauts de mise en page (layout-shift, CLS) ; jusqu'à `DUREE` ms (défaut 20 000).
//  Usage : node scripts/bancs/_mesure-arrivee.cjs [dist] — `ECRANS=ventes,achats,journee`, `CPU=2`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
if (process.argv[2]) process.env.BANC_DIST = path.resolve(process.argv[2]);
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const ECRANS = { ventes: '/?tab=ventes&site=vinted', toutes: '/?tab=ventes', achats: '/?tab=achats', journee: '/?tab=journee', argent: '/?tab=compta' };
const voulus = String(process.env.ECRANS || 'ventes,achats,journee').split(',');
const DUREE = Number(process.env.DUREE || 20000), CPU = Number(process.env.CPU || 1);

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const res = {};
  for (const e of voulus) {
    const o = await P.ouvrir(nav, { W: 390, sombre: false, b: B.baseVolume(), url: '/confiance.html', api: B.apiVolume });
    if (CPU > 1) { const cdp = await o.ctx.newCDPSession(o.pg); await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }); }
    await o.pg.addInitScript(() => {
      const M = window.__arr = { vagues: [], lt: [], cls: 0, sauts: [] };
      const go = () => {
        new MutationObserver((l) => {
          let n = 0, dansMain = false;
          for (const m of l) { n += m.addedNodes.length + m.removedNodes.length + (m.type === 'characterData' ? 1 : 0); if (!dansMain && m.target && m.target.closest && m.target.closest('.vrm-main')) dansMain = true; if (!dansMain && m.target && m.target.parentElement && m.target.parentElement.closest('.vrm-main')) dansMain = true; }
          if (dansMain && n) M.vagues.push([Math.round(performance.now()), n]);
        }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      };
      if (document.documentElement) go(); else document.addEventListener('DOMContentLoaded', go);
      try { new PerformanceObserver((l) => { for (const x of l.getEntries()) M.lt.push([Math.round(x.startTime), Math.round(x.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
      try { new PerformanceObserver((l) => { for (const x of l.getEntries()) if (!x.hadRecentInput) { M.cls += x.value; M.sauts.push([Math.round(x.startTime), +x.value.toFixed(4)]); } }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
    });
    await o.pg.goto(`http://localhost:${P.PORT}${ECRANS[e]}`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForTimeout(DUREE);
    const M = await o.pg.evaluate(() => window.__arr);
    const grosses = M.vagues.filter(([, n]) => n >= 20);
    res[e] = { vagues: M.vagues.length, grosses: grosses.length, noeuds: M.vagues.reduce((a, [, n]) => a + n, 0), derniereGrosse: grosses.length ? grosses[grosses.length - 1][0] : 0,
      longues: M.lt.length, pireLongue: Math.max(0, ...M.lt.map((x) => x[1])), sommeLongues: M.lt.reduce((a, x) => a + x[1], 0), cls: +M.cls.toFixed(4), sauts: M.sauts.slice(0, 8),
      grossesDetail: grosses.slice(0, 30) };
    console.log(e, JSON.stringify(res[e]));
    await o.ctx.close();
  }
  await nav.close(); P.srv.close();
  process.exit(0);
})();
