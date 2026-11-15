// Sonde jetable (banc ecrans-verre-2) : la boîte et les marges des enfants d'un sélecteur.
'use strict';
require('./_porte-banc.cjs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const { preparer, VUES } = require('./ecrans-verre-2.cjs');
const [vue, sel] = [process.argv[2], process.argv[3]];
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  const o = await P.ouvrir(nav, { W: 390, sombre: false, b: B.baseVolume(), url: VUES[vue], api: B.apiVolume });
  await P.pret(o.pg); await preparer(o, vue);
  const r = await o.pg.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return 'absent'; return [...e.children].map((c) => { const b = c.getBoundingClientRect(), s = getComputedStyle(c); return `${c.tagName.toLowerCase()}.${String(c.className).split(' ').slice(0, 3).join('.')} y=${Math.round(b.top)} h=${Math.round(b.height)} m=${s.marginTop}/${s.marginBottom} p=${s.paddingTop}/${s.paddingBottom} d=${s.display}`; }); }, sel);
  console.log(Array.isArray(r) ? r.join('\n') : r);
  await o.ctx.close(); await nav.close(); P.srv.close();
})();
