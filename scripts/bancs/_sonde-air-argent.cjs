require('./_porte-banc.cjs');
// Sonde (17 nov., « AIR ») : les cartes d'un écran allumé — classe, marge intérieure, écart avec la suivante. Outil de mise au point.
'use strict';
const path = require('path');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const tab = process.env.TAB || 'argent_declarer';
(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const L = JSON.parse(JSON.stringify(NV.JEU_LIGNES)); const main = L.find((r) => r.id === 'main'); main.data.vinted_regime = 'micro'; main.data.vinted_urssaf_freq = 'mensuel';
  const o = await NV.ouvrir(nav, { W: 390, sombre: false, base: { lignes: L, comptes: NV.JEU_COMPTES, ecritures: 0 }, tab: 'cat_ventes' });
  await o.pg.waitForTimeout(4000);
  await o.pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1'));
  await o.pg.goto(`http://localhost:${NV.PORT}/?tab=${tab}`); await o.pg.waitForTimeout(6000);
  const r = await o.pg.evaluate(() => {
    const vis = (e) => e.getClientRects().length && !e.closest('[hidden]');
    const out = [];
    for (const e of document.querySelectorAll('.vrm-main *')) {
      if (!vis(e)) continue; const cs = getComputedStyle(e); const bg = cs.backgroundColor; const rad = parseFloat(cs.borderTopLeftRadius);
      const fond = !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none');
      if (!(rad >= 12) || !fond || e.matches('button, a, input, select, .v2-seg, .v2-seg *, .vrm-tabbar *, .v2-menu, .v2-etiquette') ) continue;
      const q = e.getBoundingClientRect(); if (q.width < 200 || q.height < 40) continue;
      const txt = (e.innerText || '').trim().split('\n')[0].slice(0, 30); out.push({ txt, cls: (e.className || e.tagName).toString().slice(0, 60) + ' < ' + String((e.parentElement && e.parentElement.className) || '').slice(0, 40), data: [...e.attributes].map((a) => a.name).filter((n) => n.startsWith('data-')).slice(0, 3).join(','), pad: cs.padding, y: Math.round(q.top), h: Math.round(q.height) });
    }
    return out; });
  for (const x of r) console.log(x.y, x.h, x.pad, '|', x.txt, '|', x.cls, '|', x.data);
  await nav.close(); NV.srv.close(); process.exit(0);
})();
