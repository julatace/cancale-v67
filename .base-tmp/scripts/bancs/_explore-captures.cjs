require(require('path').join(__dirname, '..', '_horloge-notif.cjs'));
require('./_porte-banc.cjs');
'use strict';
// Outil de regard (pas un banc) : captures de Ma journée, Ventes · À expédier et d'une fiche de vente.
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const { fabriquer } = require('./_base-volume.cjs');
const SHOTS = process.env.SHOTS; fs.mkdirSync(SHOTS, { recursive: true });
const b = fabriquer({ comptes: 3, ventes: 2000 });
const m = b.main[0].data; const at = '2026-11-01T10:00:00.000Z';
Object.assign(m, { vrm_bienvenue_vue: { at }, vrm_visite_vue: { at }, vrm_je_vends: { choix: 'sneakers', at }, vrm_configuration: { etat: 'fait', at, statut: null, version: 1 },
  vrm_plateformes_affichees: { sites: ['vinted'], at }, vrm_parcours: { etat: 'fini', at }, vrm_bilan_minute: { vu: at, fin: 'vu' } });
const W = Number(process.env.W || 390), sombre = process.env.TH === 'sombre';
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  for (const [nom, url] of (process.env.URLS || 'journee|/?tab=journee,expedier|/?tab=cat_bord&onglet=envoyer').split(',').map((x) => x.split('|'))) {
    const o = await P.ouvrir(nav, { W, sombre, b, url });
    await P.pret(o.pg); await o.pg.waitForTimeout(3000);
    const defile = async (pre) => {
      for (let i = 0; i < Number(process.env.PAGES || 4); i++) {
        await o.pg.screenshot({ path: path.join(SHOTS, `${pre}-${W}-${sombre ? 's' : 'c'}-${i}.png`) });
        const fini = await o.pg.evaluate((h) => {
          const cands = [...document.querySelectorAll('*')].filter((x) => x.scrollHeight > x.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(x).overflowY) && x.getBoundingClientRect().height > 300);
          const d = cands.sort((a, b) => b.getBoundingClientRect().height * (b.closest('[role=dialog]') ? 10 : 1) - a.getBoundingClientRect().height * (a.closest('[role=dialog]') ? 10 : 1))[0] || document.scrollingElement;
          const av = d.scrollTop; d.scrollTop += h; window.scrollBy(0, h); return d.scrollTop === av && window.scrollY === 0;
        }, W < 600 ? 600 : 700);
        await o.pg.waitForTimeout(600);
        if (fini) break;
      }
    };
    await defile(nom);
    if (process.env.FICHE) {
      const sel = process.env.FICHE_SEL || '.vrm-sale-row';
      const l = (await o.pg.$$(sel))[0];
      console.log('ligne', !!l);
      if (l) { await l.click(); await o.pg.waitForTimeout(2500); await defile('fiche');
        let k = 0;
        for (const c of String(process.env.CLICS || '').split('§').filter(Boolean)) {
          k++; const el = await o.pg.$(c); console.log('clic', c, !!el);
          if (el) { await el.click().catch((e) => console.log(String(e).slice(0, 120))); await o.pg.waitForTimeout(1500); await defile('fiche-c' + k); }
        } }
    }
    console.log(nom, 'erreurs', o.erreurs.slice(0, 3));
    await o.ctx.close();
  }
  await nav.close(); P.srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
