// Sonde (design-v2) : la structure rendue d'Annonces allumé, à 390 — pour viser la règle, pas l'orthographe.
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const OUT = process.env.SHOTS || '/tmp';
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = P.base();
  const { ctx, pg } = await P.ouvrir(nav, { W: 390, sombre: false, b, url: '/?tab=annonces' });
  await pg.waitForTimeout(2500);
  await pg.evaluate(() => localStorage.setItem('vrm_design_v2', process.env ? '1' : '1')).catch(() => pg.evaluate(() => localStorage.setItem('vrm_design_v2', '1')));
  await pg.reload({ waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(5000);
  const r = await pg.evaluate(() => {
    const m = document.querySelector('.vrm-main');
    const bandes = [...m.querySelectorAll('*')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().top < 900 && e.children.length && e.parentElement && e.getBoundingClientRect().height > 30).slice(0, 0);
    const top = (sel) => { const e = m.querySelector(sel); if (!e) return null; const q = e.getBoundingClientRect(); return { t: Math.round(q.top), h: Math.round(q.height), cls: e.className }; };
    const carte = m.querySelector('.vrm-ann-card');
    return { tete: top('.vrm-tache-tete'), sel: top('.vrm-paires-selecteur'), stats: top('.vrm-carte-stats, [data-carte-stats], .vrm-heros-hote'), barre: top('[data-ann-barre]'), vues: top('.vrm-stock-views'), groupe: top('.vrm-ann-compte-tete'), carte: top('.vrm-ann-card'),
      carteHtml: carte ? carte.outerHTML.replace(/style="[^"]*"/g, '').replace(/data:image[^"]*/g, '').slice(0, 6000) : '', grilleCls: (m.querySelector('[data-ann-grille]') || {}).className, plus: !!document.querySelector('[data-sb-disque]') };
  });
  fs.writeFileSync(path.join(OUT, 'sonde-annonces.json'), JSON.stringify(r, null, 1));
  await pg.screenshot({ path: path.join(OUT, 'sonde-annonces.png') });
  await ctx.close(); await nav.close(); P.srv.close();
})();
