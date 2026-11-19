// ════════════════════════════════════════════════════════════════════════════
//  OUTIL (16 nov., stabilite-iphone) — LA RÉPONSE AU TOUCHER (INP) d'un écran, mesurée comme
//  l'iPhone de Julien la mesure (`src/mesuresTerrain.js` : l'interaction la plus lente, Event Timing),
//  sur une base INVENTÉE (_base-messages-stock.cjs : 1 000 paires, ventes et achats du volume),
//  390 tactile, processeur ralenti (CDP `Emulation.setCPUThrottlingRate`, défaut ×4, Chromium seul).
//  Pour chaque écran : touchers successifs sur ses onglets (aller-retour), et la durée Event Timing
//  la plus longue (le temps jusqu'à l'image suivante) ; plus les longues tâches pendant l'arrivée des
//  données (ouverture) et le nombre d'images.
//  Usage : node scripts/bancs/_mesure-toucher.cjs [dist] — `VERRE=0` retire tout backdrop-filter
//  (la comparaison avec / sans le flou), `CPU=4`, `ECRANS=ventes,achats,journee`, `TOURS=3`.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
if (process.argv[2]) process.env.BANC_DIST = path.resolve(process.argv[2]);
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const CPU = Number(process.env.CPU || 4);
const TOURS = Number(process.env.TOURS || 3);
const ECRANS = { ventes: ['/?tab=ventes&site=vinted', ['En route', 'À envoyer', 'Toutes']], achats: ['/?tab=achats', null], journee: ['/?tab=journee', null], compta: ['/?tab=compta', null] };
const voulus = String(process.env.ECRANS || 'ventes,achats,journee,compta').split(',');

(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const res = {};
  for (const e of voulus) {
    const [url, onglets] = ECRANS[e];
    const o = await P.ouvrir(nav, { W: 390, sombre: false, b: B.baseVolume(), url: '/confiance.html', api: B.apiVolume }).catch((err) => { console.log('ouvrir', err.message); return null; });
    if (!o) continue;
    const cdp = await o.ctx.newCDPSession(o.pg);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await o.pg.addInitScript((sansVerre) => {
      window.__m = { ev: [], lt: [], cls: 0, t0: performance.now() };
      try { new PerformanceObserver((l) => { for (const x of l.getEntries()) window.__m.ev.push([x.name, Math.round(x.duration)]); }).observe({ type: 'event', durationThreshold: 16, buffered: true }); } catch (_) {}
      try { new PerformanceObserver((l) => { for (const x of l.getEntries()) window.__m.lt.push(Math.round(x.duration)); }).observe({ type: 'longtask', buffered: true }); } catch (_) {}
      try { new PerformanceObserver((l) => { for (const x of l.getEntries()) if (!x.hadRecentInput) window.__m.cls += x.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (_) {}
      if (sansVerre) document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; document.head.appendChild(s); });
    }, process.env.VERRE === '0');
    const t0 = Date.now();
    await o.pg.goto(`http://localhost:${P.PORT}${url}`, { waitUntil: 'domcontentloaded' });
    await o.pg.waitForSelector('.vrm-main', { timeout: 60000 }).catch(() => {});
    await o.pg.waitForTimeout(8000);
    const ouverture = await o.pg.evaluate(() => ({ lt: window.__m.lt.slice(), cls: +window.__m.cls.toFixed(3) }));
    await o.pg.evaluate(() => { window.__m.ev.length = 0; });
    // les touchers : les onglets nommés, sinon les boutons du sélecteur de l'écran (segments)
    let cibles = onglets;
    if (!cibles) cibles = await o.pg.evaluate(() => [...document.querySelectorAll('.vrm-main :is([role="tab"], .vrm-seg button, .vrm-seg-btn, .sb-segment button)')].filter((b) => b.getClientRects().length).map((b) => b.textContent.trim()).filter(Boolean).slice(0, 3));
    // Chaque toucher : du geste à l'image suivante, mesuré DANS la page (pointerdown → pointerup → click, puis deux
    // rAF : l'écran a été recalculé et peint) — la même chose que l'Event Timing de l'iPhone, sans dépendre de
    // l'émulation tactile du moteur.
    const touchers = [];
    for (let t = 0; t < TOURS; t++) for (const lib of cibles) {
      const d = await o.pg.evaluate(async (lib) => {
        const b = [...document.querySelectorAll('.vrm-main button')].find((x) => x.textContent.trim().startsWith(lib) && x.getClientRects().length);
        if (!b) return null;
        const t0 = performance.now();
        for (const ty of ['pointerdown', 'pointerup']) b.dispatchEvent(new PointerEvent(ty, { bubbles: true, pointerType: 'touch', isPrimary: true }));
        b.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        return Math.round(performance.now() - t0);
      }, lib);
      if (d != null) touchers.push(d);
      await o.pg.waitForTimeout(1200);
    }
    const ev = touchers.concat(await o.pg.evaluate(() => window.__m.ev.filter(([n]) => /pointer|click|touch|key/.test(n)).map(([, d]) => d)));
    ev.sort((a, b) => b - a);
    res[e] = { cibles, inp: ev[0] || 0, durees: ev.slice(0, 8), ouvertureLongues: ouverture.lt.length, ouverturePire: Math.max(0, ...ouverture.lt), ouvertureSomme: ouverture.lt.reduce((a, b) => a + b, 0), cls: ouverture.cls, pret: Date.now() - t0 };
    console.log(e, JSON.stringify(res[e]));
    await o.ctx.close();
  }
  await nav.close(); P.srv.close();
  console.log(JSON.stringify({ dist: process.env.BANC_DIST || 'dist', verre: process.env.VERRE !== '0', cpu: CPU, res }));
  process.exit(0);
})();
