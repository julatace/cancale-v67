// Outil de travail : plan des éléments visibles d'un écran (tag.classe, boutons) — ECRAN=messages W=390
'use strict';
const path = require('path');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const URL = process.env.URL_ECRAN || '/?tab=' + (process.env.ECRAN || 'messages');
const W = Number(process.env.W || 390);
const PROF = Number(process.env.PROF || 9);
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    const sans = process.env.SANS === '1';
    const o = await P.ouvrir(nav, { W, sombre: false, b: B.baseVolume(), url: URL, api: B.apiVolume, sansSession: sans });
    if (sans) await o.pg.waitForTimeout(3500); else await P.pret(o.pg);
    if (process.env.CLIC) { await o.pg.locator(process.env.CLIC).first().click().catch((e) => console.log('clic KO', e.message)); await o.pg.waitForTimeout(1500); }
    const out = await o.pg.evaluate(([PROF, RACINE]) => {
      const lignes = [];
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
      const tour = (e, d) => {
        if (d > PROF || !vis(e)) return;
        const c = typeof e.className === 'string' ? e.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
        const da = [...e.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 3).map((a) => a.name + (a.value ? '=' + a.value.slice(0, 20) : '')).join(' ');
        const r = e.getBoundingClientRect();
        const t = (e.tagName === 'BUTTON' || e.tagName === 'A' || e.tagName === 'SUMMARY') ? ' «' + (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40).replace(/\n/g, ' ') + '»' : '';
        lignes.push(`${'  '.repeat(d)}${e.tagName.toLowerCase()}${c ? '.' + c : ''} ${da} [${Math.round(r.top)},${Math.round(r.height)}]${t}`);
        for (const k of e.children) tour(k, d + 1);
      };
      const rac = document.querySelector(RACINE) || document.querySelector('.vrm-main') || document.body;
      tour(rac, 0);
      return lignes.join('\n');
    }, [PROF, process.env.RACINE || '.vrm-main']);
    console.log(out);
    if (o.erreurs.length) console.log('ERREURS', o.erreurs);
    await o.ctx.close();
  } finally { await nav.close(); P.srv.close(); }
})();
