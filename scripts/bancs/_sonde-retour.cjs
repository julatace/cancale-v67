// Sonde jetable (25 nov.) : 1512, Aujourd'hui → Annonces → Aujourd'hui ; les hauteurs des blocs du haut à 0,3 s et 3 s du retour.
process.env.BANC_DESIGN_V2 = process.env.BANC_DESIGN_V2 || 'defaut';
const P = require('./design-passe.cjs');
(async () => {
  await new Promise((r) => P.srv.listen(P.PORT, r));
  const nav = await P.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox'] });
  const { ctx, pg } = await P.ouvrir(nav, { W: Number(process.env.W || 1512), b: P.base(), url: '/?tab=journee', dsf: 1 });
  await pg.waitForTimeout(9000);
  const tou = (lib) => pg.evaluate((lib) => { const c = [...document.querySelectorAll('nav a, nav button, .n-laterale a, .n-laterale button')].find((x) => (x.textContent || '').replace(/[0-9\s]+/g, '').startsWith(lib) && x.getClientRects().length); if (c) c.click(); }, lib);
  const dump = () => pg.evaluate(() => [...document.querySelectorAll('.vrm-main .n-colonnes-tb > *, .vrm-main [data-tb="droite"] > *, .vrm-main [data-tb="pilotage"] > *')].map((e) => (e.getAttribute('data-tb') || e.getAttribute('data-v2-bloc') || e.getAttribute('data-v2-bloc-attente') || e.getAttribute('data-place-attente') || e.getAttribute('data-place-gardee') || e.className).toString().slice(0, 40) + ' y' + Math.round(e.getBoundingClientRect().top) + ' h' + Math.round(e.getBoundingClientRect().height)));
  for (const o of ['Annonces', 'Ventes', 'Achats', 'Argent']) { await tou(o); await pg.waitForTimeout(2500); await pg.evaluate(() => { const m = document.querySelector('.vrm-main'); if (m) m.scrollTop = 300; }); await pg.waitForTimeout(2500); }
  await tou('Aujourd');
  for (const t of [150, 600, 1500, 3500]) { await pg.waitForTimeout(t === 150 ? 150 : 450 + (t > 600 ? t - 1050 : 0)); console.log(t, await pg.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.scrollTop > 0).map((e) => (e.className || e.tagName).toString().slice(0, 30) + ':' + e.scrollTop).join(' ')), JSON.stringify(await dump())); }
  await ctx.close(); await nav.close(); P.srv.close();
})();
