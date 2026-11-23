// Sonde jetable (23 nov.) : où s'écrivent les nombres restés lisibles en mode présentation.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright'));
const NV = require('./nouveau-vendeur.cjs');
(async () => {
  await new Promise((ok) => NV.srv.listen(NV.PORT, ok));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const b = { lignes: JSON.parse(JSON.stringify(NV.JEU_LIGNES)), comptes: NV.JEU_COMPTES, ecritures: 0 };
  const { pg } = await NV.ouvrir(nav, { W: 1512, sombre: false, base: b, tab: 'journee' });
  await pg.evaluate(() => localStorage.setItem('vrm_presentation', '1'));
  for (const e of (process.env.ECRANS || 'compta').split(',')) {
    await pg.goto(`http://localhost:${NV.PORT}/?tab=${e}`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 3000));
    const r = await pg.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.body, 4);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (/^\s*\d{2,}([ ,.]\d+)?\s*$/.test(n.nodeValue || '')) {
          const p = n.parentElement; out.push((n.nodeValue + ' ⇐ ' + p.outerHTML.slice(0, 160) + ' ⇐ ' + (p.parentElement ? p.parentElement.outerHTML.slice(0, 220) : '')));
        }
      }
      return out.slice(0, 25);
    });
    console.log('== ' + e + '\n' + r.join('\n'));
  }
  await nav.close(); NV.srv.close();
})();
