// Outil de maquette C : plan des éléments visibles (classe, data-*, [gauche,haut,taille]) des écrans — ECRANS=ventes,achats PROF=7
'use strict';
const P = require('./design-passe.cjs');
const ECR = { journee: '/?tab=journee', ventes: '/?tab=ventes', achats: '/?tab=achats', annonces: '/?tab=annonces', argent: '/?tab=compta' };
const voulus = String(process.env.ECRANS || Object.keys(ECR).join(',')).split(',');
const PROF = Number(process.env.PROF || 7), W = Number(process.env.W || 390), MAQ = process.env.MAQUETTE || '';
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const e of voulus) {
      const o = await P.ouvrir(nav, { W, sombre: false, b: P.base(), url: ECR[e], avantChargement: MAQ ? `localStorage.setItem('vrm_maquette', ${JSON.stringify(MAQ)})` : '' });
      await P.pret(o.pg); await o.pg.waitForTimeout(Number(process.env.ATTENTE || 3000));
      const out = await o.pg.evaluate(([PROF]) => {
        const L = []; const vis = (x) => { const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < 1400; };
        const tour = (x, d) => {
          if (!x || d > PROF) return; if (!vis(x)) { if (getComputedStyle(x).display === 'contents') for (const k of x.children) tour(k, d); return; }
          const c = typeof x.className === 'string' ? x.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
          const da = [...x.attributes].filter((a) => a.name.startsWith('data-')).slice(0, 2).map((a) => a.name).join(' ');
          const r = x.getBoundingClientRect();
          const t = /^(BUTTON|A|SUMMARY|H1|H2)$/.test(x.tagName) ? ' «' + (x.innerText || x.getAttribute('aria-label') || '').trim().slice(0, 30).replace(/\n/g, ' ') + '»' : '';
          L.push(`${'  '.repeat(d)}${x.tagName.toLowerCase()}${c ? '.' + c : ''} ${da} [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}x${Math.round(r.height)}]${t}`);
          for (const k of x.children) tour(k, d + 1);
        };
        tour(document.querySelector('.vrm-app-header'), 0); tour(document.querySelector('.vrm-main'), 0);
        for (const t of document.querySelectorAll('body > div')) { const r = t.getBoundingClientRect(); if (r.height > 0 && r.top > 600) L.push('BODY> ' + t.className + ' ' + [...t.attributes].map((a) => a.name).join(',') + ` [${Math.round(r.top)},${Math.round(r.height)}]`); }
        return L.join('\n');
      }, [PROF]);
      console.log('=== ' + e + '\n' + out);
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
})();
