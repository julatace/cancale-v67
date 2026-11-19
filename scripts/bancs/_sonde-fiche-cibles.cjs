// Sonde jetable (19 nov., fiche directe) : quelles règles CSS donnent leur hauteur aux cibles de la fiche ?
'use strict';
const path = require('path');
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const F = require('./fiche-directe.cjs');
const N = process.env.NUM || '3102';
const W = Number(process.env.W || 390);
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    const o = await P.ouvrir(nav, { W, sombre: !!process.env.SOMBRE, b: F.baseDirecte(), url: '/?tab=journee', api: B.apiVolume, dsf: 1 });
    await o.pg.evaluate(() => { try { localStorage.setItem('vrm_design_v2', '1'); } catch (_) {} });
    await o.pg.reload({ waitUntil: 'domcontentloaded' }); await P.pret(o.pg); await o.pg.waitForTimeout(1500);
    await o.pg.evaluate((x) => window.dispatchEvent(new CustomEvent('vrm:fiche-paire', { detail: x })), N);
    await o.pg.waitForSelector(`[data-fiche-paire="${N}"]`, { timeout: 12000 }); await o.pg.waitForTimeout(2500);
    const cdp = await o.ctx.newCDPSession(o.pg);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    for (const sel of (process.env.SELS || '.n-barre-retour|[data-fd-plein]|[data-fd-tout-voir] .n-rangee-corps|[data-fd-tout-voir]|[data-vendu-ailleurs-ouvrir]|.n-fait-touche').split('|')) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-fiche-paire] ${sel}` }).catch(() => ({ nodeId: 0 }));
      if (!nodeId) { console.log(sel, ': absent'); continue; }
      const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
      const comp = await cdp.send('CSS.getComputedStyleForNode', { nodeId });
      const g = (k) => (comp.computedStyle.find((x) => x.name === k) || {}).value;
      console.log(`\n== ${sel} : height ${g('height')} min-height ${g('min-height')} padding ${g('padding-top')}/${g('padding-bottom')} font ${g('font-size')}`);
      for (const r of m.matchedCSSRules || []) {
        const props = r.rule.style.cssProperties.filter((p) => /height|padding|font|line/.test(p.name) && p.value && !p.disabled).map((p) => `${p.name}:${p.value}`);
        if (props.length) console.log('  ', (r.rule.layers || []).map((l) => l.text).join('>') || '(sans couche)', '|', r.rule.selectorList.text.slice(0, 120), '|', props.join('; ').slice(0, 200));
      }
    }
    if (process.env.SHOT) await o.pg.screenshot({ path: process.env.SHOT, fullPage: false });
    await o.ctx.close();
  } finally { await nav.close(); P.srv.close(); }
})();
