// Sonde jetable (style-graphite) : les classes des boutons, champs et pastilles sur Ventes, Annonces, la fiche.
'use strict';
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
const path = require('path');
const P = require('./design-passe.cjs');
const { base, srv, PORT, chromium } = P;
const OUT = process.env.SHOTS || '/tmp';
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  for (const e of ['ventes', 'annonces', 'fiche']) {
    const o = await P.ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=' + (e === 'fiche' ? 'annonces' : e) });
    await o.pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await o.pg.waitForTimeout(5000);
    if (e === 'fiche') { const l = await o.pg.$('[data-fiche-ligne]'); if (l) { await l.tap(); await o.pg.waitForTimeout(2000); } }
    const r = await o.pg.evaluate(() => {
      const vu = (x) => { const q = x.getBoundingClientRect(); return q.width > 2 && q.height > 2 && q.top < innerHeight && q.bottom > 0; };
      const c = {};
      for (const x of document.querySelectorAll('button, a[href], [role=button], input, select, textarea, [class*=pastille], [class*=chip], [class*=etiquette]')) {
        if (!vu(x)) continue;
        const k = x.tagName.toLowerCase() + '.' + String(x.className && x.className.baseVal !== undefined ? x.className.baseVal : x.className).trim().split(/\s+/).slice(0, 3).join('.');
        c[k] = (c[k] || 0) + 1;
      }
      return c;
    });
    console.log('\n== ' + e); for (const [k, n] of Object.entries(r).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(3), k);
    await o.pg.screenshot({ path: path.join(OUT, 'sonde-' + e + '.png') });
    await o.ctx.close();
  }
  await nav.close(); srv.close(); process.exit(0);
})();
