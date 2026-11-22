// Captures d'écran (outil de session, style-clarte tranche 2) : Ventes, Annonces, fiche annonce à 390 et 1512.
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
require('./_porte-banc.cjs');
const path = require('path');
const P = require('./design-passe.cjs');
const { ouvrir, base, srv, PORT, chromium } = P;
const SHOTS = process.env.SHOTS || '/tmp/capt-tableaux';
require('fs').mkdirSync(SHOTS, { recursive: true });
(async () => {
  await new Promise((r) => srv.listen(PORT, r));
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const b = base();
  for (const W of [1512, 390]) for (const [nom, url] of [['ventes', '/?tab=ventes'], ['annonces', '/?tab=cat_annonces']]) {
    const { ctx, pg, erreurs } = await ouvrir(nav, { W, sombre: false, b, url });
    await pg.waitForSelector('.vrm-main', { timeout: 40000 }).catch(() => {}); await pg.waitForTimeout(6000);
    await pg.screenshot({ path: path.join(SHOTS, `${nom}-${W}.png`) });
    if (nom === 'annonces') {
      const r = await pg.locator('[data-tt-ligne], .n-tt-ligne, [data-n-rangee]').first().click({ timeout: 4000 }).then(() => 1).catch(() => 0);
      await pg.waitForTimeout(1500); if (r) await pg.screenshot({ path: path.join(SHOTS, `fiche-${W}.png`) });
    }
    console.log(nom, W, erreurs.length ? erreurs.join('|').slice(0, 200) : 'ok');
    await ctx.close();
  }
  await nav.close(); srv.close(); process.exit(0);
})();
