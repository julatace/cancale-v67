// Captures rapides des écrans « reste » (studio) — outil de travail du banc studio-reste.
// SHOTS=<dossier> ECRANS=compta,messages LARGEURS=390,1512 THEMES=clair,sombre node scripts/bancs/_studio-captures.cjs
'use strict';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const B = require('./_base-messages-stock.cjs');
const OUT = process.env.SHOTS || path.join(require('os').tmpdir(), 'studio-shots');
const ECR = {
  compta: '/?tab=compta', declarer: '/?tab=argent_declarer', factures: '/?tab=invoices', stats: '/?tab=dashboard',
  messages: '/?tab=messages', settings: '/?tab=settings', communaute: '/?tab=communaute', emails: '/?tab=emails',
  accueil: '/', tarifs: '/tarifs',
};
const voulus = String(process.env.ECRANS || Object.keys(ECR).join(',')).split(',');
const LARG = String(process.env.LARGEURS || '390,1512').split(',').map(Number);
const THEMES = String(process.env.THEMES || 'clair,sombre').split(',');
const PLEIN = process.env.PLEIN === '1';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-angle=swiftshader', '--no-proxy-server'] });
  try {
    for (const e of voulus) for (const W of LARG) for (const t of THEMES) {
      const sans = e === 'accueil' || e === 'tarifs';
      const o = await P.ouvrir(nav, { W, sombre: t === 'sombre', b: B.baseVolume(), url: ECR[e], api: B.apiVolume, sansSession: sans });
      if (sans) await o.pg.waitForTimeout(3500); else await P.pret(o.pg);
      await o.pg.waitForTimeout(800);
      const f = path.join(OUT, `${e}-${W}-${t}.png`);
      await o.pg.screenshot({ path: f, fullPage: PLEIN });
      console.log(f, o.erreurs.length ? 'ERREURS ' + o.erreurs.join(' | ') : '');
      await o.ctx.close();
    }
  } finally { await nav.close(); P.srv.close(); }
})();
