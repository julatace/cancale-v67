// Sonde jetable (25 nov.) : un écran à 390 px (dsf 2), puis défilé par paliers ; capture à chaque palier.
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const path = require('path'), fs = require('fs');
const P = require('./design-passe.cjs');
const OUT = process.env.SHOTS_SONDE || '/tmp';
const URL_ = process.env.URL_SONDE || '/?tab=journee';
const NOM = process.env.NOM_SONDE || 'defile';
const PALIERS = (process.env.PALIERS || '0,120,400,800').split(',').map(Number);
(async () => {
  const b = P.base();
  const m = b.main[0].data;
  if (process.env.CARTES) m.vrm_aujourdhui_cartes = { ordre: process.env.CARTES.split(','), montrees: process.env.CARTES.split(','), at: Date.now() };
  await new Promise((ok) => P.srv.listen(P.PORT, ok));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const { ctx, pg, erreurs } = await P.ouvrir(nav, { W: 390, b, url: URL_, dsf: 2 });
  if (process.env.CARTES) await pg.evaluate((c) => { try { localStorage.setItem('vrm_aujourdhui_cartes', JSON.stringify({ ordre: c.split(','), montrees: c.split(','), at: Date.now() })); } catch (_) {} }, process.env.CARTES);
  if (process.env.CARTES) await pg.reload();
  await pg.waitForTimeout(Number(process.env.ATTENTE || 9000));
  if (process.env.CLIC) { await pg.click(process.env.CLIC).catch((e) => console.log('clic', String(e).slice(0, 120))); await pg.waitForTimeout(2500); }
  for (const o of (process.env.PARCOURS || '').split(',').filter(Boolean)) {
    await pg.evaluate((o) => { const b = [...document.querySelectorAll('nav button, nav a, [role="tab"]')].find((x) => (x.textContent || '').trim().startsWith(o)); if (b) b.click(); }, o);
    await pg.waitForTimeout(3500);
  }
  fs.mkdirSync(OUT, { recursive: true });
  for (const y of PALIERS) {
    await pg.evaluate((y) => { const s = document.querySelector('.n-coque-ecran') || document.scrollingElement; s.scrollTop = y; }, y);
    await pg.waitForTimeout(500);
    const info = await pg.evaluate(() => { const h = document.querySelector('header.n-barre-titre'); const cs = h ? getComputedStyle(h, '::before') : null; return h ? { attrs: [...h.attributes].map((a) => a.name).join(' '), avant: cs && cs.backgroundColor, op: cs && cs.opacity, z: getComputedStyle(h).zIndex, pos: getComputedStyle(h).position } : null; });
    console.log(y, JSON.stringify(info));
    await pg.screenshot({ path: path.join(OUT, `${NOM}-${y}.png`) });
  }
  if (process.env.EVAL) console.log(await pg.evaluate(process.env.EVAL));
  console.log('erreurs', erreurs);
  await ctx.close(); await nav.close(); P.srv.close();
})();
