require('./_porte-banc.cjs');
// Sonde (19 nov.) : quelles règles CSS s'appliquent au plein et au corps d'une rangée de Ventes natif (390 tactile).
'use strict';
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const W = Number(process.env.W || 390);
  const { ctx, pg } = await ouvrir(nav, { W, sombre: false, b: base(), url: '/?tab=ventes' });
  const t0 = Date.now(); while (Date.now() - t0 < 40000 && !(await pg.evaluate(() => !!document.querySelector('[data-vn-liste] [data-vn-rang]')))) await pg.waitForTimeout(400);
  await pg.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(pg); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  for (const sel of (process.env.SELS || '[data-vn-plein]|[data-vn-liste] .n-rangee-corps|.n-volets-x').split('|')) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); if (!nodeId) { console.log('absent', sel); continue; }
    const m = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });
    console.log('\n== ' + sel);
    for (const r of m.matchedCSSRules) {
      const props = r.rule.style.cssProperties.filter((p) => /background|color|border|box-shadow|font|padding|height/.test(p.name) && p.value).map((p) => p.name + ':' + p.value).join('; ');
      if (props) console.log((r.rule.layers || []).map((l) => l.text).join('>') + ' | ' + r.rule.selectorList.text.slice(0, 140) + ' { ' + props.slice(0, 300) + ' }');
    }
  }
  console.log('\nRECHERCHES', await pg.evaluate(() => [...document.querySelectorAll('[data-n-recherche], input[type=search]')].map((e) => e.tagName + ':' + (e.getAttribute('placeholder') || e.querySelector('input')?.placeholder || '') + ':' + e.getBoundingClientRect().top)));
  await nav.close(); srv.close(); process.exit(0);
})();
