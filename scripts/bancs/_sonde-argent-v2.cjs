require('./_porte-banc.cjs');
// Sonde (17 nov.) : quelles règles CSS gagnent sur un élément, nouveau design allumé. Outil de mise au point.
'use strict';
const path = require('path');
const NV = require('./nouveau-vendeur.cjs');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const [tab, sel, props] = [process.env.TAB || 'settings', process.env.SEL || '.v2-pm-liste .vrm-set-val', (process.env.PROPS || 'white-space,text-overflow,max-width').split(',')];
(async () => {
  await new Promise((r) => NV.srv.listen(NV.PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const o = await NV.ouvrir(nav, { W: 390, sombre: process.env.SOMBRE === '1', base: { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 }, tab });
  await o.pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1'));
  await o.pg.goto(`http://localhost:${NV.PORT}/?tab=${tab}`); await o.pg.waitForTimeout(5000);
  const r = await o.pg.evaluate(([sel, props]) => {
    const els = [...document.querySelectorAll(sel)].slice(0, 3); const out = [];
    for (const e of els) { const cs = getComputedStyle(e); const m = { txt: e.textContent.trim().slice(0, 30), cls: e.className, calc: Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)])), regles: [] };
      for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (_) { continue; } const pas = (L) => { for (const x of L) { if (x.cssRules && !x.selectorText) { pas(x.cssRules); continue; } if (!x.selectorText) continue; let ok = false; try { ok = e.matches(x.selectorText); } catch (_) {} if (!ok) continue; for (const p of props) if (x.style.getPropertyValue(p)) m.regles.push(p + ' ' + x.style.getPropertyValue(p) + (x.style.getPropertyPriority(p) ? ' !' : '') + '  ⟵ ' + x.selectorText.slice(0, 160)); } }; pas(rs); }
      m.inline = e.getAttribute('style'); out.push(m); }
    return out; }, [sel, props]);
  console.log(JSON.stringify(r, null, 1));
  await nav.close(); NV.srv.close(); process.exit(0);
})();
